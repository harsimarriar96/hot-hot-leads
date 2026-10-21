import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CHANNEL_KEYS, type ChannelKey } from '@hothotleads/types';

export class EntitlementFeaturesDto {
  @IsOptional() @IsBoolean() discovery?: boolean;
  @IsOptional() @IsBoolean() enrichment?: boolean;
  @IsOptional() @IsBoolean() outreach?: boolean;
  @IsOptional() @IsBoolean() signals?: boolean;
  @IsOptional() @IsBoolean() buyingIntent?: boolean;
  @IsOptional() @IsBoolean() schedules?: boolean;
  @IsOptional() @IsBoolean() chat?: boolean;
}

export class EntitlementLimitsDto {
  @IsOptional() @IsInt() @Min(0) maxProducts?: number;
  @IsOptional() @IsInt() @Min(0) maxMembers?: number;
  @IsOptional() @IsInt() @Min(0) maxLeadsPerMonth?: number;
}

export class EntitlementsPatchDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EntitlementFeaturesDto)
  features?: EntitlementFeaturesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EntitlementLimitsDto)
  limits?: EntitlementLimitsDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CHANNEL_KEYS as readonly string[], { each: true })
  channels?: ChannelKey[];
}

export class CreateOrganizationDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  plan?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EntitlementsPatchDto)
  entitlements?: EntitlementsPatchDto;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  plan?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string;
}

export class InviteOwnerDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class DeleteOrganizationDto {
  @IsString()
  @Length(1, 80)
  confirmSlug!: string;
}
