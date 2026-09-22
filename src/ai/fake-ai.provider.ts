import { AiOutputInvalidError, AiProvider, AiProviderUnavailableError, QueueContext, TicketSuggestion } from './ai-provider.interface';

export type FakeAiMode = 'normal' | 'invalid-output' | 'provider-failure';

export class FakeAiProvider implements AiProvider {
  constructor(private readonly mode: FakeAiMode = 'normal') {}

  async suggestTicket(rawText: string, context: QueueContext[] = []): Promise<TicketSuggestion> {
    if (this.mode === 'provider-failure') {
      throw new AiProviderUnavailableError('Fake provider intentionally failed.');
    }

    if (this.mode === 'invalid-output') {
      throw new AiOutputInvalidError('Fake provider returned invalid AI output.');
    }

    const normalizedText = rawText.toLowerCase();
    const queueCatalog = context.length
      ? context
      : [
          { id: 'queue-1', name: 'Technical Support', department: 'IT' },
          { id: 'queue-2', name: 'Billing & Invoicing', department: 'Finance' },
          { id: 'queue-3', name: 'HR Requests', department: 'HR' },
        ];

    const match = (() => {
      if (/(vpn|wifi|internet|laptop|computer|email|password|login|slack|zoom)/i.test(normalizedText)) return 'queue-1';
      if (/(invoice|payroll|expense|reimbursement|salary|budget|finance|billing)/i.test(normalizedText)) return 'queue-2';
      if (/(leave|benefits|paycheck|employment|hr|document|verification|vacation)/i.test(normalizedText)) return 'queue-3';
      return queueCatalog[0].id;
    })();

    const queue = queueCatalog.find((item) => item.id === match) ?? queueCatalog[0];
    const priority = /(urgent|down|blocked|critical|outage|locked)/i.test(normalizedText) ? 'Urgent' : /(payment|payroll|invoice|paycheck)/i.test(normalizedText) ? 'High' : 'Medium';

    return {
      title: this.buildTitle(normalizedText, queue),
      description: `Issue description from the employee input: ${rawText}`,
      queueId: queue.id,
      priority,
    };
  }

  private buildTitle(rawText: string, queue: QueueContext): string {
    const cleaned = rawText.replace(/\s+/g, ' ').trim();
    const prefix = queue.department === 'IT' ? 'IT' : queue.department === 'Finance' ? 'Finance' : 'HR';
    return cleaned.length > 52 ? `${prefix}: ${cleaned.slice(0, 52).trim()}...` : `${prefix}: ${cleaned || 'Service request'}`;
  }
}
