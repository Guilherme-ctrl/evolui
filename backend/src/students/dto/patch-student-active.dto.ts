import { IsBoolean } from 'class-validator';

export class PatchStudentActiveDto {
  @IsBoolean()
  active!: boolean;
}
