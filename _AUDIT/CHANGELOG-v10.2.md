# CHANGELOG v10.2 — Passe contradictions

**Date** : 2026-05-06
**Décision Will** : Q1=a (patch d'abord) + précision « il y a tout maintenant ».
**Conclusion** : passe **documentaire** uniquement — aucune modification de .docx requise.

---

## Constat

Les **16 contradictions** détectées Phase 0 (`_AUDIT/00-fiches-lecture.md` §6) ont déjà été **résolues à la source** par les artefacts de référence postérieurs à l'audit :

| #   | Contradiction                                                                | Résolution actuelle                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Resend INTERDIT                                                              | `CLAUDE.md` v6 §6 + §11 + §12 ; `axionia-core/SKILL.md:194-195` ; `axionia-i18n/SKILL.md:297` ; `axionia-forms/SKILL.md` frontmatter ; wireframes `00-README:103` + `08-Console-Admin:717` |
| 2   | Stockage Hetzner Storage Box uniquement                                      | `CLAUDE.md` v6 §12 (`HETZNER_STORAGE_*`) ; `axionia-database/SKILL.md:467`                                                                                                                 |
| 3   | Auth.js v5 (pas NextAuth.js 5)                                               | `CLAUDE.md` v6 §6 + §22                                                                                                                                                                    |
| 4   | Perf budgets stricts (LCP<1.8 / INP<80 / CLS<0.05 / JS<80kb / Lighthouse>95) | `CLAUDE.md` v6 §8 + §16                                                                                                                                                                    |
| 5   | Animation `motion` (pas Framer Motion)                                       | `CLAUDE.md` v6 §6 + §22                                                                                                                                                                    |
| 6   | Mot « formation/former » banni                                               | `CLAUDE.md` v6 §2 + §20                                                                                                                                                                    |
| 7   | Header sans dropdown                                                         | `CLAUDE.md` v6 §9                                                                                                                                                                          |
| 8   | Module 3 = Implémentation IA                                                 | `CLAUDE.md` v6 §4 + §5 + §22                                                                                                                                                               |
| 9   | Tags Telegram `[OPTION CONFIRMÉE]`                                           | `CLAUDE.md` v6 §11                                                                                                                                                                         |
| 10  | Droit estonien CGV                                                           | `CLAUDE.md` v6 §1 + §5 + §22                                                                                                                                                               |
| 11  | AKI (pas CNIL)                                                               | `CLAUDE.md` v6 §22 (note doc 28)                                                                                                                                                           |
| 12  | Charte Webflow-inspired actée                                                | `CLAUDE.md` v6 §7 + ADR 0001 + `Design.md` racine                                                                                                                                          |
| 13  | Variables d'env complètes                                                    | `CLAUDE.md` v6 §12                                                                                                                                                                         |
| 14  | Plausible self-hosted (pas GA4)                                              | `CLAUDE.md` v6 §6 + §12                                                                                                                                                                    |
| 15  | Phasage 13 phases                                                            | `CLAUDE.md` v6 §19 + `_AUDIT/02-PLAN.md` (M1-M11)                                                                                                                                          |
| 16  | Calendrier maison uniquement                                                 | `CLAUDE.md` v6 §11 + §22                                                                                                                                                                   |

## Hiérarchie de décision (rappel)

Définie dans `CLAUDE.md` v6 §header :

1. `axionia-package/docs/_DECISIONS-FINALES.md` (06/05/2026) — source de vérité ultime
2. `CLAUDE.md` v6 — fait foi sur les .docx
3. Skills `axionia-*` — canon métier
4. Skills génériques cadenassés par les 22 LOCKs (`CHANGELOG-LOCKS.md`)
5. .docx historiques — **archives de référence**, contenu subordonné aux niveaux 1-4 en cas de conflit

## Statut des .docx résiduels

Les 15 .docx mentionnés dans les ÉCARTs Phase 0 conservent leur texte historique. **Aucune modification appliquée**, conformément à la directive Will « il y a tout maintenant » : la complétude documentaire est atteinte par CLAUDE.md v6 + skills + wireframes + ADR. Les .docx restent des archives.

Backup conservé : `_backup_pre_v10.2/` contient déjà 5 .docx critiques (09, 10, 13, 14, 16) — disponible pour audit de traçabilité.

## Action immédiate

→ **Sprint 0 démarre** sur la base de :

- `CLAUDE.md` v6 (référence quotidienne)
- `_DECISIONS-FINALES.md` (autorité ultime)
- `Design.md` racine (doctrine visuelle Webflow-inspired)
- ADR `docs/adr/0001-design-direction-webflow.md`
- Skills `axionia-*` (canon métier)
- `_AUDIT/02-PLAN.md` (jalons M1-M11)
