// Browser shim for Node's `net` module.
//
// @zap-proto/zap's single entry bundles its Node-only TCP RPC client
// (ZapClient, `import { Socket } from "net"`). The browser bundle uses only the
// package's view/builder/envelope primitives (via @zap-proto/web's WebSocket
// transport and esign's generated ZAP bindings) and never instantiates
// ZapClient, but rollup still needs `net` to provide a `Socket` export at link
// time. This shim provides an inert one so the named import resolves; any
// actual use in the browser throws (it never happens).
export class Socket {
  constructor() {
    throw new Error('net.Socket is not available in the browser (ZAP uses WebSocket transport)');
  }
}

export default { Socket };
