# Registre des risques & mitigations — LMS e-learning Axion-IA

> Document exploitable par une équipe de dev senior. Chaque risque est coté **Probabilité (P)** × **Impact (I)** sur une échelle 1–5, avec une **criticité** = P×I (1–25), une **mitigation** (mesures préventives + détection) et un **plan B** (que faire si le risque se matérialise malgré tout).
>
> Conventions de cotation :
>
> - **P** : 1 = très improbable · 3 = plausible · 5 = quasi certain sans action.
> - **I** : 1 = gêne mineure · 3 = retard/coût notable · 5 = bloquant légal / arrêt de service / non-conformité majeure.
> - **Criticité** : 🟥 ≥ 15 (à traiter en priorité, gate de phase) · 🟧 8–14 (à planifier) · 🟩 ≤ 7 (à surveiller).
>
> Dernière mise à jour : 2026-06-27. Source de vérité des décisions : `00-INDEX/DECISIONS-ARBITRAGES.md` (ADR-0001 → 0008). Phasage : `11-ROADMAP/01-phasage-mvp-v1-v2.md`.

---

## 0. Tableau de bord (synthèse)

| ID        | Risque                                                                           | Cat.       | P   | I   | Crit. | Phase d'exposition       |
| --------- | -------------------------------------------------------------------------------- | ---------- | --- | --- | ----- | ------------------------ |
| **T-01**  | Multi-tenant rétrofité = fuite de données inter-entreprises                      | Technique  | 4   | 5   | 🟥 20 | V2 (dette posée dès MVP) |
| **T-02**  | Vidéo : dépendance Cloudflare Stream, coût, URLs signées contournées             | Technique  | 3   | 4   | 🟧 12 | MVP                      |
| **T-03**  | INP dégradé sur le player + quiz (budget Web Vitals)                             | Technique  | 4   | 3   | 🟧 12 | MVP                      |
| **T-04**  | Cohabitation auth apprenant ↔ NextAuth : régression admin / confusion de session | Technique  | 3   | 5   | 🟥 15 | MVP                      |
| **T-05**  | Build stub `stub.invalid` : pages e-learning qui cassent le build SSG            | Technique  | 3   | 4   | 🟧 12 | MVP                      |
| **T-06**  | Reprise auto / heartbeat de progression : perte de données, doublons             | Technique  | 3   | 3   | 🟩 9  | MVP                      |
| **T-07**  | Moteur de quiz : faille de gating (score falsifié côté client)                   | Technique  | 3   | 4   | 🟧 12 | MVP                      |
| **T-08**  | Migrations Prisma non additives → casse prod                                     | Technique  | 2   | 5   | 🟧 10 | toutes                   |
| **C-01**  | CPF vendu/promis sans certification RNCP/RS (illégal)                            | Conformité | 3   | 5   | 🟥 15 | V2                       |
| **C-02**  | Preuves de réalisation FOAD insuffisantes (R.6313-3) → remboursement OPCO refusé | Conformité | 3   | 5   | 🟥 15 | MVP                      |
| **C-03**  | Ind.11 absent (évaluations qui jalonnent) = non-conformité MAJEURE Qualiopi      | Conformité | 2   | 5   | 🟧 10 | MVP                      |
| **C-04**  | Ind.19 : assistance technique ET pédagogique non formalisée                      | Conformité | 3   | 4   | 🟧 12 | MVP                      |
| **C-05**  | RGPD : vidéo proctoring / logs / PII handicap mal gérés                          | Conformité | 2   | 4   | 🟧 8  | MVP→V2                   |
| **C-06**  | Conservation des preuves mal calibrée (purge trop tôt / trop tard)               | Conformité | 2   | 4   | 🟧 8  | MVP                      |
| **P-01**  | Adoption faible (apprenants ne finissent pas)                                    | Produit    | 4   | 3   | 🟧 12 | post-MVP                 |
| **P-02**  | Contenu à produire = goulot (pas de cours = pas de plateforme)                   | Produit    | 4   | 4   | 🟥 16 | MVP                      |
| **P-03**  | Outil auteur trop complexe → l'équipe ne le remplit pas                          | Produit    | 3   | 3   | 🟩 9  | MVP→V1                   |
| **PL-01** | Sous-estimation de charge (player + quiz + auth = 3 chantiers lourds)            | Planning   | 4   | 3   | 🟧 12 | MVP                      |
| **PL-02** | Chemin critique séquentiel (data → auth → player → quiz → certif)                | Planning   | 3   | 3   | 🟩 9  | MVP                      |
| **PL-03** | Dépendances externes hors code (compte Stripe, dossier RNCP, agrément CDC)       | Planning   | 4   | 2   | 🟩 8  | V1→V2                    |

---

## 1. Risques techniques

### T-01 — Multi-tenant rétrofité : fuite de données inter-entreprises 🟥 (P4 × I5 = 20)

