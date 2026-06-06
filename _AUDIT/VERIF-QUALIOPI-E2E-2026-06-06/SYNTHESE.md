# SYNTHÈSE — Audit E2E Formation Engine + Qualiopi Manager · 2026-06-06

> Audit adversarial (PHASE A) + remédiation autopilot ciblée (PHASE B). Méthode :
> inventaire factuel → harnais → fan-out 7 sous-agents par domaine → **re-vérification
> personnelle** des trous critiques (lecture code réelle, `fichier:ligne`).

## Verdict global

**Le système est largement RÉEL, câblé et testé** — il n'est PAS un squelette. 22 domaines
présents, ~32 pages admin, 18 templates PDF réglementaires, 32 indicateurs RNQ V9 registrés,
crons BullMQ enregistrés, 1460 tests qualiopi verts, typecheck repo vert, isolation-check 0/8064.

**MAIS l'audit a trouvé 1 trou bloquant de déploiement (corrigé) + un lot de trous fonctionnels
partiels / décisions produit à trancher par Will.**

| Harnais (PHASE 0) | Résultat |
|---|---|
| `prisma validate` | ✅ schéma valide |
| `typecheck` (repo complet) | ✅ exit 0 |
| `qualiopi:isolation-check` | ✅ 0 violation / 8064 fichiers |
| `vitest` périmètre qualiopi | ✅ 85 fichiers / 1460 tests verts |
| Migrations T0→T18 | ✅ 17 migrations additives, 0 DROP |

## 🔴 Trou BLOQUANT trouvé ET CORRIGÉ en PHASE B (vérifié vert)

**G1 — La grille qualité n'était jamais seedée au déploiement → contrôle qualité ≥80/100
contourné silencieusement en prod.**

- Preuve : `prisma/migrations/20260606160000_qualiopi_t4_formation_engine/migration.sql`
  crée la table `grille_qualite_configs` **VIDE** (DDL only, 0 INSERT). Le seed
  (`prisma/seeds/qualiopi/index.ts:59`) ne tourne que via `pnpm qualiopi:seed` (tsx),
  **absent du runtime Docker**. `scripts/docker-entrypoint.sh` lance `migrate deploy` +
  `migrations_fts/*.sql` mais **jamais** le seed qualiopi.
- Conséquence prod : `getActiveGrille()` → `null` →
  `qualiopi-formation-engine-worker.ts:562` retournait `scoreGlobal:100, valide:true`
  (« évaluation dégradée ») → **toute formation IA certifiée « qualité OK » sans aucune
  évaluation**. Même classe que le piège connu `kb_fts_setup.sql`.
- **Correctif appliqué (3 fichiers, tests verts)** :
  1. `qualiopi-formation-engine-worker.ts` — **fail-loud** : grille absente → `throw`
     (job visible en échec) au lieu de certifier une qualité non vérifiée.
  2. `prisma/migrations_fts/20260606300000_qualiopi_grille_seed.sql` — **seed runtime
     idempotent** (`INSERT … ON CONFLICT (cle_unique) DO NOTHING`, `uuid_generate_v4()`,
     dollar-quoting), appliqué au boot par l'entrypoint existant. La grille existe donc
     en prod → le fail-loud ne se déclenche pas en fonctionnement normal.
  3. `src/server/qualiopi/engine/grille-seed-sql.spec.ts` — **test anti-drift** : le JSON
     SQL doit rester identique à `DEFAULT_GRILLE_CRITERES` (SSOT).
- ⚠️ **Non poussé** : `push main = deploy`. Cette correction touche le boot prod et ne peut
  pas être boot-testée ici → confirmation Will requise (cf. `QUESTIONS-WILL.md`).

## 🟡 Trous fonctionnels confirmés (vérifiés par moi) — NON corrigés (décision/feature)

| # | Domaine | Trou (preuve) | Nature |
|---|---|---|---|
| F1 | Engine | Anti-hallucination **warning-only** (`…worker.ts:833`) — allégations non sourcées n'empêchent pas la publication | Décision Will : bloquer ou non |
| F2 | Sessions | Clôture `en_cours→realisee` (manuelle `sessions.ts:217` ET cron `crons.ts:70`) **sans garde émargement** ; seule l'alerte R03 post-hoc le signale | Décision : garder auto-clôture+alerte, ou bloquer |
| F3 | CRM | **M10 Devis→Convention** non automatisé : aucun code ne pose `transforme_convention` ni ne crée la session depuis un devis accepté (`devis.ts:157` = simple garde). Contournable manuellement (session + `devisId`) | Feature (chaînon UX) |
| F4 | Formateurs | **Aucun CRUD `Trainer`, aucune page admin `/formateurs`, aucun blocage d'assignation si non habilité** (modèle existe en schéma, 0 service/action/UI) | Feature (~1-2j) |
| F5 | Stagiaires | **Aucun CRUD admin `Trainee`** (création seulement via portail handicap). Chiffrement PII non garanti hors portail | Feature (~1j) |

## 🟡 Trous rapportés par les sous-agents (à re-confirmer avant fix)

OPCO convention tripartite non bloquante avant démarrage ; champs POEI non saisissables en UI
(`SetFinancementForm`) ; reste-à-charge CPF non câblé au SiteSetting ; off.29 = proxy `nbSessions`
(preuve insertion insuffisante) ; gate revue de direction non bloquante (off.32 « couvert » sans
`statut=validee`) ; `verifyQrToken` timing-safe non appelé dans la page (findUnique DB) ;
numérotation `count+1` non atomique (FORM/SESS/devis) ; polices PDF (Fraunces/Manrope/Inconsolata)
absentes de `public/fonts/` → fallback Geist ; `OF_PUBLIC_DISCLOSURE_ENABLED` hors `env.ts`
(décision documentée). Détail + sévérité + correctif → `PLAN-REMEDIATION.md`.

## ✅ Fausses alertes écartées (vérifiées)

- **Crons orphelins** : FAUX — 8 jobs répétables formation enregistrés dans `bootRepeatableJobs`
  (`queues.ts:1001-1056`), worker démarré (`worker.ts:52`), idempotents. (M2 OK)
- **Engine = stub IA** : FAUX — appels Anthropic réels via `content-gen/providers/anthropic`.
- **Validation humaine décorative** : FAUX — `FileValidation` bloque le pipeline +
  `publishFormationAction` exige `validatedBy` (`formations.ts:269`).
- **Mentions légales / TVA / heures centièmes / cas bloquants financement (subrogation sans n°
  dossier, CPF sans EDOF, POEI 3 preuves)** : tous bloquants au niveau service, vérifiés.

## Couverture de l'audit

Domaines 1-20 + M1-M10 couverts. **Domaine 21/22 (portail token / RGPD anonymisation /
appréciations) partiellement couvert** : le sous-agent dédié a échoué sur une limite de session ;
M2 (crons) et M3 (seeds) ont été vérifiés par moi, mais le token portail timing-safe + l'irréversibilité
de l'anonymisation RGPD restent à re-vérifier (cf. `PLAN-REMEDIATION.md` §coverage).

## Score

- **Complétude réelle** : ~18/22 domaines verts ou quasi (4 partiels : formateurs, stagiaires,
  devis→convention, financement-UI/tripartite).
- **Conformité** : 30/32 indicateurs avec preuve correcte ; off.20 et off.29 = proxys faibles.
- **Prêt audit Qualiopi ?** **Pas encore** sans : (a) déploiement du fix G1, (b) décisions Will F1-F2,
  (c) CRUD formateur (F4, attendu par un certificateur), (d) re-confirmation financement/conformité.
