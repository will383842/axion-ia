# Audit Qualiopi « du point de vue du certificateur », par l'UI — 2026-09-02/03

Mandat de Will : parcourir tout le système Qualiopi **par l'interface**, comme le fera
l'auditrice le jour de l'audit initial ; croiser les vérifications ; corriger tout ce qui
est trouvé ; puis fusionner, déployer et nettoyer.

---

## 1. L'instrument, et pourquoi il change tout

| | |
|---|---|
| Pile | Postgres 5434 (`axion_ia_dev`), Redis 6381, MailHog 8025 — 215 migrations appliquées |
| Jeu de données | **fixture volumétrique** : 1 202 sessions (423 réalisées), 3 003 stagiaires, 6 003 inscriptions (3 563 sur session tenue), 63 formations, 101 formateurs, 7 019 pièces (4 579 admissibles) |
| Parcours | Playwright (balayage des 56 routes Qualiopi, captures, axe-core) + Chrome réel pour la lecture d'écran |
| Croisement | moteur interrogé **directement** (`evaluerConformite`, `genererManifesteAudit`, `genererDossierAuditZip`) pour confronter ce que l'écran AFFICHE à ce que le moteur CALCULE |

🔑 **La base de production est vierge ; la fixture ne l'est pas.** Neuf des onze défauts
ci-dessous sont INVISIBLES sur une base vide : ils ne se manifestent qu'à partir du moment
où l'organisme a une histoire. C'est-à-dire exactement le jour de l'audit.

---

## 2. Ce que le certificateur voyait, et ce qu'il voit maintenant

### 2.1 🔴 Cinq indicateurs déclaraient « Couvert » sur un VOLUME

La règle « couverture, jamais volumétrie » est écrite **trois fois** dans
`conformite-service.ts`, avec sa justification — *« c'est ce que vérifie un auditeur qui
tire un dossier au hasard »*. Elle avait été appliquée à off.4, off.5, off.8, off.19 et
off.27. Elle avait été **oubliée sur ses jumeaux**.

| Ind. | Statut affiché | Ce que l'auditeur mesure réellement |
|---|---|---|
| **6 ⭐** | Couvert | 23/63 formations actives (37 %) |
| **9** | Couvert | 254/423 sessions réalisées (60 %) |
| **10 ⭐** | Couvert | 1 adaptation sur 3 563 inscriptions |
| **11 ⭐** | Couvert | **1/423** sessions réalisées (0 %) |
| **12** | Couvert | 2 émargements sur 3 563 inscriptions |
| **21 ⭐** | à compléter | 1 formateur sur 101 suffisait à le couvrir |

Trois sont des **super-indicateurs** : une NC majeure suspend la délivrance. Et le
manifeste imprimait déjà sa propre contradiction — « 423 sessions réalisées » sur une
ligne, « 2 inscriptions avec présence constatée » sur la suivante, « OK » en tête.

