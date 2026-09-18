export type VideoJobStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export interface VideoMeta {
	bvid: string;
	title: string;
	up: string;
	duration: number;
	cover?: string;
	url: string;
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

export interface VideoDigestResult {
	meta: VideoMeta;
	tldr: string;
	points: string[];
	cards: VideoCard[];
	chapters: VideoChapter[];
	markdown: string;
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
