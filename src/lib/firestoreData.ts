type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<PlainObject>((clean, [key, item]) => {
    if (item === undefined) return clean;
    clean[key] = stripUndefined(item);
    return clean;
  }, {}) as T;
}

export function toFirestoreData<T extends PlainObject>(data: T): T {
  return stripUndefined(data);
}
