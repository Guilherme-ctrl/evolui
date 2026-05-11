import { ArrayMinSize, IsArray, IsString } from 'class-validator';

/**
 * Reordena os exercícios do treino: lista completa de IDs na nova ordem.
 * O serviço valida que todos os IDs informados pertencem ao treino e que
 * a lista tem o mesmo tamanho do conjunto atual (evita "delete acidental").
 */
export class ReorderWorkoutExercisesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  exerciseIds!: string[];
}
