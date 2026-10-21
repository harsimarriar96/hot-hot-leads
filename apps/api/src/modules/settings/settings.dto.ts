import { IsEnum, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { PreferredChannel } from '@hothotleads/db';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ValidateIf((o) => o.preferredChannel !== null)
  @IsOptional()
  @IsEnum(PreferredChannel)
  preferredChannel?: PreferredChannel | null;
}
