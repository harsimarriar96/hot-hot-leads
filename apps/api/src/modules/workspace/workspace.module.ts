import { Module } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkspaceRepository } from '@hothotleads/db';

import { DbModule } from '../../db/db.module';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [DbModule],
  providers: [
    {
      provide: WorkspaceRepository,
      useFactory: (em: EntityManager) => new WorkspaceRepository(em),
      inject: [EntityManager],
    },
    WorkspaceService,
  ],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
