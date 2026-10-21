import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { MembershipsRepository, UsersRepository, normalizeEmail, type User } from '@hothotleads/db';
import type { AuthMeResponse, LoginResponse } from '@hothotleads/types';

import { Auth } from './auth.decorator';
import { AuthService } from './auth.service';
import { type AuthedRequest } from './auth.guard';
import {
  AcceptInviteDto,
  ChangePasswordDto,
  LoginDto,
  ResetPasswordDto,
  SwitchOrganizationDto,
  UpdateMeDto,
} from './auth.dto';
import { InvitationService } from './invitation.service';
import { toMeResponse } from './me';
import { PasswordResetService } from './password-reset.service';
import { PasswordService } from './password.service';
import { Public } from './public.decorator';
import { SessionService } from './session.service';
import { TenantContextService } from './tenant-context.service';
import type { TenantContext } from './tenant-context';
import { UsersService } from '../users/users.service';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AuthController {
  constructor(
    private readonly throttle: AuthService,
    private readonly usersRepo: UsersRepository,
    private readonly usersSvc: UsersService,
    private readonly membershipsRepo: MembershipsRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tenant: TenantContextService,
    private readonly invitations: InvitationService,
    private readonly resets: PasswordResetService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponse> {
    const keys = [`ip:${req.ip ?? 'unknown'}`, `email:${normalizeEmail(dto.email)}`];
    if (keys.some((k) => this.throttle.isLockedOut(k))) {
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.usersRepo.findByEmail(dto.email);
    const ok = user ? await this.passwords.verify(dto.password, user.passwordHash) : false;
    if (!user || !ok) {
      keys.forEach((k) => this.throttle.recordFailure(k));
      throw new UnauthorizedException('Invalid email or password');
    }
    keys.forEach((k) => this.throttle.clearFailures(k));
    return this.signIn(user, null, req);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest): Promise<void> {
    await this.sessions.revoke(req.sessionId);
  }

  @Get('me')
  async me(@Auth() ctx: TenantContext): Promise<AuthMeResponse> {
    return this.buildMe(ctx);
  }

  @Patch('me')
  async updateMe(@Auth() ctx: TenantContext, @Body() dto: UpdateMeDto): Promise<AuthMeResponse> {
    const user = await this.usersSvc.updateProfile(ctx.user.id, {
      name: dto.name,
      preferredChannel: dto.preferredChannel,
    });
    return this.buildMe(await this.tenant.forRequest(user, ctx.org?.id ?? null));
  }

  /** Remember an organization on the session so later requests need no header. */
  @Post('switch-org')
  @HttpCode(200)
  async switchOrganization(@Req() req: AuthedRequest, @Body() dto: SwitchOrganizationDto): Promise<AuthMeResponse> {
    const user = await this.requireUser(req.auth.user.id);
    const ctx = await this.tenant.forRequest(user, dto.organizationId);
    await this.sessions.setActiveOrganization(req.sessionId, dto.organizationId);
    return this.buildMe(ctx);
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.resets.change(req.auth.user.id, dto.currentPassword, dto.newPassword, req.sessionId);
  }

  @Public()
  @Get('invitation')
  async invitation(@Query('token') token?: string) {
    if (!token) throw new BadRequestException('token is required');
    return this.invitations.describe(token);
  }

  @Public()
  @Post('accept-invite')
  @HttpCode(200)
  async acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request) {
    const result = await this.invitations.accept(
      dto.token,
      { name: dto.name, password: dto.password },
      { ip: req.ip, userAgent: req.header('user-agent') },
    );
    if (result.kind === 'requires_login') {
      return { requiresLogin: true as const, email: result.email, organization: result.organization };
    }
    const user = await this.requireUser(result.userId);
    const ctx = await this.tenant.forRequest(user, result.organizationId);
    return { token: result.token, me: await this.buildMe(ctx) } satisfies LoginResponse;
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.resets.reset(dto.token, dto.password);
    return { ok: true };
  }

  private async signIn(user: User, orgId: string | null, req: Request): Promise<LoginResponse> {
    const memberships = await this.membershipsRepo.listForUser(user.id);
    const activeOrganizationId = orgId ?? (memberships.length === 1 ? memberships[0].organization.id : null);
    const { token } = await this.sessions.issue(user.id, {
      activeOrganizationId,
      ip: req.ip,
      userAgent: req.header('user-agent'),
    });
    await this.usersRepo.touchLastLogin(user.id);
    const ctx = await this.tenant.forRequest(user, activeOrganizationId);
    return { token, me: toMeResponse(ctx, memberships) };
  }

  private async buildMe(ctx: TenantContext): Promise<AuthMeResponse> {
    const memberships = await this.membershipsRepo.listForUser(ctx.user.id);
    return toMeResponse(ctx, memberships);
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.usersRepo.findById(id);
    if (!user) throw new UnauthorizedException('Sign in required');
    return user;
  }
}
