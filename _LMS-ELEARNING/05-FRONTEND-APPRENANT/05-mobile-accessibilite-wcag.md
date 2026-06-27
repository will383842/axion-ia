# Mobile & accessibilité WCAG 2.2 AA — espace apprenant & player

> Spécification **transversale et opposable** pour l'accessibilité et le responsive de tout le front apprenant LMS : tableau de bord (`/apprendre`), sommaire de cours, **lecteur vidéo (player)**, **moteur de quiz** (12 types), déverrouillage, certificats, authentification apprenant.
>
> **Obligation légale.** L'**European Accessibility Act (EAA)** est applicable aux nouveaux services numériques B2C **depuis le 28/06/2025**. En droit français, la mise en accessibilité se mesure sur le **RGAA 4.1** (transposition de **WCAG 2.1 AA**) ; on **cible WCAG 2.2 AA** (sur-ensemble : 9 nouveaux critères) pour être à l'état de l'art juin 2026 et anticiper la prochaine version du RGAA. Un OF certifié Qualiopi a en outre une attente forte sur l'accessibilité (référent handicap, indicateur Qualiopi handicap).
>
> Convention de lecture : **[EXISTANT]** = brique réutilisée telle quelle / étendue · **[NEUF]** = à construire sous les chemins cloisonnés (ADR-LMS-0007). Source de vérité modèles/enums : `03-DATA-MODEL/*`. Source de vérité arbitrages : `00-INDEX/DECISIONS-ARBITRAGES.md`. Source de vérité budgets perf : `lighthouserc.json` + `axionia/AGENTS.md`.
>
> Dernière mise à jour : 2026-06-27.

---

## 0. Principes directeurs (non négociables)

