# Plan accessibilité WCAG 2.2 AA — LMS e-learning Axion-IA

> Spécification opérationnelle d'accessibilité pour la plateforme e-learning. Exploitable par une équipe de dev senior : checklist par composant, critères WCAG 2.2 (dont les 9 nouveaux), sous-titres, clavier, focus, contrastes, **alternative au drag du builder**, **authentification accessible**, méthode de validation.
>
> Statut : socle de spécification (doc `09-QUALITE/04`). Dernière mise à jour : 2026-06-27.
> Référentiel cible : **WCAG 2.2 niveau AA** (norme harmonisée **EN 301 549**, opérationnalisée en France via **RGAA 4.1**).

---

## 0. Pourquoi c'est non négociable (obligation légale)

L'**European Accessibility Act** (directive UE 2019/882, transposée en droit français par l'ordonnance 2023-859 + décret) impose l'accessibilité des **services numériques au public** — dont la **formation en ligne (FOAD) et l'e-commerce** — depuis le **28 juin 2025**. La cible d'Axion-IA (SAS, particuliers + équipes d'entreprises) est **dans le périmètre**.

- **Norme de référence** : `EN 301 549` (qui transpose WCAG 2.1 AA ; l'alignement WCAG 2.2 est la trajectoire 2026). On vise **WCAG 2.2 AA** directement pour être en avance.
- **Référentiel d'audit FR** : **RGAA 4.1** (106 critères) sert de grille opérationnelle de preuve en France.
- **Sanctions EAA** : mise en demeure + amende administrative (jusqu'à plusieurs dizaines de k€ par manquement selon le décret). Un **schéma pluriannuel** + **déclaration d'accessibilité** + **page « Accessibilité »** sont attendus.
- **Convergence Qualiopi** : l'**Indicateur 26** (prise en compte des publics en situation de handicap) et le **référent handicap** déjà présents dans le code (`HandicapDeclarationForm.tsx`, champ handicap chiffré sur `Trainee`) rendent l'accessibilité de la **plateforme de formation** cohérente avec l'engagement Qualiopi. Une plateforme FOAD inaccessible fragilise l'audit Qualiopi.

> **Conséquence projet** : l'accessibilité n'est pas une « passe finale » — chaque composant LMS neuf (player, quiz, builder, dashboard, auth) embarque ses exigences a11y dès le ticket. Le gate CI (cf. §11) bloque les régressions.

---

## 1. État de l'art du repo — EXISTANT réutilisable

Audit du code réel : la base Axion-IA est **déjà mûre en a11y**. Le LMS hérite de ces acquis (ne pas réinventer).

| Acquis existant                                                                                                                                          | Emplacement                                                                    | Réutilisation LMS                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tokens couleur annotés WCAG AA** (`--color-fg-muted` = 5.0:1 sur paper / 4.8:1 sur ivoire ; `--color-sage` assombri à 5.0:1 ; `--color-error` #b8341c) | `src/app/globals.css` (`@theme`, lignes ~13-65)                                | Réutiliser **tels quels**. Interdiction d'introduire une couleur LMS hors palette sans vérif contraste.                                       |
| **`:focus-visible` global** (`outline: 2px solid var(--color-primary); outline-offset: 2px`)                                                             | `globals.css` ~217                                                             | S'applique automatiquement aux composants LMS. Ne jamais faire `outline: none` sans remplacement conforme (cf. SC 2.4.11/2.4.13).             |
| **`@media (prefers-reduced-motion: reduce)` strict** (coupe animations, marquee, reading-progress, view-transitions)                                     | `globals.css` ~417-444, ~988                                                   | Le **player** (transitions de contrôles), le **builder** (animations dnd-kit) et la **barre de progression cours** DOIVENT respecter ce bloc. |
| **Pattern skip-link** (« Aller au contenu »)                                                                                                             | `app/[locale]/{guides,blog,connaissances}/[slug]/page.tsx`, clé i18n `fr.json` | Extraire en composant partagé `src/components/a11y/SkipLink.tsx` et l'utiliser sur **toutes** les pages apprenant + admin LMS.                |
| **`@dnd-kit/core` + `/sortable` + `/utilities`** (déjà en deps)                                                                                          | `package.json` ~103-105                                                        | **Clé pour le builder** : dnd-kit fournit un `KeyboardSensor` natif → alternative clavier au drag « gratuite » (cf. §6, SC 2.5.7).            |
| **axe-core 4.11.4 + `@axe-core/playwright`**                                                                                                             | `node_modules`, probe `_AUDIT/E2E-NAV-CTA-2026-05-15/axe-runtime-probe.mjs`    | Réutiliser le pattern de probe pour les tests a11y automatisés LMS (cf. §11).                                                                 |
| **Playwright 5 projets** (Desktop Chrome/WebKit/Firefox + Pixel 7 + iPhone 14 Pro)                                                                       | `playwright.config.ts`                                                         | Tests clavier + responsive + lecteur d'écran sur ces matrices.                                                                                |
| **Lighthouse CI** (catégorie `accessibility` WARN ≥0.9, `target-size`/`color-contrast`/`label-content-name-mismatch` WARN)                               | `lighthouserc.json`                                                            | À **ratcheter en ERROR** pour les routes LMS authentifiées (nouveau fichier de gate, cf. §11).                                                |
| **Stack i18n FR canonique**                                                                                                                              | `next-intl`, `messages/fr.json`                                                | `lang="fr"` déjà posé ; tout libellé a11y (aria-label, sr-only) passe par `fr.json` (jamais de string en dur).                                |

> **Limite connue (dette plateforme, à ne pas reproduire dans le LMS)** : sur le site public, `target-size` et `bf-cache` sont en WARN (zones tactiles < 48px sur nav/footer mobile). Le LMS **neuf** part propre : cibles ≥ 44×44 CSS px (cf. SC 2.5.8).

---

## 2. Principes transverses (à appliquer partout)

1. **HTML sémantique d'abord, ARIA en dernier recours.** Boutons = `<button>`, liens = `<a>`, titres `<h1..h6>` hiérarchiques, listes = `<ul>/<ol>`. ARIA seulement quand le natif ne suffit pas (player custom, quiz interactifs).
2. **Tout au clavier.** Aucune action LMS exclusivement souris/tactile/glisser (SC 2.1.1, 2.5.7).
3. **Focus toujours visible et jamais piégé** (SC 2.4.7, 2.1.2), **jamais masqué** par header/footer/toast collants (SC 2.4.11 — nouveau).
4. **Régions live** pour les changements asynchrones (sauvegarde progression, score quiz, déverrouillage module) via `aria-live` (réutiliser le pattern `role="status"` déjà présent dans le repo).
5. **Contraste AA** : texte normal ≥ 4.5:1, texte large (≥ 24px ou 19px bold) ≥ 3:1, composants UI/état (focus, bordure d'input, icône signifiante) ≥ 3:1 (SC 1.4.3, 1.4.11).
6. **`prefers-reduced-motion`** respecté : pas d'autoplay vidéo, pas de parallaxe, transitions coupées.
7. **Cibles tactiles ≥ 44×44 px** (on dépasse le minimum WCAG de 24px ; SC 2.5.8).
8. **Texte redimensionnable 200 %** sans perte (SC 1.4.4) + **reflow 320px** sans scroll horizontal (SC 1.4.10) — mobile-first, déjà dans les budgets.
9. **i18n** : libellés a11y dans `messages/fr.json` sous namespace `elearning.a11y.*`.
10. **Page « Déclaration d'accessibilité »** publique (`/accessibilite`) + lien d'aide **cohérent** (SC 3.2.6 — nouveau).

Composant partagé à créer : `src/components/a11y/` (transverse, hors silo elearning car réutilisable site) avec `SkipLink.tsx`, `VisuallyHidden.tsx`, `LiveRegion.tsx`, `FocusTrap.tsx` (modales).

---

## 3. Les 9 nouveaux critères WCAG 2.2 — impact LMS

WCAG 2.2 (W3C Recommendation, 2023) ajoute 9 critères et **retire** le 4.1.1 _Parsing_ (obsolète — React produit du DOM valide, sans objet). Voici les **6 critères de niveau A/AA** (les 3 AAA sont notés pour info) avec leur incidence directe sur le LMS.

| SC         | Niveau | Intitulé                                | Où ça mord dans le LMS                                                                                                                   | Exigence concrète                                                                                                                                                                                                |
| ---------- | ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.4.11** | AA     | **Focus Not Obscured (Minimum)**        | Player (barre de contrôles sticky), builder (toolbar collante), dashboard (header admin sticky), toasts de sauvegarde                    | L'élément focalisé ne doit **jamais être entièrement caché** par un overlay collant. Prévoir `scroll-padding-top`/`scroll-margin` = hauteur du header sticky ; les toasts ne recouvrent pas la zone focalisable. |
| **2.5.7**  | AA     | **Dragging Movements**                  | **Builder course** (réordonner modules/leçons par drag), réordonnancement banque de questions, quiz **appariement** & **ordonnancement** | Toute action drag DOIT avoir une **alternative sans glisser** (boutons monter/descendre, menu « Déplacer vers… », ou clavier dnd-kit). Détail §6 et §5.                                                          |
| **2.5.8**  | AA     | **Target Size (Minimum)**               | Contrôles player (play/vitesse/CC), cases quiz, poignées de drag, pagination dashboard                                                   | Cibles ≥ **24×24 px** (on impose **44×44** en interne). Si plus petit : espacement suffisant autour (offset 24px).                                                                                               |
| **3.2.6**  | AA     | **Consistent Help**                     | Toutes les pages apprenant + auth                                                                                                        | Le **mécanisme d'aide** (lien tuteur/contact/aide, Qualiopi Ind.19) apparaît au **même endroit relatif** sur chaque page (header ou footer apprenant).                                                           |
| **3.3.7**  | AA     | **Redundant Entry**                     | Auth apprenant, octroi/inscription, formulaires devoir/profil                                                                            | Ne pas redemander une info déjà saisie dans le même process (pré-remplir email à l'étape 2 du magic-link ; autocomplete).                                                                                        |
| **3.3.8**  | AA     | **Accessible Authentication (Minimum)** | **Auth apprenant** (magic-link + mot de passe optionnel)                                                                                 | Pas de **test cognitif** (puzzle, calcul, retranscription d'image) comme seul moyen de connexion. Détail §8.                                                                                                     |
| 2.4.12     | AAA    | Focus Not Obscured (Enhanced)           | (viser sur player)                                                                                                                       | Focus **totalement** visible. Cible best-effort.                                                                                                                                                                 |
| 2.4.13     | AAA    | Focus Appearance                        | (déjà ~ok via outline 2px)                                                                                                               | Indicateur de focus épais/contrasté. Notre outline 2px + offset 2px s'en approche.                                                                                                                               |
| 3.3.9      | AAA    | Accessible Authentication (Enhanced)    | (magic-link y répond naturellement)                                                                                                      | Pas de reconnaissance d'objet/contenu non-texte. Le magic-link satisfait déjà l'AAA.                                                                                                                             |

> **Bonne nouvelle structurelle** : l'auth par **magic-link** (`PortailAcces` existant) satisfait **nativement** 3.3.8 **et** 3.3.9 (rien à mémoriser, rien à transcrire). Le risque 3.3.8 ne concerne que le **mot de passe optionnel entreprise** et un éventuel anti-bot (cf. §8).

---

## 4. Checklist composant — LECTEUR DE COURS (player vidéo + leçon)

**NEUF.** Composants : `src/components/elearning/player/CoursePlayer.tsx`, `VideoPlayer.tsx`, `LessonShell.tsx`, `LessonNavigation.tsx`. Vidéo = **Cloudflare Stream HLS** (ADR-0005) ; ne pas auto-héberger ; sous-titres = ressource VTT (`ElearningResource.type = "sous_titres"`, stockée R2 via `r2-storage.ts`).

### 4.1 Choix du player (décision a11y structurante)

- **NE PAS** écrire un player vidéo custom complet (risque a11y énorme : sous-titres, clavier, annonces).
- **Recommandé** : `<media-chrome>` + `hls.js`, **ou** le player Cloudflare Stream `<stream>` web component **enrichi de contrôles accessibles**, **ou** `vidstack`. Tous fournissent : contrôles clavier, gestion des pistes texte (`<track kind="captions">`), labels ARIA, focus management.
- **Budget Web Vitals** : player en `next/dynamic` (`ssr: false`) + chargé à l'interaction (pas au LCP) ; pas d'autoplay. Le risque **INP** est ici réel (cf. `09-QUALITE/03-web-vitals-performance.md`).

### 4.2 Sous-titres & transcripts (obligation forte FOAD + WCAG)

| Exigence                                                  | SC                | Implémentation                                                                                                                                                                                                                         |
| --------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sous-titres** pour toute vidéo pré-enregistrée          | 1.2.2 (A)         | Piste VTT `kind="captions"` (FR). Stockée comme `ElearningResource(type="sous_titres", r2Key=...)` liée à la `ElearningLesson` vidéo. Le builder **bloque la publication** d'une leçon `video` sans piste VTT (gate qualité, cf. §10). |
| **Transcription textuelle** sous le lecteur               | 1.2.1 / 1.2.3 (A) | Champ `contenuJson` de la leçon ou ressource `type="transcript"` → rendu en `<details>` « Transcription » sous la vidéo, navigable clavier, indexable. Double bénéfice **SEO/AEO**.                                                    |
| **Audio-description** (si visuel essentiel non verbalisé) | 1.2.5 (AA)        | Recommandé pour les démos d'écran : verbaliser à l'oral ce qui est montré OU fournir une version audiodécrite. À cadrer côté production de contenu (consigne auteur).                                                                  |
| Sous-titres **lisibles**                                  | 1.4.x             | Contraste AA du rendu CC, taille ajustable, position non superposée aux contrôles.                                                                                                                                                     |

> **Génération assistée** : le worker `elearning-video-worker.ts` (NEUF) peut déclencher une transcription auto (modèle ASR) → VTT brouillon **relu par un humain** avant publication (jamais publier un sous-titre auto non vérifié : SC 1.2.2 exige une qualité réelle).

### 4.3 Clavier & contrôles (checklist)

- [ ] Tous les contrôles atteignables au **Tab**, activables **Entrée/Espace** ; ordre logique (play → timeline → volume → vitesse → CC → plein écran).
- [ ] Raccourcis standards si custom : `Espace`/`k` play-pause, `←/→` ±5s, `↑/↓` volume, `c` sous-titres, `f` plein écran — **annoncés** dans un panneau d'aide et **désactivables** (éviter conflit lecteur d'écran).
- [ ] **Timeline = `role="slider"`** avec `aria-valuemin/max/now`, `aria-valuetext` (« 2 min 14 sur 8 min »).
- [ ] **Pas d'autoplay** (SC 1.4.2 + reduced-motion) ; si lecture auto un jour, bouton pause atteignable en ≤ 1 Tab.
- [ ] Contrôles **≥ 44×44 px** (SC 2.5.8), espacés.
- [ ] Barre de contrôles sticky → ne masque pas le focus du contenu (SC 2.4.11 : `scroll-margin-bottom`).
- [ ] **Focus visible** sur chaque contrôle (hérite outline global ; vérifier sur fond vidéo sombre → ajouter halo/contour blanc si contraste < 3:1 sur l'image).

### 4.4 Navigation leçon / déverrouillage

- [ ] Sommaire du cours = `<nav aria-label="Plan du cours">` avec `<ol>` de modules/leçons.
- [ ] Leçon **verrouillée** : `aria-disabled="true"` + **raison affichée en texte** (pas seulement une icône cadenas) — ex. « Verrouillé : réussissez le quiz du module 2 (seuil 70 %) ». La raison vient des champs `ElearningModule.unlock*` / `ElearningLesson.unlock*` (cf. data model doc 01). **SC 1.4.1** : ne pas coder le verrou uniquement par la couleur/l'icône.
- [ ] **Déverrouillage** d'un module après réussite → annonce `aria-live="polite"` : « Module 3 débloqué ».
- [ ] Reprise auto : à l'ouverture, annoncer « Reprise à la leçon X » (la position vient de `LessonProgress`, doc 02). Bouton « Reprendre » focalisé.
- [ ] Progression sauvegardée (heartbeat) → `role="status"` discret « Progression enregistrée » (pas de vol de focus).

---

## 5. Checklist composant — MOTEUR DE QUIZ

**NEUF.** Composants : `src/components/elearning/quiz/QuizRunner.tsx`, `QuestionCard.tsx`, par type : `QcmQuestion.tsx`, `TrueFalseQuestion.tsx`, `MatchingQuestion.tsx`, `OrderingQuestion.tsx`, `ClozeQuestion.tsx`, `ShortAnswerQuestion.tsx`, `EssayQuestion.tsx`, `FileUploadQuestion.tsx`. Données : `Quiz`/`Question`/`QuizAttempt` (doc 03). Gating par score réel (pas attempt-only) → l'a11y du quiz est **bloquante** pour la progression : un quiz inaccessible = apprenant bloqué = non-conformité FOAD **et** WCAG.

### 5.1 Structure & sémantique par type

| Type de question                | Pattern accessible                                                                     | Points de vigilance                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **QCM mono** (1 bonne réponse)  | `<fieldset><legend>énoncé</legend>` + `<input type="radio">` natifs                    | Ne PAS faire des `<div role="radio">` si évitable. `legend` = énoncé complet.                                                            |
| **QCM multi**                   | `<fieldset><legend>` + `<input type="checkbox">`                                       | Indiquer « Plusieurs réponses possibles » dans la `legend`.                                                                              |
| **Vrai/Faux**                   | idem radio                                                                             | —                                                                                                                                        |
| **Appariement** (matching)      | Listes `<select>` natives (« associer A → … ») **OU** dnd-kit avec **fallback select** | **SC 2.5.7** : si drag, fournir les `<select>`. Le natif `<select>` est souvent **plus accessible** que le drag → recommandé par défaut. |
| **Ordonnancement**              | Boutons **monter/descendre** par item + dnd-kit `KeyboardSensor`                       | **SC 2.5.7** obligatoire : jamais drag-only. Annoncer la nouvelle position en `aria-live`.                                               |
| **Texte à trous** (cloze)       | `<input>`/`<select>` inline avec `<label>` masqué (« Trou 1 sur 3 »)                   | Chaque trou a un label programmatique.                                                                                                   |
| **Réponse courte**              | `<input type="text">` + label visible                                                  | `autocomplete` off pour réponses libres.                                                                                                 |
| **Essai** (correction manuelle) | `<textarea>` + label + compteur caractères annoncé                                     | Sauvegarde brouillon `aria-live`.                                                                                                        |
| **Upload** (devoir)             | `<input type="file">` natif + zone drop **optionnelle**                                | **SC 2.5.7** : le drop n'est qu'un plus ; le bouton « Parcourir » suffit. Upload direct R2 via `getSignedUploadUrlR2`.                   |

### 5.2 Checklist quiz transverse

- [ ] **1 question = 1 groupe** (`fieldset`/`legend` ou `role="group"` + `aria-labelledby`).
- [ ] **Erreur de validation** : `aria-invalid="true"` + message lié par `aria-describedby`, **texte explicite** (« Sélectionnez au moins une réponse »), pas seulement bordure rouge (SC 3.3.1, 1.4.1, 3.3.3).
- [ ] **Feedback / rationale** après soumission : rendu dans une région `aria-live="polite"` (« Correct » / « Incorrect — la bonne réponse est… »). Le feedback est **configurable** (immédiat vs fin de quiz) → respecter le réglage sans casser l'annonce.
- [ ] **Score & seuil** : à la fin, annoncer « Score 80 % — seuil 70 % atteint, module suivant débloqué » via `role="status"`. Le résultat persiste dans `QuizAttempt`.
- [ ] **Minuteur** (si chronométré, anti-triche léger = temps serveur) : **SC 2.2.1** — afficher le temps restant en texte, prévenir avant expiration, et permettre une **prolongation** sauf si la limite est essentielle à l'évaluation (haute-stake RNCP). Le temps fait foi côté **serveur** (`QuizAttempt.startedAt`), pas JS client.
- [ ] **Shuffle questions/réponses** (anti-triche) : la randomisation ne doit pas casser l'association label↔input (générer les `id`/`for` après shuffle).
- [ ] **Navigation** : « Précédent / Suivant / Soumettre » = vrais `<button>`, focus géré entre questions (focuser le `legend` ou un `<h2>` de la question à l'arrivée).
- [ ] **Reprise** d'une tentative interrompue : restaurer les réponses, annoncer « Tentative reprise, question 4 sur 10 ».
- [ ] **Cibles ≥ 44px**, espacement entre radios/checkboxes ≥ 8px (SC 2.5.8).
- [ ] **Pas de piège au focus** dans une modale de confirmation de soumission (FocusTrap + Échap ferme).

---

## 6. Checklist composant — OUTIL AUTEUR (course builder) + ALTERNATIVE AU DRAG

**NEUF.** Composants : `src/components/admin/elearning/builder/CourseBuilder.tsx`, `ModuleList.tsx`, `LessonList.tsx`, `BlockEditor.tsx` (éditeur de blocs riche, ex. Tiptap → `ElearningLesson.contenuJson`), `MediaUploader.tsx`. Sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/builder/**`. RBAC `requireAdminWrite/Publish` (réutilise `src/server/actions/knowledge/_guards.ts`). Le builder est un **outil interne** mais l'EAA + bonne pratique imposent que l'équipe Axion-IA (y compris un futur collaborateur en situation de handicap) puisse l'utiliser au clavier.

### 6.1 L'alternative au drag (SC 2.5.7) — point critique

Le builder réordonne **modules** et **leçons** (réécriture du champ `ordre`, cf. data model doc 01 §8). Le drag&drop est l'UX cible, mais il est **interdit qu'il soit le seul moyen**.

**Trois couches d'alternative (toutes livrées dès le MVP du builder)** :

1. **dnd-kit `KeyboardSensor` (déjà en deps)** — c'est l'alternative la plus propre :
   - Focus sur la **poignée** (`<button>` avec `aria-label="Réordonner : {titre}"`, **pas** un `<div>`).
   - `Espace` saisit l'élément, `↑/↓` (ou `←/→`) le déplace, `Espace` dépose, `Échap` annule.
   - Brancher `announcements` de dnd-kit sur une **région live** : « Module saisi, position 2 sur 5 » → « Déposé en position 1 ». (dnd-kit fournit `screenReaderInstructions` + `announcements` ; les **localiser en FR** via `fr.json`.)
2. **Boutons explicites « Monter / Descendre »** sur chaque ligne (`<button aria-label="Monter le module {titre}">`) — fallback simple, fiable, testable.
3. **Menu « Déplacer vers… »** (`<select>` de position ou kebab menu) — pour les longues listes (sauter à la position N sans N clics).

> Toutes ces actions appellent **la même server action** `reorderModulesAction` / `reorderLessonsAction` (`src/server/elearning/authoring/actions.ts`) qui réécrit `ordre` en transaction Prisma. Le drag et le clavier ne sont que des **déclencheurs** d'une logique unique.

### 6.2 Checklist builder transverse

- [ ] **Poignées de drag = `<button>`** focalisables (jamais `<div onMouseDown>`), `aria-roledescription="élément déplaçable"`.
- [ ] **Région live** dnd-kit branchée + traduite FR.
- [ ] Annulation **Échap** pendant un déplacement clavier.
- [ ] **Éditeur de blocs riche** (Tiptap) : barre d'outils navigable au clavier, boutons avec `aria-pressed`, raccourcis annoncés, **collage** préservant la sémantique (titres, listes) ; vérifier que le rendu apprenant respecte la hiérarchie de titres (pas de saut h2→h4).
- [ ] **Upload média** : `<input type="file">` natif + zone drop **optionnelle** (SC 2.5.7) ; barre de progression upload en `aria-live` ; erreurs (taille/format) en texte. Transcodage vidéo → Cloudflare Stream géré côté worker, statut annoncé.
- [ ] **Champs obligatoires** (titre, type leçon, VTT si vidéo) : `aria-required`, erreurs `aria-describedby`, **prévention de la perte de données** (SC 3.3.4 — confirmation avant quitter un brouillon non sauvegardé).
- [ ] **Aperçu « as-student »** : l'aperçu hérite des mêmes composants apprenant accessibles (pas un rendu dégradé).
- [ ] **Brouillon → publication** (`ElearningCourseStatut`) : le gate de publication inclut un **check a11y de contenu** (cf. §10) : alt manquant, VTT manquant, titres mal hiérarchisés.
- [ ] **Cibles ≥ 44px**, focus visible (le builder hérite des tokens admin).
- [ ] **Pas de focus masqué** par la toolbar collante du builder (SC 2.4.11).

---

## 7. Checklist composant — DASHBOARD (apprenant + admin/reporting)

**NEUF côté contenu, EXISTANT côté coquille.** L'admin LMS réutilise `AdminPageShell`/`AdminHeader`/`StatCard`/`AdminTable`/`AdminBadge` + `admin-nav.ts` (une section `elearning` à ajouter, cf. `06-CONSOLE-ADMIN/01`). Le dashboard apprenant est neuf sous `src/app/[locale]/portail/**` (extension de `mon-espace`) + `src/components/elearning/dashboard/**`.

### 7.1 Dashboard apprenant (`/portail/mon-espace` étendu)

- [ ] **Structure landmarks** : `<header>`, `<nav aria-label="Mes formations">`, `<main id="contenu">`, `<footer>` + **SkipLink** réutilisé.
- [ ] **Cartes de cours** : titre = vrai `<h2>/<h3>` + lien ; **barre de progression** = `role="progressbar"` `aria-valuenow/min/max` + **texte** « 3 leçons sur 8 (38 %) » (SC 1.4.1 : ne pas coder l'avancement que par la barre colorée).
- [ ] **État** (En cours / Terminé / Verrouillé) : badge avec **texte**, pas seulement couleur.
- [ ] **Certificat** disponible → lien explicite + format annoncé (PDF). Réutilise `DocumentGenere` + QR (existant).
- [ ] **Aide cohérente** (SC 3.2.6) : bloc « Besoin d'aide ? » (tuteur, Ind.19) au même endroit sur chaque page apprenant.

### 7.2 Dashboard admin / reporting (analytics)

- [ ] **Tableaux** = `<table>` avec `<th scope>`, `<caption>` ; tri = `<button>` dans `<th>` + `aria-sort` ; réutiliser `AdminTable` (déjà sain).
- [ ] **Graphiques** (completion, temps, scores) : **toujours doublés d'un tableau de données** ou d'un résumé texte (SC 1.1.1). Pattern existant dans le repo : `observatoire/TrendChart.tsx`, `SegmentHeatmap.tsx` (réutiliser leur approche `sr-only`). Couleurs de série distinguables sans la couleur seule (motifs/labels).
- [ ] **Filtres** : labels visibles, `aria-controls` vers la zone de résultats, annonce du nombre de résultats en `aria-live`.
- [ ] **Exports conformité** (CSV/PDF preuves FOAD) : boutons explicites, statut de génération annoncé.
- [ ] **StatCard** : la valeur n'est pas qu'un gros chiffre coloré — `aria-label` complet (« Taux de complétion : 72 % »).
- [ ] Contraste des `AdminBadge`/pastilles ≥ 3:1.

---

## 8. AUTHENTIFICATION APPRENANT ACCESSIBLE (SC 3.3.7, 3.3.8)

**NEUF (système séparé de NextAuth — ADR-0001).** Routes sous `src/app/[locale]/portail/**` ; service `src/server/elearning/auth/**` ; magic-link étendu de `PortailAcces` + `passwordHash` optionnel (argon2id) sur l'apprenant.

### 8.1 Pourquoi on est bien parti

- **Magic-link = conforme 3.3.8 ET 3.3.9 par construction** : aucune mémorisation, aucune transcription, aucun test cognitif. C'est le chemin par défaut → l'exigence d'auth accessible est **satisfaite nativement** pour la majorité des apprenants. À conserver comme défaut.

### 8.2 Exigences sur le mot de passe optionnel (entreprises)

- [ ] **Champ mot de passe `type="password"`** avec `<label>` visible + **bouton « Afficher »** (`aria-pressed`) — l'affichage du mot de passe est explicitement encouragé par 3.3.8.
- [ ] **`autocomplete="current-password"` / `"new-password"`** + `autocomplete="username"` sur l'email → **copier-coller et gestionnaires de mots de passe autorisés** (3.3.8 interdit de bloquer le collage).
- [ ] **Pas de règle de mot de passe « cognitive »** type CAPTCHA texte. Si protection anti-bot nécessaire : préférer un challenge **non cognitif** (token serveur, rate-limit, ou Cloudflare Turnstile en mode **non-interactif/invisible** — qui ne demande pas de résoudre un puzzle). Turnstile interactif (clic case) reste acceptable car ce n'est pas un test cognitif de transcription.
- [ ] **Redundant Entry (3.3.7)** : flux magic-link → l'email saisi à l'étape 1 est **pré-rempli/affiché** à l'étape 2 ; sur octroi entreprise, ne pas redemander des infos déjà connues du `Trainee`/import CSV.
- [ ] **Erreurs d'auth** : message texte clair, lié `aria-describedby`, focus déplacé sur le résumé d'erreur ; ne pas révéler si l'email existe (sécurité) tout en restant compréhensible.
- [ ] **Mot de passe oublié** → renvoie vers le **magic-link** (réinitialisation accessible sans test cognitif).
- [ ] **2FA** : l'admin (NextAuth) a déjà la 2FA ; **ne pas imposer de 2FA cognitive aux apprenants**. Si 2FA entreprise un jour : code par email/app + `autocomplete="one-time-code"`.
- [ ] **Session/timeout** : si expiration, prévenir (SC 2.2.1) et permettre de prolonger ; le cookie portail (HttpOnly 90j) limite déjà la friction.

### 8.3 Page de connexion — landmarks & focus

- [ ] `<main>` + `<h1>` « Connexion à mon espace », formulaire en `<form>`, **SkipLink**, focus initial sur le premier champ.
- [ ] **Aide cohérente** (3.2.6) présente aussi sur l'écran d'auth.

---

## 9. Sous-titres, transcripts & médias — récap exigences

| Média                        | Exigence                                       | SC          | Stockage / champ                                           |
| ---------------------------- | ---------------------------------------------- | ----------- | ---------------------------------------------------------- |
| Vidéo leçon                  | Sous-titres VTT FR **obligatoires**            | 1.2.2 (A)   | `ElearningResource(type="sous_titres")` + R2               |
| Vidéo leçon                  | Transcription texte sous le player             | 1.2.1/1.2.3 | `ElearningResource(type="transcript")` ou `contenuJson`    |
| Vidéo démo                   | Audio-description si visuel essentiel          | 1.2.5 (AA)  | consigne auteur / piste alternative                        |
| Audio (podcast)              | Transcription                                  | 1.2.1 (A)   | ressource texte                                            |
| Image de contenu             | `alt` pertinent (vide si décoratif)            | 1.1.1 (A)   | champ `alt` obligatoire dans le builder                    |
| PDF leçon (`pdfKey`)         | PDF **balisé/accessible** (ou équivalent HTML) | 1.1.1/1.3.1 | privilégier HTML natif ; si PDF, fournir titre + structure |
| Document généré (certificat) | Texte sélectionnable, pas image                | —           | `@react-pdf/renderer` produit du texte → OK                |

**Gate** : le worker/builder **refuse de publier** une leçon `video` sans piste `sous_titres`, et signale (warning bloquant configurable) une image sans `alt`.

---

## 10. Contrastes & focus — règles chiffrées (LMS)

- **Texte** : ≥ 4.5:1 (normal), ≥ 3:1 (large). Palette existante déjà AA — **réutiliser les tokens**, interdiction d'un gris LMS hors `--color-fg/-soft/-muted`.
- **Sur vidéo** : les sous-titres et contrôles superposés à l'image → fond semi-opaque garantissant 4.5:1 (le contraste sur image variable n'est pas fiable autrement).
- **Composants UI / focus / bordures d'input / icônes signifiantes** : ≥ 3:1 (SC 1.4.11). Bordure d'input par défaut `--color-border-strong` (#c8bda0) à vérifier ≥ 3:1 sur fond paper ; sinon renforcer pour les champs quiz/auth.
- **Focus** : outline global 2px + offset 2px (existant). Sur fonds sombres (player, sections mocha) → ajouter un **double contour** (outline clair + ombre) pour garantir la visibilité (SC 2.4.7 + viser 2.4.13).
- **Focus non masqué** (SC 2.4.11) : `scroll-margin-top`/`scroll-padding-top` = hauteur des en-têtes sticky (player, builder, admin) ; toasts en bas non superposés à la zone focalisable.
- **État ≠ couleur seule** (SC 1.4.1) : verrou, bonne/mauvaise réponse, progression, statut → toujours **icône + texte** ou **motif + label**.

---

## 11. Clavier & focus — règles transverses

- [ ] **Ordre de tabulation** logique partout (DOM order = visual order ; éviter `tabindex` positif).
- [ ] **Pas de piège** (SC 2.1.2) : modales (confirmation soumission quiz, dialogues builder) = `FocusTrap` + `Échap` + restitution du focus à l'élément déclencheur.
- [ ] **Skip-link** « Aller au contenu » sur toutes les pages LMS (composant partagé).
- [ ] **Raccourcis** (player, builder) : conformes à SC 2.1.4 (désactivables/remappables/actifs au focus uniquement).
- [ ] **Focus visible** : jamais `outline:none` sans remplacement (interdiction lint, cf. §12).
- [ ] **Composants custom** (player slider, drag handle, quiz matching) : rôles/états ARIA testés au lecteur d'écran (NVDA + VoiceOver iOS via projet `mobile-safari`).

---

## 12. Méthode de validation (process + CI)

### 12.1 Outils & gates automatisés

1. **ESLint `eslint-plugin-jsx-a11y`** (déjà installé, v6.10.2) — **monter les règles a11y en `error`** pour les fichiers `src/components/elearning/**`, `src/components/admin/elearning/**`, `src/app/[locale]/portail/**` (override ciblé dans la config ESLint, ne pas casser le reste du repo). Bloque : `alt` manquant, label manquant, `onClick` sur non-bouton, etc.
2. **axe-core via Playwright** (déjà en deps : `@axe-core/playwright` + `axe-core@4.11.4`) — créer `tests/e2e/elearning-a11y.spec.ts` qui charge player / quiz / builder / dashboard / auth **derrière un login de test** et lance :
   ```ts
   await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
   // assert: violations.length === 0
   ```
   (Pattern repris de `_AUDIT/E2E-NAV-CTA-2026-05-15/axe-runtime-probe.mjs`, mais en **gate** : 0 violation, pas seulement un rapport.) Pages LMS = `force-dynamic` + auth → compatibles `stub.invalid` (rendues au runtime, pas au build SSG).
3. **Lighthouse CI** — nouveau profil `lighthouserc.elearning.json` ciblant les routes LMS authentifiées : **catégorie `accessibility` en `error` ≥ 0.95** (plus strict que le site public qui est en WARN ≥ 0.9), `target-size`/`color-contrast`/`label-content-name-mismatch` **en ERROR** pour le LMS neuf. Web Vitals : reprendre les budgets stricts (cf. doc 03).
4. **CI matrix** : exécuter les specs a11y sur les 5 projets Playwright (desktop + Pixel 7 + iPhone 14 Pro) pour couvrir mobile + WebKit.

> ⚠️ **Limite axe/Lighthouse** : l'automatisé couvre ~30-40 % des critères (contraste, labels, rôles, alt). Il **ne valide pas** la qualité réelle des sous-titres, la logique de focus, l'utilisabilité au lecteur d'écran, l'alternative au drag. D'où la validation manuelle ci-dessous.

### 12.2 Validation manuelle (par composant, avant chaque release LMS)

- **Test clavier intégral** : débrancher la souris. Parcourir player, faire un quiz complet, **réordonner un module au clavier** (dnd-kit + boutons), se connecter — sans souris, sans piège, focus toujours visible.
- **Lecteur d'écran** : NVDA (Windows/Firefox) + VoiceOver (iOS/Safari) sur les parcours critiques : annonce du verrou + raison, annonce du score/déverrouillage, annonce drag clavier, erreurs de formulaire, sous-titres.
- **Zoom 200 % + reflow 320px** : pas de scroll horizontal, pas de contenu coupé (player, quiz, builder).
- **`prefers-reduced-motion`** activé : aucune animation, pas d'autoplay.
- **Contraste** : vérif manuelle des superpositions vidéo (sous-titres/contrôles) qu'axe ne peut pas mesurer sur image.

### 12.3 Grille de conformité & livrables

- **Grille RGAA 4.1** (106 critères) remplie par parcours (player / quiz / builder / dashboard / auth) → preuve d'audit.
- **Déclaration d'accessibilité** publiée (`/accessibilite`) : niveau de conformité, dérogations motivées, contact, voie de recours (exigence EAA + RGAA).
- **Schéma pluriannuel** + plan annuel d'accessibilité (engagement EAA).
- **Page « Accessibilité »** liée en footer (aide cohérente, SC 3.2.6).
- **Définition of Done a11y** par ticket LMS : `jsx-a11y` vert + axe 0 violation sur le composant + check clavier manuel + (si média) sous-titres/alt présents.

### 12.4 Workers/queues concernés (génération de preuves & médias accessibles)

- `elearning-video-worker.ts` (NEUF) : transcodage Cloudflare Stream + **génération VTT brouillon** (ASR) à relire.
- `elearning-certificate-worker.ts` (NEUF, réutilise `DocumentGenere`) : certificat PDF **texte** (accessible).
- Réutiliser `email-worker` + templates React Email **accessibles** (contraste, alt, structure) pour magic-link / relances / déblocage.

---

## 13. Récapitulatif des artefacts à créer (a11y)

| Artefact                                             | Chemin                                                                   | Nature                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| Composants a11y partagés                             | `src/components/a11y/{SkipLink,VisuallyHidden,LiveRegion,FocusTrap}.tsx` | NEUF (extrait de patterns existants)    |
| Player accessible                                    | `src/components/elearning/player/**`                                     | NEUF (sur base media-chrome/vidstack)   |
| Quiz accessibles                                     | `src/components/elearning/quiz/**`                                       | NEUF                                    |
| Builder + alternative drag                           | `src/components/admin/elearning/builder/**`                              | NEUF (dnd-kit KeyboardSensor + boutons) |
| Server actions reorder (logique unique drag/clavier) | `src/server/elearning/authoring/actions.ts`                              | NEUF                                    |
| Specs a11y E2E                                       | `tests/e2e/elearning-a11y.spec.ts`                                       | NEUF (axe-core gate)                    |
| Profil Lighthouse LMS                                | `lighthouserc.elearning.json`                                            | NEUF (gate strict)                      |
| Override ESLint jsx-a11y                             | config ESLint (override `elearning/**`)                                  | NEUF                                    |
| Libellés a11y FR                                     | `messages/fr.json` → `elearning.a11y.*`                                  | EXTENSION                               |
| Déclaration + page accessibilité                     | `src/app/[locale]/accessibilite/page.tsx`                                | NEUF                                    |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth hybride → §8), ADR-0005 (Cloudflare Stream → §4), ADR-0007 (cloisonnement code).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningLesson.type`, `ElearningResource(type="sous_titres")`, champs `unlock*` (raisons de verrou §4.4).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `LessonProgress` (reprise/progressbar §4, §7).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`Question`/`QuizAttempt` (§5).
- `04-BACKEND/05-authentification-apprenant.md` — magic-link + mot de passe (§8).
- `04-BACKEND/07-pipeline-video-streaming.md` — VTT, transcript, worker vidéo (§4.2, §9).
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — player (§4).
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — UI quiz (§5).
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — verrous + raisons (§4.4).
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — builder + drag (§6).
- `06-CONSOLE-ADMIN/08-reporting-analytics.md` — dashboards/graphiques (§7.2).
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind.19 (aide cohérente §3.2.6), Ind.26 (handicap).
- `09-QUALITE/01-plan-tests.md` — intégration des gates a11y (§12).
- `09-QUALITE/03-web-vitals-performance.md` — tension INP player/quiz vs a11y.
