# ADR 0071 — Page vidéo du site : le budget First Load JS par route n'est pas tenu

- **Statut** : **ACCEPTÉ** — décision de Will, le 2026-10-18 (option « A »)
- **Date** : 2026-10-18
- **Auteur** : Claude, sous mandat de Will
- **Référence** : ADR 0049, ADR 0069, ADR 0070, PR #1604, #1605, #1606, `AGENTS.md` (« Performance budget »)

## 1. Contexte

La relecture Opus des PR #1604, #1605 et #1606 (lot W2, page vidéo du site) a mesuré le
First Load JS de la route `/fr/videos/[slug]` : environ **286 KB gz**, contre le budget de
**75 KB gz par route** écrit dans `AGENTS.md`. `AGENTS.md` demande un STOP & ASK Will et un
ADR pour tout patch qui dégrade ces seuils : cet ADR consigne la réponse.

## 2. Faits

- `/fr/videos/[slug]` : ~286 KB gz de First Load JS, pour un budget de 75 KB par route.
- **Aucune page du site ne tient cette cible** : le shell partagé pèse déjà ~137,5 kB
  brotli (dette ouverte chiffrée dans `AGENTS.md`, cliquet à 138 KB). La page vidéo n'est
  pas une exception de conception mais l'état de tout le site.
- Le cliquet `bundle:check` (somme des page chunks publics, 285 kB, ADR 0069) **n'est pas
  relevé** : 284,45 kB mesurés, marge de 0,55 kB.
- **CLS = 0 par construction** : les chapitres sont rendus côté serveur (présents dans le
  HTML), aucune place réservée à deviner. Verrouillé par le test « les chapitres sont dans
  le HTML serveur ».
- Tout est **éteint** derrière `VIDEOS_SITE_ENABLED` : aucune vidéo publiée, rien de visible.

## 3. Décision

**Option A** : accepter la page `/fr/videos/[slug]` telle quelle, comme les autres pages du
site, **sans lot d'allègement avant fusion**. Le cliquet public n'est pas relevé.

## 4. Conséquences et suite

- Le budget de 75 KB par route reste **non tenu** sur cette route comme sur les autres ;
  ce n'est pas une régression propre à W2.
- L'allègement du shell partagé est un **chantier à part**, à mesurer avec Lighthouse avant
  toute activation du site.
- **Condition d'activation** : avant de poser `VIDEOS_SITE_ENABLED=true`, mesurer **LCP et
  INP** sur `/fr/videos/[slug]` (cibles internes : LCP ≤ 1 800 ms, INP ≤ 100 ms p75) ; les
  octets se lisent sur une passe, le temps se borne sur plusieurs runs et se lit en médiane
  (`AGENTS.md`).
- Marge du cliquet de 0,55 kB : toute PR publique suivante qui l'entame devra alléger ou
  faire l'objet d'un nouvel ADR de relèvement.
