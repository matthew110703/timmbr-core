import { AttributeType } from '@prisma/client';
import { InvalidAttributeValueTypeException } from '@/common/exceptions/attribute.exception';
import { TypedAttributeValue } from '../types/attribute.types';

export class AttributeValueValidator {
  /**
   * Validates raw input against the definition AttributeType and serializes it to a database-storable string.
   */
  static validateAndSerialize(type: AttributeType, input: unknown): string {
    if (input === null || input === undefined) {
      throw new InvalidAttributeValueTypeException(
        type,
        `Attribute value cannot be null or undefined for type ${type}.`,
      );
    }

    switch (type) {
      case AttributeType.STRING: {
        if (typeof input !== 'string') {
          throw new InvalidAttributeValueTypeException(type, 'Value must be a string.');
        }
        const trimmed = input.trim();
        if (trimmed.length === 0) {
          throw new InvalidAttributeValueTypeException(type, 'String value cannot be empty.');
        }
        if (trimmed.length > 500) {
          throw new InvalidAttributeValueTypeException(
            type,
            'String value exceeds maximum allowed length of 500 characters.',
          );
        }
        return trimmed;
      }

      case AttributeType.INTEGER: {
        const num = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
        if (typeof num !== 'number' || !Number.isInteger(num) || !Number.isFinite(num)) {
          throw new InvalidAttributeValueTypeException(type, 'Value must be a valid integer.');
        }
        return String(num);
      }

      case AttributeType.DECIMAL: {
        const num = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
        if (typeof num !== 'number' || isNaN(num) || !Number.isFinite(num)) {
          throw new InvalidAttributeValueTypeException(
            type,
            'Value must be a valid decimal number.',
          );
        }
        return String(num);
      }

      case AttributeType.LIST: {
        let list: unknown[] = [];
        if (Array.isArray(input)) {
          list = input;
        } else if (typeof input === 'string') {
          try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) {
              list = parsed;
            } else {
              throw new Error();
            }
          } catch {
            throw new InvalidAttributeValueTypeException(
              type,
              'Value for LIST must be an array of strings or a valid JSON array.',
            );
          }
        } else {
          throw new InvalidAttributeValueTypeException(
            type,
            'Value for LIST must be an array of strings.',
          );
        }

        if (list.length === 0) {
          throw new InvalidAttributeValueTypeException(
            type,
            'LIST value must contain at least one item.',
          );
        }

        const stringList = list.map((item, idx) => {
          if (typeof item !== 'string' || item.trim().length === 0) {
            throw new InvalidAttributeValueTypeException(
              type,
              `Item at index ${idx} in LIST must be a non-empty string.`,
            );
          }
          return item.trim();
        });

        return JSON.stringify(stringList);
      }

      default:
        throw new InvalidAttributeValueTypeException(
          type,
          `Unsupported attribute type: ${String(type)}`,
        );
    }
  }

  /**
   * Deserializes the database-stored string back into its strongly typed presentation format.
   */
  static deserialize(type: AttributeType, storedValue: string): TypedAttributeValue {
    switch (type) {
      case AttributeType.STRING:
        return storedValue;

      case AttributeType.INTEGER: {
        const parsed = parseInt(storedValue, 10);
        return isNaN(parsed) ? storedValue : parsed;
      }

      case AttributeType.DECIMAL: {
        const parsed = parseFloat(storedValue);
        return isNaN(parsed) ? storedValue : parsed;
      }

      case AttributeType.LIST: {
        try {
          const parsed = JSON.parse(storedValue);
          return Array.isArray(parsed) ? (parsed as string[]) : [storedValue];
        } catch {
          return [storedValue];
        }
      }

      default:
        return storedValue;
    }
  }
}
