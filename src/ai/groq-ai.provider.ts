import { AiOutputInvalidError, AiProvider, AiProviderUnavailableError, QueueContext, TicketPriority, TicketSuggestion, VALID_TICKET_PRIORITIES } from './ai-provider.interface';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqAiProvider implements AiProvider {
  constructor(private readonly apiKey = process.env.GROQ_API_KEY ?? '') {}

  async suggestTicket(input: string, context: QueueContext[] = []): Promise<TicketSuggestion> {
    if (!this.apiKey) {
      throw new AiProviderUnavailableError('Groq API key is missing. Set GROQ_API_KEY to enable AI suggestions.');
    }

    const queueCatalog = context.length
      ? context.map((queue) => `- id: ${queue.id}, name: ${queue.name}, department: ${queue.department}`).join('\n')
      : '- id: queue-1, name: Technical Support, department: IT\n- id: queue-2, name: Billing & Invoicing, department: Finance\n- id: queue-3, name: HR Requests, department: HR';

    const validPriorities = VALID_TICKET_PRIORITIES.join(', ');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: [
                'You are a ticket intake assistant for an internal operations platform.',
                `Valid queue catalog:\n${queueCatalog}`,
                `Valid priorities: ${validPriorities}`,
                'Return ONLY a JSON object with exactly these fields: title, description, queueId, priority.',
                'The queueId value must be selected ONLY from the valid queue catalog above and must match one of the ids exactly.',
                'The priority value must be one of: Low, Medium, High, Urgent.',
                'Do not include markdown fences, explanations, or extra keys.',
              ].join('\n'),
            },
            {
              role: 'user',
              content: input,
            },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AiProviderUnavailableError(`Groq request failed (${response.status}): ${body}`);
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;

      if (typeof content !== 'string') {
        throw new AiOutputInvalidError('Groq returned no usable JSON content.');
      }

      const parsed = this.parseJson(content);
      const title = String(parsed.title ?? '').trim();
      const description = String(parsed.description ?? '').trim();
      const queueId = String(parsed.queueId ?? '').trim();
      const priority = this.normalizePriority(parsed.priority);

      if (!title || !description || !queueId) {
        throw new AiOutputInvalidError('AI output is missing required fields: title, description, or queueId.');
      }

      return {
        title,
        description,
        queueId,
        priority,
      };
    } catch (error) {
      if (error instanceof AiOutputInvalidError || error instanceof AiProviderUnavailableError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderUnavailableError('Groq request timed out after 10 seconds.');
      }

      if (error instanceof TypeError) {
        const cause = (error as TypeError & { cause?: unknown }).cause;
        const causeMessage = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause ?? 'unknown cause');
        throw new AiProviderUnavailableError(`Groq request failed: ${error.message} (${causeMessage})`);
      }

      throw new AiOutputInvalidError('AI output was not valid JSON.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseJson(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new AiOutputInvalidError('AI output was not valid JSON.');
      }

      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        throw new AiOutputInvalidError('AI output could not be parsed into a valid suggestion.');
      }
    }
  }

  private normalizePriority(value: unknown): TicketPriority {
    const normalized = String(value ?? '').trim();
    const lookup = normalized.toLowerCase();
    const map: Record<string, TicketPriority> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
    };

    if (lookup in map) {
      return map[lookup];
    }

    const candidate = VALID_TICKET_PRIORITIES.find((priority) => priority.toLowerCase() === lookup);
    if (candidate) {
      return candidate;
    }

    throw new AiOutputInvalidError(`AI returned an invalid priority: ${normalized}`);
  }
}
