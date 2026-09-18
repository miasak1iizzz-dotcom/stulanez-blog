export type VideoJobStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export type VideoPlatform = "bilibili" | "youtube";

export interface VideoMeta {
	bvid: string;
	title: string;
	up: string;
	duration: number;
	cover?: string;
	url: string;
	platform?: VideoPlatform;
	youtube?: string;
}

export interface VideoChapter {
	time: string;
	title: string;
	summary: string;
}

export interface VideoCard {
	title: string;
	body: string;
}

export interface VideoFlashcard {
	q: string;
	a: string;
	time?: string;
}

export interface VideoSlide {
	time: string;
	title: string;
	body: string;
	bullets: string[];
}

export interface VideoMindNode {
	id: string;
	title: string;
	time?: string;
	children?: VideoMindNode[];
}

export interface VideoDigestResult {
	meta: VideoMeta;
	tldr: string;
	points: string[];
	cards: VideoCard[];
	chapters: VideoChapter[];
	markdown: string;
	transcript?: string;
	mindmap?: VideoMindNode;
	flashcards?: VideoFlashcard[];
	slides?: VideoSlide[];
	article?: string;
	savedAt?: number;
}

export interface VideoJob {
	ok: boolean;
	id?: string;
	bvid?: string;
	status?: VideoJobStatus;
	message?: string;
	error?: string;
	result?: VideoDigestResult;
}
