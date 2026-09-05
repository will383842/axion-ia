# Qualiopi — session du 2026-09-05 · état vivant

> Tenu **au fil de l'eau**. Si Claude Code se referme, **c'est ce fichier qu'on
> relit en premier**. Le transcript, jamais.
> Dernière écriture : 2026-09-05 ~05:00 UTC (07:00 heure de Paris).

---

## 0ter. 🔴 LE PLAFOND DE SESSION A TUÉ CINQ AGENTS D'UN COUP (10:20)

`HTTP 429 — You've hit your session limit · resets 10:20am`. Les cinq agents
encore vivants sont morts **en même temps**, en pleine écriture, laissant
**58 fichiers non commités** dans l'arbre. C'est exactement le scénario que Will
avait anticipé en demandant un filet de relance.

⚠️ **Le filet a été REPOUSSÉ de 10:40 à 12:30** (vérifié : `NextRunTime
09/05/2026 12:30:30`). Motif : cette session a survécu, et ouvrir une seconde
session Claude dans un arbre portant 58 fichiers à moitié écrits aurait été plus
dangereux que l'absence de filet.

### Ce que la récupération a appris — trois pièges, tous payés ici

**1. 🔴 `pnpm typecheck 2>&1 | tail -40` rend l'exit code de `tail`, pas de `tsc`.**
La sortie affichait `[exited with code 0]` **sur un typecheck portant 5 erreurs** —
le corps disait `ELIFECYCLE Command failed with exit code 2`. La règle était déjà
en mémoire et c'est elle qui a sauvé : **lire la bannière ET LE CORPS**, jamais le
code de sortie d'une chaîne de tubes. Le contrôle juste est
`npx tsc --noEmit; echo ${PIPESTATUS[0]}` — ou pas de tube du tout.

**2. 🔴 `git checkout -- <fichier>` pour annuler une mutation de test EMPORTE le
travail non commité du même fichier.** Je l'avais interdit aux agents, je l'ai
fait moi-même, et j'ai perdu les quatre modifications de `DocumentsSection.tsx`
qu'il fallait refaire. **Une mutation de test se restaure par RÉ-ÉDITION**, ou
depuis une copie faite hors du dépôt — jamais par git.

**3. 🔴 Une garde peut être ROUGE DÈS SA NAISSANCE si l'on n'a lancé que des
tests ciblés.** `outbox-policy.spec.ts` était rouge **depuis le commit `f12917ced`**
(lot A, la veille) : il inscrivait `piece-exemplaire-signe` parmi les envois
automatiques sans l'ajouter à `TEMPLATES_REELS`, une liste **recopiée à la main**
dans le témoin. Personne ne l'a vu parce que seuls quatre fichiers ciblés avaient
été lancés. Corrigé en faisant DÉRIVER la liste de `EMAIL_TEMPLATE_NAMES`
(`Object.keys(TEMPLATES)`, 53 entrées) — la divergence devient impossible, et la
définition obtenue est plus forte : un envoi déclaré automatique sans composant
échouerait au rendu, et le témoin l'attrape désormais.

### Le défaut trouvé DANS un correctif du jour

La soupape de l'attestation (« j'assume l'absence de preuves ») était **inerte
dans son cas principal, et fabriquait le gel qu'elle devait éviter** : on passait
la garde, on posait le claim atomique, puis `tauxPresencePct ?? 0` classait à
« aucune » — l'inscription sortait **sans pièce**, `attestationGenereeAt` posé, et
le cron (qui filtre sur `null`) ne la reprenait **plus jamais**.

🔑 **Un taux INCONNU n'est pas un taux de 0 %.** Le taux quitte donc la soupape :
il lève un refus DUR (`AttestationTauxNonMesureError`) qui dit quoi faire. On peut
assumer par écrit l'absence d'une trace ou d'une évaluation ; on ne peut pas
attester une assiduité dont on n'a aucune mesure — il n'y aurait rien à attester.

