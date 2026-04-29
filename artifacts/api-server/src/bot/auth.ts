import crypto from "node:crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PASSWORD = "4pkj9!uwoj69ttsajidobhai7!";
const DEFAULT_SECRET = "afkbot-dev-secret-change-via-SESSION_SECRET";

function getPassword(): string {
  const p = process.env["BOT_CHAT_PASSWORD"];
  return p && p.length > 0 ? p : DEFAULT_PASSWORD;
}

function getSecret(): string {
  const s = process.env["SESSION_SECRET"];
  return s && s.length > 0 ? s : DEFAULT_SECRET;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
}

export function checkPassword(input: string): boolean {
  const expected = getPassword();
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function issueToken(): string {
  const payload = b64url(Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts as [string, string];
  const expected = sign(payload);
  if (expected.length !== signature.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;
  try {
    const obj = JSON.parse(fromB64url(payload).toString()) as { exp?: number };
    return typeof obj.exp === "number" && obj.exp > Date.now();
  } catch {
    return false;
  }
}

export function tokenFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return m ? m[1] : undefined;
}
