Encart vidéo E1 : le répartiteur (module pur) et le schéma des réglages

## Ce qui est ajouté (dossier `src/server/videos/repartiteur/`)

1. **`repartiteur.ts`** : fonction pure `choisirVideo`. Aucune base, aucun Redis, aucune horloge (l'instant est un paramètre), aucun aléa. Règles dans l'ordre :
   - réglage éteint ou type de contenu non activé → pas d'encart ;
   - vidéos exclues écartées ;
   - **seuil** : score ≥ `seuilMin` (et ≤ `seuilMax` s'il est posé, éteint par défaut) ; jamais de remplissage ;
   - **plafond dur** : une vidéo qui a déjà `plafondParVideo` affectations actives dans la fenêtre est exclue (l'affectation du contenu lui-même ne compte pas) ;
   - **voisins** : les vidéos déjà affectées aux contenus voisins sont écartées ;
   - **classement** : score − λ × (affectations / plafond), comparaison exacte ; égalité départagée par `departageStable` (hachage FNV-1a, déterministe), puis slug, puis identifiant.
   - Chaque refus rend une raison claire (`sous-seuil`, `plafond`, `voisins`, `score-invalide`…). `VERSION_ALGO` est exportée.
2. **`reglages.ts`** : schéma Zod unique de la clé `videos_encarts` + défauts gelés. **Tout est éteint par défaut** (`actif` faux, pas de seuil maximal). Le schéma reste un objet simple lisible par `.shape` (pour le futur test de parité). `analyserReglagesEncarts` ajoute la règle `seuilMax ≥ seuilMin`, accepte `seuilMax: null`, et offre un mode `tolerant` (clés inconnues ignorées) pour la lecture par le worker pendant la fenêtre de mise en ligne app/worker.

## À savoir

- Les seuils par défaut (0,6, plafond 20, fenêtre 30 jours) sont **provisoires** : à calibrer sur le stock réel avant tout allumage.
- La rotation par hachage des villes et le filtre de thèmes des villes ne sont **pas** ici : ils relèvent de E7.
- Un nouveau type de contenu ajouté plus tard par l'app éteindrait les encarts sur un ancien worker (côté sûr) : la limite est écrite dans le code.
- Cette PR est indépendante de E0 (autre branche, les deux partent de `origin/main`).

## Contrôles

- Tests écrits d'abord (rouges : modules absents), puis code minimal : 60 tests verts (seuil, plafond, voisins, départage, permutations, pureté, schéma).
- `pnpm typecheck` : vert. `eslint` et `prettier --check` : verts.
- Aucune migration, aucun « use client », aucune entrée/sortie, aucun fichier interdit touché. Rien n'est branché ni allumé.
- Relecture opus en 3 tours ; le dernier a porté sur le code final.

VERDICT OPUS : BON