⛔ **Reste ouvert** : les lignes DÉJÀ gelées en base ne sont pas rattrapées.
Aucun script de reprise n'a été écrit (l'agent est mort avant). Les repérer :
`attestationGenereeAt` non nul + `attestationDocumentId` nul +
`attestationResultat = "aucune"` **alors qu'une trace d'assiduité existe**.
L'attestation leur est due par la loi.

---

## 0bis. REPRISE du 2026-09-05, 07:30 **heure locale** — ce qui a changé depuis

⚠️ *Correction : la première rédaction de ce titre disait « 07:30 UTC ». Faux —
l'horloge de ce poste est en **UTC+2**. 07:30 local = 05:30 UTC. C'est le piège
déjà consigné en mémoire : un horodatage GitHub est en UTC, l'horloge de la
machine ne l'est pas, et les deux ne se comparent pas sans conversion.*

- ✅ **Les deux contrôles bloquants du §4 sont PASSÉS**, bannières lues :
  - `pnpm typecheck` → `> tsc --noEmit`, exit 0, sur l'arbre complet
  - gardes de dépôt `tests/unit/ci/` → **31 fichiers, 151 témoins, 271 s, exit 0**
    (jamais lancées jusqu'ici cette session)
- ✅ **Lot B — le câblage UI est LIVRÉ et poussé** : commit `01a42897c`.
  N1 (montant), N2 + F4 (modalité et libellés dérivés), N4 (filigrane COPIE),
  N5 + F7 (acompte), F10 (repères J-n). Détail au §5, qui est à jour.
- ✅ **ADR 0048 écrit** — l'arbitrage du distanciel est TRANCHÉ :
  `docs/adr/0048-formation-a-distance-ce-qui-se-construit-et-ce-qui-s-achete.md`.
- 🔄 **Cinq agents travaillent en parallèle** dans CE MÊME arbre, sur des zones
  de fichiers disjointes, avec interdiction absolue de toute commande git
  mutante. Le lead seul commite. Zones : alertes (lot D) · documents et
  attestations (lot E) · composants et pages admin (reste du lot B) · audit
  formateur/commissions en lecture seule (lot F) · émargement, notifications
  et gabarits d'e-mail (lot C couche A).

### Mesures prises à 08:35 heure locale (06:35 UTC)

| | |
|---|---|
| `origin/main` | **`0452729b5`** — a bougé, ma base était `f62368221` |
| **Prod sert** | `0452729b5` ✅ vérifié : `curl -sI https://axion-ia.com/fr` |
| Écart de ma branche | **2 commits de retard, 11 d'avance**, **15 fichiers** — **aucun dans la zone Qualiopi**. La fusion sera propre. |
| Build mesuré (run `33947545789`) | `Build & push` **50 min 09 s** · `Trigger Coolify deploy` **3 min 40 s** · total **53 min 49 s** |

🔑 **Le run affichait encore `in_progress` alors que la prod servait déjà le
nouveau SHA.** Il restait `Warm edge cache` et `Lighthouse CI post-deploy`, tous
deux POST-atterrissage. **Lire le RUN au lieu des JOBS fait croire que la file
est occupée ~25 min de plus qu'elle ne l'est.** Toujours descendre au niveau des
jobs avant de conclure qu'un créneau est pris.

⚠️ **Les 2 commits de `main` ajoutent une garde de dépôt**
(`tests/unit/ci/une-pr-empilee-est-gardee.spec.ts`) et modifient
`.github/workflows/ci.yml`. Le passage vert de `tests/unit/ci/` obtenu ce matin
(31 fichiers, 151 témoins) a été mesuré AVANT eux : **il faudra le refaire après
la mise à niveau sur `main`**, sur 32 fichiers.

⚠️ **File de fusion RÉSERVÉE par la session `axion-ia-20`** (capture apporteurs)
depuis ~07:35 **heure locale** (05:35 UTC), pour #987 puis #993. Elle a mesuré le build de #991 à
**1 h 16**, pas 50 min. Ne rien fusionner avant qu'elle rende la file.

---

## 0. Où on en est en une phrase

**#991 fusionnée et ATTERRIE en production.** Le défaut le plus grave — *rien ne
part après la contresignature* — est **corrigé, gardé et commité**. Le socle du
lot 3 est posé côté serveur. Il reste le **câblage UI** du lot 3, puis le
**distanciel** (lot 2), les **alertes**, la **facturation** et les **commissions**.

---

## 1. L'état mesuré, pas déduit

| | |
|---|---|
| `origin/main` | **`f62368221`** — #991 fusionnée le 2026-09-05 à 03:57:28 UTC |
| **Production sert** | `f62368221` ✅ **vérifié par moi** : `curl -sI https://axion-ia.com/fr \| grep x-axion-build-sha` |
| Jobs du run 33943260861 | `Build & push` ✅ · `Trigger Coolify deploy` ✅ · `IndexNow` ✅ · `Telegram` ✅ · `lhci` ⏳ · `Warm edge cache` ⏳ |
| **File de fusion** | **LIBRE pour le build.** Fusionner maintenant tuerait seulement le job `lhci` post-deploy (25-26 min), pas le déploiement. |
| Ma branche | `qualiopi/session-editable-et-conventions` — **poussée sur `origin`**, 5 commits, arbre PROPRE |
| Autre session | `axion-ia-84` (recrutement, arbre `wt-recrutement`). Ne réserve rien, ne fusionne rien. Prévenue. |

⚠️ `lhci` est **post-atterrissage** : ne pas l'attendre pour reprendre la main.
C'est écrit dans `AGENTS.md`, § durée du build.

---

## 2. Acquis EN PRODUCTION — ne pas refaire, ne pas casser

La session du **5 septembre** existe pour de vrai.

- Convention **`AXI-DOC-2026-039`** — SIRET `90143483700018`, 4 rue Dervieux
  42000 Saint-Étienne, **100,00 €**, acompte **0 %**, **sans filigrane COPIE**.
- Envoyée **20:47 UTC** à `la boîte personnelle de la cliente (masquée — dépôt PUBLIC)`, **signée par la cliente**,
  **contresignée 21:33 UTC**.
- Questionnaire de positionnement envoyé **20:51 UTC** à `la boîte personnelle de la stagiaire (masquée — dépôt PUBLIC)`.
- Pièces `030`, `037`, `038` **annulées au registre avec motif**.

Identifiants : client `AXI-CLI-001` SCI Invest Sun
`eeaa0351-6846-4307-acaa-b7b73239a724` · stagiaire Simone Blanc
`068304cd-8948-4e9b-83a6-8e79ca223b09` · session `AXI-SESS-2026-001`
`0d4e0c8b-3aaa-4ec9-a8ff-d830f8a68613` · formateur Williams Jullin
`4f0abec3-a1ee-4640-9eca-ea4f5a116e1c`.

---

## 3. Les 5 commits déjà écrits (branche poussée)

| SHA | Objet | État |
|---|---|---|
| `e4d01fd5b` | `docs` — sauver du temporaire les 2 audits que la coupure a failli emporter | ✅ |
| `ced63a85b` | `fix` — le suivi de dossier menait à un bloc qui n'existe pas (ancres) | ✅ vu rougir |
| `f12917ced` | 🔴 `fix` — **la boucle contractuelle se referme** (lot A) | ✅ vu rougir ×3 |
| `43713542e` | `feat` — le filet `exemplaire_signe_non_transmis` | ✅ garde a rougi seule |
| `34bf4840b` | `feat` — socle lot 3 : montant, modalité, mots dérivés | ⚠️ **serveur seul, UI non câblée** |

### Ce que `f12917ced` a réellement fait

- `DocumentGenere.exemplaireSigneEnvoyeAt` + `exemplaireSigneKey` + index
  (migration `20260905040000_exemplaire_signe_transmission`, nom d'index
  **épinglé** parce que le nom dérivé par Prisma ferait 65 car. > 63).
- `src/server/qualiopi/documents/signature/transmission-exemplaire.ts` — remise
  idempotente **par revendication**, qui **relâche** en cas d'échec.
- Gabarit `piece-exemplaire-signe` inscrit aux **4 points** obligatoires :
  `queue/types.ts`, `email/templates/index.tsx`, `email/apercu/catalogue.ts`,
  `email/outbox-policy.ts` (dans les envois **automatiques**, pas la corbeille).
- Branché dans `consequenceSignatureComplete` (`piece-signature.ts`), **avant**
  les branches par type — c'est le seul point que traversent les DEUX canaux.

---

## 4. Vérifications faites, et leur verdict EXACT

| Contrôle | Verdict |
|---|---|
| `le-suivi-mene-au-geste.spec.ts` | 4/4 · **vu rougir** (ancre `formateur-inexistant` → 1 failed) |
| `libelles-acces.spec.ts` | 18/18 · a rougi d'elle-même sur « salle d'attente » (garde trop large, corrigée) |
| `transmission-exemplaire.spec.ts` | 19/19 · **vu rougir ×3** (organisme non exclu · revendication non conditionnelle · `relacher()` retirés) |
| `catalogue.spec.ts` | 30/30 · **a rougi seule** à l'ajout du code (liste explicite) |
| `pnpm typecheck` | ✅ **bannière lue**, exit 0, **sur l'arbre complet des 6 commits** |
| `pnpm lint` | ✅ **0 erreur**, 73 warnings tous préexistants (fichiers de test) |
| `pnpm qualiopi:isolation-check` | ✅ **bannière lue** — `11649 fichiers scannés, 0 violation, 63 consommateurs assumés` |

### ⛔ CE QUI RESTE À VÉRIFIER

1. ✅ **FAIT le 2026-09-05 à 07:37 heure locale** — gardes de dépôt `tests/unit/ci/` :
   **31 fichiers, 151 témoins, 271 s, exit 0.** (Le « ~17 min » annoncé était
   large : 4 min 31 s en réalité.)
2. La **suite complète** `pnpm test` — pas encore lancée. À faire avant la PR,
   une fois les cinq agents rendus.
3. La **recette PAR L'ÉCRAN** de la remise d'exemplaire : aucune convention n'a
   été signée depuis le correctif, donc la boucle n'a **jamais été vue se
   refermer en vrai**. C'est une correction PROUVÉE PAR TÉMOINS, pas VÉCUE.
   Le refaire sur une vraie pièce est le premier geste de recette.

---

## 5. LE PLAN — ce qui reste, dans l'ordre

| Lot | Objet | État |
|---|---|---|
| 0 | Fusionner #991 + vérifier l'atterrissage | ✅ **FAIT ET VÉRIFIÉ** |
| A | 🔴 Rien ne part après la contresignature | ✅ **FAIT** |
| B | Lot 3 — session éditable | 🟡 **socle fait, UI à câbler** |
| C | Lot 2 — distanciel de bout en bout | ⏳ carte du terrain FAITE (§7) |
| D | Moteur d'alertes — 11 trous restants | ⏳ 1/12 fait |
| E | Attestation · certificat · facture · échéancier | ⏳ carte du terrain FAITE (§8) |
| F | Formateur défaillant · commissions | ⏳ audit à REFAIRE (sortie vide) |
| G | Vérification de bout en bout | ⏳ |

### Lot B — ✅ LES 5 PREMIERS POINTS SONT LIVRÉS (`01a42897c`)

**Faits, gardés, vus rougir** : N1 · N2 + F4 · N4 · N5 + F7 · F10.
Ce qui suit est conservé pour la trace de CE qui a été corrigé et POURQUOI.
Le reste (F1, F2, F5, F8, F9, N6, débordement) est confié à un agent.

⚠️ Deux découvertes en cours de route, qui ne figuraient dans aucun audit :

- **le contrat B2C garde délibérément 30 %** d'acompte (= son plafond
  L.6353-6). Son gabarit n'a AUCUNE branche « payable en totalité » : à 0 %, il
  imprimerait « Acompte à l'expiration du délai de rétractation (0 % maximum) :
  0,00 € » sur la pièce que le PARTICULIER signe. Écrit dans le code — ne pas
  « harmoniser » les deux défauts sans écrire d'abord cette branche.
