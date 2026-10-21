import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  MembershipRole,
  MembershipsRepository,
  OnboardingStatus,
  Organization,
  PreferredChannel,
  Product,
  ProductIcp,
  slugify,
} from '@hothotleads/db';

import { OrganizationService } from '../organization/organization.service';
import { ChannelCredentialsService } from '../channels/channel-credentials.service';
import { EntitlementsService } from '../auth/entitlements.service';
import { denial, requireOrg, type OrgContext, type TenantContext } from '../auth/tenant-context';
import { ChannelsStepDto, FirstProductDto, WorkspaceDetailsDto, isValidTimezone } from './onboarding.dto';

/** Steps in order. `operator_profile` is no longer a step: the account carries the profile. */
const STEP_ORDER = [
  OnboardingStatus.WORKSPACE_DETAILS,
  OnboardingStatus.CHANNELS,
  OnboardingStatus.FIRST_PRODUCT,
];

export interface OnboardingStatusView {
  status: OnboardingStatus;
  currentStep: OnboardingStatus;
  completedSteps: OnboardingStatus[];
  data: {
    workspace_details?: { name: string; timezone: string; defaultCurrency: string };
    channels?: { channel: PreferredChannel; configured: boolean; updatedAt: Date }[];
    first_product?: { name: string };
  };
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly orgSvc: OrganizationService,
    private readonly membershipsRepo: MembershipsRepository,
    private readonly channelsSvc: ChannelCredentialsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getStatus(ctx: TenantContext): Promise<OnboardingStatusView> {
    const org = ctx.org ? await this.orgSvc.get(ctx.org.id) : null;
    if (!org) {
      return {
        status: OnboardingStatus.PENDING,
        currentStep: OnboardingStatus.WORKSPACE_DETAILS,
        completedSteps: [],
        data: {},
      };
    }
    const channels = await this.channelsSvc.list(org.id);

    const data: OnboardingStatusView['data'] = {
      workspace_details: { name: org.name, timezone: org.timezone, defaultCurrency: org.defaultCurrency },
    };
    if (channels.length > 0) data.channels = channels;

    const products = await this.em.fork().find(Product, { organization: org.id }, { limit: 1 });
    if (products.length > 0) data.first_product = { name: products[0].name };

    return {
      status: org.onboardingStatus,
      currentStep: this.currentStep(org.onboardingStatus),
      completedSteps: this.completedSteps(org.onboardingStatus),
      data,
    };
  }

  /** Creates the organization on first submit; the caller becomes its owner. */
  async submitWorkspaceDetails(ctx: TenantContext, dto: WorkspaceDetailsDto): Promise<Organization> {
    if (!isValidTimezone(dto.timezone)) {
      throw new BadRequestException({ field: 'timezone', message: 'Invalid IANA timezone' });
    }
    const existing = ctx.org ? await this.orgSvc.get(ctx.org.id) : null;
    const currentStatus = existing?.onboardingStatus ?? OnboardingStatus.PENDING;
    if (currentStatus !== OnboardingStatus.PENDING && currentStatus !== OnboardingStatus.WORKSPACE_DETAILS) {
      throw new ConflictException(`Cannot submit workspace_details; current status is ${currentStatus}`);
    }
    const details = {
      name: dto.name,
      timezone: dto.timezone,
      defaultCurrency: dto.defaultCurrency ?? 'USD',
    };
    if (existing) {
      if (!ctx.permissions.has('org:update')) {
        throw denial({ code: 'permission_denied', message: 'Your role does not allow org:update', permission: 'org:update' });
      }
      await this.orgSvc.update(existing.id, details);
      return this.orgSvc.setStatus(existing.id, OnboardingStatus.CHANNELS);
    }
    // A user with no organization creates one and becomes its owner.
    const org = await this.orgSvc.create({ ...details, onboardingStatus: OnboardingStatus.CHANNELS });
    await this.membershipsRepo.create(ctx.user.id, org.id, MembershipRole.OWNER);
    return org;
  }

  async submitChannels(ctx: TenantContext, dto: ChannelsStepDto): Promise<void> {
    const { org } = requireOrg(ctx);
    const current = await this.orgSvc.getRequired(org.id);
    if (current.onboardingStatus !== OnboardingStatus.CHANNELS) {
      throw new ConflictException(`Cannot submit channels; current status is ${current.onboardingStatus}`);
    }
    if (dto.telegram) {
      this.entitlements.assertChannelAllowed(ctx as OrgContext, 'telegram');
      await this.channelsSvc.save(org.id, { channel: PreferredChannel.TELEGRAM, credentials: dto.telegram });
    }
    if (dto.whatsapp) {
      this.entitlements.assertChannelAllowed(ctx as OrgContext, 'whatsapp');
      await this.channelsSvc.save(org.id, { channel: PreferredChannel.WHATSAPP, credentials: dto.whatsapp });
    }
    await this.orgSvc.advanceStatus(org.id, OnboardingStatus.CHANNELS, OnboardingStatus.FIRST_PRODUCT);
  }

  async submitFirstProduct(ctx: TenantContext, dto: FirstProductDto): Promise<Product> {
    const orgCtx = requireOrg(ctx);
    const { org } = orgCtx;
    await this.entitlements.assertCanCreateProduct(orgCtx);
    const current = await this.orgSvc.getRequired(org.id);
    if (current.onboardingStatus !== OnboardingStatus.FIRST_PRODUCT) {
      throw new ConflictException(`Cannot submit first_product; current status is ${current.onboardingStatus}`);
    }
    const em = this.em.fork();
    const slug = slugify(dto.name);
    const product = await em.transactional(async (tx) => {
      const existing = await tx.findOne(Product, { organization: org.id, name: dto.name });
      if (existing) throw new ConflictException(`Product "${dto.name}" already exists`);
      const p = tx.create(
        Product,
        {
          organization: tx.getReference(Organization, org.id),
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

    await this.orgSvc.setStatus(org.id, OnboardingStatus.COMPLETED);
    this.logger.log(`Onboarding complete — organization ${org.id}, product ${product.id}`);
    return product;
  }

  /** Restart the wizard for this organization. Products and members are kept. */
  async reset(ctx: TenantContext): Promise<void> {
    const { org } = requireOrg(ctx);
    for (const cred of await this.channelsSvc.list(org.id)) {
      await this.channelsSvc.remove(org.id, cred.channel);
    }
    await this.orgSvc.setStatus(org.id, OnboardingStatus.PENDING);
    this.logger.warn(`Onboarding reset for organization ${org.id}`);
  }

  private currentStep(status: OnboardingStatus): OnboardingStatus {
    if (status === OnboardingStatus.COMPLETED) return OnboardingStatus.COMPLETED;
    if (status === OnboardingStatus.PENDING) return OnboardingStatus.WORKSPACE_DETAILS;
    if (status === OnboardingStatus.OPERATOR_PROFILE) return OnboardingStatus.CHANNELS;
    return status;
  }

  private completedSteps(status: OnboardingStatus): OnboardingStatus[] {
    if (status === OnboardingStatus.COMPLETED) return STEP_ORDER;
    const index = STEP_ORDER.indexOf(this.currentStep(status));
    if (index <= 0) return [];
    return STEP_ORDER.slice(0, index);
  }
}
