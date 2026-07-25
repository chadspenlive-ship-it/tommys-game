const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function getExtension(pathname) {
  const match = pathname.match(/\.[^.\/]+$/);
  return match ? match[0].toLowerCase() : "";
}

function withHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  const contentType = CONTENT_TYPES[getExtension(pathname)];
  if (contentType) {
    headers.set("content-type", contentType);
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchAsset(env, request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const response = await fetchAsset(env, request, pathname);
    if (response.status !== 404) {
      return withHeaders(response, pathname);
    }

    if (!getExtension(pathname)) {
      const indexResponse = await fetchAsset(env, request, "/index.html");
      if (indexResponse.status !== 404) {
        return withHeaders(indexResponse, "/index.html");
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