- **F10 cachait un SECOND défaut** dans la même fonction : `Math.ceil` sur des
  millisecondes fait dire « demain » pour une échéance due AUJOURD'HUI à 17 h
  lue à 9 h. « Aujourd'hui » n'était atteignable qu'une fois l'échéance
  DÉPASSÉE. Trouvé en écrivant le témoin du premier, pas en relisant le code.

Le détail de ce qui a été corrigé :

1. **N1 UI** — un `SessionMontantForm` (copier `SessionDatesForm.tsx`), monté
   dans `qualiopi/sessions/[id]/financement/page.tsx`. Doit AFFICHER le retour
   `piecesFinancieres` : « 2 pièces annoncent l'ancien montant, il faudra les
   réémettre ».
2. **N2 + F4 UI** — `LieuFieldset.tsx` doit appeler `libellesAcces()` au lieu de
   ses 5 chaînes en dur, et `SessionLieuForm.tsx` doit exposer un `<select>` de
   modalité + afficher `incoherenceModaliteLieu()`.
3. **N4** 🔴 — `ConventionDocButton` (`DocumentsSection.tsx:774-874`) est le
   **seul** bouton de la section qui n'appelle pas `useMotifRectification`
   (`:220`). Conséquence prouvée : régénérer une convention produit
   **TOUJOURS** un filigrane COPIE, sans aucun moyen de faire autrement depuis
   l'UI. Il a son propre composant à cause du champ acompte — c'est comme ça
   qu'il a échappé au correctif.
