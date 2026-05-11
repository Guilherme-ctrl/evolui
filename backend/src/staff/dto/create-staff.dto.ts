import { ProfessionalType } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsEnum(ProfessionalType)
  professionalType!: ProfessionalType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;
}
