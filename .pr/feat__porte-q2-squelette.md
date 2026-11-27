Porte qualité Q2 : squelette pur (registre, réglages, verdict)

## Quoi

Un nouveau dossier `src/server/content-gen/porte-qualite/`, sans aucune entrée ni sortie : pas de base de données, pas de réseau, pas de migration. Rien n'est branché dans la production.

- **Registre `CRITERES`** : un seul endroit qui liste les critères, avec la colonne de classe du § 5 (dur, corrigeable, dérogeable). Les classes sont verrouillées par un test.
- **Réglages** : un schéma Zod unique (`ReglagesPorteSchema`), avec les valeurs de départ (publier à 85, bloquer sous 70).
- **Note** : la formule unique du § 4.3 (maxima 54 + 16 + 10 + 6 = 86, note minimale 14).
- **Verdict** : `publiable`, `a_corriger` ou `bloque`.
- **Critères codés** : B01 (doctrine, appelle `interdits-publication.ts`), B03 (prix d'une offre Axion-IA), B08 (réponse directe de 40 à 60 mots), B11 (complétude, reprend `data-quality-gate.ts` côté porte seulement, **sans** la règle FAQ ni `expertQuote`), B13 (maillage sortant), B14 (auteur et dates).
- **Contrôles de structure déterministes** : B11a (un seul H1), B11b (aucun saut de niveau de titre), B11c (réponse directe sous le H1).

## Règles de sûreté

- Échec fermé : réglages illisibles, erreur dans un critère, horloge invalide, pénalité non finie → jamais « publiable ».
- Source indisponible = « non évalué », et un critère bloquant non évalué bloque.
- Un critère prévu au § 4.1 mais pas encore codé (B02, B04 à B07, B09, B10, B12, B15, B16) compte comme non évalué : au squelette, l'entrée publique `evaluerPorte` rend donc toujours `bloque`. C'est voulu : elle n'est branchée nulle part.
- « Partout en France » n'est refusée par aucun critère (test). « Grenoble », Qualiopi et CPF restent refusés.

## Limites connues, reportées

- Exceptions du § 5 (B04 non évalué = relecture humaine, Search Console) : champ `siNonEvalue` à poser avant Q3.
- État `reporte` (B17) : Q10. Ancres variées de B13 : Q16.
- B03 ne juge que les phrases qui parlent d'Axion-IA ; les autres montants relèvent de B02 (Q3).
- Entités HTML accentuées nommées non décodées ; test de pureté non transitif.
- B11a et B11c supposent que le HTML fourni contient le H1.

## Comment vérifier

`pnpm vitest run src/server/content-gen/porte-qualite` (98 tests), `pnpm typecheck` (aucune erreur dans le dossier ; les autres erreurs viennent du client Prisma non généré dans cet environnement), `prettier --check`.

## Relecture

Trois relectures Opus. La troisième a relevé trois points (B03 qui mélangeait titres et paragraphes, page propriétaire inconnue sautée en silence, option publique `idsAttendus`), corrigés ensuite, **sans nouvelle relecture** (plafond de trois tours atteint).

VERDICT OPUS : À CORRIGER
