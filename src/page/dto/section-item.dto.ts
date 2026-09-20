import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface SectionItemPayload {
  type: string;
  [key: string]: unknown;
}

@ValidatorConstraint({ name: 'isSectionArray', async: false })
export class IsSectionArrayConstraint implements ValidatorConstraintInterface {
  validate(sections: unknown): boolean {
    if (!Array.isArray(sections)) return false;

    const seenTypes = new Set<string>();

    for (const section of sections) {
      if (typeof section !== 'object' || section === null || Array.isArray(section)) {
        return false;
      }
      const item = section as Record<string, unknown>;
      if (
        typeof item['type'] !== 'string' ||
        item['type'].trim().length === 0 ||
        !/^[a-z0-9_-]+$/i.test(item['type'].trim())
      ) {
        return false;
      }

      const normalizedType = item['type'].trim().toLowerCase();
      if (seenTypes.has(normalizedType)) {
        return false;
      }
      seenTypes.add(normalizedType);
    }

    return true;
  }

  defaultMessage(): string {
    return 'Every section must be an object with a unique, valid non-empty "type" identifier string (alphanumeric, dashes, or underscores).';
  }
}

export function IsSectionArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSectionArrayConstraint,
    });
  };
}
