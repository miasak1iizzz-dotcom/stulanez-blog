/**
 * 把 public 里的相册、音乐、壁纸传到阿里云 OSS。
 * 密钥只读本机 .env，不进仓库。
 *
 * .env 需要：
 *   OSS_ACCESS_KEY_ID=
 *   OSS_ACCESS_KEY_SECRET=
 *   OSS_BUCKET=
 *   OSS_REGION=oss-cn-hangzhou
 */
import fs from "node:fs";
import path from "node:path";
import OSS from "ali-oss";

const ROOT = process.cwd();
const PREFIXES = [
	"public/gallery",
	"public/assets/music",
	"public/assets/images/wallpaper",
] as const;

const SKIP_NAMES = new Set(["urls.txt", ".ds_store", "thumbs.db"]);

function loadDotEnv(): void {
	const envPath = path.join(ROOT, ".env");
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq < 1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

function mimeFor(file: string): string {
	const ext = path.extname(file).toLowerCase();
	switch (ext) {
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".png":
			return "image/png";
		case ".webp":
			return "image/webp";
		case ".avif":
			return "image/avif";
		case ".gif":
			return "image/gif";
		case ".mp3":
			return "audio/mpeg";
		case ".lrc":
			return "text/plain; charset=utf-8";
		default:
			return "application/octet-stream";
	}
}

function collectFiles(): string[] {
	const files: string[] = [];
	const walk = (dir: string): void => {
		if (!fs.existsSync(dir)) return;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) continue;
			if (SKIP_NAMES.has(entry.name.toLowerCase())) continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else files.push(full);
		}
	};
	for (const prefix of PREFIXES) walk(path.join(ROOT, prefix));
	return files;
}

function toObjectKey(absFile: string): string {
	const rel = path.relative(path.join(ROOT, "public"), absFile);
	return rel.split(path.sep).join("/");
}

async function main(): Promise<void> {
	loadDotEnv();
	const accessKeyId = process.env.OSS_ACCESS_KEY_ID ?? "";
	const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET ?? "";
	const bucket = process.env.OSS_BUCKET ?? "";
	const region = process.env.OSS_REGION ?? "oss-cn-hangzhou";
	if (!accessKeyId || !accessKeySecret || !bucket) {
		console.error(
			"缺少 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET。写在项目根目录 .env 里再跑 pnpm oss:sync",
		);
		process.exit(1);
	}

	const files = collectFiles();
	const manifestPath = path.join(ROOT, "src", "data", "media-manifest.json");
	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	fs.writeFileSync(
		manifestPath,
		`${JSON.stringify(files.map(toObjectKey).sort(), null, "\t")}\n`,
	);
	if (files.length === 0) {
		console.log("没有要上传的相册/音乐/壁纸。");
		return;
	}

	const client = new OSS({
		region,
		accessKeyId,
		accessKeySecret,
		bucket,
		secure: true,
		timeout: 120000,
	});

	let ok = 0;
	let fail = 0;
	for (const file of files) {
		const key = toObjectKey(file);
		try {
			await client.put(key, file, {
				headers: {
					"Content-Type": mimeFor(file),
					"Cache-Control": "private, max-age=0",
				},
			});
			ok++;
			console.log(`ok  ${key}`);
		} catch (error) {
			fail++;
			const err = error as {
				message?: string;
				code?: string;
				status?: number;
			};
			const message = err.message ?? String(error);
			console.error(
				`fail ${key}: status=${err.status ?? "?"} code=${err.code ?? "?"} ${message}`,
			);
			if (fail >= 3 && ok === 0) {
				console.error("连续失败，已停止。桶仍是私有的，没有文件被公开。");
				break;
			}
		}
	}

	console.log(`完成：成功 ${ok}，失败 ${fail}，待传 ${files.length}`);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
