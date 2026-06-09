const TEXT_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type",
  "x-content-type-options": "nosniff"
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: TEXT_HEADERS });
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return text("Method Not Allowed", 405);
    }

    const url = new URL(request.url);
    const route = normalizeRoute(url.pathname);

    if (route === "/health") {
      return json({
        ok: true,
        upstream: rawUrl(env, "updated_at.txt")
      });
    }

    if (route === "/" || route === "/m3u") {
      return serveCached(request, env, ctx, "result.m3u", "audio/x-mpegurl; charset=utf-8");
    }

    if (route === "/txt") {
      return serveCached(request, env, ctx, "result.txt", "text/plain; charset=utf-8");
    }

    if (route === "/updated") {
      return serveCached(request, env, ctx, "updated_at.txt", "text/plain; charset=utf-8");
    }

    return text("Not Found", 404);
  }
};

async function serveCached(request, env, ctx, fileName, contentType) {
  assertEnv(env);

  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = `/__cache/${fileName}`;
  cacheUrl.search = "";
  const cacheKey = new Request(cacheUrl.toString(), request);

  const cached = await cache.match(cacheKey);
  if (cached) {
    return withHeaders(cached, contentType, "HIT");
  }

  const upstream = await fetch(rawUrl(env, fileName), {
    headers: {
      "user-agent": "cloudflare-worker-iptv/1.0"
    },
    cf: {
      cacheTtl: ttl(env),
      cacheEverything: true
    }
  });

  if (!upstream.ok) {
    return text(`Upstream error: ${upstream.status}`, 502);
  }

  const body = await upstream.text();
  const response = new Response(body, {
    status: 200,
    headers: {
      ...TEXT_HEADERS,
      "content-type": contentType,
      "cache-control": `public, max-age=${ttl(env)}`,
      "x-iptv-cache": "MISS",
      "x-iptv-upstream": rawUrl(env, fileName)
    }
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function rawUrl(env, fileName) {
  const user = env.GITHUB_USER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/public/${fileName}`;
}

function assertEnv(env) {
  if (!env.GITHUB_USER || env.GITHUB_USER === "YOUR_GITHUB_USERNAME") {
    throw new Error("Set GITHUB_USER in worker/wrangler.toml before deploying.");
  }
  if (!env.GITHUB_REPO) {
    throw new Error("Set GITHUB_REPO in worker/wrangler.toml before deploying.");
  }
}

function ttl(env) {
  const parsed = Number.parseInt(env.CACHE_TTL_SECONDS || "1800", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1800;
}

function normalizeRoute(pathname) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function withHeaders(response, contentType, cacheStatus) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(TEXT_HEADERS)) {
    headers.set(key, value);
  }
  headers.set("content-type", contentType);
  headers.set("x-iptv-cache", cacheStatus);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...TEXT_HEADERS,
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...TEXT_HEADERS,
      "content-type": "application/json; charset=utf-8"
    }
  });
}
