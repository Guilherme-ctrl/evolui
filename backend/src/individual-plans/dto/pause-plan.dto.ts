import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PauseIndividualPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