4. **N5 + F7** — l'acompte par défaut est **30 %**, affirmé à 4 endroits dont
   celui qui s'imprime : `templates/convention.tsx:170`
   (`data.acomptePercent ?? 30`). Et le champ est SOUS le bouton qui le
   consomme. → défaut `0`, champ AU-DESSUS.
5. **F10** 🔴 défaut réel — les repères « (J-n) » du suivi sont comptés depuis
   AUJOURD'HUI mais notés comme un décalage à la SESSION.
   `parcours/etat-echeance.ts:191`. « Évaluation finale (J-3) » pour du J+2.
6. **N6** — le SIRET saisi ne s'affiche pas dans la liste clients. **À TAGGER
   `code` ou `données` et à reconfirmer en prod** avant d'en faire un défaut.
7. **F1** entreprise saisie 2× en texte libre · **F2** consentements muets sur
   leurs conséquences · **F5** montant HT jamais pré-rempli depuis le tarif de
   l'offre · **F8** « Confirmer les journées » ne crée pas les créneaux ·
   **F9** liens d'émargement perdus à la navigation · bloc Documents qui déborde
   horizontalement.

---

## 6. Sources déjà payées — NE PAS repayer

| Source | Où | Contenu |
|---|---|---|
| Audit **moteur d'alertes** | `_AUDIT/AUDIT-MOTEUR-ALERTES-2026-09-04.md` | **COMPLET** — 80 codes, 54 règles, **12 trous**, 3 codes émis hors catalogue |
| Frictions UI + distanciel | `_AUDIT/FRICTIONS-UI-ET-DISTANCIEL-2026-09-04.md` | F1→F10, D1→D5 |
| Recette réelle | `_SESSIONS/2026-09-04_RECETTE-REELLE-DISTANCIEL-FORMATEUR.md` | sur `main` |
| Carte **distanciel** | §7 ci-dessous | rendue par agent, 2026-09-05 |
| Carte **facture/attestation** | §8 ci-dessous | rendue par agent, 2026-09-05 |
| Audit **pilotage formateur** | ❌ **sortie de 0 octet** | l'agent est mort avant d'écrire — **à refaire** |

