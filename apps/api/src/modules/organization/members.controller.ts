import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Invitation, Member, OrganizationView } from '@hothotleads/types';

import { Auth } from '../auth/auth.decorator';
import { RequirePermission } from '../auth/access.decorators';
import { InviteDto, UpdateMemberRoleDto } from '../auth/auth.dto';
import { InvitationService } from '../auth/invitation.service';
import { PasswordResetService, type ResetLink } from '../auth/password-reset.service';
import { requireOrg, type TenantContext } from '../auth/tenant-context';
import { MembersService } from './members.service';

@Controller('organization')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly invitations: InvitationService,
    private readonly resets: PasswordResetService,
  ) {}

  @Get()
  @RequirePermission('org:read')
  async organization(@Auth() auth: TenantContext): Promise<OrganizationView> {
    return this.members.organizationView(requireOrg(auth).org.id);
  }

  @Get('members')
  @RequirePermission('members:read')
  async list(@Auth() auth: TenantContext): Promise<Member[]> {
    return this.members.list(requireOrg(auth).org.id);
  }

  @Patch('members/:userId')
  @RequirePermission('members:manage')
  async updateRole(
    @Auth() auth: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<Member> {
    return this.members.updateRole(requireOrg(auth), userId, dto.role);
  }

  @Delete('members/:userId')
  @RequirePermission('members:manage')
  @HttpCode(204)
  async remove(@Auth() auth: TenantContext, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    await this.members.remove(requireOrg(auth), userId);
  }

  /** A one-time password-reset link for a member, to be shared by the admin (no email is sent). */
  @Post('members/:userId/password-reset-link')
  @RequirePermission('members:manage')
  @HttpCode(200)
  async resetLink(@Auth() auth: TenantContext, @Param('userId', ParseUUIDPipe) userId: string): Promise<ResetLink> {
    const ctx = requireOrg(auth);
    const member = (await this.members.list(ctx.org.id)).find((m) => m.userId === userId);
    if (!member) throw new NotFoundException('Member not found');
    return this.resets.createLink(userId);
  }

  @Get('invitations')
  @RequirePermission('members:read')
  async invitationsList(@Auth() auth: TenantContext): Promise<Invitation[]> {
    return this.invitations.listPending(requireOrg(auth).org.id);
  }

  @Post('invitations')
  @RequirePermission('members:invite')
  @HttpCode(201)
  async invite(@Auth() auth: TenantContext, @Body() dto: InviteDto): Promise<Invitation> {
    const ctx = requireOrg(auth);
    if (dto.role === 'owner' && ctx.role !== 'owner') {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'Only an owner can invite another owner',
      });
    }
    return this.invitations.create(ctx.org.id, dto.email, dto.role, ctx.membership ? ctx.user.id : null);
  }

  /** Re-issue the link for a pending invitation (the stored token is only a hash). */
  @Post('invitations/:id/link')
  @RequirePermission('members:invite')
  @HttpCode(200)
  async regenerate(@Auth() auth: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<Invitation> {
    const ctx = requireOrg(auth);
    return this.invitations.regenerateLink(ctx.org.id, id, ctx.membership ? ctx.user.id : null);
  }

  @Delete('invitations/:id')
  @RequirePermission('members:invite')
  @HttpCode(204)
  async revoke(@Auth() auth: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.invitations.revoke(requireOrg(auth).org.id, id);
  }
}
