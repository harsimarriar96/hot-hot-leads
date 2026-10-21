import { Module } from '@nestjs/common';

import { DbModule } from '../../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { ProductsController } from './products.controller';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
