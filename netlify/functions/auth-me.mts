import type { Context, Config } from "@netlify/functions";
import { SESSION_COOKIE, parseCookies, verifySessionToken } from "./_lib/session.mts";

export default async (req: Request, context: Context) => {
  const cookies = parseCookies(req);
  const session = verifySessionToken(cookies[SESSION_COOKIE]);
  if (!session) return new Response("Not authenticated", { status: 401 });
  return Response.json({ email: session.email });
};

export const config: Config = {
  path: "/api/auth/me",
};
