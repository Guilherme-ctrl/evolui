import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteIndividualPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  completionNote?: string;
}
