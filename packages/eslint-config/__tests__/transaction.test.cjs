const assert = require('node:assert/strict');
const { test } = require('node:test');

const { Linter } = require('eslint');
const parser = require('@typescript-eslint/parser');

const config = require('../transaction.cjs');

const linter = new Linter();
linter.defineParser('ts', parser);

/** @param {string} code */
const check = (code) =>
  linter
    .verify(code, {
      parser: 'ts',
      parserOptions: config.parserOptions,
      rules: config.rules,
    })
    .map((m) => m.message);

test('a transaction that only touches tx is clean', () => {
  assert.deepEqual(
    check(`
      const envelope = await prisma.$transaction(async (tx) => {
        const created = await tx.envelope.create({ data });
        await tx.recipient.updateMany({ where: { envelopeId: created.id }, data });
        return created;
      }, { timeout: 30_000 });

      await jobs.triggerJob({ name: 'send.signing.requested.email', payload });
      await triggerWebhook({ event: 'DOCUMENT_CREATED', data: envelope });
    `),
    [],
  );
});

test('the batch form is not an interactive transaction', () => {
  assert.deepEqual(
    check('await prisma.$transaction([prisma.a.findMany(), prisma.b.findMany()]);'),
    [],
  );
});

test('a global prisma read inside a transaction is an error', () => {
  const [message, ...rest] = check(`
    await prisma.$transaction(async (tx) => {
      return await prisma.recipient.findFirst({ where });
    });
  `);

  assert.equal(rest.length, 0);
  assert.match(message, /^no global prisma inside \$transaction/);
});

test('a nested transaction is an error', () => {
  const [message] = check(`
    await prisma.$transaction(async (tx) => {
      await prisma.$transaction(async (inner) => inner.member.create({ data }));
    });
  `);

  assert.match(message, /^no global prisma inside \$transaction/);
});

test('a job trigger inside a transaction is an error, whatever the client is called', () => {
  for (const client of ['jobs', 'jobsClient']) {
    const [message] = check(`
      await prisma.$transaction(async (tx) => {
        await tx.team.delete({ where });
        await ${client}.triggerJob({ name: 'send.team-deleted.email', payload });
      });
    `);

    assert.match(message, /^no triggerJob inside \$transaction/);
  }
});

test('a webhook inside a transaction is an error', () => {
  const [message] = check(`
    await prisma.$transaction(async (tx) => {
      const created = await tx.envelope.create({ data });
      await triggerWebhook({ event: 'DOCUMENT_CREATED', data: created });
    });
  `);

  assert.match(message, /^no triggerWebhook inside \$transaction/);
});
