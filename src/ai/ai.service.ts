import { Inject, Injectable } from '@nestjs/common';
import { QueuesService } from '../queues/queues.service';
import {
  AI_PROVIDER,
  AiOutputInvalidError,
  AiProvider,
  AiProviderUnavailableError,
  InvalidSuggestionError,
  QueueContext,
  SuggestionFailureResponse,
  SuggestionSuccessResponse,
  TicketPriority,
  TicketSuggestion,
  VALID_TICKET_PRIORITIES,
} from './ai-provider.interface';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly queuesService: QueuesService,
  ) {}

  async suggestTicket(rawText: string): Promise<SuggestionSuccessResponse | SuggestionFailureResponse> {
    const issueText = typeof rawText === 'string' ? rawText.trim() : '';
    if (!issueText) {
      return { success: false, reason: 'invalid_suggestion' };
    }

    const validQueues = await this.queuesService.getAllQueues();
    const context: QueueContext[] = validQueues.map((queue) => ({
      id: queue.id,
      name: queue.name,
      department: queue.department,
    }));

    try {
      const suggestion = await this.provider.suggestTicket(issueText, context);
      const normalized = this.normalizeSuggestion(suggestion, context);

      return { success: true, suggestion: normalized };
    } catch (error) {
      if (error instanceof AiOutputInvalidError) {
        return { success: false, reason: 'invalid_ai_output' };
      }

      if (error instanceof AiProviderUnavailableError) {
        return { success: false, reason: 'provider_unavailable' };
      }

      if (error instanceof InvalidSuggestionError) {
        return { success: false, reason: 'invalid_suggestion' };
      }

      return { success: false, reason: 'invalid_suggestion' };
    }
  }

  private normalizeSuggestion(suggestion: Partial<TicketSuggestion>, context: QueueContext[]): TicketSuggestion {
    const title = String(suggestion.title ?? '').trim();
    const description = String(suggestion.description ?? '').trim();
    const queueId = String(suggestion.queueId ?? '').trim();
    const priorityValue = this.normalizePriority(suggestion.priority);
    const validQueueIds = context.map((queue) => queue.id);

    if (!title || !description) {
      throw new InvalidSuggestionError('AI suggestion is missing title or description.');
    }

    if (!validQueueIds.includes(queueId)) {
      throw new InvalidSuggestionError(`AI suggestion queueId is not in the valid queue list: ${queueId}`);
    }

    if (!VALID_TICKET_PRIORITIES.includes(priorityValue)) {
      throw new InvalidSuggestionError(`AI suggestion priority is invalid: ${priorityValue}`);
    }

    return {
      title,
      description,
      queueId,
      priority: priorityValue,
    };
  }

  private normalizePriority(value: unknown): TicketPriority {
    const raw = String(value ?? '').trim();
    const lookup = raw.toLowerCase();
    const map: Record<string, TicketPriority> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
    };

    if (lookup in map) {
      return map[lookup];
    }

    const match = VALID_TICKET_PRIORITIES.find((priority) => priority.toLowerCase() === lookup);
    if (match) {
      return match;
    }

    return raw as TicketPriority;
  }
}
