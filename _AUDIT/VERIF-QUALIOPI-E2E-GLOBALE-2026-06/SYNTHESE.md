# SYNTHÈSE — Vérification E2E globale Formation Engine + Qualiopi (2026-06-07)

> Audit adversarial + **correction autopilot**. Méthode : inventaire exhaustif extrait du code
> (275 lignes `COUVERTURE.md`) → 5 agents d'analyse statique par cluster → **re-vérification
> personnelle au RUNTIME** (probes tsx contre Postgres dev réel) → correction des bugs au fil de l'eau
> → CI Gate A complète.

## Verdict global : **GO sous conditions** (les conditions sont des DONNÉES, pas du code)

Le système est **réel, câblé, testé et désormais sans le trou bloquant de boot**. Après correction des
7 bugs trouvés, **aucun défaut logiciel ne bloque la mise en production**. Les seuls blocages restants à
une **vente réelle financée** sont des **valeurs légales à saisir par Will** (NDA, SIREN, barèmes OPCO,
codes RS/RNCP) et **2 décisions produit** — pas du code.

## Le trou bloquant (comme l'audit précédent, 1 P0 malgré une suite verte)

🔴 **P0 — Le seed auto du référentiel throw silencieusement au boot.** L'« unification du seed
(auto-boot + bouton admin) » du commit `d708c714` utilisait `pg_try_advisory_lock(bigint, bigint)`,
signature **inexistante** en Postgres. Le fail-soft de `instrumentation.ts` avalait l'erreur → **en prod,
sur DB neuve, offres_site + config + grille v2 restaient VIDES**. Les specs ne l'ont jamais vu (elles
mockent `$queryRaw`). **Trouvé au 1ᵉʳ appel runtime**, corrigé (cast `::int4`), re-prouvé en clean-room
(offres 0→11, config 0→30, grille v2). C'est exactement le piège « seed runtime » annoncé au §1.3.

## Bugs corrigés (7) — tous vérifiés

| | Sév | Bug | Preuve du fix |
|--|-----|-----|---------------|
| C1 | 🔴 P0 | Seed auto cassé (advisory lock) | RUNTIME clean-room |
| C2 | 🔴 P0 | Clôture cron sans garde émargement | +3 specs |
| C3 | 🟠 P1 | Facture session-level non atomique | typecheck+specs |
| C4 | 🟠 P1 | Certificat émis pour abandon/exclu | +2 specs |
| C5 | 🟠 P1 | RGPD : accès portail non révoqués à l'anonymisation | +1 spec |
| C6 | 🔵 P3 | Liens nav hub erronés | revue |
| C7 | 🔵 P3 | Titre `Financement — null` | revue |

## Tableau de bord

| Domaine | État |
|---------|------|
| Seed/boot | ✅ corrigé + RUNTIME |
| Gardes financement (OPCO/CPF/FT) | ✅ bloquantes (RUNTIME probe04) |
| Machine à états session | ✅ RUNTIME (5+5) |
| 19 templates PDF | ✅ %PDF (38 tests) |
| 40 pages admin + RBAC | ✅ null-safe + auth/rôle |
| Portail / RGPD / AI Act | ✅ (C5 corrigé) |
| Conformité 32 indicateurs | 13 réelles, 15 proxy (décisions), 4 N/A ; off.32 gaté |
| Registres / BPF / pilotage | ✅ réels |
| Mocks/TODO en prod | ✅ aucun |

## Verdict par organisme (détail `ORGANISMES.md`)
PRÊT (code) : France Travail, CPF, Fisc (TVA 261-4-4°), CNIL/AI Act. PARTIEL (données/décisions) :
DREETS/BPF, Qualiopi/RNQ, France Compétences, OPCO. **Aucun NON-PRÊT logiciel.**

## Ce qui bloque encore une vente réelle financée (non-code)
1. Saisir les valeurs légales (`/qualiopi/config`) : NDA, SIREN, n° Qualiopi, barèmes OPCO, RS/RNCP, IBAN.
2. Trancher 2 décisions : anti-hallucination bloquante (F1) ; applicabilité off.29.
3. Acter au registre RGPD la rétention des PDF post-anonymisation.
4. Mettre `OF_PUBLIC_DISCLOSURE_ENABLED=true` une fois les valeurs saisies.

## Couverture de l'audit
`COUVERTURE.md` = **275/275 (100 %)**, aucune ligne ⬜. Chaque server action, page, template, worker,
transition, dispositif, garde, indicateur a un statut. Trous R1–R12 de l'audit précédent re-statués
(R7 complété sur la facture session-level ; clôture émargement complétée côté cron).
