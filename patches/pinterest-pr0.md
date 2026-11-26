# Pinterest, PR 0 : décisions écrites (ADR-0015 et relevé des règles)

Patch à appliquer sur `studio-axion-ia-public` (`git am patches/pinterest-pr0.patch`), branche `feat/pinterest-pr0` depuis `master` (10d60d33).

## Quoi

Documents seulement, aucun code applicatif :

- `docs/adr/0015-pinterest-epingles.md` (statut « brouillon, à valider par le fondateur ») : amende ADR-0004 D6 (route de lecture des tableaux), D8 (`isAiGenerated` selon `epingle.contenuIA`), D9 (cible `<accountId>:pin:<boardId>`, jamais le premier tableau, tableaux publics), D10 (1 image, 20 Mo, 2:3, alt 500 pour Pinterest seulement, lien sur le domaine du site exact), ADR-0010 (« Valider ce lot »), ADR-0012 (anti-répétition) ; limites écrites ; créneaux 08:30, 12:30, 17:30, 21:00.
- `docs/reseaux/regles-officielles.json` et `REGLES-OFFICIELLES.md` : section `pinterest` (deux couches) et constantes `IMAGES_MAX.pinterest`, `ALT_MAX_PINTEREST`.
- `tests/reseaux/regles-officielles.test.ts` : liste des réseaux actifs + `pinterest`, constantes attendues.

## Pourquoi

La PR 3 contredit des décisions d'une ADR acceptée : l'amendement doit être écrit avant tout code (plan corrigé, section 7, PR 0).

## Tests lancés

- Test écrit d'abord : rouge (4 échecs), puis vert : `npx vitest run tests/reseaux/regles-officielles.test.ts` → 7 passés, 1 ignoré (variable `MOTS_FONDATEUR` absente).
- `npx vitest run tests/reseaux` : 316 passés, **1 échec déjà présent sur `master`** (`instantane-tables-formats.test.ts`, « les portes … restent écrites dans leurs fichiers », vérifié par stash : même échec sans mes changements).
- `tsc --noEmit` : erreurs seulement dans `docs/formats/image-video/variete/prototypes/**` (module `remotion` absent) et non liées au patch ; aucune dans les fichiers touchés. Le script `typecheck` n'existe pas dans le Studio (`verifier` = tsc + eslint + vitest + next build, non lancé en entier).
- Aucune valeur réelle ajoutée (ni identifiant, ni nom, ni prix).

## Fichiers touchés

- `docs/adr/0015-pinterest-epingles.md` (nouveau)
- `docs/reseaux/REGLES-OFFICIELLES.md`
- `docs/reseaux/regles-officielles.json`
- `tests/reseaux/regles-officielles.test.ts`

Fichiers studio-rendu touchés : **non**.

## Écarts avec le plan, à trancher

- **Extrait OpenAPI non modifié** : `docs/zernio/LISEZMOI.md` interdit la modification à la main ; la route `GET /v1/accounts/{accountId}/pinterest-boards` reste à ajouter par une session qui régénère l'extrait. En conséquence, les cellules Pinterest qui ne reposent que sur docs.zernio.com (description 800, médias, 32 Mo, absence d'inbox) valent « inconnu », et `IMAGES_MAX.pinterest` est « inconnu » dans le relevé. Un point est ajouté dans « À valider par le fondateur » (10 lignes max respectées).
- **Point de contrôle hors dépôt** (aucun fichier visé par les PR 1 à 7 n'est patché sur le serveur) et annonce de zone : non faits ici.
- La couche « réseau » de Pinterest est entièrement « inconnu » (aucune page Pinterest lue).
- `pnpm-lock.yaml` : non concerné (installation du Studio faite dans `/tmp` avec un magasin local).
