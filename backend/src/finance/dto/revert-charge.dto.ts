import { IsString, MinLength } from 'class-validator';

export class RevertChargeDto {
  @IsString()
  @MinLength(1, { message: 'Informe o motivo da reversão.' })
  reason!: string;
}
