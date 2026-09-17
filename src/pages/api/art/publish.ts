/**
 * 艺术馆发布接口（GitHub 直提模式）—— 把缩略图与清单提交进仓库，由 Vercel 自动部署上线。
 *
 * 为什么有这条路：不需要任何额外的存储账号、不需要绑卡，只用已有的 GitHub 仓库。
 * 代价：不是秒级（Vercel 构建 1-2 分钟），且每次换展都会占用仓库空间。
 *
 * 流程分两步（因为 Vercel 函数请求体有大小限制，不能一次把几百张图塞进来）：
 *   1) action=blobs ：分批把文件内容递给 GitHub，换回每个文件的 blob sha
 *   2) action=commit：拿着全部 sha 一次性建 tree + commit + 移动分支（只产生一个提交）
 *
 * 环境变量：
 *   GITHUB_TOKEN         细粒度 token，只给本仓库 Contents 读写权限
 *   GITHUB_REPO          owner/repo，例如 miasak1iizzz-dotcom/stulanez-blog
 *   GITHUB_BRANCH        默认 main
 *   ART_PUBLISH_TOKEN    站长口令，策展台里填一次
 *
 * 部署要求：需要服务端运行，不能是纯静态。astro.config 已配 vercel 适配器。
 */
import type { APIRoute } from "astro";

export const prerender = false;

/** 只允许写这些路径，避免接口被当成任意文件的通行证 */
const ALLOWED_PREFIXES = ["art/img/", "art/thumb/", "art/manifest.json"];
const MAX_FILES_PER_BATCH = 40;

interface BlobFile {
	path?: string;
	/** base64 编码的文件内容 */
	content?: string;
}

interface CommitFile {
	path?: string;
	sha?: string;
}

interface PublishRequest {
	token?: string;
	action?: "blobs" | "commit";
	files?: (BlobFile & CommitFile)[];
	message?: string;
}

function env(name: string, fallback = ""): string {
	return (process.env[name] ?? fallback).trim();
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
	});
}

function allowed(path: string): boolean {
	return ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix));
}

interface GithubContext {
	token: string;
	repo: string;
	branch: string;
}

async function github(context: GithubContext, path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${context.token}`,
			"x-github-api-version": "2022-11-28",
			"user-agent": "stulanez-art-publish",
			...(init.headers ?? {}),
		},
	});
}

async function githubJson<T>(context: GithubContext, path: string, init?: RequestInit): Promise<T> {
	const response = await github(context, path, init);
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`GitHub ${response.status}：${text.slice(0, 300)}`);
	}
	return JSON.parse(text) as T;
}

export const POST: APIRoute = async ({ request }) => {
	const expected = env("ART_PUBLISH_TOKEN");
	if (!expected) return json({ error: "服务端还没配 ART_PUBLISH_TOKEN，发布功能未启用" }, 503);

	let payload: PublishRequest;
	try {
		payload = (await request.json()) as PublishRequest;
	} catch {
		return json({ error: "请求不是合法 JSON" }, 400);
	}
	if (payload.token !== expected) return json({ error: "站长口令不对" }, 401);

	const token = env("GITHUB_TOKEN");
	const repo = env("GITHUB_REPO");
	const branch = env("GITHUB_BRANCH", "main");
	if (!token || !repo) return json({ error: "服务端还没配 GITHUB_TOKEN / GITHUB_REPO" }, 503);
	const context: GithubContext = { token, repo, branch };

	const files = Array.isArray(payload.files) ? payload.files : [];

	try {
		if (payload.action === "blobs") {
			if (!files.length) return json({ error: "没给文件" }, 400);
			if (files.length > MAX_FILES_PER_BATCH) return json({ error: `一批最多 ${MAX_FILES_PER_BATCH} 个文件` }, 400);
			for (const file of files) {
				if (!file.path || !allowed(file.path)) return json({ error: `不允许写这个路径：${file.path ?? "(空)"}` }, 403);
				if (typeof file.content !== "string" || !file.content) return json({ error: `文件内容为空：${file.path}` }, 400);
			}
			const results: { path: string; sha: string }[] = [];
			for (const file of files) {
				const blob = await githubJson<{ sha: string }>(context, `/repos/${repo}/git/blobs`, {
					method: "POST",
					body: JSON.stringify({ content: file.content, encoding: "base64" }),
				});
				results.push({ path: file.path as string, sha: blob.sha });
			}
			return json({ blobs: results });
		}

		if (payload.action === "commit") {
			if (!files.length) return json({ error: "没给文件" }, 400);
			for (const file of files) {
				if (!file.path || !file.sha || !allowed(file.path)) return json({ error: `提交项不合法：${file.path ?? "(空)"}` }, 403);
			}
			// 1) 当前分支指向的提交与它的 tree
			const ref = await githubJson<{ object: { sha: string } }>(context, `/repos/${repo}/git/ref/heads/${branch}`);
			const parentSha = ref.object.sha;
			const parent = await githubJson<{ tree: { sha: string } }>(context, `/repos/${repo}/git/commits/${parentSha}`);

			// 2) 一次性建 tree：只覆盖 art/ 下的文件，其余保持原样
			const tree = await githubJson<{ sha: string }>(context, `/repos/${repo}/git/trees`, {
				method: "POST",
				body: JSON.stringify({
					base_tree: parent.tree.sha,
					tree: files.map(file => ({ path: file.path, mode: "100644", type: "blob", sha: file.sha })),
				}),
			});

			// 3) 建提交并移动分支
			const message = payload.message?.trim() || `chore(art): 换展（${files.length} 个文件）`;
			const commit = await githubJson<{ sha: string }>(context, `/repos/${repo}/git/commits`, {
				method: "POST",
				body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
			});
			await githubJson(context, `/repos/${repo}/git/refs/heads/${branch}`, {
				method: "PATCH",
				body: JSON.stringify({ sha: commit.sha }),
			});
			return json({ commit: commit.sha, files: files.length });
		}

		return json({ error: "action 只能是 blobs 或 commit" }, 400);
	} catch (error) {
		return json({ error: (error as Error).message }, 502);
	}
};
