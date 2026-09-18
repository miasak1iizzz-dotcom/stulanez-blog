import bv1f from "@/data/videos/BV1fFtc6uEHL.json";
import bv1gl from "@/data/videos/BV1GL9wBbEMX.json";
import bv1q from "@/data/videos/BV1Qwby6DEu1.json";
import bv14 from "@/data/videos/BV14Utf6QEnB.json";
import { bvidOf, peelBilibili } from "./bilibili";
import { isCompleteNote, polishNote } from "./cover";
import type { VideoDigestResult } from "./types";

const NOTES: Record<string, VideoDigestResult> = {
	BV14Utf6QEnB: bv14 as VideoDigestResult,
	BV1Qwby6DEu1: bv1q as VideoDigestResult,
	BV1GL9wBbEMX: bv1gl as VideoDigestResult,
	BV1fFtc6uEHL: bv1f as VideoDigestResult,
};

export function cachedDigest(input: string): VideoDigestResult | null {
	const bvid = bvidOf(peelBilibili(input));
	if (!bvid) return null;
	const hit = NOTES[bvid];
	if (!hit) return null;
	if ((hit.cards?.length || 0) < 4) return null;
	const note = polishNote(hit as VideoDigestResult, hit.transcript || "");
	return isCompleteNote(note) ? note : null;
}
