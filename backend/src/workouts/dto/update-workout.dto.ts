import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateWorkoutDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
