import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTurmaDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  ageRangeText?: string;

  @IsOptional()
  @IsString()
  weekDaysText?: string;

  @IsOptional()
  @IsString()
  scheduleText?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsString()
  coachUserId!: string;

  @IsOptional()
  @IsString()
  categoryLabel?: string;
}
