import { Module } from '@nestjs/common';
import { QueuesModule } from './queues/queues.module';
import { PrismaModule } from './prisma/prisma.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, TicketsModule, UsersModule, QueuesModule],
  controllers: [AppController],
})
export class AppModule {}