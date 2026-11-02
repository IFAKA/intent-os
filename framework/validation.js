export function validationError(message, fields = {}) {
  return Object.assign(new Error(message), { code: 'VALIDATION_ERROR', fields });
}

export function createSchema(fields, { allowUnknown = false } = {}) {
  return (input = {}) => {
    const source = input && typeof input === 'object' ? input : {};
    const unknown = Object.keys(source).filter((key) => !fields[key]);
    if (!allowUnknown && unknown.length) throw validationError(`Unexpected field: ${unknown[0]}.`, { [unknown[0]]: 'Unexpected field.' });
    const output = {};
    const errors = {};
    for (const [name, validate] of Object.entries(fields)) {
      try { output[name] = validate(source[name], source); } catch (error) { errors[name] = error.message; }
    }
    if (Object.keys(errors).length) throw validationError(`Please correct the highlighted fields. ${Object.values(errors)[0]}`, errors);
    return output;
  };
}

export const productId = (value) => {
  const normalized = String(value ?? '').trim();
  if (!/^[\w-]{1,64}$/.test(normalized)) throw new Error('Choose a valid product.');
  return normalized;
};

export const quantity = (value) => {
  const parsed = Number(value ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) throw new Error('Quantity must be a whole number from 1 to 99.');
  return parsed;
};

export const cartInput = createSchema({ productId, quantity });
