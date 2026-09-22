export const VALID_TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;

export type TicketPriority = typeof VALID_TICKET_PRIORITIES[number];

export interface QueueContext {
  id: string;
  name: string;
  department: string;
}

export interface TicketSuggestion {
  title: string;
  description: string;
  queueId: string;
  priority: TicketPriority;
}

export type SuggestionFailureReason = 'invalid_ai_output' | 'provider_unavailable' | 'invalid_suggestion';

export interface SuggestionSuccessResponse {
  success: true;
  suggestion: TicketSuggestion;
}

export interface SuggestionFailureResponse {
  success: false;
  reason: SuggestionFailureReason;
}

export interface AiProvider {
  suggestTicket(input: string, context?: QueueContext[]): Promise<TicketSuggestion>;
}

export class AiOutputInvalidError extends Error {
  constructor(message = 'AI output was invalid or incomplete.') {
    super(message);
    this.name = 'AiOutputInvalidError';
  }
}

export class InvalidSuggestionError extends Error {
  constructor(message = 'AI suggestion failed validation.') {
    super(message);
    this.name = 'InvalidSuggestionError';
  }
}

export class AiProviderUnavailableError extends Error {
  constructor(message = 'AI provider is unavailable.') {
    super(message);
    this.name = 'AiProviderUnavailableError';
  }
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
