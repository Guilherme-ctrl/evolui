import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

/**
 * Submissão da conta-atleta para o feedback físico pós-treino de um aluno.
 * `scores` é parcial — só dimensões respondidas vão; o serviço valida que cada
 * chave existe em `Workout.feedbackDimensions` e o valor está em 1..5.
 */
export class SubmitWorkoutFeedbackDto {
  @IsObject()
  scores!: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}

/** Para validação interna de cada par chave/valor de `scores`. */
export class FeedbackScoreEntryDto {
  @IsString()
  key!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;
}
