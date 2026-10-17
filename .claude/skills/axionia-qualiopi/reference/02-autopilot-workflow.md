# 02 — Workflow autopilot de bout en bout

Objectif : implémenter le v1 ambitieux complet **sans supervision ligne à ligne**, avec une qualité
prouvée à chaque étape. Le principe directeur : **petites tranches verticales, chacune vérifiée et
réconciliée avant la suivante** — jamais de dette accumulée, jamais de big-bang non testé.

---

## Pré-vol (AVANT la Phase 0) — état du repo vivant

Lire `reference/04-strategic-positioning-and-preflight.md`. Avant toute migration :

- `git fetch` + `git log origin/main..HEAD` + `git status` (working tree partagé ; **push = deploy**).
- **Chantier backup/DR (ADR 0032) potentiellement non commité** → bloque `prisma generate` / numérotation
  de migrations. **Coordonner avec Will** avant de créer la 1ʳᵉ migration Qualiopi (ne pas mélanger les
  deux chantiers dans un commit).
- Ne pas toucher `/interventions/*` (refonte récente) ; réutiliser ses composants.

## Phase 0 — Grounding (AUCUN code)

1. **Lire le code réel** d'`axionia` (cf. `reference/01`) : `package.json`, `prisma/schema.prisma`
   (modèles clés), `globals.css` (tokens), `admin-nav.ts`, `admin-path.ts`, un Server Action de
   référence (`booking/*`), un worker BullMQ, le provider IA `content-gen`, `pricing.ts`,
   `interventions.ts`, `routing.ts`, `src/lib/email/*`, `docuseal.ts`, un PDF React-PDF existant.
2. **Lire les 5 specs** (PART1→PART5) + la **matrice d'acceptation** + les modèles Word A1–A18 / B1–B5.
3. **Extraire la taxonomie réelle** des interventions/offres (routes + pricing + copy) → base du
   référentiel `offres_site`.
4. **Produire le RAPPORT D'EXPLORATION** (obligatoire, aucun code avant) :

```
RAPPORT D'EXPLORATION
- Stack confirmée (versions exactes lues dans package.json)
- Briques réutilisables (chemin:ligne) : prisma, redis, auth, RBAC, queue, IA+cost-tracker, PDF, email, docuseal, storage, admin-nav
- Modèles Prisma existants pertinents + champ trainingSessionId (ligne)
- Tokens design réels (mapping terracotta/bleu/ivoire/mocha/fonts) + écarts éventuels
- Taxonomie offres réelle extraite (intitulé, durée, public, prix SSOT, modalités)
- Décision d'architecture : modèles Qualiopi dédiés ↔ réutilisation Booking/Quote/Invoice/Contract
- Conflits spec↔réalité + décisions prises (mapping reference/01 §9)
- Liste des 8 ambiguïtés → STOP & ASK groupé AVANT Phase 1
- Plan de tranches verticales (ordre + dépendances) + couverture matrice
```

## Phase 0.5 — Lock de l'oracle d'acceptation

Ouvrir `MATRICE_ACCEPTATION_AUTOPILOT.md`. Pour **chaque** ligne (22 indicateurs Qualiopi + DREETS/BPF +
OPCO/subrogation + CPF/EDOF + France Travail + obligations site + RGPD), confirmer qu'il existe un
**artefact logiciel planifié** et un **test planifié**. Toute ligne sans preuve/test planifiés = trou à
combler dans le plan de tranches. **C'est l'oracle de « done » : rien n'est terminé tant que sa ligne de
matrice n'est pas verte (artefact livré + test au vert).**

## Phase 1 — Plan en tranches verticales

Ordonner par dépendance. Une **tranche verticale** = une capacité métier livrée de bout en bout
(schéma Prisma → Server Action(s) → UI admin + page publique si besoin → document/PDF/email →
tests → entrée `admin-nav` → doc). Ordre recommandé (à adapter au rapport) :

