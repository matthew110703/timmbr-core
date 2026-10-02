import { AttributeType } from '@prisma/client';
import { AttributeValueValidator } from './attribute-value.validator';
import { InvalidAttributeValueTypeException } from '@/common/exceptions/attribute.exception';

describe('AttributeValueValidator', () => {
  describe('STRING', () => {
    it('validates and serializes a clean string', () => {
      const result = AttributeValueValidator.validateAndSerialize(
        AttributeType.STRING,
        '  Velvet  ',
      );
      expect(result).toBe('Velvet');
    });

    it('throws when string is empty or spaces only', () => {
      expect(() =>
        AttributeValueValidator.validateAndSerialize(AttributeType.STRING, '   '),
      ).toThrow(InvalidAttributeValueTypeException);
    });

    it('throws when input is not a string', () => {
      expect(() => AttributeValueValidator.validateAndSerialize(AttributeType.STRING, 123)).toThrow(
        InvalidAttributeValueTypeException,
      );
    });

    it('deserializes string correctly', () => {
      expect(AttributeValueValidator.deserialize(AttributeType.STRING, 'Velvet')).toBe('Velvet');
    });
  });

  describe('INTEGER', () => {
    it('validates number integer', () => {
      const result = AttributeValueValidator.validateAndSerialize(AttributeType.INTEGER, 5);
      expect(result).toBe('5');
    });

    it('validates string integer', () => {
      const result = AttributeValueValidator.validateAndSerialize(AttributeType.INTEGER, ' 10 ');
      expect(result).toBe('10');
    });

    it('throws on decimal number when INTEGER expected', () => {
      expect(() =>
        AttributeValueValidator.validateAndSerialize(AttributeType.INTEGER, 5.5),
      ).toThrow(InvalidAttributeValueTypeException);
    });

    it('throws on non-numeric string', () => {
      expect(() =>
        AttributeValueValidator.validateAndSerialize(AttributeType.INTEGER, 'abc'),
      ).toThrow(InvalidAttributeValueTypeException);
    });

    it('deserializes integer correctly', () => {
      expect(AttributeValueValidator.deserialize(AttributeType.INTEGER, '5')).toBe(5);
    });
  });

  describe('DECIMAL', () => {
    it('validates float number', () => {
      const result = AttributeValueValidator.validateAndSerialize(AttributeType.DECIMAL, 12.75);
      expect(result).toBe('12.75');
    });

    it('validates string decimal', () => {
      const result = AttributeValueValidator.validateAndSerialize(
        AttributeType.DECIMAL,
        ' 3.1415 ',
      );
      expect(result).toBe('3.1415');
    });

    it('throws on NaN or invalid decimal string', () => {
      expect(() =>
        AttributeValueValidator.validateAndSerialize(AttributeType.DECIMAL, 'not-a-number'),
      ).toThrow(InvalidAttributeValueTypeException);
    });

    it('deserializes decimal correctly', () => {
      expect(AttributeValueValidator.deserialize(AttributeType.DECIMAL, '12.75')).toBe(12.75);
    });
  });

  describe('LIST', () => {
    it('validates array of strings and serializes to JSON', () => {
      const result = AttributeValueValidator.validateAndSerialize(AttributeType.LIST, [
        'Teak',
        'Velvet',
      ]);
      expect(result).toBe(JSON.stringify(['Teak', 'Velvet']));
    });

    it('validates valid JSON array string', () => {
      const result = AttributeValueValidator.validateAndSerialize(
        AttributeType.LIST,
        '["Red", "Blue"]',
      );
      expect(result).toBe(JSON.stringify(['Red', 'Blue']));
    });

    it('throws when array is empty', () => {
      expect(() => AttributeValueValidator.validateAndSerialize(AttributeType.LIST, [])).toThrow(
        InvalidAttributeValueTypeException,
      );
    });

    it('throws when array item is not a string', () => {
      expect(() =>
        AttributeValueValidator.validateAndSerialize(AttributeType.LIST, ['Valid', 123 as any]),
      ).toThrow(InvalidAttributeValueTypeException);
    });

    it('deserializes JSON list correctly', () => {
      expect(
        AttributeValueValidator.deserialize(AttributeType.LIST, JSON.stringify(['Red', 'Blue'])),
      ).toEqual(['Red', 'Blue']);
    });
  });
});
