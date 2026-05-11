import { IsString } from 'class-validator';

export class ChangeCoachDto {
  @IsString()
  coachUserId!: string;
}
