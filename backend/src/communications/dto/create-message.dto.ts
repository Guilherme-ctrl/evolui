import { CommunicationScope } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateMessageDto {
  @IsEnum(CommunicationScope)
  scope!: CommunicationScope;

  @ValidateIf((o) => o.scope === CommunicationScope.TURMA)
  @IsString()
  turmaId?: string;

  @ValidateIf((o) => o.scope === CommunicationScope.DIRECT)
  @IsString()
  recipientUserId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  calendarEventId?: string;
}
