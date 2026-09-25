import type { APIRoute } from "astro";
import { openSession, writeSessionCookie } from "@/server/accounts";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const form = await request.formData();
	const email = String(form.get("email") ?? "");
	const password = String(form.get("password") ?? "");
	const result = await openSession(email, password);
	if (!result.ok) {
		return redirect(`/account/?error=${encodeURIComponent(result.error)}`, 303);
	}
	writeSessionCookie(cookies, result.sessionId);
	return redirect("/account/", 303);
};
