import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

/**
 * Reaponta o aluno para outra conta-atleta (troca de `accountUserId`).
 * Útil para corrigir vinculações ou mover irmãos entre contas (RN-200).
 */
export class SetAccountUserDto {
  /** Conta existente (User ATLETA) no mesmo tenant. */
  @IsOptional()
  @IsString()
  accountUserId?: string;

  /** Alternativa: cria nova conta-atleta com este e-mail/senha. */
  @ValidateIf((o) => !o.accountUserId)
  @IsOptional()
  @IsEmail()
  accountEmail?: string;

  @ValidateIf((o) => !o.accountUserId)
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  accountPassword?: string;
}
