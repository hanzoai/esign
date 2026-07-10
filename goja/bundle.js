// @hanzo/sign — goja bundle (gojabase contract).
//
// SELF-CONTAINED, NO ESM, NO node: imports. The ESM-free port of the Hanzo Sign
// (Documenso fork) server-side e-signature domain, authored so it runs verbatim
// inside the dop251/goja engine embedded in hanzoai/cloud (HIP-0106, task #100)
// via the REUSABLE clients/gojabase read-write-Base host (the same binding the
// captable pilot #96 established; dataroom #101 reuses it too). It carries the
// LOGIC — documents, recipients, fields, the signing flow/state machine, the
// audit trail and completion — while the host injects the two capabilities goja
// cannot provide:
//
//   Host contract (gojabase injects these per dispatch):
//     globalThis.__db.query(sql, args) -> rows[]                 // per-tenant Base/SQLite
//     globalThis.__db.exec(sql, args)  -> { changes, lastId }    // (one txn per dispatch;
//     globalThis.__newId()             -> crypto-random id        //  commits iff status<400)
//     globalThis.__now()               -> unix milliseconds
//   Host capability (esign injects via gojabase Config.HostFns):
//     globalThis.__pdf.stamp(pdfB64, stampsJSON) -> pdfB64        // pdfcpu render
//     globalThis.__pdf.sign(pdfB64)              -> signedPdfB64  // x509/PKCS#7 seal
//   Entry:
//     globalThis.handle({ route, params, query, orgId, body }) -> { status, body }
//
// TENANCY: gojabase binds __db to the caller's tenant DB (from the validated
// principal for owner routes, or the :org path segment for token routes) BEFORE
// calling handle, and passes it as orgId. This bundle never chooses a tenant — it
// only issues SQL — so tenant isolation is a host property. The physical schema
// is created by clients/sign (schema.go); this bundle owns the queries + flow.
(function () {
  'use strict';

  // --- enums (mirror packages/prisma/schema.prisma) -------------------------
  var STATUS = { DRAFT: 'DRAFT', PENDING: 'PENDING', COMPLETED: 'COMPLETED', REJECTED: 'REJECTED' };
  var SIGNING = { NOT_SIGNED: 'NOT_SIGNED', SIGNED: 'SIGNED', REJECTED: 'REJECTED' };
  var SEND = { NOT_SENT: 'NOT_SENT', SENT: 'SENT' };
  var READ = { NOT_OPENED: 'NOT_OPENED', OPENED: 'OPENED' };
  var ROLE = { CC: 'CC', SIGNER: 'SIGNER', VIEWER: 'VIEWER', APPROVER: 'APPROVER', ASSISTANT: 'ASSISTANT' };
  var AUDIT = {
    DOCUMENT_CREATED: 'DOCUMENT_CREATED',
    RECIPIENT_CREATED: 'RECIPIENT_CREATED',
    FIELD_CREATED: 'FIELD_CREATED',
    DOCUMENT_SENT: 'DOCUMENT_SENT',
    DOCUMENT_OPENED: 'DOCUMENT_OPENED',
    DOCUMENT_FIELD_INSERTED: 'DOCUMENT_FIELD_INSERTED',
    DOCUMENT_RECIPIENT_COMPLETED: 'DOCUMENT_RECIPIENT_COMPLETED',
    DOCUMENT_RECIPIENT_REJECTED: 'DOCUMENT_RECIPIENT_REJECTED',
    DOCUMENT_COMPLETED: 'DOCUMENT_COMPLETED',
  };
  var SIGNATURE_TYPES = { SIGNATURE: true, FREE_SIGNATURE: true };
  var FIELD_TYPES = {
    SIGNATURE: true, FREE_SIGNATURE: true, INITIALS: true, NAME: true, EMAIL: true,
    DATE: true, TEXT: true, NUMBER: true, RADIO: true, CHECKBOX: true, DROPDOWN: true,
  };
  // Roles that must reach SIGNED before a document can seal.
  var SIGNING_ROLES = { SIGNER: true, APPROVER: true };

  // --- errors: HttpError carries a status the dispatcher maps to the wire ----
  // (a >=400 status also makes gojabase ROLL BACK the request transaction.)
  function HttpError(status, message) { this.status = status; this.message = message; }
  function bad(m) { throw new HttpError(400, m); }
  function notFound(m) { throw new HttpError(404, m); }
  function conflict(m) { throw new HttpError(409, m); }
  function unauthorized(m) { throw new HttpError(401, m); }

  // --- small helpers --------------------------------------------------------
  function now() { return __now(); }
  function id() { return __newId(); }
  function query(sql, args) { return __db.query(sql, args || []); }
  function exec(sql, args) { return __db.exec(sql, args || []); }
  function firstRow(rows) { return rows && rows.length ? rows[0] : null; }
  function jparse(s) { if (s == null || s === '') return null; try { return JSON.parse(s); } catch (e) { return null; } }
  function jstr(v) { return v == null ? null : JSON.stringify(v); }
  function str(v) { return v == null ? '' : String(v); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function reqBody(req) { return (req && req.body) || {}; }

  // strip a data: URL prefix from a base64 image, returning raw base64.
  function rawBase64(v) {
    if (!v) return '';
    var s = String(v);
    var i = s.indexOf('base64,');
    return i >= 0 ? s.slice(i + 7) : s;
  }

  // --- audit trail ----------------------------------------------------------
  function audit(documentId, type, data, actor) {
    actor = actor || {};
    exec(
      'INSERT INTO audit_logs (id, document_id, type, data, name, email, ip_address, user_agent, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [id(), documentId, type, jstr(data || {}), actor.name || null, actor.email || null,
       actor.ip || null, actor.userAgent || null, now()]
    );
  }

  // --- data access ----------------------------------------------------------
  function getDocument(docId) { return firstRow(query('SELECT * FROM documents WHERE id = ?', [docId])); }
  function getDocumentData(ddId) { return firstRow(query('SELECT * FROM document_data WHERE id = ?', [ddId])); }
  function listRecipients(documentId) {
    return query('SELECT * FROM recipients WHERE document_id = ? ORDER BY signing_order ASC, created_at ASC', [documentId]);
  }
  function listFields(documentId) {
    return query('SELECT * FROM fields WHERE document_id = ? ORDER BY page ASC, created_at ASC', [documentId]);
  }
  function recipientByToken(token) { return firstRow(query('SELECT * FROM recipients WHERE token = ?', [token])); }
  function fieldsForRecipient(documentId, recipientId) {
    return query('SELECT * FROM fields WHERE document_id = ? AND recipient_id = ? ORDER BY page ASC, created_at ASC', [documentId, recipientId]);
  }
  function signatureForField(fieldId) { return firstRow(query('SELECT * FROM signatures WHERE field_id = ?', [fieldId])); }

  function documentView(doc) {
    var recipients = listRecipients(doc.id).map(function (r) {
      return {
        id: r.id, email: r.email, name: r.name, role: r.role,
        signingOrder: r.signing_order, readStatus: r.read_status,
        signingStatus: r.signing_status, sendStatus: r.send_status,
        signedAt: r.signed_at, rejectionReason: r.rejection_reason,
      };
    });
    var fields = listFields(doc.id).map(function (f) {
      return {
        id: f.id, recipientId: f.recipient_id, type: f.type, page: f.page,
        positionX: f.position_x, positionY: f.position_y, width: f.width, height: f.height,
        customText: f.custom_text, inserted: !!f.inserted, fieldMeta: jparse(f.field_meta),
      };
    });
    return {
      id: doc.id, title: doc.title, status: doc.status, externalId: doc.external_id,
      source: doc.source, signingOrder: doc.signing_order, subject: doc.subject,
      message: doc.message, createdAt: doc.created_at, updatedAt: doc.updated_at,
      completedAt: doc.completed_at, recipients: recipients, fields: fields,
    };
  }

  // ==========================================================================
  // OWNER ROUTES (tenant = validated principal org)
  // ==========================================================================

  // POST /v1/sign/documents  { title, pdfBase64, externalId?, subject?, message?, signingOrder? }
  function documentsCreate(req) {
    var b = reqBody(req);
    if (!b.title) bad('title required');
    if (!b.pdfBase64) bad('pdfBase64 required');
    var pdf = rawBase64(b.pdfBase64);
    var t = now();

    var dataId = id();
    exec('INSERT INTO document_data (id, type, data, initial_data) VALUES (?,?,?,?)',
      [dataId, 'BYTES_64', pdf, pdf]);

    var docId = id();
    exec(
      'INSERT INTO documents (id, title, status, external_id, source, signing_order, subject, message, document_data_id, internal_version, created_at, updated_at, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [docId, str(b.title), STATUS.DRAFT, b.externalId || null, 'DOCUMENT',
       b.signingOrder === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'PARALLEL',
       b.subject || null, b.message || null, dataId, 2, t, t, null]
    );
    audit(docId, AUDIT.DOCUMENT_CREATED, { title: str(b.title), source: { type: 'DOCUMENT' } });
    return { status: 201, body: documentView(getDocument(docId)) };
  }

  // GET /v1/sign/documents
  function documentsList() {
    var rows = query('SELECT * FROM documents ORDER BY created_at DESC LIMIT 200', []);
    return { status: 200, body: { documents: rows.map(documentView) } };
  }

  // GET /v1/sign/documents/:id
  function documentsGet(req) {
    var doc = getDocument(req.params.id);
    if (!doc) notFound('document not found');
    return { status: 200, body: documentView(doc) };
  }

  // POST /v1/sign/documents/:id/recipients  { email, name?, role?, signingOrder? }
  function recipientsAdd(req) {
    var doc = getDocument(req.params.id);
    if (!doc) notFound('document not found');
    if (doc.status !== STATUS.DRAFT) conflict('recipients can only be added while DRAFT');
    var b = reqBody(req);
    if (!b.email) bad('email required');
    var role = ROLE[b.role] || ROLE.SIGNER;
    var recId = id();
    var token = id();
    var isCC = role === ROLE.CC;
    exec(
      'INSERT INTO recipients (id, document_id, email, name, token, role, signing_order, read_status, signing_status, send_status, signed_at, rejection_reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [recId, doc.id, String(b.email).toLowerCase(), str(b.name), token, role,
       b.signingOrder == null ? null : num(b.signingOrder, null), READ.NOT_OPENED,
       isCC ? SIGNING.SIGNED : SIGNING.NOT_SIGNED, isCC ? SEND.SENT : SEND.NOT_SENT, null, null, now()]
    );
    audit(doc.id, AUDIT.RECIPIENT_CREATED,
      { recipientId: recId, recipientEmail: String(b.email).toLowerCase(), recipientName: str(b.name), recipientRole: role });
    return { status: 201, body: { id: recId, token: token, email: String(b.email).toLowerCase(), name: str(b.name), role: role } };
  }

  // POST /v1/sign/documents/:id/fields  { recipientId, type, page, positionX, positionY, width, height, fieldMeta? }
  function fieldsAdd(req) {
    var doc = getDocument(req.params.id);
    if (!doc) notFound('document not found');
    if (doc.status !== STATUS.DRAFT) conflict('fields can only be added while DRAFT');
    var b = reqBody(req);
    if (!b.recipientId) bad('recipientId required');
    if (!FIELD_TYPES[b.type]) bad('invalid field type: ' + b.type);
    var recipient = firstRow(query('SELECT id FROM recipients WHERE id = ? AND document_id = ?', [b.recipientId, doc.id]));
    if (!recipient) bad('recipientId does not belong to this document');
    var fieldId = id();
    exec(
      'INSERT INTO fields (id, document_id, recipient_id, type, page, position_x, position_y, width, height, custom_text, inserted, field_meta, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [fieldId, doc.id, b.recipientId, b.type, num(b.page, 1),
       num(b.positionX, 0), num(b.positionY, 0), num(b.width, -1), num(b.height, -1),
       '', 0, jstr(b.fieldMeta), now()]
    );
    audit(doc.id, AUDIT.FIELD_CREATED, { fieldId: fieldId, fieldType: b.type, fieldRecipientId: b.recipientId });
    return { status: 201, body: { id: fieldId, type: b.type, recipientId: b.recipientId, page: num(b.page, 1) } };
  }

  // POST /v1/sign/documents/:id/send
  function documentsSend(req) {
    var doc = getDocument(req.params.id);
    if (!doc) notFound('document not found');
    if (doc.status === STATUS.COMPLETED) conflict('document already completed');
    var recipients = listRecipients(doc.id);
    if (!recipients.length) bad('document has no recipients');
    for (var i = 0; i < recipients.length; i++) {
      var r = recipients[i];
      if (SIGNING_ROLES[r.role]) {
        var n = firstRow(query('SELECT COUNT(*) AS c FROM fields WHERE document_id = ? AND recipient_id = ?', [doc.id, r.id]));
        if (!n || Number(n.c) === 0) bad('recipient ' + r.email + ' has no fields to sign');
      }
    }
    var t = now();
    if (doc.status === STATUS.DRAFT) {
      exec('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?', [STATUS.PENDING, t, doc.id]);
      audit(doc.id, AUDIT.DOCUMENT_SENT, {});
    }
    exec('UPDATE recipients SET send_status = ? WHERE document_id = ? AND role != ?', [SEND.SENT, doc.id, ROLE.CC]);

    var links = recipients.filter(function (r) { return SIGNING_ROLES[r.role]; }).map(function (r) {
      return { recipientId: r.id, email: r.email, role: r.role, token: r.token, signingPath: 'sign/' + r.token };
    });
    return { status: 200, body: { id: doc.id, status: STATUS.PENDING, recipients: links } };
  }

  // GET /v1/sign/documents/:id/download
  function documentsDownload(req) {
    var doc = getDocument(req.params.id);
    if (!doc) notFound('document not found');
    var dd = getDocumentData(doc.document_data_id);
    if (!dd) notFound('document data missing');
    return { status: 200, body: {
      id: doc.id, status: doc.status, sealed: doc.status === STATUS.COMPLETED,
      filename: doc.title + (doc.status === STATUS.COMPLETED ? '_signed.pdf' : '.pdf'),
      pdfBase64: dd.data,
    } };
  }

  // GET /v1/sign/documents/:id/audit
  function documentsAudit(req) {
    var doc = getDocument(req.params.id);
    if (!doc) notFound('document not found');
    var rows = query('SELECT * FROM audit_logs WHERE document_id = ? ORDER BY created_at ASC', [doc.id]);
    return { status: 200, body: { documentId: doc.id, entries: rows.map(function (a) {
      return { id: a.id, type: a.type, data: jparse(a.data), name: a.name, email: a.email, createdAt: a.created_at };
    }) } };
  }

  // ==========================================================================
  // RECIPIENT TOKEN ROUTES (tenant = :org path segment; capability = :token)
  // ==========================================================================

  function requireRecipient(req) {
    var r = recipientByToken(req.params.token);
    if (!r) unauthorized('invalid signing token');
    var doc = getDocument(r.document_id);
    if (!doc) unauthorized('invalid signing token');
    return { recipient: r, doc: doc };
  }

  // GET /v1/sign/o/:org/sign/:token
  function signView(req) {
    var rd = requireRecipient(req);
    var r = rd.recipient, doc = rd.doc;
    if (r.read_status === READ.NOT_OPENED) {
      exec('UPDATE recipients SET read_status = ? WHERE id = ?', [READ.OPENED, r.id]);
      audit(doc.id, AUDIT.DOCUMENT_OPENED, { recipientId: r.id, recipientEmail: r.email }, { email: r.email });
    }
    var dd = getDocumentData(doc.document_data_id);
    var myFields = fieldsForRecipient(doc.id, r.id).map(function (f) {
      return { id: f.id, type: f.type, page: f.page, positionX: f.position_x, positionY: f.position_y,
        width: f.width, height: f.height, customText: f.custom_text, inserted: !!f.inserted, fieldMeta: jparse(f.field_meta) };
    });
    return { status: 200, body: {
      document: { id: doc.id, title: doc.title, status: doc.status },
      recipient: { id: r.id, email: r.email, name: r.name, role: r.role, signingStatus: r.signing_status },
      fields: myFields,
      pdfBase64: dd ? dd.data : null,
    } };
  }

  // POST /v1/sign/o/:org/sign/:token/fields/:fieldId  { value, isBase64? }
  function signField(req) {
    var rd = requireRecipient(req);
    var r = rd.recipient, doc = rd.doc;
    if (doc.status !== STATUS.PENDING) conflict('document is not pending signature');
    if (r.signing_status === SIGNING.SIGNED) conflict('recipient already completed');
    if (r.signing_status === SIGNING.REJECTED) conflict('recipient already rejected');

    var field = firstRow(query('SELECT * FROM fields WHERE id = ? AND document_id = ?', [req.params.fieldId, doc.id]));
    if (!field) notFound('field not found');
    if (field.recipient_id !== r.id) unauthorized('field does not belong to this recipient');
    if (field.inserted) conflict('field already signed');

    var b = reqBody(req);
    var isSig = !!SIGNATURE_TYPES[field.type];
    var value = b.value;
    var customText = '';

    if (isSig) {
      if (value == null || value === '') bad('signature value required');
      if (b.isBase64) {
        exec('INSERT INTO signatures (id, field_id, recipient_id, image_base64, typed_signature, created_at) VALUES (?,?,?,?,?,?)',
          [id(), field.id, r.id, rawBase64(value), null, now()]);
      } else {
        exec('INSERT INTO signatures (id, field_id, recipient_id, image_base64, typed_signature, created_at) VALUES (?,?,?,?,?,?)',
          [id(), field.id, r.id, null, String(value), now()]);
      }
    } else if (field.type === 'DATE') {
      customText = (value != null && value !== '') ? String(value) : new Date(now()).toISOString().slice(0, 10);
    } else if (field.type === 'NAME') {
      customText = (value != null && value !== '') ? String(value) : r.name;
    } else if (field.type === 'EMAIL') {
      customText = (value != null && value !== '') ? String(value) : r.email;
    } else {
      if (value == null || value === '') bad('value required for field type ' + field.type);
      customText = String(value);
    }

    exec('UPDATE fields SET custom_text = ?, inserted = 1 WHERE id = ?', [customText, field.id]);
    audit(doc.id, AUDIT.DOCUMENT_FIELD_INSERTED,
      { fieldId: field.id, recipientId: r.id, recipientEmail: r.email, field: { type: field.type, data: isSig ? '[signature]' : customText } },
      { email: r.email });
    return { status: 200, body: { fieldId: field.id, inserted: true } };
  }

  // POST /v1/sign/o/:org/sign/:token/reject  { reason? }
  function signReject(req) {
    var rd = requireRecipient(req);
    var r = rd.recipient, doc = rd.doc;
    if (doc.status !== STATUS.PENDING) conflict('document is not pending signature');
    if (r.signing_status !== SIGNING.NOT_SIGNED) conflict('recipient has already acted');
    var reason = reqBody(req).reason ? String(reqBody(req).reason) : '';
    exec('UPDATE recipients SET signing_status = ?, rejection_reason = ?, signed_at = ? WHERE id = ?',
      [SIGNING.REJECTED, reason, now(), r.id]);
    audit(doc.id, AUDIT.DOCUMENT_RECIPIENT_REJECTED,
      { recipientId: r.id, recipientEmail: r.email, recipientName: r.name, recipientRole: r.role, reason: reason }, { email: r.email });
    exec('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?', [STATUS.REJECTED, now(), doc.id]);
    audit(doc.id, AUDIT.DOCUMENT_COMPLETED, { transactionId: id(), isRejected: true, rejectionReason: reason }, { email: r.email });
    return { status: 200, body: { recipientId: r.id, status: STATUS.REJECTED } };
  }

  // POST /v1/sign/o/:org/sign/:token/complete
  function signComplete(req) {
    var rd = requireRecipient(req);
    var r = rd.recipient, doc = rd.doc;
    if (doc.status !== STATUS.PENDING) conflict('document is not pending signature');
    if (r.signing_status === SIGNING.SIGNED) conflict('recipient already completed');

    var pending = firstRow(query('SELECT COUNT(*) AS c FROM fields WHERE document_id = ? AND recipient_id = ? AND inserted = 0', [doc.id, r.id]));
    if (pending && Number(pending.c) > 0) bad('recipient has ' + pending.c + ' unsigned field(s)');

    exec('UPDATE recipients SET signing_status = ?, signed_at = ? WHERE id = ?', [SIGNING.SIGNED, now(), r.id]);
    audit(doc.id, AUDIT.DOCUMENT_RECIPIENT_COMPLETED, { recipientId: r.id, recipientEmail: r.email }, { email: r.email });

    var sealed = maybeSeal(doc, { email: r.email });
    return { status: 200, body: { recipientId: r.id, documentStatus: sealed ? STATUS.COMPLETED : STATUS.PENDING, sealed: sealed } };
  }

  // maybeSeal seals the document when every SIGNER/APPROVER recipient is SIGNED.
  // Sealing = render the inserted field values onto the PDF (__pdf.stamp) then
  // apply a real x509/PKCS#7 digital signature (__pdf.sign), persist the sealed
  // bytes, flip status to COMPLETED, and write DOCUMENT_COMPLETED. Because the
  // host runs each dispatch in ONE transaction, the field write + seal + status
  // flip commit atomically (or roll back together on any error).
  function maybeSeal(doc, actor) {
    var recipients = listRecipients(doc.id);
    for (var i = 0; i < recipients.length; i++) {
      var r = recipients[i];
      if (SIGNING_ROLES[r.role] && r.signing_status !== SIGNING.SIGNED) return false;
    }
    var dd = getDocumentData(doc.document_data_id);
    if (!dd) throw new HttpError(500, 'document data missing at seal');

    var fields = listFields(doc.id).filter(function (f) { return !!f.inserted; });
    var stamps = [];
    for (var j = 0; j < fields.length; j++) {
      var f = fields[j];
      var rect = { page: Number(f.page) || 1, x: Number(f.position_x) || 0, y: Number(f.position_y) || 0,
        w: Number(f.width), h: Number(f.height) };
      if (SIGNATURE_TYPES[f.type]) {
        var sig = signatureForField(f.id);
        if (sig && sig.image_base64) {
          stamps.push({ page: rect.page, kind: 'image', x: rect.x, y: rect.y, w: rect.w, h: rect.h, image: sig.image_base64 });
        } else if (sig && sig.typed_signature) {
          stamps.push({ page: rect.page, kind: 'text', x: rect.x, y: rect.y, w: rect.w, h: rect.h, text: sig.typed_signature });
        }
      } else if (f.custom_text != null && f.custom_text !== '') {
        stamps.push({ page: rect.page, kind: 'text', x: rect.x, y: rect.y, w: rect.w, h: rect.h, text: String(f.custom_text) });
      }
    }

    var stamped = __pdf.stamp(dd.data, JSON.stringify(stamps));
    var signed = __pdf.sign(stamped);

    var t = now();
    exec('UPDATE document_data SET data = ? WHERE id = ?', [signed, dd.id]);
    exec('UPDATE documents SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?', [STATUS.COMPLETED, t, t, doc.id]);
    audit(doc.id, AUDIT.DOCUMENT_COMPLETED, { transactionId: id() }, actor);
    return true;
  }

  // === route table ==========================================================
  var routes = {
    'documents.create': documentsCreate,
    'documents.list': documentsList,
    'documents.get': documentsGet,
    'recipients.add': recipientsAdd,
    'fields.add': fieldsAdd,
    'documents.send': documentsSend,
    'documents.download': documentsDownload,
    'documents.audit': documentsAudit,
    'sign.view': signView,
    'sign.field': signField,
    'sign.complete': signComplete,
    'sign.reject': signReject,
  };

  // === dispatch entry (host calls this per request) =========================
  globalThis.handle = function (req) {
    req = req || {};
    req.params = req.params || {};
    req.query = req.query || {};
    var fn = routes[req.route];
    if (!fn) return { status: 404, body: { error: 'unknown sign route: ' + req.route } };
    try {
      return fn(req);
    } catch (err) {
      if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
      return { status: 500, body: { error: String((err && err.message) || err) } };
    }
  };
})();
