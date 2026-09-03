import type { Context, Config } from "@netlify/functions";
import { SESSION_COOKIE } from "./_lib/session.mts";

export default async (req: Request, context: Context) => {
  const baseUrl = Netlify.env.get("APP_BASE_URL") || new URL(req.url).origin;
  const headers = new Headers();
  headers.append("Location", `${baseUrl}/`);
  headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0`);
  return new Response(null, { status: 302, headers });
};

export const config: Config = {
  path: "/api/auth/logout",
};
