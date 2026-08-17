# Journal de session — GEO/AEO vague 3 (nuit du 2026-08-16 au 17)

> **Document de reprise.** Tout ce qui compte est ici ou dans le dépôt.
> Suite de `2026-08-16_GEO-AEO-VAGUES-1-ET-2.md`.

## 1. Le défaut qui bloquait tout le monde, et qui n'était dans aucun audit

**`next/font/google` télécharge les fontes PENDANT LE BUILD.** Le résultat est
bien auto-hébergé — aucun visiteur ne joint Google — mais le build de production
dépendait d'un fetch vivant vers un serveur tiers.

Le 2026-08-16, gstatic a rendu `404` sur des URLs que son propre CSS venait de
servir aux runners GitHub :

|                               |                                          |
| ----------------------------- | ---------------------------------------- |
| Dernier déploiement réussi    | **14 h 51** (`cf26c3c`)                  |
| Dernier build réussi          | **15 h 56** — puis plus aucun, ~6 h      |
| Gates rouges sur du code sain | **3**, dont une PR de documentation pure |

🔑 **Le piège de diagnostic** : depuis un poste français au même moment, les
mêmes URLs rendaient `200`. L'échec dépend de l'edge CDN qui répond au runner.
De quoi conclure « flake » et rejouer le job indéfiniment. **Ne rien conclure de
la joignabilité depuis la machine locale.**

🔑 **Absent des 155 constats de l'audit** : on audite les tiers dont dépend une
_page_, jamais ceux dont dépend un _build_.

**Réglé par #661**, mergée en premier parce qu'elle débloquait **toutes** les
conversations, pas seulement celle-ci. Gate C (build Docker de production
complet) vert = preuve. Détail dans `docs/adr/0041`.

## 2. Les cinq PR rouges — aucune n'avait la cause qu'on lui prêtait

| PR         | Cause réelle                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #648, #657 | Google Fonts, rien d'autre. Réparées par #661.                                                                                                                                                                       |
| #651       | Deux fichiers **parlaient** du garde d'isolation en commentaire. Renommés par leur règle, pas par leur chemin — plutôt qu'allonger une liste d'exceptions qui compte déjà des dizaines d'entrées.                    |
| #655       | Deux défauts empilés : l'exception d'architecture manquait **vraiment**, ET le garde tombait sur sa propre documentation.                                                                                            |
| #653       | `.admin-h` et `.admin-layout-v` n'existent nulle part — troncatures de `.admin-h1` et `.admin-layout-v2`. La page s'affichait sans titre stylisé ni conteneur. Plus un emoji qui faisait monter le cliquet de 1 à 2. |

## 3. Ce que la vague 3 a livré

- **#658** — GEO-118. L'audit annonce « ~480 hubs villes qui ne régénèrent
  jamais ». **Mesuré : il y a 2 157 villes et `generateStaticParams` n'en
  pré-rend que 40.** Les 2 117 autres vont très bien (rendues au runtime, vraie
  base). Le défaut est plus petit _et plus grave_ que décrit : les 40 sont
  Paris, Lyon, Marseille.
- **#664** — GEO-088. **507 fiches au sitemap, 48 liées depuis le hub** :
  459 orphelines, vérifiées en production. Pagination par chemin.
- **#657** + `docs/adr/0042` — GEO-094 : le choix d'architecture est désormais
  **écrit**, pas seulement codé. La moitié de la réponse n'est pas dans le dépôt
  (`/image-bank/*` doit être routé vers le volume).

## 4. ✅ GEO-118 vérifié en production — et la leçon d'un témoin invalide

**Mesuré après déploiement de `788e6ba` :**

| Ville                       | Pré-rendue | Avant | Après |
| --------------------------- | ---------- | ----- | ----- |
| Paris, Lyon                 | oui        | 0     | **1** |
| Marseille, Toulouse, Lille  | oui        | 0     | 0     |
| Rosny-sous-Bois, Mitry-Mory | non        | —     | 1     |
| Chambéry                    | non        | 0     | 0     |

Le bloc de Paris porte deux articles réels. L'étape de chauffe ajoutée par #658
s'est exécutée avec succès : c'est elle qui l'a fait apparaître. **Le correctif
fonctionne, et GEO-118 est exactement ce que l'audit décrivait.**

### 🔑 L'erreur que j'ai commise, et qui vaut d'être retenue

En cours de nuit j'ai conclu — et écrit sur la PR — que « le gain visible est
nul » et que la cause était en amont, dans `Article.mentionedCities`.

