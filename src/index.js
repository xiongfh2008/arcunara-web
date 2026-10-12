const API_ORIGIN = "https://api.arcunara.com";

/* ═══════════ 路径式多语言：/zh/ /ja/ ... 服务端注入语言化的 <head> ═══════════ */
const SITE_ORIGIN = "https://arcunara.com";
const LANG_ROUTES = {
  zh: { htmlLang: "zh-CN", og: "zh_CN" },
  ja: { htmlLang: "ja",    og: "ja_JP" },
  ko: { htmlLang: "ko",    og: "ko_KR" },
  es: { htmlLang: "es",    og: "es_ES" },
  fr: { htmlLang: "fr",    og: "fr_FR" },
  de: { htmlLang: "de",    og: "de_DE" },
  pt: { htmlLang: "pt",    og: "pt_BR" },
  ru: { htmlLang: "ru",    og: "ru_RU" }
};
const metaCache = {};

function normLangCode(v) {
  if (!v) return null;
  v = String(v).toLowerCase();
  if (v.startsWith("zh")) return "zh";
  const base = v.split("-")[0];
  return base === "en" || LANG_ROUTES[base] ? base : null;
}

function unescapeJs(s) {
  return s.replace(/\\(['"\\])/g, "$1");
}

/* 从内联脚本（en/zh）或语言包文件中提取 meta 块；字段顺序固定：title/desc/ogDesc/twDesc。
   兼容单引号与双引号字符串（如 fr 含撇号用双引号）。 */
const STR_VAL = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
const META_RE = new RegExp(
  `meta:\\{[\\s\\S]*?title:${STR_VAL}[\\s\\S]*?desc:${STR_VAL}[\\s\\S]*?ogDesc:${STR_VAL}[\\s\\S]*?twDesc:${STR_VAL}`,
  "g"
);

function extractMetaAll(src) {
  const out = [];
  let m;
  META_RE.lastIndex = 0;
  while ((m = META_RE.exec(src))) {
    const v = (a, b) => unescapeJs(a !== undefined ? a : b);
    out.push({
      title: v(m[1], m[2]),
      desc: v(m[3], m[4]),
      ogDesc: v(m[5], m[6]),
      twDesc: v(m[7], m[8])
    });
  }
  return out;
}

async function getMeta(env, lang, html) {
  if (metaCache[lang]) return metaCache[lang];
  try {
    let metas;
    if (lang === "zh") {
      /* index.html 内联了 en、zh 两个 meta 块，zh 取最后一个 */
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

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function injectLang(html, cfg, meta, canonicalUrl) {
  let out = html.replace('<html lang="en">', `<html lang="${cfg.htmlLang}">`);
  if (meta) {
    const t = escapeHtml(meta.title);
    const d = escapeHtml(meta.desc);
    const og = escapeHtml(meta.ogDesc);
    const tw = escapeHtml(meta.twDesc);
    out = out
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${og}">`)
      .replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${cfg.og}">`)
      .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${t}">`)
      .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${tw}">`);
  }
  out = out.replace("</title>", `</title>\n<link rel="canonical" href="${canonicalUrl}">`);
  return out;
}

export default {
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

      const clientIp =
        request.headers.get("CF-Connecting-IP") || "";

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
            "Content-Type":
              upstream.headers.get("Content-Type") ||
              "application/json; charset=utf-8",
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

    /* ═══════════ 路径式多语言 ═══════════ */
    /* 旧 ?lang=xx 链接 301 到路径式 URL */
    if (url.pathname === "/") {
      const q = normLangCode(url.searchParams.get("lang"));
      if (q) {
        return Response.redirect(url.origin + (q === "en" ? "/" : `/${q}/`), 301);
      }
    }

    /* /{lang} 或 /{lang}/ → 返回注入语言的首页 */
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
