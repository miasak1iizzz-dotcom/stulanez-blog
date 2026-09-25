import fs from "node:fs";
import { createPool, type Pool } from "mysql2/promise";

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function databaseUrl(): string {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const envPath = `${process.cwd()}/.env`;
	if (fs.existsSync(envPath)) {
		const line = fs
			.readFileSync(envPath, "utf8")
			.split(/\r?\n/)
			.find((item) => item.startsWith("DATABASE_URL="));
		if (line) return line.slice("DATABASE_URL=".length);
	}
	throw new Error("DATABASE_URL missing");
}

export function db(): Pool {
	if (!pool) {
		pool = createPool({
			uri: databaseUrl(),
			connectionLimit: 1,
			enableKeepAlive: true,
		});
	}
	return pool;
}

export function ensureAccounts(): Promise<void> {
	if (!ready) {
		ready = (async () => {
			const conn = db();
			await conn.query(`
				CREATE TABLE IF NOT EXISTS users (
					id CHAR(36) NOT NULL PRIMARY KEY,
					email VARCHAR(255) NOT NULL,
					password_hash VARCHAR(255) NOT NULL,
					created_at DATETIME NOT NULL,
					UNIQUE KEY users_email (email)
				)
			`);
			await conn.query(`
				CREATE TABLE IF NOT EXISTS sessions (
					id CHAR(64) NOT NULL PRIMARY KEY,
					user_id CHAR(36) NOT NULL,
					expires_at DATETIME NOT NULL,
					KEY sessions_user (user_id)
				)
			`);
		})();
	}
	return ready;
}
