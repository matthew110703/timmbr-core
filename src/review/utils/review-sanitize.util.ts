import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li'];

export function sanitizeReviewComment(html: string | null | undefined): string | null {
  if (html === null || html === undefined) {
    return null;
  }
  const trimmed = html.trim();
  if (trimmed === '') {
    return null;
  }
  return sanitizeHtml(trimmed, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}
