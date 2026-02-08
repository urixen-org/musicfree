import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MUSIC_DIR = path.join(ROOT, "musics");

function safePath(p) {
  const full = path.normalize(path.join(ROOT, p));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === "/api/import" && req.method === "POST") {
      try {
        const body = await req.json();
        const rawUrl = String(body?.url || "");
        if (!rawUrl) {
          return Response.json({ error: "Missing url." }, { status: 400 });
        }
        if (!/^https?:\/\//i.test(rawUrl)) {
          return Response.json(
            { error: "Only http/https URLs allowed." },
            { status: 400 },
          );
        }
        if (/youtube\.com|youtu\.be/i.test(rawUrl)) {
          return Response.json(
            { error: "YouTube URLs are not supported." },
            { status: 400 },
          );
        }

        const remote = await fetch(rawUrl);
        if (!remote.ok) {
          return Response.json(
            { error: "Failed to download URL." },
            { status: 400 },
          );
        }
        const contentType = remote.headers.get("content-type") || "";
        if (!contentType.startsWith("audio/")) {
          return Response.json(
            { error: "URL is not an audio file." },
            { status: 400 },
          );
        }

        const fileUrl = new URL(rawUrl);
        const baseName = decodeURIComponent(
          fileUrl.pathname.split("/").pop() || "track",
        );
        const safeBase =
          baseName.replace(/[^a-zA-Z0-9._-]/g, "_") || "track.mp3";
        await mkdir(MUSIC_DIR, { recursive: true });
        const filePath = path.join(MUSIC_DIR, safeBase);
        const buffer = new Uint8Array(await remote.arrayBuffer());
        await writeFile(filePath, buffer);
        return Response.json({ file: safeBase });
      } catch (err) {
        return Response.json({ error: "Import failed." }, { status: 500 });
      }
    }

    if (pathname === "/musics.json") {
      try {
        const files = await readdir(MUSIC_DIR, { withFileTypes: true });
        const tracks = files
          .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".mp3"))
          .map((f) => `/musics/${encodeURIComponent(f.name)}`);
        return Response.json(tracks);
      } catch {
        return new Response("[]", {
          headers: { "content-type": "application/json" },
        });
      }
    }

    const decodedPathname = decodeURIComponent(pathname);
    const resolved = decodedPathname === "/" ? "/index.html" : decodedPathname;
    const filePath = safePath(resolved);
    if (!filePath) return new Response("Not found", { status: 404 });

    const file = Bun.file(filePath);
    if (await file.exists()) return new Response(file);

    return new Response("Not found", { status: 404 });
  },
});

console.log("http://localhost:3000");