1. **L'accessibilité est une condition de Definition of Done**, pas une finition. Aucun composant apprenant ne fusionne sans passer `vitest-axe` (0 violation critique/serious) + revue clavier (cf. §11).
2. **Accessible par défaut, dégradable jamais.** Toute interaction « riche » (drag d'ordonnancement, hotspot image, scrub vidéo) **doit** avoir une alternative pointeur simple / clavier (WCAG 2.5.7, 2.1.1).
3. **Mobile-first.** Le terrain réel d'un FOAD asynchrone est le téléphone (apprenant en mobilité, microlearning 2-10 min). On conçoit à **320 px CSS de large** d'abord (reflow 1.4.10), puis on élargit.
4. **Budgets Web Vitals internes maintenus jusque dans l'espace authentifié.** Le player et le quiz sont les **seuls foyers d'INP** du LMS ; ils sont isolés en client components `dynamic()` (cf. §10) — l'accessibilité ne sert pas d'excuse à dégrader la perf, et inversement.
5. **Réutilisation stricte de l'existant a11y** déjà présent dans `src/app/globals.css` (focus-visible, prefers-reduced-motion, tokens couleur déjà tunés AA) — on **n'invente pas** un second système de tokens (cf. §2).
6. **Pas de surveillance intrusive.** Aucun proctoring caméra/clavier par défaut (CNIL : proportionné, optionnel, **alternative obligatoire**) — c'est aussi une exigence d'accessibilité (3.3.8, pas de test cognitif imposé).

---

## 1. Périmètre couvert par ce document

| Surface                              | Route                                            | Doc produit                                   | Couvert ici                                                         |
| ------------------------------------ | ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------- |
| Tableau de bord apprenant            | `/apprendre`                                     | `01-espace-apprenant-dashboard.md`            | a11y + responsive du dashboard, « Continuer »                       |
| Sommaire de cours (verrous + raison) | `/apprendre/[courseSlug]`                        | `04-progression-deverrouillage.md`            | rendu accessible du **verrou + sa raison**                          |
| **Lecteur de cours / player**        | `/apprendre/[courseSlug]/[lessonId]`             | `02-lecteur-cours-player.md`                  | **§5 player vidéo a11y** (sous-titres, clavier, focus, no-autoplay) |
| **Moteur de quiz**                   | `/apprendre/[courseSlug]/[lessonId]` (type=quiz) | `03-moteur-quiz-ui.md`                        | **§6 quiz a11y** (12 types, alternative au drag, timer annonçable)  |
| Certificats                          | `/apprendre/certificats`                         | `06-certificats-badges.md`                    | a11y du téléchargement (lien R2 signé)                              |
| **Auth apprenant**                   | `/apprendre/connexion`, magic-link               | `04-BACKEND/05-authentification-apprenant.md` | **§7 auth accessible (3.3.8)**                                      |

> **Hors périmètre (couvert ailleurs)** : l'accessibilité du **catalogue public** (`/catalogue`, `/cours/[slug]`) suit la doctrine des 15 pages stratégiques (Server Components, JSON-LD, budgets stricts) — cf. `07-catalogue-public-seo.md` + `09-QUALITE/04-accessibilite-wcag22.md`. L'a11y de la **console admin** (outil auteur) suit le design-system admin existant — cf. `06-CONSOLE-ADMIN/03-*`. Ce document = **espace apprenant + player + quiz**.

> ⚠️ **Note routes.** L'architecture (`02-ARCHITECTURE/architecture-globale.md` §7) fixe l'espace apprenant sous `/apprendre/**` (`force-dynamic`, auth apprenant séparée de NextAuth — ADR-LMS-0001). Le doc 03 (quiz) référence aussi un chemin historique `/portail/cours/...`. **Canonique retenu ici : `/apprendre/**`.** Le cookie d'auth réutilise les primitives `PortailAcces` (64 hex, HttpOnly) mais sous un cookie **dédié apprenant** distinct du portail Qualiopi.

---

## 2. EXISTANT a11y réutilisé (ne PAS redupliquer)

Le socle public Axion-IA a déjà fait plusieurs Sprints A11y (cf. doctrine `lighthouserc.json`). On **hérite** et on **étend** :

| Brique existante                                                           | Réf.                                                                                                                              | Réutilisation LMS                                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **`:focus-visible`** global                                                | `src/app/globals.css:217` (`outline: 2px solid var(--color-primary); outline-offset: 2px`)                                        | Conservé tel quel pour tous les contrôles apprenant. **Ne pas** poser `outline: none` sans remplacement conforme (2.4.7 + 2.4.11/2.4.13). |
| **`@media (prefers-reduced-motion: reduce)`** strict                       | `globals.css:417,424,988`                                                                                                         | Le player, les transitions de déverrouillage, les confettis de certificat **doivent** respecter ce media query (cf. §5.6).                |
| **Tokens couleur tunés AA**                                                | `globals.css:24-65` (`--color-fg-muted` documenté 5.0:1 sur paper / 4.8:1 sur bg ; `--color-sage`/`--color-success` assombris AA) | Réutiliser ces tokens pour TOUT texte/état. Interdiction d'introduire une couleur ad-hoc non vérifiée (cf. §4.4).                         |
| **Échelle `--radius-*` / `--shadow-*`**                                    | `globals.css:147-177`                                                                                                             | Cohérence visuelle ; cibles tactiles (§4.2) via padding, pas via nouveaux tokens.                                                         |
| **Polices `next/font` (Manrope/Fraunces/Inconsolata)** `display: optional` | `globals.css:68-76`                                                                                                               | Évite le CLS de swap (CLS=0). Réutilisées dans l'espace apprenant.                                                                        |
| **`WebVitals.tsx`** (RUM)                                                  | `src/components/.../WebVitals.tsx`                                                                                                | Étendu pour tagguer les routes `/apprendre/**` (champ INP player).                                                                        |
| **Footer / Skip patterns**                                                 | `src/components/nav/Footer.tsx` (a11y présent)                                                                                    | Le **SkipLink** apprenant (§3.1) s'aligne sur le pattern existant.                                                                        |

**NEUF à construire** (cloisonné sous `src/components/elearning/a11y/**`) : `SkipLink` apprenant, `LiveRegion` (status messages 4.1.3), `VisuallyHidden`/`sr-only` helper composant, `useReducedMotion` hook, `LockedReason` (verrou + raison accessible), `FocusTrap` léger pour modales quiz, et l'**a11y kit player** (`CaptionsMenu`, `PlaybackKeyboardLayer`, `TranscriptPanel`).

---

## 3. WCAG 2.2 — les 9 nouveaux critères, appliqués au LMS

WCAG 2.2 ajoute 9 critères vs 2.1. On traite les **AA** (obligatoires) en détail ; les AAA sont notés « bonus visé » quand peu coûteux.

### 3.1 — 2.4.11 Focus Not Obscured (Minimum) — **AA** ⭐ critique LMS

**Exigence.** Quand un élément reçoit le focus clavier, il **ne doit pas être entièrement masqué** par un contenu superposé créé par l'auteur (header sticky, barre de contrôle player collante, cookie banner, bouton « Continuer » flottant).

**Risques LMS identifiés (élevés).**

- **Header sticky** du dashboard + **barre de progression collante** du cours → un champ/lien tabulé en haut de viewport peut passer sous la barre.
- **Barre de contrôle player collante en bas** (mobile) → le dernier contrôle tabulé peut être masqué.
- **Toolbar quiz sticky** (« Question 3/10 » + timer).

**Implémentation [NEUF].**

- `scroll-margin-top` / `scroll-margin-bottom` sur **tous** les éléments focusables des zones à barres collantes, dimensionné sur la hauteur réelle de la barre (variable CSS `--lms-sticky-top`, `--lms-sticky-bottom`).
- Préférer des barres **non sticky** sur mobile quand la hauteur de barre > 25 % du viewport (sinon reflow + focus obscured cumulés).
- Test automatisé : Playwright tabule chaque contrôle et vérifie `boundingBox` non intégralement couvert.

### 3.2 — 2.4.12 Focus Not Obscured (Enhanced) — AAA (bonus)

Viser « focus jamais masqué du tout » sur le player. Atteint gratuitement si §3.1 est bien fait → **on le coche**.

### 3.3 — 2.4.13 Focus Appearance — AAA (bonus visé)

Indicateur de focus ≥ périmètre 2 px + contraste ≥ 3:1 vs l'état non-focus. Le `:focus-visible` existant (2 px primary `#1a4dd9` + offset 2px) **dépasse déjà** le minimum AA (2.4.7) ; il satisfait quasi 2.4.13. On garde, on **ne supprime jamais** l'outline.

### 3.4 — 2.5.7 Dragging Movements — **AA** ⭐⭐ critique quiz

**Exigence.** Toute fonctionnalité qui repose sur un **glisser-déposer** doit offrir une **alternative à pointeur unique** (clic simple), sauf si le drag est « essentiel ».

**Risques LMS (très élevés — c'est LE critère du moteur de quiz).**

- **`ordonnancement`** (remettre des items dans l'ordre) — composant `OrderingQuestion.tsx`.
- **`appariement`** (relier gauche↔droite) — `MatchingQuestion.tsx`.
- **`zone_cliquable` / hotspot** — `HotspotQuestion.tsx` (clic, pas drag, mais cible §3.5).
- **Réorganisation drag&drop de l'outil auteur** (admin, hors périmètre ici mais même règle — cf. `06-CONSOLE-ADMIN/03-*`).
- **Scrub / seek de la timeline vidéo** (drag du curseur) — cf. §5.3.

**Implémentation [NEUF] — règle d'or : le drag est un _enhancement_, jamais le seul chemin.**

- **`OrderingQuestion`** : chaque item porte des **boutons « Monter » / « Descendre »** (et « Déplacer en haut/bas ») cliquables + clavier (`ArrowUp`/`ArrowDown` quand l'item a le focus), `aria-roledescription="élément réordonnable"`, position annoncée via `aria-live` (« Cadrage, position 2 sur 3 »). Le drag souris reste disponible en plus (pointer events), mais **la note ne dépend jamais du drag**.
- **`MatchingQuestion`** : alternative = **deux `<select>`** ou un pattern « clic sur élément gauche → clic sur élément droite » (sélection séquentielle), chaque paire formée annoncée. Le stockage reste `{ paires: [{ gaucheId, droiteId }] }` (cf. doc 03 §8.2) quel que soit le mode d'entrée.
- **Timeline player** : le seek se fait aussi au **clavier** (`←`/`→` ±5 s, `Home`/`End`) et par **clic** sur la barre (pas seulement drag du curseur).

### 3.5 — 2.5.8 Target Size (Minimum) — **AA** ⭐ critique mobile/quiz

**Exigence.** Les cibles d'entrée pointeur font **≥ 24×24 px CSS** (ou espacement équivalent : un cercle de 24 px ne chevauchant pas une autre cible).

**Risques LMS.**

- Boutons « Monter/Descendre » d'ordonnancement (souvent dessinés petits).
- Cases QCM multi sur mobile.
- Contrôles player (play/pause/captions/vitesse) serrés sur petite barre.
- Zones hotspot (`zone_cliquable`) — les zones définies par l'auteur **doivent** être validées ≥ 24 px à la publication (garde-fou côté `quiz-authoring.ts`).
- Pagination de questions, points de chapitrage timeline.

**Implémentation [NEUF].**

- Cible **interne ≥ 24 px**, **recommandée 44 px** (Apple HIG / meilleure ergonomie mobile) pour les contrôles primaires (play, soumettre, suivant).
- Helper CSS `.lms-target { min-block-size: 44px; min-inline-size: 44px; }` ou padding garantissant la zone cliquable même si l'icône est petite.
- Cohérent avec l'assertion Lighthouse **`target-size`** déjà présente dans `lighthouserc.json` (en WARN, minScore 1) → on vise le **vert**.

### 3.6 — 3.2.6 Consistent Help — **A**

Si une aide est offerte (lien tuteur/contact, chat assistance Ind.19), elle apparaît **au même endroit relatif** sur toutes les pages apprenant. → Bloc « Besoin d'aide ? » (tuteur RAG V1 / contact + délai formalisé `SiteSetting elearning.tutorat_delai_reponse_h`) **toujours en fin de contenu / footer apprenant**, position constante.

### 3.7 — 3.3.7 Redundant Entry — **A**

Ne pas redemander une information déjà saisie dans le même processus. → Le flow d'auth apprenant (magic-link) **ne redemande pas** l'email après clic du lien ; l'autosave quiz (`saveAnswer`, doc 03 §11) **conserve** les réponses en cas de reprise (pas de ressaisie). Pré-remplissage des champs profil depuis `Trainee` existant.

### 3.8 — 3.3.8 Accessible Authentication (Minimum) — **AA** ⭐ critique auth

Traité en détail au **§7**. Résumé : magic-link = **aucun test cognitif** (pas de puzzle, pas de mémorisation imposée) → conforme par conception ; le mot de passe optionnel (comptes entreprise, ADR-LMS-0001) doit autoriser **collage + gestionnaires de mots de passe** et ne **jamais** imposer de CAPTCHA cognitif.

### 3.9 — 3.3.9 Accessible Authentication (Enhanced) — AAA (atteint)

Le magic-link satisfait même l'Enhanced (aucune reconnaissance d'objet/puzzle). **Coché** tant que le magic-link est le défaut.

---

## 4. Critères WCAG « carry-over » critiques pour un LMS (2.1 AA toujours dus)

Les nouveautés 2.2 ne dispensent pas des fondamentaux. Pour un LMS vidéo + quiz, ceux-ci sont **à risque** et explicitement spécifiés.

### 4.1 Média temporel (le plus structurant — player vidéo)

| Critère                                | Niveau | Exigence LMS                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.2.1** Audio/vidéo seul             | A      | Transcription pour tout audio-seul ; description pour vidéo muette.                                                                                                                                                                                                                                                                      |
| **1.2.2 Sous-titres (pré-enregistré)** | **A**  | **Obligatoire** : toute leçon `video` a des **sous-titres WebVTT**. Stockés via `ElearningResource type="sous_titres"` (doc 01 §6), `r2Key` sur R2, servis signés (cf. §5.2). **Garde-fou publication** : un cours ne peut passer `publie` (doc 01 §8) si une leçon `video` n'a pas de piste `sous_titres` (check `publish-service.ts`). |
| **1.2.3 / 1.2.5 Audiodescription**     | A / AA | Si la vidéo véhicule de l'info visuelle non narrée → piste audiodescription **ou** version « described ». À défaut, **transcription descriptive** (couvre 1.2.3 niveau A) systématique.                                                                                                                                                  |
| **1.2.4 Sous-titres (live)**           | AA     | Hors périmètre MVP (FOAD = asynchrone). Si replay de classe virtuelle (`embed`) → fournir sous-titres du replay.                                                                                                                                                                                                                         |

> **Décision produit** : sous-titres **WebVTT obligatoires** + **transcription texte** (panneau `TranscriptPanel`, §5.4) systématique sur chaque leçon vidéo. La transcription sert aussi le SEO interne, la recherche et la preuve FOAD (contenu consultable).

### 4.2 Clavier & navigation

| Critère                                        | Niveau | Exigence LMS                                                                                                                                                                                 |
| ---------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.1.1 Clavier**                              | A      | 100 % des fonctions player + quiz au clavier (play/pause/seek/vitesse/captions, répondre/naviguer/soumettre).                                                                                |
| **2.1.2 Pas de piège clavier**                 | A      | Le player plein écran et les modales quiz **libèrent** le focus (Échap), pas de trap.                                                                                                        |
| **2.1.4 Raccourcis touche unique**             | A      | Les raccourcis player (Espace, K, M, F, C, ←/→) ne sont actifs **que** quand le player a le focus (pas globalement) → pas de capture des frappes dans un champ texte (essai/réponse courte). |
| **2.4.3 Ordre de focus**                       | A      | Ordre logique : titre leçon → player → transcription → quiz → navigation module.                                                                                                             |
| **2.4.7 Focus visible**                        | AA     | Hérité de `:focus-visible` global.                                                                                                                                                           |
| **2.4.1 Skip / 2.4.2 Titre / 2.4.6 Intitulés** | A/AA   | **SkipLink** « Aller au contenu » + « Aller au lecteur » (§3.1) ; `<title>` par route (`generateMetadata`) ; H1 unique par page apprenant.                                                   |

### 4.3 Timing & mouvement

| Critère                    | Niveau | Exigence LMS                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.2.1 Réglage du délai** | A      | **Quiz chronométré** (`Quiz.tempsLimiteSec`, doc 03 §7.1) : l'apprenant doit pouvoir **prolonger ×10** OU être **averti à 20 % restant** avec possibilité de demander du temps — sauf si le temps est « essentiel » à l'évaluation (high-stakes documenté). Politique : **avertissement + extension par défaut**, désactivable seulement pour `final_certificatif` flaggé. Le temps fait foi **côté serveur** (`expiresAt`), l'extension est journalisée. |
| **2.2.2 Pause/Stop/Hide**  | A      | **Aucun autoplay vidéo** (best practice + critère). Toute animation > 5 s (loader, barre de progression animée) est pausable / respecte reduced-motion.                                                                                                                                                                                                                                                                                                   |
| **2.3.1 Seuil de flashs**  | A      | Pas de contenu clignotant > 3 flashs/s (vidéos pédagogiques validées à l'ingestion).                                                                                                                                                                                                                                                                                                                                                                      |

### 4.4 Perception (couleur, contraste, reflow)

| Critère                                                      | Niveau | Exigence LMS                                                                                                                                                             |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1.4.3 Contraste texte**                                    | AA     | Texte ≥ 4.5:1, large ≥ 3:1. Réutiliser tokens AA existants (§2). Sous-titres player : fond semi-opaque garanti (cf. §5.2).                                               |
| **1.4.11 Contraste non-textuel**                             | AA     | Contrôles player, états verrou/déverrouillé, barres de progression, bordures de champs ≥ 3:1.                                                                            |
| **1.4.1 Info par couleur**                                   | A      | Le **verrou** n'est pas signalé que par couleur : icône cadenas + texte « Verrouillé » + raison (cf. §8). Réussite/échec quiz : icône + texte, pas seulement vert/rouge. |
| **1.4.10 Reflow**                                            | AA     | Utilisable à **320 px** sans scroll bidirectionnel (cf. §9).                                                                                                             |
| **1.4.12 Espacement du texte**                               | AA     | Aucune perte de contenu si l'utilisateur force interlignage/espacement (pas de hauteurs fixes coupant le texte des énoncés quiz).                                        |
| **1.4.4 Redimensionnement 200 %** / **1.4.5 Texte en image** | AA     | Zoom 200 % OK ; pas de texte rasterisé (énoncés quiz en vrai texte, pas en image — sauf `media_r2_key` illustratif avec alt).                                            |
| **1.3.4 Orientation**                                        | AA     | Portrait **et** paysage supportés (player surtout). Ne pas verrouiller l'orientation.                                                                                    |
| **1.3.5 Identification de la saisie**                        | AA     | `autocomplete` adéquat sur les champs profil/auth (email, name).                                                                                                         |

### 4.5 Robustesse & messages

| Critère                       | Niveau | Exigence LMS                                                                                                                                                                                  |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.1.2 Nom/Rôle/Valeur**     | A      | Tous les widgets custom (player, sliders, drag-alt, hotspot) exposent rôle ARIA + nom accessible + état. Le player utilise des contrôles `<button>` natifs autant que possible.               |
| **4.1.3 Messages d'état**     | AA     | `aria-live` pour : sauvegarde auto (« Réponse enregistrée »), résultat quiz, **déverrouillage** (« Module 2 débloqué »), erreurs de soumission, temps restant. Composant `LiveRegion` [NEUF]. |
| **3.3.1 / 3.3.3 Erreurs**     | A/AA   | Erreurs de réponse identifiées en texte + suggestions ; pas seulement bordure rouge.                                                                                                          |
| **3.3.4 Prévention d'erreur** | AA     | Soumission de quiz `final_certificatif` (irréversible / décompte tentative) → **confirmation** avant envoi.                                                                                   |

---

## 5. Player vidéo accessible [NEUF] — `src/components/elearning/player/**`

Le player est le composant le plus exigeant (a11y + INP + sécurité). **Réutilise** Cloudflare Stream (ADR-LMS-0005) en HLS ; URL signée + watermark obtenue via `GET /api/elearning/playback/[lessonId]` (architecture §4.2).

### 5.1 Choix technique

- **Lecteur HLS standard** : `hls.js` (lazy) **uniquement** si le navigateur ne supporte pas HLS natif (Safari/iOS le supporte nativement via `<video>`). Pas de SDK lourd propriétaire (budget INP/bundle).
- **Élément racine `<video>` natif** = base accessibilité maximale (contrôles clavier natifs, pistes `<track>`), **surcouché** d'une UI custom accessible (`PlayerControls.tsx`) pour vitesse/captions/qualité.
- Chargé en **`dynamic(() => import(...), { ssr: false })`** ; hors bundle des pages publiques (cf. §10).

### 5.2 Sous-titres (1.2.2 — pilier)

- Pistes WebVTT déclarées en `<track kind="subtitles" srclang="fr" label="Français" default>`.
- Source = `ElearningResource type="sous_titres"` (doc 01 §6) → URL R2 signée via `GET /api/elearning/resource/[resourceId]` (architecture §4.2) ; **jamais** l'URL R2 brute.
- **Style sous-titres** : fond `rgba(0,0,0,0.75)` + texte blanc (contraste garanti AA même sur image claire) ; taille réglable (S/M/L) persistée (préférence locale). Respecte les `::cue` natifs.
- Bouton **CC** dans la barre, état `aria-pressed`, raccourci `C`. Menu de pistes (`CaptionsMenu.tsx`) si plusieurs langues (FR seul en pratique, EN désactivé).

### 5.3 Contrôles clavier (2.1.1 / 2.1.4) — actifs uniquement si le player a le focus

| Touche         | Action               | Annonce `aria-live`     |
| -------------- | -------------------- | ----------------------- |
| `Espace` / `K` | Play/Pause           | « Lecture » / « Pause » |
| `←` / `→`      | −5 s / +5 s          | « 1:23 » (position)     |
| `J` / `L`      | −10 s / +10 s        | position                |
| `↑` / `↓`      | Volume ±10 %         | « Volume 60 % »         |
| `M`            | Muet                 | « Son coupé / rétabli » |
| `F`            | Plein écran (toggle) | —                       |
| `C`            | Sous-titres on/off   | « Sous-titres activés » |
| `Home` / `End` | Début / fin          | position                |
| `<` / `>`      | Vitesse −/+ (0,5→2×) | « Vitesse 1,5× »        |

- La **timeline** est un `role="slider"` (`aria-valuemin/max/now`, `aria-valuetext="2 min 30 sur 10 min"`) **avec clavier** (←/→/Home/End) — satisfait **2.5.7** (pas de drag obligatoire).
- Chapitres / points clés (si fournis) = boutons listés sous la timeline (cibles ≥ 24 px, §3.5), pas seulement des pastilles draggables.

### 5.4 Transcription (`TranscriptPanel.tsx`)

- Panneau dépliable **toujours disponible** sous le player (texte complet, synchronisé si timestamps WebVTT → surlignage du segment courant, **désactivable** si reduced-motion).
- Cliquer un paragraphe → seek (clavier accessible). Sert 1.2.1/1.2.3 + recherche + preuve FOAD.

### 5.5 Reprise auto & heartbeat (a11y + perf)

- Position de reprise lue depuis `LessonProgress.dernierePositionSec` (doc 02 §4) → message **non-bloquant** « Reprendre à 4:12 ? [Reprendre] [Recommencer] » (boutons, focus géré, pas de modale piégeante).
- Heartbeat via `POST /api/elearning/progress/heartbeat` (architecture §4.2) **débouncé + `navigator.sendBeacon`** à l'unload → ne bloque jamais le thread principal (protège INP, cf. §10).

### 5.6 Mouvement & autoplay

- **Aucun autoplay** (2.2.2). La lecture démarre sur action explicite.
- Transitions UI (apparition barre de contrôle, surlignage transcription) **désactivées** sous `@media (prefers-reduced-motion: reduce)` (hook `useReducedMotion` + CSS hérité `globals.css:417`).

### 5.7 Plein écran & focus (2.1.2 / 2.4.11)

- Plein écran : focus déplacé dans le conteneur player, `Échap` quitte (jamais de trap). Les contrôles restent visibles/atteignables (focus non masqué, §3.1).

---

## 6. Moteur de quiz accessible [NEUF] — `src/components/elearning/quiz/**`

Composants posés par doc 03 §11 : `QuizPlayer.tsx`, `QuestionRenderer.tsx` (switch 12 types), `ChoiceQuestion`, `MatchingQuestion`, `ClozeQuestion`, `OrderingQuestion`, `HotspotQuestion`, `UploadQuestion`, `QuizResult.tsx`, `QuizTimer.tsx`.

### 6.1 Structure sémantique d'une question

- Chaque question = `<fieldset>` + `<legend>` (énoncé) ; consigne en `aria-describedby`.
- Progression « Question 3 sur 10 » en `<h2>` + annoncée `aria-live="polite"` au changement.
- Média d'énoncé (`media_r2_key`) → `alt` obligatoire (saisi par l'auteur, garde-fou `quiz-authoring.ts`).

### 6.2 Mapping a11y par type (12 types)

| Type                     | Pattern accessible                                                                                                                                               | Alternative drag (2.5.7)     | Cible (2.5.8)                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| `qcm_mono` / `vrai_faux` | `role="radiogroup"` + `<input type=radio>` natifs                                                                                                                | n/a                          | label cliquable ≥ 44 px                     |
| `qcm_multi`              | `<input type=checkbox>` natifs + groupe nommé                                                                                                                    | n/a                          | ≥ 44 px                                     |
| `appariement`            | `MatchingQuestion` : sélection séquentielle clic OU `<select>` par item                                                                                          | **oui — pas de drag requis** | ≥ 44 px                                     |
| `texte_a_trous`          | `<input>` inline avec `<label>` masqué par trou (`b1`,`b2`)                                                                                                      | n/a                          | hauteur champ ≥ 44 px                       |
| `menu_deroulant`         | `<select>` natif par trou (options de `payloadJson`)                                                                                                             | n/a                          | natif                                       |
| `ordonnancement`         | `OrderingQuestion` : boutons Monter/Descendre + clavier                                                                                                          | **oui — drag = bonus**       | boutons ≥ 24/44 px                          |
| `reponse_courte`         | `<input type=text>` + `autocomplete=off`                                                                                                                         | n/a                          | ≥ 44 px                                     |
| `numerique`              | `<input type=text inputmode=decimal>` (pas `type=number` : pb a11y/spinner) + unité en suffixe texte                                                             | n/a                          | ≥ 44 px                                     |
| `essai`                  | `<textarea>` redimensionnable + compteur `aria-live`                                                                                                             | n/a                          | —                                           |
| `upload`                 | `<input type=file>` natif + `file_upload` flow, libellé clair, formats annoncés                                                                                  | n/a                          | bouton ≥ 44 px                              |
| `zone_cliquable`         | `HotspotQuestion` : zones = **boutons positionnés** (`role=button`, nom accessible « Zone : moteur ») cliquables ET tabulables, pas seulement coordonnées souris | **oui — clic/clavier**       | **zones validées ≥ 24 px à la publication** |

> **`zone_cliquable` — garde-fou auteur** : `quiz-authoring.ts` refuse une zone dont `w`/`h` (en % → px estimés sur conteneur de référence) < 24 px, et exige une **étiquette texte** par zone (nom accessible). Sinon le hotspot est inaccessible clavier/lecteur d'écran.

### 6.3 Timer accessible (`QuizTimer.tsx`) — 2.2.1 + 4.1.3

- Affiché en texte (« 4:32 restant »), **annoncé** aux paliers (50 %, 20 %, 10 %) via `aria-live="polite"` (pas chaque seconde → bruit lecteur d'écran).
- À 20 % restant : proposer **+ de temps** (extension ×, journalisée) sauf `final_certificatif` flaggé essentiel. Le temps **fait foi serveur** (`QuizAttempt.expiresAt`, doc 03 §8.1).

### 6.4 Feedback & résultat (`QuizResult.tsx`)

- Résultat = texte + icône (pas que couleur, 1.4.1) ; score, réussite/échec, **raison de gating si échec** (« Score 62 % — il faut ≥ 70 % pour débloquer le module 3 »).
- Corrigé/rationale selon `FeedbackMode` (doc 03) ; focus déplacé sur le résumé du résultat à la soumission (`aria-live` + `tabindex=-1` + `.focus()`).
- Erreur de soumission réseau → message `role="alert"` + bouton réessayer (autosave protège les réponses, 3.3.7).

### 6.5 Modales / overlays quiz

- Confirmation de soumission `final_certificatif` (3.3.4) = dialog accessible (`role="dialog"` `aria-modal`, `FocusTrap` [NEUF] léger, `Échap` ferme, retour focus au déclencheur).

---

## 7. Authentification apprenant accessible (3.3.8 / 3.3.9) [NEUF]

Réf. : `04-BACKEND/05-authentification-apprenant.md`, ADR-LMS-0001 (hybride magic-link + mot de passe optionnel).

- **Magic-link (défaut)** : aucun test cognitif, aucune mémorisation → **conforme 3.3.8 ET 3.3.9 (AAA) par conception**. Formulaire = un seul champ email (`type=email`, `autocomplete=email`, `inputmode=email`), erreurs en texte, lien envoyé. Pas de redemande d'email après clic (3.3.7).
- **Mot de passe optionnel (comptes entreprise)** :
  - Champ `type=password` avec **bascule afficher/masquer** (bouton nommé, `aria-pressed`).
  - **Collage autorisé** (ne jamais bloquer `paste`) + `autocomplete="current-password"`/`"new-password"` → gestionnaires de mots de passe OK = satisfait 3.3.8.
  - **Pas de CAPTCHA cognitif** ; si anti-bruteforce nécessaire → rate-limit serveur (compteurs `ElearningLearnerAuth`, doc 04) + éventuel défi **non cognitif** (token/honeypot), jamais un puzzle d'images.
- Liens magic-link : libellé explicite, cible ≥ 24 px ; pas de délai d'expiration trop court non réglable (timing 2.2.1 → durée raisonnable, message clair si expiré + renvoi en 1 clic).

---

## 8. Verrou & déverrouillage accessibles — `LockedReason.tsx` [NEUF]

Le best practice 2026 (« verrou affiché AVEC sa raison ») **est** une exigence d'accessibilité (1.4.1 info pas que couleur ; 4.1.2 état exposé). Réf. data : `ModuleProgress.estDeverrouille` / `verrouRaison` (doc 02 §5), `unlock-engine.ts` (doc 03 §9).

- Un élément verrouillé est rendu :
  - **icône cadenas** (décorative, `aria-hidden`) **+ texte** « Verrouillé » **+ raison** lisible (`verrouRaison`) : « Réussissez le quiz du module 2 (≥ 70 %) — meilleur score : 62 % », « Disponible le 12/07 », « Terminez la leçon précédente ».
  - Si c'est un lien/bouton désactivé : `aria-disabled="true"` + raison en `aria-describedby` (préférer `aria-disabled` à `disabled` pour rester tabulable et annonçable).
- **Annonce de déverrouillage** (4.1.3) : à la complétion d'un quiz/leçon déclenchant un unlock, `LiveRegion` annonce « Module 3 débloqué » (le `unlock-engine` recalcule, le client poll/refresh l'état).
- **Override admin** (doc 02/03) : transparent côté apprenant (élément simplement déverrouillé) ; tracé côté preuve.

---

## 9. Mobile & responsive

### 9.1 Doctrine

- **Mobile-first**, base **320 px** (1.4.10 reflow : aucun scroll horizontal, aucune perte de contenu/fonction).
- Breakpoints alignés Tailwind v4 du projet (`sm`/`md`/`lg`). Le **player** occupe 100 % largeur en mobile (ratio 16:9 préservé via `aspect-ratio` → **CLS=0**, pas de reflow au chargement métadonnées).
- **Cibles tactiles ≥ 44 px** sur tous les contrôles primaires mobiles (dépasse 2.5.8 / §3.5).
- **Orientation libre** (1.3.4) ; en paysage le player peut passer plein écran, l'UI s'adapte.
- **Safe areas** iOS (`env(safe-area-inset-*)`) pour la barre de contrôle player collante (ne pas masquer sous l'encoche / barre home) — combiné avec `scroll-margin` (§3.1).

### 9.2 Patterns responsive par surface

- **Dashboard `/apprendre`** : cartes de cours en grille fluide (`auto-fit minmax`), « Continuer » prioritaire en haut sur mobile. Pas de tableau dense → listes empilées.
- **Sommaire de cours** : accordéon de modules (boutons `aria-expanded`), verrou + raison lisibles sur une ligne wrap.
- **Player** : contrôles regroupés, menu « … » pour les options secondaires (vitesse/qualité) afin de garder chaque cible ≥ 44 px sans débordement.
- **Quiz** : une question par écran sur mobile (réduit la charge + INP), navigation Précédent/Suivant fixes mais **non masquantes** (§3.1) ; champs pleine largeur.

### 9.3 Saisie mobile

- `inputmode` correct (`email`, `decimal` pour `numerique`, `text` sinon) ; pas de zoom intempestif (taille de police ≥ 16 px sur les champs iOS) ; `autocomplete` pertinent.

---

## 10. Performance & Web Vitals (budgets internes maintenus)

Réf. : `axionia/AGENTS.md` + `lighthouserc.json` (LCP ≤ 1800, INP ≤ 80 warn / 100 cible, CLS ≤ 0.05 strict, TBT ≤ 150, First Load ≤ 75 KB gz ; mobile **et** desktop testés).

- L'espace apprenant est **`force-dynamic` derrière auth** → **hors des 15 pages stratégiques** et **hors SSG/stub** (contrat `stub.invalid` respecté : aucune page apprenant rendue au build). Mais on **vise les mêmes cibles internes** (qualité de service + a11y/perf liées : un player qui jank dégrade aussi l'expérience clavier/lecteur d'écran).
- **Foyers d'INP = player + quiz uniquement** → isolés en `dynamic(() => import(...), { ssr: false })`, lazy, **hors bundle des routes publiques**. `hls.js` chargé seulement si HLS non natif.
- **CLS=0** : `aspect-ratio` sur le player et les médias d'énoncé (réservation d'espace) ; polices `display: optional` (pas de swap) ; squelettes de chargement de **mêmes dimensions** que le contenu.
- **Heartbeat** : débouncé + `sendBeacon` (ne bloque pas le thread, ne compte pas dans l'INP des interactions).
- **`size-limit`** : composants `src/components/elearning/**` sous **budget propre** ; toute hausse > +5 KB gz vs `main` bloque la PR (gate existant). Le player a11y kit (captions/transcript/keyboard) reste léger (pas de lib de slider/drag lourde — natif + `role=slider`).
- **`bf-cache`** (assertion lighthouserc) : pas de `unload` listener bloquant (utiliser `pagehide`/`sendBeacon`).
- **Réduction du JS quiz** : `QuestionRenderer` charge le renderer du type courant à la demande (code-split par type lourd : `HotspotQuestion`, `OrderingQuestion`).

> Le gate **`pnpm lhci`** ne crawle pas les routes `/apprendre/**` (auth) ; la perf/a11y apprenant est donc gardée par : (a) `vitest-axe` unitaire, (b) **Lighthouse a11y en CI sur un harnais de pages apprenant montées avec données mock** (cf. §11.4), (c) RUM `WebVitals.tsx` étendu en prod.

---

## 11. Stratégie de tests a11y (Definition of Done)

### 11.1 Automatisé unitaire — `vitest-axe`

- Chaque composant `src/components/elearning/**` a un test `*.a11y.test.tsx` montant le composant (états : verrouillé, en cours, résultat, erreur) et assertant **0 violation `critical`/`serious`** (`axe-core`).
- Couvre 1.1.1 (alt), 1.3.1 (structure), 4.1.2 (rôles), 1.4.3 (contraste sur DOM statique), labels de formulaire.

### 11.2 Clavier / interaction — Playwright

- Scénarios : parcours player **100 % clavier** (play/seek/captions/fullscreen/escape), répondre à chaque type de quiz au clavier (surtout `ordonnancement`/`appariement`/`zone_cliquable` **sans souris**), soumission, navigation modules.
- Assertions ciblées : **2.4.11** (focus non masqué — `boundingBox`), **2.5.8** (taille de cible mesurée), **2.1.2** (pas de trap : `Tab` boucle / `Échap` libère).

### 11.3 Lecteur d'écran (manuel, checklist RGAA)

- **NVDA + Firefox** (Windows), **VoiceOver + Safari** (iOS/macOS) sur : dashboard, sommaire (verrou + raison annoncés), player (sous-titres, état lecture, position), quiz (énoncé, options, timer aux paliers, résultat), déverrouillage (annonce), auth.
- Checklist **RGAA 4.1** (106 critères) tenue dans `09-QUALITE/04-accessibilite-wcag22.md` ; ce document fournit le **mapping LMS** des critères à risque.

### 11.4 Lighthouse a11y en CI (harnais apprenant)

- Petite suite Playwright qui monte les pages `/apprendre/**` avec une **session apprenant mock** + données seed, puis lance Lighthouse (catégorie accessibility ≥ 0.95 cible interne) **mobile + desktop**. Complète le `pnpm lhci` public (qui ne voit pas l'espace authentifié).
- Réutilise les assertions a11y déjà actives dans `lighthouserc.json` : `target-size`, `color-contrast`, `label-content-name-mismatch`, `list`/`listitem`.

### 11.5 Garde-fous « contenu » (côté auteur, vérifiés à la publication)

Empêchent un cours **inaccessible par les données** (l'a11y ne dépend pas que du code) — implémentés dans `publish-service.ts` / `quiz-authoring.ts` :

- Leçon `video` sans piste `sous_titres` → **bloque la publication** (1.2.2).
- Média d'énoncé / option sans `alt` → bloque (1.1.1).
- Zone `zone_cliquable` < 24 px ou sans étiquette → bloque (2.5.8 / 4.1.2).
- Couleur seule pour une consigne (heuristique / revue) → avertissement.

---

## 12. Composants & utilitaires a11y à construire (récap chemins) [NEUF]

| Fichier cible                                                                                                                 | Rôle                                                     | Critères servis          |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| `src/components/elearning/a11y/SkipLink.tsx`                                                                                  | « Aller au contenu » / « Aller au lecteur »              | 2.4.1                    |
| `src/components/elearning/a11y/LiveRegion.tsx`                                                                                | Région `aria-live` partagée (statuts)                    | 4.1.3                    |
| `src/components/elearning/a11y/VisuallyHidden.tsx`                                                                            | Texte lecteur d'écran seul                               | 1.1.1, 1.3.1             |
| `src/components/elearning/a11y/FocusTrap.tsx`                                                                                 | Piège focus modales (libérable Échap)                    | 2.1.2, 2.4.3             |
| `src/components/elearning/a11y/LockedReason.tsx`                                                                              | Verrou + raison accessible                               | 1.4.1, 4.1.2             |
| `src/hooks/elearning/useReducedMotion.ts`                                                                                     | Lecture `prefers-reduced-motion`                         | 2.2.2, 2.3.3             |
| `src/components/elearning/player/Player.tsx` (+ `PlayerControls`, `CaptionsMenu`, `TranscriptPanel`, `PlaybackKeyboardLayer`) | Player a11y complet                                      | 1.2.2, 2.1.1, 2.5.7, 5.x |
| `src/components/elearning/quiz/*` (cf. doc 03 §11)                                                                            | 12 types accessibles + timer                             | 2.5.7, 2.5.8, 2.2.1      |
| `src/styles/elearning-a11y.css` (ou tokens dans la couche existante)                                                          | `.lms-target` (≥44px), `--lms-sticky-*`, `scroll-margin` | 2.4.11, 2.5.8            |

> **Réutilise** `globals.css` (focus-visible, reduced-motion, tokens couleur AA) — `elearning-a11y.css` n'ajoute QUE le spécifique LMS (cibles, scroll-margin des barres collantes), jamais un doublon de tokens.

---

## 13. Checklist d'acceptation (à cocher avant merge d'un écran apprenant)

- [ ] **SkipLink** présent ; H1 unique ; ordre de focus logique (2.4.1/2.4.3).
- [ ] **Focus visible partout** ; jamais `outline:none` sans remplacement (2.4.7) ; **focus jamais masqué** par barres collantes (2.4.11).
- [ ] **100 % clavier** ; pas de piège ; `Échap` libère modales/fullscreen (2.1.1/2.1.2).
- [ ] **Player** : sous-titres WebVTT présents + transcription + raccourcis clavier + **pas d'autoplay** (1.2.2/2.2.2).
- [ ] **Quiz** : drag toujours doublé d'une **alternative clic/clavier** (2.5.7) ; cibles **≥ 24 px** (44 px primaires) (2.5.8) ; timer annoncé + extensible (2.2.1).
- [ ] **Verrou** = icône + texte + **raison** ; déverrouillage annoncé `aria-live` (1.4.1/4.1.3).
- [ ] **Auth** : magic-link sans test cognitif ; mot de passe = collage + gestionnaire OK, pas de CAPTCHA cognitif (3.3.8).
- [ ] **Couleur** : aucune info portée par la couleur seule ; contrastes AA (1.4.1/1.4.3/1.4.11).
- [ ] **Reflow 320 px** sans scroll horizontal ; orientation libre ; zoom 200 % OK (1.4.10/1.3.4/1.4.4).
- [ ] **Messages d'état** (sauvegarde, résultat, erreurs, temps) en `aria-live`/`role=alert` (4.1.3/3.3.1).
- [ ] **Perf** : composant lazy `dynamic()` si lourd ; CLS=0 (`aspect-ratio`) ; `size-limit` vert ; heartbeat `sendBeacon`.
- [ ] **Tests** : `vitest-axe` 0 violation serious ; scénario Playwright clavier vert ; Lighthouse a11y ≥ 0.95 (harnais apprenant).
- [ ] **Garde-fous données** : publication bloquée si vidéo sans sous-titres / média sans alt / hotspot < 24 px.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth hybride → 3.3.8), ADR-LMS-0005 (Cloudflare Stream → player), ADR-LMS-0007 (cloisonnement composants).
- `02-ARCHITECTURE/architecture-globale.md` — §7.3 (cadre WCAG), §10 (Web Vitals), §4.2 (routes playback/resource/heartbeat).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningResource type="sous_titres"`, `ElearningLessonType`, `dureeEstimeeMinutes`.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `LessonProgress.dernierePositionSec` (reprise), `ModuleProgress.estDeverrouille`/`verrouRaison` (verrou + raison).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — 12 `QuestionType`, `Quiz.tempsLimiteSec`/`FeedbackMode`, composants quiz (§11), garde-fous auteur.
- `05-FRONTEND-APPRENANT/01-espace-apprenant-dashboard.md` — dashboard (responsive §9.2).
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — player (consomme §5).
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — UI quiz (consomme §6).
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique verrou (consomme §8).
- `04-BACKEND/05-authentification-apprenant.md` — auth apprenant (§7).
- `04-BACKEND/07-pipeline-video-streaming.md` — Cloudflare Stream, sous-titres ingestion (§5.2).
- `09-QUALITE/03-web-vitals-performance.md` & `09-QUALITE/04-accessibilite-wcag22.md` — plan perf + checklist RGAA 4.1 complète (ce doc = mapping LMS).
- `axionia/AGENTS.md` + `lighthouserc.json` — budgets Web Vitals & assertions a11y existantes (`target-size`, `color-contrast`).
  </content>
  </invoke>
