import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, WorkoutAssignmentScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { studentIdsForAccountUser } from '../common/permissions/athlete-scope';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { AddWorkoutExerciseDto } from './dto/add-workout-exercise.dto';
import { UpdateWorkoutExerciseDto } from './dto/update-workout-exercise.dto';
import { ReorderWorkoutExercisesDto } from './dto/reorder-workout-exercises.dto';
import { CreateWorkoutAssignmentDto } from './dto/create-workout-assignment.dto';
import { SetFeedbackDimensionsDto } from './dto/set-feedback-dimensions.dto';
import { SubmitWorkoutFeedbackDto } from './dto/submit-workout-feedback.dto';

const workoutInclude = {
  createdByUser: { select: { id: true, fullName: true, role: true } },
  ownerStaff: {
    select: {
      id: true,
      professionalType: true,
      user: { select: { id: true, fullName: true } },
    },
  },
  exercises: {
    orderBy: { order: 'asc' as const },
  },
  assignments: {
    select: {
      id: true,
      scope: true,
      turmaId: true,
      studentId: true,
      notes: true,
      createdAt: true,
      turma: { select: { id: true, name: true } },
      student: { select: { id: true, fullName: true, active: true } },
    },
  },
} satisfies Prisma.WorkoutInclude;

type FeedbackDimension = { key: string; label: string; order: number };

