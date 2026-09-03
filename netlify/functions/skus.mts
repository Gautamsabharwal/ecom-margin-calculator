import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { SESSION_COOKIE, parseCookies, verifySessionToken } from "./_lib/session.mts";

const STORE_NAME = "sku-data";
const KEY = "sheet";

export default async (req: Request, context: Context) => {
  const cookies = parseCookies(req);
  const session = verifySessionToken(cookies[SESSION_COOKIE]);
  if (!session) return new Response("Not authenticated", { status: 401 });

  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    const sheet = await store.get(KEY, { type: "json" });
    return Response.json(sheet ?? []);
  }

  if (req.method === "POST") {
    let skus: unknown;
    try {
      skus = await req.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }
    if (!Array.isArray(skus)) {
      return new Response("Expected an array of SKUs", { status: 400 });
    }
    await store.setJSON(KEY, skus);
    return Response.json({ ok: true, count: skus.length });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/skus",
};
