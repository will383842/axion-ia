# Espace apporteur : page « Mes commissions » — plan de conception

> **Écrit le** 2026-11-25 sur `origin/main` à `3151c61a`. **Corrigé le** 2026-11-25 sur `origin/main` à `ef5cc10d`, après la relecture « À CORRIGER » de la PR #2259. **Corrigé une seconde fois le** 2026-11-25 sur `origin/main` à `8c6ca06f`, après la deuxième relecture « PLAN À CORRIGER » (réalisée sur `54dd1eab`, qui avait déjà absorbé #2253 et #2258).
> **Aucun code produit** : ce document est un plan.
> **Rôle tenu** : concepteur et auditeur argent, données, sécurité.
> **Lu pour l'écrire** : `src/features/apporteurs-reseau/` (`commissions.ts`, `commandes.ts`, `facturation.ts`, `autofacture-donnees.ts`, `regles.ts`, `envois.ts`, `presentations.ts`, `declaration-entreprise.ts`, `declaration-regles.ts`, `prestation-presentation.ts`, `passage-quotidien.ts`, `notification-attribution.ts`, `retrait.ts`, `litige.ts`, `realisation.ts`, `manquement.ts`, `resiliation.ts`, `ajustement.ts`, `avoir-client.ts`, `solde-negatif.ts`, `requetes-console.ts`, `jeton.ts`, `donnees.ts`, `signature-regles.ts`, `grille-reference.ts`, l'annexe 1 de `contrat-v2.ts`), `src/app/apporteur/dossier/`, la console `apporteurs/commissions`, `prisma/schema.prisma`, `src/lib/r2-storage.ts`, `src/content/pricing.ts`, `next.config.ts`, `package.json` (cliquets de poids), `.github/workflows/coolify-drapeau.yml`.
> **Ce qui n'a pas été vérifié** est listé au §8, sans exception.

---

## Coordination avec le plan des challenges (PR #2261)

**Ce plan fait foi, seul, pour tout l'écran « Mes commissions ».** La partie 1 du plan
`docs/plans/apporteurs-challenges-et-ecran-commissions-2026-11-25.md` (PR #2261) est remplacée par
celui-ci ; ce plan-là ne garde que les challenges et renvoie ici pour l'écran, par « les lots EC du
plan #2259 ».

Ce qui a été repris de #2261, après vérification dans le code : l'interrupteur de la page, l'écran
console « Voir ce que l'apporteur voit », les règles d'accessibilité, l'interdiction de lire toute
coordonnée d'une entreprise présentée, l'état « lecture impossible » qui n'affiche jamais « 0 € »,
le renommage du lien vers la grille, des phrases d'attente plus claires, le test de bout en bout avec
contrôle axe. Le détail est au commentaire « PLAN CORRIGÉ » de la PR.

Ce qui a été **refusé** de #2261, parce que cela contredit les règles du dirigeant ou la sécurité :

- les quatre cartes de totaux en tête de page (un total se lit comme un compteur) ;
- la frise de 7 points avec « Pas encore » (elle fonctionne comme une jauge de progression) ;
- les états d'avant paiement (devis envoyé, facture envoyée) recalculés par la règle d'attribution :
  la calculer oblige à lire les présentations des autres apporteurs pour le même SIREN (fuite) ;
- le prix facturé au client affiché près du nom de l'entreprise ;
- la section « Primes » et l'encart « challenge ».

**Aucun encart, compteur ni section « challenge » n'apparaît sur cette page.** Le challenge reste un
sujet à part, sans compteur personnel. Une prime de challenge **validée** devient une ligne de
commission ordinaire (`commissions_apporteur`) : elle s'affiche ici comme toute autre ligne, dans le
groupe « Hors entreprise », avec son libellé, son état et sa facture. Rien d'autre.

**Points de coordination ajoutés à la deuxième relecture :**

- **Une seule décision pour la même question.** Q2 ici (SIREN ou établissement) et D-1 du plan #2261
  posent la même question au dirigeant : **la décision est Q2, ici**, et D-1 y renvoie. Une seule
  réponse, un seul avenant.
- **`Referrer-Policy` : `same-origin`** (valeur de `next.config.ts` sur `/apporteur/dossier/`). Le plan #2261
  annonçait `no-referrer` « comme #2259 » : il s'aligne sur `same-origin`.
- **Le `page.tsx` de l'espace** (`src/app/apporteur/dossier/[id]/[jeton]/page.tsx`) est touché par
  **EC-5** (lien « Mes commissions », renommage du lien « Grille des commissions », l. ~153) et par le lot 8 de #2261
  (lien vers le règlement). **EC-5 passe en premier ; le lot 8 de #2261 suit EC-5.** Les deux PR ne se
  modifient jamais ensemble.
- **Convention des interrupteurs : un fichier par interrupteur**, comme `interrupteur-rendez-vous.ts`
  sur `main`, plus la déclaration dans `src/env.ts` (convention suivie par #2258 pour
  `APPORTEURS_VALIDATION_RDV`). Il n'y a pas de fichier `interrupteurs.ts` commun : le plan ne le crée plus
  (voir §6).
- **La prime de #2261** entre comme ligne « Hors entreprise » (§3.5), avec le libellé lu en base.

---

## 0. L'essentiel en une page

### Ce que la page fera

Dans son espace (lien personnel, sans mot de passe), l'apporteur ouvre « Mes commissions » et lit,
**entreprise par entreprise** : l'état de sa présentation, si une commande est signée, si le client
a payé, le montant de sa commission, quand elle est versée, et s'il y a une reprise. En bas de page,
il retélécharge ses autofactures et ses avoirs.

La page **ne calcule rien**. Elle lit les montants déjà arrêtés en base
(`commissions_apporteur.montant_cents`) et les états, par une fonction pure partagée avec la console.

C'est un **état de compte** : des faits datés. Pas de total en tête, pas de compteur, pas de jauge,
pas de compte à rebours, pas de relance.

### Règles de rémunération du dirigeant, et ce que le code fait aujourd'hui

| Règle du dirigeant                                                                                                                                                                                                                                                    | Code sur `origin/main`                                                                                                                                                                                                                                                                                                       | Effet sur cette page                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Journée IA (1 490 € HT) : 500 € au prorata du prix payé ; reprise si remboursée en argent                                                                                                                                                                             | **Pas de règle propre** : `JOURNEE_IA_TIER` n'a pas de `commissionId` (`src/content/pricing.ts:471`) et aucun palier `journee-ia` n'existe (`regles.ts`). La facture suit `FactureFormation.activite`, saisie à la main : `audit` → 30 % (447 €), `formation` ou vide → « à qualifier » (`passage-quotidien.ts:762-765`) | La page affiche le montant stocké, ou « à préciser » ; l'alignement sur 500 € est le lot argent du plan #2261 |
| 15 % sur mise en service et ventes en une fois, **calculés une fois à la signature du devis**, sur le net après déduction éventuelle des 1 490 € (déduction seulement si le devis atteint 5 000 € HT avant déduction ; pas de complément si la déduction est reprise) | 15 % du HT **facturé et soldé** sur l'activité `implementation` (`TAUX_BPS`, `regles.ts:320`), calculé **au paiement intégral** (`etapeCommissions`) ; aucune déduction de Journée IA                                                                                                                                        | La page affiche le montant stocké ; elle ne recalcule rien                                                    |
| Audits seuls : 30 %                                                                                                                                                                                                                                                   | 30 % sur `audit` (`TAUX_BPS`)                                                                                                                                                                                                                                                                                                | Conforme                                                                                                      |
| Jamais sur abonnements, maintenance, hébergement, licences                                                                                                                                                                                                            | Annexe A1.5 : rien sur `site_web` ; pas d'activité pour les abonnements ; formation au forfait par palier, conférence 500 €, accompagnement individuel 30 %                                                                                                                                                                  | La page affiche ce qui existe                                                                                 |
| Versée quand le client a payé à 100 % ; reprise si impayé ou remboursement                                                                                                                                                                                            | Conforme : ligne créée seulement quand la commande est soldée (`commandesSoldees`, `commandes.ts:60-100`) ; reprise par avoir (`avoir-client.ts`, `resiliation.ts`)                                                                                                                                                          | Aucun montant avant le paiement intégral                                                                      |
| Autofacture                                                                                                                                                                                                                                                           | En place (`facturation.ts`, série `AXI-APP`)                                                                                                                                                                                                                                                                                 | Les PDF sont retéléchargeables                                                                                |
| Aucune prime ni contrat sans SIREN actif                                                                                                                                                                                                                              | Le registre est relu avant chaque autofacture (`facturation.ts:636-642`)                                                                                                                                                                                                                                                     | Une ligne bloquée l'affiche (« en attente d'une information »)                                                |
| TVA toujours selon le régime de l'apporteur                                                                                                                                                                                                                           | `regimeTva` (`schema.prisma:16396`) : `assujetti` (20 %) ou `franchise_293b` ; régime absent = autofacture bloquée (`autofacture-donnees.ts:389`)                                                                                                                                                                                                    | Mentions de TVA au §4.3                                                                                       |

