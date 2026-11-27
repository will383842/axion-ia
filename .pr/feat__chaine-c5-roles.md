Chaîne éditoriale C5 : les sept rôles de l'équipe IA, un module testé chacun, éteints

## Quoi

Dans `src/server/content-gen/chaine/roles/`, un module par rôle de la conception (rien n'est branché sur la publication, aucune migration, aucun appel réseau : l'appel au modèle est injecté) :

- `commun.ts` : modèles par rôle (Opus 5.5 pour brief, rédaction et expert ; Sonnet 5.5 ailleurs ; jamais Fable ni Haiku), plafond de 3 $ par contenu et par rôle avec **réservation du coût maximal avant l'appel** (tarifs de la conception), 2 réécritures, sortie JSON validée, pages lues traitées comme des données, règles de marque (« Grenoble », `/appel`, Calendly, avocat, frais, prix barré refusés ; « partout en France » reste permis).
- `collecteur-faits.ts` (R3), `strateg-brief.ts` (R2) avec `structure-hn.ts` (titres H1/H2, fourchette de longueur, formats), `redacteur.ts` (R4 + réécriture ciblée), `expert-critique.ts` (R5) avec `equilibre-sections.ts`, `verificateur-faits.ts` (R6), `editeur-forme.ts` (R7), `chercheur-besoins.ts` (R1, environ 80 % de dirigeants de PME et 20 % de TPE), `interrupteur.ts` (tout éteint par défaut : `CONTENT_CHAINE_EDITORIALE` et un interrupteur par rôle).
- Principe : le modèle propose, le code vérifie (extrait exact retrouvé dans la page, chiffres du dossier seulement, FAQ tirée du brief, liens autorisés, chiffres inchangés avant/après l'édition, échec fermé).
- Tests (254 dans `chaine/`) dont un contrat de sécurité : pas de Fable/Haiku, modules purs, aucun importeur hors de la chaîne, codes de refus dans la liste fermée de C4.

## Base de la PR

`main`. La branche contient aussi, par fusion, les commits de C4 (`feat/chaine-c4-codes-refus`, fiche C4 : « À CORRIGER, non relus ») ; C3 est déjà sur `main`. Le diff de C5 proprement dit est le dossier `chaine/roles/`. Les premiers commits de rôles ont été regroupés par un incident de crochet de commit (le message « R3 » refusé par commitlint) : R3 et les règles de structure sont dans un même commit.

## Tests

`pnpm vitest run src/server/content-gen/chaine` (254 verts), `pnpm typecheck`, `pnpm lint` et `prettier --check` sur les fichiers modifiés, `pnpm content-gen:isolation-check`, `pnpm image-bank:isolation-check` : verts.

## Points connus, non traités

- Le fournisseur réel (réservation de coût, outils web, test de lien anti-SSRF avec redirections manuelles) est à écrire avec l'orchestration C10 ; le contrat est documenté dans `commun.ts` et `verificateur-faits.ts`. Les `maxTokens` sont à recalibrer à ce moment.
- `intention_hors_article` n'a pas de code propre dans la liste de C4 (enregistré sous `intention_couverte`, verdicts distincts) : à décider avec la porte.
- Une correction « global » (ordre du plan, longueur, défaut avant le premier H2) n'est pas réécrivable : l'orchestration doit abandonner (`peutSeReecrire`).
- Reconnaissance des chiffres en lettres incomplète (formes rares), tournures « faire seul » partielles : le modèle R5 et la porte restent les filets.
- Trois tours de relecture Opus faits ; le troisième a relevé deux défauts (chiffres en lettres avec unités, attribut `href` leurré) et quelques points mineurs, corrigés ensuite. Le code final n'a pas été relu une 4e fois (limite de 3 tours).

VERDICT OPUS : À CORRIGER (points du dernier tour corrigés, non relus)
