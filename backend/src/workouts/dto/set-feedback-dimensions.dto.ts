import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class FeedbackDimensionDto {
  /// Slug curto e estável (`desgaste_fisico`, `humor`). Usado como chave em
  /// `WorkoutFeedback.scores`. Imutável — renomear `label` é OK; renomear
  /// `key` quebra histórico.
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,30}$/, {
    message:
      'key deve ser minúscula, começar com letra e conter apenas [a-z0-9_] (até 31 chars).',
  })
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @IsInt()
  @Min(0)
  @Max(99)
  order!: number;
}

export class SetFeedbackDimensionsDto {
  /// Máximo 5 dimensões. Aceita lista vazia para desativar feedback no treino.
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FeedbackDimensionDto)
  dimensions!: FeedbackDimensionDto[];
}
