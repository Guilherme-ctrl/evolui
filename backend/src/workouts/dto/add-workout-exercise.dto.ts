import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Adiciona um item da biblioteca ao treino, gerando snapshot de nome/descrição/vídeo
 * (RN-1310). Os parâmetros são *opcionais*: se omitidos, o serviço copia os defaults
 * do `ExerciseLibraryItem` (defaultSets/Repetitions/DurationSeconds/RestSeconds).
 */
export class AddWorkoutExerciseDto {
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

  /**
   * Posição opcional na sequência (0-based). Se ausente, o serviço acrescenta no fim.
   * Quando informado, demais itens são deslocados para acomodar (sem violar unique).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
