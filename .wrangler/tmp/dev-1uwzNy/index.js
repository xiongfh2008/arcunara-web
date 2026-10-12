var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var API_ORIGIN = "https://api.arcunara.com";
var SITE_ORIGIN = "https://arcunara.com";
var LANG_ROUTES = {
  zh: { htmlLang: "zh-CN", og: "zh_CN" },
  ja: { htmlLang: "ja", og: "ja_JP" },
  ko: { htmlLang: "ko", og: "ko_KR" },
  es: { htmlLang: "es", og: "es_ES" },
  fr: { htmlLang: "fr", og: "fr_FR" },
  de: { htmlLang: "de", og: "de_DE" },
  pt: { htmlLang: "pt", og: "pt_BR" },
  ru: { htmlLang: "ru", og: "ru_RU" }
};
var metaCache = {};
function normLangCode(v) {
  if (!v) return null;
  v = String(v).toLowerCase();
  if (v.startsWith("zh")) return "zh";
  const base = v.split("-")[0];
  return base === "en" || LANG_ROUTES[base] ? base : null;
}
__name(normLangCode, "normLangCode");
function unescapeJs(s) {
  return s.replace(/\\(['"\\])/g, "$1");
}
__name(unescapeJs, "unescapeJs");
var STR_VAL = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
var META_RE = new RegExp(
  `meta:\\{[\\s\\S]*?title:${STR_VAL}[\\s\\S]*?desc:${STR_VAL}[\\s\\S]*?ogDesc:${STR_VAL}[\\s\\S]*?twDesc:${STR_VAL}`,
  "g"
);
function extractMetaAll(src) {
  const out = [];
  let m;
  META_RE.lastIndex = 0;
  while (m = META_RE.exec(src)) {
    const v = /* @__PURE__ */ __name((a, b) => unescapeJs(a !== void 0 ? a : b), "v");
    out.push({
      title: v(m[1], m[2]),
      desc: v(m[3], m[4]),
      ogDesc: v(m[5], m[6]),
      twDesc: v(m[7], m[8])
    });
  }
  return out;
}
__name(extractMetaAll, "extractMetaAll");
async function getMeta(env, lang, html) {
  if (metaCache[lang]) return metaCache[lang];
  try {
    let metas;
    if (lang === "zh") {
      metas = extractMetaAll(html);
    } else {
      const res = await env.ASSETS.fetch(new URL(`/i18n/${lang}.js`, "https://assets.local"));
      if (!res.ok) return null;
      metas = extractMetaAll(await res.text());
    }
    if (!metas.length) return null;
    const meta = metas[metas.length - 1];
    metaCache[lang] = meta;
    return meta;
  } catch (error) {
    return null;
  }
}
__name(getMeta, "getMeta");
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escapeHtml, "escapeHtml");
function injectLang(html, cfg, meta, canonicalUrl) {
  let out = html.replace('<html lang="en">', `<html lang="${cfg.htmlLang}">`);
  if (meta) {
    const t = escapeHtml(meta.title);
    const d = escapeHtml(meta.desc);
    const og = escapeHtml(meta.ogDesc);
    const tw = escapeHtml(meta.twDesc);
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`).replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`).replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`).replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${og}">`).replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${cfg.og}">`).replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${t}">`).replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${tw}">`);
  }
  out = out.replace("</title>", `</title>
<link rel="canonical" href="${canonicalUrl}">`);
  return out;
}
__name(injectLang, "injectLang");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.arcunara.com") {
      url.hostname = "arcunara.com";
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === "/api/tarot/reading") {
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({ detail: "Method not allowed" }),
          {
            status: 405,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Allow": "POST"
            }
          }
        );
      }
      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.includes("application/json")) {
        return new Response(
          JSON.stringify({
            detail: "Content-Type must be application/json"
          }),
          {
            status: 415,
            headers: {
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }
      const originToken = env.ARCUNARA_ORIGIN_TOKEN;
      if (!originToken) {
        return new Response(
          JSON.stringify({
            detail: "Origin authentication is not configured"
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store"
            }
          }
        );
      }
      const body = await request.text();
      const clientIp = request.headers.get("CF-Connecting-IP") || "";
      if (body.length > 65536) {
        return new Response(
          JSON.stringify({
            detail: "Request body too large"
          }),
          {
            status: 413,
            headers: {
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }
      try {
        const upstream = await fetch(
          `${API_ORIGIN}/api/tarot/reading`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "X-Arcunara-Client-IP": clientIp,
              "X-Arcunara-Origin-Token": originToken
            },
            body
          }
        );
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            detail: "AI service temporarily unavailable"
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store"
            }
          }
        );
      }
    }
    if (url.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({
          detail: "API route not found"
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          }
        }
      );
    }
    if (url.pathname === "/") {
      const q = normLangCode(url.searchParams.get("lang"));
      if (q) {
        return Response.redirect(url.origin + (q === "en" ? "/" : `/${q}/`), 301);
      }
    }
    const pathLang = url.pathname.match(/^\/(zh|ja|ko|es|fr|de|pt|ru)\/?$/i);
    if (pathLang) {
      const lang = pathLang[1].toLowerCase();
      const assetRes = await env.ASSETS.fetch(new URL("/", url));
      if (!assetRes.ok) return assetRes;
      const rawHtml = await assetRes.text();
      const cfg = LANG_ROUTES[lang];
      const meta = await getMeta(env, lang, rawHtml);
      const html = injectLang(rawHtml, cfg, meta, `${SITE_ORIGIN}/${lang}/`);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300"
        }
      });
    }
    return env.ASSETS.fetch(request);
  }
};

// C:/Users/xiong/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/xiong/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-i7JHdg/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/xiong/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-i7JHdg/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
