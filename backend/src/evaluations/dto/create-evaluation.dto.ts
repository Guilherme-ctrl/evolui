import { Prisma } from '@prisma/client';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEvaluationDto {
  @IsString()
  studentId!: string;

  @IsString()
  turmaId!: string;

  @IsObject()
  scores!: Prisma.JsonObject;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  comment?: string;
}
