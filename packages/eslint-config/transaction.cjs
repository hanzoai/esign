/**
 * Inside a transaction, only `tx`.
 *
 * Base SQLite serves one write connection. `prisma.$transaction(async (tx) =>
 * …)` holds that connection for as long as the callback runs. A call in the
 * callback that reaches the global client asks for the same connection, so it
 * queues behind a lock the transaction cannot release until the call it is
 * waiting on returns. It waits out the busy timeout and the transaction dies:
 * `P2028 Transaction already closed`.
 *
 * Jobs, webhooks, notifications and mail are side effects of committed state.
 * They read what the transaction wrote, so they belong after the commit —
 * return what they need from the callback and fire them on the way out.
 *
 * Read by two callers: `./index.cjs`, so an editor says it while you type, and
 * the `lint:tx` script, which runs this file alone across every package that
 * opens a transaction.
 */

const CALLBACK = 'CallExpression[callee.property.name="$transaction"] > :function';

const because =
  'Base SQLite serves one write connection: the transaction holds it, so a second client ' +
  'waits on a lock that is only released once the waiting call returns (P2028). ' +
  'Return what you need from the callback and run the side effect after the commit.';

/** @type {{ selector: string, message: string }[]} */
const restricted = [
  {
    selector: `${CALLBACK} Identifier[name=/^(prisma|kyselyPrisma)$/]`,
    message: `no global prisma inside $transaction — use tx, or move the side effect after commit. ${because}`,
  },
  {
    selector: `${CALLBACK} CallExpression[callee.property.name="triggerJob"]`,
    message: `no triggerJob inside $transaction — it writes through the global prisma client. ${because}`,
  },
  {
    selector: `${CALLBACK} CallExpression[callee.name="triggerWebhook"], ${CALLBACK} CallExpression[callee.property.name="triggerWebhook"]`,
    message: `no triggerWebhook inside $transaction — it reads through the global prisma client. ${because}`,
  },
];

module.exports = {
  parser: '@typescript-eslint/parser',

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },

  ignorePatterns: ['build', 'dist', '.react-router'],

  rules: {
    'no-restricted-syntax': ['error', ...restricted],
  },
};
