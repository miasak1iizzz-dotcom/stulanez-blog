import type { APIRoute } from "astro";
import { openSession, registerAccount, writeSessionCookie } from "@/server/accounts";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const form = await request.formData();
	const email = String(form.get("email") ?? "");
	const password = String(form.get("password") ?? "");
	const created = await registerAccount(email, password);
	if (!created.ok) {
		return redirect(`/account/?error=${encodeURIComponent(created.error)}`, 303);
	}
	const session = await openSession(email, password);
	if (!session.ok) {
		return redirect(`/account/?error=${encodeURIComponent(session.error)}`, 303);
	}
	writeSessionCookie(cookies, session.sessionId);
	return redirect("/account/", 303);
};
