import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { DepartmentGuard } from './department.guard';

@Module({
  imports: [AuthModule],
  controllers: [TicketsController],
  providers: [TicketsService, DepartmentGuard]
})
export class TicketsModule {}
