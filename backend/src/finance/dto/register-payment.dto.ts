import { IsOptional, IsString } from 'class-validator';

export class RegisterPaymentDto {
  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
