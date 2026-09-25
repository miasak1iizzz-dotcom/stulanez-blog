import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { AstroCookies } from "astro";
import { db, ensureAccounts } from "@/server/db";

const scrypt = promisify(scryptCallback);
const COOKIE = "stulanez_session";
const SESSION_DAYS = 30;

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function validEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("base64url");
	const derived = (await scrypt(password, salt, 32)) as Buffer;
	return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [kind, salt, hash] = stored.split("$");
	if (kind !== "scrypt" || !salt || !hash) return false;
	const derived = (await scrypt(password, salt, 32)) as Buffer;
	const expected = Buffer.from(hash, "base64url");
	if (derived.length !== expected.length) return false;
	return timingSafeEqual(derived, expected);
}

export async function registerAccount(
	emailRaw: string,
	password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const email = normalizeEmail(emailRaw);
	if (!validEmail(email)) return { ok: false, error: "邮箱格式不对" };
	if (password.length < 8) return { ok: false, error: "密码至少 8 位" };
	await ensureAccounts();
	const id = crypto.randomUUID();
	const passwordHash = await hashPassword(password);
	try {
		await db().query(
			"INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
			[id, email, passwordHash],
		);
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code === "ER_DUP_ENTRY") return { ok: false, error: "这个邮箱已经注册过" };
		throw error;
	}
	return { ok: true };
}

export async function openSession(
	emailRaw: string,
	password: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
	const email = normalizeEmail(emailRaw);
	await ensureAccounts();
	const [rows] = await db().query(
		"SELECT id, password_hash FROM users WHERE email = ? LIMIT 1",
		[email],
	);
	const user = (rows as { id: string; password_hash: string }[])[0];
	if (!user || !(await verifyPassword(password, user.password_hash))) {
		return { ok: false, error: "邮箱或密码不对" };
	}
	const sessionId = randomBytes(32).toString("base64url");
	await db().query(
		"INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))",
		[sessionId, user.id, SESSION_DAYS],
	);
	return { ok: true, sessionId };
}

export function writeSessionCookie(cookies: AstroCookies, sessionId: string): void {
	cookies.set(COOKIE, sessionId, {
		httpOnly: true,
		secure: import.meta.env.PROD,
		path: "/",
		sameSite: "lax",
		maxAge: SESSION_DAYS * 24 * 60 * 60,
	});
}

export async function currentAccount(
	cookies: AstroCookies,
): Promise<{ email: string } | null> {
	const sessionId = cookies.get(COOKIE)?.value;
	if (!sessionId) return null;
	await ensureAccounts();
	const [rows] = await db().query(
		`SELECT users.email AS email
		 FROM sessions
		 JOIN users ON users.id = sessions.user_id
		 WHERE sessions.id = ? AND sessions.expires_at > UTC_TIMESTAMP()
		 LIMIT 1`,
		[sessionId],
	);
	const row = (rows as { email: string }[])[0];
	return row ? { email: row.email } : null;
}

export async function closeSession(cookies: AstroCookies): Promise<void> {
	const sessionId = cookies.get(COOKIE)?.value;
	if (sessionId) {
		await ensureAccounts();
		await db().query("DELETE FROM sessions WHERE id = ?", [sessionId]);
	}
	cookies.delete(COOKIE, { path: "/" });
}
