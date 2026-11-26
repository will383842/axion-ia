# Patch Studio : Pinterest PR 0, v2 (corrections de la relecture)

Patch pour le dépôt public du Studio (`git am patches/pinterest-pr0-v2.patch` sur `origin/master`). Il contient 2 commits : le commit d'origine de `feat/pinterest-pr0` (`2a068df6`) et un commit de corrections (`31bb6dfb`). Rien n'a été poussé sur le dépôt du Studio.

## Corrections appliquées (relecture, section 5)

- **C-1** : la cellule `pinterest.zernio.texte_alternatif` (`.md` et `.json`) dit « 500 signes au plus sur Pinterest ». Le rappel du 125 reste dans la note de la constante.
- **C-2** : ADR-0015, D10 : « réglage `site.domaine`, créé en PR 3, défaut = hôte de `BASE_PUBLIQUE` ». La garde réutilise `lienDeChezNous` avec égalité stricte d'hôte.
- **C-3** : ADR-0015, anti-répétition : l'import « signale, le fondateur tranche » (alignement sur ADR-0012). La comparaison porte sur les contenus déjà publiés ou programmés. Aucun amendement de l'ADR-0012.
- **C-4** : 210 min = plus petit écart entre deux créneaux décidés, appliqué comme écart conseillé de la cadence (message, pas refus). Les quatre heures vivent dans `REGLAGES_CADENCE_DEFAUT.reseaux.pinterest`.
- **C-5** : `valeur_code` de `IMAGES_MAX.pinterest` et `ALT_MAX_PINTEREST` : « (à poser en PR 3) » (`.md` et `.json`).
- **C-6** : ADR-0015, points ouverts : la régénération de l'extrait OpenAPI est un préalable « avant la PR 3 ». Les trois cellules restent « inconnu ».
- **C-7** (nits) : « (doc `reference.mdx`, hors extrait) » ajouté à l'absence de boîte de réception ; mention de `RecyclingConfig` (variantes de contenu pour X et Pinterest) dans la cellule `duplication` de Pinterest ; « débit en rafale (≥ 10) » dans « À valider ». La fusion de deux lignes de « À valider » (limite de 10 lignes du test) est conservée : à mentionner dans la description de la PR.

## Test lancé

`tests/reseaux/regles-officielles.test.ts` : **7 réussis, 1 sauté** (`MOTS_FONDATEUR` non fourni, donc le contrôle des noms privés par liste n'a pas tourné ici ; il doit tourner dans la CI du Studio).
Les dépendances du Studio ne sont pas installées : le test a été lancé avec le Vitest de ce dépôt et une config minimale (PostCSS désactivé).

## Divergences

`pnpm-lock.yaml` d'axion-ia : identique entre `main` et cette branche. Rien à signaler.
