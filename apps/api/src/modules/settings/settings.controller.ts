import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OnboardingStatus, PreferredChannel } from '@hothotleads/db';

import { Auth } from '../auth/auth.decorator';
import { RequirePermission } from '../auth/access.decorators';
import { requireOrg, type OrgContext, type TenantContext } from '../auth/tenant-context';
import { EntitlementsService } from '../auth/entitlements.service';
import { OrganizationService } from '../organization/organization.service';
import { UsersService } from '../users/users.service';
import {
  ChannelCredentialsService,
  TelegramCredentials,
  WhatsAppCredentials,
} from '../channels/channel-credentials.service';
import { UpdateOrganizationDto, UpdateProfileDto } from './settings.dto';

@Controller('settings')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class SettingsController {
  constructor(
    private readonly orgSvc: OrganizationService,
    private readonly usersSvc: UsersService,
    private readonly channelsSvc: ChannelCredentialsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  @RequirePermission('org:read')
  async get(@Auth() auth: TenantContext) {
    const ctx = await this.requireCompleted(auth);
    const org = await this.orgSvc.getRequired(ctx.org.id);
    const channels = await this.channelsSvc.list(org.id);
    return {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        timezone: org.timezone,
        defaultCurrency: org.defaultCurrency,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      },
      profile: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        preferredChannel: ctx.user.preferredChannel,
      },
      channels,
    };
  }

  @Patch('organization')
  @RequirePermission('org:update')
  async updateOrganization(@Auth() auth: TenantContext, @Body() dto: UpdateOrganizationDto) {
    const ctx = await this.requireCompleted(auth);
    const org = await this.orgSvc.update(ctx.org.id, dto);
    return { id: org.id, name: org.name, timezone: org.timezone, defaultCurrency: org.defaultCurrency };
  }

  /** The signed-in user's own profile; any member may edit it. */
  @Patch('profile')
  async updateProfile(@Auth() auth: TenantContext, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersSvc.updateProfile(auth.user.id, {
      name: dto.name,
      preferredChannel: dto.preferredChannel,
    });
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      preferredChannel: updated.preferredChannel ?? null,
    };
  }

  @Put('channels/:channel')
  @RequirePermission('channels:manage')
  async putChannel(
    @Auth() auth: TenantContext,
    @Param('channel') channelParam: string,
    @Body() credentials: TelegramCredentials | WhatsAppCredentials,
  ) {
    const ctx = await this.requireCompleted(auth);
    const channel = this.parseChannel(channelParam);
    this.entitlements.assertChannelAllowed(ctx, channel);
    if (channel === PreferredChannel.TELEGRAM) {
      await this.channelsSvc.save(ctx.org.id, { channel, credentials: credentials as TelegramCredentials });
    } else {
      await this.channelsSvc.save(ctx.org.id, { channel, credentials: credentials as WhatsAppCredentials });
    }
    return { channel, configured: true };
  }

  @Delete('channels/:channel')
  @RequirePermission('channels:manage')
  @HttpCode(204)
  async deleteChannel(@Auth() auth: TenantContext, @Param('channel') channelParam: string): Promise<void> {
    const ctx = await this.requireCompleted(auth);
    await this.channelsSvc.remove(ctx.org.id, this.parseChannel(channelParam));
  }

  private async requireCompleted(auth: TenantContext): Promise<OrgContext> {
    const ctx = requireOrg(auth);
    if (ctx.org.onboardingStatus !== OnboardingStatus.COMPLETED) {
      throw new ConflictException('Onboarding is not complete');
    }
    return ctx;
  }

  private parseChannel(raw: string): PreferredChannel {
    if (raw !== 'telegram' && raw !== 'whatsapp') {
      throw new NotFoundException(`Unknown channel: ${raw}`);
    }
    return raw as PreferredChannel;
  }
}
