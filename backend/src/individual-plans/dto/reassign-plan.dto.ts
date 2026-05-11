import { IsString } from 'class-validator';

export class ReassignIndividualPlanDto {
  @IsString()
  assignedProfessionalId!: string;
}
