import { pathToFileURL } from "node:url";

export const LOOP_STAGES = Object.freeze([
  "Plan",
  "Act",
  "Verify",
  "Record",
  "Stop",
]);

export const STOP_CONDITIONS = Object.freeze([
  "budget exhaustion",
  "red gate",
  "scope widening",
]);

export function loopContractLines() {
  return [
    "Loom loop contract",
    "",
    "Design principles:",
    "- External state over chat memory",
    "- Machine-verifiable gates",
    "- Worker != grader",
    "- Fresh context per iteration",
    "- Hard budgets",
    "",
    "Stages:",
    "1. Plan — choose ONE scoped tracker issue with acceptance criteria.",
    "2. Act — run a fresh-context worker in its own worktree; one issue -> one branch/worktree -> one PR, with the issue id in the branch.",
    "3. Verify — require npm run check plus the issue's named proof; keep biters/lab review and proof separate from the worker, including the bench/eval gate when that stage owns the evidence.",
    "4. Record — write PR evidence, tracker comment, and a retro packet for the retro generator stage.",
    "5. Stop — stop on budget exhaustion, red gate, or scope widening; hand off through a durable belt doc.",
    "",
    "Gates:",
    "- npm run check",
    "- named per-issue proof",
    "- worker != grader review/proof separation",
    "",
    "Stop conditions:",
    "- budget exhaustion",
    "- red gate",
    "- scope widening",
    "",
    "Roster agents: blueprint, roboports, biters, lab, rocket-launch, belt.",
    "No live actions: this command is offline, read-only, and does not spawn agents or contact trackers.",
  ];
}

export function printLoopContract(output = process.stdout) {
  output.write(`${loopContractLines().join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printLoopContract();
}
