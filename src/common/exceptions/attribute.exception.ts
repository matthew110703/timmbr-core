import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class AttributeDefinitionNotFoundException extends NotFoundException {
  constructor(message = 'Attribute definition not found.') {
    super({
      message,
      code: 'ATTRIBUTE_DEFINITION_NOT_FOUND',
    });
  }
}

export class AttributeDefinitionAlreadyExistsException extends ConflictException {
  constructor(message = 'An attribute definition with this name already exists.') {
    super({
      message,
      code: 'ATTRIBUTE_DEFINITION_ALREADY_EXISTS',
    });
  }
}

export class AttributeDefinitionInUseException extends ConflictException {
  constructor(count: number) {
    super({
      message: `Cannot delete attribute definition because it is currently assigned to ${count} product(s) or variant(s).`,
      code: 'ATTRIBUTE_DEFINITION_IN_USE',
    });
  }
}

export class AttributeDefinitionImmutableException extends ConflictException {
  constructor(field = 'type/scope') {
    super({
      message: `Cannot modify ${field} of an attribute definition that already has assigned values.`,
      code: 'ATTRIBUTE_DEFINITION_IMMUTABLE',
    });
  }
}

export class AttributeValueNotFoundException extends NotFoundException {
  constructor(message = 'Attribute value assignment not found.') {
    super({
      message,
      code: 'ATTRIBUTE_VALUE_NOT_FOUND',
    });
  }
}

export class AttributeValueAlreadyAssignedException extends ConflictException {
  constructor(target: 'Product' | 'Variant') {
    super({
      message: `${target} already has an assigned value for this attribute definition.`,
      code: 'ATTRIBUTE_VALUE_ALREADY_ASSIGNED',
    });
  }
}

export class AttributeScopeMismatchException extends UnprocessableEntityException {
  constructor(expectedScope: string, target: 'product' | 'variant') {
    super({
      message: `Attribute definition has scope ${expectedScope} and cannot be assigned to a ${target}.`,
      code: 'ATTRIBUTE_SCOPE_MISMATCH',
    });
  }
}

export class AttributeOwnershipMismatchException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'Product-specific attribute definition does not belong to the requested product.',
      code: 'ATTRIBUTE_OWNERSHIP_MISMATCH',
    });
  }
}

export class InvalidAttributeValueTypeException extends BadRequestException {
  constructor(expectedType: string, reason?: string) {
    super({
      message: reason ?? `Value is not valid for attribute type ${expectedType}.`,
      code: 'INVALID_ATTRIBUTE_VALUE_TYPE',
    });
  }
}

export class VariantDoesNotBelongToProductException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'The specified variant does not belong to this product.',
      code: 'VARIANT_DOES_NOT_BELONG_TO_PRODUCT',
    });
  }
}