**Corrigé.** Chaque règle est exprimée en couverture, avec le dénominateur affiché et le
manque nommé (« 169 sessions réalisées SANS aucune pièce d'accueil »).
`off.10` fait exception à bon droit : le RNQ ne demande pas d'adapter pour tout le monde,
donc le taux « 1 sur 3 563 » ne prouve rien contre l'organisme. Ce qui manquait là, c'est
la seule question que l'auditrice pose : *« des personnes vous ont déclaré un besoin —
montrez ce que vous avez adapté pour elles »*. La condition a été **ajoutée**, jamais
retirée.

Chaque règle porte son **test négatif**, et les tests ont été **vus rougir** contre
l'ancienne règle avant d'être conservés.

⚠️ **Conséquence assumée : le score annoncé BAISSE (57 % → 39 %).** C'est le comportement
correct, et le fichier le disait déjà : *« le score doit mesurer le dossier d'audit réel,
pas l'état du pipeline logiciel »*. Un indicateur vert à tort est pire qu'un rouge : il
retire à l'organisme la seule chance de corriger avant la venue.

### 2.2 🔴 La revue de direction ne comptait pas — indicateur 32 ⭐

`RevueDirection.statut` est une colonne `VarChar(20)` **libre**. Le seed de démonstration
écrivait `"valide"` ; toute l'application lit `"validee"`.

- L'écran affichait « Total revues 1 · **Validées 0** » au-dessus d'une ligne dont la
  colonne STATUT disait « valide ». **L'écran d'audit se contredisait lui-même.**
- L'indicateur 32 ⭐ restait rouge, motif « Aucune revue de direction VALIDÉE pour 2026 »,
  alors que la revue existait avec ses 3 participants, 3 décisions, 3 actions et son
  instantané d'indicateurs.
- **Un test verrouillait la faute** : `expect(data.revueDirection.statut).toBe("valide")`.
- Le **repli silencieux** l'a rendue invisible : l'écran écrivait `LIBELLES[s] ?? s`, donc
  la valeur brute passait pour un statut légitime.

**Corrigé à la source** : liste des statuts dans un module PUR (elle vivait dans un module
`"use server"`, donc inatteignable pour un seed), champ du seed **typé** `StatutRevue` — un
littéral fautif ne compile plus —, repli qui SIGNALE l'inconnu, et balayage refusant tout
statut hors liste dans un `prisma.revueDirection.*`. **Vérifié : off.32 passe à « couvert ».**

**Contre-vérification** : `revues_direction` est la **seule** table Qualiopi dont le statut
soit une chaîne libre (toutes les autres sont des enums Prisma, protégées par le type). Le
défaut est clos, pas rustiné.

### 2.3 🔴 L'écran de l'auditrice nommait ses pièces par leur valeur d'énumération

La vue manifeste affichait, en toutes lettres :

```
« programme » : 578 pièces      « emargement » : 501 pièces
« convention » : 519 pièces     « grille_evaluation » : 133 pièces
```

La table de libellés de CET écran était un `Record<string, string>` écrit à la main :
**six de ses treize entrées ne correspondaient à aucune valeur réelle** de l'énumération
(`convention_formation`, `programme_formation`, `feuille_emargement`…), et **sept des huit
types réellement présentés n'avaient pas de libellé**. Le Markdown remis en séance portait
la même faute.

**Corrigé** : vocabulaire unique et **exhaustif par type** (`Record<DocumentType, string>`)
— oublier un type ne compile plus. `nom-fichier.ts` en DÉRIVE au lieu d'en garder une copie.

### 2.4 🔴 Dix indicateurs applicables sur vingt-trois n'offraient rien à cliquer

Veille, réseau handicap, sous-traitance, réclamations, revue de direction, moyens,
appréciations, compétences des intervenants : leur preuve est un **registre**, pas un PDF.
Sur ces dix-là, l'écran rendait un verdict et ne proposait **littéralement rien** à
inspecter. L'auditrice devait le croire sur parole, ou refermer l'écran et chercher dans
cent cinquante entrées de navigation.

**Corrigé** : bloc « **Où vérifier dans la console** » sous chaque indicateur, dérivé du
registre des indicateurs et **vérifié exhaustif** (les 32 portent une décision explicite,
y compris « nulle part, et voici pourquoi »). Une garde interdit désormais qu'un indicateur
du tronc commun se retrouve sans pièce NI registre. **Les 21 liens vérifiés un par un : tous en 200.**

### 2.5 🔴 Trois écrans annonçaient un indicateur qui n'est pas le leur

Dans leur sous-titre — la première ligne que lit l'auditrice après le titre :

- **Partenariats** : « off.25 — indicateur 25 ». Le 25 est la veille sur les innovations
  pédagogiques. Le réseau handicap, c'est le **26**, et le 26 est un SUPER-indicateur. Le
  fichier le savait : un commentaire cent lignes plus bas écrit « off.26 est un
  super-indicateur ».
- **Formateurs** : « vérification data.gouv.fr (off.6/19) ». Le 6 porte sur les contenus,
  le 19 sur les ressources. La vigilance data.gouv, c'est le **27**.

Un numéro faux dans un sous-titre ne se voit pas : il se lit, il est cru, et il oriente une
recherche de preuve. **Garde ajoutée** : tout sous-titre qui annonce un indicateur doit
figurer sous cet indicateur dans le registre. Elle a **rougi sur les trois cas** avant
d'être satisfaite.

### 2.6 🔴 Le manifeste affirmait « CV téléversé » — une formulation établie fausse

L'audit blanc du 2026-08-15 avait établi que c'est **faux** (quand l'outil génère la fiche
formateur, c'est LUI qui pose `cvUrl`) et l'avait corrigé dans le moteur. Le **manifeste**,
lui, n'avait pas suivi : il réaffirmait « CV téléversé » deux lignes SOUS le libellé
corrigé, dans le même bloc. S'y ajoutaient une liste **sans plafond** (101 lignes
d'annuaire possibles au milieu du manifeste) et une double puce « - - Sophie Durand ».

### 2.7 🔴 Microsoft Clarity pouvait enregistrer la console

La bannière de consentement s'affichait **sur la console**, y compris sur l'écran
« Conformité & mode auditeur ». Le layout admin masquait trois éléments du shell public sur
quatre ; le quatrième était la bannière.

Conséquence : un « Accepter » cliqué depuis la console armait le **rejeu de session** sur
des écrans portant des noms de stagiaires, leurs adresses, le drapeau « situation de
handicap » (**donnée de santé, art. 9**), les factures et le registre entier — avec
transfert hors UE. Le consentement recueilli porte sur la mesure d'audience d'un site
vitrine ; il ne couvre rien de tout cela.

**Corrigé** : Clarity refuse la console, et la bannière y est masquée par la même feuille
de style que l'en-tête et le pied de page publics.

🔑 **Leçon de méthode payée en direct** : le premier correctif était un garde côté
composant (`if (estSurfaceConsole()) return null`). **Il ne marchait pas**, et le
navigateur disait pourquoi — *« A tree hydrated but some attributes of the server rendered
HTML didn't match the client properties. **This won't be patched up.** »* Depuis le
correctif de CLS, la bannière est rendue au SERVEUR, et React 19 ne supprime pas une
branche que le serveur a écrite. **Un garde qui ne s'exécute qu'au client ne peut pas
dé-rendre ce que le serveur a déjà rendu.** Le garde inopérant a été mesuré, puis retiré.

### 2.8 🔴 Deux registres se rendaient en entier

| Écran | Avant | Après |
|---|---|---|
| Alertes (1 589 lignes) | 531 Ko de texte, ~50 s, 1 589 composants clients | 41 Ko, ~5 s, plafond dit + filtre par niveau |
| Stagiaires (3 003 lignes) | 338 Ko, ~69 s, **aucun champ de recherche** | 12 Ko, ~4,5 s, plafond dit + recherche serveur |

L'écran stagiaires est celui où l'auditrice dit « montrez-moi le dossier de madame X » :
sans recherche, il n'y avait pas de réponse à cette demande, seulement un `Ctrl+F` sur une
page de trois mille lignes qui met plus d'une minute à s'ouvrir.

Les compteurs des tuiles viennent désormais de **compteurs**, jamais de la page affichée —
sinon « Situation de handicap : 3 » deviendrait le décompte de ce qu'on regarde.

### 2.9 🔴 Un clic sur une pièce pouvait rendre du JSON brut

Depuis la vue manifeste, chaque numéro de pièce est un lien ouvert dans un onglet. Quand le
PDF n'est pas restituable, l'auditrice recevait `{"error":"pdf_unavailable"}`. La réponse
dit désormais, en français, ce qui manque et où le vérifier — et reste du JSON pour un
appelant qui demande du JSON.

### 2.10 Le dossier ZIP

- Quand R2 n'est pas configuré, la boucle demandait quand même les 4 579 pièces une par
  une et écrivait **4 579 lignes `[OMIS]` identiques** dans `index.txt` — un index
  illisible ne dit pas ce qui manque, il le noie. `isR2Configured()` était pourtant évalué
  quatorze lignes plus haut. **Index : 4 590 → 22 lignes.**
- Quand R2 EST configuré, le `await` dans la boucle sérialisait 4 579 allers-retours
  réseau. C'est le bouton que le certificateur demande le jour de sa venue. Récupération
  **par lots de 16**, mémoire bornée par le lot.

### 2.11 Mise en page de l'écran de l'auditrice

`AdminPageHeader` met ses actions en `sm:shrink-0` : les deux gros boutons d'export ne
rétrécissaient jamais, donc c'est le titre et la description qui s'écrasaient. Mesuré à
1 145 px de fenêtre : **colonne de description à 299 px, phrase sur cinq lignes**, moitié
droite de l'écran vide. Et le bloc d'export ne rend pas que deux boutons : il rend AUSSI le
verdict qui **énumère les preuves manquantes** du dossier remis — cette liste n'a rien à
faire dans une gouttière d'en-tête. Les exports sont sortis de l'en-tête (656 px / 2 lignes
après).

---

## 3. Ce qui a été vérifié et qui TIENT

- **Accessibilité** : axe-core (WCAG 2.1 AA) sur les **17 écrans** Qualiopi, dont les deux
  vues du mode auditeur, les deux registres de signatures, et les huit registres
  réglementaires → **aucune violation**.
- **Les 56 routes Qualiopi** répondent en 200, sans frontière d'erreur ni accès refusé.
- **Le registre des 32 indicateurs RNQ V9** : liste graduable, super-indicateurs,
  conditionnels cert/app/afest — cohérents, testés, dérivés.
- **Le prédicat d'admissibilité au dossier** (pièce annulée, session annulée ou reportée)
  est appelé partout, jamais recopié.
- **Le catalogue d'alertes** cite les bons numéros d'indicateurs (1, 8, 11, 26, 30, 32).
- **Aucune impasse** : les neuf indicateurs sans pièce NI registre sont exactement les neuf
  conditionnels non applicables au périmètre (3, 7, 13, 14, 15, 16, 20, 28, 29).

---

## 3 bis. Le balayage final, après correctifs

Les **55 routes** de la console Qualiopi rejouées une à une, dans un navigateur
authentifié : **toutes en 200**, aucune frontière d'erreur, aucun accès refusé, et
**plus aucune bannière de consentement**. Les deux seules lignes marquées sont
`/qualiopi/entrees` et `/qualiopi/conformite` — deux redirections voulues, que
l'instrument ne sait pas lire en vol (elles répondent bien 200 et mènent où il faut).

🔑 **Piège d'instrument payé au passage** : une redirection encore EN VOL interrompt la
navigation suivante de Playwright, et l'erreur se propage **en cascade**. Le premier
balayage a rendu trente-trois routes vertes puis vingt-deux « status 0 » qui ne disaient
rien de l'application — seulement que la mesure s'était cassée. Une mesure qui s'effondre
en cascade ressemble à un produit qui s'effondre : il faut la faire atterrir avant de
repartir.

| Écran | Avant | Après |
|---|---|---|
| `qualiopi/alertes` | 531 Ko | **41 Ko** |
| `qualiopi/stagiaires` | 338 Ko | **12 Ko** |
| `mode-auditeur` (description) | 299 px de large, 5 lignes | **656 px, 2 lignes** |
| `index.txt` du dossier ZIP | 4 590 lignes | **22 lignes** |
| Couverture documentaire annoncée | 57 % (13/23) | **43 % (10/23)** — et vraie |

Suite complète : **26 241 tests verts**. (Un unique rouge, sur un témoin de garde MCP,
était un artefact de MA concurrence — deux `vitest` lancés en parallèle sur le même
fichier témoin ; le test repasse seul.)

---

## 3 ter. Ce que la CI a trouvé et que je n'avais pas vu

Gate B a rougi sur trois tests. **Les trois venaient de moi**, et le dernier est le plus
instructif.

### a. `target-size` (WCAG 2.2 AA) — mon instrument était plus faible que la gate

Les liens « Où vérifier dans la console » mesuraient **228 px par 15 px**, avec 21,2 px
d'espace libre : sous le minimum de 24 × 24 px. J'avais pourtant passé axe en local et
conclu « aucune violation » — **sur `wcag2a, wcag2aa, wcag21a, wcag21aa`**. `target-size`
est une règle **WCAG 2.2**, que je n'avais pas demandée ; le test CI, lui, s'appelle
« WCAG 2.2 AA ».

🔑 **Une mesure qui n'interroge pas la même norme que la garde ne dit rien de la garde.**
Refait avec les tags exacts de `a11y-admin.spec.ts` : 0 violation, sur les deux vues.

### b. Un libellé qui recopiait un lien déjà présent en haut de la page

Mon renvoi de l'indicateur 12 s'appelait « Registre des signatures d'émargement — la preuve
de présence, chaîne par chaîne », **mot pour mot** le lien d'en-tête. Deux liens de même nom
accessible : le parcours 07 a rougi, et il avait raison **avant** d'être un problème de
test — deux libellés identiques qui mènent au même endroit font douter d'avoir déjà cliqué.
Garde ajoutée, qui lit les libellés d'en-tête **dans le source de la page**.

### c. 🔑 Masquer un bandeau ne pose AUCUNE décision

Le parcours 6 — le stagiaire sur un téléphone de 360 px — échouait sur un clic intercepté
par le bandeau de consentement, **sur le portail**, une page que je n'avais pas touchée.

La chaîne, mesurée et non supposée :

1. le harnais refuse les cookies **une fois**, au login admin, et c'est le CONTEXTE de
   navigateur qui porte ensuite cette décision ;
2. mon correctif masque le bandeau **sur la console** — donc le helper ne trouve plus rien
   à refuser, et repart **sans rien inscrire** ;
3. le portail, lui, affiche légitimement le bandeau, ancré en bas — exactement là où le
   portail ancre sa barre d'onglets à 360 px ;
4. le clic de navigation était intercepté soixante secondes durant, sur un test qui ne
   parle pas de cookies.

Mesuré en local, sans rien supposer : après login console, bandeau **absent** et décision
**`null`** ; puis, sur une page publique du **même contexte**, bandeau **présent**. Le
helper inscrit désormais le refus explicitement — vérifié : bandeau absent ensuite.

⚠️ **Fait produit à connaître, et qui n'est pas un défaut** : un administrateur qui
travaille dans la console puis ouvre le site public verra le bandeau. C'est correct — la
console ne demande rien parce qu'elle ne charge aucun script tiers ; le site public, lui,
demande. Le refus n'est simplement plus « pris d'avance » depuis la console.

---

## 4. Ce qui RESTE, et qui n'est pas du code

🔴 **CETTE SECTION A ÉTÉ ÉCRITE FAUSSE, ET CORRIGÉE LE 2026-09-03.** Elle listait cinq
points ; **deux étaient périmés**. Je les avais repris de notes de mémoire — dont l'une du
2026-08-24 — sans les confronter à la PRODUCTION, alors que la doctrine de ce dépôt le dit
en toutes lettres : *toute affirmation d'un `.md` est une hypothèse à réfuter*, et elle vaut
aussi pour les livrables qu'on a écrits soi-même. Les deux constats retirés sont conservés
ci-dessous, barrés, parce qu'effacer une erreur sans la nommer empêche d'apprendre d'elle.

### 4.1 ⛔ Le certificat Qualiopi — quatre champs vides, et ils le resteront

Mesuré en production le 2026-09-03, sur `/qualiopi/config` :

| Champ | Valeur |
|---|---|
| Numéro du certificat Qualiopi | **vide** |
| Organisme certificateur (COFRAC) | **vide** |
| Date d'obtention du certificat Qualiopi | **vide** |
| Date de fin de validité du certificat Qualiopi | **vide** |
| Catégories d'actions certifiées | « Actions de formation » |

⚠️ **Ces quatre champs ne PEUVENT pas être remplis aujourd'hui** : la certification n'est
pas obtenue, l'audit initial est à venir. L'action n'est donc pas « saisir », elle est
« saisir le jour où le certificat est délivré » — les quatre valeurs se lisent sur le
certificat, et nulle part ailleurs.

🔴 En revanche, « Catégories d'actions certifiées » porte **déjà** une valeur, alors que le
défaut du registre a été délibérément vidé le 2026-08-20 pour qu'aucune mention légale ne
soit affirmée sans source. Quelqu'un l'a donc saisie. Elle alimente la mention publique de
la marque Qualiopi. **À confronter au certificat le jour de sa délivrance** — c'est la seule
vérification qui la rendra vraie. (Non touchée : ordre permanent de Will du 2026-08-23, le
périmètre de travail est le système interne.)

### 4.2 ⛔ La conservation de 5 ans n'est appliquée par aucune purge

`suppressionPrevueAt` est écrite à trois endroits et lue par **aucune** purge, alors qu'elle
est imprimée sur chaque pièce signée et dans le règlement intérieur. Chiffrage prêt :
`pnpm qualiopi:retention-dry-run`.

⚠️ Ce purgeur n'a **délibérément pas** été construit : écrire du code qui supprime
automatiquement des pièces légales n'est pas un geste à poser sans arbitrage.

### 4.3 ⛔ Sept indicateurs n'attendent qu'une vraie session

Relevés en production le 2026-09-03, ce sont exactement les sept « à compléter » :

**4** analyse du besoin · **8** positionnement à l'entrée · **9** information sur les
conditions de déroulement · **10 ⭐** adaptation · **11 ⭐** évaluation de l'atteinte des
objectifs · **12** assiduité · **30** appréciations des parties prenantes.

Tous portent le même motif : « 0 sur 0 », « aucune inscription sur une session démarrée ».
La base de production ne contient **aucune session réalisée**. Ni code ni saisie ne les
ferme : il faut une session conduite **dans l'ordre**, du positionnement à l'évaluation.

---

### Deux constats RETIRÉS, parce que faux

~~**Le règlement intérieur publié est amputé** — il énoncerait l'exclusion définitive sans
échelle des sanctions ni droits de la défense.~~
🔴 **FAUX au 2026-09-03.** Mesuré sur `https://axion-ia.com/fr/reglement-interieur` : la
page publie « **Article 3 bis — Échelle des sanctions** » et « **Article 3 ter — Procédure
disciplinaire et droits de la défense** », et cite **R.6352-3, -4, -6, -7 et -8**. Le
constat du 2026-08-24 a été traité depuis ; je l'ai recopié sans le revérifier.

~~**Une formation porte un code RS/RNCP** alors que les indicateurs 3, 7 ⭐ et 16 ⭐ sont
déclarés non applicables.~~
🔴 **FAUX EN PRODUCTION.** Cette contradiction existe sur la **fixture volumétrique de
développement**, pas en ligne : l'avertissement correspondant n'apparaît pas sur l'écran de
production, aucune formation n'y porte de code RS/RNCP. Le mécanisme qui NOMME la
contradiction reste utile — il servira le jour où un tel code sera saisi — mais il n'y a
aujourd'hui **rien à arbitrer**.

🔑 **La leçon, et elle est coûteuse** : j'ai audité la production par l'UI, et j'ai malgré
tout rempli ma section « reste à faire » depuis des notes, sans rouvrir les pages. Un audit
qui mesure l'écran et recopie sa conclusion n'a mesuré que la moitié du chemin.

## 5. Ce que cet audit N'A PAS fait, et pourquoi

- **Rien n'a été touché dans le public.** Ordre permanent de Will du 2026-08-23 : le
  périmètre de travail est le système interne. Les constats publics sont au §4, non corrigés.
- **Aucune donnée n'a été fabriquée.** Les indicateurs qui attendent une vraie formation
  restent ouverts ; les faire passer au vert par de la saisie serait exactement la
  complaisance que le durcissement du 2026-08-15 a supprimée.
- **La pagination générale de la console n'a pas été refaite.** Deux registres ont été
  bornés parce qu'ils sont sur le chemin du certificateur ; les autres listes non plafonnées
  (clients, dossiers, cockpit financier) relèvent du cahier D8, qui reste ouvert.
