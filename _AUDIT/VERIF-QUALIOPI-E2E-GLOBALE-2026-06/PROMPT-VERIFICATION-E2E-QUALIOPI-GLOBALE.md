# PROMPT — Vérification END-TO-END globale du système Formation Engine + Qualiopi & Organismes (T0 → T19+)

> **Mode d'emploi.** Colle ce document entier comme premier message d'une nouvelle session Claude Code, à la racine `axionia/`. Il est auto-portant. Ne le résume pas, ne le tronque pas. Lance-le quand tu veux une **preuve d'opérationnalité production**, pas une relecture de code.

---

## 0. RÔLE & MISSION

Tu es un **auditeur qualité logiciel + conformité formation professionnelle**, adversarial et sceptique par défaut. Tu réunis trois casquettes :

1. **Ingénieur QA senior** : tu prouves qu'un flow marche en l'**exécutant** contre une vraie DB, pas en lisant le code.
2. **Auditeur Qualiopi (COFRAC) / contrôleur DREETS** : tu te demandes pour chaque exigence « si je débarque demain pour un audit de surveillance, est-ce que l'organisme peut produire la preuve ? ».
3. **Red-teamer** : ton objectif n'est pas de confirmer que ça marche, c'est de **trouver où ça casse** — données manquantes au runtime, écrans blancs, gardes contournables, documents non conformes, mocks oubliés en prod.

**Mission** : vérifier en profondeur, de bout en bout, que **tout ce qui a été implémenté de T0 à T19** (Formation Engine IA + Qualiopi Manager + financements + portail + conformité organismes) est **réellement fonctionnel, opérationnel, production-ready et SANS MOCK** dans les chemins de production.

**Livrable final** : un verdict **GO / NO-GO de mise en production réelle** (vente de formations à de vrais clients financés), étayé par des preuves reproductibles, et un plan de remédiation priorisé des trous trouvés.

---

## 1. PRINCIPES NON NÉGOCIABLES (lis-les deux fois)

<principes>

1. **La preuve, pas la confiance.** « Le code existe » ≠ « c'est testé » ≠ « c'est câblé dans l'UI » ≠ « ça produit le bon résultat au runtime contre une vraie DB ». Pour CHAQUE affirmation, classe-la explicitement sur cette échelle et donne la preuve du niveau atteint :
   - `EXISTE` (fichier:ligne)
   - `TYPECHECK` (compile)
   - `TESTÉ` (test unitaire vert — mais les tests mockent Prisma : un test vert ne prouve PAS le runtime)
   - `RUNTIME` (exécuté contre Postgres dev réel, sortie observée)
   - `E2E` (parcours complet UI→action→DB→document, observé de bout en bout)

2. **Zéro mock dans le verdict.** Les tests Vitest mockent `prisma`/`redis`/LLM — c'est normal en test, mais ça veut dire qu'un mur de tests verts **ne prouve pas** que le runtime fonctionne. Tu DOIS exécuter les chemins critiques contre la **vraie base Postgres dev** (voir §3). Tout chemin de PROD qui dépend d'un mock, d'un stub, d'un `TODO`, d'un retour en dur, ou d'un `// FIXME` est un **défaut bloquant** à signaler.

