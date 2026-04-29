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

import { WorkspaceService } from '../workspace/workspace.service';
import { OperatorService } from '../operator/operator.service';
import {
  ChannelCredentialsService,
  TelegramCredentials,
  WhatsAppCredentials,
} from '../channels/channel-credentials.service';
import { UpdateOperatorDto, UpdateWorkspaceDto } from './settings.dto';

@Controller('settings')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class SettingsController {
  constructor(
    private readonly workspaceSvc: WorkspaceService,
    private readonly operatorSvc: OperatorService,
    private readonly channelsSvc: ChannelCredentialsService,
  ) {}

  @Get()
  async get() {
    const ws = await this.workspaceSvc.get();
    if (!ws || ws.onboardingStatus !== OnboardingStatus.COMPLETED) {
      throw new ConflictException('Onboarding is not complete');
    }
    const operator = await this.operatorSvc.getCurrent();
    const channels = await this.channelsSvc.list(ws);
    return {
      workspace: {
        id: ws.id,
        name: ws.name,
        timezone: ws.timezone,
        defaultCurrency: ws.defaultCurrency,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      },
      operator: operator
        ? {
            id: operator.id,
            name: operator.name,
            email: operator.email,
            preferredChannel: operator.preferredChannel,
          }
        : null,
      channels,
    };
  }

  @Patch('workspace')
  async updateWorkspace(@Body() dto: UpdateWorkspaceDto) {
    await this.requireCompleted();
    const ws = await this.workspaceSvc.update(dto);
    return { id: ws.id, name: ws.name, timezone: ws.timezone, defaultCurrency: ws.defaultCurrency };
  }

  @Patch('operator')
  async updateOperator(@Body() dto: UpdateOperatorDto) {
    const ws = await this.requireCompleted();
    const current = await this.operatorSvc.getCurrent();
    if (!current) throw new NotFoundException('Operator not found');
    const merged = {
      name: dto.name ?? current.name,
      email: dto.email ?? current.email,
      preferredChannel: dto.preferredChannel ?? current.preferredChannel,
    };
    const updated = await this.operatorSvc.upsert(ws, merged);
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      preferredChannel: updated.preferredChannel,
    };
  }

  @Put('channels/:channel')
  async putChannel(
    @Param('channel') channelParam: string,
    @Body() credentials: TelegramCredentials | WhatsAppCredentials,
  ) {
    const ws = await this.requireCompleted();
    const channel = this.parseChannel(channelParam);
    if (channel === PreferredChannel.TELEGRAM) {
      await this.channelsSvc.save(ws, { channel, credentials: credentials as TelegramCredentials });
    } else {
      await this.channelsSvc.save(ws, { channel, credentials: credentials as WhatsAppCredentials });
    }
    return { channel, configured: true };
  }

  @Delete('channels/:channel')
  @HttpCode(204)
  async deleteChannel(@Param('channel') channelParam: string): Promise<void> {
    const ws = await this.requireCompleted();
    await this.channelsSvc.remove(ws, this.parseChannel(channelParam));
  }

  private async requireCompleted() {
    const ws = await this.workspaceSvc.get();
    if (!ws || ws.onboardingStatus !== OnboardingStatus.COMPLETED) {
      throw new ConflictException('Onboarding is not complete');
    }
    return ws;
  }

  private parseChannel(raw: string): PreferredChannel {
    if (raw !== 'telegram' && raw !== 'whatsapp') {
      throw new NotFoundException(`Unknown channel: ${raw}`);
    }
    return raw as PreferredChannel;
  }
}
