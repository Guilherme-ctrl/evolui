import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { ensureCoachTurma } from '../common/permissions/scope';
import { studentIdsForAccountUser } from '../common/permissions/athlete-scope';
import { NotificationsService } from '../notifications/notifications.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_BATCH_BYTES = 240 * 1024 * 1024;

@Injectable()
export class MediaService {
  private readonly uploadRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.uploadRoot =
      this.config.get<string>('UPLOAD_ROOT') ??
      path.join(process.cwd(), 'uploads');
  }

  absolutePath(storageKey: string) {
    const resolved = path.resolve(this.uploadRoot, storageKey);
    if (!resolved.startsWith(path.resolve(this.uploadRoot))) {
      throw new ForbiddenException();
    }
    return resolved;
  }

  private normalizeKey(storageKey: string) {
    return storageKey.split(path.sep).join('/');
  }

  private async tryBuildThumbnail(
    file: Express.Multer.File,
    relDir: string,
  ): Promise<string | undefined> {
    if (!file.buffer?.length) return undefined;
    const looksVideo =
      file.mimetype.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv)$/i.test(file.originalname);
    if (looksVideo) return undefined;
    try {
      const thumbBuf = await sharp(file.buffer)
        .rotate()
        .resize({
          width: 400,
          height: 400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
      const thumbName = 'thumb.webp';
      const thumbRel = path.join(relDir, thumbName);
      const thumbFull = this.absolutePath(thumbRel);
      await fs.mkdir(path.dirname(thumbFull), { recursive: true });
      await fs.writeFile(thumbFull, thumbBuf);
      return this.normalizeKey(thumbRel);
    } catch {
      return undefined;
    }
  }

  private async persistUploadedFile(
    user: AuthUser,
    file: Express.Multer.File,
    turmaId?: string,
    eventId?: string,
    studentIds?: string[],
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TREINADOR) {
      throw new ForbiddenException();
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('Upload sem buffer (memória)');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Arquivo excede 40MB');
    }
    if (turmaId) await ensureCoachTurma(this.prisma, user, turmaId);
    const relDir = path.join(user.tenantId, randomUUID());
    const ext = path.extname(file.originalname) || '';
    const storageKeyRaw = path.join(relDir, `file${ext}`);
    const full = this.absolutePath(storageKeyRaw);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
    const storageKey = this.normalizeKey(storageKeyRaw);
    const thumbnailKey = await this.tryBuildThumbnail(file, relDir);
    return this.prisma.mediaAsset.create({
      data: {
        tenantId: user.tenantId,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        turmaId,
        eventId,
        thumbnailKey,
        uploadedById: user.sub,
        studentTags:
          studentIds?.length && studentIds.length > 0
            ? {
                create: studentIds.map((studentId) => ({ studentId })),
              }
            : undefined,
      },
      include: { studentTags: true },
    });
  }

  private async notifyTurmaUpload(user: AuthUser, turmaId: string) {
    const userIds = await this.notifications.recipientUserIdsForTurmas(
      user.tenantId,
      [turmaId],
    );
    await this.notifications.emitToUsers({
      tenantId: user.tenantId,
      userIds,
      type: 'MEDIA',
      title: 'Novas fotos do treino',
      body: 'Novas mídias foram adicionadas à turma.',
    });
  }

  async saveFile(
    user: AuthUser,
    file: Express.Multer.File,
    turmaId?: string,
    eventId?: string,
    studentIds?: string[],
  ) {
    const asset = await this.persistUploadedFile(
      user,
      file,
      turmaId,
      eventId,
      studentIds,
    );
    if (turmaId) await this.notifyTurmaUpload(user, turmaId);
    return asset;
  }

  async saveManyFiles(
    user: AuthUser,
    files: Express.Multer.File[],
    turmaId?: string,
    eventId?: string,
    studentIds?: string[],
  ) {
    if (!files.length) throw new BadRequestException('Nenhum arquivo');
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > MAX_BATCH_BYTES) {
      throw new BadRequestException('Lote excede 240MB no total');
    }
    const assets = [];
    for (const file of files) {
      assets.push(
        await this.persistUploadedFile(
          user,
          file,
          turmaId,
          eventId,
          studentIds,
        ),
      );
    }
    if (turmaId) await this.notifyTurmaUpload(user, turmaId);
    return assets;
  }

  async getAsset(user: AuthUser, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { studentTags: true, turma: true },
    });
    if (!asset) throw new NotFoundException();
    if (user.role === UserRole.ADMIN) return asset;
    if (user.role === UserRole.TREINADOR && asset.turmaId) {
      await ensureCoachTurma(this.prisma, user, asset.turmaId);
      return asset;
    }
    if (user.role === UserRole.ATLETA) {
      const visible = await studentIdsForAccountUser(this.prisma, user);
      if (!visible.length) throw new ForbiddenException();
      const set = new Set(visible);
      const tagged = asset.studentTags.some((t) => set.has(t.studentId));
      if (tagged) return asset;
      if (asset.turmaId) {
        const enr = await this.prisma.enrollment.findFirst({
          where: {
            turmaId: asset.turmaId,
            tenantId: user.tenantId,
            studentId: { in: [...set] },
          },
        });
        if (enr) return asset;
      }
      throw new ForbiddenException();
    }
    throw new ForbiddenException();
  }

  async fileBuffer(user: AuthUser, id: string) {
    const asset = await this.getAsset(user, id);
    const full = this.absolutePath(asset.storageKey);
    const buf = await fs.readFile(full);
    return { asset, buffer: buf };
  }

  async thumbnailBuffer(user: AuthUser, id: string) {
    const asset = await this.getAsset(user, id);
    if (!asset.thumbnailKey)
      throw new NotFoundException('Thumbnail indisponível');
    const full = this.absolutePath(asset.thumbnailKey);
    const buf = await fs.readFile(full);
    return { buffer: buf };
  }

  async deleteAsset(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!asset) throw new NotFoundException();
    const full = this.absolutePath(asset.storageKey);
    await fs.unlink(full).catch(() => undefined);
    if (asset.thumbnailKey) {
      const thumb = this.absolutePath(asset.thumbnailKey);
      await fs.unlink(thumb).catch(() => undefined);
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }

  async listForUser(
    user: AuthUser,
    turmaId?: string,
    take = 40,
    cursor?: string,
  ) {
    const cap = Math.min(take, 100);
    if (user.role === UserRole.ATLETA && turmaId) {
      const sid = await studentIdsForAccountUser(this.prisma, user);
      if (!sid.length) return [];
      const enr = await this.prisma.enrollment.findFirst({
        where: { turmaId, tenantId: user.tenantId, studentId: { in: sid } },
      });
      if (!enr)
        throw new ForbiddenException('Turma não vinculada aos seus atletas');
    }
    if (user.role === UserRole.TREINADOR && turmaId) {
      await ensureCoachTurma(this.prisma, user, turmaId);
    }
    const listInclude = {
      turma: { select: { id: true, name: true } },
    } as const;

    if (user.role === UserRole.ADMIN) {
      return this.prisma.mediaAsset.findMany({
        where: { tenantId: user.tenantId, ...(turmaId ? { turmaId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: cap + 1,
        include: listInclude,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
    }
    if (user.role === UserRole.TREINADOR) {
      const turmas = await this.prisma.turma.findMany({
        where: { tenantId: user.tenantId, coachUserId: user.sub },
        select: { id: true },
      });
      const ids = turmas.map((t) => t.id);
      if (!ids.length) return [];
      const turmaFilter = turmaId ? turmaId : { in: ids };
      return this.prisma.mediaAsset.findMany({
        where: {
          tenantId: user.tenantId,
          turmaId: turmaFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: cap + 1,
        include: listInclude,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
    }
    if (user.role === UserRole.ATLETA) {
      const sid = await studentIdsForAccountUser(this.prisma, user);
      if (!sid.length) return [];
      return this.prisma.mediaAsset.findMany({
        where: {
          tenantId: user.tenantId,
          ...(turmaId ? { turmaId } : {}),
          OR: [
            { studentTags: { some: { studentId: { in: sid } } } },
            {
              turma: {
                enrollments: { some: { studentId: { in: sid } } },
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: cap + 1,
        include: listInclude,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
    }
    return [];
  }
}
