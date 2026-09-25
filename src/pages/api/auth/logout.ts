import type { APIRoute } from "astro";
import { closeSession } from "@/server/accounts";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
	await closeSession(cookies);
	return redirect("/account/", 303);
};
