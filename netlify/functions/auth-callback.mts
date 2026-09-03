import type { Context, Config } from "@netlify/functions";
import { SESSION_COOKIE, STATE_COOKIE, createSessionToken, parseCookies } from "./_lib/session.mts";

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(req);
  const baseUrl = Netlify.env.get("APP_BASE_URL") || url.origin;

  function fail(reason: string) {
    const headers = new Headers();
    headers.append("Location", `${baseUrl}/?auth_error=${encodeURIComponent(reason)}`);
    headers.append("Set-Cookie", `${STATE_COOKIE}=; Path=/; Max-Age=0`);
    return new Response(null, { status: 302, headers });
  }

  // CSRF check: the state we handed out in auth-start must match what came back
  if (!code || !state || state !== cookies[STATE_COOKIE]) {
    return fail("invalid_state");
  }

  const clientId = Netlify.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Netlify.env.get("GOOGLE_CLIENT_SECRET");
  const allowedDomain = (Netlify.env.get("ALLOWED_EMAIL_DOMAIN") || "").toLowerCase();
  if (!clientId || !clientSecret || !allowedDomain) {
    return new Response("Google auth is not configured", { status: 500 });
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  // Exchange the one-time code for tokens. client_secret is only ever used
  // here, server-side — it never reaches the browser.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("token_exchange_failed");
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return fail("no_id_token");

  // Delegate ID token signature/expiry verification to Google itself instead
  // of hand-rolling JWT verification.
  const verifyRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`
  );
  if (!verifyRes.ok) return fail("id_token_invalid");
  const claims = (await verifyRes.json()) as Record<string, string>;

  const email = String(claims.email || "").toLowerCase();
  const emailVerified = String(claims.email_verified) === "true";
  const hostedDomain = String(claims.hd || "").toLowerCase();

  // Two independent checks: the Workspace "hd" claim AND the email suffix
  // must both match. Personal Gmail accounts have no "hd" claim at all.
  const domainOk = hostedDomain === allowedDomain && email.endsWith(`@${allowedDomain}`);

  if (claims.aud !== clientId || !emailVerified || !domainOk) {
    return fail("domain_not_allowed");
  }

  const sessionToken = createSessionToken(email, SESSION_TTL_SECONDS);
  const headers = new Headers();
  headers.append("Location", `${baseUrl}/`);
  headers.append("Set-Cookie", `${STATE_COOKIE}=; Path=/; Max-Age=0`);
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionToken}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  );
  return new Response(null, { status: 302, headers });
};

export const config: Config = {
  path: "/api/auth/google/callback",
};
