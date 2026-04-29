import { Module } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { OperatorRepository } from '@hothotleads/db';

import { DbModule } from '../../db/db.module';
import { OperatorService } from './operator.service';

@Module({
  imports: [DbModule],
  providers: [
    {
      provide: OperatorRepository,
      useFactory: (em: EntityManager) => new OperatorRepository(em),
      inject: [EntityManager],
    },
    OperatorService,
  ],
  exports: [OperatorService],
})
export class OperatorModule {}
