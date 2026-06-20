/**
 * JSON-encoded list columns for SQLite.
 *
 * SQLite (and therefore Prisma's `sqlite` provider) has no array type, so the
 * four list fields that were Postgres arrays are stored as a single JSON `TEXT`
 * column:
 *
 *   - User.roles                                  (Role[])
 *   - Webhook.eventTriggers                        (WebhookTriggerEvents[])
 *   - Passkey.transports                           (string[])
 *   - OrganisationAuthenticationPortal.allowedDomains (string[])
 *
 * This module is the ONE place those columns are encoded/decoded. The Prisma
 * client extension in `./index.ts` applies {@link encodeList} on write and
 * {@link decodeList} on read for exactly these fields, so call sites keep
 * seeing real arrays — the JSON encoding never leaks past the data layer.
 */

/** Encode a list to its stored JSON string. `undefined` is passed through. */
export const encodeList = <T extends string>(value: readonly T[] | undefined): string | undefined =>
  value === undefined ? undefined : JSON.stringify(value);

/** Decode a stored JSON string back to a list. Tolerates null/empty/legacy values. */
export const decodeList = <T extends string>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    // Already decoded (e.g. value set within the same client call).
    return value as T[];
  }

  if (typeof value !== 'string' || value.length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Legacy Postgres array dumps could arrive as `{A,B}` — recover them too.
    const trimmed = value.replace(/^\{|\}$/g, '').trim();

    return trimmed.length === 0 ? [] : (trimmed.split(',').map((s) => s.trim()) as T[]);
  }
};

/**
 * The list-typed fields, keyed by model, that the client extension bridges.
 * Kept here so the encode/decode policy lives next to its codec.
 */
export const LIST_FIELDS = {
  User: ['roles'],
  Webhook: ['eventTriggers'],
  Passkey: ['transports'],
  OrganisationAuthenticationPortal: ['allowedDomains'],
} as const satisfies Record<string, readonly string[]>;

export type ListModel = keyof typeof LIST_FIELDS;

/** Encode this model's list fields (any array values) to JSON on one data object. */
const encodeOne = (model: ListModel, data: Record<string, unknown> | undefined): void => {
  if (!data) {
    return;
  }

  for (const field of LIST_FIELDS[model]) {
    const value = data[field];

    if (Array.isArray(value)) {
      data[field] = encodeList(value as string[]);
    }
  }
};

/**
 * Encode this model's list fields across the write `args` of a Prisma
 * operation — `data` (object or array for `createMany`), and the `create` /
 * `update` branches of `upsert`. This is the single write-side codec the
 * client extension's `$allOperations` hook calls; reads are decoded by the
 * `result` extension. `args` is the loosely-typed extension payload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const encodeListFields = (model: ListModel, args: any): void => {
  const data = args?.data;

  if (Array.isArray(data)) {
    for (const row of data) {
      encodeOne(model, row);
    }
  } else {
    encodeOne(model, data);
  }

  // `upsert` carries create/update instead of (or alongside) data.
  encodeOne(model, args?.create);
  encodeOne(model, args?.update);
};
