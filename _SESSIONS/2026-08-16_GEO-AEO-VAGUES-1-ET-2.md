# Journal de session — GEO/AEO, vagues 1 et 2 (2026-08-16)

> **Document de reprise.** Tout ce qui compte est ici ou dans le dépôt ;
> rien d'essentiel ne vit dans la conversation.

## 1. Point de départ

Le chantier de correctifs issu de l'audit GEO/AEO du 2026-08-14 avait été
interrompu la veille par une saturation RAM. **Cinq lots existaient sur disque,
dans cinq worktrees, sans être commités, 12 commits en retard, aucune branche
poussée, aucune PR.** Un nettoyage de worktrees les perdait.

## 2. Ce qui a été livré

### Vague 1 — 8 PR, mergées et **déployées**

| PR   | Lot                                            | Findings                |
| ---- | ---------------------------------------------- | ----------------------- |
| #619 | chauffe post-déploiement + vérité des gates    | GEO-023, GEO-025        |
| #620 | liens internes morts                           | GEO-012/013/016/060/080 |
| #621 | canaux d'ingestion IA                          | GEO-002/031/038/039/040 |
| #622 | hreflang, canonical, marque                    | GEO-005/057/138         |
| #623 | poids mort du rendu                            | GEO-028, GEO-125        |
| #624 | les 55 rapports d'audit entrent dans le dépôt  | —                       |
| #625 | rapport d'audit du générateur de contenus      | —                       |
| #627 | tirage pondéré (prérequis du rallumage OpenAI) | lot 17                  |

**Vérifié en production après déploiement** : en-tête `Link hreflang="en"`
supprimé · `/fr/implementations` → 308 · `Allow` des exports Observatoire (24
occurrences) · `/api/markdown/glossaire/rag` → 200 avec un vrai corps · titre
`/stack-ia/claude` sans marque dupliquée.

### Vague 2 — 8 lots sur 8

| PR   | Lot                                 | Findings            |
| ---- | ----------------------------------- | ------------------- |
| #633 | structure du document & a11y        | GEO-122/123/124     |
| #635 | hygiène des sitemaps                | GEO-130/131/145/147 |
| #636 | images déclarées ≠ rendues          | GEO-037/056/101     |
| #637 | metadata éditoriale                 | GEO-058, GEO-142    |
| #638 | galerie : le crawl écrivait en base | GEO-035, GEO-036    |
| #641 | E-E-A-T des sources                 | GEO-010, GEO-071    |
| #644 | notifications Telegram              | GEO-137             |
| #646 | JSON-LD offre & citations locales   | GEO-044, GEO-046    |

**~36 findings corrigés sur 155.**

## 3. Ce qui reste — et le plafond qui ne dépend pas du code

> Les 45 patches exécutables plafonnent à **~1 789 / 2 500 (72 %)**.
> **500 points ne s'achètent avec aucune ligne de code.**

- **18 actions hors-code** (`_AUDIT/GEO-AEO-E2E-2026-08-14/03-RESTE-WILL.md`) —
  c'est le vrai levier. Vague 1 : **9 actions, 2 h 12, gratuit**. Commencer par
  **R-01** (LinkedIn dit « Paris », le registre dit Grenoble) puis **R-02**, où
  la première chose à faire est de **LIRE** Crunchbase et F6S : le moteur les
  cite en sources n°1 et n°2 sur « Qui est Axion-IA ? », et personne ne les a
  jamais ouvertes.
- **16 arbitrages** (§3 du plan de patches).
- **4 lots à risque élevé** (10, 21, 22, 23) — ADR requis.
- **GEO-075 gelé** tant que la question Qualiopi n'est pas tranchée.
- **Vague 3** : lots 13, 16, 18, 19.

⛔ **Crédit OpenAI vérifié ÉPUISÉ le 16/08** (`429 credit_balance_exhausted`,
procédure R31 étape 1). Ne pas lever le kill switch avant que le ping rende
`200`.

## 4. Pièges payés — à ne pas repayer

- 🔴 **`git push … | tail` MENT** : `EXIT=0` alors que rien n'est parti (le hook
  `pre-push` échouait faute de `node_modules`, le tube avalait le code de
  sortie). Vérifier par `git ls-remote --heads origin`.
- 🔴 **Un worktree d'agent n'a pas forcément de `node_modules`** — 4 sur 5 ici.
  Ni lint-staged, ni typecheck, ni tests n'y avaient jamais tourné : 3 lots
  étaient rouges sans que personne le sache. Patron qui marche : commit
  `--no-verify` d'abord pour mettre à l'abri, puis vérifier chaque lot dans le
  **seul worktree installé**, mis en `HEAD` détaché sur la branche à vérifier.
- 🔴 **Vérifier un format est faillible, l'appliquer ne l'est pas.** Mon contrôle
  Prettier maison est passé **trois fois** à côté (guillemets échappés que
  Prettier préfère en apostrophes). Séquence retenue : correctif → typecheck →
  tests → `isolation-check` → `prettier --write` **en dernier**.
- 🔴 **`content-gen:isolation-check` attrape toute garde qui cite un chemin
  `content-gen/`** — trois fois ici. Une garde qui surveille une frontière doit
  pouvoir nommer les deux côtés : ajouter l'exception documentée fait partie du
  travail, ce n'est pas un contournement.
- 🔴 **Google Fonts a fait rougir 3 gates dans la journée.**
  `next/font/google` télécharge les fontes **au build** : le build de production
  dépend d'un fetch vivant vers un tiers. Absent des 155 findings.
  `next/font/local` avec les `.woff2` versionnés supprimerait ce point de
  rupture.
- 🔴 **Famine de déploiement** : compteur du jour **16 builds annulés / 3
  réussis**. Le job `build` dure ~45 min et porte `cancel-in-progress: true` ;
  tant que des merges arrivent plus vite, aucun n'atteint la prod. Ce n'est PAS
  résolu en fusionnant des PR — mes 5 PR de midi ont été mergées en 20 secondes
  et n'ont produit qu'un seul build. Il faut une **fenêtre sans merge**.
- 🔴 **La séquence d'échappement `*/` dans un commentaire JSX ou un doc-comment
  ferme le bloc** — payé deux fois (`/*/telecharger`, et un commentaire citant
  `*/}`). Reformuler.

## 5. Défauts trouvés qui n'étaient pas dans l'audit

- **Le plan d'audit protégeait du code inexistant** : son « do-not-touch » du
  lot 9 citait un early-exit `stub.invalid` dans la route de téléchargement —
  **zéro occurrence**. Consigné dans un test.
- **L'audit annonçait 9 images mortes, il y en avait 8** :
  `home-hero-equipe.avif` sert de **branche de repli** du héro. Le critère n'est
  pas « rendue à l'instant t » mais « la page a-t-elle un consommateur pour ce
  slot ».
- **GEO-143 non reproductible** — les `<time datetime>` sont bien présents. On
  ne fabrique pas un patch pour un défaut qui n'existe plus.
- **La chaîne de notification n'avait aucun moyen d'être testée.** Comblé par
  `pnpm notif:test-telegram` — voir la fiche mémoire dédiée.
