# Pages équipe R2a : briques visuelles, héros foncé, chiffres, « en bref », appel final

Lot R2a du plan de refonte visuelle des pages équipe. Branche créée depuis `origin/main` (F7 y est
déjà fusionnée par squash). Les lots voisins touchent d'autres fichiers ; l'assemblage vient en R2d.

## Résumé

- Nouvelles briques serveur dans `src/components/equipe/visuels/` : `icones.ts`, `SectionFiche.tsx`
  (fond, `data-fond`, halo terracotta seul), `EnteteQuestion.tsx` (sur-titre, H2 en question,
  réponse directe sans `data-answer`), `ChiffresCles.tsx` (rien sous 2 chiffres),
  `GrilleEnBref.tsx` (la `dl` en grille de cartes à icônes), `BandeauAppel.tsx` (terracotta foncé).
- `HeroCollaborateur.tsx` : fond foncé, capsule claire pour la catégorie, pastilles à icônes,
  rangée de chiffres facultative, date dans le héros. Props nouvelles et facultatives
  (`chiffres`, `pastillesDetaillees`).
- `ActionsFiche.tsx` : prop `fond` (`clair`, `fonce`, `terracotta`) : variantes et anneau de focus
  sans bleu.
- Aucun `"use client"`, aucune dépendance, aucun hex, aucune migration. Pas encore branchées dans
  `ProfilCollaborateur` (R2d).

## Fichiers

Créés : `visuels/{icones.ts,SectionFiche.tsx,EnteteQuestion.tsx,ChiffresCles.tsx,GrilleEnBref.tsx,BandeauAppel.tsx}`,
`__tests__/r2a-briques.spec.tsx`, `__tests__/contraste-gabarit.spec.ts`.
Modifiés : `HeroCollaborateur.tsx`, `ActionsFiche.tsx`.

## Vérifications lancées

- `pnpm typecheck` (avec `NODE_OPTIONS=--max-old-space-size=8192`) : OK.
- `pnpm lint src/components/equipe` : OK. `prettier --check` : OK.
- `pnpm vitest run src/components/equipe` : 7 fichiers, 111 tests passés.
- grep des mots interdits et des classes bleues (hors tests) : rien ; aucun `"use client"` hors `questionnaire/`.
- `pnpm-lock.yaml` non touché.

Les attentes de `briques.spec.tsx` et `profil-williams.spec.tsx` n'ont pas eu besoin de changer.

## Relecture Opus et corrections

Défauts relevés puis corrigés : `dt`/`dd` désormais enfants directs d'un `div` de la `dl` (icône
placée dans le `dt`) avec test du parent ; survol de carte sous `motion-safe:` (test étendu à
`translate`) ; test de la priorité du portrait ; paire de contraste sans valeur (seuil 1) remplacée
par `mocha-fg` / `terracotta` (titres ≥ 24 px). Écart assumé : le lien LinkedIn vérifiable reste
sous la grille (un `p`), non dans une carte, pour garder une `dl` valide ; R2d pourra l'intégrer.

Vérifications relancées après corrections : typecheck, lint, prettier, vitest (src/components/equipe) : tous OK (7 fichiers, 111 tests passés).

VERDICT OPUS : BON
