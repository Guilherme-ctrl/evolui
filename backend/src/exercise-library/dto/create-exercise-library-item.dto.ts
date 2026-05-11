import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateExerciseLibraryItemDto {
  @IsString()
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  defaultSets?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  defaultRepetitions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  defaultDurationSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  defaultRestSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}
