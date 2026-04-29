import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PreferredChannel } from '@hothotleads/db';

export class UpdateWorkspaceDto {
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

export class UpdateOperatorDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(PreferredChannel)
  preferredChannel?: PreferredChannel;
}
