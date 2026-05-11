import { ProfessionalType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStaffDto {
  @IsOptional()
  @IsEnum(ProfessionalType)
  professionalType?: ProfessionalType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
