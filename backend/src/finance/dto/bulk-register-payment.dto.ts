import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

export class BulkRegisterPaymentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos uma cobrança.' })
  @ArrayMaxSize(100)
  @IsString({ each: true })
  chargeIds!: string[];

  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
