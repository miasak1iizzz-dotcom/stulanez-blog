function crcTable(): Uint32Array {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[i] = c >>> 0;
	}
	return table;
}

const CRC = crcTable();

function crc32(data: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		c = CRC[(c ^ (data[i] ?? 0)) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function dosDate(date: Date): { time: number; day: number } {
	const time =
		((date.getHours() & 0x1f) << 11) |
		((date.getMinutes() & 0x3f) << 5) |
		((date.getSeconds() / 2) & 0x1f);
	const day =
		(((date.getFullYear() - 1980) & 0x7f) << 9) |
		(((date.getMonth() + 1) & 0xf) << 5) |
		(date.getDate() & 0x1f);
	return { time, day };
}

function u16(n: number): Uint8Array {
	const b = new Uint8Array(2);
	new DataView(b.buffer).setUint16(0, n, true);
	return b;
}

function u32(n: number): Uint8Array {
	const b = new Uint8Array(4);
	new DataView(b.buffer).setUint32(0, n, true);
	return b;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
	if (typeof CompressionStream === "undefined") return data;
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new CompressionStream("deflate-raw"));
	const buf = await new Response(stream).arrayBuffer();
	return new Uint8Array(buf);
}

function concat(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

export type ZipEntry = {
	name: string;
	data: Uint8Array;
};

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
	const now = dosDate(new Date());
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = new TextEncoder().encode(entry.name.replace(/\\/g, "/"));
		const crc = crc32(entry.data);
		const deflated = await deflateRaw(entry.data);
		const useDeflate = deflated.length < entry.data.length;
		const payload = useDeflate ? deflated : entry.data;
		const method = useDeflate ? 8 : 0;
		const local = concat([
			u32(0x04034b50),
			u16(20),
			u16(0),
			u16(method),
			u16(now.time),
			u16(now.day),
			u32(crc),
			u32(payload.length),
			u32(entry.data.length),
			u16(name.length),
			u16(0),
			name,
			payload,
		]);
		const centralHeader = concat([
			u32(0x02014b50),
			u16(20),
			u16(20),
			u16(0),
			u16(method),
			u16(now.time),
			u16(now.day),
			u32(crc),
			u32(payload.length),
			u32(entry.data.length),
			u16(name.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			name,
		]);
		locals.push(local);
		centrals.push(centralHeader);
		offset += local.length;
	}

	const centralDir = concat(centrals);
	const eocd = concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(entries.length),
		u16(entries.length),
		u32(centralDir.length),
		u32(offset),
		u16(0),
	]);
	return new Blob([concat([...locals, centralDir, eocd]) as BlobPart], {
		type: "application/zip",
	});
}
