# Test 11 — RGPD droit à l'oubli endpoint
## Date : 2026-05-22 — mode AUDIT-ONLY

## Endpoint erasure
src/app/api/gdpr-erase
src/app/api/gdpr-erase/route.ts

## /fr/mes-donnees page
export
page.tsx

## Audit trail SOC2
prisma/schema.prisma:976:/// B.4 P1.5 — Traçabilité provenance IA par article (AI Act art. 50 + SOC2).
prisma/schema.prisma:2445:model KnowledgeAuditLog {
prisma/schema.prisma:2464:  @@map("knowledge_audit_log")
prisma/schema.prisma:2716:/// City Domination 2026-05-18 P1-9 (audit A10) — Audit trail SOC2 immuable
prisma/schema.prisma:2722:/// Conservation : append-only sans purge automatique (legal hold SOC2).
prisma/schema.prisma:2725:model ContentGenAuditLog {
prisma/schema.prisma:2751:  @@map("content_gen_audit_log")
src/server/actions/content-gen/brand-voice.ts:7: *   Trace dans ContentGenAuditLog (SOC2).
src/server/actions/content-gen/brand-voice.ts:10: *   Retourne les stats de dérive des 30 derniers jours depuis ContentGenAuditLog.
src/server/actions/content-gen/brand-voice.ts:48: *  - ContentGenAuditLog (SOC2 audit trail)
