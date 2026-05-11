import { StudentDocumentType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  categoryLabel?: string;

  @IsOptional()
  @IsEnum(StudentDocumentType)
  documentType?: StudentDocumentType | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  documentNumber?: string | null;

  @IsOptional()
  @IsString()
  preferredPosition?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  physicalRestrictions?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /**
   * Vincula o aluno a uma conta-atleta existente (`User.role = ATLETA`).
   * Use para irmãos que compartilham a mesma conta (switcher — RN-200).
   * Mutuamente exclusivo com `accountEmail/accountPassword`.
   */
  @IsOptional()
  @IsString()
  accountUserId?: string;

  /** Cria uma nova conta-atleta junto do aluno (admin define senha — RN-1402). */
  @ValidateIf((o) => !o.accountUserId)
  @IsOptional()
  @IsEmail()
  accountEmail?: string;

  @ValidateIf((o) => !o.accountUserId)
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  accountPassword?: string;
}
