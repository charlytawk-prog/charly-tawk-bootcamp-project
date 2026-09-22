import { AiProvider, TicketSuggestion } from './ai-provider.interface';

export class FakeAiProvider implements AiProvider {
  constructor(
    private readonly suggestionFactory:
      | TicketSuggestion
      | ((input: string) => TicketSuggestion | Promise<TicketSuggestion>)
      | undefined = undefined,
  ) {}

  async suggestTicket(input: string): Promise<TicketSuggestion> {
    const suggestion =
      typeof this.suggestionFactory === 'function'
        ? await this.suggestionFactory(input)
        : this.suggestionFactory ?? {
          title: 'Fallback ticket',
          description: 'Issue captured from the request text.',
          queueId: 'queue-1',
          priority: 'Medium',
        };

    if (!suggestion || typeof suggestion !== 'object') {
      throw new Error('Fake AI provider returned an unusable suggestion.');
    }

    return {
      title: String(suggestion.title ?? '').trim(),
      description: String(suggestion.description ?? '').trim(),
      queueId: String(suggestion.queueId ?? '').trim(),
      priority: String(suggestion.priority ?? '') as TicketSuggestion['priority'],
    };
  }
}
