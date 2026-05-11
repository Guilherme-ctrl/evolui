import { IsString } from 'class-validator';

export class EnrollDto {
  @IsString()
  studentId!: string;
}