3. **Méfie-toi des seeds runtime.** Piège connu et déjà rencontré deux fois sur ce repo (`kb_fts_setup.sql`, grille qualité) : une **migration Prisma = DDL** (structure), elle ne contient PAS les données. Si une donnée critique (grille d'évaluation, offres, config SiteSetting, indicateurs) est seedée par un **script `tsx` manuel** que l'entrypoint de prod ne lance jamais, alors **en prod la table est vide** et le comportement diverge silencieusement du test. Pour CHAQUE donnée dont dépend une garde de conformité, réponds : « par quel mécanisme exact arrive-t-elle dans la DB de PROD au premier démarrage ? » et **prouve-le** (entrypoint, migration SQL d'INSERT idempotent, ou action admin obligatoire). Si la réponse est « un `pnpm ...:seed` manuel », c'est un **risque à signaler** (l'admin oubliera).

4. **Une garde non bloquante = une garde absente.** Pour toute règle de conformité (« ne pas démarrer sans accord OPCO », « ne pas certifier sous le seuil qualité », « ne pas délivrer d'attestation à un abandon »), vérifie qu'elle **throw / bloque réellement** et n'est pas un simple `console.warn`. Un avertissement qu'on peut ignorer ne protège pas l'organisme.

5. **Pas de faux vert, pas de complaisance.** Si tu n'as pas pu prouver quelque chose, écris « NON VÉRIFIÉ » — jamais « probablement OK ». Ne minimise aucun trou pour faire plaisir. Un audit qui conclut « tout est parfait » sans preuves est un audit raté. Sur ce système, l'audit précédent a trouvé **1 trou bloquant déploiement** malgré 1 463 tests verts : pars du principe qu'il en reste.

6. **Distingue bug / décision-produit / valeur-à-saisir.** Certains « trous » ne sont pas des bugs : ce sont des **valeurs légales que Will doit saisir** (n° NDA, SIREN, n° Qualiopi, barèmes OPCO, codes RS/RNCP) ou des **décisions produit en attente**. Classe chaque finding : `BUG` / `DÉCISION-WILL` / `DONNÉE-À-SAISIR` / `FAUX-POSITIF`. Ne traite pas une valeur vide volontairement comme un bug.

7. **Tout en français.** Rapports, commits, communication.

8. **Exhaustivité — ZÉRO échantillonnage.** C'est l'exigence centrale de cet audit. Tu ne vérifies pas « un échantillon représentatif » : tu vérifies **TOUT**. Toute server action, tout flow, toute route admin, tout template PDF, tout indicateur, tout dispositif de financement, toute garde de conformité, tout cron, tout worker, tout état de machine à états, tout type de client. Interdiction formelle de « top-N », « les plus critiques », « par exemple », « etc. ». Si quelque chose existe dans le code, il est dans le périmètre et reçoit un statut explicite dans le **registre de couverture** (`COUVERTURE.md`). Une fonctionnalité non vérifiée est un échec de l'audit, pas une omission acceptable.

9. **Couverture pilotée par inventaire, pas par mémoire.** Tu ne te fies pas à une liste pré-écrite (même celle de ce prompt §2) pour savoir « ce qu'il faut tester » — cette liste peut être périmée. En Phase 0.5 tu **extrais du code lui-même** l'inventaire complet et exhaustif de tout ce qui est testable (toutes les `export async function` d'action, toutes les `page.tsx`, tous les templates, tous les workers/crons, toutes les transitions d'état, tous les indicateurs enregistrés). Cet inventaire devient la **checklist maîtresse** : l'audit n'est terminé que lorsque chaque ligne a un verdict.

10. **Chaque flow = une matrice de scénarios, pas un seul passage.** Vérifier un flow « au cas nominal » ne prouve rien sur la robustesse. Pour CHAQUE flow tu déroules systématiquement la **matrice de scénarios** du §4bis (nominal + alternatifs + erreurs + limites + permissions + état vide + concurrence + idempotence + rejeu). Un flow n'est `E2E ✅` que si tous ses scénarios applicables sont couverts.

</principes>

---

## 2. CONTEXTE — CE QUI A ÉTÉ CONSTRUIT (ne pars pas de zéro)

<contexte_systeme>

**Architecture** (vérifie qu'elle est toujours exacte, ne la suppose pas) :

- **24 domaines backend** sous `src/server/qualiopi/` : `alertes`, `bpf`, `brand`, `config`, `conformite`, `crm`, `documents`, `engine` (Formation Engine IA), `evaluations`, `financements`, `formations`, `indicateurs`, `legal`, `notifications`, `numbering`, `offres`, `portail`, `presence` (émargement), `registres`, `rgpd`, `satisfaction`, `supports`, `trainees` (stagiaires), `trainers` (formateurs).
- **~106 server actions** (`export async function …Action`, compte exact par `grep -rhoE "export async function [a-zA-Z0-9_]+Action"`) dans ~29 fichiers sous `src/server/actions/qualiopi/` (ex. documents.ts ~14, portail.ts ~8, financements.ts ~7-8, trainers.ts ~6, devis.ts ~5, presence.ts ~5, + `seed.ts` → `reseedReferenceDataAction`). **Recompte-les en Phase 0.5 — le nombre exact est l'engagement de couverture.**
- **Console admin** : `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/**` — **~40 pages `page.tsx`** : accueil, alertes, appreciations, clients (+new), config, conformite, devis (+new/[id]), financements, formateurs (+new/[id]), formation-engine (+validations), formations (+new/[id] + certification/supports), indicateurs, mode-auditeur, offres, partenariats, pilotage, reclamations, revue-direction, rgpd, sessions (+new/[id] + emargement/evaluations/financement), sous-traitants, stagiaires (+new/[id]), veille. **+ 1 API route SSE** : `src/app/api/qualiopi/alertes/stream/route.ts`. Nav admin : ~25 items Qualiopi dans `src/lib/admin-nav.ts` (à recroiser : 0 lien mort / 0 page orpheline attendu).
- **Portail stagiaire public** : `src/app/[locale]/portail/mon-espace` + `acces-invalide` + route token `portail/acces/[token]/route.ts` (accès par token signé HttpOnly).
- **Autres routes PUBLIQUES liées Qualiopi** (à auditer comme surface exposée) : `src/app/[locale]/formations/[slug]/page.tsx` (**fiche publique de formation**, flag-gated `OF_PUBLIC_DISCLOSURE_ENABLED`) et `src/app/[locale]/verifier-attestation/[token]/page.tsx` (**vérification publique d'attestation** par token). Ces pages publiques doivent aussi respecter les budgets Web Vitals (LCP/INP/CLS) — cf. AGENTS.md.
- **Workers & crons Qualiopi** : `src/server/queue/workers/qualiopi-formation-engine-worker.ts` (pipeline IA de génération + garde grille `getActiveGrille` fail-loud) et `qualiopi-formation-crons-worker.ts` (transitions de session automatiques) ; logique cron dans `src/server/qualiopi/formations/crons.ts`. **Recense la liste complète en Phase 0.5.**
- **18 templates de documents PDF** sous `src/server/qualiopi/documents/templates/` : attestation, attestation-partielle, certificat-realisation, convention, convention-tripartite, convocation, emargement, facture, grille-evaluation, kit-cpf, kit-france-travail, kit-opco, lettre-mission, livret-accueil, positionnement, reglement-interieur, releve-connexion, satisfaction. ⚠️ Les fichiers `*.spec.tsx` de ce dossier (`attestations-factures.spec`, `conventions.spec`, `sessions-docs.spec`) **ne sont PAS des templates** — ne les compte pas.
- **+ 1 template PDF supports** : `src/server/qualiopi/supports/templates/support-pdf.tsx` (composant paramétrique pour tous les supports de formation). → **19 templates PDF au total.** Rendus via `renderPdfToBuffer()` (`documents/render.ts`), polices Fraunces/Manrope/Inconsolata avec fallback Geist si TTF absents. **Recompte en Phase 0.5.**
- **6 templates email** sous `src/lib/email/templates/` : `qualiopi-convocation`, `qualiopi-rappel-j7`, `qualiopi-satisfaction-j1`, `qualiopi-suivi-j30`, `qualiopi-attestation-disponible`, `qualiopi-alerte-interne` (+ 1 spec). Déclenchés par le domaine `notifications` (T15). ⚠️ Contrat : les emails stagiaire ne mentionnent JAMAIS le financement public.
- **Formation Engine** : pipeline IA de génération de formations (intention → structure → contenu → assemblage → publication), avec grille qualité (seuil ≥80), critique adversariale, anti-hallucination, validations humaines (FileValidation). Voir `src/server/qualiopi/engine/`.
- **Migrations Qualiopi additives** sous `prisma/migrations/` (jusqu'à `...320000_qualiopi_inter_entreprises`) — uniquement du **DDL, zéro donnée métier**. Les **données de référence** arrivent autrement (voir ci-dessous).
- **⚠️ Mécanisme de seed runtime — ÉTAT TERRAIN (mis à jour 2026-06-07), à re-PROUVER en Phase 1 :** Trois voies seedent les données de référence ; ne crois aucune sur parole, prouve-les :
  - **(a) Migration FTS au boot** : l'entrypoint `scripts/docker-entrypoint.sh` lance `prisma migrate deploy` (~ligne 50) puis une boucle sur `prisma/migrations_fts/*.sql` (~79-89). La **grille qualité v1** y est seedée (`20260606300000_qualiopi_grille_seed.sql`, `INSERT … ON CONFLICT DO NOTHING`). L'engine est **fail-loud** : `getActiveGrille()===null` → le worker **throw** (plus de certification 100/valide silencieuse).
  - **(b) Seed auto applicatif au boot du serveur Next (AJOUTÉ 2026-06-07)** : `src/instrumentation.ts` appelle `seedQualiopiReferenceData(prisma)` (`src/server/qualiopi/seed/reference-data.ts`) qui seede **offres_site + config SiteSetting + grilles v1/v2**. Propriétés annoncées à VÉRIFIER : **idempotent**, **non destructif** (ne réécrit JAMAIS une valeur saisie : NDA/SIREN/barèmes…), **verrou Postgres** `pg_try_advisory_lock` (anti-course multi-instances), **fail-soft** (n'empêche jamais le boot), **désactivable** via `QUALIOPI_AUTO_SEED=false`, **no-op** si `DATABASE_URL` contient `stub.invalid` (build).
  - **(c) Pilotage manuel admin** : page `/qualiopi/config` → encart « Données de référence » + bouton (`reseedReferenceDataAction` / `SeedReferenceDataButton`) qui rejoue le même seed et affiche l'état (offres, clés config, grille active). Le CLI `pnpm qualiopi:seed` reste disponible.
  - **🔴 À PROUVER (ne pas supposer corrigé) :** que (b) **peuple réellement** `offres_site` + config + grilles au boot (donc que les pages offres/réservation ne sont **pas vides** au premier démarrage) ; que (b) est **idempotent & non destructif** (relancer ne duplique pas, ne touche pas aux valeurs légales saisies — teste-le contre la DB dev) ; que le **verrou** fonctionne ; que l'échec du seed **ne bloque pas** le boot ; que le **bouton admin** marche et affiche le bon statut ; que `stub.invalid` est bien un **no-op**. Vérifie aussi la cohérence des deux grilles (v1 via SQL, v1+v2 via seed auto : laquelle est `actif=true` au final ?).

**Référentiel de conformité à couvrir** (organismes) :
- **DREETS / NDA** (numéro de déclaration d'activité, BPF — bilan pédagogique et financier)
- **Qualiopi / COFRAC** : RNQ = **7 critères / 32 indicateurs**, référent handicap, registre des réclamations, veille, revue de direction
- **France Compétences** : certifications **RS / RNCP**, CPF/EDOF, éligibilité
- **France Travail** : **AIF, POEI, CSP** (aides individuelles / préparation opérationnelle à l'emploi)
- **OPCO** : prise en charge, **subrogation**, **convention tripartite**, barèmes par branche (IDCC × taille × dispositif)
- **CPF / EDOF** : éligibilité, RAC (reste à charge), preuves (relevé de connexion, attestation, satisfaction)
- **Fisc** : exonération TVA **art. 261-4-4° CGI** (formation professionnelle), tva=0
- **CNIL (RGPD) + AI Act** : token timing-safe, anonymisation irréversible, consentement versionné, marquage contenu IA (`aiGenerated` / AI Act art. 50), chiffrement PII (handicap), droit à l'effacement

**Modèle de build/deploy** (impacte ce qui existe vraiment en PROD) :
- Build **externalisé GitHub Actions** avec stubs `stub.invalid` (Prisma/Redis court-circuités au build). `prisma migrate deploy` tourne à l'**entrypoint du container** au runtime. Conséquence : ce qui n'est ni dans une migration appliquée, ni dans l'entrypoint, n'existe PAS en prod tant qu'un humain ne l'a pas fait.
- `push main` = deploy prod automatique. Ne push QUE si la CI Gate A est verte.

**État déclaré** (à challenger, pas à croire) : la mémoire projet déclare « T0→T19 ACHEVÉ, déployé main, 16 549 tests verts ». Un audit antérieur (`_AUDIT/VERIF-QUALIOPI-E2E-2026-06-06/`) a néanmoins trouvé un trou bloquant (grille qualité jamais seedée au runtime → engine certifiait 100/valide pour tout) + une dizaine de trous R1–R11 partiellement remédiés. **Lis ce dossier en P0 et vérifie que chaque correctif annoncé tient réellement.** Ne considère AUCUN trou comme fermé sans le re-prouver.

</contexte_systeme>

---

## 3. ENVIRONNEMENT D'EXÉCUTION (obligatoire pour le niveau RUNTIME)

<environnement>

- **DB Postgres dev** : `localhost:5433/axion_ia_dev` (user/pass `axion_ia` / `axion_ia_dev`). **Redis dev** : `6381`. (Sources : mémoire projet / `STATE.md`.) Vérifie que ces services tournent ; si non, lance-les (docker compose dev) ou signale-le.
- `NODE_OPTIONS=--max-old-space-size=8192` pour `tsc --noEmit` (OOM connu à 2 GB).
- Le hook **pre-push lance toute la CI Gate A (~10 min)** : ne confonds pas « long » avec « bloqué ».
- Commandes utiles : `pnpm prisma migrate deploy` (applique les migrations runtime — celles qui partent en prod), `pnpm prisma migrate status`, `pnpm qualiopi:seed` / `qualiopi:seed-demo` (à inspecter : que seedent-ils, et l'entrypoint prod les appelle-t-il ?), `pnpm exec vitest run <path>`, `pnpm exec tsx <script>` pour exécuter un flow réel.
- Pour prouver un flow au niveau RUNTIME sans cliquer dans un navigateur : écris des **scripts `tsx` jetables** (sous `_AUDIT/VERIF-QUALIOPI-E2E-GLOBALE-2026-06/probes/`) qui importent les vraies server actions / services et les exécutent contre la DB dev, puis logge les effets (rows créées, PDF généré commençant par `%PDF`, garde qui throw, etc.). **Ces probes ne doivent rien mocker.**
- Si un vrai parcours navigateur est nécessaire (écran blanc, RBAC, hydration), lance l'app (`pnpm dev`) et utilise l'outil de vérification navigateur disponible.
- **Données réelles uniquement** : seed la DB dev avec le seed de prod réel (pas un fixture de test) pour juger ce qu'un admin verrait au premier démarrage.

</environnement>

---

## 4. PLAN DE VÉRIFICATION (phases séquentielles, checkpoint après chacune)

> Traite chaque phase comme un sprint d'audit. À la fin de chaque phase : écris les findings dans le rapport de phase AVANT de passer à la suivante. Si une phase révèle un bloquant systémique (ex. migrations non appliquées), arrête-toi et signale-le immédiatement.
>
> ⚠️ **Pour chaque flow des Phases 2 à 8, applique la MATRICE DE SCÉNARIOS §4bis (S1→S12).** Les bullets ci-dessous décrivent le périmètre ; la matrice décrit la profondeur. Les deux sont obligatoires.

### Phase 0 — Baseline & intégrité du dépôt
- Confirme l'état git (branche, `HEAD == origin/main`, working tree propre).
- Lis intégralement `_AUDIT/VERIF-QUALIOPI-E2E-2026-06-06/` (SYNTHESE, ORGANISMES, PARCOURS-E2E, PLAN-REMEDIATION, QUESTIONS-WILL) + `_AUDIT/QUALIOPI-AUTOPILOT-2026-06/STATE.md` + `RECAP-FINAL.md`. Dresse la liste des trous R1–R11 et de leur statut annoncé.
- Lance la CI Gate A complète **toi-même** (`pnpm lint` repo + `prettier --check` + les 3 isolation-checks + `tsc --noEmit` + suite complète) et note le vrai résultat. Compte les tests réellement exécutés vs sautés.

### Phase 0.5 — AUTO-INVENTAIRE EXHAUSTIF (construis la checklist maîtresse)
> Cette phase est obligatoire et conditionne tout le reste. Tu ne testes bien que ce que tu as d'abord recensé exhaustivement. **Extrais du code** (Glob/Grep, pas de mémoire) la liste COMPLÈTE de chaque catégorie ci-dessous, et écris-la dans `COUVERTURE.md` sous forme de lignes cochables. Compte les éléments et annonce les totaux.

- **Server actions** : toutes les `export async function …Action` sous `src/server/actions/qualiopi/**` (et celles des domaines). Pour chacune : signature, garde(s) attendue(s), effets DB.
- **Services métier** : toutes les fonctions exportées publiques des 24 domaines `src/server/qualiopi/**` (hors specs).
- **Routes admin** : toutes les `page.tsx` sous `(admin)/[adminPrefix]/qualiopi/**` (+ layouts, route handlers, API routes éventuelles).
- **Routes/écrans publics** : portail stagiaire (`portail/mon-espace`, `acces-invalide`, `acces/[token]`), fiches publiques formation (`formations/[slug]`), vérification d'attestation (`verifier-attestation/[token]`), pages de financement client, tout endpoint/route handler exposé.
- **Templates PDF/documents** : tous les fichiers de `documents/templates/**`.
- **Workers & crons** : tous les workers BullMQ et tâches planifiées touchant Qualiopi (génération, alertes, transitions de session, BPF, etc.).
- **Machines à états** (statuts réels vérifiés — re-confirme depuis le code) : **formation** (`statutGeneration` : intention → structure_generee → contenu_evalue → structure_validee → contenu_genere → contenu_valide → assemble → publie → archive) ; **session** (`planifiee → en_cours → realisee`, + `annulee`/`reportee` ; whitelist dans `formations/state-machine.ts`, event-sourcée dans `FormationTransition`) ; **enrollment** (`planifiee → presente`/`abandon`/`exclu`) ; **devis** (`brouillon → envoye → accepte`/`refuse`/`expire`/`transforme_convention`). Établis le diagramme COMPLET des transitions autorisées **et** teste chaque transition interdite (doit être refusée).
- **Indicateurs RNQ** : les 32 indicateurs enregistrés dans le registre du code (ne te fie pas au chiffre « 32 », compte-les réellement).
- **Dispositifs de financement** : tous les types gérés (OPCO, CPF/EDOF, France Travail AIF/POEI/CSP, autofinancement, plan entreprise, …) × tous les types de client (B2C particulier, intra-entreprise, inter-entreprises).
- **Gardes de conformité** : recense tout `throw`/blocage conditionnel dans les chemins critiques et tout `warn` qui DEVRAIT être un blocage.
- **Champs PII / RGPD** : tous les champs chiffrés/anonymisables.
- **Flags & config** : tous les `SiteSetting`/env flags qui changent un comportement (`OF_PUBLIC_DISCLOSURE_ENABLED`, `QUALIOPI_AUTO_SEED`, etc.).
- **Seed & démarrage** : le hook de boot `src/instrumentation.ts`, le service `src/server/qualiopi/seed/reference-data.ts`, les seeds `prisma/seeds/qualiopi/**`, les SQL `prisma/migrations_fts/*.sql`, l'entrypoint `scripts/docker-entrypoint.sh`, et l'action `reseedReferenceDataAction`. Recense ce qui arrive en DB par chaque voie.

À la fin de la phase : `COUVERTURE.md` contient N lignes (N = total recensé), chacune au statut `⬜ à vérifier`. **Ce nombre N est l'engagement de couverture : l'audit ne se termine pas tant que les N lignes ne sont pas à `✅`/`🔴`/`🟠`/`🟡`/`🔵` ou `NON VÉRIFIÉ + raison`.** Aucune ligne ne peut rester `⬜`.

### Phase 1 — Modèle de données & seeds runtime (LE piège n°1)
- Liste tous les modèles Prisma Qualiopi et toutes les migrations. `prisma migrate status`.
- **Pour CHAQUE donnée critique** (grille qualité/évaluation, offres `offres_site`, config `SiteSetting` cat qualiopi, 32 indicateurs, barèmes, numérotation) : trace le mécanisme exact d'arrivée en DB de prod. Distingue migration-DDL / migration-SQL-INSERT-idempotente / entrypoint / script manuel / action admin. **Marque RISQUE tout ce qui dépend d'un script manuel non appelé par l'entrypoint.**
- Vérifie l'idempotence des INSERT runtime (re-déploiement ne casse pas / ne duplique pas).
- Vérifie les extensions Postgres requises (`uuid-ossp`, etc.) activées par migration.
- **Seed auto au boot (`src/instrumentation.ts` → `seedQualiopiReferenceData`)** — prouve-le au RUNTIME contre la DB dev : (1) sur une DB **fraîchement migrée sans seed manuel**, déclenche le boot/seed et vérifie que `offres_site`, la config qualiopi et les grilles sont **peuplées** ; (2) **idempotence** : relance → aucun doublon ; (3) **non destructif** : écris une valeur légale (ex. NDA), relance le seed, vérifie qu'elle est **préservée** ; (4) **verrou** : deux exécutions concurrentes → une seule seede (`ran:false` pour l'autre) ; (5) **fail-soft** : simule une erreur → le « serveur » ne crashe pas ; (6) **stub** : `DATABASE_URL=…stub.invalid` → **no-op** (aucun `$queryRaw`, aucune mutation) ; (7) **kill-switch** `QUALIOPI_AUTO_SEED=false` → ne seede pas. Vérifie aussi quelle grille est `actif=true` après coexistence (a)+(b).

### Phase 2 — Console d'administration (chaque route, pour de vrai)
- Pour les ~40 pages admin Qualiopi : prouve que **chacune rend sans crash ni écran blanc** avec une DB seedée réaliste ET avec une DB vide (premier démarrage). Cherche les `getX()` qui retournent `null` et plantent le render.
- RBAC / auth : une route admin est-elle accessible sans session ? Le préfixe admin obscur protège-t-il réellement ? Teste un accès non authentifié.
- Navigation : le compteur d'items de nav (`admin-nav.test`) est-il cohérent avec les pages réelles ? Liens morts / pages orphelines ?
- Mode auditeur : que voit/ne voit pas un auditeur ? L'export ZIP du dossier d'audit se génère-t-il réellement (RUNTIME) et contient-il les bonnes pièces ?
- **Page `/qualiopi/config` → encart « Données de référence »** : l'état (offres / clés config / grille active) s'affiche-t-il correctement ? Le bouton **« (Re)initialiser le référentiel »** (`reseedReferenceDataAction`) rejoue-t-il le seed au RUNTIME, met-il à jour le statut, et reste-t-il **non destructif** (les valeurs légales saisies dans le formulaire en dessous ne sont pas écrasées) ? Garde write + log d'audit présents.
- **Surfaces PUBLIQUES Qualiopi** (rendu + sécurité + conformité) : `formations/[slug]` (fiche publique) → rend correctement, respecte le flag `OF_PUBLIC_DISCLOSURE_ENABLED` (404/masquée si off), n'expose aucune donnée sensible, hreflang/SEO OK ; `verifier-attestation/[token]` → token valide affiche l'attestation, token invalide/expiré/rejoué refuse proprement (pas de fuite), pas d'énumération ; portail stagiaire (déjà en Phase 8). Vérifie aussi les budgets Web Vitals sur ces pages publiques.

### Phase 3 — Flows cœur métier E2E
Pour chacun, exécute le parcours complet (probe tsx ou navigateur) et observe les effets DB + documents :
- **Formation Engine** : intention → génération structure → génération contenu → critique adversariale → assemblage → validations humaines → publication. Vérifie en particulier que **la garde qualité ≥80 bloque réellement** (et que la grille est bien chargée au runtime — cf. trou historique). Force un score < 80 et prouve le blocage.
- **Cycle de vie session** : `planifiee → en_cours → realisee` (+ `annulee`/`reportee`). Vérifie chaque transition autorisée ET le refus de chaque transition interdite, les gardes (démarrage `en_cours` bloqué sans accord financement ; passage `realisee` bloqué sans émargement), les crons (`handleDateDebut`, etc.) et l'event-sourcing `FormationTransition` (idempotence `unique(sessionId, toStatus, trigger)`).
- **Émargement / présence** : feuilles, parse Zoom, relevé de connexion, garde de clôture (peut-on clôturer sans émargement ?).
- **Évaluations & appréciations** : positionnement, à chaud, à froid, appréciations (off.30), attestation — vérifie qu'une **attestation est refusée pour un abandon/exclu**.
- **Stagiaires & formateurs** : CRUD réel, assignation formateur principal **bloquante si non habilité** (trou R9 historique), chiffrement PII handicap (write-only, jamais loggé).
- **Devis → convention** (R11) : création devis → acceptation → génération de la convention (et tripartite si OPCO). Vérifie que le lien devis→formation/session est exploitable et que la convention reprend les bonnes données.
- **Supports de formation** : génération des supports (`supports` domain, render-support), stockage R2 (et fallback si R2 absent), rattachement à la formation.
- **CRM / clients** : création/édition client (particulier B2C, entreprise), `idcc`, rattachement aux sessions/enrollments — base de tous les flows financement.
- **Emails transactionnels** : déclenchement réel des emails du cycle (convocation, attestation disponible, rappels) — rendu du template + envoi (ou file d'attente), fail-soft si SMTP down.

### Phase 4 — Financement par organisme (le terrain d'audit le plus risqué)
Exécute un dossier complet par dispositif et prouve les gardes :
- **OPCO** : subrogation → n° dossier **bloquant**, barème vérifiable (source + date), **convention tripartite bloquante avant démarrage** (R2), `computeVentilationDossier`, refus si barème non renseigné (jamais inventé).
- **CPF / EDOF** : blocage si EDOF absent, **RAC câblé** (R4), preuves générées.
- **France Travail** : AIF / **POEI saisissable en UI** (R3, l'admin doit pouvoir débloquer sans accès DB) / CSP, kit PDF.
- **Inter-entreprises** vs **intra** vs **B2C particulier** : financement & facturation par `Enrollment` — vérifie que les trois cas fonctionnent (le cas inter était annoncé le plus invasif).
- **Facture** : TVA=0 + mention art. 261-4-4° CGI verbatim, numérotation **atomique** (pas de `count+1` qui collisionne, R7).

### Phase 5 — Documents / PDF & emails (preuve matérielle d'un audit)
- Génère **réellement TOUS** les templates recensés en Phase 0.5 (probe RUNTIME, pas un échantillon) et vérifie que chaque buffer commence par `%PDF` et n'est pas vide.
- Mentions légales injectées (NDA, SIREN, exonération TVA) : présentes ou placeholder ? Si placeholder → `DONNÉE-À-SAISIR`, pas bug.
- Polices : fallback Geist si Fraunces/Manrope absentes → cosmétique, à noter.
- Numéro de pièce séquentiel dans l'en-tête, allocation avant rendu, pas de collision (lien avec S8 concurrence).
- **Emails** : rends chaque template email recensé, vérifie le contenu (liens, mentions, données dynamiques) et prouve le déclenchement réel dans le cycle (ou la mise en file), avec fail-soft si SMTP indisponible.

### Phase 6 — Conformité RNQ (32 indicateurs × 7 critères)
- Dresse la **matrice des 32 indicateurs** : pour chacun, quel(s) artefact(s) du système constitue(nt) la preuve, et est-elle réellement produite au runtime ? Marque les indicateurs **couverts / partiels / non couverts / proxy-faux** (l'audit précédent signalait off.29 « proxy faux » et off.32 gate revue de direction non bloquante — re-vérifie).
- Registres obligatoires : réclamations, veille (réglementaire/métier/handicap), sous-traitants, partenariats, revue de direction — existent, alimentables, exportables ?
- **BPF (bilan pédagogique et financier)** : génération/export réel, marqueur d'année réel (`bpf_annee_deposee`), cohérence des montants — c'est la preuve DREETS annuelle.
- **Pilotage / indicateurs dashboard** : la page pilotage calcule-t-elle les indicateurs à partir de vraies données (pas de valeurs en dur) ?
- Référent handicap, accessibilité, adaptation.

### Phase 7 — « Un contrôleur trouverait-il ses preuves ? » (verdict par organisme)
Reprends les **8 organismes** (§1 contexte) et rends un verdict PRÊT / PARTIEL / NON-PRÊT par organisme, en distinguant systématiquement *plomberie logicielle* (ta responsabilité) de *valeurs légales à saisir par Will*. Sois explicite sur ce qui bloquerait une vente réelle financée demain matin.

### Phase 8 — Sécurité, RGPD, AI Act
- Portail : token **timing-safe**, non énumérable, expirable ; `findUnique` sur token 256 bits + index unique = sûr (vérifie que c'en est bien un, pas un faux positif).
- Anonymisation **irréversible** (droit à l'effacement) : prouve qu'après anonymisation la PII est non récupérable.
- Consentement versionné, marquage `aiGenerated` (AI Act art. 50), chiffrement handicap. Anti-hallucination : warning-only ou bloquant ? (décision F1 — classe-la).
- Rate-limit anti-brute-force portail/accès + SSE.

### Phase 9 — Chasse aux mocks/stubs/TODO en PROD (exigence « sans mock »)
- Grep ciblé dans les chemins de PROD (hors `__tests__`, `*.spec.*`, `*.test.*`) : `mock`, `stub`, `TODO`, `FIXME`, `HACK`, `hardcode`, retours en dur, `throw new Error("not implemented")`, valeurs factices.
- Pour chaque hit en chemin prod : est-ce un vrai défaut, un fallback légitime (ex. stub `stub.invalid` du build), ou un faux positif ? Justifie.
- Vérifie qu'aucune server action critique ne renvoie de données simulées.

### Phase 10 — Synthèse & verdict GO/NO-GO
- Agrège tous les findings. Calcule un verdict global de mise en production réelle.
- Priorise la remédiation (P0 bloquant deploy / P1 bloquant vente financée / P2 conformité / P3 cosmétique).

---

## 4bis. MATRICE DE SCÉNARIOS — à dérouler pour CHAQUE flow (obligatoire)

> Un flow vérifié uniquement « au cas qui marche » est un flow NON vérifié. Pour chaque flow recensé en Phase 0.5, déroule **tous les scénarios applicables** de cette matrice. Si un type de scénario n'est pas applicable, écris-le et justifie — ne le saute pas en silence.

<matrice_scenarios>

| # | Type de scénario | Question à laquelle tu dois répondre par une preuve |
|---|---|---|
| S1 | **Nominal / happy path** | Le parcours complet réussit-il et produit-il l'effet DB + document attendu ? |
| S2 | **Alternatifs** | Toutes les branches métier légitimes (ex. session intra vs inter vs B2C ; OPCO vs CPF vs France Travail ; certifiante vs non) produisent-elles le bon résultat ? Déroule **chaque** branche. |
| S3 | **Erreurs & échecs** | Entrée invalide, validation Zod, échec provider/LLM, DB down, R2/SMTP indisponible : le système échoue-t-il proprement (fail-soft où voulu, fail-loud où la conformité l'exige), sans corrompre l'état, sans écran blanc ? |
| S4 | **Limites / bornes** | Valeurs vides, zéro, max, dates passées/futures, montants nuls/négatifs, chaînes très longues, caractères spéciaux, fuseaux horaires, quotas/plafonds OPCO atteints. |
| S5 | **Gardes & blocages** | Chaque garde de conformité **bloque-t-elle réellement** quand sa condition est violée ? Force la violation et prouve le `throw`/refus (pas un `warn`). |
| S6 | **Permissions / RBAC** | Accès non authentifié, mauvais rôle, IDOR (accès à la ressource d'un autre via id deviné), token portail invalide/expiré/rejoué. |
| S7 | **État vide / premier démarrage** | Avec une DB fraîchement migrée SANS seed manuel : la page rend-elle ? l'action a-t-elle ses données de référence ? (re-teste le piège seed runtime ici, par flow). |
| S8 | **Concurrence & atomicité** | Deux exécutions simultanées (double-clic, deux admins) : numérotation de pièces sans collision, transitions d'état sans course, transactions atomiques (pas d'état partiel). |
| S9 | **Idempotence & rejeu** | Rejouer la même action / re-déployer / re-seeder ne duplique ni ne casse rien. Webhooks/crons rejoués sans effet de bord double. |
| S10 | **Cycle de vie complet** | Pour les entités à machine à états : parcours de bout en bout sur **toutes** les transitions autorisées + tentative de **chaque** transition interdite (doit être refusée). |
| S11 | **Réversibilité / RGPD** | Suppression/anonymisation : irréversible où exigé, et l'entité disparaît bien des exports/registres après coup. |
| S12 | **Conformité documentaire** | Le document produit contient-il TOUTES les mentions légales obligatoires pour l'organisme visé (et pas un placeholder là où une vraie valeur est requise) ? |

</matrice_scenarios>

Pour chaque flow, le rapport doit montrer le tableau S1→S12 avec, par ligne, le statut et la preuve (probe + sortie observée). Le flow n'obtient `E2E ✅` que si toutes les lignes applicables sont vertes.

---

## 5. FORMAT DE SORTIE (strict)

<format>

**Pendant l'audit** : à la fin de chaque phase, écris un fichier `RAPPORT-PHASE-<n>.md` dans `_AUDIT/VERIF-QUALIOPI-E2E-GLOBALE-2026-06/`.

**Chaque finding** suit ce schéma :

```
### [SEVERITE] <titre court>
- **Type** : BUG | DÉCISION-WILL | DONNÉE-À-SAISIR | FAUX-POSITIF
- **Niveau de preuve atteint** : EXISTE | TYPECHECK | TESTÉ | RUNTIME | E2E
- **Domaine / Organisme** : …
- **Constat** : ce que tu as observé (factuel).
- **Preuve** : `fichier:ligne`, ou commande + extrait de sortie, ou nom du probe + résultat observé.
- **Impact** : ce qui casse concrètement pour un client/auditeur réel.
- **Repro** : étapes exactes pour reproduire.
- **Reco** : correctif proposé (sans l'appliquer sauf consigne).
```

Sévérités : `🔴 P0` (bloque le deploy ou corrompt des données), `🟠 P1` (bloque une vente réelle financée), `🟡 P2` (non-conformité audit), `🔵 P3` (cosmétique/dette), `✅ OK` (vérifié au niveau RUNTIME/E2E).

**Livrables finaux** dans `_AUDIT/VERIF-QUALIOPI-E2E-GLOBALE-2026-06/` :
1. `COUVERTURE.md` — **le registre maître** : l'inventaire exhaustif de Phase 0.5 (N lignes), chacune avec son statut final et un lien vers la preuve/finding. C'est la preuve que rien n'a été oublié. Doit afficher en tête : `Couverture : X/N (100 % requis)`.
2. `SYNTHESE.md` — verdict GO/NO-GO + tableau de bord (par domaine, par organisme), top risques (tous les P0/P1, pas un top-N tronqué).
3. `MATRICE-INDICATEURS.md` — les 32 indicateurs RNQ × statut × preuve.
4. `MATRICE-SCENARIOS.md` — pour chaque flow, le tableau S1→S12 rempli.
5. `ORGANISMES.md` — verdict par organisme (les 8).
6. `PARCOURS-E2E.md` — chaque flow exécuté + résultat observé.
7. `PLAN-REMEDIATION.md` — findings priorisés P0→P3, effort estimé, dépendances (décisions Will).
8. `probes/` — les scripts tsx d'exécution réelle (reproductibles), un par flow/scénario.
9. `QUESTIONS-WILL.md` — décisions produit / valeurs légales en attente, formulées comme des questions fermées.

</format>

---

## 6. DÉFINITION DE « TERMINÉ » (acceptance de l'audit lui-même)

L'audit n'est complet que si **toutes** ces conditions sont vraies :
- [ ] **`COUVERTURE.md` est à X/N = 100 %** : chaque ligne de l'inventaire exhaustif de Phase 0.5 a un verdict (aucune ligne `⬜`). C'est la condition n°1 ; sans elle l'audit n'est PAS terminé, peu importe le reste.
- [ ] Les 12 étapes (Phase 0, 0.5, puis 1 à 10) sont exécutées et documentées.
- [ ] **Toute** server action, **toute** route admin, **tout** worker/cron, **tout** template PDF, **toute** transition d'état, **tout** dispositif de financement × type de client a été vérifié (pas un échantillon).
- [ ] Chaque flow a sa **matrice de scénarios S1→S12** remplie ; chaque flow cœur et chaque dispositif de financement a au moins une preuve de niveau **RUNTIME** (exécution réelle contre Postgres dev), pas seulement TESTÉ.
- [ ] **Chaque** template PDF recensé a été généré réellement (preuve `%PDF`), pas seulement un échantillon.
- [ ] La matrice des 32 indicateurs est remplie, sans case « non vérifié » silencieuse.
- [ ] **Chaque** garde de conformité a été testée par violation forcée (S5) et prouvée bloquante ou signalée comme non bloquante.
- [ ] Chaque trou R1–R11 de l'audit précédent est re-statué (fermé+preuve / encore ouvert / faux positif).
- [ ] Le verdict GO/NO-GO est rendu, avec la liste exacte de ce qui bloque une vente réelle financée.
- [ ] Aucun « probablement OK » ni « etc. » ni « top-N » ne subsiste : tout est EXISTE/…/E2E ou explicitement NON VÉRIFIÉ avec la raison.

---

## 7. GARDE-FOUS D'EXÉCUTION (pour TOI, l'auditeur)

> **Deux modes selon le message de lancement :**
> - **Mode AUDIT-SEUL (par défaut)** : tu vérifies et tu rapportes, tu ne corriges pas le code de prod.
> - **Mode CORRECTION AUTOPILOT** : si le message de lancement l'active explicitement, alors les deux premières puces ci-dessous sont **levées** — tu corriges chaque `BUG` au fil de l'eau (jamais les `DÉCISION-WILL`/`DONNÉE-À-SAISIR`), tu relances la CI Gate A complète après chaque lot, et tu commit/push selon les directives du message. Tout le reste de §7 reste valable.

- **(Audit-seul) N'applique aucun correctif de code sans me demander**, sauf si le mode correction autopilot est activé au lancement. (Exception toujours autorisée : créer des probes jetables sous `probes/`.)
- **Ne push rien sur `main`** sans confirmation explicite par action (un push = deploy prod). En mode correction autopilot, ne push QUE si la CI Gate A est 100 % verte, et vérifie `git fetch` + ahead/behind avant (working tree partagé multi-sessions).
- Si tu dois écrire des probes ou des fichiers de rapport, fais-le sous `_AUDIT/VERIF-QUALIOPI-E2E-GLOBALE-2026-06/` uniquement.
- Si la DB dev / Redis ne tournent pas, dis-le et propose de les démarrer — n'invente pas de résultats RUNTIME.
- Si une vérification est trop coûteuse pour ce tour, dis-le franchement et propose de paralléliser via un workflow multi-agents (un agent par domaine/organisme) — mais ne lance un workflow que si je l'autorise (coût tokens).
- Travaille de façon autonome phase par phase ; ne me redemande pas la permission entre deux vérifications de lecture/exécution. Remonte-moi un point d'étape à la fin de chaque phase et le verdict à la fin.

---

**Commence par la Phase 0. Annonce ton plan, puis exécute.**
