import { EvaluationModel } from '@prisma/client';
import { IsArray, IsEnum, IsOptional } from 'class-validator';

export class UpdateEvalConfigDto {
  @IsOptional()
  @IsEnum(EvaluationModel)
  evaluationModel?: EvaluationModel;

  @IsOptional()
  @IsArray()
  evaluationDimensions?: unknown[];
}