---

## 7. Carte du DISTANCIEL (lot C) — faits vérifiés, avec chemins

**Il n'existe AUCUNE intégration Zoom / Teams / Meet.** `ls src/server/visio
src/lib/zoom*` → rien. Aucun `ZOOM_*` ni `GRAPH_*`. Ce qui existe : le **parsing
CSV a posteriori** (`src/server/qualiopi/presence/parse-{zoom,teams,meet}.ts`) et
l'enum `PlateformeDistanciel { zoom teams meet autre }` (`schema.prisma:6549`).

| Fait | Preuve |
|---|---|
| `lieuVisioUrl` = **URL nue**, `@db.Text`, sans expiration ni révocation | `schema.prisma:5382` |
| Le stagiaire ne reçoit **JAMAIS** l'URL — seulement l'hôte | `notifications-service.ts:218` et `:391` via `formatLieu` |
| Le formateur, LUI, la reçoit en clair et cliquable | `_infos-pratiques-formateur.tsx:62-64` |
| Le portail stagiaire montre **titre, état, dates. Rien d'autre** | `portail/mon-espace/formations/page.tsx:64-89` |
| **Aucun rappel J-1 stagiaire** (il n'existe que côté formateur) | `queues.ts:1622-1624` |
| L'inscription est **1 action = 1 stagiaire**, aucun `createMany` | `enrollments.ts:71-116` |
| `prisma.trainee.findMany` **sans `take`** charge TOUTE la table | `sessions/[id]/page.tsx:387` |
| `nbParticipantsPrevus` n'est **opposé à rien** | aucune règle ne le lit |

**Les briques à réutiliser, elles existent déjà :**

- **Jeton lié à l'empreinte du destinataire** : `creerTokenCoaching`
  (`src/server/qualiopi/emargement/token-service.ts:314`) — SHA-256 hex de
  l'adresse minuscule trimée, colonne `EmargementToken.destinataireEmailSha256`
  (`schema.prisma:7991`). ⚠️ **Le chemin COLLECTIF (`creerTokenInscription`,
  `:138`) ne l'écrit PAS** — le binding n'existe qu'en AFEST 1-to-1.
- **Contrôle avant vol bloquant** : le patron EXISTE, pour les horaires —
  `TokenEmargementError("journees_non_declarees" | "horaires_non_confirmes")`,
  `token-service.ts:149-173`. Doctrine écrite `:41-50` : « le refus se produit à
  la CRÉATION DU LIEN, devant l'admin qui peut corriger, et non devant le
  stagiaire en salle qui ne le peut pas ». **C'est exactement le patron à
  copier.**
- **Envoi par personne à l'échelle** : `envoyerRappelJ7`
  (`notifications-service.ts:311`) — boucle sur tous les inscrits, `continue` sur
  échec (jamais `return false` : le correctif du 2026-08-24 avait constaté que le
  premier échec privait les 9 autres).
- **Patron d'intégration tierce** : `src/lib/docuseal.ts` (711 l.) — le seul
  module qui traite complètement *client HTTP / secret / mode dégradé / webhook
  signé*. `isDocusealConfigured()` `:41`, `AbortSignal.timeout(15_000)` `:227`,
  classe d'erreur avec `statusCode` `:240`.
- **Variable d'env OPTIONNELLE** : `z.string().optional()` dans `src/env.ts`,
  remappée dans `runtimeEnv` (`:552+`), et **le refus dur vit dans le MODULE**,
  jamais dans `env.ts` (motif écrit `src/env.ts:50-56` : une exigence bloquante
  y ferait échouer le BOOT du conteneur). ⇒ **c'est ce qui permet de tolérer
  l'absence de licence Zoom/Teams sans rien casser.**
- **Import CSV** : deux patrons — parsing CLIENT
  (`ImportFacturesHistoriqueForm.tsx`, plafond 500 annoncé avant l'aller-retour)
  et parsing SERVEUR (`ImportReleveForm.tsx`, archivage R2 + SHA-256 +
  `unmatched Json`). **Le second est le bon pour un import de stagiaires.**

**✅ ARBITRAGE TRANCHÉ le 2026-09-05 — ADR 0048.**
`docs/adr/0048-formation-a-distance-ce-qui-se-construit-et-ce-qui-s-achete.md`

En une phrase : **Zoom**, mais **rien à acheter maintenant**.

L'énoncé « Zoom ou Teams » posait la question comme un ACHAT. Le défaut
bloquant, lui, ne coûte rien : le stagiaire ne reçoit jamais le lien parce que
`formatLieu` réduit l'URL à son nom d'hôte (`format-lieu.ts:54`) et que la
convocation passe par lui (`notifications-service.ts:218`). Une session à
distance est donc décrivable, facturable, conventionnable — et **personne ne
peut s'y connecter**. L'ADR sépare donc :

- **couche A** — la porte d'entrée : coût **nul**, faite maintenant ;
- **couche B** — le relevé d'assiduité par API : c'est elle seule qui justifie
  un abonnement, et les 3 analyseurs CSV la rendent différable sans blocage.

🔑 **Google Meet est ÉCARTÉ pour un motif dur**, alors que tout le reste de la
pile est Google : son relevé de présence passe par les API d'administration
**Workspace**, et le compte utilisé (`williamsjullin@gmail.com`) est un compte
**personnel**, sans domaine ni console d'administration. Le candidat qui
paraissait gratuit se paie en MIGRATION. Teams est écarté pour son locataire
Azure AD et son consentement administrateur — une infrastructure d'entreprise
pour un organisme d'une personne.

⚠️ `PlateformeDistanciel` reste inchangée et `autre` reste un chemin de plein
droit : **Zoom est le chemin OUTILLÉ, jamais le chemin OBLIGATOIRE.**

---

## 8. Carte FACTURE / ATTESTATION (lot E) — faits vérifiés

- **`certificat_realisation` EXISTE** (enum `schema.prisma:6210`, gabarit
  `templates/certificat-realisation.tsx:151`) mais n'est produit **QUE par un
  clic admin** — exclu de toute production automatique
  (`production-au-jalon.ts:212-217`).
  🔴 Le commentaire `:203-207` justifie l'exclusion en affirmant qu'un circuit
  automatique existe. **C'est faux** : `attestation-service.ts:376` ne produit
  que `attestation` / `attestation_partielle`.
- 🔴 **Asymétrie confirmée** : l'**attestation** (due au STAGIAIRE, L.6353-1)
  est MOINS gardée que le **certificat** (dû au FINANCEUR). L'action manuelle
  `genererAttestationAction` n'exige **ni évaluation finale ni émargement** ;
  seul le CRON exige `evaluations: { some: { type: "finale" } }`
  (`crons-worker.ts:427-429`). Le certificat, lui, exige `tauxPresencePct !==
  null` **et** une `EmargementSignature` non révoquée (`documents.ts:653-658`,
  `:686+`).
- Libellé de `attestation` = « Attestation **de réalisation** »
  (`libelles-type-document.ts:63`) — c'est le vocabulaire du certificat.
- **Aucune facture ne part seule.** Le seul cron qui crée
  (`plan-recurrent.ts:105`) ne fait que des **brouillons**.
- **L'échéancier existe** mais seulement en mémoire + sur le PDF du contrat B2C
  (`financements/acompte.ts:430`, `echelonnerSolde` `:295`). **Aucun modèle
  Prisma `Echeancier`**, aucun écran. **Quatre circuits d'acompte coexistent et
  ne se parlent pas.**
- 🔴 **TVA** : l'ordre permanent de Will est « toujours facturée, jamais
  d'exonération ». **Le code ne le fait pas** : `exoneration_261` et
  `franchise_293b` sont des chemins de première classe (`legal/tva.ts:28`), le
  régime est relu depuis la config à chaque émission (8 sites), et un override
  par ligne `tauxTvaPercent: 0` court-circuite tout (`tva.ts:64-66`). Le DÉFAUT
  est bien `assujetti`. **→ ARBITRAGE WILL avant de verrouiller quoi que ce
  soit.**

---

## 9. Les 11 trous d'alertes restants (le 12ᵉ est fait)

Par priorité, tels que l'audit les a rendus :

1. `formateur_desiste_session` — **le seul risque 100 % muet.** Le statut
   `retiree` n'est lu par aucune règle ; l'incident `desistement` n'alimente que
   `sous_traitant_incidents_repetes`, qui exige ≥2 faits sur 24 mois.
2. `convocation_stagiaire_manquante` — J-2 sur `convocationEnvoyeeAt` nul.
3. `session_distanciel_sans_lien` — J-2, `lieuVisioUrl` vide en distanciel.
4. **Élargir les bornes** de `convention_tripartite_manquante`,
   `formateur_non_habilite_assigne`, `formateur_indisponible_sur_session` :
   **quatre alertes critiques s'auto-effacent au démarrage de la session**,
   c'est-à-dire quand le risque devient un fait.
5. **Cataloguer** `email_corbeille_indisponible` (critique !),
   `positionnement_hors_delai`, `email_retenu_*` — émis SANS entrée au
   catalogue ⇒ routés vers **aucune boîte** et **jamais auto-résolus**.
6. `emargement_partiel` — les 4 règles d'émargement ne traitent que le ZÉRO.
7. `formateur_rc_pro_absente` / URSSAF **étendues hors `sous_traitant`**.
8. `effectif_depasse`.
9. `session_realisee_non_facturee`.
10. Recalibrer : `session_sans_formateur` en **critique** quand la session a
    démarré ; `suppression_rgpd_j30` de `info` à `important`.

---

## 10. Pièges de cette session — déjà payés, ne pas re-payer

- 🔴 **`prisma/generated/` est PAR ARBRE** (`output = "../prisma/generated/client"`,
  gitignoré) — mais `node_modules` est un **lien symbolique partagé** vers
  `axionia/node_modules`. Le typecheck de wt-app30 a échoué au démarrage sur
  `sans_reponse` parce que la branche précédait #991. **Le remède est de
  fast-forward la branche sur `main`, pas de régénérer.**
- 🔴 **Les heredocs `bash` échouent** sur ce poste au-delà d'environ 150 lignes
  (`unexpected EOF looking for matching '`). Pour un gros fichier : utiliser
  l'outil **Write**, ou un script **Python** pour les patchs chirurgicaux.
