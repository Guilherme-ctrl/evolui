import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateReportDto {
  @IsString()
  studentId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  summaryText!: string;

  @IsOptional()
  @IsObject()
  dataJson?: Record<string, unknown>;
}
