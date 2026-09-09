# Qualiopi — « payer les formateurs », étapes 2 et 3 · 2026-09-09

> Écrit pour être lu **seul**. La conversation qui l'a produit n'est pas nécessaire.
> Worktree : `C:\Users\willi\Documents\Projets\Axion-IA\wt-remise`.

---

## 1. ⛔ CE QUI RESTE À WILL, ET RIEN D'AUTRE N'EST BLOQUANT

| #   | Geste                                                              | Pourquoi lui                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Faire signer le mandat de facturation** aux formateurs concernés | Aucun mandat n'existe à ce jour. Le code REFUSE d'émettre sans lui — comportement voulu, pas un défaut. Sans mandat écrit et **préalable**, la pièce est irrégulière et sa TVA non déductible. |
| 2   | **Arbitrer le lot 2 de l'autofacturation**                         | Action d'émission, transmission, contestation, écran. Volontairement non livré, cf. § 4.                                                                                                       |
| 3   | **Arbitrer la dette des 6 règles inertes**                         | Un cliquet l'empêche de grossir ; la réparer est un chantier à part. `missionFormateur` seul en répare **quatre**.                                                                             |

Les deux PR sont **ouvertes, vertes, non fusionnées**. La fusion n'a pas été
prise : le mandat de file n'avait pas été donné à cette session.

- **#1032** — étape 2, le pilotage. `MERGEABLE/CLEAN`, les quatre gates au vert.
- **#1034** — étape 3, l'autofacturation (lot 1).

---

## 2. Ce qui est livré

### #1032 — l'étape 2, le pilotage

🔴 **Le plan de reprise disait « les données existent, la surface manque ». La
moitié était fausse, et c'est le cœur de la PR.**

`TrainerStatement.echeanceAt` est au schéma depuis le 2026-07-09, **avec son
`@@index`** — et les 27 fichiers du dépôt qui nomment `echeanceAt` parlent tous
de `FactureFormation`. Pas une ligne n'écrivait celle des relevés.

Écrire la règle demandée telle quelle — un `where` sur `echeanceAt` antérieure à
maintenant — aurait produit une alerte **verte, muette et vide pour toujours** :
aucune comparaison SQL n'est vraie pour `NULL`. C'est mot pour mot le défaut déjà
payé sur les factures clients (`facture_sans_echeance`).

Trois réparations, et **aucune n'est la condition des autres** :

1. l'échéance est POSÉE au seul point d'entrée qui existe (le passage en
   `facture_recue`, qui exige déjà `dateFacture`) ;
2. la LECTURE ne dépend jamais de la colonne : `echeanceEffective` retombe sur
   `dateFacture + 30 j`. L'alerte et l'écran voient juste sur tout le stock,
   **sans qu'aucun correctif n'ait à être déployé d'abord** ;
3. `pnpm backfill:echeance-honoraires` remet la colonne en accord avec le calcul.