```
T0  Fondations transverses : config via **`SiteSetting` (catégorie `qualiopi`)** + helpers
    get/setQualiopiConfig (seeds : SMIC, CPF, NDA, Qualiopi, SIRET, adresses, référent handicap, plafonds
    OPCO) ; `legal-mentions.ts` ; **`brand-tokens.ts`** SSOT (PDF/email) ; numérotation séquentielle ;
    guards `_guards.ts` (ré-export knowledge) + `logQualiopiActivity` (ActivityLog) ; flag
    **`OF_PUBLIC_DISCLOSURE_ENABLED`** (env + helper) ; `qualiopi:isolation-check` ; entrée `admin-nav`
    "Formation/Qualiopi".
T1  Référentiel offres_site (depuis taxonomie réelle) + lien obligatoire formation→offre.
T2  CRM clients (SIRET/NAF→OPCO) + devis (réutiliser Quote/ContractDocument).
T3  Modèles cœur : Formation, TrainingSession, Trainer, Trainee, Enrollment (+ lien Booking.trainingSessionId).
T4  Formation Engine : grille qualité (Zod), pipeline BullMQ (structure→éval→raffine→validation
    humaine→contextualisation→assemblage→export), cache_ia, file_validation, traçabilité coûts.
T5  Formation Engine EXCELLENCE (PART5 D) : Backward Design, persona, critique adversariale,
    anti-hallucination, fil rouge, synthèses ≤45 min, livrables progressifs, score plancher ≥ 80.
T6  Sessions & inscriptions : machine à états + auto-transitions (cron/worker J-7/J-5/J±0/J+1/J+30).
T7  Documents légaux (React-PDF) : convention(+tripartite), convocation, émargement, relevé connexion,
    positionnement, grilles éval, satisfaction, attestation(+partielle), certificat réalisation, factures,
    kits OPCO/CPF/FT, lettre de mission. Mentions exactes + QR + signed URLs + filigrane COPIE.
T8  Émargement présentiel + import relevé connexion Zoom/Teams (parsing, consolidation, taux présence).
T9  Évaluations des acquis + attestations auto J+1 (partielle 60-79 %, aucune <60 %) + QR public.
T10 Satisfaction (chaud/froid/positionnement) + calcul indicateurs + cache Redis + dashboard KPIs.
T11 Financements : OPCO (calcul + subrogation tripartite bloquante), CPF/EDOF (reste à charge, alerte
    bloquante CPF sans EDOF), France Travail (AIF/POEI/CSP workflow) + facturation OF.
T12 Conformité : 22 indicateurs (service + page), registre réclamations, référent handicap, veille,
    partenariats, sous_traitants_of, BPF (agrégats + dépenses + export), mode auditeur + dossier ZIP.
T13 Supports de formation (slides formateur/stagiaire, livret, mémo, guide, exercices, éval) à la charte.
T14 Portail stagiaire (token→cookie HttpOnly, attestations, satisfaction, handicap, RGPD export/suppression).
T15 Alertes système (catalogue ~32) + emails automatiques (≈20 triggers) + notifications temps réel.
T16 Raccordements (cross-nav, breadcrumbs, sync indicateurs→site public, revalidate) + durcissement
    sécurité/perf + récapitulatif final + génération d'un dossier d'audit de démonstration.
```

Chaque tranche cite **les lignes de matrice qu'elle couvre**.

## Phase 2..N — Boucle par tranche (le cœur de l'autopilot)

> **PRINCIPE PERMANENT — le code réel fait foi, jamais les documents.** À chaque tranche, **re-lire les
> fichiers réels** qu'elle va toucher (schéma Prisma, action voisine, token, worker, template) AVANT de
> coder. Le contrat `reference/01` et les specs sont des **cartes, pas le territoire** : ils peuvent être
> périmés (repo vivant, multi-sessions). Ordre d'autorité : **(1) le code actuel d'`axionia`** > (2) le
> contrat/skill > (3) les specs `AXION_IA_COMPLET_QUALIOPI`. Toute divergence constatée entre le code et
> le contrat/specs → **suivre le code**, corriger le contrat (`reference/01`) et noter dans `STATE.md`.
> Ne jamais coder « d'après le document » sans avoir revu le code correspondant.

