import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class BulkChargesDto {
  @IsString()
  studentId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  /** Dia do mês (1–28 recomendado para mensalidades estáveis). */
  @IsInt()
  @Min(1)
  @Max(28)
  dueDayOfMonth!: number;

  @IsInt()
  @Min(1)
  @Max(36)
  months!: number;

  /** Primeiro mês de competência, formato YYYY-MM */
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'startMonth deve ser YYYY-MM',
  })
  startMonth!: string;
}
