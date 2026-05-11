import { IsDateString, IsString, MinLength } from 'class-validator';

export class AggregateReportDto {
  @IsString()
  studentId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsString()
  @MinLength(2)
  title!: string;
}
