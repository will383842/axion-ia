# RÉCAPITULATIF FINAL — Formation Engine + Qualiopi Manager (T0→T16)

> Autopilot 2026-06-06, équipe multi-agents + colonne vertébrale centralisée.
> Module livré **dark** (flag `OF_PUBLIC_DISCLOSURE_ENABLED=false`), entité **Axion-IA SAS France**.
> Tout sur `main`, poussé au fil de l'eau (chaque push = build GH Actions → déploiement).

## 1. Vue d'ensemble

Back-office complet d'organisme de formation (génération pédagogique IA, gestion
sessions/stagiaires/formateurs, émargement, évaluations, satisfaction, documents
légaux, financements, BPF, 32 indicateurs RNQ V9, réclamations, handicap, veille,
portail stagiaire, mode auditeur, alertes, RGPD), bâti **dans** `axionia`
(Next.js 16 + Prisma 5.22 + Postgres + BullMQ + @react-pdf/renderer + nodemailer
+ @anthropic-ai/sdk + next-intl FR + Tailwind v4 tokens), en réutilisant les
briques existantes (prisma/redis/auth/queue/provider IA/cost-tracker/email/R2),
sans second système parallèle.

## 2. Tranches livrées (toutes ✅, gate vert + poussées)

| T | Objet | Migration | Livrables clés |
|---|-------|-----------|----------------|
| T0 | Fondations transverses | `…120000` | config SiteSetting cat qualiopi, legal-mentions, brand-tokens, numérotation, guards, flag, isolation-check, nav |
| T1 | Référentiel offres_site | `…130000` | 11 offres (prix dérivé pricing.ts), résolveur prix |
| T2 | CRM clients + devis | `…140000` | NAF→OPCO, estimation prise en charge, numérotation |
| T3 | Modèles cœur | `…150000` | Formation/Session/Trainer/Trainee/Enrollment/Transition, fiche publique `/formations/[slug]` |
| T4 | Formation Engine | `…160000` | grille qualité Zod, pipeline BullMQ, cache IA, validation humaine (AI Act 50) |
| T5 | Engine Excellence | (code) | Backward Design, critique adversariale, grille v2 plancher 80 |
| T6 | Sessions & inscriptions | (code) | auto-transitions cron, récurrences, report |
| T7 | Documents légaux | `…170000` | 18 templates react-pdf (mentions exactes, QR, heures centièmes) |
| T8 | Émargement + relevé connexion | `…180000` | PresenceCreneau, parsers Zoom/Teams/Meet, taux présence, archive CSV |
| T9 | Évaluations + attestations auto | `…190000` | EvaluationAcquis, attestation J+1 (complète/partielle/aucune), QR public |
| T10 | Satisfaction + indicateurs + BPF | `…200000` | Questionnaire, calcul indicateurs + cache Redis, dashboard KPIs, BPF CSV |
| T11 | Financements + facturation duale | `…210000` | OPCO/CPF/FT, validations bloquantes, FactureFormation, compta CSV, moyens, sous-traitant |
| T12 | Conformité | `…220000` | 32 indicateurs RNQ V9, réclamations, veille, partenariats, sous-traitants, pilotage 14, mode auditeur |
| T13 | Supports de formation | `…230000` | SupportFormation (7 types), builder + PDF charte, génération IA optionnelle |
| T14 | Portail stagiaire + appréciations | `…240000` | PortailAcces (token→cookie HttpOnly), Appreciation off.30, RGPD export/suppression |
| T15 | Alertes + emails + SSE + RGPD | `…250000` | AlerteSysteme (28 codes), 6 emails auto, SSE temps réel, consentement versionné |
| T16 | Raccordements + audit démo + récap | (aucune) | hub navigation, dossier d'audit de démonstration (seed), reconcile facture PDF, ce récap |

14 migrations Qualiopi additives (timestamps `20260606120000`→`20260606250000`).

