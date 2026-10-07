const API_ORIGIN = "https://api.arcunara.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.arcunara.com") {
      url.hostname = "arcunara.com";
      return Response.redirect(url.toString(), 308);
    }

    // 临时诊断接口：检查 Worker 实际收到的访问者 IP
    // 不调用后端，不调用 DeepSeek。
    if (url.pathname === "/debug/client-ip") {
      return new Response(
        JSON.stringify(
          {
            clientIp:
              request.headers.get("CF-Connecting-IP") || null,
            country:
              request.cf?.country || null,
            colo:
              request.cf?.colo || null
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
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

      const contentType =
        request.headers.get("Content-Type") || "";

      if (!contentType.includes("application/json")) {
        return new Response(
          JSON.stringify({
            detail:
              "Content-Type must be application/json"
          }),
          {
            status: 415,
            headers: {
              "Content-Type":
                "application/json; charset=utf-8"
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
              "Content-Type":
                "application/json; charset=utf-8"
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
              "X-Arcunara-Client-IP": clientIp
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
            detail:
              "AI service temporarily unavailable"
          }),
          {
            status: 502,
            headers: {
              "Content-Type":
                "application/json; charset=utf-8",
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
            "Content-Type":
              "application/json; charset=utf-8"
          }
        }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
