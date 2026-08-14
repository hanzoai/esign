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
 * A call that leaves the process — mail, SES, an HTTP request — does not
 * deadlock, but it holds that one connection open across the network. Every
 * other write in the process waits on a mail server, and a slow send reaches
 * the same timeout by a longer road.
 *
 * So the callback waits on `tx` and on nothing else. Jobs, webhooks,
 * notifications and mail are side effects of committed state: they read what
 * the transaction wrote, so they belong after the commit — return what they
 * need from the callback and fire them on the way out. This deliberately
 * changes what a failed send means. A bounced notification no longer rolls
 * back the record it announces; the record stands and the send is reported
 * where it happened.
 *
 * Three questions, one each:
 *
 *   1. Is the transaction client called `tx`? One name, so 2 and 3 can read
 *      the callback by that name and be exact.
 *   2. Does the callback name a client that is not `tx`? That is the deadlock.
 *   3. Does the callback wait on a call it did not hand `tx`? That is
 *      everything else — jobs, webhooks, mail, any I/O — under one question
 *      rather than a list of the callees anyone has hit so far.
 *
 * Read by two callers: `./index.cjs`, so an editor says it while you type, and
 * the `lint:tx` script, which runs this file alone over every package and app.
 * It takes seconds, so it sweeps the whole tree rather than a list of the
 * directories that open a transaction today — a new one is covered by being
 * written, not by being remembered here.
 */

const TRANSACTION = 'CallExpression[callee.property.name="$transaction"]';
const CALLBACK = `${TRANSACTION} > :function`;

const because =
  'Base SQLite serves one write connection: the transaction holds it, so a second client ' +
  'waits on a lock that is only released once the waiting call returns (P2028), and a call ' +
  'that leaves the process holds it open across the network. ' +
  'Return what you need from the callback and run the side effect after the commit.';

/** @type {{ selector: string, message: string }[]} */
const restricted = [
  {
    selector: `${TRANSACTION} > :function:not([params.0.name="tx"])`,
    message:
      'name the transaction client tx — every transaction in the tree does, and the rest of ' +
      'this rule reads the callback by that name.',
  },
  {
    selector: `${CALLBACK} Identifier[name=/^(prisma|kyselyPrisma)$/]`,
    message: `no global prisma inside $transaction — use tx, or move the side effect after commit. ${because}`,
  },
  {
    // Handing `tx` on is how a call says it joins the transaction; a call that
    // mentions it anywhere — `tx.envelope.create(…)`, `Promise.all([tx…])`,
    // `helper({ tx })` — has said so. Waiting on one that does not is waiting
    // on the world outside, and the transaction is holding the door.
    selector: `${CALLBACK} AwaitExpression > CallExpression:not(:has(Identifier[name="tx"]))`,
    message: `no awaiting a call you did not hand tx inside $transaction — a job, a webhook, an email or any other I/O belongs after the commit. ${because}`,
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
