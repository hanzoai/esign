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
export const encodeList = <T extends string>(
  value: readonly T[] | undefined,
): string | undefined => (value === undefined ? undefined : JSON.stringify(value));

/**
 * Decode a stored JSON-`TEXT` list column back to a typed string array.
 *
 * This is an authorisation-relevant boundary: `User.roles` is decoded here, so
 * a corrupt or unexpected stored value must FAIL CLOSED (throw) rather than
 * silently degrade to `[]` (which would strip a user's roles) or fabricate a
 * role from garbage input. The only non-throwing inputs are:
 *
 *   - `null` / `undefined`            → `[]`   (column never written)
 *   - an already-decoded `string[]`   → itself (value set within this client
 *                                              call, before the write codec ran)
 *   - a JSON-stringified `string[]`   → parsed array
 *
 * Anything else — a non-string scalar, non-JSON text, a JSON object/number, or
 * a JSON array containing a non-string — is a data-integrity fault and throws.
 * There is no legacy `{A,B}` Postgres-array recovery path: the backfill
 * (`scripts/backfill-pg-to-sqlite.ts`) JSON-encodes every list column on write,
 * so a `{A,B}` value at read time is corruption, not a format to tolerate.
 */
export const decodeList = <T extends string>(value: unknown): T[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    // Already decoded (e.g. value set within the same client call). Still
    // validate element types — a non-string element is a fault either way.
    if (!value.every((x) => typeof x === 'string')) {
      throw new Error(
        `decodeList: expected string[], array contains ${typeof value.find((x) => typeof x !== 'string')}`,
      );
    }

    return value as T[];
  }

  if (typeof value !== 'string') {
    throw new Error(`decodeList: expected JSON string or null, got ${typeof value}`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`decodeList: failed to parse JSON (${(error as Error).message})`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `decodeList: expected a JSON array, got ${parsed === null ? 'null' : typeof parsed}`,
    );
  }

  if (!parsed.every((x) => typeof x === 'string')) {
    throw new Error(
      `decodeList: expected string[], array contains ${typeof parsed.find((x) => typeof x !== 'string')}`,
    );
  }

  return parsed as T[];
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
 * Reject any `where` that filters on a list column. These columns are JSON
 * `TEXT` in SQLite, so Prisma's array operators (`has`, `hasEvery`, `hasSome`,
 * `equals`) cannot be translated — Prisma would emit a scalar comparison
 * against the JSON string and silently return WRONG results. Failing loudly
 * here turns a latent correctness/auth hole (e.g. a future `roles: { has:
 * 'ADMIN' }`) into an explicit error directing the caller to a `json_each(...)`
 * raw query, the one correct way to match inside a JSON list on SQLite.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assertNoListFieldInWhere = (model: ListModel, where: any): void => {
  if (!where || typeof where !== 'object') {
    return;
  }

  for (const field of LIST_FIELDS[model]) {
    if (field in where) {
      throw new Error(
        `${model}.${field} is a JSON-TEXT list column and cannot be used in a Prisma ` +
          `\`where\` (array operators do not translate to SQLite). Use a raw query with ` +
          `\`json_each("${field}")\` to match inside the list.`,
      );
    }
  }
};

/**
 * Encode this model's list fields across the write `args` of a Prisma
 * operation — `data` (object or array for `createMany`), and the `create` /
 * `update` branches of `upsert`. This is the single write-side codec the
 * client extension's `$allOperations` hook calls; reads are decoded by the
 * `result` extension. It also guards `where` (incl. the `upsert` selector) so a
 * list column can never be filtered through the un-translatable array
 * operators. `args` is the loosely-typed extension payload.
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

  // A list column in any `where` (find/update/delete/upsert selector) would
  // silently mis-match — reject it.
  assertNoListFieldInWhere(model, args?.where);
};
