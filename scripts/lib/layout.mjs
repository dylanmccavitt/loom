// Central layout module per ADR 0004 Decision 4. Keep active path defaults here so
// renderers, validators, and tests share one source of truth for lane paths.


export const nucleusRoot = "nucleus";
export const nucleusSkillsRoot = "nucleus/skills";
export const nucleusUtilitiesRoot = "nucleus/utilities";
export const operatorLocalSkillsRoot = "~/.agents/skills";
export const operatorLocalManifestPath = "docs/skills/operator-local-manifest.md";
export const nucleusAgentsRoot = "nucleus/agents";
export const sharedAgentContractPath = "nucleus/agents/shared-nucleus-agents.json";
export const sharedAgentContractMarkdownPath = "nucleus/agents/shared-nucleus-agents.md";

// Rendered compatibility surface for the OMP harness. This is intentionally a
// destination/compat surface, not a second canonical skill source.
export const compatSkillsRoot = ".agents/skills";

