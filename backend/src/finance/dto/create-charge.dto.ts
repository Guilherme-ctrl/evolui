import {
  IsInt,
  IsDateString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateChargeDto {
  @IsString()
  studentId!: string;

  @IsInt()
  @Min(0)
  amountCents!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
