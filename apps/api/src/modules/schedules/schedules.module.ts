import { Module } from '@nestjs/common';

import { DbModule } from '../../db/db.module';
import { AppSchedulerModule } from '../../scheduler/scheduler.module';
import { SchedulesController } from './schedules.controller';

@Module({
  imports: [DbModule, AppSchedulerModule],
  controllers: [SchedulesController],
})
export class SchedulesApiModule {}
