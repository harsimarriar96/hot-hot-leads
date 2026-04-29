import { Module } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ChannelCredentialsRepository } from '@hothotleads/db';

import { DbModule } from '../../db/db.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { ChannelCredentialsService } from './channel-credentials.service';

@Module({
  imports: [DbModule, CryptoModule],
  providers: [
    {
      provide: ChannelCredentialsRepository,
      useFactory: (em: EntityManager) => new ChannelCredentialsRepository(em),
      inject: [EntityManager],
    },
    ChannelCredentialsService,
  ],
  exports: [ChannelCredentialsService],
})
export class ChannelCredentialsModule {}
