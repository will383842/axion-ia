# Content Generator Skill — Axion-IA

Skill packaging for the Axion-IA content generator outil. Provides Claude Code with a structured invocation point that loads the master BUILD spec on demand.

## Files

| File | Role |
|---|---|
| `SKILL.md` | Skill entry point with frontmatter (`name`, `description`). Loaded automatically by Claude Code when triggered. |
| `README.md` | This file — human overview. |
| `prompts/` | Sub-prompts per content type (loaded by generators at runtime). |
| `checklists/` | Actionable checklists (SEO/AEO 60+ items, Web Vitals, EXIT V1). |
| `references/` | Canonical references (Manon Person, doctrine extract, KB read-only contract). |

## How to invoke

Type `/content-generator` in Claude Code (auto-discovered from `.claude/skills/`) or paste the invocation phrase from `SKILL.md` section « Invocation phrase ».

## Source of truth

The skill is a **pointer**, not the spec. The actual spec is:

1. `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` — master BUILD prompt (~30 000 words, 23 sections)
2. `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md` — data model (acted Will 2026-05-08)
3. `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` — KB tool (to be created, separate)

If you change behaviour, edit the master prompt **first**, then bump version line, then update this skill only if the trigger conditions or layout change.

## Version

- v1.0 — initial skill packaging (2026-05-13)
- References master prompt v1.3 (FR-only + Manon + audit-fix + génération-speed + Claude Code skill)