**L'alignement du code sur ces règles n'est pas l'objet de ce plan.** C'est un chantier argent à
part (contrat, `regles.ts`, `parite-contrat-code.spec.ts`, avenant). La page n'en dépend pas : elle
montre ce qui est déjà sur les autofactures envoyées à l'apporteur. Décision Q1.

### Une entreprise, un seul apporteur commissionné ; le parrainage n'en est pas un second

Le parrainage (10 % des commissions du filleul sur les commandes signées dans les 6 mois après la
signature de son contrat, un seul niveau, payé par Axion IA **en plus**) **n'est pas une seconde
commission sur l'entreprise** : il ne retire rien à l'apporteur de l'entreprise, il ne se calcule pas
sur la vente mais sur la commission du filleul, et son bénéficiaire n'a aucun droit sur le client.

Comment la base le distingue (vérifié dans `prisma/schema.prisma`, modèle `CommissionApporteur`, et
`passage-quotidien.ts:775-837`) :

| Colonne           | Commission de l'apporteur de l'entreprise   | Part du parrain                                                                                       |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `parrainage`      | `false`                                     | `true`                                                                                                |
| `apporteur_id`    | l'apporteur qui a présenté l'entreprise     | le parrain                                                                                            |
| `presentation_id` | sa présentation                             | **la présentation du filleul** (pas la sienne)                                                        |
| `facture_id`      | la facture clé de la commande               | la même                                                                                               |
| `montant_cents`   | calculé sur la vente (`calculerCommission`) | 10 % de la commission du filleul (`partParrainage`, `regles.ts:408`)                              |
| Fenêtre           | protection de la présentation               | 6 mois après `signeParSocieteAt` du filleul (`dansFenetreParrainage`, `passage-quotidien.ts:213-218`) |

L'unicité `@@unique([factureId, apporteurId, parrainage])` interdit deux lignes identiques. **Elle
n'interdit pas** deux lignes `parrainage = false` de deux apporteurs différents sur la même facture :
aujourd'hui, la règle « un seul apporteur par entreprise » tient par la logique d'attribution
(`presentationPourEtablissement`), pas par la base. Et cette logique attribue **par établissement**
(contrat 2.6, `attributaireDeLaCommande`) : deux SIRET d'un même SIREN peuvent revenir à deux
apporteurs. Décision Q2 (SIREN ou établissement) et lot EC-9 (verrou en base).

### Constats d'audit qui changent la conception

