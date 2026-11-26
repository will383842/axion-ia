# Maillage vérifié (équipe éditoriale, PR 8)

## But
- Catalogue de liens internes V2 construit automatiquement (pathnames du routage, villes citables, articles publiés fournis par l'appelant). Priorité : Journée IA, hubs statiques, pages villes, articles proches.
- Nouveau module `maillage.ts` : refuse un lien interne vers une route inconnue ; contrôle HTTP des liens externes (HEAD puis GET de repli, délai 4 s) ; refuse redirections, codes ≠ 200 et sources de niveau `low`/`excluded` (notion existante : `trust-tier.ts`).
- Tout est éteint par défaut : actif seulement si `CONTENT_EQUIPE_EDITORIALE` vaut exactement `true`. Éteint = catalogue statique d'avant.

## Fichiers
- `src/server/content-gen/equipe/maillage.ts` (+ `maillage.test.ts`)
- `src/server/content-gen/links/internal-link-catalog.ts` (+ `internal-link-catalog.test.ts`)

## Tests
Réseau simulé : route inconnue, redirection (HEAD et GET de repli), niveau faible, http/port/hôte local, `/en`, interrupteur éteint (aucun appel réseau, sortie V1 identique). Specs `src/server/content-gen` : toutes vertes ; typecheck, eslint, prettier propres.

## Risques / limites assumées
- `maillage.ts` n'est pas encore branché sur le pipeline de génération (branchement = PR suivante) ; aucun générateur ne passe encore `articles`.
- Interrupteur allumé, le catalogue V2 (Journée IA, villes) s'applique tout de suite aux 9 générateurs.
- Routes dynamiques acceptées comme jokers ; DNS rebinding non traité ; villes à nom composé ou accentué non liées (limite de `anchor-safe-link`).
- Aucun champ de job BullMQ, aucune migration, aucun fichier interdit touché.

VERDICT OPUS : BON
