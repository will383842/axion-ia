# DOMAINES N0→N5 — Qualiopi E2E · 2026-06-06

N0 schéma · N1 service · N2 action · N3 UI câblée · N4 testé · N5 conforme.
Verdict : ✅ complet · 🟡 partiel · 🔴 manquant · ➖ non applicable assumé.

| # | Domaine | N0 | N1 | N2 | N3 | N4 | N5 | Verdict | Preuve / maillon faible |
|---|---|----|----|----|----|----|----|---------|---|
| 1 | Config SiteSetting + flag phase | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | `config/flag.ts`, `registry.ts` — flag hors `env.ts` (assumé) |
| 2 | Numérotation séquentielle | ✅ | 🟡 | 🟡 | ➖ | ✅ | 🟡 | 🟡 | `numbering/formats.ts` — `count+1` non atomique (R7) |
| 3 | Mentions légales verbatim | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `legal/legal-mentions.ts` — articles exacts |
| 4 | Brand/charte parité | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | `brand/brand-tokens.parity.spec.ts` |
| 5 | Offres SSOT pricing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `offres/pricing-resolver.ts` — 0 prix en dur |
| 6 | CRM clients | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡 | `crm/clients.ts` — pas d'action suppression PII admin |
| 7 | Devis | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡 | `crm/devis.ts` — M10 non automatisé (R11) |
| 8 | Formations (CRUD+cycle) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `formations/formations.ts:269` publish gardé |
| 9 | Formation Engine | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡→✅* | grille null→100 (G1 **corrigé**) ; anti-hallu warning (F1) |
| 10 | Sessions (états/récurrence) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | clôture sans garde émargement (R1/F2) |
| 11 | Formateurs (Trainer) | ✅ | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | modèle seul ; 0 CRUD/UI/habilitation (R9) |
| 12 | Stagiaires (Trainee) | ✅ | 🟡 | 🔴 | 🔴 | 🟡 | 🔴 | 🔴 | pas de CRUD admin ; PII via portail seul (R10) |
| 13 | Inscriptions (Enrollment) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | câblé dans UI session ; pas de page dédiée |
| 14 | Documents PDF (18 templates) | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | 18 templates ; 7 sans test rendu PDF |
| 15 | Présence (émargement+import) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | parsers Zoom/Teams/Meet testés ; clôture R1 |
| 16 | Évaluations + attestations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | seuils 80/60 codés+testés (`taux.ts:43`) |
| 17 | Satisfaction + indicateurs | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 | publié public gated par flag (Phase A) |
| 18 | Financements + facturation + TVA | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 | cas bloquants OK ; POEI UI (R3), tripartite (R2), RAC CPF (R4) |
| 19 | Conformité 32 ind. + ZIP + pilotage | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ZIP réel ; off.29 proxy faux (R5/Q4), off.20 faible |
| 20 | Registres (récl./veille/part./ST/revue) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | gate revue direction non bloquante (R5) |
| 21 | Portail stagiaire + RGPD + auditeur | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | token timing-safe+90j+révoc ; anonymisation irréversible |
| 22 | Alertes + emails + crons BullMQ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 8 crons enregistrés (`queues.ts:1001`) |

\* Domaine 9 : le trou N5 bloquant (grille contournée) est corrigé en PHASE B (G1) ; reste F1 (anti-hallucination) = décision Will.

## Lecture

- **Verts (✅) : 8** — 3,4,5,8,14,16,21,22.
- **Partiels (🟡) : 11** — corrigeables par R1-R7 + décisions.
- **Manquants (🔴) : 2** — formateurs (11), stagiaires admin (12) = features R9/R10.
- **Domaine 9** : passé de 🔴 (silencieux) à conforme après G1, sous réserve F1.
