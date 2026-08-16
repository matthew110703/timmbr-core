import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { isValidCurrencyCode } from '../utils/currency.util';

export function IsValidCurrencyCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCurrencyCode',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} must be a valid ISO 4217 currency code (e.g. INR, USD, EUR)`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }
          return isValidCurrencyCode(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid ISO 4217 currency code (e.g. INR, USD, EUR)`;
        },
      },
    });
  };
}
