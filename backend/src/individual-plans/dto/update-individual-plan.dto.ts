import { IndividualPlanType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateIndividualPlanDto {
  @IsOptional()
  @IsEnum(IndividualPlanType)
  type?: IndividualPlanType;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  weeklyFrequency?: number | null;
}
