# ADR 0042 — Banque d'images : où les fichiers vivent, et comment ils sont servis

- **Statut** : accepté
- **Date** : 2026-08-16
- **Contexte** : audit GEO/AEO du 2026-08-14, GEO-094 (lot 18)

## Pourquoi cet ADR existe

Le correctif GEO-094 a rétabli une chaîne cassée en trois endroits. Le
raisonnement était écrit **dans le message de commit** et une mise en garde
**dans les `.env*.example`**. Ni l'un ni l'autre n'est l'endroit où l'on
regarde quand on se demande, six mois plus tard, « comment les images
téléversées sont-elles servies en production ? ».

Surtout : **la moitié de la réponse n'est pas dans le dépôt.** Le code produit
des URLs cohérentes ; il ne crée pas le service de fichiers qui les honore. Une
décision dont l'exécution est hors dépôt et qui n'est écrite nulle part de
durable est une décision qu'on redécouvre par une panne.

## Le contrat, en une phrase

**Un identifiant unique nomme à la fois la ligne en base et le dossier sur
disque, et l'URL publique est toujours `/image-bank/<id>/<fichier>`.**

```
POSTGRES          Image.id  = <uuid>
DISQUE            <IMAGE_BANK_STORAGE_PATH>/<uuid>/image-lg.webp
URL PUBLIQUE      <IMAGE_BANK_CDN_URL>/image-bank/<uuid>/image-lg.webp
                  (préfixe vide = même origine → /image-bank/<uuid>/…)
```

Les trois lignes se déduisent l'une de l'autre. C'est ce qui rend le système
vérifiable : n'importe lequel des trois côtés suffit à retrouver les deux
autres.

## Les trois décisions

### 1. Une seule fonction résout la racine du stockage

`getStorageBasePath()` est le seul endroit qui lit `IMAGE_BANK_STORAGE_PATH`.

La panne d'origine : l'import écrivait sous `/var/data/image-bank`, la route de
téléchargement lisait sous `/data/image-bank` — elle avait **recopié** la
résolution au lieu d'appeler la fonction. Comme la variable n'était déclarée
nulle part, les deux valeurs par défaut divergentes s'appliquaient vraiment. On
lisait dans un dossier où rien n'avait jamais été écrit.

Une garde d'architecture (`tests/unit/seo/image-bank-chemins-ssot.spec.ts`)
interdit qu'une seconde expression lise cette variable. C'est une garde de
**structure**, pas de comportement : la fonction était juste, c'est la
duplication qui était fausse — un test de comportement n'aurait rien vu.

Corollaire tiré en écrivant la garde : `?? "/var/data/image-bank"` laissait
passer une variable **définie mais vide** (cas courant quand on crée la clé sans
valeur dans un panneau de configuration), et la racine devenait la chaîne vide.
Lu par `?.trim() ||` désormais.

### 2. Le dossier porte l'identifiant de la ligne, imposé à la création

`upload.action.ts` force `id: imported.uuid` au lieu de laisser Prisma en
générer un. Le dossier existe déjà quand la ligne est créée ; c'est donc le
dossier qui donne son nom à la ligne, jamais l'inverse.

L'alternative — renommer le dossier après coup pour le faire correspondre à
l'`id` généré — ouvre une fenêtre de course pendant laquelle la fiche pointe un
dossier inexistant. Imposer l'identifiant supprime la fenêtre au lieu de la
rétrécir.

### 3. L'URL publique est la même dans les deux environnements

`publicUrlFromLocalPath()` rend `/image-bank/<uuid>/<fichier>`, en
développement comme en production.

Auparavant elle retirait un préfixe `public/` et ajoutait un `/`. En production
le stockage est un volume qui **n'est pas** sous `public/` : le chemin
ressortait entier avec un slash de plus, `//var/data/image-bank/…`. Un `//` de
tête n'est pas un chemin, c'est une **URL protocole-relative** : le navigateur
la résout en `https://var/data/…`, un hôte qui n'existe pas.

C'est la forme que tous les consommateurs publics reconstruisaient déjà —
galerie, carrousel presse, page de détail, console. La fonction s'aligne sur
eux ; ce sont eux qui avaient raison.

## ⚠️ Ce que le dépôt ne peut pas faire tout seul

**`/image-bank/*` doit être routé vers le volume de stockage.** Par Caddy en
amont, ou par un CDN désigné via `IMAGE_BANK_CDN_URL`.

Sans ce routage, tout ce qui précède reste vrai et **les images restent en 404**.
Le correctif rend la chaîne cohérente ; il ne crée pas le service de fichiers.

C'est la seule partie de cet ADR qui ne se vérifie pas en CI. Le contrôle se
fait sur la production, après déploiement :

```
curl -sI https://axion-ia.com/image-bank/<uuid>/image-lg.webp
```

`200` avec un `content-type: image/webp` → le routage existe. `404` → il
manque, et aucune ligne de code ne le remplacera.

## Ce qui reste volontairement en place

Le contournement posé à la main dans `resolveAdminThumbSrc` le 2026-08-02
décrivait correctement le symptôme (3) sans en corriger la cause. Il devient
inoffensif une fois la cause traitée, et il est laissé tel quel : le retirer
dans la même PR mêlerait deux raisonnements. À nettoyer quand la production
aura confirmé que la cause est bien morte.
