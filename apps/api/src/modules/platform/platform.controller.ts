import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Invitation, PlatformOrganization, PlatformUser } from '@hothotleads/types';

import { Auth } from '../auth/auth.decorator';
import { PlatformAdmin } from '../auth/access.decorators';
import { InvitationService } from '../auth/invitation.service';
import { PasswordResetService, type ResetLink } from '../auth/password-reset.service';
import type { TenantContext } from '../auth/tenant-context';
import {
  CreateOrganizationDto,
  DeleteOrganizationDto,
  EntitlementsPatchDto,
  InviteOwnerDto,
  UpdateOrganizationDto,
} from './platform.dto';
import { PlatformService } from './platform.service';

/** Super-admin console: manages organizations and their entitlements across the deployment. */
@Controller('platform')
@PlatformAdmin()
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly invitations: InvitationService,
    private readonly resets: PasswordResetService,
  ) {}

  @Get('organizations')
  async listOrganizations(): Promise<PlatformOrganization[]> {
    return this.platform.listOrganizations();
  }

  @Post('organizations')
  @HttpCode(201)
  async createOrganization(@Body() dto: CreateOrganizationDto): Promise<PlatformOrganization> {
    return this.platform.createOrganization(dto);
  }

  @Get('organizations/:id')
  async getOrganization(@Param('id', ParseUUIDPipe) id: string): Promise<PlatformOrganization> {
    return this.platform.getOrganization(id);
  }

  @Patch('organizations/:id')
  async updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<PlatformOrganization> {
    return this.platform.updateOrganization(id, dto);
  }

  @Patch('organizations/:id/entitlements')
  async updateEntitlements(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EntitlementsPatchDto,
  ): Promise<PlatformOrganization> {
    return this.platform.updateEntitlements(id, dto);
  }

  /** Invite the organization's first (or another) owner; the link is returned, never emailed. */
  @Post('organizations/:id/invite-owner')
  @HttpCode(201)
  async inviteOwner(
    @Auth() auth: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteOwnerDto,
  ): Promise<Invitation> {
    await this.platform.getOrganization(id);
    return this.invitations.create(id, dto.email, 'owner', auth.user.id);
  }

  @Delete('organizations/:id')
  @HttpCode(204)
  async deleteOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteOrganizationDto,
  ): Promise<void> {
    await this.platform.deleteOrganization(id, dto.confirmSlug);
  }

  @Get('users')
  async listUsers(): Promise<PlatformUser[]> {
    return this.platform.listUsers();
  }

  @Post('users/:id/password-reset-link')
  @HttpCode(200)
  async resetLink(@Param('id', ParseUUIDPipe) id: string): Promise<ResetLink> {
    await this.platform.requireUser(id);
    return this.resets.createLink(id);
  }
}
