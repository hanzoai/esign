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
      await mailer.sendMail({ to, from, subject, html, text });
    `),
    [],
  );
});

test('the shapes that carry tx are clean', () => {
  assert.deepEqual(
    check(`
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw\`pragma foreign_keys = on\`;
        await tx.documentAuditLog.createMany({ data: auditLogsToCreate });
        await Promise.all([tx.field.create({ data }), tx.recipient.create({ data })]);
        await Promise.all(items.map(async (item) => tx.field.create({ data: item })));
        await validateFieldAuth({ tx, field });
        await tx.envelope.create({ data }).then((created) => created.id);

        const id = generateDatabaseId('team_group');
        const value = match(field.type).with(FieldType.DATE, () => date).otherwise(() => null);
      });
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
  const messages = check(`
    await prisma.$transaction(async (tx) => {
      return await prisma.recipient.findFirst({ where });
    });
  `);

  assert.ok(messages.some((m) => m.startsWith('no global prisma inside $transaction')));
});

test('a nested transaction is an error', () => {
  const messages = check(`
    await prisma.$transaction(async (tx) => {
      await prisma.$transaction(async (inner) => inner.member.create({ data }));
    });
  `);

  assert.ok(messages.some((m) => m.startsWith('no global prisma inside $transaction')));
});

test('a job trigger inside a transaction is an error, whatever the client is called', () => {
  for (const client of ['jobs', 'jobsClient']) {
    const [message, ...rest] = check(`
      await prisma.$transaction(async (tx) => {
        await tx.team.delete({ where });
        await ${client}.triggerJob({ name: 'send.team-deleted.email', payload });
      });
    `);

    assert.equal(rest.length, 0);
    assert.match(message, /^no awaiting a call you did not hand tx inside \$transaction/);
  }
});

test('a webhook inside a transaction is an error', () => {
  const [message, ...rest] = check(`
    await prisma.$transaction(async (tx) => {
      const created = await tx.envelope.create({ data });
      await triggerWebhook({ event: 'DOCUMENT_CREATED', data: created });
    });
  `);

  assert.equal(rest.length, 0);
  assert.match(message, /^no awaiting a call you did not hand tx inside \$transaction/);
});

test('an email inside a transaction is an error', () => {
  const [message, ...rest] = check(`
    await prisma.$transaction(async (tx) => {
      await mailer.sendMail({ to, from, subject, html, text });
      await tx.documentAuditLog.create({ data });
    });
  `);

  assert.equal(rest.length, 0);
  assert.match(message, /^no awaiting a call you did not hand tx inside \$transaction/);
});

test('any other call out of the process inside a transaction is an error', () => {
  const [message, ...rest] = check(`
    await prisma.$transaction(async (tx) => {
      await verifyDomainWithDKIM(domain, selector, privateKey).catch((err) => { throw err; });
      return await tx.emailDomain.create({ data });
    });
  `);

  assert.equal(rest.length, 0);
  assert.match(message, /^no awaiting a call you did not hand tx inside \$transaction/);
});

test('a transaction client by any other name is an error', () => {
  const messages = check(`
    await prisma.$transaction(async (trx) => {
      await trx.envelope.create({ data });
    });
  `);

  assert.ok(messages.some((m) => m.startsWith('name the transaction client tx')));
});
