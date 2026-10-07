import {
  legacyPhoneVariants,
  maskIdentifier,
  normalizeEmail,
  normalizeIdentifier,
  normalizePhone,
} from './identifier.util';

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['(+91) 98765.43210', '+919876543210'],
    ['+14155552671', '+14155552671'],
  ])('normalises %s to %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(['12345', 'abc', '+0123456789', '123456789012345678'])('rejects %s', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Dany@Example.COM ')).toBe('dany@example.com');
  });

  it('rejects colons so identifiers can never shape another key', () => {
    expect(normalizeEmail('rate:victim@x.com')).toBeNull();
  });
});

describe('normalizeIdentifier', () => {
  it('classifies email vs phone', () => {
    expect(normalizeIdentifier('a@b.co')).toEqual({ type: 'email', value: 'a@b.co' });
    expect(normalizeIdentifier('9876543210')).toEqual({ type: 'phone', value: '+919876543210' });
    expect(normalizeIdentifier('nope')).toBeNull();
  });
});

describe('legacyPhoneVariants', () => {
  it('covers formats stored before E.164 normalisation', () => {
    expect(legacyPhoneVariants('+919876543210')).toEqual([
      '+919876543210',
      '919876543210',
      '9876543210',
    ]);
  });
});

describe('maskIdentifier', () => {
  it('masks emails and phones', () => {
    expect(maskIdentifier({ type: 'email', value: 'daenerys@gmail.com' })).toBe(
      'd******s@gmail.com',
    );
    expect(maskIdentifier({ type: 'email', value: 'ab@x.io' })).toBe('a*@x.io');
    expect(maskIdentifier({ type: 'phone', value: '+919876543210' })).toBe('+91*******210');
  });
});
