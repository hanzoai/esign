// esign ZAP RPC — files on a JSON wire.
//
// A call's input rides as a SuperJSON string. SuperJSON carries typed values,
// not bytes: a File is a stream and a FormData is a multipart body, so both
// serialise to `{}` and an upload reaches the handler empty. Upload routes
// declare `zfd.file()` in their schema, so the transport reads the bytes into a
// tagged form on the way out and rebuilds the File on the way in — the handler
// receives the value the caller passed, and no route needs its own encoding.

const FILE = '$file';
const FORM = '$form';

type WireFile = {
  [FILE]: { name: string; type: string; lastModified: number; data: string };
};

type WireForm = {
  [FORM]: [string, unknown][];
};

/** Plain objects only — a Date, Map or Set is SuperJSON's to carry, not ours. */
const isPlain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const isWireFile = (value: unknown): value is WireFile => isPlain(value) && FILE in value;

const isWireForm = (value: unknown): value is WireForm => isPlain(value) && FORM in value;

const encode = (bytes: Uint8Array): string => {
  let binary = '';

  // btoa takes a binary string. Build it in chunks — one spread of a 50MB file
  // would exceed the argument limit of String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
};

const decode = (data: string) => {
  const binary = atob(data);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

/** Read every File in a call input into the form the wire can carry. */
export async function pack(value: unknown): Promise<unknown> {
  if (value instanceof File) {
    const wire: WireFile = {
      [FILE]: {
        name: value.name,
        type: value.type,
        lastModified: value.lastModified,
        data: encode(new Uint8Array(await value.arrayBuffer())),
      },
    };

    return wire;
  }

  if (value instanceof FormData) {
    const entries: [string, unknown][] = [];

    for (const [key, entry] of value.entries()) {
      entries.push([key, await pack(entry)]);
    }

    const wire: WireForm = { [FORM]: entries };

    return wire;
  }

  if (Array.isArray(value)) {
    return await Promise.all(value.map(pack));
  }

  if (isPlain(value)) {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(
          async ([key, entry]): Promise<[string, unknown]> => [key, await pack(entry)],
        ),
      ),
    );
  }

  return value;
}

/** Rebuild every File the wire form carries. */
export function unpack(value: unknown): unknown {
  if (isWireFile(value)) {
    const { name, type, lastModified, data } = value[FILE];

    return new File([decode(data)], name, { type, lastModified });
  }

  if (isWireForm(value)) {
    const form = new FormData();

    // A FormData entry is a file or a string, nothing else.
    for (const [key, entry] of value[FORM]) {
      const carried = unpack(entry);

      form.append(key, carried instanceof File ? carried : String(carried));
    }

    return form;
  }

  if (Array.isArray(value)) {
    return value.map(unpack);
  }

  if (isPlain(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, unpack(entry)]));
  }

  return value;
}