Plus : la règle `releve_formateur_echu` — **première du moteur à surveiller
l'argent qu'on DOIT**, les sept autres règles de facturation surveillant toutes
des créances clients — l'écran « Ce qu'on doit — toutes périodes » (l'écran de
rémunération ne savait regarder qu'un mois : un relevé de juillet impayé
disparaissait dès qu'on affichait août), et l'échéance + le retard sur la fiche
du relevé.

Et un **cliquet** sur les 6 règles que le mock d'`evaluateur.spec.ts` rend
inertes en silence (§ 3.2).

### #1034 — l'étape 3, l'autofacturation (lot 1)

Tout ce qui **décide** et tout ce qui **se rend**. Rien n'émet encore.

🔴 **Une autofacture n'est pas « une facture de plus qu'on émet ».** C'est la
facture DU SOUS-TRAITANT, établie en son nom et pour son compte. Le vendeur est
le formateur, l'acheteur est l'organisme — l'inverse de toutes les autres pièces
du dépôt. Réutiliser le gabarit de facture aurait imprimé notre SIRET là où la loi
attend le sien : une pièce impeccable à l'œil et irrégulière en droit.

- schéma + migration : mandat (signé / révoqué), identité fiscale du
  sous-traitant, fenêtre de contestation. Colonnes **nullables** et valeur
  d'énumération ajoutées **avant** tout code qui les lit — le worker tourne du
  code plus récent que l'app pendant ~50 min, et c'est l'app qui migre ;
- `autofacturation.ts` (pur) : mandat en vigueur, éligibilité à **sept** motifs
  de refus rendus **tous à la fois** (un opérateur qui les découvre un par un
  n'apprend jamais combien il en reste), fenêtre de 8 jours ;
- `autofacture-pieces.ts` (pur) : l'inversion, et `genererXmlCII` **réutilisé tel
  quel** — il prend déjà vendeur et acheteur en paramètres ;
- le gabarit PDF, avec les quatre mentions et les pénalités de retard imprimées
  **bien qu'elles nous visent** : les omettre parce qu'elles nous sont
  défavorables aurait été un choix intéressé, et aurait rendu la pièce non
  conforme à l'art. L.441-9 ;
- série de numérotation propre `AXI-AUTOF` — intercaler des pièces d'ACHAT dans
  `AXI-FACT` ferait mentir la continuité que la série des ventes doit garantir.

🔑 **Le mandat est une DATE, pas un booléen.** « Préalable » se vérifie contre la
date de la PIÈCE : un mandat signé le 15 ne régularise pas une facture du 10, la
signature postérieure ne rétroagit pas. Et la révocation est une **seconde** date
plutôt qu'un effacement — sans effet rétroactif sur les factures déjà émises.

---

## 3. ⚠️ TROIS AVERTISSEMENTS QUI SURVIVENT À CETTE SESSION

### 3.1 L'ordre « TVA toujours facturée » NE S'APPLIQUE PAS à l'autofacture

Et l'y étendre par symétrie serait un **défaut**, pas une prudence. La question a
été posée en cours de session par une autre session, de bonne foi.

L'ordre vise les **ventes** de l'organisme, et son verrou vit au point de création
de NOS pièces (`regimeTvaDepuisConfig`) — vérifié : ni `computeTotauxFacture`, ni
`mentionTva`, ni `tauxTvaLigne` ne l'appliquent.

Le régime porté sur une autofacture est celui du **sous-traitant**, figé sur le
relevé à sa validation. Un formateur en franchise 293 B n'a pas de TVA à
collecter : lui en faire réclamer 20 % sur une facture écrite **en son nom** lui
ferait porter une taxe dont il n'est pas redevable, et nous ferait déduire une TVA
qui n'existe pas. **Le régime d'un tiers n'est pas un réglage de l'organisme.**

### 3.2 `evaluateur.spec.ts` ABSOUT six règles au lieu de les mesurer

Le prisma mocké y est déclaré **deux fois** — la fabrique de `vi.mock` et un cast
tenu à la main — et aucune des deux ne porte tous les modèles que les règles
lisent. Une règle dont le modèle manque LÈVE ; le fail-soft PAR RÈGLE l'avale ; la
suite reste verte pendant que stderr répète « erreur règle … ».

Six règles concernées : `formateur_desactive_encore_affecte`, les quatre
`formateur_mission_*`, `stagiaires_non_prevenus_changement_formateur`.

Le cliquet posé dans #1032 empêche la dette de **grossir** et de se **périmer** :
il rougit si une septième règle devient inerte, ET si l'une est réparée sans que
la liste bouge. Un cliquet qui ne rougirait que dans un sens laisserait la liste
se périmer, et une liste périmée absout exactement ce qu'elle prétend surveiller.

Il ne répare rien — compléter le mock ferait s'exécuter six règles sur 178 tests
qui ne les attendent pas.

### 3.3 Ne pas transposer au contrat APPORTEUR

Un « retard » avant encaissement n'existe pas pour une commission acquise à
l'encaissement : c'est un **droit non encore né**, pas une **dette échue**. La
symétrie avec le formateur est trompeuse, et elle est fausse dans les deux sens —
côté formateur, « payé quand le client a payé » est illicite (art. L.441-10,
plafonds d'ordre public, clause réputée non écrite, jusqu'à 2 M€).

---

## 4. Pourquoi le lot 2 s'arrête là, et ce qu'il contient

Restent : l'action d'émission (numérotation, génération, transition), la
**transmission** au formateur, l'action de contestation et le blocage du paiement
qu'elle entraîne, l'écran.

Le lot s'arrête avant parce qu'**une émission sans transmission serait un
demi-mécanisme** : la clause donne 8 jours pour contester, un formateur qui n'a
rien reçu ne conteste pas, et la contrepartie promise par le mandat serait vidée
de son sens. Livrer l'émission seule aurait donné un bouton utilisable et une
pièce juridiquement bancale.

Coût estimé : un gabarit d'e-mail (5 fichiers touchés — le composant,
`templates/index`, `apercu/catalogue`, et deux entrées dans `outbox-policy`),
l'action d'émission, deux actions de statut, et l'écran.

---

## 5. 🔑 Les deux leçons de méthode, payées le même jour

**1. `pnpm typecheck` lancé en TÂCHE DE FOND, puis j'ai continué à éditer.**
`tsc` lit l'arbre au démarrage : il a rendu 0 sur une version antérieure de mon
propre travail. Le défaut réel n'a jamais été regardé. → **Ne pas éditer pendant
une mesure. Geler l'arbre, ou relancer après le dernier `git add`.**

**2. Suite de tests choisie « au jugé ».** Gate A lance la suite entière ; elle
est injouable ici (OOM observé deux fois). J'ai lancé trois répertoires qui me
semblaient couvrir. Une garde d'un quatrième exigeait un jalon de remise pour
toute nouvelle valeur de `DocumentType`. → **Dériver le périmètre :
`git grep -l <NomDeLEnum>` restreint aux fichiers de spec, puis lancer exactement
ceux-là.** Appliqué après coup : 7 fichiers concernés, un seul rouge — celui que
j'avais raté.

🔑 Corollaire réutilisable : **`tsc` couvre les `Record<Enum, …>` exhaustifs,
JAMAIS les tables gardées par un test.** Les deux populations se ressemblent à la
lecture ; seule la seconde exige de lancer les specs.

---

## 6. Commandes utiles

```bash
cd /c/Users/willi/Documents/Projets/Axion-IA/wt-remise

# Après TOUT changement de branche (prisma/generated est LOCAL à la branche) :
SKIP_ENV_VALIDATION=true DATABASE_URL="postgresql://stub:stub@stub.invalid:5432/stub" pnpm prisma:generate

# Gate A n'est PAS couverte par typecheck/eslint/format. Les 9 gardes, EN SÉRIE
# (et jamais en même temps que la suite tests/unit/ci, qui pose des pages
# piégées dans l'arbre pour prouver que les gardes rougissent) :
for c in anti-hex anti-siren admin-gardes positionnement radius use-client zod contrast i18n; do
  echo "── $c"; pnpm "$c:check" || break
done

# Rattraper les échéances d'honoraires du stock (simulation par défaut) :
pnpm backfill:echeance-honoraires
pnpm backfill:echeance-honoraires --apply
```

⚠️ `pnpm test` (suite complète) tue la machine — OOM observé deux fois. Cibler.
