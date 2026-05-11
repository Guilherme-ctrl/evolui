import { EventType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsEnum(EventType)
  type!: EventType;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsBoolean()
  isWholeSchool!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  turmaIds?: string[];
}
