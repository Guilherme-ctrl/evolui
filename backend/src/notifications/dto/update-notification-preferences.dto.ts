import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, ValidateNested } from 'class-validator';
import { NOTIFICATION_PREFERENCE_CATEGORIES } from '../notification-categories';

const CATEGORY_VALUES = [...NOTIFICATION_PREFERENCE_CATEGORIES] as string[];

export class NotificationPreferenceEntryDto {
  @IsIn(CATEGORY_VALUES)
  category!: string;

  @IsBoolean()
  inAppEnabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceEntryDto)
  preferences!: NotificationPreferenceEntryDto[];
}
