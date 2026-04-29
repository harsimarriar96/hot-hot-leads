import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  OnboardingStatus,
  PreferredChannel,
  Product,
  ProductIcp,
  Workspace,
} from '@hothotleads/db';

import { WorkspaceService } from '../workspace/workspace.service';
import { OperatorService } from '../operator/operator.service';
import { ChannelCredentialsService } from '../channels/channel-credentials.service';
import {
  ChannelsStepDto,
  FirstProductDto,
  OperatorProfileDto,
  WorkspaceDetailsDto,
  isValidTimezone,
} from './onboarding.dto';

const TRANSITIONS: Record<OnboardingStatus, OnboardingStatus | null> = {
  [OnboardingStatus.PENDING]: OnboardingStatus.WORKSPACE_DETAILS,
  [OnboardingStatus.WORKSPACE_DETAILS]: OnboardingStatus.OPERATOR_PROFILE,
  [OnboardingStatus.OPERATOR_PROFILE]: OnboardingStatus.CHANNELS,
  [OnboardingStatus.CHANNELS]: OnboardingStatus.FIRST_PRODUCT,
  [OnboardingStatus.FIRST_PRODUCT]: OnboardingStatus.COMPLETED,
  [OnboardingStatus.COMPLETED]: null,
};

export interface OnboardingStatusView {
  status: OnboardingStatus;
  currentStep: OnboardingStatus;
  completedSteps: OnboardingStatus[];
  data: {
    workspace_details?: { name: string; timezone: string; defaultCurrency: string };
    operator_profile?: { name: string; email: string; preferredChannel: PreferredChannel };
    channels?: { channel: PreferredChannel; configured: boolean; updatedAt: Date }[];
    first_product?: { name: string };
  };
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly workspaceSvc: WorkspaceService,
    private readonly operatorSvc: OperatorService,
    private readonly channelsSvc: ChannelCredentialsService,
  ) {}

  async getStatus(): Promise<OnboardingStatusView> {
    const ws = await this.workspaceSvc.get();
    if (!ws) {
      return {
        status: OnboardingStatus.PENDING,
        currentStep: OnboardingStatus.PENDING,
        completedSteps: [],
        data: {},
      };
    }
    const operator = await this.operatorSvc.getCurrent();
    const channels = await this.channelsSvc.list(ws);

    const data: OnboardingStatusView['data'] = {
      workspace_details: { name: ws.name, timezone: ws.timezone, defaultCurrency: ws.defaultCurrency },
    };
    if (operator) {
      data.operator_profile = {
        name: operator.name,
        email: operator.email,
        preferredChannel: operator.preferredChannel ?? PreferredChannel.TELEGRAM,
      };
    }
    if (channels.length > 0) data.channels = channels;

    const em = this.em.fork();
    const products = await em.find(Product, {}, { limit: 1 });
    if (products.length > 0) data.first_product = { name: products[0].name };

    return {
      status: ws.onboardingStatus,
      currentStep: this.currentStep(ws.onboardingStatus),
      completedSteps: this.completedSteps(ws.onboardingStatus),
      data,
    };
  }

  async submitWorkspaceDetails(dto: WorkspaceDetailsDto): Promise<Workspace> {
    if (!isValidTimezone(dto.timezone)) {
      throw new BadRequestException({ field: 'timezone', message: 'Invalid IANA timezone' });
    }
    const ws = await this.workspaceSvc.get();
    const currentStatus = ws?.onboardingStatus ?? OnboardingStatus.PENDING;
    if (currentStatus !== OnboardingStatus.PENDING && currentStatus !== OnboardingStatus.WORKSPACE_DETAILS) {
      throw new ConflictException(`Cannot submit workspace_details; current status is ${currentStatus}`);
    }
    const updated = await this.workspaceSvc.createOrUpdate({
      name: dto.name,
      timezone: dto.timezone,
      defaultCurrency: dto.defaultCurrency ?? 'USD',
    });
    if (updated.onboardingStatus === OnboardingStatus.PENDING) {
      return this.workspaceSvc.setStatus(OnboardingStatus.OPERATOR_PROFILE);
    }
    if (updated.onboardingStatus === OnboardingStatus.WORKSPACE_DETAILS) {
      return this.workspaceSvc.advanceStatus(
        OnboardingStatus.WORKSPACE_DETAILS,
        OnboardingStatus.OPERATOR_PROFILE,
      );
    }
    return updated;
  }

  async submitOperatorProfile(dto: OperatorProfileDto): Promise<void> {
    const ws = await this.workspaceSvc.getRequired();
    if (ws.onboardingStatus !== OnboardingStatus.OPERATOR_PROFILE) {
      throw new ConflictException(`Cannot submit operator_profile; current status is ${ws.onboardingStatus}`);
    }
    await this.operatorSvc.upsert(ws, {
      name: dto.name,
      email: dto.email,
      preferredChannel: dto.preferredChannel,
    });
    await this.workspaceSvc.advanceStatus(OnboardingStatus.OPERATOR_PROFILE, OnboardingStatus.CHANNELS);
  }

  async submitChannels(dto: ChannelsStepDto): Promise<void> {
    const ws = await this.workspaceSvc.getRequired();
    if (ws.onboardingStatus !== OnboardingStatus.CHANNELS) {
      throw new ConflictException(`Cannot submit channels; current status is ${ws.onboardingStatus}`);
    }
    if (dto.telegram) {
      await this.channelsSvc.save(ws, { channel: PreferredChannel.TELEGRAM, credentials: dto.telegram });
    }
    if (dto.whatsapp) {
      await this.channelsSvc.save(ws, { channel: PreferredChannel.WHATSAPP, credentials: dto.whatsapp });
    }
    await this.workspaceSvc.advanceStatus(OnboardingStatus.CHANNELS, OnboardingStatus.FIRST_PRODUCT);
  }

  async submitFirstProduct(dto: FirstProductDto): Promise<Product> {
    const ws = await this.workspaceSvc.getRequired();
    if (ws.onboardingStatus !== OnboardingStatus.FIRST_PRODUCT) {
      throw new ConflictException(`Cannot submit first_product; current status is ${ws.onboardingStatus}`);
    }
    const em = this.em.fork();
    const slug = slugify(dto.name);
    const product = await em.transactional(async (tx) => {
      const existing = await tx.findOne(Product, { name: dto.name });
      if (existing) throw new ConflictException(`Product "${dto.name}" already exists`);
      const p = tx.create(
        Product,
        {
          name: dto.name,
          slug,
          generalInfo: dto.generalInfo,
        },
        { partial: true },
      );
      tx.create(
        ProductIcp,
        {
          product: p,
          targetIndustries: dto.icp.targetIndustries ?? [],
          companySizes: dto.icp.companySizes ?? [],
          geographies: dto.icp.geographies ?? [],
          notes: dto.icp.notes,
        },
        { partial: true },
      );
      await tx.flush();
      return p;
    });

    await this.workspaceSvc.setStatus(OnboardingStatus.COMPLETED);
    this.logger.log(`Onboarding complete — workspace ${ws.id}, product ${product.id}`);
    return product;
  }

  async reset(): Promise<void> {
    await this.workspaceSvc.reset();
    this.logger.warn('Onboarding reset — workspace and all operators/channels wiped');
  }

  private currentStep(status: OnboardingStatus): OnboardingStatus {
    if (status === OnboardingStatus.COMPLETED) return OnboardingStatus.COMPLETED;
    if (status === OnboardingStatus.PENDING) return OnboardingStatus.WORKSPACE_DETAILS;
    return status;
  }

  private completedSteps(status: OnboardingStatus): OnboardingStatus[] {
    const order = [
      OnboardingStatus.WORKSPACE_DETAILS,
      OnboardingStatus.OPERATOR_PROFILE,
      OnboardingStatus.CHANNELS,
      OnboardingStatus.FIRST_PRODUCT,
    ];
    const index = order.indexOf(status);
    if (status === OnboardingStatus.COMPLETED) return order;
    if (index <= 0) return [];
    return order.slice(0, index);
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
