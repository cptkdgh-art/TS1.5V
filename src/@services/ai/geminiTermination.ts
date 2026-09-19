import type { GenerateContentResponse, SafetyRating } from '@google/genai';

export interface GeminiSafetyRatingDiagnostic {
  category?: string;
  probability?: string;
  blocked?: boolean;
}

export interface GeminiTerminationDiagnostic {
  finishReason?: string;
  finishMessage?: string;
  promptBlockReason?: string;
  safetyRatings: GeminiSafetyRatingDiagnostic[];
}

const BLOCKING_FINISH_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
  'ESCALATION',
]);

const toRating = (rating: SafetyRating): GeminiSafetyRatingDiagnostic => ({
  category: rating.category,
  probability: rating.probability,
  blocked: rating.blocked,
});

export function readGeminiTermination(response: GenerateContentResponse): GeminiTerminationDiagnostic {
  const candidate = response.candidates?.[0];
  const ratings = candidate?.safetyRatings || response.promptFeedback?.safetyRatings || [];
  return {
    finishReason: candidate?.finishReason,
    finishMessage: candidate?.finishMessage,
    promptBlockReason: response.promptFeedback?.blockReason,
    safetyRatings: ratings.map(toRating),
  };
}

export function mergeGeminiTermination(
  previous: GeminiTerminationDiagnostic | undefined,
  next: GeminiTerminationDiagnostic,
): GeminiTerminationDiagnostic {
  return {
    finishReason: next.finishReason || previous?.finishReason,
    finishMessage: next.finishMessage || previous?.finishMessage,
    promptBlockReason: next.promptBlockReason || previous?.promptBlockReason,
    safetyRatings: next.safetyRatings.length ? next.safetyRatings : previous?.safetyRatings || [],
  };
}

export function isGeminiBlocked(diagnostic: GeminiTerminationDiagnostic): boolean {
  return Boolean(
    diagnostic.promptBlockReason
    || (diagnostic.finishReason && BLOCKING_FINISH_REASONS.has(diagnostic.finishReason)),
  );
}

function ratingSummary(ratings: GeminiSafetyRatingDiagnostic[]): string {
  const meaningful = ratings.filter((rating) => rating.blocked || ['MEDIUM', 'HIGH'].includes(rating.probability || ''));
  return meaningful.length
    ? meaningful.map((rating) => `${rating.category || 'UNKNOWN'}:${rating.probability || 'UNKNOWN'}${rating.blocked ? ':BLOCKED' : ''}`).join(', ')
    : '';
}

export function describeGeminiTermination(diagnostic: GeminiTerminationDiagnostic, model: string): string {
  const reason = diagnostic.promptBlockReason || diagnostic.finishReason || 'UNKNOWN';
  const stage = diagnostic.promptBlockReason ? '입력 프롬프트' : '생성 응답';
  const ratings = ratingSummary(diagnostic.safetyRatings);
  const details = [diagnostic.finishMessage, ratings].filter(Boolean).join(' · ');
  return `Gemini ${stage} 차단 (모델: ${model}, 사유: ${reason})${details ? ` — ${details}` : ''}`;
}

export class GeminiTerminationError extends Error {
  readonly diagnostic: GeminiTerminationDiagnostic;

  constructor(model: string, diagnostic: GeminiTerminationDiagnostic) {
    super(describeGeminiTermination(diagnostic, model));
    this.name = 'GeminiTerminationError';
    this.diagnostic = diagnostic;
  }
}

export function getGeminiTerminationFromError(error: unknown): GeminiTerminationDiagnostic | undefined {
  return error instanceof GeminiTerminationError ? error.diagnostic : undefined;
}
