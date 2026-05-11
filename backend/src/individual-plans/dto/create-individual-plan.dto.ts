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

export class CreateIndividualPlanDto {
  @IsEnum(IndividualPlanType)
  type!: IndividualPlanType;

  @IsString()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  weeklyFrequency?: number;

  /** Obrigatório para ADMIN; ignorado para TREINADOR (usa o próprio StaffProfile). */
  @IsOptional()
  @IsString()
  assignedProfessionalId?: string;
}
