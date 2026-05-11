import { IsString, MinLength } from 'class-validator';

export class DeleteStudentDto {
  @IsString()
  @MinLength(3, {
    message: 'Informe o motivo da exclusão (mín. 3 caracteres).',
  })
  reason!: string;
}
