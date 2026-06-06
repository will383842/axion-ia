# PLAN DE REMÉDIATION — Qualiopi E2E · 2026-06-06

Trié par (bloquant audit ✕ effort). Statut : ✅ fait & vérifié · ⏳ à faire · ❓ décision Will.

## ✅ FAIT (PHASE B, vérifié vert + déployé/commité)

- **R2 — Convention tripartite OPCO bloquante** (subrogation sans tripartite signée → bloque démarrage)
  + saisie date tripartite en UI. Commit `5ecb55c7`. ✅ typecheck + tests verts.
- **R3 — 3 preuves POEI saisissables en UI** (`SetFinancementForm` + schéma action). Commit `5ecb55c7`. ✅
- **R6 — RECLASSÉ NON-ISSUE** : la page `/verifier-attestation/[token]` fait un `findUnique` sur un token
  256 bits via index unique = pattern standard sûr (comme un token reset-password). Une attaque temporelle
  n'est pas exploitable sur un token non-devinable trouvé par correspondance exacte ; ajouter `verifyQrToken`
  par-dessus n'apporte aucun gain et empêcherait l'index. **Aucun changement.**
- **R11 — REQUALIFIÉ FEATURE** : `Devis` n'a ni `formationId` ni `sessionId` (juste `clientId` + `lignes`
  JSON) → « devis→convention » ne peut PAS créer mécaniquement une session (besoin formation+dates).
  Implémentation correcte = flux UX guidé (marquer `transforme_convention` + créer session préremplie
  clientId/devisId). À faire en passe dédiée.

- **G1 — Seed grille au runtime + engine fail-loud.** 3 fichiers :
  `qualiopi-formation-engine-worker.ts` (throw si grille null),
  `prisma/migrations_fts/20260606300000_qualiopi_grille_seed.sql` (INSERT idempotent runtime),
  `src/server/qualiopi/engine/grille-seed-sql.spec.ts` (anti-drift SSOT).
  → **Reste à déployer** (push = deploy ; boot-test prod recommandé : vérifier au 1er boot le log
  `[entrypoint] FTS setup applied: …grille_seed.sql` + `SELECT count(*) FROM grille_qualite_configs WHERE actif`).

## ⏳ À FAIRE — hardening confirmé, faible risque (recommandé avant audit)

| # | Trou | Fichier | Correctif | Effort |
|---|---|---|---|---|
| R1 | Clôture session sans garde émargement (manuelle) | `actions/qualiopi/sessions.ts:217` | Brancher un check `emargementSigneAt`/`tauxPresencePct` sur `toStatus==="realisee"` (cf. F2 — dépend décision ❓) | 2 h |
| R2 | OPCO convention tripartite non bloquante avant démarrage | `financements/validation-service.ts:62`, `getFinancementValidations` | Ajouter `validateOpcoConventionTripartite` (critique si `opco` + `planifiee` + `conventionTripartiteSigneeAt` null) + test | 2 h |
| R3 | Champs POEI non saisissables en UI | `components/admin/qualiopi/SetFinancementForm.tsx`, `actions/qualiopi/financements.ts` (zod) | Exposer `ftPoeiOffreEmploiNumero/AccordFinancementAt/EngagementSigneAt` (conditionnel POEI) + schéma | 3 h |
| R4 | RAC CPF non câblé au SiteSetting | nouveau `financements/cpf-rac.ts` + générateur kit CPF | `getQualiopiConfig("cpf_reste_a_charge")` → `KitCpfData.resteAChargeCents` | 2 h |
| R5 | Gate revue direction non bloquante / off.32 sans `validee` | `conformite/conformite-service.ts:317`, `registres/revue-direction` | off.32 couvert seulement si `nbRevues>0 && statut==="validee"` + alerte critique si absente année courante | 3 h |
| R6 | `verifyQrToken` timing-safe non utilisé dans la page | `app/[locale]/verifier-attestation/[token]/page.tsx` | Utiliser `verifyQrToken` (qr.ts:40) ou documenter le findUnique (token 256 bits) | 1 h |
| R7 | Numérotation `count+1` non atomique (FORM/SESS/devis) | `formations/numbering.ts`, `actions/qualiopi/devis.ts:81` | Wrapper retry P2002 (comme `documents-service.ts`) OU séquence Postgres | 3 h |
| R8 | Parité fidélité PDF — polices absentes de `public/fonts/` | `public/fonts/`, `documents/fonts.ts` | Ajouter les .ttf (Fraunces/Manrope/Inconsolata) au repo+image ou assumer Geist (charte) ❓ | 2 h |

## ⏳ À FAIRE — features (plus gros)

| # | Trou | Effort |
|---|---|---|
| R9 | **CRUD `Trainer` + page admin `/qualiopi/formateurs` + blocage assignation si non habilité** (F4) | ~1-2 j |
| R10 | **CRUD admin `Trainee` + chiffrement PII systématique** (F5) | ~1 j |
| R11 | **M10 — action `transformDevisToConventionAction`** (devis accepté → session `planifiee` + `transforme_convention`) + bouton UI (F3) | ~0,5 j |
| R12 | Compléter couverture audit domaine 21/22 (token portail timing-safe, irréversibilité anonymisation RGPD) puis fix éventuels | ~0,5 j audit |

## ❓ DÉCISIONS WILL (voir QUESTIONS-WILL.md) — bloquent certains items ci-dessus

F1 (anti-hallucination bloquant ?), F2/R1 (politique clôture émargement), off.29 applicabilité,
off.20 personnel dédié, portée certifiante RS/RNCP, polices PDF (R8).

## Garde-fous respectés

Migrations additives idempotentes (0 DROP) · contrat `stub.invalid` intact · SSOT pricing/registry
non dupliqué (grille = config par défaut, drift-testée) · isolation-check 0 violation · aucun push.
