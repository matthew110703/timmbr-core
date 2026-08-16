import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsCompareAtPriceValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCompareAtPriceValid',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: 'compareAtPrice must be greater than or equal to price',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null) {
            return true;
          }
          if (typeof value !== 'number') {
            return false;
          }
          const obj = args.object as Record<string, unknown>;
          const price = obj.price;
          if (typeof price === 'number') {
            return value >= price;
          }
          return true;
        },
        defaultMessage() {
          return 'compareAtPrice must be greater than or equal to price';
        },
      },
    });
  };
}
