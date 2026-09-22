import { loadDynamicFeedEntries } from "@/utils/dynamic-feed";

export async function GET(): Promise<Response> {
	const data = await loadDynamicFeedEntries();
	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
		},
	});
}
