import fs from "node:fs";
import path from "node:path";

const claimsDir = path.join(process.cwd(), ".ai-work", "claims");
const lockPath = path.join(claimsDir, ".board-write.lock.json");
const [command, owner, ...taskParts] = process.argv.slice(2);

function readLock() {
	if (!fs.existsSync(lockPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(lockPath, "utf-8"));
	} catch {
		throw new Error(`Board lock is unreadable: ${lockPath}`);
	}
}

function printUsage() {
	console.log("Usage:");
	console.log('  node scripts/agent-board-lock.mjs acquire <owner> "<task>"');
	console.log("  node scripts/agent-board-lock.mjs release <owner>");
	console.log("  node scripts/agent-board-lock.mjs status");
}

if (command === "status") {
	const lock = readLock();
	console.log(
		lock ? JSON.stringify(lock, null, 2) : "Board write lock is free.",
	);
} else if (command === "acquire") {
	const task = taskParts.join(" ").trim();
	if (!owner || !task) {
		printUsage();
		process.exitCode = 2;
	} else {
		fs.mkdirSync(claimsDir, { recursive: true });
		const lock = { owner, task, acquiredAt: new Date().toISOString() };
		try {
			fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, {
				encoding: "utf-8",
				flag: "wx",
			});
			console.log(`Board write lock acquired by ${owner} for ${task}.`);
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "EEXIST"
			) {
				const current = readLock();
				console.error(
					`Board write lock is held by ${current?.owner ?? "unknown"} for ` +
						`${current?.task ?? "unknown"} since ${current?.acquiredAt ?? "unknown"}.`,
				);
				process.exitCode = 1;
			} else {
				throw error;
			}
		}
	}
} else if (command === "release") {
	if (!owner) {
		printUsage();
		process.exitCode = 2;
	} else {
		const current = readLock();
		if (!current) {
			console.log("Board write lock is already free.");
		} else if (current.owner !== owner) {
			console.error(
				`Board write lock belongs to ${current.owner}; ${owner} cannot release it.`,
			);
			process.exitCode = 1;
		} else {
			fs.unlinkSync(lockPath);
			console.log(`Board write lock released by ${owner}.`);
		}
	}
} else {
	printUsage();
	process.exitCode = 2;
}