**Contexte.** ADR-0002 : le multi-tenant est **conçu maintenant, livré en V2**. Au MVP, `Client` reste un CRM (cf. `schema.prisma:4890`), **aucune requête n'est scopée par entreprise**. La clé d'appartenance existe déjà dans le data model (`ElearningCourse.ownerClientId`, cf. `03-DATA-MODEL/01-schema-cours-modules-lecons.md`), mais le **filtrage systématique** par tenant n'est implémenté qu'en V2. Le risque classique : un développeur V2 oublie un `where: { ownerClientId }` sur **une seule** requête (liste d'apprenants, export, reporting) et une entreprise voit les données d'une autre.

**Pourquoi P élevé.** Le scoping multi-tenant doit être appliqué sur **toutes** les requêtes du domaine (lecture ET écriture, y compris les agrégats `_count`, les exports CSV, les notifications). L'oubli ponctuel est le défaut n°1 des LMS multi-tenants rétrofités.

**Impact.** Violation RGPD (données nominatives + handicap chiffré côté `Trainee`), perte de confiance entreprise, contentieux.

**Mitigation (préventif).**

- **Poser la clé dès le MVP** (déjà fait : `ownerClientId` nullable sur `ElearningCourse`, et `tenantId`/`ownerClientId` à prévoir sur `ElearningEnrollment` et sur le compte apprenant — cf. `03-DATA-MODEL/02` et `04`). Migration additive (ADR-0008), colonne nullable : `null` = catalogue global, sinon réservé à un `Client`.
- **Centraliser l'accès données** dans une couche `src/server/elearning/data/*` (repository pattern) plutôt que des `prisma.*` éparpillés dans les server actions. Le scoping tenant V2 se branche alors en **un seul endroit** (helper `scopedWhere(ctx)`), pas dans 80 call-sites.
- **Garde de requête** : en V2, wrapper Prisma (extension `$extends` query) qui **exige** un `tenantId` explicite ou un opt-out documenté sur les modèles e-learning ; un appel sans scope throw en dev/CI.
- **Tests d'isolation adversariaux** dès le MVP (même sans multi-tenant actif) : `99-VERIFICATION/06-coherence-existant.md` — un apprenant du tenant A ne doit jamais résoudre une `lessonId`/`courseId` du tenant B (404, pas 403 qui divulgue l'existence).
- **RBAC apprenant ≠ RBAC admin** : ne pas réutiliser `requireAdminRead/Write` (`src/server/actions/knowledge/_guards.ts`) pour scoper les apprenants ; créer `requireLearnerAccess(courseId)` côté `src/server/elearning/auth/*`.

**Détection.** Tests d'isolation en CI ; audit de toutes les requêtes du domaine au moment de l'activation V2 (revue exhaustive `grep "prisma.elearning"` → chaque call doit passer par le repository scopé).

