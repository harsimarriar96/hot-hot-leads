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

import {
  ChannelsStepDto,
  FirstProductDto,
  OperatorProfileDto,
  WorkspaceDetailsDto,
} from './onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  async getStatus() {
    return this.onboarding.getStatus();
  }

  @Post('workspace-details')
  @HttpCode(200)
  async workspaceDetails(@Body() dto: WorkspaceDetailsDto) {
    await this.rejectIfCompleted();
    const ws = await this.onboarding.submitWorkspaceDetails(dto);
    return { status: ws.onboardingStatus };
  }

  @Post('operator-profile')
  @HttpCode(200)
  async operatorProfile(@Body() dto: OperatorProfileDto) {
    await this.rejectIfCompleted();
    await this.onboarding.submitOperatorProfile(dto);
    return (await this.onboarding.getStatus());
  }

  @Post('channels')
  @HttpCode(200)
  async channels(@Body() dto: ChannelsStepDto) {
    await this.rejectIfCompleted();
    await this.onboarding.submitChannels(dto);
    return (await this.onboarding.getStatus());
  }

  @Post('first-product')
  @HttpCode(200)
  async firstProduct(@Body() dto: FirstProductDto) {
    await this.rejectIfCompleted();
    const product = await this.onboarding.submitFirstProduct(dto);
    return { status: OnboardingStatus.COMPLETED, product: { id: product.id, name: product.name } };
  }

  /** Wipes workspace + operator + channel rows. Protected by the global bearer guard. */
  @Post('reset')
  @HttpCode(204)
  async reset() {
    await this.onboarding.reset();
  }

  private async rejectIfCompleted(): Promise<void> {
    const { status } = await this.onboarding.getStatus();
    if (status === OnboardingStatus.COMPLETED) {
      throw new ConflictException('Onboarding already completed; edit via /settings instead');
    }
  }
}
