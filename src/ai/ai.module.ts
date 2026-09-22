import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueuesModule } from '../queues/queues.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AI_PROVIDER } from './ai-provider.interface';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GroqAiProvider } from './groq-ai.provider';

const defaultProviderFactory = () => new GroqAiProvider(process.env.GROQ_API_KEY ?? '');

@Module({
  imports: [AuthModule, PrismaModule, QueuesModule],
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: AI_PROVIDER,
      useFactory: defaultProviderFactory,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
