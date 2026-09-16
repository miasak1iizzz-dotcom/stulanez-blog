import {
	getClaimConflicts,
	getClaims,
	getSharedBoardClaimViolations,
} from "../src/utils/agent-board";

const args = process.argv.slice(2);
const claimArgIndex = args.indexOf("--claim");
const selectedClaim =
	claimArgIndex >= 0
		? args[claimArgIndex + 1]?.replace(/\.md$/, "")
		: undefined;
const claims = getClaims();
const concernsClaim = (left: string, right?: string): boolean =>
	!selectedClaim || left === selectedClaim || right === selectedClaim;

const conflicts = getClaimConflicts(claims).filter((conflict) =>
	concernsClaim(conflict.leftClaim, conflict.rightClaim),
);
const sharedBoardViolations = getSharedBoardClaimViolations(claims).filter(
	(violation) => concernsClaim(violation.claim),
);

if (conflicts.length === 0 && sharedBoardViolations.length === 0) {
	console.log(
		selectedClaim
			? `Claim ${selectedClaim} passed: no active path conflicts.`
			: `All ${claims.length} claims passed: no active path conflicts.`,
	);
} else {
	if (conflicts.length > 0) {
		console.error(`Active claim conflicts (${conflicts.length}):`);
		for (const conflict of conflicts) {
			console.error(
				`- ${conflict.leftClaim} (${conflict.leftOwner}) [${conflict.leftPath}] <-> ` +
					`${conflict.rightClaim} (${conflict.rightOwner}) [${conflict.rightPath}]`,
			);
		}
	}
	if (sharedBoardViolations.length > 0) {
		console.error(
			`Long-lived claims on shared board data (${sharedBoardViolations.length}):`,
		);
		for (const violation of sharedBoardViolations) {
			console.error(
				`- ${violation.claim} (${violation.owner}) [${violation.path}]`,
			);
		}
		console.error(
			"Use scripts/agent-board-lock.mjs for a short board update instead of claiming these files.",
		);
	}
	process.exitCode = 1;
}
