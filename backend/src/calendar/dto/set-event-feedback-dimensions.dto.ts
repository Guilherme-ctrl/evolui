import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Override por evento. Três estados úteis:
 * - `dimensions = null` ou `unset = true`  → volta a herdar `Tenant.defaultFeedbackDimensions` (RN-1325).
 * - `dimensions = []`                       → desliga feedback nesse evento.
 * - `dimensions = [...]`                    → substitui o default só para esse evento.
 */
export class EventFeedbackDimensionDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,30}$/, {
    message:
      'key deve ser minúscula, começar com letra e conter apenas [a-z0-9_] (até 31 chars).',
  })
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @IsInt()
  @Min(0)
  @Max(99)
  order!: number;
}

export class SetEventFeedbackDimensionsDto {
  /// `null` (ou omitir e enviar `unset=true`) volta para o default do tenant.
  /// `[]` desliga o feedback neste evento. Array preenchido substitui.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EventFeedbackDimensionDto)
  dimensions?: EventFeedbackDimensionDto[] | null;

  /// Açúcar para clientes que preferem um booleano explícito a enviar `null`.
  @IsOptional()
  unset?: boolean;
}
