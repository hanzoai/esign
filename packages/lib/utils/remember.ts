declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
  var __hanzo_sign_remember: Map<string, any>;
}

export function remember<T>(name: string, getValue: () => T): T {
  const thusly = globalThis;

  if (!thusly.__hanzo_sign_remember) {
    thusly.__hanzo_sign_remember = new Map();
  }

  if (!thusly.__hanzo_sign_remember.has(name)) {
    thusly.__hanzo_sign_remember.set(name, getValue());
  }

  return thusly.__hanzo_sign_remember.get(name);
}
