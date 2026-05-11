import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { WorkoutAssignmentScope } from '@prisma/client';

/**
 * Atribui um treino a uma turma OU a um aluno (XOR conforme `scope`). O serviço
 * valida tenant, existência do alvo, vínculo do TREINADOR à turma e impede
 * duplicidade (constraint unique no schema).
 */
export class CreateWorkoutAssignmentDto {
  @IsEnum(WorkoutAssignmentScope)
  scope!: WorkoutAssignmentScope;

  @ValidateIf((o) => o.scope === WorkoutAssignmentScope.TURMA)
  @IsString()
  turmaId?: string;

  @ValidateIf((o) => o.scope === WorkoutAssignmentScope.STUDENT)
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}
