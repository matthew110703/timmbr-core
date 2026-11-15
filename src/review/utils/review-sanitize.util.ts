import { BadRequestException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { REVIEW_CONSTANTS } from '../review.constants';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li'];

/**
 * Sanitizes rich-text comment HTML. An editor with no text (e.g. `<p></p>`) is
 * stored as null, and the length limit applies to the visible text, matching
 * the storefront editor's character counter rather than the markup.
 */
export function sanitizeReviewComment(html: string | null | undefined): string | null {
  if (html === null || html === undefined) {
    return null;
  }
  const trimmed = html.trim();
  if (trimmed === '') {
    return null;
  }
  const clean = sanitizeHtml(trimmed, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (text === '') {
    return null;
  }
  if (text.length > REVIEW_CONSTANTS.COMMENT_MAX_LENGTH) {
    throw new BadRequestException(
      `Comment must be at most ${REVIEW_CONSTANTS.COMMENT_MAX_LENGTH} characters.`,
    );
  }
  return clean;
}
