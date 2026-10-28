import { Module } from '@nestjs/common';

import { DbModule } from '../../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { SignalsController } from './signals.controller';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [SignalsController],
})
export class SignalsModule {}
