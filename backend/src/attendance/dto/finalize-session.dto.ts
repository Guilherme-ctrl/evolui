import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
} from 'class-validator';

class AttendanceRowDto {
  @IsString()
  studentId!: string;

  @IsBoolean()
  present!: boolean;
}

export class FinalizeSessionDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRowDto)
  records!: AttendanceRowDto[];
}