Pour chaque tranche, dans l'ordre :

1. **Implémenter** la verticale complète (schéma → action → UI → doc → seed/fixture).
2. **GATE de vérification** (tout doit être vert avant de continuer) :
   - `pnpm prisma validate` + migration en mode additif (revue : aucun `DROP`, aucune colonne NOT NULL
     sans default/backfill).
   - `pnpm typecheck` · `pnpm lint` · `pnpm i18n:check` · gates repo (`anti-siren`, `contrast`, `radius`,
     `use-client`) — globalement `pnpm verify:all`.
   - `pnpm test` (unit) + `pnpm test:integration` pour la logique DB de la tranche ; e2e Playwright pour
     les flux critiques (inscription→attestation, session→documents, portail, vérif QR).
   - Si la tranche touche une page publique : `pnpm bundle:check` + `pnpm lhci` (ou justification que la
     route n'est pas dans les 15 stratégiques).
3. **CROISEMENT (4 axes)** — vérifier la tranche contre :
   - **Spec** (PART1-5) : règles métier respectées (ratio pratique ≥ 60 %, seuils présence, machine à
     états, versioning, jours calendaires, fuseau Europe/Paris…).
   - **Matrice d'acceptation** : la/les ligne(s) couverte(s) ont bien artefact + test → passer au vert.
   - **Contrat codebase** (reference/01) : zéro valeur en dur, zéro système parallèle, briques réutilisées,
     conventions de nommage/cloisonnement, contrat `stub.invalid` intact.
   - **Charte** (reference/03) : tokens, typo, accessibilité WCAG AA, fidélité PDF/email/supports.
4. **RÉCONCILIATION** : toute dérive détectée au croisement est corrigée **immédiatement** (pas de TODO,
   pas de « on verra plus tard »). Re-passer le GATE après correction.
5. **Commit** atomique sur la **branche** (jamais `main`), message décrivant la tranche + lignes de
   matrice couvertes. Mettre à jour `STATE.md` (voir reprise).
6. **Raccordements** : brancher la tranche aux modules déjà livrés (nav croisée, FK, breadcrumbs,
   réutilisation des données : objectifs pédagogiques → grilles d'éval, durée → relevé connexion, etc.).

## Final — Clôture & preuve de conformité

- **Couverture matrice 100 %** : chaque ligne verte (artefact + test).
- Générer un **dossier d'audit de démonstration** (mode auditeur) avec des fixtures réalistes pour
  prouver, de bout en bout, qu'un auditeur Qualiopi trouverait chaque preuve.
- Produire le **RÉCAPITULATIF FINAL** : modules livrés, briques réutilisées (chemin:ligne), tests
  (écrits/passants), migrations, modèles ajoutés, seeds, secrets ajoutés, écarts de charte signalés,
  ambiguïtés tranchées, hors-périmètre assumé, risques résiduels + mitigations, prochaines étapes.
- **Ne pas pousser `main`.** Proposer la PR / le diff à Will pour revue (push = deploy prod).

---

## Reprise & idempotence (résilience de l'autopilot)

- Maintenir un **`STATE.md`** (dans le dossier de travail, hors `src/`) : tranches done / en cours / à
  faire, décisions, lignes de matrice vertes, points STOP en attente. Permet de reprendre après une
  coupure ou un nouveau contexte sans repartir de zéro.
- Migrations **additives & réversibles** ; jobs **idempotents** (clé d'idempotence, rejouables sans
  effet de bord) ; emails idempotents (clé `entité+type+date`).
- Avant de reprendre : `git status`/`git fetch` (working tree partagé multi-sessions) ; ne pas écraser
  le travail d'une autre session.

## Discipline coût / perf

- Réutiliser le **prompt caching** et le **cost-tracker** existants ; loguer
  tokens_in/out/coût/modèle/durée/cache_hit à chaque appel IA ; respecter `budget_max_usd` (arrêt
  gracieux + alerte si dépassé en cours de pipeline).
- Pagination cursor, virtualisation, index Prisma, cache Redis des indicateurs (TTL 1 h, invalidé à la
  clôture de session). Ne jamais charger une table entière en mémoire (exports en streaming).

---

## STOP & ASK — interrompre et demander à Will

**Toujours** pour : migration destructive ; régression d'un budget Web Vitals sur une des 15 pages
stratégiques ; doute sur une mention légale ou un calcul de financement ; toute modification du contrat
`stub.invalid` / `SKIP_ENV_VALIDATION` / `BULLMQ_DISABLED` ; écart de charte imposé ; ajout d'un secret ;
**toute apparition de CPF/OPCO/Qualiopi/financement dans du contenu PUBLIC** (silence financement, cf.
`reference/04` §3) ; **bascule du vocabulaire public « Intervention » → « Formation »** ; et avant tout
push `main`.

**Règles transverses à appliquer en continu** (cf. `reference/04`) : contenu IA généré marqué
`aiGenerated` (AI Act art. 50) ; sous-traitant non vérifié data.gouv.fr → assignation bloquée (ind. 19) ;
facturation duale forfait (public, `pricing.ts`) ↔ ventilation horaire (OPCO interne) ; tout texte public
passe le filtre compliance `BANNED_TERMS`.

**Ambiguïté n°0 — TRANCHÉE par Will (2026-06-03), cf. `reference/04` §1-2** : déploiement **phasé** via
flag `OF_PUBLIC_DISCLOSURE_ENABLED` (Phase A public neutre/silence financement, flag `false` ; Phase B
après NDA+Qualiopi, flag `true`). Entité **SAS France partout, zéro OÜ**. Donc : construire tout le
module avec le flag à `false`, aucune fuite publique. Reste à confirmer avec Will : le **schéma d'URL**
des futures fiches OF publiques (ex. `/formations/[slug]`) — décision Phase B, non bloquante pour A.

**Les 8 ambiguïtés de spec à trancher avec Will avant Phase 1** (les regrouper avec la n°0) :

1. **Modification d'un programme publié** : quels champs sont modifiables, et chacun crée-t-il une
   nouvelle version (patch/minor/major) ? Impact sur les sessions déjà planifiées ?
2. **Données après rejet de validation** : le contenu généré précédent est-il conservé (diff) ou purgé
   au retour à l'état antérieur ?
3. **Formation sur mesure pour un client** : duplication d'une formation catalogue, ou génération
   séparée avec contexte client injecté ? Lien `offre_site_id` + `client_id` + `est_sur_mesure`.
4. **Sessions récurrentes** : après génération, modifier la formation parente ne propage pas aux
   occurrences (par conception) → alerte requise ? Comportement attendu ?
5. **Expiration Qualiopi en cours d'année** : les sessions déjà planifiées peuvent-elles se tenir ?
   La date qui compte est-elle le début ou la clôture ?
6. **Token portail stagiaire** : passage du token URL au cookie HttpOnly à quel moment exact ;
   le token initial expire-t-il dès première utilisation ou reste-t-il valide 90 j ?
7. **Attestation partielle** : mention « durée réelle » seule, ou aussi « compétences partiellement
   acquises » ? Formule exacte attendue.
8. **Exclusion d'un stagiaire** : règle/justification d'un statut `exclu` (procédure) — qui décide, sur
   quels motifs, quelle trace ?

Pour tout le reste : décider selon le contrat, **documenter la décision dans `STATE.md`**, et continuer
sans bloquer l'autopilot.
