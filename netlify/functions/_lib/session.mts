import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "cc_session";
export const STATE_COOKIE = "cc_oauth_state";

function getSecret(): string {
  const secret = Netlify.env.get("SESSION_SECRET");
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

// A minimal signed token: base64url(email|expiry) + "." + HMAC signature.
// Nothing sensitive is in the payload, and the signature can't be forged
// without SESSION_SECRET (kept server-side only), so this is safe as a cookie.
export function createSessionToken(email: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadB64 = Buffer.from(`${email}|${exp}`, "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string | undefined | null): { email: string } | null {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [email, expStr] = Buffer.from(payloadB64, "base64url").toString("utf8").split("|");
  const exp = parseInt(expStr, 10);
  if (!email || !exp || Date.now() / 1000 > exp) return null;
  return { email };
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}
