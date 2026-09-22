import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { QueuesModule } from './queues/queues.module';
import { PrismaModule } from './prisma/prisma.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, AuthModule, TicketsModule, UsersModule, QueuesModule, AiModule],
  controllers: [AppController],
})
export class AppModule {}