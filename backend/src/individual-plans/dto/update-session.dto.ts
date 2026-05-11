import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateIndividualPlanSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedDurationMinutes?: number | null;
}
