import { AiProvider, TicketSuggestion, TicketPriority, VALID_TICKET_PRIORITIES } from './ai-provider.interface';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqAiProvider implements AiProvider {
  constructor(private readonly apiKey = process.env.GROQ_API_KEY ?? '') {}

  async suggestTicket(input: string): Promise<TicketSuggestion> {
    if (!this.apiKey) {
      throw new Error('Groq API key is missing. Set GROQ_API_KEY to enable AI suggestions.');
    }

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a ticket intake assistant for an internal operations platform. Return a JSON object with exactly four fields: title, description, queueId, priority. Use one valid queueId from the real queue catalog and one valid priority from [Low, Medium, High, Urgent]. Return only JSON with no prose.',
          },
          {
            role: 'user',
            content: input,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq request failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new Error('Groq returned no usable content.');
    }

    const parsed = this.parseJson(content);
    const priority = this.normalizePriority(parsed.priority);

    return {
      title: String(parsed.title ?? '').trim(),
      description: String(parsed.description ?? '').trim(),
      queueId: String(parsed.queueId ?? '').trim(),
      priority,
    };
  }

  private parseJson(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('AI output was not valid JSON.');
      }

      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        throw new Error('AI output could not be parsed into a valid suggestion.');
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

    throw new Error(`AI returned an invalid priority: ${normalized}`);
  }
}