**C'était faux.** J'avais pris **Chambéry comme témoin** : rendue au runtime avec
la vraie base, donc hors du mécanisme GEO-118. Son bloc étant vide aussi, j'en
ai déduit que le mécanisme n'était pas la cause.

Le témoin était invalide : **Chambéry n'est mentionnée par aucun article.** Une
ville sans mention n'affiche légitimement aucun bloc.

> **Un témoin négatif ne vaut que si l'on a vérifié qu'il DEVRAIT être positif.**

Le bon témoin était une ville **non pré-rendue ET mentionnée** — Rosny-sous-Bois,
Mitry-Mory. Elles affichent le bloc, n'ayant jamais souffert du défaut, pendant
que Paris et Lyon servaient une version vide figée au build.

### Ce qui reste vrai

La portée est **bornée par le corpus** : seules les villes réellement citées en
bénéficient. Marseille, Toulouse et Lille ont bien été revalidées et restent
sans bloc — aucun article ne les mentionne. Le gain croît avec le contenu
produit, il ne le précède pas.

Contrôle : `curl -s https://axion-ia.com/fr/implantations/ile-de-france/paris | grep -c "Contenus IA à"` → **1**.

## 5. Pièges payés cette nuit — à ne pas repayer

- 🔴 **Une garde qui cherche une chaîne dans un fichier entier trouve sa propre
  documentation.** Payé deux fois de plus : le garde des fontes rougissait sur
  les commentaires qui expliquent pourquoi on a quitté Google ; celui de #655
  rougissait sur le commentaire qui explique le renommage qu'il vérifie.
  **Chercher la clause d'`import`, pas la mention ; les lignes d'exception, pas
  la prose.**
- 🔴 **« Retirer les commentaires » par expression régulière est faux ici** : la
  liste d'exceptions contient des regex qui se terminent par `.*` puis leur
  délimiteur — séquence qui **ferme** un bloc de commentaire. Un découpeur naïf
  avalait toute la liste et le test passait au vert sur un fichier vide. Même
  famille que `*` suivi de `/` dans un commentaire JSX.
- 🔴 **Une garde qui compare des octets est verte en CI et rouge en local**
  (`core.autocrlf`). Pire qu'absente : on apprend à l'ignorer.
- 🔴 **Plafond Cloudflare Free : 30 URLs PAR APPEL de purge.** Au-delà,
  Cloudflare rejette l'appel **entier** — pas une seule URL purgée — et sans
  lire le corps de la réponse, ça ressemble à un succès. C'est pourquoi le
  plancher de pages pré-rendues de `/connaissances` s'arrête à 5, et pourquoi la
  purge des hubs villes est découpée.
- 🔴 **Le job `warm` n'a ni checkout ni Node.** Cinq `curl` sur un runner nu. Y
  appeler un script du dépôt échoue — d'où le fichier versionné lu par `jq`,
  récupéré **au commit déployé** et non sur `main`.
- 🔴 **Une expression `jq` qui ne tourne qu'en production doit être exécutée
  avant d'être commitée.** Celle du découpage l'a été (40 = 30 + 10, préfixes
  vérifiés) — jq a été téléchargé exprès.
- 🔴 **`git stash` est global** : un `stash@{0}` « lint-staged automatic backup »
  d'une autre conversation était présent. Le `stash push` a échoué, tant mieux —
  travail transporté par **patchs**, jamais par la pile de stash.

## 6. Ordre de fusion vérifié à blanc

Les 15 branches fusionnent **sans conflit** dans cet ordre, vérifié localement
avant de toucher `main` (typecheck 0 erreur, isolation-check 0 violation sur
l'état fusionné) :

```
fontes-locales · eeat-sources · telegram-tronque · jsonld-offre · sameas-f6s
email-doc-relais-reel · exif-rgpd-orientation · cache-edge-et-liens-internes
seed-images-declencheur · bing-soumission · gates-mesure · pagination-prerendue
catalogue-ssot · image-bank-chemins · docs/session-geo-aeo
```

⚠️ **#664 (GEO-088) entre en conflit avec #658** — les deux ajoutent des entrées
aux mêmes lignes `PATHS`/`FILES`. Conflit **vérifié**, résolution : garder les
deux ensembles (14 + 4 blog + 4 connaissances = 22, sous le plafond de 30). À
rebaser une fois #658 fusionnée.

⛔ **#650 et #645 n'appartiennent pas à ce lot** — conversation console.