- `pnpm typecheck` ≈ **10-13 min**, `pnpm lint` ≈ **10 min**,
  `qualiopi:isolation-check` > **5 min**, un `vitest run` ciblé ≈ **1 min**
  (dont ~45 s d'environnement). Les lancer en arrière-plan, **et lire la
  bannière**.
- `gh pr merge` peut ne **rien afficher** en réussissant. Vérifier par
  `gh pr view --json state,mergedAt`.

---

## 11. Ce qui restera pour Will (à ne PAS trancher à sa place)

1. **TVA** — l'ordre permanent (« toujours facturée ») n'est pas implémenté, et
   trois chemins d'exonération sont actifs. Verrouiller ou assumer ? (§8)
2. **Zoom ou Teams** — je dois trancher moi-même selon mes recommandations et
   écrire l'ADR ; mais l'abonnement, lui, est une dépense de Will.
3. **N6 SIRET** — à reconfirmer en PROD avant d'en faire un défaut : un constat
   sur des données de seed n'est pas un défaut de prod.
4. 🔴 **La commission d'apporteur d'affaires est PUBLIÉE et CHIFFRÉE sur le site
   public, sans aucun back-office** (audit D11, 2026-09-05). `content/pricing.ts`
   annonce **500 €/journée**, **30 % audit**, **15 % intégration** (`:820`,
   `:886`, `:896`) — et il n'existe dans ce dépôt **aucun modèle, aucun calcul,
   aucun paiement, aucun rapprochement**. Rien ne rattache une vente à un
   apporteur.

   Ce n'est pas un défaut de code à corriger ici : c'est un **engagement public
   chiffré** sans la machine qui l'honore. Deux sorties, et elles t'appartiennent :
   soit la machine se construit (elle est planifiée dans `axion-partners`, 197
   tâches), soit les montants quittent les pages publiques en attendant.
   ⚠️ Le constat est **borné à ce dépôt** : `axion-partners` n'a pas été ouvert
   par l'auditeur.
5. **Payer un formateur sur une session que le client n'a pas réglée** (audit D2).
   ⚠️ Volontairement NON bloqué, et c'est un arbitrage à connaître : ce qui est dû
   à un sous-traitant l'est au titre de SON contrat, pas de la trésorerie de
   l'organisme — refuser de payer un formateur qui a animé parce que le client
   traîne serait un manquement, pas une garde. Le correctif engagé rend donc
   l'encaissement client **VISIBLE au moment de la décision**, et laisse
   l'arbitrage humain. Si tu veux un blocage dur, c'est toi qui le décides.
