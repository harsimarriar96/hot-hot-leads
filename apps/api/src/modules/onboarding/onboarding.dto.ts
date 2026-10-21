import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

function isValidTimezone(tz: unknown): boolean {
  if (typeof tz !== 'string' || !tz.length) return false;
  // Newer ICU builds list only canonical names in supportedValuesOf (no "UTC", no
  // "Asia/Kolkata"), so a zone the formatter accepts is valid even when it is not listed.
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf?.('timeZone');
  if (supported?.includes(tz)) return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export class WorkspaceDetailsDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsString()
  @Length(1, 60)
  timezone!: string;

  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  defaultCurrency?: string = 'USD';

  validate(): void {
    if (!isValidTimezone(this.timezone)) {
      throw new Error(`Invalid timezone: ${this.timezone}`);
    }
  }
}

export class TelegramCredentialsDto {
  @IsString()
  @Length(10, 300)
  botToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webhookSecret?: string;
}

export class WhatsAppCredentialsDto {
  @IsString()
  @Length(1, 120)
  phoneNumberId!: string;

  @IsString()
  @Length(10, 600)
  accessToken!: string;

  @IsString()
  @Length(1, 200)
  verifyToken!: string;
}

export class ChannelsStepDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramCredentialsDto)
  telegram?: TelegramCredentialsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppCredentialsDto)
  whatsapp?: WhatsAppCredentialsDto;
}

export class FirstProductIcpDto {
  @IsArray()
  @IsString({ each: true })
  targetIndustries: string[] = [];

  @IsArray()
  @IsString({ each: true })
  companySizes: string[] = [];

  @IsArray()
  @IsString({ each: true })
  geographies: string[] = [];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class FirstProductDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  generalInfo?: string;

  @ValidateNested()
  @Type(() => FirstProductIcpDto)
  icp!: FirstProductIcpDto;
}

export { isValidTimezone };
