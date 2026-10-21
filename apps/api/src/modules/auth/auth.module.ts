import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { DbModule } from '../../db/db.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { BootstrapService } from './bootstrap.service';
import { EntitlementsService } from './entitlements.service';
import { InvitationService } from './invitation.service';
import { PasswordResetService } from './password-reset.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TenantContextService } from './tenant-context.service';

const SERVICES = [
  AuthService,
  TenantContextService,
  PasswordService,
  SessionService,
  InvitationService,
  PasswordResetService,
  EntitlementsService,
];

@Module({
  imports: [ConfigModule, DbModule, UsersModule],
  controllers: [AuthController],
  providers: [...SERVICES, BootstrapService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: SERVICES,
})
export class AuthModule {}
