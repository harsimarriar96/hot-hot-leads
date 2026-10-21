import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateIf } from 'class-validator';
import { PreferredChannel } from '@hothotleads/db';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256;

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, PASSWORD_MAX)
  password!: string;
}

export class AcceptInviteDto {
  @IsString()
  @Length(10, 200)
  token!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password?: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(10, 200)
  token!: string;

  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, PASSWORD_MAX)
  currentPassword!: string;

  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  newPassword!: string;
}

export class SwitchOrganizationDto {
  @IsUUID()
  organizationId!: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ValidateIf((o) => o.preferredChannel !== null)
  @IsOptional()
  @IsEnum(PreferredChannel)
  preferredChannel?: PreferredChannel | null;
}

export class InviteDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsEnum(['owner', 'admin', 'member', 'viewer'])
  role!: 'owner' | 'admin' | 'member' | 'viewer';
}

export class UpdateMemberRoleDto {
  @IsEnum(['owner', 'admin', 'member', 'viewer'])
  role!: 'owner' | 'admin' | 'member' | 'viewer';
}
