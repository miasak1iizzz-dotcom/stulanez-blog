import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const [, , inputArg, outputArg] = process.argv;

if (!inputArg || !outputArg) {
	console.error(
		"Usage: node scripts/import-novel.mjs <input.txt> <output.json>",
	);
	process.exit(1);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const source = (await readFile(inputPath, "utf8")).replace(/^\uFEFF/, "");
const lines = source.replace(/\r\n?/g, "\n").split("\n");

const titleLine = lines.find((line) => line.trim());
const titleMatch = titleLine?.trim().match(/^(.+?)\s+作者[：:]\s*(.+)$/);

if (!titleMatch) {
	throw new Error("The first non-empty line must use: <title> 作者：<author>");
}

const volumePattern = /^第[一二三四五六七八九十百千万零〇两0-9]+卷[：:].+$/;
const chapterPattern =
	/^(序章|尾声|终章|楔子|第[一二三四五六七八九十百千万零〇两0-9]+章)(?:\s+|[：:])?(.+)?$/;

const volumes = [];
const chapters = [];
let currentVolume = "未分卷";
let currentChapter = null;

function toParagraphs(chapterLines) {
	return chapterLines
		.join("\n")
		.split(/\n\s*\n+/)
		.map((block) =>
			block
				.split("\n")
				.map((line) => line.trim())
				.join(""),
		)
		.filter(Boolean);
}

function flushChapter() {
	if (!currentChapter) return;

	const paragraphs = toParagraphs(currentChapter.lines);
	const charCount = paragraphs.join("").replace(/\s/g, "").length;
	const chapterNumber = chapters.length + 1;
	const label = currentChapter.label;
	const id =
		label === "序章"
			? "prologue"
			: label === "尾声" || label === "终章"
				? "epilogue"
				: `chapter-${String(chapterNumber).padStart(2, "0")}`;

	chapters.push({
		id,
		index: chapterNumber,
		volume: currentChapter.volume,
		label,
		title: currentChapter.title,
		fullTitle: currentChapter.fullTitle,
		charCount,
		paragraphs,
	});

	currentChapter = null;
}

for (const rawLine of lines.slice(lines.indexOf(titleLine) + 1)) {
	const line = rawLine.trim();

	if (volumePattern.test(line)) {
		flushChapter();
		currentVolume = line;
		if (!volumes.includes(line)) volumes.push(line);
		continue;
	}

	const chapterMatch = line.match(chapterPattern);
	if (chapterMatch) {
		flushChapter();
		const label = chapterMatch[1];
		const chapterTitle = chapterMatch[2]?.trim() || label;
		currentChapter = {
			volume: currentVolume,
			label,
			title: chapterTitle,
			fullTitle: line,
			lines: [],
		};
		continue;
	}

	if (currentChapter) currentChapter.lines.push(rawLine.replace(/\s+$/, ""));
}

flushChapter();

if (chapters.length === 0) {
	throw new Error("No chapter headings were found in the source file");
}

const totalCharCount = chapters.reduce(
	(sum, chapter) => sum + chapter.charCount,
	0,
);
const paragraphCount = chapters.reduce(
	(sum, chapter) => sum + chapter.paragraphs.length,
	0,
);

const novel = {
	title: titleMatch[1].trim(),
	author: titleMatch[2].trim(),
	sourceFile: basename(inputPath),
	volumeCount: volumes.length,
	chapterCount: chapters.length,
	paragraphCount,
	totalCharCount,
	readingMinutes: Math.max(1, Math.ceil(totalCharCount / 400)),
	volumes,
	chapters,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(novel, null, "\t")}\n`, "utf8");

console.log(
	`Imported ${novel.title}: ${novel.volumeCount} volumes, ${novel.chapterCount} chapters, ${novel.totalCharCount} characters -> ${outputPath}`,
);
