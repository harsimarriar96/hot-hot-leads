import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OnboardingStatus } from '@hothotleads/db';

import { Auth } from '../auth/auth.decorator';
import { RequirePermission } from '../auth/access.decorators';
import type { TenantContext } from '../auth/tenant-context';
import { ChannelsStepDto, FirstProductDto, WorkspaceDetailsDto } from './onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  async getStatus(@Auth() ctx: TenantContext) {
    return this.onboarding.getStatus(ctx);
  }

  /** First submit creates the organization, so it needs no org permission; later ones need org:update. */
  @Post('workspace-details')
  @HttpCode(200)
  async workspaceDetails(@Auth() ctx: TenantContext, @Body() dto: WorkspaceDetailsDto) {
    await this.rejectIfCompleted(ctx);
    const org = await this.onboarding.submitWorkspaceDetails(ctx, dto);
    return { status: org.onboardingStatus, organizationId: org.id };
  }

  @Post('channels')
  @RequirePermission('channels:manage')
  @HttpCode(200)
  async channels(@Auth() ctx: TenantContext, @Body() dto: ChannelsStepDto) {
    await this.rejectIfCompleted(ctx);
    await this.onboarding.submitChannels(ctx, dto);
    return this.onboarding.getStatus(ctx);
  }

  @Post('first-product')
  @RequirePermission('products:write')
  @HttpCode(200)
  async firstProduct(@Auth() ctx: TenantContext, @Body() dto: FirstProductDto) {
    await this.rejectIfCompleted(ctx);
    const product = await this.onboarding.submitFirstProduct(ctx, dto);
    return { status: OnboardingStatus.COMPLETED, product: { id: product.id, name: product.name } };
  }

  /** Restarts the wizard for the active organization (keeps products and members). */
  @Post('reset')
  @RequirePermission('org:update')
  @HttpCode(204)
  async reset(@Auth() ctx: TenantContext) {
    await this.onboarding.reset(ctx);
  }

  private async rejectIfCompleted(ctx: TenantContext): Promise<void> {
    const { status } = await this.onboarding.getStatus(ctx);
    if (status === OnboardingStatus.COMPLETED) {
      throw new ConflictException('Onboarding already completed; edit via /settings instead');
    }
  }
}
