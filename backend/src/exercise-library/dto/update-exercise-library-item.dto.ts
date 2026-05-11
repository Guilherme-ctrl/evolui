import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateExerciseLibraryItemDto {
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
  defaultSets?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  defaultRepetitions?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  defaultDurationSeconds?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  defaultRestSeconds?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;
}
