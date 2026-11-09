export interface ReviewModerationInput {
  title?: string | null;
  comment?: string | null;
}

const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;

export function reviewRequiresModeration(input: ReviewModerationInput): boolean {
  const chunks = [input.title, input.comment].filter(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  );
  for (const text of chunks) {
    if (URL_PATTERN.test(text)) return true;
    if (EMAIL_PATTERN.test(text)) return true;
    if (PHONE_PATTERN.test(text)) return true;
  }
  return false;
}