**Plan B.** Si une fuite est détectée en prod : kill-switch `ELEARNING_MULTITENANT_ENABLED=false` qui rebascule sur le mode MVP « octroi individuel Axion-IA » (pas d'espace entreprise autonome) le temps du correctif ; notification CNIL sous 72 h si données personnelles exposées.

---

### T-02 — Vidéo : dépendance Cloudflare Stream, coût, URLs signées contournables 🟧 (P3 × I4 = 12)

**Contexte.** ADR-0005 : R2 (`src/lib/r2-storage.ts`) **stocke mais ne streame pas** (pas de HLS adaptatif — confirmé : le helper ne fait que `uploadToR2`/`getSignedUrlR2`/`getSignedUploadUrlR2`, aucun packaging HLS). La vidéo passe donc par **Cloudflare Stream** (`videoAssetId` sur `ElearningLesson`, pas `r2Key`). Trois sous-risques :

1. **Dépendance fournisseur** (lock-in, panne, changement tarifaire).
2. **Coût** qui dérape si beaucoup de minutes stockées + vues.
3. **URLs signées contournées** : un apprenant partage le lien HLS signé, ou le télécharge via `yt-dlp`.

**Mitigation.**

- **Abstraction provider** : interface `VideoProvider` dans `src/server/elearning/video/provider.ts` (méthodes `createUpload()`, `getSignedPlaybackToken(assetId, userId)`, `getThumbnail()`, `deleteAsset()`), avec impl `cloudflare-stream.ts` et stub `bunny.ts` (ADR-0005 cite Bunny comme alternative UE). Ne **jamais** appeler le SDK Cloudflare directement dans les composants/actions. Migration provider = changer une impl, pas 30 fichiers.
- **URLs signées courtes** : token de lecture signé **par utilisateur**, TTL court (ex. 2–4 h, pas 90 j comme les factures), régénéré à la demande via une server action `getLessonPlaybackToken(lessonId)` qui vérifie l'accès (`ElearningEnrollment`) AVANT de signer.
- **Watermark dynamique** par utilisateur (nom/email incrusté) — ADR-0005 — dissuasif contre le repartage (traçabilité, pas blocage absolu).
- **Pas de DRM lourd** au MVP (ADR-0005 : DRM justifié uniquement premium fort) → on accepte un repartage résiduel, contré par watermark + révocation d'accès.
- **Garde-fou coût** : worker `elearning-video-usage-worker.ts` (cron) qui agrège minutes stockées/vues, alerte admin au-delà d'un seuil ; lifecycle de suppression des assets des cours `archive`.

**Détection.** Monitoring quota/coût mensuel Cloudflare ; alerte sur pic de vues anormal (même `userId`, IPs multiples = partage).

**Plan B.** Provider down → fallback message « réessayez » + leçon marquée non-bloquante temporairement (ne pas bloquer la progression sur une panne CDN). Lock-in/tarif → bascule Bunny via l'abstraction (réencodage des assets, planifiable hors ligne). Téléchargement massif → révocation `PortailAcces`/compte apprenant + watermark pour identifier la source.

---

### T-03 — INP dégradé sur le player + quiz (budget Web Vitals strict) 🟧 (P3→4 × I3 = 12)

**Contexte.** `axionia/AGENTS.md` impose **INP ≤ 100 ms p75**, **CLS = 0**, **First Load JS ≤ 75 KB gz/route**, gate `pnpm lhci` + `size-limit` (bloque > +5 KB gz vs `main`). Le **player vidéo** (lib HLS, contrôles, sous-titres) et le **moteur de quiz interactif** (drag&drop appariement/ordonnancement, 12 types) sont précisément les composants client-heavy qui font exploser INP et le bundle. Le repo a déjà un précédent documenté de tension INP sur les surfaces interactives (player/calendrier).

**Mitigation.**

- **Routes apprenant derrière auth = pas dans les 15 pages stratégiques publiques.** Négocier avec Will un **budget d'exception dédié** (comme `/appel` INP ≤ 150 / First Load ≤ 110 KB gz dans `AGENTS.md`) pour `/portail/cours/[slug]/[lessonId]` et la page quiz, **acté par ADR**. Sinon STOP & ASK (politique `AGENTS.md`).
- **Player** : charger la lib HLS en **dynamic import** (`next/dynamic`, `ssr:false`) au clic « lire », pas au chargement de page. Préférer le player natif HLS (Safari) + `hls.js` lazy uniquement pour les navigateurs sans support. Réserver l'espace (aspect-ratio CSS) pour **CLS = 0**.
- **Quiz** : composants d'interaction lourds (drag&drop) chargés par type de question, lazy ; pas de lib drag&drop globale. Privilégier des interactions natives clavier-first (cf. WCAG 2.5.7 — alternative au drag, T-/C-05). Découper le state par question (pas un re-render global à chaque keystroke → INP).
- **Heartbeat de progression** (T-06) : `navigator.sendBeacon` / requête idle, **jamais** synchrone sur l'interaction → ne pollue pas l'INP.
- **Mesure continue** : worker `content-web-vitals-monitor-worker.ts` existe déjà ; étendre le RUM aux routes e-learning. `size-limit` config par route ajoutée pour les bundles `/portail/*`.

**Détection.** `pnpm lhci` en CI sur des URLs e-learning de staging ; `size-limit` delta gate ; RUM INP p75 par route en prod.

**Plan B.** Si INP dépasse malgré tout : dégrader les interactions non essentielles (animations, transitions), passer le quiz drag&drop en fallback `<select>`/boutons (accessible **et** léger), repousser les types de questions « riches » à V1 si le MVP doit livrer dans le budget.

---

### T-04 — Cohabitation auth apprenant ↔ NextAuth : régression admin / confusion de session 🟥 (P3 × I5 = 15)

**Contexte.** ADR-0001 : auth apprenant **hybride** (magic-link `PortailAcces` par défaut + `passwordHash` argon2id **optionnel** pour les comptes entreprise), **système séparé de NextAuth** (qui ne gère que les `AdminUser`, `schema.prisma:1531` = `passwordHash` sur AdminUser). Deux mondes qui coexistent dans le **même middleware Next.js**. Risques :

- Un cookie/middleware apprenant mal scopé **intercepte ou casse** la session admin (NextAuth v5 + 2FA).
- Un apprenant atteint une route admin (escalade) ou un admin voit son contexte mêlé à celui d'un apprenant.
- Confusion sur quel `passwordHash` est lu où (Trainee vs AdminUser).

**Pourquoi I = 5.** L'admin Qualiopi est critique (génération documents légaux, données stagiaires). Toute régression NextAuth = arrêt de l'exploitation.

**Mitigation.**

- **Deux cookies disctincts, deux préfixes de route disjoints.** Admin = `src/app/[locale]/(admin)/[adminPrefix]/**` (NextAuth). Apprenant = `src/app/[locale]/portail/**` (extension de l'existant `PortailAcces`). Le middleware route par préfixe : aucune route ne peut être protégée par les deux systèmes.
- **Réutiliser le socle `PortailAcces`** (déjà éprouvé : token 64 hex, cookie HttpOnly, `portail-service.ts:getEspaceStagiaire`) plutôt qu'inventer une 3ᵉ session. `schema.prisma:6236` confirme la structure (token unique, expiresAt, revoked, lastUsedAt). Le `passwordHash` optionnel s'ajoute sur **un nouveau modèle compte apprenant** ou en colonne **nullable** sur `Trainee` (qui n'a PAS de passwordHash aujourd'hui — confirmé), distinct du `AdminUser.passwordHash`.
- **Aucune modification de la config NextAuth** dans les PRs e-learning (règle de revue : un diff e-learning qui touche `auth.ts`/`middleware.ts` NextAuth = STOP & ASK).
- **Tests de cohabitation** : (a) session apprenant active n'ouvre aucune route admin ; (b) session admin active n'est jamais dégradée par la présence d'un cookie apprenant ; (c) déconnexion d'un monde n'affecte pas l'autre.
- **argon2id** (pas bcrypt) pour le `passwordHash` apprenant, params alignés OWASP 2026 ; auth accessible (WCAG 3.3.8 : pas de test cognitif type captcha pénible — magic-link satisfait nativement ce critère).

**Détection.** Suite e2e cohabitation en CI ; alerte Sentry sur toute 401/403 NextAuth dont le volume change après un déploiement e-learning.

**Plan B.** Régression admin détectée → rollback immédiat du déploiement (image GHCR précédente, cf. ADR-0026 plateforme) ; le LMS étant feature-flaggé (`ELEARNING_ENABLED`), désactiver le flag isole l'admin sans rollback complet.

---

### T-05 — Build stub `stub.invalid` : pages e-learning cassent le build SSG 🟧 (P3 × I4 = 12)

**Contexte.** Contrat plateforme (`axionia/AGENTS.md`, ADR-0026) : le build GH Actions tourne avec `DATABASE_URL=...stub.invalid...` + `REDIS_URL=...stub.invalid...` ; `src/lib/prisma.ts` et `redis.ts` retournent un **Proxy** qui short-circuit les lectures (`[]/null/0`) et **throw sur les mutations**. Toute nouvelle page SSG qui fait un appel DB direct au build doit être couverte par le stub OU faire un early-exit. Risque : une page e-learning publique (catalogue V1, `JSON-LD Course`) ou un sitemap e-learning **plante le build** ou se rend vide silencieusement.

**Mitigation.**

- **Pages apprenant = derrière auth + `force-dynamic`** → jamais prérendues au build, donc **non concernées** par le stub (rendu runtime avec vraie DB). C'est le cas par défaut pour tout `/portail/**`. Documenter ce choix explicitement.
- **Pages publiques catalogue (V1)** : si SSG/ISR, prévoir le early-exit `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback vide>` (pattern existant `knowledge-sitemap.ts`), repeuplé par ISR `revalidate=3600` en prod. Sitemap e-learning = Route Handler `force-dynamic` (leçon apprise sur `sitemap-knowledge.xml`, cf. MEMORY).
- **Aucune mutation au build** : les workers e-learning (`elearning-*-worker.ts`) ne tournent pas au build (`BULLMQ_DISABLED=true`) — ne pas en dépendre dans un module importé par une page SSG.
- **Respecter le contrat** : ne pas toucher la string `stub.invalid`, `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED` (cf. `AGENTS.md`). Nouveaux secrets e-learning (`CLOUDFLARE_STREAM_*`, etc.) ajoutés dans `env.ts` avec validation **conditionnée** par `SKIP_ENV_VALIDATION` pour ne pas casser le build (les 8 secrets prod sont déjà absents en GH Actions).

**Détection.** Le build GH Actions échoue immédiatement si une page e-learning mute au build → détecté en PR, pas en prod.

**Plan B.** Page qui se rend vide en prod après build stub → ISR la repeuple sous 1 h ; si urgent, `revalidatePath` manuel. Build cassé → revenir à l'early-exit fallback.

---

### T-06 — Reprise auto / heartbeat de progression : perte de données, doublons 🟩 (P3 × I3 = 9)

**Contexte.** Best practice MUST-HAVE 2026 : **reprise auto persistée serveur** (`LessonProgress`, position vidéo `watch`, completion — cf. `03-DATA-MODEL/02-schema-progression-tracking.md`). Le heartbeat envoie périodiquement la position de lecture. Risques : écritures concurrentes (deux onglets), perte de progression sur déconnexion, doublons de `LessonProgress`, ou inversement spam d'écritures (charge DB).

**Mitigation.**

- **Upsert idempotent** : `LessonProgress` avec `@@unique([enrollmentId, lessonId])` ; le heartbeat fait un `upsert` (jamais de create aveugle).
- **Throttle** : heartbeat toutes ~15–30 s + flush `sendBeacon` sur `visibilitychange`/`pagehide`. Ne stocker que la **position max atteinte** (`watchedSeconds = max(ancien, nouveau)`) pour rester monotone même si les events arrivent dans le désordre.
- **Completion serveur** : la complétion d'une leçon est **décidée côté serveur** (seuil de visionnage, ex. ≥ 90 %), jamais sur la simple assertion client (lien avec T-07 anti-triche et C-02 preuves).
- **Idempotence multi-onglets** : `last-write-wins` sur la position max ; pas de verrou pessimiste (overkill).

**Détection.** Métrique « complétions sans progression intermédiaire » (anomalie) ; logs de write-rate par enrollment.

**Plan B.** Perte de position → l'apprenant reprend au dernier checkpoint persisté (dégradation acceptable). Spam d'écritures → augmenter le throttle, batcher dans un worker `elearning-progress-flush-worker.ts`.

---

### T-07 — Moteur de quiz : gating contournable (score falsifié côté client) 🟧 (P3 × I4 = 12)

**Contexte.** Le **gating par score** (ADR data model : `ElearningUnlockType.score_quiz`, `unlockScorePct`) déverrouille le module suivant **selon une vraie note** (pas attempt-only). Si la correction et le calcul du score se font côté client, un apprenant débloque tout en falsifiant la réponse réseau. C-02/C-03 : le score est aussi une **preuve de réalisation** Qualiopi (Ind.11) — il doit être **fiable**.

**Mitigation.**

- **Correction 100 % serveur.** Les bonnes réponses (`Question.correct*`) ne sont **jamais** envoyées au client avant soumission. Le client poste ses réponses, le serveur corrige, calcule le score, persiste `QuizAttempt` (cf. `03-DATA-MODEL/03-schema-quiz-evaluations.md`) et décide du déverrouillage. Server action `submitQuizAttempt(quizId, answers)`.
- **Temps serveur** (anti-triche léger, conforme CNIL proportionné) : début/fin de tentative horodatés serveur, pas client.
- **Randomisation** : tirage N parmi M + shuffle questions ET réponses → réduit la copie/partage de corrigés.
- **Déverrouillage recalculé serveur** à chaque accès leçon (`canAccessLesson(enrollmentId, lessonId)` dans `src/server/elearning/gating/*`), jamais piloté par un flag client.
- **Override admin** tracé (un admin peut débloquer manuellement, avec raison loggée — best practice « verrou affiché avec sa raison + override admin »).
- **Essai/upload (correction manuelle)** : type `essai`/`devoir` → statut `en_attente_correction`, ne débloque pas tant qu'un formateur n'a pas noté (preuve FOAD = travaux rendus).

**Détection.** Logs de tentatives ; anomalie « score parfait en < X s » ; comparaison temps serveur vs temps déclaré.

**Plan B.** Triche avérée → invalidation de la tentative (admin), re-test exigé ; pour high-stakes (RNCP V2), activer proctoring **optionnel** (CNIL : proportionné, avec alternative — cf. C-05).

---

### T-08 — Migrations Prisma non additives → casse prod 🟧 (P2 × I5 = 10)

**Contexte.** ADR-0008 + contrat plateforme : migrations **strictement additives** (CREATE TABLE / ADD COLUMN **nullable**), aucun DROP. La prod est live, l'entrypoint container fait `prisma migrate deploy`. Un `DROP`/`ALTER` destructif (ex. rendre une colonne NOT NULL sur une table peuplée, renommer) casse la migration en prod → container ne démarre pas. Précédent documenté dans MEMORY : dérive schéma↔migrations (`migrate diff` génère des DROP INDEX à ne PAS appliquer).

**Mitigation.**

- **Ajouts seulement** : nouveaux modèles `Elearning*`, colonnes nullable sur l'existant (`Trainee.passwordHash` nullable, champs inverses `Formation.elearningCourses`/`Client.coursesProprietaires` = relations sans colonne, cf. `03-DATA-MODEL/01` §7).
- **Backfill en deux temps** : (1) migration ajoute la colonne nullable ; (2) worker/script backfill ; (3) plus tard seulement, contrainte NOT NULL si vraiment nécessaire (jamais au MVP).
- **Relecture manuelle** de chaque `migration.sql` généré : si `migrate diff` propose un DROP (index vectoriel/FTS, etc.), le **retirer** (leçon MEMORY `prod-schema-drift`).
- **Pas de désync code↔schéma** : tout champ écrit par le code doit exister dans une migration appliquée en prod (leçon MEMORY `content-publish-wordcount-mismatch`). CI : `prisma migrate diff` doit être vide entre `schema.prisma` et les migrations.

**Détection.** `prisma migrate deploy` en staging avant prod ; CI drift check.

**Plan B.** Migration échoue en prod → rollback image GHCR (la migration n'a pas tourné si l'entrypoint a échoué tôt) ; migration corrective additive ; jamais de `migrate reset` en prod.

---

## 2. Risques de conformité

### C-01 — CPF vendu/promis sans certification RNCP/RS (illégal) 🟥 (P3 × I5 = 15)

**Contexte.** **Fait réglementaire dur** (ADR-0003) : le CPF exige une **certification RNCP ou RS** ; un e-learning non certifiant **n'est PAS éligible CPF**. Le risque n'est pas technique mais **commercial/juridique** : que la plateforme (page de vente, EDOF) laisse croire à une éligibilité CPF avant l'obtention de la certification (dossier France Compétences, **hors code**, long). Aggravé par la loi anti-fraude 2022-1587 (sanctions EDOF).

**Mitigation.**

- **Flag `EDOF_ENABLED=false` par défaut** (ADR-0003). Tant que `false` : aucune mention « finançable CPF », aucun bouton EDOF, aucun parcours d'achat CPF. Le code est « ready » mais **dormant** (pattern Stripe `STRIPE_ENABLED`, cf. `env.ts:105`).
- **Garde double** : l'activation CPF d'un cours exige `EDOF_ENABLED=true` **ET** un champ `certificationRncpRsId` non vide sur le cours (preuve d'une certif rattachée). Sinon, l'UI CPF reste masquée et la server action refuse.
- **Wording verrouillé** : au MVP, vocabulaire = « finançable **OPCO** / entreprise / vente directe », jamais « CPF » (cf. roadmap : MVP explicitement « pas CPF »). Bannir « CPF »/« Mon Compte Formation » des templates publics tant que flag off (lint de contenu, cf. banned-phrases existant côté content-gen).
- **Documentation séparée** du dossier de certification (`08-CONFORMITE/04-dossier-certification-rncp-rs.md`) — c'est une démarche métier de Will, pas un livrable code.

**Détection.** Revue de contenu avant chaque mise en ligne d'un cours ; test : avec `EDOF_ENABLED=false`, aucune route/CTA CPF n'est atteignable.

**Plan B.** Mention CPF erronée publiée → retrait immédiat (le flag coupe tout) ; si un financement CPF a été pris à tort, régularisation (ce qui est exactement ce que le flag évite). Ne **jamais** activer EDOF avant l'enregistrement effectif au RNCP/RS.

---

### C-02 — Preuves de réalisation FOAD insuffisantes → remboursement OPCO refusé 🟥 (P3 × I5 = 15)

**Contexte.** **Conformité FOAD dure** : `R.6313-3` = **preuve libre** mais **faisceau de preuves** exigé (un relevé de connexion SEUL est **insuffisant**). En contrôle, l'OPCO peut réclamer : évaluations, travaux rendus, logs LMS, traces d'accompagnement. Sans cela → **remboursement refusé / récupération de fonds**. Le **certificat de réalisation** (modèle officiel, heures réalisées) est obligatoire depuis le 01/06/2020.

**Mitigation (la plateforme doit PRODUIRE les preuves, pas juste les rendre possibles).**

- **Faisceau de preuves natif** capturé dès le MVP (transversal — roadmap lot 9) :
  - **Progression** (`LessonProgress`, completion serveur — T-06) = traces LMS.
  - **Évaluations** (`QuizAttempt`, scores horodatés — T-07) = jalons d'évaluation (Ind.11, C-03).
  - **Travaux rendus** (leçon type `devoir`, upload R2 + correction formateur) = preuve d'activité réelle.
  - **Temps/assiduité** : durée de visionnage agrégée + connexions (réutilise la logique `ReleveConnexionImport`/`PresenceCreneau` côté synchrone comme inspiration, mais asynchrone = logs LMS propres).
  - **Traces d'assistance** (messages tuteur, délais de réponse — Ind.19, C-04).
- **Certificat de réalisation officiel** : réutiliser `DocumentGenere` + QR (`qrToken`) et le moteur `@react-pdf/renderer` existant. **Heures réalisées en centièmes** (cohérent avec le certificat R.6313-3 présentiel déjà produit par le code Qualiopi). Server action `genererCertificatRealisationElearning(enrollmentId)`.
- **Export « dossier de preuves »** par apprenant/session : un ZIP (progression + scores + travaux + logs + traces tuteur) exportable par l'admin pour répondre à un contrôle (`06-CONSOLE-ADMIN/08-reporting-analytics.md`). C'est le livrable anti-C-02.
- **Information de durée moyenne** (D.6313-3-1 §2) affichée et stockée (`ElearningCourse.dureeEstimeeMinutes`).

**Détection.** Checklist de complétude des preuves par enrollment (l'admin voit en un coup d'œil ce qui manque pour un dossier OPCO).

**Plan B.** Preuve manquante au moment d'un contrôle → l'export consolide ce qui existe ; si insuffisant, ne pas facturer l'OPCO sur ce dossier (mieux vaut renoncer qu'un trop-perçu récupéré). Renforcer la capture pour les sessions suivantes.

---

### C-03 — Ind.11 absent (évaluations qui jalonnent/concluent) = non-conformité MAJEURE 🟧 (P2 × I5 = 10)

**Contexte.** `D.6313-3-1` §3 = la FOAD doit comporter des **évaluations qui jalonnent et concluent** l'action. C'est l'indicateur **Qualiopi Ind.11**, et son absence est une **non-conformité MAJEURE** (pas mineure) → risque sur la certification Qualiopi elle-même (donc sur TOUT l'organisme, pas juste l'e-learning).

**Mitigation.**

- **Quiz bloquants by design** : le data model impose déjà le gating par évaluation (`unlockType: score_quiz`). Un cours FOAD (`estFoad=true`) **doit** avoir au moins une évaluation jalon + une évaluation de conclusion → **règle de validation à la publication** : la server action `publishCourse(courseId)` refuse si `estFoad && aucun Quiz bloquant` (garde Ind.11).
- **Évaluation de positionnement** (entrée) + **évaluations intermédiaires** (par module) + **évaluation finale** (certificat) = structure recommandée dans l'outil auteur (template par défaut).
- Lier explicitement chaque cours à la cartographie Ind.11 dans `08-CONFORMITE/02-qualiopi-indicateurs-foad.md`.

**Détection.** Gate de publication (technique) + audit conformité `99-VERIFICATION/03-audit-conformite.md`.

**Plan B.** Cours publié sans évaluation jalon → dépublication automatique impossible à contourner (la garde de publication empêche la situation en amont). Si découvert en audit Qualiopi : ajout d'évaluations + republication avant la visite.

---

### C-04 — Ind.19 : assistance technique ET pédagogique non formalisée 🟧 (P3 × I4 = 12)

**Contexte.** `D.6313-3-1` §1 = assistance **technique ET pédagogique** accessible (tutorat, **délais formalisés**) = **Ind.19**, **seule obligation FOAD nommée** explicitement dans Qualiopi V8. Risque : on livre le contenu mais pas le **dispositif d'accompagnement** ni la **trace** qu'il existe.

**Mitigation.**

- **Canal d'assistance** dès le MVP (même basique) : formulaire/messagerie apprenant → admin/formateur, avec **délai de réponse affiché** (ex. « réponse sous 48 h ouvrées ») et **horodatage** des échanges (la trace = preuve C-02).
- **Réutiliser l'existant** : emails Nodemailer + `email-worker.ts` + templates React Email ; espace formateur (`FormateurMagicLink`) pour que le formateur réponde. Modèle `ElearningAssistanceMessage` (ou réutilisation d'un fil de discussion) sous `src/server/elearning/assistance/*`.
- **V1 : tuteur RAG** (roadmap V1, `04-BACKEND/09`) — assistance pédagogique **ancrée avec citations** (réutilise le knowledge/RAG existant). Attention : le tuteur RAG **complète** mais ne **remplace pas** l'assistance humaine exigée par Ind.19 (un bot ne coche pas seul l'indicateur).
- **Délais formalisés** documentés dans les CGV/fiche programme + affichés dans l'espace apprenant.