## 3. Briques réutilisées (pas de second système)
- Prisma `@/lib/prisma` (stub-aware), Redis `@/lib/redis` (cache indicateurs/pilotage),
  auth `@/auth` + guards knowledge ré-exportés, BullMQ (`formation-crons`, `formation-engine`),
  provider Anthropic + cost-tracker (`content-gen`), `@react-pdf/renderer` (base-layout charte),
  nodemailer + registre email (`renderEmailTemplate`), R2 (`r2-storage`), pii-crypto (handicap AES),
  pricing.ts (SSOT prix), admin-nav, isolation-check.

## 4. Conformité (oracle MATRICE_ACCEPTATION)
- **32 indicateurs RNQ V9** : registre verbatim + `evaluerConformite` (score = couverts/applicables, JAMAIS /22) + matrice UI.
- Trous comblés : off.8 (positionnement T9), off.12 (émargement/relevé T8), off.11 (éval T9),
  off.30 (appréciations multi-parties T14), off.31 (réclamations T12), off.32 (revue direction T12),
  off.17/19/21/22 (moyens/sous-traitants T11/T13), off.23/24/25 (veille/partenariats T12), off.26 (handicap T12/T14).
- DREETS/BPF : agrégats + export CSV (T10). TVA exonérée 261-4-4° CGI, heures centièmes R.6313-3,
  mentions L.6353-1/D.6353-1 (T7). Financements OPCO subrogation/CPF EDOF/France Travail (T11).
- RGPD : consentement versionné, anonymisation (soft-delete), chiffrement handicap AES-256-GCM, export.
- Mode auditeur : manifeste JSON+Markdown par indicateur ; **dossier d'audit de démonstration** seedable (T16).

## 5. Garde-fous respectés (protègent Will)
1. `OF_PUBLIC_DISCLOSURE_ENABLED` reste **false** — module ships dark, aucune fuite publique financement.
2. Migrations **100 % additives** (zéro DROP, colonnes nullables / defaults). Contrat build `stub.invalid` intact.
3. Mentions légales = placeholders `SiteSetting` cat. qualiopi (à remplir par Will). Zéro identifiant inventé.
4. Zéro valeur en dur (tokens, pricing.ts, getQualiopiConfig). Zéro TODO/stub résiduel.
5. Entité **Axion-IA SAS France** partout (zéro OÜ).
6. Cloisonnement strict `**/qualiopi/**` + zones dédiées (isolation-check au vert, gate `verify:all`).

## 6. Qualité
- ~**1290 tests Qualiopi** verts (unit + render PDF + actions) ; suite complète du repo en filet.
- Gate par tranche : typecheck (heap 8 Go), vitest qualiopi, isolation-check, i18n:check, anti-hex, lint — TOUS verts avant chaque push.
- Chaque appel IA réutilise prompt caching + cost-tracker ; jobs idempotents ; emails idempotents.

## 7. À la main de Will (hors code)
- Renseigner les placeholders légaux (`SiteSetting` cat qualiopi) : NDA, n° Qualiopi, SIRET, adresses, référent handicap, RIB, plafonds OPCO réels.
- Certificateur Qualiopi = tiers externe (audit). Lignes spec `[À CONFIRMER V9]` (7,13,20,27,29) à valider contre PDF officiel + certificateur.
- Quand prêt : passer `OF_PUBLIC_DISCLOSURE_ENABLED=true` (Phase B) après NDA + certification.
- `pnpm qualiopi:seed` (config + offres + grille) et `pnpm qualiopi:seed-demo` (dossier d'audit de démonstration) en console.

## 8. Risques résiduels / dette connue
- Numéro séquentiel non rendu dans l'en-tête de certains PDF (design documents-service render-then-number) — cosmétique.
- Mode auditeur = manifeste (pas de binaire ZIP — aucune lib ajoutée ; décision lib à valider par Will si export ZIP voulu).
- Plafonds/tarifs OPCO = valeurs config par défaut (à ajuster par OPCO réel).
- EN reste désactivé (décision produit) — tout le module est FR.

## 9. Prochaines étapes suggérées
- Remplir les SiteSetting légaux + lancer `qualiopi:seed-demo` pour la revue auditeur.
- Sprint e2e Playwright sur les flux critiques (inscription→attestation, émargement→clôture, portail, vérif QR).
- Activer EN (si bug next-intl fixé) pour la citabilité IA.
