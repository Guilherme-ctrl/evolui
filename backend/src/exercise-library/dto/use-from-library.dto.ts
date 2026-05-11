import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UseFromLibraryDto {
  @IsString()
  libraryItemId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sets?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  repetitions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  durationSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  restSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}