| N°      | Constat (vérifié)                                                                                                                                                                                                                                                                                       | Conséquence                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1**  | La grille du code n'est pas celle du dirigeant (tableau ci-dessus).                                                                                                                                                                                                                                     | La page affiche ce qui est stocké. L'écart est tranché à part (Q1). Il ne bloque pas la page.                                                                    |
| **C2**  | La part de parrainage porte la présentation du **filleul** (`passage-quotidien.ts:775-821`, `...base` avec `presentationId: p.id`).                                                                                                                                                                     | Une ligne `parrainage = true` n'est jamais rattachée à une entreprise. Parrainage **regroupé par autofacture** (§3.4).                                           |
| **C3**  | `/apporteur/dossier/<id>/<jeton>/commissions` existe déjà : c'est la grille.                                                                                                                                                                                                                            | La page s'appelle `/mes-commissions`. Le lien vers la grille devient « Grille des commissions ».                                                                 |
| **C4**  | Avant le paiement intégral, aucune ligne n'existe. La seule trace d'une commande signée est l'e-mail `apporteur-commande-signee`, dont la clé `jobId` porte l'identifiant du devis (`passage-quotidien.ts:909`, `notification-attribution.ts:146-148`).                                                 | « Commande signée » se lit au journal des e-mails de **ses** présentations, puis `jobId` → devis (§1.4). Jamais de montant.                                      |
| **C5**  | La console n'a pas de fonction d'état, et elle affiche **plusieurs badges à la fois** (`apporteurs/commissions/page.tsx`, l. ~292-451 : facturée, en attente de fiche, réalisée, suspendue).                                                                                                            | Une fonction pure **à facettes** (§1.3), plus un état principal pour l'apporteur. Brancher la console dessus est un lot facultatif.                              |
| **C6**  | Une contestation peut suspendre `a_qualifier`, `due` et `en_attente_vigilance` (`SUSPENDABLES`, `litige.ts:75`).                                                                                                                                                                                        | La contestation se teste **en premier** parmi les états non versés.                                                                                              |
| **C7**  | `prestation_realisee_at` a été ajoutée sans reprise des données (`20261007220000_apporteurs_prestation_realisee`). Une ligne facturée avant peut l'avoir vide.                                                                                                                                          | Un `autofactureNumero` posé l'emporte sur « prestation pas encore réalisée ».                                                                                    |
| **C8**  | Une retenue (`manquement.ts:110-137`) crée une ligne `statut = reprise`, `activite = "neutralisation"`, montant négatif, déjà soldée, sans `presentationId`, `palier = "reprise-de:<id de la retenue>"`. Les reprises ordinaires portent `palier = "reprise-de:<uuid>"` (`resiliation.ts:145`, `:222`). | La neutralisation est rattachée à sa retenue et n'apparaît pas en double. Le palier d'une reprise n'est jamais affiché. Montants des reprises en valeur absolue. |
| **C9**  | `totalTtcPieceCents` traite un régime inconnu comme « sans TVA » (`autofacture-donnees.ts:157-170`), et `lireVirementsAFaire` recalcule avec le régime **actuel** de l'apporteur, pas celui de l'émission (`facturation.ts:1043`).                                                                      | Régime inconnu affiché « en vérification », jamais « sans TVA ». Lot EC-8 (figer le régime à l'émission), décision Q8.                                           |
| **C10** | La route du contrat refuse le mode restreint et applique `etatDeLaPage` (`contrat/route.ts:52-56`) ; elle **sert les octets**, sans redirection.                                                                                                                                                        | La route des PDF fait de même : statut `signe` seulement (mode restreint selon Q4), octets servis, aucune URL signée exposée.                                    |

---

## 1. D'où vient chaque chiffre

### 1.1 Règle de conception

**Aucun appel à `calculerCommission`, `commandesSoldees`, `netDeLaCommande`,
`presentationPourEtablissement` ni `attributaireDeLaCommande` depuis l'espace apporteur.** Ces
fonctions décident ; elles tournent dans le passage quotidien et la console. La page lit leur
résultat écrit en base. Verrouillé par une garde statique (T7).

### 1.2 Table des sources

| Ce que l'apporteur lit                   | Source                                                                                                                                                                                                                    | Partagé avec la console par                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Nom de l'entreprise                      | `presentations_entreprise.denomination` (ce qu'il a lui-même déclaré)                                                                                                                                                     | même colonne                                        |
| État de la présentation                  | `etatPourApporteur(p, maintenant, reservation?)` (`declaration-regles.ts:133`, depuis #2253 et #2258) et `LIBELLE_ETAT_DECLARATION` (`declaration-regles.ts:113-160`) : « À l'étude », « En attente d'une réponse — nous revenons vers vous », « Réservée » (jusqu'au …), « Non disponible », « Expirée » | fonction et libellés existants, inchangés (sauf Q3) |
| « Validée le » / « Validée d'office le » | `confirmee_at` et `confirmation_tacite` (`schema.prisma:16664`, à ajouter à `DeclarationVue`)                                                                                                                                                    | mêmes colonnes que la fiche console                 |
| « Commande signée le »                   | `EmailLog` (`template = "apporteur-commande-signee"`, `entityType = "PresentationEntreprise"`, `entityId` ∈ ses présentations, `sentAt` non nul, statut ≠ `failed`), puis `jobId` → devis → `Devis.acceptedAt` (§1.4)     | sans objet                                          |
| « Payée par le client le »               | date de paiement **la plus récente** parmi les factures non annulées de la commande (pas seulement `factureCleId`)                                                                                                        | extraite de `lireCommissions` (lot EC-4)            |
| Prestation réalisée le                   | `prestation_realisee_at`                                                                                                                                                                                                  | même colonne                                        |
| Nature de la prestation                  | libellé **en clair** de l'activité ou du palier (table de libellés, jamais l'identifiant)                                                                                                                                 | nouvelle table, partagée                            |
| Montant de la commission (hors taxes)    | `montant_cents`, tel quel ; valeur absolue pour une reprise                                                                                                                                                               | même colonne                                        |
| État de la commission                    | **`facettesCommission()` puis `etatPrincipal()`** (§1.3)                                                                                                                                                                  | la console peut lire les facettes (lot EC-3)        |
| Facture : numéro, date                   | `autofacture_numero`, `autofacture_emise_at` (repli `maj_at`, même repli que `lireCommissions.emissionAt`)                                                                                                                | même repli, extrait                                 |
| Échéance de paiement                     | `echeancePaiement(emission)` (`autofacture-donnees.ts:316`), la date imprimée sur le PDF                                                                                                                                  | même fonction                                       |
| HT, TVA, TTC d'une autofacture           | `totalTtcPieceCents(regimeTva, …)`, la fonction du PDF ; régime inconnu → « en vérification » (§4.3)                                                                                                                      | même fonction                                       |
| Virement à venir (TTC si assujetti)      | `aVirerPartielCents()` par autofacture, via `lireVirementsAFaire({ apporteurId })`                                                                                                                                        | même fonction, paramètre ajouté (EC-4)              |
| « Versée le »                            | `versee_at`                                                                                                                                                                                                               | même colonne                                        |
| Reprise, avoir                           | ligne `statut = reprise`, `avoir_numero`, origine par `originesDesReprises()` **filtrée par apporteur**                                                                                                                   | fonction existante, filtre ajouté                   |

### 1.2 bis Réservation par rendez-vous (#2253, #2258) : comment la page la lit

`main` porte désormais `etatPourApporteur(p, maintenant, reservation?)` et la table
`PresentationReservation` (`schema.prisma:16474`), indexée par `presentationId` et **sans colonne
`apporteurId`**. L'interrupteur est `APPORTEURS_VALIDATION_RDV`. Règles de la page :

1. **Lecture par `presentationId` de ses propres présentations seulement** : un seul `in` sur les
   identifiants déjà lus à la requête 5 (liste filtrée par `apporteurId`). La provenance de chaque
   `presentationId` est donc prouvée par la requête 5, pas par un filtre sur la table (exception
   documentée au §2.2, règle 1).
2. **Même état que `ListeDeclarations.tsx`** : la page appelle la même fonction avec les mêmes
   arguments, jamais une règle réécrite. Test : pour un jeu de présentations et de réservations,
   le libellé de la page égale celui de `ListeDeclarations`.
3. **Sans date de réservation** (interrupteur éteint, réservation absente ou sans échéance) : le
   libellé « Réservée » s'affiche **sans date** (« Réservée »), jamais « jusqu'au <invalide> » ni un
   nombre de jours. Une date n'est écrite que si elle est portée par la réservation ou la présentation.
4. Table absente (ancien schéma) : lecture ignorée, état calculé sans réservation.

### 1.3 La fonction d'état, à facettes (lot EC-2)

Nouveau module pur `src/features/apporteurs-reseau/etat-commission.ts`, sans import serveur (la
console, la page et le worker peuvent le lire).

```
facettesCommission(ligne) → {
  statut,               // les 7 statuts de StatutCommissionApporteur
  suspendue: boolean,   // litigeDepuis posé, sur a_qualifier | due | en_attente_vigilance
  realisee: boolean,    // prestationRealiseeAt posé
  facturee: boolean,    // autofactureNumero posé
  attenteFiche: null | "solde_negatif" | "donnee_manquante",
  neutralisation: boolean, // statut reprise ET activite = "neutralisation"
  reprise: null | "a_deduire" | "deduite",
}
etatPrincipal(facettes) → un seul état, pour l'apporteur
```

**Ordre de l'état principal (corrigé)** :

| N°  | État principal           | Condition                                                                 | Pourquoi à ce rang                                                                   |
| --- | ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | (masquée)                | `neutralisation`                                                          | Rattachée à sa retenue (palier `reprise-de:<id>`), jamais une ligne à part           |
| 2   | `annulee`                | `statut = annulee`                                                        | État final                                                                           |
| 3   | `retenue`                | `statut = retenue`                                                        | État final ; affiche l'avoir de sa neutralisation                                    |
| 4   | `reprise_a_deduire`      | `statut = reprise`, `releveMois` nul                                      |                                                                                      |
| 5   | `reprise_deduite`        | `statut = reprise`, `releveMois` posé                                     |                                                                                      |
| 6   | `sans_commission`        | `statut = versee`, `montantCents = 0`                                     |                                                                                      |
| 7   | `versee`                 | `statut = versee`                                                         | Libellé neutre « Réglée le … » (voir ci-dessous)                                     |
| 8   | `suspendue`              | `litigeDepuis` posé (quel que soit le statut suspendable)                 | C6 : avant tout autre état non versé                                                 |
| 9   | `facturee`               | `statut = due`, `autofactureNumero` posé                                  | C7 : avant le test de réalisation                                                    |
| 10  | `a_preciser`             | `statut = a_qualifier` (sous-cas `hors_grille`)                           | Le montant n'est pas connu                                                           |
| 11  | `en_attente_realisation` | `prestationRealiseeAt` nul                                                | I2 : rien n'est facturé ni versé avant (`realisation.ts:1-16`, `facturation.ts:229`) |
| 12  | `en_attente_pieces`      | `statut = en_attente_vigilance`                                           |                                                                                      |
| 13  | `en_attente_fiche`       | `statut = due`, `autofactureAttenteMotif` posé. Le sous-cas `solde_negatif` se reconnaît à `PREFIXE_MOTIF_SOLDE_NEGATIF` (`facturation.ts:554`) ; sinon `<ce qui manque>` est un **libellé** de la table des motifs, jamais le motif brut | |
| 14  | `due`                    | `statut = due`, réalisée, pas encore facturée                             | Le passage horaire s'en charge                                                       |

Le cas « compensée » (versée par déduction d'une reprise) n'est **pas** distingué par l'égalité
`verseeAt === autofactureEmiseAt`, jugée fragile : `versee` s'affiche « Réglée le … », qui est vrai
dans les deux cas.

⚠️ **Avant de figer l'ordre 9 / 11**, compter en production (lecture seule, par la console ou
`admin-emergency`) les lignes `statut = due`, `autofacture_numero` non nul, `prestation_realisee_at`
nul. Le chiffre est noté dans la PR du lot EC-2. **Qui le fait : le dirigeant, ou toute session disposant
du SSH production**, avant l'ouverture de la PR EC-2 (les développeurs n'ont pas cet accès). Tant que le
chiffre n'est pas noté, EC-2 reste en brouillon, et le rang 9 / 11 reste celui du tableau (un
`autofactureNumero` posé l'emporte).

### 1.4 « Commande signée » : du journal des e-mails au devis

1. Lire `EmailLog` filtré par `entityId` ∈ **ses** présentations (index `EmailLog(entityType, entityId)`).
2. Analyser `jobId` : `apporteur-commande-signee-<devisId>-<apporteurId>` ou
   `apporteur-commande-signee-facture-<factureId>-<apporteurId>`. **Le suffixe `<apporteurId>` doit
   égaler `dossier.id`**, sinon la ligne est ignorée.
3. Lire le devis (`id`, `acceptedAt`, `statut`) et ses factures (`statut`, `paidAt`), un seul `in`.
   Aucun autre champ (ni montant, ni client, ni lignes).
4. Affichage :
   - devis accepté, factures non toutes payées : « Commande signée le <acceptedAt> · En attente du
     paiement du client » ;
   - devis refusé, expiré, ou toutes ses factures annulées : « Commande annulée » (plus jamais
     « en attente » pour toujours) ;
   - `jobId` illisible ou devis introuvable : une seule mention « Commande signée », **sans date**.
5. Dès qu'une ligne de commission existe pour la même commande, elle remplace la mention.
6. **Commande soldée sans commission** (devis accepté, toutes les factures payées, activité qui ne
   donne rien : `calc.statut === "aucune"`, `passage-quotidien.ts:765`) : aucune ligne n'est créée, et
   la mention « En attente du paiement du client » serait fausse pour toujours. Règle : **si toutes les
   factures non annulées du devis sont payées et qu'aucune ligne de commission n'existe pour la
   commande, la mention de commande est retirée** (la ligne de présentation reste). Ce n'est pas un
   état « commission nulle » : on n'affiche rien, car l'apporteur n'a aucun droit sur cette commande.
7. **De `factureId` aux « factures de la commande »** : aujourd'hui `lireCommissions` ne lit que la
   facture clé (`commissions.ts:512-541`). EC-4 lit, par un seul `in` sur `devisId`, toutes les
   factures non annulées du devis (statut et `paidAt` seulement) ; la date « Payée par le client le » est la plus
   récente. Une ligne dont le devis est introuvable n'affiche que la date de la facture clé.

Ce chemin ne lit que des faits déjà envoyés à l'apporteur, par la clé de **son** e-mail. Il ne lit
jamais les présentations d'un autre.

### 1.5 Ce qu'on entend par « relevé »

Depuis la décision du 06/10 (`facturation.ts`, en-tête), il n'y a plus de relevé mensuel : dès
qu'une commission est due, une autofacture part. Les « relevés » à télécharger sont **les
autofactures et leurs avoirs**. La page elle-même tient lieu de relevé.

---

## 2. Cloisonnement, tests IDOR, téléchargement des PDF

### 2.1 Modèle de menace

| Menace                                                                       | Parade                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lien d'un autre apporteur deviné                                             | Jeton HMAC-SHA256 sur `id:versionLien`, comparé à temps constant (`jeton.ts`). Page et route passent par `lireDossierParLien`.                                                       |
| **Numéro d'autofacture d'un autre** (série `AXI-APP-AAAA-NNNN` séquentielle) | La route exige `apporteurId = dossier.id` **dans le `where`**. La limite de débit n'est qu'un frein.                                                                                 |
| Clé R2 construite depuis l'adresse                                           | Clé reconstruite côté serveur depuis `dossier.id` et le numéro **relu en base**.                                                                                                     |
| Fuite par le parrainage                                                      | Projection à liste blanche ; parrainage regroupé par autofacture ; T5, T5 bis.                                                                                                       |
| Fuite par une colonne de trop                                                | Type `CommissionPourApporteur` à champs énumérés ; jamais `...ligne`. T6.                                                                                                            |
| Fuite par l'attribution                                                      | Aucun appel aux fonctions d'attribution (§1.1) ; « commande signée » par le `jobId` de son propre e-mail.                                                                            |
| Lien personnel transféré                                                     | Le risque augmente (la page montre de l'argent). §2.5, Q6.                                                                                                                           |
| Cache partagé                                                                | `Cache-Control: private, no-store` posé explicitement par la route ; `noindex` ; à vérifier pour la page (§8).                                                                       |
| Fuite du lien par `Referer`                                                  | La route reste sous `/apporteur/dossier/` (`Referrer-Policy: same-origin`, `next.config.ts`). Les octets sont servis : aucune redirection vers une URL signée portant l'identifiant. |

### 2.2 Lecture cloisonnée (lot EC-4)

Nouveau module serveur `src/features/apporteurs-reseau/espace-commissions.ts` (`server-only` permis :
ni le worker ni `commissions.ts` ne l'importent) et module pur `espace-commissions-assemblage.ts`.

```
lireEspaceCommissions(dossier: { id, regimeTva }, maintenant) → EspaceCommissionsVue
```

Règles, toutes testées :

1. **Chaque requête Prisma porte `apporteurId: dossier.id` dans son `where`**, y compris celle de
   `originesDesReprises` (`commissions.ts:662-680`, qui ne filtre pas aujourd'hui : paramètre
   `apporteurId` ajouté). Les **seules exceptions**, chacune avec sa preuve de provenance, sont :
   - **(a)** les devis et factures lus par identifiant au §1.4 : la liste sort d'un e-mail filtré par ses
     présentations **et** dont le `jobId` porte son identifiant (T13) ;
   - **(b)** les factures « de la commande » (requête 7, §1.4 point 7), lues par `devisId` issu de (a)
     ou de la facture clé d'une de **ses** lignes de commission (elle-même filtrée par `apporteurId`) ;
   - **(c)** `PresentationReservation` (§1.2 bis), lue par `presentationId` ∈ les présentations de la
     requête 5, filtrée par `apporteurId`.
   Aucune autre. Chacune est listée dans T8 avec sa preuve : le test échoue si une requête hors de ces
   trois porte sans filtre apporteur, ou si une exception est lue avec un identifiant qui ne vient pas
   de sa source prouvée.
2. Le nom d'une entreprise n'est gardé que si `!ligne.parrainage && presentation.apporteurId === dossier.id`.
3. Champs **interdits** dans la vue : `factureId`, `factureNumero`, `factureHtCents`,
   `prixPublicHtCents`, `palier` brut, `litigeMotif`, `prestationRealiseePar`, toute coordonnée
   (`personneEmail`, `personneTelephone`, `personneNom`), `note`, `iban`, tout champ d'un autre
   apporteur, toute donnée de `CommandeAAttribuer`. La requête existante `lireDeclarationsDe` ne lit
   aucune coordonnée (`declaration-entreprise.ts:64-76`) : règle conservée et verrouillée.
4. `dossier.id` vient de `lireDossierParLien` ; la fonction ne prend pas d'identifiant venu de l'adresse.
5. Base factice (`stub.invalid`) : aucune requête (contrat ADR 0026).

### 2.3 Tests de cloisonnement, écrits d'abord (rouges)

| N°     | Test                                                                                                                                                                                                                                                                                                                                 | Niveau           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| T1     | Jeton de A, identifiant de B → 404 neutre, page et route                                                                                                                                                                                                                                                                             | unité            |
| T2     | **IDOR** : lien valide de A, numéro d'autofacture de B → 404 ; ni `existsInR2` ni `getObjectBufferR2` appelées                                                                                                                                                                                                                       | unité, route     |
| T3     | Même réponse (statut, corps, en-têtes) pour « numéro d'un autre » et « numéro inexistant »                                                                                                                                                                                                                                           | unité, route     |
| T4     | Numéro mal formé (`../`, encodé, minuscules, **plus de 40 caractères**) → 404 sans requête                                                                                                                                                                                                                                           | unité, route     |
| T5     | Parrain : sa page ne contient ni le nom de l'entreprise du filleul, ni le nom du filleul, ni l'activité, ni le palier                                                                                                                                                                                                                | unité            |
| T5 ter | Parrainage non facturé ou prime : aucune ligne d'attente ; prime sans « Payée par le client le » ni « Prestation réalisée le » | unité            |
| T5 bis | Parrainage regroupé : deux parts sur une même autofacture donnent **une** ligne, un montant, aucune date de commande                                                                                                                                                                                                                 | unité            |
| T6     | Le HTML rendu ne contient aucun champ interdit (valeurs sentinelles dans chacun)                                                                                                                                                                                                                                                     | unité, rendu     |
| T7     | Garde statique : aucun fichier sous `src/app/apporteur/dossier/[id]/[jeton]/` n'importe `@/lib/prisma`, `lireCommissions`, `lireFicheApporteur`, `calculerCommission`, `commandesSoldees`, `presentationPourEtablissement`, `attributaireDeLaCommande`, ni `lireVirementsAFaire` sans filtre. Les `*.spec.*` sont exclus de la garde | `tests/unit/ci/` |
| T8     | Chaque appel Prisma de `lireEspaceCommissions` porte le filtre apporteur (client simulé qui enregistre les `where`), sauf les trois exceptions (a), (b), (c) du §2.2, dont l'identifiant doit venir de la source prouvée                                                                                                                                                                             | unité            |
| T9     | **Deux apporteurs sur une vraie base** : commissions, parrainage croisé, reprises, neutralisation, avoirs, même SIREN présenté par les deux. La vue de A ne contient aucun identifiant, numéro ni nom de B                                                                                                                           | intégration      |
| T10    | `versionLien` incrémentée → 404 page et route                                                                                                                                                                                                                                                                                        | unité            |
| T11    | La clé R2 lue commence par `apporteurs/autofactures/<id de A>/`                                                                                                                                                                                                                                                                      | unité, route     |
| T12    | Base factice → 404 sans requête                                                                                                                                                                                                                                                                                                      | unité            |
| T13    | `jobId` dont le suffixe n'est pas `dossier.id` → ignoré                                                                                                                                                                                                                                                                              | unité            |
| T14    | Interrupteur éteint → page et route 404, lien absent de l'accueil                                                                                                                                                                                                                                                                    | unité            |

### 2.4 Téléchargement des PDF (lot EC-1)

Stockage existant : `apporteurs/autofactures/<apporteurId>/<numero>.pdf` (autofactures et avoirs).

```
GET /apporteur/dossier/<id>/<jeton>/factures/<numero>
  0. interrupteur APPORTEUR_MES_COMMISSIONS_ENABLED, sinon 404
  1. limite de débit par `checkRateLimit` (`@/lib/rate-limit`), clé `apporteur-dossier:facture:<ip hachée par `hashIp`>`,
     20 par quart d'heure, `surPanne: "laisser-passer"`. **Écart assumé avec la route du contrat**
     (`apporteur-dossier:pdf:${ip}`, IP en clair, `contrat/route.ts:43-46`) : on suit la forme **hachée**, qui
     ne laisse pas d'IP en clair dans Redis ; le contrat sera aligné dans un lot à part s'il le faut
  2. numero ≤ 40 caractères et conforme à /^AXI-APP-\d{4}-\d{4,}$/, sinon 404 sans requête
  3. dossier = lireDossierParLien(id, jeton), sinon 404
  4. etatDeLaPage(dossier.statut) = "signe" ; mode restreint refusé (sauf Q4 = oui) ;
     résilié selon Q7. Sinon 404
  5. ligne = findFirst({ apporteurId: dossier.id, OR: [{ autofactureNumero }, { avoirNumero }] }), sinon 404
  6. octets = getObjectBufferR2(clé) ; absent OU exception → 404 neutre (+ signalerErreurReseau)
  7. 200 application/pdf, Content-Disposition selon ?dl=1, Cache-Control: private, no-store,
     X-Robots-Tag noindex, Referrer-Policy same-origin
```

On **sert les octets**, comme la route du contrat et la console : pas d'URL signée de 15 minutes
qui porterait l'identifiant du dossier dans la clé, pas de lien qui expire pendant que l'onglet est
ouvert, et le contrôle d'appartenance est refait au clic.

### 2.5 Le lien personnel devient un accès à de l'argent

Le lien n'expire pas et figure au bas de chaque e-mail. Demain, celui qui le détient verra les
commissions et téléchargera des factures portant nom, adresse, SIRET et numéro de TVA (l'IBAN n'est
pas imprimé sur l'autofacture). Parades en place : jeton non stocké, révocation par `versionLien`,
`noindex`, `Referrer-Policy: same-origin`, CSP sans hôte tiers, adresse masquée chez Sentry. Q6
propose un palier renforcé plus tard ; il ne bloque pas.

---

## 3. Ce qu'on montre, ce qu'on ne montre pas

### 3.1 Ce que l'apporteur reçoit déjà

| Support                    | Ce qu'il révèle                                                                                             | Ce qu'il ne dit pas              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------- |
| E-mail « commande signée » | Le nom de l'entreprise                                                                                      | Aucun montant                    |
| E-mail `apporteur-releve`  | Total HT, numéro, échéance, avoirs, somme virée                                                             | Aucun nom d'entreprise           |
| E-mail « virement fait »   | Montant, numéros, date                                                                                      | —                                |
| PDF d'autofacture          | Une ligne par commission, avec le prix public et le prix facturé au client                                  | Le nom du client                 |
| PDF, ligne de parrainage   | « Parrainage (art. 4.6) » et un montant par part (`designationCommission`, `autofacture-donnees.ts:99-101`) | Ni filleul, ni commande, ni prix |
| PDF d'avoir                | « Reprise d'une commission d'apport déjà versée (art. 4.5) »                                                | Ni client, ni motif              |

### 3.2 Liste blanche de la page

**Montré** : nom de l'entreprise qu'il a déclarée ; état de la présentation et ses dates ; commande
signée et sa date ; payée par le client le ; prestation réalisée le ; nature de la prestation en
clair ; commission hors taxes ; état ; numéro, date, échéance et TVA de son autofacture ; date de
versement ; reprises et avoirs ; virement à venir.

**Jamais montré** : le prix facturé au client et le prix public, à côté d'une entreprise (le PDF
reste la pièce détaillée) ; le numéro de la facture client et le détail acompte et solde ; le motif
d'une contestation et les faits d'un manquement ; toute donnée d'un autre apporteur ; une
présentation démentie ; les notes internes ; qui a marqué la prestation réalisée ; toute coordonnée
d'une entreprise ou d'une personne présentée ; le palier brut d'une reprise ; l'objectif interne de
virement sous deux jours ouvrés (une promesse).

### 3.3 Ni promesse de gain, ni objectif, ni compteur, ni compte à rebours

Règles d'écriture, verrouillées par un test de vocabulaire sur `textes.ts` **et** sur le rendu :

- aucun montant avant qu'une ligne n'existe avec `montantCents` non nul ;
- aucun total en tête, aucun nombre d'entreprises, aucun « ce mois-ci », aucune barre, aucune
  progression (en particulier vers le seuil de vigilance de 5 000 €) ;
- aucune date d'avenir sauf l'échéance imprimée sur le PDF et la date de fin de réservation, **une
  date, jamais un nombre de jours restants** ;
- aucune incitation (« présentez-en d'autres ») ;
- **formules interdites** (test sur le rendu) : « objectif », « challenge », « défi », « bravo »,
  « félicitations », « gagnez », « gagner plus », « potentiel », « classement », « rang »,
  « record », « bonus », « performance », « progression », « atteindre », « il vous reste », « il
  reste », « plus que », « jours restants », « dépêchez », « garanti » (dont « Aucun gain garanti » : la phrase ne figure pas sur cette page, c'est une règle du dirigeant pour les textes d'incitation), « Grenoble ». On filtre des formules de pression, pas
  des mots du quotidien (« pas encore eu lieu » reste permis). Le mot « palier » n'est pas interdit (libellé
  de la grille), mais aucun identifiant de palier n'est rendu. Le mot « prime » est permis seulement
  dans le libellé d'une ligne de prime validée, lu en base.

### 3.4 Parrainage : regroupé par autofacture

La part vaut 10 % de la commission du filleul : une ligne par part, datée, permettrait de retrouver
le gain d'un autre apporteur. La page affiche donc **une ligne par autofacture** : « Parrainage ·
facture n° … · 50,00 € hors taxes · Réglée le … ». Ni date de commande, ni nombre de parts.

Limite assumée : le PDF imprime aujourd'hui une ligne par part (`lignesAutofacture`). Si la juriste
lit l'article 4.6 comme « un seul montant agrégé », le PDF est à revoir dans un lot à part (Q5).

### 3.5 Le groupe « Hors entreprise » : parrainage et prime

Le groupe ne contient que des lignes **sans entreprise** de l'apporteur. Deux natures, aucune
d'autre :

| Nature | Reconnaissance | Libellé | Dates affichées | Ce qui est retiré |
| --- | --- | --- | --- | --- |
| **Parrainage facturé** | `parrainage = true` **et** `autofactureNumero` posé : regroupé par autofacture (§3.4) | « Parrainage · facture n° <numéro> · <montant> hors taxes · <état> » | « Réglée le », date de la facture | Jamais « Payée par le client le », « Prestation réalisée le », nature de la prestation |
| **Parrainage pas encore facturé** | `parrainage = true`, `autofactureNumero` nul | **Aucune ligne.** Il n'a pas de numéro, donc pas de clé de regroupement | — | Il n'est affiché qu'une fois facturé. Avant, la page ne dirait rien : un texte « Payée par le client. La prestation n'a pas encore eu lieu » apprendrait au parrain ce qui se passe chez le client de son filleul |
| **Prime validée** (#2261, `activite = prime_challenge`, sans `presentationId`) | `activite = prime_challenge` | **Lu en base** : `challenges_apporteur.titre`, via `palier = challenge:<id>` ; à défaut « Prime exceptionnelle » | « Réglée le », date de la facture seulement | Jamais « Payée par le client le » ni « Prestation réalisée le » (il n'y a pas de client) |

Règles : un parrainage ou une prime non facturés n'ont **aucun** texte d'état d'attente. Un test
(T5 ter) vérifie que, pour un parrainage non facturé, la vue ne contient aucune chaîne de la table des
états. Le libellé d'une prime vient de la base, pas du code : le worker et la page lisent le même champ
(table des natures du §10, ligne « Prime », ajoutée).

---

## 4. Maquette textuelle

Page serveur, une colonne, lisible au téléphone, composants `Coquille` de l'espace. Montants suivis
de « hors taxes » en toutes lettres. Dates au format « 12 novembre 2026 ».

```
← Retour à mon espace

Mes commissions
L'état de vos présentations et de vos commissions.

Virement à venir                                       (seulement s'il y en a un)
  Facture n° AXI-APP-2026-0014 du 18 novembre 2026
  500,00 € hors taxes · TVA 20 % : 100,00 € · 600,00 € toutes taxes comprises
  Échéance de paiement : 18 décembre 2026
  ↓ Télécharger la facture

Mes entreprises

  MENUISERIE DURAND
  Présentée le 3 octobre 2026
  Validée le 12 octobre 2026 · Réservée jusqu'au 3 avril 2027
    Commande signée le 2 novembre 2026
    Payée par le client le 14 novembre 2026
    Prestation réalisée le 17 novembre 2026
    Formation générale, 1 jour
    Commission : 500,00 € hors taxes
    Commission due · facture n° AXI-APP-2026-0014 · échéance de paiement le 18 décembre 2026

  GARAGE MARTIN
  Présentée le 20 octobre 2026
  Réservée jusqu'au 20 avril 2027
    Commande signée le 30 octobre 2026
    En attente du paiement du client

  CABINET LEROY
  Présentée le 8 novembre 2026
  À l'étude

Hors entreprise                                        (seulement s'il y a des lignes)
  Parrainage · facture n° AXI-APP-2026-0014 · 50,00 € hors taxes · Commission due
  (une prime validée apparaîtrait ici, avec son libellé et son état)

Mes factures et mes avoirs
  Facture n° AXI-APP-2026-0014 · 18 novembre 2026        ↓ Télécharger
  Avoir n° AXI-APP-2026-0011 · 2 novembre 2026           ↓ Télécharger

Comment lire cette page
  …(texte au §10.4)
  → Grille des commissions    → Télécharger mon contrat     (masqués en mode restreint)
```

### 4.1 Libellés des états

Tous les textes sont au §10, mot pour mot. Ils vivent dans **un seul fichier**,
`mes-commissions/textes.ts`. Les libellés de présentation sont ceux de
`LIBELLE_ETAT_DECLARATION`, jamais d'autres (Q3 décide seulement « Réservée » ou « Gardée », changé
aux deux endroits à la fois).

### 4.2 États vides et cas limites

| Situation                                     | Écran                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Interrupteur éteint                           | 404 ; aucun lien depuis l'accueil                                                                       |
| Aucune entreprise présentée                   | « Aucune entreprise présentée. » et « Retour à mon espace ». Pas d'incitation                           |
| Des entreprises, aucune commande              | Les cartes d'entreprise seules ; factures : « Aucune facture pour l'instant. »                          |
| Dossier pas encore signé                      | 404 neutre (comme la route du contrat)                                                                  |
| Mode restreint                                | Selon Q4 : lecture seule, **sans lien « Grille des commissions » ni « Télécharger mon contrat »** (ils mèneraient à « Réservé » ou à une 404), sans « Mes entreprises » en cours de réservation |
| Lien faux, révoqué, refusé ; résilié selon Q7 | 404 neutre existante                                                                                    |
| Lien d'exemple de l'aperçu console            | Écran d'exemple existant (`ID_DOSSIER_EXEMPLE`), jamais un 404                                          |
| PDF absent ou stockage qui lève               | 404 neutre sur la route ; la ligne reste affichée ; `signalerErreurReseau`                              |
| Base en panne                                 | `error.tsx` de l'espace. **Jamais « 0 € » par défaut**                                                  |
| Plus de 100 présentations ou 300 lignes       | Borne de lecture et mention au §10.3                                                                    |

### 4.3 TVA, selon le régime de l'apporteur

| `regimeTva`      | Par autofacture                                                        | Virement à venir                            |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| `assujetti`      | HT, « TVA 20 % » et son montant, TTC                                   | TTC                                         |
| `franchise_293b` | HT et « TVA non applicable, article 293 B du code général des impôts » | HT                                          |
| absent           | HT et « TVA : en vérification »                                        | « Montant en vérification » (aucun chiffre) |

**Le montant affiché est celui du PDF** (même fonction). Les montants sont calculés par `totalTtcPieceCents`, la fonction du PDF. ⚠️ Elle prend le régime
**actuel** ; si l'apporteur a changé de régime depuis l'émission, l'écran et le PDF diffèrent. Le
texte de la page renvoie au PDF comme pièce qui fait foi. EC-8 corrige la cause (Q8).

### 4.4 Accessibilité (repris de #2261)

- Un seul `<h1>` ; un `<h2>` par groupe ; le nom de l'entreprise en `<h3>`.
- L'état est du texte, jamais une couleur seule ; contraste AA ; cibles tactiles de 44 px ; focus
  visible ; aucune animation.
- Les liens de téléchargement nomment la pièce (« Télécharger la facture AXI-APP-2026-0014 »).
- Contrôle axe dans le test de bout en bout du lot EC-5.

---

## 5. Performance et budget JS

### 5.1 Requêtes

| N°  | Requête                                                                                                   | Index                                         |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1-4 | `lireDossierParLien` (existant)                                                                           | clés primaires                                |
| 5   | présentations de l'apporteur, 100 au plus                                                                 | `presentations_entreprise(apporteur_id)`      |
| 6   | commissions de l'apporteur, 300 au plus, colonnes énumérées, `presentation { denomination, apporteurId }` | `commissions_apporteur(apporteur_id, statut)` |
| 7   | factures non annulées des devis lus (exception (b) du §2.2), un seul `in` sur `devisId`; `PresentationReservation` par `presentationId` (exception (c)) | clé primaire, `devisId`, `presentationId` |
| 8   | origines des reprises, filtrées par apporteur                                                             | clé primaire                                  |
| 9   | journal « commande signée » de ses présentations, un `in`                                                 | `EmailLog(entityType, entityId)`              |
| 10  | devis et factures des `jobId` lus, un `in`                                                                | clé primaire, `devisId`                       |
| 11  | `suspenduesParNumero(apporteurId)` (à **exporter**, `facturation.ts:968`)                                 | `commissions_apporteur(apporteur_id, statut)` |

5 à 11 en `Promise.all`, sauf 10 qui suit 9. `lireDeclarationsDe` reçoit les lignes de la requête 6
au lieu de relire la table. Pas de cache : `force-dynamic`, `no-store`.

### 5.2 Budget JS

- **Zéro composant client**, zéro bibliothèque ajoutée ; les téléchargements sont des `<a>`.
- Cliquet concerné : **« Routes /apporteur/dossier — 25 KB cumulé »** (`package.json:271`,
  `.next/static/chunks/app/apporteur/**/page-*.js`), cumulé sur tout l'espace.
- Mesure au lot EC-5, une passe (octets déterministes) : `next build --experimental-build-mode
compile`, puis `pnpm bundle:check`. Dépassement → **STOP et demande au dirigeant**.
- CLS 0 (rendu serveur en une passe), INP sans interaction scriptée.

---

## 6. Interrupteur

| Clé                                 | Cible | Effet                                                                                                    |
| ----------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| `APPORTEUR_MES_COMMISSIONS_ENABLED` | site  | Page, lien depuis l'accueil, route des PDF. Éteint (toute valeur autre que `"true"`) : 404 et aucun lien |

**Cible : « site » pour la page et la route.** Les liens ajoutés dans les e-mails (EC-7) sont rendus
par le **worker** : l'interrupteur y a donc la cible **« les deux »** (site et worker), à déclarer dans
`coolify-drapeau.yml`. Un worker qui ne lit pas la clé ne rend **aucun lien** (jamais un lien vers une
page en 404).

Convention de `main` : **un fichier par interrupteur**, `src/features/apporteurs-reseau/interrupteur-mes-commissions.ts`
(sur le modèle de `interrupteur-rendez-vous.ts`), et la déclaration dans `src/env.ts`. Pas de fichier
`interrupteurs.ts` commun, donc plus de « créé par le premier qui livre ». Ajoutée à la liste fermée de
`.github/workflows/coolify-drapeau.yml`.

---

## 7. Règles de fusion

Aucun lot de la page ne porte de migration ni de forme de tâche BullMQ : rien à tolérer entre app
et worker. Les lots EC-7 (journal), EC-8 et EC-9 portent une migration additive, écrite selon les
règles d'`AGENTS.md` (colonne nullable ou table séparée, sans clé étrangère, tolérée par l'ancien
worker). Chaque PR s'ouvre en brouillon et ne passe « prête » qu'une fois. PR ouvertes à surveiller :
#2250, #1417, #1411, #2116, #2253, #2254, #2261.

---

## 8. Ce qui n'a pas été vérifié

Rien n'a été exécuté : ni l'application, ni un test, ni un build. Aucun accès à la production.

1. Le nombre de lignes `due` facturées sans `prestation_realisee_at` (C7) : à compter avant EC-2.
2. Les PR du contrat 2.7 (#1411, #1417) : elles peuvent toucher C1 ou la console.
3. Le poids réel de la route : à mesurer au lot EC-5.
4. `Cache-Control` de la page : `next.config.ts` pose `Referrer-Policy`, `X-Robots-Tag` et la CSP
   sur `/apporteur/dossier/`, pas `Cache-Control` vu à la lecture. La page le pose donc elle-même ;
   contrôle par `curl -sI` en production après allumage.
5. La politique de file de `apporteur-commande-signee` (`outbox-policy.ts:231`) : s'il est retenu « à
   valider », l'état apparaît après validation (voulu). La durée de conservation de `EmailLog` : si
   le journal est purgé, la mention disparaît pour les commandes anciennes non payées.
6. Les e-mails de chaque chemin d'annulation (`ajustement.ts:170` et `:268`, `avoir-client.ts:282`,
   `manquement.ts:329`) : non vérifiés un par un ; le libellé reste donc « Annulée », sans « nous
   vous avons écrit ».
7. Les avoirs de neutralisation sont supposés déposés sous la même clé R2 ; un PDF absent donne 404.
8. Le suivi de clics du prestataire d'e-mail (le lien personnel transiterait par un tiers).
9. Le changement de régime de TVA après émission (C9) : fréquence inconnue.
10. Le risque de requalification : les règles du §3.3 appliquent la consigne du dirigeant ; elles ne
    valent pas avis juridique.

---

## 9. Découpage en lots de code

Nature : **argent**, **sécurité**, **données**, **écran**. « Tests rouges d'abord » : chaque PR
commence par un commit de tests qui échouent.

| Lot                     | Titre                                           | Fichiers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Tests rouges d'abord                                                                                                                                                                                                                                                                      | Sous interrupteur    | Dépend de                              | Nature            |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------- | ----------------- |
| **EC-0**                | Interrupteur de la page                         | `src/features/apporteurs-reseau/interrupteur-mes-commissions.ts`, `src/env.ts`, `.github/workflows/coolify-drapeau.yml` (une option, cible « les deux »), spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | « éteint » si la valeur n'est pas exactement `"true"` ; la clé est dans la liste fermée du workflow                                                                                                                                                                                       | c'est l'interrupteur | —                                      | sécurité          |
| **EC-1**                | Route des PDF, dormante                         | `src/app/apporteur/dossier/[id]/[jeton]/factures/[numero]/route.ts`, `route.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | T1-T4, T10-T12, T14 ; statut ≠ `signe` → 404 ; mode restreint → 404 (tant que Q4 n'est pas « oui ») ; numéro > 40 caractères → 404 sans requête ; stockage qui lève → 404 ; pièce d'un autre → 404 ; octets servis, aucun appel à `getSignedUrlR2`                                        | oui                  | EC-0                                   | sécurité          |
| **EC-2**                | État pur à facettes, non branché                | `src/features/apporteurs-reseau/etat-commission.ts`, `__tests__/etat-commission.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | table de vérité : 7 statuts × contestation × réalisée × facturée × attente de fiche × reprise imputée ou non × neutralisation ; ligne historique facturée sans date de réalisation → `facturee` ; `a_qualifier` contesté → `suspendue` ; neutralisation masquée et rattachée à sa retenue | non (non branché)    | —                                      | données           |
| **EC-3** _(facultatif)_ | Console branchée sur EC-2                       | `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/commissions/page.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | rendu avant/après identique sur un jeu couvrant chaque onglet                                                                                                                                                                                                                             | non                  | EC-2                                   | écran             |
| **EC-4**                | Lecture cloisonnée                              | créés : `espace-commissions.ts` (`server-only`), `espace-commissions-assemblage.ts` (pur), specs, `tests/integration/…/espace-commissions-cloisonnement.spec.ts` ; modifiés : `facturation.ts` (export de `suspenduesParNumero`, `lireVirementsAFaire({ apporteurId })`), `commissions.ts` (`originesDesReprises` filtré par apporteur, extraction du repli `encaisseeAt`/`emissionAt`), `declaration-entreprise.ts` (`confirmeeAt`, `confirmationTacite`, lignes déjà lues)                                                                                                                              | T5, T5 bis, T6, T8, T9, T13 ; `jobId` → devis ; devis annulé → « commande annulée » ; somme du virement égale à `lireVirementsAFaire()` sans filtre pour ce même apporteur ; régime inconnu → « en vérification » ; garde « le worker n'importe pas `server-only` » toujours verte        | non (aucun écran)    | EC-2                                   | sécurité, données |
| **EC-5**                | La page                                         | créés : `src/app/apporteur/dossier/[id]/[jeton]/mes-commissions/page.tsx`, `textes.ts`, composants serveur, tests de rendu, `tests/unit/ci/l-espace-commissions-ne-promet-rien.spec.ts` (formules interdites, aucun montant sans ligne, aucun total, aucun nombre de jours restants), garde T7, `tests/e2e/flows/espace-apporteur-commissions.spec.ts` (axe) ; modifiés : `page.tsx` de l'espace (un lien, sous interrupteur), `[jeton]/page.tsx` (le libellé du lien vers la grille, l. ~153, devient « Grille des commissions » ; `commissions/page.tsx` n'est pas touché), `declaration-regles.ts` si Q3 change le mot, `le-mode-restreint-n-ouvre-que-la-vigilance.spec.ts` si Q4 = oui | un rendu par état principal et par état vide ; TVA par régime ; mode restreint sans lien grille ni contrat ; `noindex`, `no-store` ; « commande signée » sans chiffre ; mesure du cliquet 25 KB                                                                                           | oui                  | EC-0, EC-1, EC-4 ; textes du §10 relus | écran             |
| **EC-6**                | Console : « Voir ce que l'apporteur voit »      | `…/apporteurs/[id]/apercu-commissions/page.tsx`, un lien dans `…/apporteurs/[id]/page.tsx`, spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `gardePage("consultation")` ; même fonction de lecture que l'espace ; aucun lien vers le lien personnel de l'apporteur                                                                                                                                                                    | non (console)        | EC-4, EC-5                             | écran             |
| **EC-7**                | Suites                                          | liens (rendus seulement si l'interrupteur « les deux » est allumé côté worker) vers la page dans `apporteur-releve`, `apporteur-virement-fait`, `apporteur-commande-signee` (calculés dans le gabarit depuis le lien d'espace déjà présent : **aucune nouvelle clé de charge, aucun nouveau nom**) ; journal des téléchargements (table séparée, migration additive)                                                                                                                                                                                                                                                                                                               | le rendu des gabarits avec une ancienne charge est identique ; la table absente n'empêche pas le téléchargement                                                                                                                                                                           | oui (même clé, cible « les deux ») | EC-5                                   | écran, données    |
| **EC-8**                | Figer le régime de TVA à l'émission             | migration additive (`commissions_apporteur.regime_tva_emission`, nullable), `facturation.ts` (écrit à l'émission), `autofacture-donnees.ts` (lit la valeur figée, repli sur l'actuelle)                                                                                                                                                                                                                                                                                                                                                                                                                   | une autofacture émise en `assujetti` reste TTC après passage en franchise ; colonne absente (ancien worker) → comportement actuel                                                                                                                                                         | non                  | Q8                                     | argent            |
| **EC-9**                | Verrou en base : un seul apporteur commissionné | requête de comptage d'abord, puis migration : index unique partiel `commissions_apporteur(facture_id) WHERE parrainage = false AND statut <> 'annulee'` ; si Q2 = SIREN, la règle d'attribution est un chantier argent séparé                                                                                                                                                                                                                                                                                                                                                                             | le comptage rend 0 avant la migration ; deux lignes `parrainage = false` sur une même facture → refus ; une part de parrainage reste possible                                                                                                                                             | non                  | Q2                                     | données, argent   |

**Lançables tout de suite, sans décision du dirigeant** : EC-0 (la convention de fichier est écrite
au §6), EC-1 (mode restreint et dossier résilié refusés par défaut ; clé de limite : §2.4),
EC-2 (après le comptage du §1.3, fait par quelqu'un qui a l'accès production), EC-3 (facultatif),
EC-4 (après les corrections §1.2 bis, §2.2 et §3.5).

**Bloqués** : EC-5 par Q11 (textes du §10), Q3, Q4, Q7 **et Q9** (« Validée d'office »), après EC-0, EC-1
et EC-4 ; EC-6 par EC-5 ; EC-7 par EC-5 et par l'interrupteur à cible « les deux » (§6) ; EC-8 par Q8 ;
EC-9 par Q2 (une seule décision, qui vaut aussi D-1 de #2261) ; l'allumage par Q1.

Ordre :

```
EC-0 ─┬─→ EC-1 ───────────────┐
      │                       ├─→ EC-5 ─→ EC-6
EC-2 ─┴─→ EC-4 ───────────────┘     └──→ EC-7
EC-2 ─→ EC-3 (facultatif)
Q8 ─→ EC-8          Q2 ─→ EC-9
```

---

## 10. Textes à faire relire par le dirigeant (mot pour mot)

### 10.1 En-tête et lien

- Lien sur l'accueil de l'espace : « Mes commissions »
- Titre : « Mes commissions »
- Sous-titre : « L'état de vos présentations et de vos commissions. »
- Lien vers la grille (renommé) : « Grille des commissions »
- Retour : « ← Retour à mon espace »

### 10.2 Libellés

Présentation (libellés existants, inchangés sauf Q3) :

- « À l'étude »
- « En attente d'une réponse — nous revenons vers vous »
- « Réservée jusqu'au <date> » (« Réservée » seul si aucune date n'est portée, §1.2 bis) (ou « Gardée pour vous jusqu'au <date> » si Q3 = « Gardée »)
- « Non disponible »
- « Expirée » (libellé de `LIBELLE_ETAT_DECLARATION`, sans date : on n'invente pas d'autre libellé)
- « Présentée le <date> »
- « Validée le <date> »
- « Validée d'office le <date> » (confirmation tacite, si Q9 = oui ; sinon « Validée le <date> »)

Commande, avant toute commission :

- « Commande signée le <date> · En attente du paiement du client »
- « Commande signée · En attente du paiement du client » (date inconnue)
- « Commande annulée »

Commission (état principal) :

| État                              | Texte                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `suspendue`                       | « Suspendue : le client conteste la prestation. Nous vous avons écrit à ce sujet. »                                                     |
| `facturee`                        | « Commission due · facture n° <numéro> du <date> · échéance de paiement le <date> »                                                     |
| `a_preciser`                      | « Payée par le client. Montant en cours de calcul. »                                                                                    |
| `a_preciser`, hors grille         | « Payée par le client. Ce produit ne figure pas dans votre grille : nous vous écrivons pour vous dire s'il donne une commission. »      |
| `en_attente_realisation`          | « Payée par le client. La prestation n'a pas encore eu lieu. Rien n'est facturé avant. »                                                |
| `en_attente_pieces`               | « Nous attendons votre attestation de vigilance et votre justificatif d'immatriculation. Vous pouvez les déposer depuis votre espace. » |
| `en_attente_fiche`                | « Il nous manque une information pour établir votre facture : <ce qui manque>. Écrivez-nous. »                                          |
| `en_attente_fiche`, solde négatif | « Une reprise reste à déduire avant le prochain versement. »                                                                            |
| `due`                             | « Commission due. Facture en préparation. »                                                                                             |
| `versee`                          | « Réglée le <date> »                                                                                                                    |
| `sans_commission`                 | « Cette prestation ne donne pas de commission. »                                                                                        |
| `reprise_a_deduire`               | « Reprise de <montant> hors taxes : elle sera déduite de vos prochaines commissions. »                                                  |
| `reprise_deduite`                 | « Reprise de <montant> hors taxes, déduite · avoir n° <numéro> »                                                                        |
| `annulee`                         | « Annulée »                                                                                                                             |
| `retenue`                         | « Retenue. Un avoir n° <numéro> l'annule. Nous vous avons écrit à ce sujet. »                                                           |

Autres lignes :

- « Payée par le client le <date> »
- « Prestation réalisée le <date> »
- « Commission : <montant> hors taxes »
- « Parrainage · facture n° <numéro> · <montant> hors taxes · <état> »
- Groupe : « Hors entreprise »

### 10.3 Virement, TVA, factures

- « Virement à venir »
- « Facture n° <numéro> du <date> »
- Assujetti : « <HT> hors taxes · TVA 20 % : <TVA> · <TTC> toutes taxes comprises »
- Franchise : « <HT> hors taxes · TVA non applicable, article 293 B du code général des impôts »
- Régime absent : « <HT> hors taxes · TVA : en vérification » ; virement : « Montant en vérification »
- « Échéance de paiement : <date> »
- « Télécharger la facture <numéro> » ; « Télécharger l'avoir <numéro> »
- Section : « Mes factures et mes avoirs »
- Vide : « Aucune facture pour l'instant. »
- Borne : « Les plus anciennes ne sont pas affichées. Écrivez-nous pour les obtenir. »

### 10.4 Comment lire cette page

> Votre commission est due quand le client a payé toute sa commande et que la prestation a eu lieu.
> Nous établissons alors la facture à votre nom et nous faisons le virement.
> Si le client est remboursé ou ne paie pas, la commission est reprise.
> La facture en PDF est la pièce qui fait foi.

### 10.5 États vides

- « Aucune entreprise présentée. »

---

## 11. Décisions attendues du dirigeant

Questions fermées. Les lots EC-0 à EC-4 n'en dépendent pas.

| N°      | Question                                                                                                                                                | Recommandation                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1**  | La page peut-elle s'allumer avant que le code soit aligné sur votre grille (Journée IA 500 €, 15 % calculés à la signature, etc.) ? Oui / Non           | **Oui.** Elle ne montre que des montants déjà portés sur les autofactures envoyées. L'alignement est un chantier argent séparé, avec avenant.                                                            |
| **Q2**  | « Une entreprise » veut-il dire le **SIREN** (toute l'entreprise) ou l'**établissement** (SIRET, règle actuelle du contrat 2.6) ? SIREN / Établissement | **SIREN**, conforme à votre règle « jamais deux apporteurs commissionnés ». Conséquence : la règle d'attribution par établissement et l'article 2.6 du contrat sont à revoir (chantier argent, avenant). |
| **Q3**  | Mot de la protection : « Réservée » (actuel) ou « Gardée » ?                                                                                            | **« Réservée »** : c'est le mot de l'espace et des e-mails actuels ; changer impose de le changer partout.                                                                                               |
| **Q4**  | Un apporteur retiré du réseau avec de l'argent en jeu (mode restreint) voit-il « Mes commissions » en lecture ? Oui / Non                               | **Oui**, sans lien vers la grille ni le contrat. C'est son argent.                                                                                                                                       |
| **Q5**  | Parrainage affiché regroupé par autofacture (un montant par facture) ? Oui / Non                                                                        | **Oui.** À faire relire par la juriste avec l'article 4.6 ; le PDF suit dans un lot à part si elle demande un montant agrégé.                                                                            |
| **Q6**  | Faut-il, plus tard, exiger un lien frais envoyé par e-mail pour ouvrir « Mes commissions » ? Oui / Non                                                  | **Non au démarrage**, à revoir après trois mois d'usage.                                                                                                                                                 |
| **Q7**  | Un apporteur **résilié** à qui l'on doit encore de l'argent voit-il la page ? Oui / Non                                                                 | **Oui**, par le même mode restreint que le retrait (lecture seule). Aujourd'hui il n'a plus aucun espace (`etatDeLaPage` → neutre).                                                                      |
| **Q8**  | Figer le régime de TVA de l'apporteur au jour de chaque autofacture (lot EC-8) ? Oui / Non                                                              | **Oui.** Sans cela, un changement de régime change le montant à virer d'une facture déjà émise.                                                                                                          |
| **Q9**  | Distinguer « Validée d'office le … » quand l'entreprise n'a pas répondu (confirmation tacite) ? Oui / Non                                               | **Oui.** « Validée » seul laisse croire que l'entreprise a dit oui.                                                                                                                                      |
| **Q10** | Montrer un total annuel versé (utile pour la déclaration de l'apporteur) ? Oui / Non                                                                    | **Non** sur la page (un total se lit comme un compteur). L'apporteur a ses factures ; un relevé annuel peut partir par e-mail en janvier, sur décision à part.                                           |
| **Q11** | Les textes du §10 sont-ils validés tels quels ? Oui / Non (avec corrections)                                                                            | **Oui**, après relecture de la juriste pour le §10.4 et la ligne de parrainage.                                                                                                                          |
