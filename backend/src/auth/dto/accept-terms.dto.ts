import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Aceite de termos no 1º login da conta-atleta (RN-201).
 * Quem aceita pode ser o próprio atleta (`ATLETA`) ou um adulto operando a
 * conta (informar grau de parentesco). O backend registra `termsAcceptedAt`
 * + `termsKinship` no `User` (auditável).
 */
export class AcceptTermsDto {
  /** Quem está aceitando: "ATLETA" ou grau de parentesco (Pai, Mãe, Tutor…). */
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  kinship!: string;

  /** Confirmação explícita de aceite. Ajuda em audit logs do front. */
  @IsOptional()
  @IsIn([true])
  acceptedTerms?: true;
}
