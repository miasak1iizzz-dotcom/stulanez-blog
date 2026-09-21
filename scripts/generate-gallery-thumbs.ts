import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import sharp from "sharp";

const GALLERY_DIR = "public/gallery";
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 72;

async function main() {
	const files = await glob(`${GALLERY_DIR}/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}`, {
		ignore: [`${GALLERY_DIR}/**/thumbs/**`],
	});

	if (files.length === 0) {
		console.log("No gallery originals found.");
		return;
	}

	let written = 0;
	let skipped = 0;

	for (const file of files) {
		const parsed = path.parse(file);
		const albumDir = path.dirname(file);
		const outDir = path.join(albumDir, "thumbs");
		const outFile = path.join(outDir, `${parsed.name}.webp`);

		try {
			const [srcStat, outStat] = await Promise.all([
				fs.stat(file),
				fs.stat(outFile).catch(() => null),
			]);
			if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) {
				skipped++;
				continue;
			}

			await fs.mkdir(outDir, { recursive: true });
			await sharp(file)
				.rotate()
				.resize({
					width: THUMB_WIDTH,
					withoutEnlargement: true,
				})
				.webp({ quality: THUMB_QUALITY })
				.toFile(outFile);
			written++;
			process.stdout.write(`\rThumbs ${written + skipped}/${files.length}...`);
		} catch (error) {
			console.error(`\nError processing ${file}:`, error);
		}
	}

	console.log(
		`\nGallery thumbs ready. wrote=${written} skipped=${skipped} total=${files.length}`,
	);
}

main();
