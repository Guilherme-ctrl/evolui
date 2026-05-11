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

/**
 * Dimensão única do feedback físico. Idêntica à usada em Workout (RN-1323) —
 * mantida em sync para facilitar copy/paste entre níveis.
 */
export class TenantFeedbackDimensionDto {
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

export class SetTenantFeedbackDimensionsDto {
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => TenantFeedbackDimensionDto)
  dimensions!: TenantFeedbackDimensionDto[];
}
