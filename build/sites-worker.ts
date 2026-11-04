import {GET as legacyModelGET} from "../app/models/[...file]/route";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // Vinext's compiled public-file list includes original models. Serve these
    // before its static-file signal, because production payloads live in R2.
    const url = new URL(request.url);
    if (!import.meta.env.DEV && url.pathname.startsWith('/models/')) {
      if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
      let file:string[];
      try { file=url.pathname.slice('/models/'.length).split('/').map(decodeURIComponent); }
      catch { return new Response('Invalid model path',{status:400}); }
      const response=legacyModelGET(request,{params:Promise.resolve({file})});
      return request.method==='HEAD'?response.then(r=>new Response(null,{status:r.status,headers:r.headers})):response;
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};
