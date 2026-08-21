# Console éditoriale — lot 0 · état de reprise

_Session du 20 août 2026. Branche `feat/console-editoriale`, base de départ `09f7500fa`._

**Ce fichier existe pour une seule raison : la machine doit redémarrer** (activation de
la « Plateforme d'ordinateur virtuel », code DISM 3010). Il consigne ce qui est acquis,
pour ne rien reprendre à zéro au retour.

---

## 1. Les décisions du §14, tranchées

| #   | Question                                    | Décision                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2   | Le site entre-t-il au calendrier au lot 0 ? | **Non.** Le compte n°11 `site` est créé à l'amorçage, son calendrier reste vide. Le branchement `content-gen` → `EdPublication` se décidera à un lot ultérieur — l'y faire entrer maintenant créerait la seconde source de vérité que le §13 classe en risque 🔴                     |
| 3   | Segment de la route de console              | **`console-editoriale`** → `/[adminPrefix]/console-editoriale/*`. ⚠️ Le plan écrit `editorial` au §3 : **c'est la décision qui fait foi**, pas le plan. `[adminPrefix]` porte déjà `calendrier`, `podcast`, `newsletter`, `content-gen` et `blog` — le segment long lève l'ambiguïté |
| 6   | L'Étoffe est-elle une `EdMarque` ?          | **Oui.** L'amorçage crée deux `EdMarque` : `Axion-IA` et `L'Étoffe`, cette dernière rattachée au compte YouTube n°4                                                                                                                                                                  |

**Restent ouvertes, non bloquantes pour le lot 0** : #1 TikTok perso ou pro _(avant le
lot 5e)_, #4 la liste définitive des piliers _(lot 1)_, #5 l'outil d'envoi de la
newsletter Williams _(avant le 11 octobre)_.

### Une décision hors §14, prise en cours de route

Les sources d'amorçage du §6 — `Linkedin complet.zip`, `02-calendrier-publication.csv`,
`10-LES-61-POSTS.md` — **sont introuvables** : ni dans le dépôt, ni dans Documents,
Downloads, Desktop ou OneDrive. Décision : on avance sur une **fixture fidèle au format
décrit au §6** (CSV `;` UTF-8 BOM, sections `## #N`), et l'import réel sera rejoué dès
que les fichiers seront fournis. Trois des six critères du lot 0 restent donc à
confirmer sur les vraies données.

---

## 2. Ce qui est acquis

### Environnement

| Élément                  | État                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `pnpm install`           | ✅ exit 0                                                                 |
| `npx prisma generate`    | ✅ client v5.22.0 dans `prisma/generated/client`                          |
| `.env`                   | ✅ créé depuis `.env.dev.example` (Postgres 5433, Redis 6381)             |
| WSL 2.7.12               | ✅ installé                                                               |
| `VirtualMachinePlatform` | ⚠️ activée, **DISM 3010 — redémarrage requis**                            |
| Docker Desktop 4.87.0    | ✅ installé, **jamais démarré** (licence à accepter au premier lancement) |

### État de référence de `main`, relevé avant toute modification (protocole, passe 1)

```
pnpm typecheck  →  exit 0, aucune erreur     @ 09f7500fa
pnpm lint       →  exit 0, aucune erreur     @ 09f7500fa
```

Toute erreur apparue ensuite est donc imputable au lot, sans discussion possible.
`pnpm test` et `pnpm build` **n'ont pas encore été relevés** — à faire, une suite à la
fois (jamais deux en parallèle sur la même base, cf. §6 du protocole).

### Code écrit

**`prisma/schema.prisma`** — +756 lignes, **37 modèles et énumérations `Ed*`**, soit
l'intégralité du §2 et du §2 ter. Vérifié : aucun `Ed*` ne préexistait parmi les 227
modèles et 222 énumérations du schéma. `npx prisma format` est passé.

Trois écarts au plan, assumés et à consigner dans le rapport de lot :

1. **Les clés étrangères que le plan laissait « nues » sont déclarées** (`EdSerie.compteId`,
   `EdRecetteLigne.compteId`, `EdRecette.familleSourceId`, `EdObjectif.familleId`,
   `EdAlerteDeclenchee.assetId`/`compteId`, `EdIdee.promueVersId`, `EdGabarit.*Id`,
   `EdPublicationVersion.auteurId`, `EdJournal.membreId`). Un identifiant qui pointe dans
   le vide est un bug silencieux, et le lot 0 est le seul moment où l'ajouter ne coûte
   pas une migration destructrice.
2. `motif_regex` → **`motifRegex @map("motif_regex")`**. Même colonne SQL, nommage aligné
   sur les 227 autres modèles.
3. **`EdMembre.email` en `Citext`**, comme `AdminUser.email` : un `@unique` sur du VarChar
   laisse coexister `Will@x` et `will@x`.

**`AdminUser`** reçoit `edMembre EdMembre?` — relation inverse pure, **aucune colonne
ajoutée** : la clé étrangère vit sur `ed_membres`.

⚠️ `npx prisma format` a par ailleurs réaligné **12 lignes du modèle `SiteRoute`** (champs
`og*`). Bruit cosmétique, aucun changement de sémantique — à restaurer ou à assumer
explicitement dans la PR.

