import { reviewRequiresModeration } from './review-moderation.util';

describe('reviewRequiresModeration', () => {
  it('flags external links', () => {
    expect(reviewRequiresModeration({ comment: 'see https://spam.example' })).toBe(true);
  });

  it('does not flag low star ratings alone', () => {
    expect(reviewRequiresModeration({ title: 'Terrible product' })).toBe(false);
  });

  it('flags email addresses', () => {
    expect(reviewRequiresModeration({ comment: 'email me at user@test.com' })).toBe(true);
  });
});
