import { Test } from '@nestjs/testing';
import {
  AI_PROVIDER,
  AiOutputInvalidError,
  AiProvider,
  AiProviderUnavailableError,
  TicketSuggestion,
  VALID_TICKET_PRIORITIES,
} from '../src/ai/ai-provider.interface';
import { AiService } from '../src/ai/ai.service';
import { QueuesService } from '../src/queues/queues.service';

const queueCatalog = [
  { id: 'queue-1', name: 'Technical Support', department: 'IT' },
  { id: 'queue-2', name: 'Billing & Invoicing', department: 'Finance' },
  { id: 'queue-3', name: 'HR Requests', department: 'HR' },
];

describe('AI provider contract', () => {
  it('exposes the canonical priority enum', () => {
    expect(VALID_TICKET_PRIORITIES).toEqual(['Low', 'Medium', 'High', 'Urgent']);
  });

  it('defines a suggestion contract that includes queueId and priority', () => {
    const suggestion: TicketSuggestion = {
      title: 'VPN access issue',
      description: 'I cannot connect to the VPN after resetting my password.',
      queueId: 'queue-1',
      priority: 'High',
    };

    expect(suggestion.priority).toBe('High');
    expect(suggestion.queueId).toBe('queue-1');
  });

  it('requires providers to return a structured suggestion', async () => {
    const provider: AiProvider = {
      async suggestTicket(_input: string) {
        return {
          title: 'Password reset help',
          description: 'The employee needs help resetting a password for the VPN.',
          queueId: 'queue-1',
          priority: 'Medium',
        };
      },
    };

    await expect(provider.suggestTicket('Need VPN access')).resolves.toMatchObject({
      queueId: 'queue-1',
      priority: 'Medium',
    });
  });

  it('returns invalid_suggestion when the AI picks a queue outside the real list', async () => {
    const provider: AiProvider = {
      async suggestTicket() {
        return {
          title: 'Bad title',
          description: 'Bad description',
          queueId: 'queue-999',
          priority: 'High',
        };
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_PROVIDER, useValue: provider },
        { provide: QueuesService, useValue: { getAllQueues: jest.fn().mockResolvedValue(queueCatalog) } },
      ],
    }).compile();

    const service = module.get(AiService);
    await expect(service.suggestTicket('VPN not working')).resolves.toMatchObject({
      success: false,
      reason: 'invalid_suggestion',
    });
  });

  it('returns invalid_ai_output when the provider throws AiOutputInvalidError', async () => {
    const provider: AiProvider = {
      async suggestTicket() {
        throw new AiOutputInvalidError('Fake output is malformed');
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_PROVIDER, useValue: provider },
        { provide: QueuesService, useValue: { getAllQueues: jest.fn().mockResolvedValue(queueCatalog) } },
      ],
    }).compile();

    const service = module.get(AiService);
    await expect(service.suggestTicket('Need HR help')).resolves.toMatchObject({
      success: false,
      reason: 'invalid_ai_output',
    });
  });

  it('returns provider_unavailable when the provider throws AiProviderUnavailableError', async () => {
    const provider: AiProvider = {
      async suggestTicket() {
        throw new AiProviderUnavailableError('Provider is down');
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_PROVIDER, useValue: provider },
        { provide: QueuesService, useValue: { getAllQueues: jest.fn().mockResolvedValue(queueCatalog) } },
      ],
    }).compile();

    const service = module.get(AiService);
    await expect(service.suggestTicket('Need HR help')).resolves.toMatchObject({
      success: false,
      reason: 'provider_unavailable',
    });
  });
});