---

## 3. Ce qui reste, dans l'ordre

1. **Redémarrer**, lancer Docker Desktop une fois à la main _(licence)_
2. `pnpm db:up` — Postgres pgvector/pg16 sur 5433, Redis sur 6381, Mailhog sur 8025
3. `npx prisma migrate dev --name console-editoriale-lot-0` **sur base vierge** — critère 1 du §7
4. Relever la baseline manquante : `pnpm test`, puis `pnpm build`
5. Amorçage des référentiels : 2 marques, 11 comptes, piliers, familles, specs de
   plateforme, règles de conformité du §8, règles d'alerte du §9
6. Importeur idempotent et non répétable + sa fixture, avec ses tests : base vierge,
   rejeu, ligne fautive
7. Routes `/[adminPrefix]/console-editoriale` + `/calendrier`, filtre identité perso/pro
8. Les six passes du protocole, puis **mesure du First Load de chaque route touchée**
   (les gates de budget sont en `continue-on-error` : la mesure manuelle est la seule garde)

---

## 4. Pièges rencontrés, à verser au §6 du protocole

| Piège                                                                                  | Parade                                                                           |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Aucun `.env` dans le dépôt** — `prisma validate` échoue sur `DIRECT_URL` introuvable | `cp .env.dev.example .env` avant toute commande Prisma                           |
| **Python absent de la machine**                                                        | Les retouches de fichier passent par l'outil d'édition, pas par un script Python |
| **Un `heredoc` bash volumineux casse** sur ce harnais                                  | Écrire le bloc dans un fichier, puis `cat fichier >> cible`                      |
| **`prisma format` reformate des modèles voisins**                                      | Contrôler `git diff` après chaque `format`, restaurer le bruit                   |

---

## 5. Addendum du 21 août 2026, 00 h 10 — pourquoi le premier redémarrage n'a rien changé

Le redémarrage a bien eu lieu (démarrage à 20/08 23:58). Docker Desktop a été lancé,
sa licence est acceptée (`DisplayedOnboarding: true`, `LicenseTermsVersion: 2`) et la
connexion Docker Hub est passée (`auth0/complete-login` à 00:01). **Rien de tout cela
n'était le problème.**

Le moteur ne démarre pas parce que la VM Linux ne démarre pas :

```
com.docker.backend  →  cannot toggle VM OTel collector, backend is not running
wsl --status        →  « WSL2 ne peut pas démarrer, car la virtualisation
                         n'est pas activée sur cet ordinateur »
```

### La cause réelle

| Constat                                        | Lecture                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `C:\Windows\System32\vmcompute.exe` **absent** | La « Plateforme d'ordinateur virtuel » n'est pas matérialisée               |
| Service `vmcompute` **inexistant**             | Idem — c'est ce composant qui le pose                                       |
| `HvHost` tourne, VBS actif (`status 2`)        | **La virtualisation matérielle est bien active. Le BIOS est hors de cause** |
| `CBS RebootPending = True`                     | L'activation est **en attente**                                             |
| `HiberbootEnabled = 1`                         | **Le démarrage rapide de Windows est actif**                                |

> **Le piège** : avec le démarrage rapide, « Arrêter » puis rallumer produit un démarrage
> **hybride**, qui ne traite pas les opérations de maintenance en attente. Seul un vrai
> **« Redémarrer »** les applique. C'est pourquoi le DISM 3010 n'a pas été honoré.

DISM a été rejoué en élevé le 21/08 à 00:08 → « L'opération a réussi », « État : Activé »,
mais `vmcompute.exe` reste absent : **l'opération attend toujours son redémarrage**.

### La parade, à verser au §6 du protocole

| Piège                                                                    | Parade                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Le démarrage rapide de Windows avale les activations DISM en attente** | Après un DISM 3010, exiger un **`shutdown /r`** — jamais un arrêt suivi d'un rallumage. Vérifier ensuite `Test-Path C:\Windows\System32\vmcompute.exe`, pas seulement l'absence d'erreur |

### Le témoin qui fait foi au retour

Ne pas se fier au message de DISM. Le seul contrôle qui vaut :

```powershell
Test-Path C:\Windows\System32\vmcompute.exe   # doit être True
wsl --status                                  # ne doit plus parler de virtualisation
```

Puis seulement : Docker Desktop, `docker info`, et la reprise au point 2 du §3.

### Gestes effectués avant le second redémarrage (21/08, 00 h 15)

1. `dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart` **en élevé** → « L'opération a réussi », « État : Activé »
2. `HiberbootEnabled` passé à **0** — le démarrage rapide est désactivé, le piège ne se reproduira pas
3. `shutdown /r` — un **vrai** redémarrage, qui traite les opérations en attente

**Au retour, dans cet ordre** : vérifier `Test-Path C:\Windows\System32\vmcompute.exe`
(doit être `True`), puis `wsl --status`, puis lancer Docker Desktop — **sa licence est
déjà acceptée, aucun geste manuel n'est requis cette fois** — puis reprendre au point 2
du §3 : `pnpm db:up`.
