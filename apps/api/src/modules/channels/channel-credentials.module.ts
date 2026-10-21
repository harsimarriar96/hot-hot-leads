import { Module } from '@nestjs/common';

import { DbModule } from '../../db/db.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { ChannelCredentialsService } from './channel-credentials.service';

@Module({
  imports: [DbModule, CryptoModule],
  providers: [ChannelCredentialsService],
  exports: [ChannelCredentialsService],
})
export class ChannelCredentialsModule {}
