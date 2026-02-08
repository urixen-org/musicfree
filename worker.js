export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/musics.json") {
      const manifestRaw = env.__STATIC_CONTENT_MANIFEST || "{}";
      let manifest = {};
      try {
        manifest = JSON.parse(manifestRaw);
      } catch {
        manifest = {};
      }
      const tracks = Object.keys(manifest)
        .filter((key) => key.startsWith("musics/") && key.toLowerCase().endsWith(".mp3"))
        .map((key) => `/${key}`);
      return new Response(JSON.stringify(tracks), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/api/import") {
      return new Response(
        JSON.stringify({ error: "Import not supported in Cloudflare Worker." }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    if (request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
      const res = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
      if (res.status !== 404) return res;
    }

    return env.ASSETS.fetch(request);
  },
};
