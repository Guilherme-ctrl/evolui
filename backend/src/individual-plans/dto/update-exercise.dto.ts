import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateIndividualPlanExerciseDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  videoUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sets?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  repetitions?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  durationSeconds?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  restSeconds?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;
}
