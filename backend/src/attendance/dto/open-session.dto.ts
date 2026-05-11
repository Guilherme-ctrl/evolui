import { AttendanceMode } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class OpenSessionDto {
  @IsString()
  turmaId!: string;

  @IsString()
  eventId!: string;

  @IsEnum(AttendanceMode)
  mode!: AttendanceMode;
}
