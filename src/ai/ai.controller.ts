import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';

@Controller('api/tickets')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('suggest')
  async suggestTicket(@Body() body: SuggestTicketBody) {
    const rawText = typeof body?.rawText === 'string' ? body.rawText : '';
    return this.aiService.suggestTicket(rawText);
  }
}

interface SuggestTicketBody {
  rawText?: string;
}