/** Normaliza um Date para o início do dia (00:00:00.000) em UTC. */
function toDayDate(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function parseDimensions(value: unknown): FeedbackDimension[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (x): x is FeedbackDimension =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as Record<string, unknown>).key === 'string' &&
        typeof (x as Record<string, unknown>).label === 'string',
    )
    .map((x, i) => ({
      key: x.key,
      label: x.label,
      order: typeof x.order === 'number' ? x.order : i,
    }))
    .sort((a, b) => a.order - b.order);
}

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quem pode ver/operar a lista de treinos do tenant:
   * - ADMIN: sempre;
   * - TREINADOR: precisa de `StaffProfile.active` (mesma regra da biblioteca de
   *   exercícios — RN-1311). O ATLETA usa rotas dedicadas em `/athlete/...`.
   */
  private async requireOperator(user: AuthUser) {
    if (user.role === UserRole.ADMIN) return null;
    if (user.role !== UserRole.TREINADOR) throw new ForbiddenException();
    const profile = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tenantId, userId: user.sub, active: true },
    });
    if (!profile) throw new ForbiddenException();
    return profile;
  }

  /**
   * Para mutações de criação/edição/atribuição usamos a mesma regra de
   * "autor ou ADMIN" da biblioteca: o autor é sempre o `User.sub`; o
   * `ownerStaffId` só é preenchido quando o autor é TREINADOR/Staff.
   */
  private isOwnerOrAdmin(
    user: AuthUser,
    workout: { createdByUserId: string },
  ) {
    if (user.role === UserRole.ADMIN) return true;
    return workout.createdByUserId === user.sub;
  }

  private async findOwnedOrThrow(user: AuthUser, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!workout) throw new NotFoundException();
    if (!this.isOwnerOrAdmin(user, workout)) throw new ForbiddenException();
    return workout;
  }

  async list(
    user: AuthUser,
    opts: { search?: string; includeArchived?: boolean } = {},
  ) {
    await this.requireOperator(user);
    const where: Prisma.WorkoutWhereInput = { tenantId: user.tenantId };
    if (!opts.includeArchived) where.archived = false;
    if (opts.search?.trim()) {
      where.name = { contains: opts.search.trim(), mode: 'insensitive' };
    }
    return this.prisma.workout.findMany({
      where,
      orderBy: [{ archived: 'asc' }, { name: 'asc' }],
      include: workoutInclude,
      take: 200,
    });
  }

  async getOne(user: AuthUser, id: string) {
    await this.requireOperator(user);
    const w = await this.prisma.workout.findFirst({
      where: { id, tenantId: user.tenantId },
      include: workoutInclude,
    });
    if (!w) throw new NotFoundException();
    return w;
  }

  async create(user: AuthUser, dto: CreateWorkoutDto) {
    const profile = await this.requireOperator(user);
    return this.prisma.workout.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdByUserId: user.sub,
        ownerStaffId: profile?.id ?? null,
      },
      include: workoutInclude,
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateWorkoutDto) {
    await this.findOwnedOrThrow(user, id);
    return this.prisma.workout.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : (dto.description?.trim() ?? null),
        notes:
          dto.notes === undefined ? undefined : (dto.notes?.trim() ?? null),
      },
      include: workoutInclude,
    });
  }

  async setArchived(user: AuthUser, id: string, archived: boolean) {
    await this.findOwnedOrThrow(user, id);
    return this.prisma.workout.update({
      where: { id },
      data: { archived },
      include: workoutInclude,
    });
  }

  // ---------- Exercícios do treino ----------

  async addExercise(user: AuthUser, workoutId: string, dto: AddWorkoutExerciseDto) {
    await this.findOwnedOrThrow(user, workoutId);
    const library = await this.prisma.exerciseLibraryItem.findFirst({
      where: {
        id: dto.libraryItemId,
        tenantId: user.tenantId,
        archived: false,
      },
    });
    if (!library) {
      throw new BadRequestException(
        'Exercício da biblioteca não encontrado ou arquivado.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.workoutExercise.count({ where: { workoutId } });
      const insertOrder =
        dto.order === undefined || dto.order > current ? current : dto.order;
      if (insertOrder < current) {
        // desloca itens >= insertOrder para liberar a posição
        // (truque: aumenta tudo em N, depois decrementa N-1 para evitar conflito unique)
        await tx.workoutExercise.updateMany({
          where: { workoutId, order: { gte: insertOrder } },
          data: { order: { increment: 10000 } },
        });
        await tx.workoutExercise.updateMany({
          where: { workoutId, order: { gte: 10000 + insertOrder } },
          data: { order: { decrement: 9999 } },
        });
      }
      return tx.workoutExercise.create({
        data: {
          workoutId,
          libraryItemId: library.id,
          nameSnapshot: library.name,
          descriptionSnapshot: library.description,
          videoUrlSnapshot: library.videoUrl,
          order: insertOrder,
          sets: dto.sets ?? library.defaultSets ?? null,
          repetitions: dto.repetitions ?? library.defaultRepetitions ?? null,
          durationSeconds:
            dto.durationSeconds ?? library.defaultDurationSeconds ?? null,
          restSeconds:
            dto.restSeconds ?? library.defaultRestSeconds ?? null,
          notes: dto.notes?.trim() || null,
        },
      });
    });
  }

  async updateExercise(
    user: AuthUser,
    workoutId: string,
    exerciseId: string,
    dto: UpdateWorkoutExerciseDto,
  ) {
    await this.findOwnedOrThrow(user, workoutId);
    const ex = await this.prisma.workoutExercise.findFirst({
      where: { id: exerciseId, workoutId },
    });
    if (!ex) throw new NotFoundException();
    return this.prisma.workoutExercise.update({
      where: { id: exerciseId },
      data: {
        sets: dto.sets === undefined ? undefined : dto.sets,
        repetitions:
          dto.repetitions === undefined ? undefined : dto.repetitions,
        durationSeconds:
          dto.durationSeconds === undefined ? undefined : dto.durationSeconds,
        restSeconds:
          dto.restSeconds === undefined ? undefined : dto.restSeconds,
        notes:
          dto.notes === undefined ? undefined : (dto.notes?.trim() ?? null),
      },
    });
  }

  async removeExercise(user: AuthUser, workoutId: string, exerciseId: string) {
    await this.findOwnedOrThrow(user, workoutId);
    return this.prisma.$transaction(async (tx) => {
      const ex = await tx.workoutExercise.findFirst({
        where: { id: exerciseId, workoutId },
      });
      if (!ex) throw new NotFoundException();
      await tx.workoutExercise.delete({ where: { id: exerciseId } });
      // compacta `order` dos itens posteriores
      await tx.workoutExercise.updateMany({
        where: { workoutId, order: { gt: ex.order } },
        data: { order: { decrement: 1 } },
      });
      return { ok: true };
    });
  }

  async reorderExercises(
    user: AuthUser,
    workoutId: string,
    dto: ReorderWorkoutExercisesDto,
  ) {
    await this.findOwnedOrThrow(user, workoutId);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.workoutExercise.findMany({
        where: { workoutId },
        select: { id: true },
      });
      const currentIds = new Set(current.map((c) => c.id));
      if (currentIds.size !== dto.exerciseIds.length) {
        throw new BadRequestException(
          'Lista de reordenação deve conter exatamente todos os exercícios do treino.',
        );
      }
      for (const id of dto.exerciseIds) {
        if (!currentIds.has(id)) {
          throw new BadRequestException(
            `Exercício ${id} não pertence a este treino.`,
          );
        }
      }
      // 2-passos para evitar conflito da unique (workoutId, order):
      // 1) joga todos para "order + 10000" preservando a antiga sequência;
      // 2) aplica a nova ordem normal (0..N-1).
      await tx.workoutExercise.updateMany({
        where: { workoutId },
        data: { order: { increment: 10000 } },
      });
      let idx = 0;
      for (const id of dto.exerciseIds) {
        await tx.workoutExercise.update({
          where: { id },
          data: { order: idx },
        });
        idx++;
      }
      return tx.workoutExercise.findMany({
        where: { workoutId },
        orderBy: { order: 'asc' },
      });
    });
  }

  // ---------- Atribuições ----------

  async assign(
    user: AuthUser,
    workoutId: string,
    dto: CreateWorkoutAssignmentDto,
  ) {
    await this.findOwnedOrThrow(user, workoutId);
    if (dto.scope === WorkoutAssignmentScope.TURMA) {
      if (!dto.turmaId) {
        throw new BadRequestException('turmaId é obrigatório para scope=TURMA.');
      }
      const turma = await this.prisma.turma.findFirst({
        where: { id: dto.turmaId, tenantId: user.tenantId },
        select: { id: true, coachUserId: true },
      });
      if (!turma) throw new NotFoundException('Turma não encontrada.');
      if (user.role === UserRole.TREINADOR && turma.coachUserId !== user.sub) {
        throw new ForbiddenException(
          'Treinador só atribui treino à sua própria turma.',
        );
      }
      try {
        return await this.prisma.workoutAssignment.create({
          data: {
            tenantId: user.tenantId,
            workoutId,
            scope: WorkoutAssignmentScope.TURMA,
            turmaId: turma.id,
            assignedByUserId: user.sub,
            notes: dto.notes?.trim() || null,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(
            'Este treino já está atribuído a essa turma.',
          );
        }
        throw e;
      }
    }
    // STUDENT
    if (!dto.studentId) {
      throw new BadRequestException(
        'studentId é obrigatório para scope=STUDENT.',
      );
    }
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: user.tenantId, active: true },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Aluno não encontrado ou inativo.');
    }
    try {
      return await this.prisma.workoutAssignment.create({
        data: {
          tenantId: user.tenantId,
          workoutId,
          scope: WorkoutAssignmentScope.STUDENT,
          studentId: student.id,
          assignedByUserId: user.sub,
          notes: dto.notes?.trim() || null,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Este treino já está atribuído a esse aluno.',
        );
      }
      throw e;
    }
  }

  async unassign(user: AuthUser, workoutId: string, assignmentId: string) {
    await this.findOwnedOrThrow(user, workoutId);
    const a = await this.prisma.workoutAssignment.findFirst({
      where: { id: assignmentId, workoutId, tenantId: user.tenantId },
    });
    if (!a) throw new NotFoundException();
    await this.prisma.workoutAssignment.delete({ where: { id: a.id } });
    return { ok: true };
  }

  // ---------- Visualização da conta-atleta ----------

  /**
   * Lista os treinos visíveis para um `Student` específico:
   * - atribuições diretas (scope=STUDENT),
   * - atribuições nas turmas em que o aluno está matriculado (scope=TURMA).
   * Exige que o aluno seja da conta-atleta logada (RN-200).
   */
  async listForAthleteAccount(user: AuthUser, studentId: string) {
    if (user.role !== UserRole.ATLETA) throw new ForbiddenException();
    const visible = await studentIdsForAccountUser(this.prisma, user);
    if (!visible.includes(studentId)) {
      throw new ForbiddenException();
    }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { tenantId: user.tenantId, studentId },
      select: { turmaId: true },
    });
    const turmaIds = enrollments.map((e) => e.turmaId);

    const orFilters: Prisma.WorkoutAssignmentWhereInput[] = [
      { scope: WorkoutAssignmentScope.STUDENT, studentId },
    ];
    if (turmaIds.length) {
      orFilters.push({
        scope: WorkoutAssignmentScope.TURMA,
        turmaId: { in: turmaIds },
      });
    }
    const assignments = await this.prisma.workoutAssignment.findMany({
      where: {
        tenantId: user.tenantId,
        workout: { archived: false },
        OR: orFilters,
      },
      select: {
        id: true,
        scope: true,
        notes: true,
        createdAt: true,
        turma: { select: { id: true, name: true } },
        student: { select: { id: true, fullName: true } },
        workout: {
          select: {
            id: true,
            name: true,
            description: true,
            notes: true,
            archived: true,
            createdAt: true,
            updatedAt: true,
            createdByUser: { select: { id: true, fullName: true } },
            ownerStaff: {
              select: {
                id: true,
                professionalType: true,
                user: { select: { id: true, fullName: true } },
              },
            },
            exercises: {
              orderBy: { order: 'asc' as const },
              select: {
                id: true,
                order: true,
                nameSnapshot: true,
                descriptionSnapshot: true,
                videoUrlSnapshot: true,
                sets: true,
                repetitions: true,
                durationSeconds: true,
                restSeconds: true,
                notes: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // dedup por workoutId — se um aluno tem atribuição direta E pela turma,
    // mostramos uma única vez (prioriza a direta — STUDENT vence TURMA)
    const byWorkout = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) {
      const cur = byWorkout.get(a.workout.id);
      if (!cur) byWorkout.set(a.workout.id, a);
      else if (cur.scope === WorkoutAssignmentScope.TURMA && a.scope === WorkoutAssignmentScope.STUDENT) {
        byWorkout.set(a.workout.id, a);
      }
    }
    return Array.from(byWorkout.values());
  }

  // ---------- Feedback físico pós-treino (RN-1323/1324) ----------

  /**
   * Define as dimensões de feedback do treino. Valida unicidade de `key`,
   * normaliza `order` para 0..N-1 e persiste como JSON ordenado.
   */
  async setFeedbackDimensions(
    user: AuthUser,
    workoutId: string,
    dto: SetFeedbackDimensionsDto,
  ) {
    await this.findOwnedOrThrow(user, workoutId);
    const seen = new Set<string>();
    for (const d of dto.dimensions) {
      if (seen.has(d.key)) {
        throw new BadRequestException(
          `Dimensão duplicada: ${d.key}. Cada key deve aparecer apenas uma vez.`,
        );
      }
      seen.add(d.key);
    }
    const ordered = [...dto.dimensions]
      .sort((a, b) => a.order - b.order)
      .map((d, i) => ({ key: d.key, label: d.label.trim(), order: i }));
    return this.prisma.workout.update({
      where: { id: workoutId },
      data: { feedbackDimensions: ordered as unknown as Prisma.InputJsonValue },
      include: workoutInclude,
    });
  }

  /**
   * Verifica se um aluno está coberto por alguma atribuição (direta ou via
   * turma) e devolve o workout caso sim. Usado pelo fluxo do ATLETA.
   */
  private async ensureStudentReceivedWorkout(
    tenantId: string,
    workoutId: string,
    studentId: string,
  ) {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, tenantId, archived: false },
    });
    if (!workout) {
      throw new NotFoundException('Treino não encontrado ou arquivado.');
    }
    const turmaIds = (
      await this.prisma.enrollment.findMany({
        where: { tenantId, studentId },
        select: { turmaId: true },
      })
    ).map((e) => e.turmaId);
    const orFilters: Prisma.WorkoutAssignmentWhereInput[] = [
      { scope: WorkoutAssignmentScope.STUDENT, studentId },
    ];
    if (turmaIds.length) {
      orFilters.push({
        scope: WorkoutAssignmentScope.TURMA,
        turmaId: { in: turmaIds },
      });
    }
    const ok = await this.prisma.workoutAssignment.findFirst({
      where: { tenantId, workoutId, OR: orFilters },
    });
    if (!ok) {
      throw new ForbiddenException(
        'Este treino não está atribuído a este aluno.',
      );
    }
    return workout;
  }

  /**
   * Submissão de feedback pelo ATLETA. Upsert idempotente por `(workoutId,
   * studentId, hoje)` — reabrir e enviar no mesmo dia atualiza a entrada.
   */
  async submitFeedback(
    user: AuthUser,
    studentId: string,
    workoutId: string,
    dto: SubmitWorkoutFeedbackDto,
  ) {
    if (user.role !== UserRole.ATLETA) throw new ForbiddenException();
    const visible = await studentIdsForAccountUser(this.prisma, user);
    if (!visible.includes(studentId)) {
      throw new ForbiddenException();
    }
    const workout = await this.ensureStudentReceivedWorkout(
      user.tenantId,
      workoutId,
      studentId,
    );
    const dimensions = parseDimensions(workout.feedbackDimensions);
    if (!dimensions.length) {
      throw new BadRequestException(
        'Este treino não tem feedback configurado pelo professor.',
      );
    }
    const dimByKey = new Map(dimensions.map((d) => [d.key, d]));
    const cleanScores: Record<string, number> = {};
    for (const [k, v] of Object.entries(dto.scores ?? {})) {
      if (!dimByKey.has(k)) {
        throw new BadRequestException(
          `Dimensão desconhecida no feedback: ${k}.`,
        );
      }
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        throw new BadRequestException(
          `Valor inválido para ${k}: precisa ser inteiro entre 1 e 5.`,
        );
      }
      cleanScores[k] = v;
    }
    if (!Object.keys(cleanScores).length) {
      throw new BadRequestException(
        'Responda pelo menos uma dimensão antes de enviar.',
      );
    }
    const today = toDayDate(new Date());
    return this.prisma.workoutFeedback.upsert({
      where: {
        workoutId_studentId_submittedDate: {
          workoutId,
          studentId,
          submittedDate: today,
        },
      },
      create: {
        tenantId: user.tenantId,
        workoutId,
        studentId,
        submittedByUserId: user.sub,
        submittedDate: today,
        scores: cleanScores as unknown as Prisma.InputJsonValue,
        notes: dto.notes?.trim() || null,
      },
      update: {
        scores: cleanScores as unknown as Prisma.InputJsonValue,
        notes: dto.notes?.trim() || null,
        submittedByUserId: user.sub,
      },
    });
  }

  /**
   * Retorna o feedback do dia atual para um (workout, student) — usado pela UI
   * do ATLETA para pré-preencher o modal "responder de novo". `null` se ainda
   * não enviou hoje.
   */
  async getTodayFeedback(
    user: AuthUser,
    studentId: string,
    workoutId: string,
  ) {
    if (user.role !== UserRole.ATLETA) throw new ForbiddenException();
    const visible = await studentIdsForAccountUser(this.prisma, user);
    if (!visible.includes(studentId)) throw new ForbiddenException();
    const today = toDayDate(new Date());
    return this.prisma.workoutFeedback.findUnique({
      where: {
        workoutId_studentId_submittedDate: {
          workoutId,
          studentId,
          submittedDate: today,
        },
      },
    });
  }

  /**
   * Relatório do treino: lista de submissões com médias por dimensão. Calculado
   * com as dimensões correntes do treino (chaves que sumiram da configuração
   * continuam visíveis nas submissões, mas não entram nas médias).
   */
  async getWorkoutFeedbackReport(user: AuthUser, workoutId: string) {
    await this.requireOperator(user);
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, tenantId: user.tenantId },
    });
    if (!workout) throw new NotFoundException();
    const dimensions = parseDimensions(workout.feedbackDimensions);
    const feedbacks = await this.prisma.workoutFeedback.findMany({
      where: { tenantId: user.tenantId, workoutId },
      orderBy: [{ submittedDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        student: { select: { id: true, fullName: true, active: true } },
        submittedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });
    // Cálculo das médias por dimensão
    const averages: Array<{
      key: string;
      label: string;
      count: number;
      average: number | null;
    }> = dimensions.map((d) => {
      let sum = 0;
      let count = 0;
      for (const f of feedbacks) {
        const scores = (f.scores ?? {}) as Record<string, unknown>;
        const v = scores[d.key];
        if (typeof v === 'number' && v >= 1 && v <= 5) {
          sum += v;
          count++;
        }
      }
      return {
        key: d.key,
        label: d.label,
        count,
        average: count ? Math.round((sum / count) * 100) / 100 : null,
      };
    });
    return { workoutId, dimensions, averages, feedbacks };
  }

  /**
   * Histórico cronológico de feedbacks do aluno em todos os treinos do tenant.
   * Inclui as dimensões correntes de cada treino para a UI poder renderizar
   * série temporal (mesmo se chaves antigas viraram "histórico").
   */
  async getStudentFeedbackHistory(user: AuthUser, studentId: string) {
    await this.requireOperator(user);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tenantId },
      select: { id: true, fullName: true, active: true },
    });
    if (!student) throw new NotFoundException();
    const feedbacks = await this.prisma.workoutFeedback.findMany({
      where: { tenantId: user.tenantId, studentId },
      orderBy: [{ submittedDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        workout: {
          select: {
            id: true,
            name: true,
            feedbackDimensions: true,
          },
        },
        submittedByUser: { select: { id: true, fullName: true } },
      },
    });
    return {
      student,
      feedbacks: feedbacks.map((f) => ({
        ...f,
        workout: {
          ...f.workout,
          feedbackDimensions: parseDimensions(f.workout.feedbackDimensions),
        },
      })),
    };
  }
}
