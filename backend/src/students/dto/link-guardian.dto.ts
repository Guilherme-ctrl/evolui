import { IsBoolean, IsString } from 'class-validator';

export class LinkGuardianDto {
  @IsString()
  guardianId!: string;

  @IsBoolean()
  isPrimaryForBilling!: boolean;
}