**Détection.** Trace des messages + délai moyen de réponse mesuré (reporting) ; audit Ind.19.

**Plan B.** Si le volume dépasse la capacité de réponse : FAQ/base de connaissances + élargir les créneaux de tutorat ; ne jamais laisser l'assistance sans réponse au-delà du délai affiché (sinon Ind.19 tombe).

---

### C-05 — RGPD : vidéo proctoring / logs / PII handicap mal gérés 🟧 (P2 × I4 = 8)

**Contexte.** `Trainee` contient déjà des **PII + données handicap chiffrées + consentements** (`schema.prisma:5274`). L'e-learning ajoute : logs de connexion/visionnage, IP, éventuel **proctoring** (V2 RNCP). CNIL : proctoring **proportionné, optionnel, avec alternative** ; conservation des **logs techniques 6 mois–1 an** ; pas de surveillance excessive.

**Mitigation.**

- **Pas de proctoring au MVP/V1** (anti-triche léger suffit — T-07). Proctoring seulement high-stakes RNCP (V2), **opt-in**, base légale + DPIA, **alternative** non-vidéo proposée (CNIL).
- **Minimisation** : ne logger que le nécessaire à la preuve FOAD (progression, scores, durées) ; IP hashée si stockée (pattern existant `IP_HASH_SALT` côté image-bank). Pas de tracking comportemental marketing dans l'espace apprenant.
- **Réutiliser le socle RGPD** : `DemandeRgpd` (export/suppression, `schema.prisma:6275+`), `retention-purge-worker.ts` existant → étendre la purge aux données e-learning selon les durées de C-06.
- **Watermark vidéo** = donnée minimale (nom déjà connu de l'apprenant), pas de captation biométrique.
- **Sous-traitants** : Cloudflare Stream / Bunny = ajout au **registre des sous-traitants** (`/sous-processeurs` existe déjà). Bunny = option résidence UE (ADR-0005) si requis.

**Détection.** Registre des traitements à jour ; DPIA pour le proctoring V2 ; audit `99-VERIFICATION/04-audit-securite-rgpd.md`.

**Plan B.** Demande d'effacement → réconcilier preuve légale (conservation obligatoire C-06) vs droit à l'effacement (les obligations légales de conservation priment et justifient le refus partiel, motivé). Proctoring contesté → désactivation + bascule alternative.

---

### C-06 — Conservation des preuves mal calibrée (purge trop tôt / trop tard) 🟧 (P2 × I4 = 8)

**Contexte.** Durées **multiples et différentes** : 10 ans comptable (`L.123-22`), 6 ans fiscal/OPCO (`L.102B LPF`), **3–5 ans preuves de réalisation** (`L.6362-6`), **6 mois–1 an logs techniques** (CNIL 2021-122). Risque : purge uniforme qui détruit trop tôt une preuve OPCO, OU conservation illimitée des logs/PII (violation RGPD minimisation).

**Mitigation.**

- **Politique de rétention par catégorie** (pas une durée unique) encodée dans `retention-purge-worker.ts` (étendu) : preuves de réalisation (certificat, scores, travaux) = 5 ans ; pièces comptables/factures = 10 ans (déjà géré côté Invoice/R2) ; logs techniques/IP = 12 mois max ; vidéo source = liée au cycle de vie du cours.
- **Champ `categorieRetention` + `dateExpurgation`** calculés à la création de chaque preuve (déterministe, auditable).
- **Soft-delete d'abord** (anonymisation) plutôt que hard-delete quand une preuve croise plusieurs régimes.
- Référence MEMORY : un cron de purge 5→10 ans était déjà un follow-up identifié côté France-only ; aligner.

**Détection.** Rapport annuel de rétention ; alerte sur données au-delà de la durée max RGPD non purgées.

**Plan B.** Preuve purgée trop tôt et réclamée → impossible à reconstituer (d'où la priorité préventive) ; calibrer prudent (conserver le plus long des régimes applicables à une même pièce). Données gardées trop longtemps → purge corrective + note au registre.

---

## 3. Risques produit

### P-02 — Contenu à produire = goulot d'étranglement 🟥 (P4 × I4 = 16)

**Contexte.** Une plateforme LMS **sans cours** ne vaut rien. Produire un parcours e-learning de qualité (scénarisation, vidéos, quiz, évaluations conformes Ind.11) est **long et coûteux** et ne dépend pas du code. C'est le risque produit n°1 du MVP (« un cours » selon la roadmap).

**Mitigation.**

- **MVP = UN seul cours** (roadmap), pas un catalogue → concentre l'effort de production sur un parcours exemplaire.
- **Réutiliser le Formation Engine IA existant** (`qualiopi-formation-engine-worker.ts` : intention → structure Backward Design → qualité → contenu) pour **amorcer** la scénarisation et générer un premier jet de modules/leçons/quiz, puis relecture humaine. L'IA quiz-gen (V1, `04-BACKEND/08`) et l'authoring document-grounded accélèrent encore.
- **Microlearning** (leçons 2–10 min) : plus facile à produire incrémentalement qu'un gros module ; permet de publier un cours « assez complet » plus tôt.
- **Outil auteur facile** (P-03) pour que l'équipe (pas un dev) remplisse.
- **Vidéo légère acceptable au MVP** : slides commentées / screencast suffisent (pas besoin de studio) — Cloudflare Stream transcode tout.

**Détection.** Jalon « 1er cours publié + testé bout-en-bout par un apprenant pilote » = vrai critère de sortie MVP (pas seulement « le code marche »).

**Plan B.** Pas de cours prêt à la date → lancer avec un cours pilote court (1–2 modules) en interne/beta avant la commercialisation ; ne pas ouvrir la vente tant qu'un parcours conforme Ind.11 n'existe pas.

---

### P-01 — Adoption faible (apprenants ne finissent pas) 🟧 (P4 × I3 = 12)

**Contexte.** Taux de complétion notoirement bas en e-learning asynchrone. Impact : mauvaise réputation, OPCO méfiants, mais aussi **risque conformité indirect** (Ind.12 anti-décrochage attendu en V1).

**Mitigation.**

- Best practices MUST-HAVE intégrées : reprise auto, barre de progression, microlearning, mobile-first, certificat (motivation).
- **Relances automatiques anti-décrochage** (V1, Ind.12) via `email-worker` + cron `elearning-relance-worker.ts` : déclencheurs sur inactivité N jours, module non commencé, échéance qui approche.
- **Drip raisonnable** (pas de pacing rigide imposé — à éviter selon best practices) : déverrouillage progressif mais pas frustrant ; verrou **affiché avec sa raison**.
- **Éviter les anti-patterns** : pas d'autoplay, pas de classements imposés, pas de gating attempt-only.

**Détection.** Analytics de complétion/temps/scores (V1, `06-CONSOLE-ADMIN/08`) ; cohortes.

**Plan B.** Complétion faible → tutorat plus proactif (C-04), raccourcir les leçons, ajouter des jalons motivants ; en dernier recours, accompagnement synchrone (live) en complément du FOAD.

---

### P-03 — Outil auteur trop complexe → l'équipe ne le remplit pas 🟩 (P3 × I3 = 9)

**Contexte.** L'objectif est un **outil auteur FACILE** (brief). Un course-builder trop technique = l'équipe ne crée pas de contenu (rejoint P-02).

**Mitigation.**

- **MVP : outil auteur minimal** (roadmap lot 8) — créer cours/modules/leçons, upload, quiz, publier. Pas de drag&drop complet au MVP (V1).
- **Réutiliser les composants admin existants** (`AdminPageShell`, `AdminTable`, `AdminBadge`, formulaires) → cohérence, pas de réapprentissage.
- **Brouillon → publication** (statut `brouillon`/`publie`/`archive` déjà au data model) + **aperçu as-student** (V1) pour que l'auteur voie le rendu réel.
- **Templates de cours** pré-remplis (structure Ind.11 par défaut) → l'auteur remplit, ne conçoit pas la structure.
- **Upload média transcodé auto** (Cloudflare Stream) → l'auteur ne gère pas l'encodage.

**Détection.** Test d'utilisabilité avec un membre non-dev de l'équipe avant V1.

**Plan B.** Outil jugé trop dur → import par CSV/structuré + génération IA du squelette (Formation Engine) en attendant le drag&drop V1.

---

## 4. Risques de planning

### PL-01 — Sous-estimation de charge (player + quiz + auth = 3 chantiers lourds) 🟧 (P4 × I3 = 12)

**Contexte.** Le MVP empile trois chantiers chacun substantiels : **auth apprenant** (cohabitation NextAuth, T-04), **player vidéo** (HLS + reprise + Web Vitals, T-02/T-03/T-06) et **moteur de quiz** (12 types, correction serveur, gating, T-07). Sous-estimer l'un décale tout (chemin critique, PL-02).

**Mitigation.**

- **Découper en lots livrables** suivant l'ordre de la roadmap (data → auth → octroi → vidéo → player → quiz → certif), chaque lot testable indépendamment.
- **Réduire le périmètre MVP du quiz** : livrer 3–4 types essentiels (QCM mono/multi, vrai-faux, réponse courte) au MVP ; les types riches (appariement, ordonnancement, drag&drop) en V1 (cohérent avec le budget INP T-03).
- **Réutilisation maximale** (chaque brique réutilisée = charge évitée) : `PortailAcces` pour l'auth, `DocumentGenere`+QR pour le certificat, `r2-storage` pour les médias, Formation Engine pour le contenu, console admin pour l'outil auteur.
- **Estimations chiffrées** dans `11-ROADMAP/03-estimation-charges.md` (à tenir à jour) ; ajouter une marge sur les 3 chantiers lourds.

**Plan B.** Retard sur un chantier → livrer le MVP avec un sous-ensemble (ex. quiz QCM only, vidéo sans watermark dynamique d'abord) et compléter en V1.

---

### PL-02 — Chemin critique séquentiel 🟩 (P3 × I3 = 9)

**Contexte.** La roadmap (§ Dépendances critiques) est très séquentielle : `data model → auth → octroi → player+progression → quiz+gating → certificat`. Un blocage amont gèle tout l'aval.

**Mitigation.**

- **Paralléliser ce qui peut l'être** : le **pipeline vidéo** (Cloudflare Stream) est indépendant et peut avancer en parallèle de l'auth (la roadmap le note : la vidéo se branche en parallèle). L'**outil auteur minimal** peut se développer dès que le data model est posé.
- **Mocker les dépendances amont** : développer le player contre des fixtures de progression avant que l'octroi soit fini.
- **Le data model d'abord, en entier** (lot 1) : poser TOUS les modèles (y compris quiz, progression, accès) en une vague de migrations additives, pour ne pas re-migrer à chaque lot.

**Plan B.** Blocage amont → basculer l'effort sur les chantiers parallèles (vidéo, outil auteur, conformité/preuves) pendant la résolution.

---

### PL-03 — Dépendances externes hors code (Stripe, RNCP, agrément CDC) 🟩 (P4 × I2 = 8)

**Contexte.** Trois jalons **hors du contrôle de l'équipe dev** : compte **Stripe** (ADR-0004, paiement CB V1), certification **RNCP/RS** (ADR-0003, CPF V2, dossier France Compétences long), **agrément/habilitation EDOF + FranceConnect+** (CDC, V2). Risque : on attend ces externes pour livrer.

**Mitigation.**

- **Tout est flag-gated** (ADR-0003/0004) : le code est livré « ready » et **dormant**. L'absence de Stripe/RNCP/EDOF **ne bloque PAS** le MVP (virement + octroi manuel ; OPCO/entreprise/vente directe sans CPF). C'est précisément la stratégie de découplage des ADR.
- **MVP ne dépend d'aucune externe** : il se vend en OPCO/entreprise/direct dès qu'un cours existe (P-02).
- **Documenter les démarches métier** séparément (`08-CONFORMITE/04`) pour que Will les lance en parallèle du dev, sans bloquer le code.

**Plan B.** Externe en retard → on reste en MVP/V1 sans la feature gated ; activation = poser un flag + clés le jour venu (zéro refonte). C'est l'objet même des ADR-0003/0004.

---

## 5. Risques résiduels acceptés (à surveiller, pas de plan d'action immédiat)

| Risque                                                              | Pourquoi accepté                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Repartage résiduel de vidéo (watermark dissuasif, pas de DRM lourd) | ADR-0005 : DRM injustifié hors premium fort ; coût/UX > bénéfice.      |
| Pas de SCORM/xAPI/LTI au lancement                                  | ADR-0006 : besoin commercial non avéré ; tracking modélisé xAPI-ready. |
| EN désactivé (FR only)                                              | Contrainte plateforme ; e-learning FR canonique, `langue` champ prévu. |
| Multi-tenant absent au MVP                                          | ADR-0002 : octroi individuel + import CSV couvrent le besoin V1.       |

---

## 6. Gates de phase liés aux risques

- **Gate MVP (ne pas livrer sans)** : T-04 (tests cohabitation auth verts), T-07 (correction quiz 100 % serveur), C-02 (export dossier de preuves fonctionnel), C-03 (garde de publication Ind.11), C-04 (canal d'assistance + délai), P-02 (1 cours pilote conforme testé bout-en-bout).
- **Gate V1** : T-03 (budgets Web Vitals tenus sur routes e-learning, `lhci` + `size-limit` verts), P-01 (relances Ind.12 actives), reporting/preuves consolidés.
- **Gate V2** : T-01 (audit d'isolation multi-tenant exhaustif), C-01 (certification RNCP/RS effective AVANT `EDOF_ENABLED=true`), C-05 (DPIA proctoring si activé).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 → 0008 (sources des arbitrages cités)
- `00-INDEX/README.md` — index maître & carte réutilisé/neuf
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage & dépendances critiques
- `11-ROADMAP/02-backlog-epics-stories.md` — backlog détaillé (à rédiger)
- `11-ROADMAP/03-estimation-charges.md` — charges par phase (PL-01)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson`, enums (T-01, C-03)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `LessonProgress` (T-06, C-02)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz/Question/QuizAttempt` (T-07, C-03)
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant (T-04)
- `03-DATA-MODEL/06-strategie-migrations.md` — migrations additives (T-08)
- `04-BACKEND/05-authentification-apprenant.md` — cohabitation NextAuth (T-04)
- `04-BACKEND/07-pipeline-video-streaming.md` — Cloudflare Stream / Bunny (T-02)
- `04-BACKEND/09-tuteur-rag-assistant.md` — tuteur RAG (C-04)
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — player & INP (T-03, T-06)
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — gating (T-07)
- `08-CONFORMITE/01-foad-d6313-3-1.md` — FOAD (C-02, C-03, C-04)
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind.11/12/19 (C-03, C-04, P-01)
- `08-CONFORMITE/03-cpf-edof-readiness.md` — CPF/EDOF gated (C-01)
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — RGPD & rétention (C-05, C-06)
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves (C-02)
- `09-QUALITE/03-web-vitals-performance.md` — budgets (T-03)
- `09-QUALITE/04-accessibilite-wcag22.md` — WCAG 2.2 AA (T-03, T-07)
- `99-VERIFICATION/04-audit-securite-rgpd.md` — audit (T-01, C-05)
- `99-VERIFICATION/06-coherence-existant.md` — tests d'isolation (T-01, T-04)
