import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SignalStatus, SignalsRepository, type Signal } from '@hothotleads/db';

import { Auth } from '../auth/auth.decorator';
import { RequireFeature, RequirePermission } from '../auth/access.decorators';
import { requireOrg, type TenantContext } from '../auth/tenant-context';

const REVIEW_ACTIONS = ['approve', 'reject', 'snooze'] as const;
type ReviewAction = (typeof REVIEW_ACTIONS)[number];

const ACTION_STATUS: Record<ReviewAction, SignalStatus> = {
  approve: SignalStatus.APPROVED,
  reject: SignalStatus.REJECTED,
  snooze: SignalStatus.SNOOZED,
};

const DEFAULT_SNOOZE_DAYS = 7;

class ReviewSignalDto {
  @IsIn(REVIEW_ACTIONS)
  action!: ReviewAction;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  snoozeDays?: number;
}

@Controller('signals')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class SignalsController {
  constructor(private readonly signalsRepo: SignalsRepository) {}

  /** Human review decision. Only `approve` lets a signal feed buying intent. */
  @Post(':id/review')
  @RequirePermission('signals:write')
  @RequireFeature('signals')
  async review(@Auth() auth: TenantContext, @Param('id') id: string, @Body() dto: ReviewSignalDto) {
    const { org, user } = requireOrg(auth);
    const status = ACTION_STATUS[dto.action];
    const snoozedUntil =
      dto.action === 'snooze'
        ? new Date(Date.now() + (dto.snoozeDays ?? DEFAULT_SNOOZE_DAYS) * 24 * 60 * 60 * 1000)
        : undefined;
    const signal = await this.signalsRepo.reviewSignal(org.id, id, { status, userId: user.id, snoozedUntil });
    if (!signal) throw new NotFoundException('Signal not found');
    return serializeSignal(signal);
  }
}

function serializeSignal(s: Signal) {
  return {
    id: s.id,
    productId: s.product.id,
    type: s.type,
    source: s.source ?? null,
    description: s.description,
    company: s.company ?? null,
    sourceUrl: s.sourceUrl ?? null,
    relevanceScore: s.relevanceScore ?? null,
    detectedAt: s.detectedAt.toISOString(),
    expiresAt: s.expiresAt?.toISOString() ?? null,
    status: s.status,
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
    snoozedUntil: s.snoozedUntil?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}
