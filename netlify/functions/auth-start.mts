import type { Context, Config } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import { STATE_COOKIE } from "./_lib/session.mts";

export default async (req: Request, context: Context) => {
  const clientId = Netlify.env.get("GOOGLE_CLIENT_ID");
  const allowedDomain = Netlify.env.get("ALLOWED_EMAIL_DOMAIN") || "";
  const baseUrl = Netlify.env.get("APP_BASE_URL") || new URL(req.url).origin;

  if (!clientId) {
    return new Response("Google auth is not configured", { status: 500 });
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    // hd only pre-filters the account chooser UI — it is NOT a security
    // control. The real domain check happens server-side in the callback.
    hd: allowedDomain,
    state,
  });

  const headers = new Headers();
  headers.append("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  headers.append("Set-Cookie", `${STATE_COOKIE}=${state}; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Lax`);
  return new Response(null, { status: 302, headers });
};

export const config: Config = {
  path: "/api/auth/google/start",
};
