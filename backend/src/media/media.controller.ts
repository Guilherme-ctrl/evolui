import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { MediaService } from './media.service';

const uploadLimits = {
  storage: memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
};

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('turmaId') turmaId?: string,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.media.listForUser(user, turmaId, Number(take) || 40, cursor);
  }

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', uploadLimits))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('turmaId') turmaId?: string,
    @Query('eventId') eventId?: string,
    @Query('studentIds') studentIdsRaw?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    const studentIds = studentIdsRaw
      ? studentIdsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return this.media.saveFile(user, file, turmaId, eventId, studentIds);
  }

  @Post('upload-multi')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FilesInterceptor('files', 12, uploadLimits))
  uploadMulti(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('turmaId') turmaId?: string,
    @Query('eventId') eventId?: string,
    @Query('studentIds') studentIdsRaw?: string,
  ) {
    if (!files?.length) throw new BadRequestException('Arquivos obrigatórios');
    const studentIds = studentIdsRaw
      ? studentIdsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return this.media.saveManyFiles(user, files, turmaId, eventId, studentIds);
  }

  @Get(':id/thumbnail')
  async thumbnail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { buffer } = await this.media.thumbnailBuffer(user, id);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }

  @Get(':id/file')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { asset, buffer } = await this.media.fileBuffer(user, id);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(asset.id)}"`,
    );
    res.send(buffer);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.media.deleteAsset(user, id);
  }
}
