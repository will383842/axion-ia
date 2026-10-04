# Critique de complétude — chantier OPCO (relecture du 2026-10-04)

**Question unique : qu'est-ce qui MANQUE pour que le chantier OPCO soit complet de bout en bout ?**
Lecture de `origin/main` à `7b7dd14ae` (#1279). Aucun code modifié. Les lignes citées sont celles de ce commit.

> ⚠️ **#1281 (compteur « OPCO couverts ») n'est PAS fusionnée** : la PR est ouverte, `mergeable_state: blocked`.
> La page Barèmes OPCO affiche toujours « 7 / 11 » pour 5 OPCO réellement couverts.

## Bilan par besoin du dirigeant

| Besoin                                                    | État                 | En une phrase                                                                                                                                                                                                                               |
| --------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) Répertorier les OPCO, affecter par IDCC               | **Partiel**          | Les 11 OPCO et leurs fiches sont là ; l'affectation par IDCC ne connaît **qu'un seul IDCC** (1516), tout le reste passe par le NAF, et l'inférence écrit l'**ancien** champ, pas l'OPCO typé (manques 1 et 2).                     |
| (2) Communication avec Axion Partners                     | **Partiel**          | `facture.emise` porte `subrogation` ; rien sur l'OPCO, le régime, le dépôt, l'accord ou un refus (manque 6).                                                                                                                               |
| (3) Demande de prise en charge par OPCO                   | **Couvert, à câbler** | Dossier prêt à déposer + kit + ZIP + saisie du dépôt ; mais la page de session renvoie au Hub sans lien et sans création du dossier (manque 9).                                                                                            |
| (4) Paiement direct par l'OPCO (subrogation)              | **Partiel**          | Le régime est calculé et bloque une NOUVELLE subrogation ; les subrogations posées avant le 1/10 ne sont jamais réexaminées et la facture partira à l'OPCO (manque 5).                                                                    |
| (5) Savoir ce que chaque OPCO donne par entreprise        | **Partiel**          | Barèmes officiels pour 5 OPCO sur 11 (Atlas absent) ; l'estimation lit l'ancien champ OPCO ; aucun suivi de ce qui a déjà été accordé (manques 1, 4).                                                                                    |
| (6) Enveloppes annuelles et période de l'année            | **Faible**           | Dates limites de dépôt et suspensions : oui. Consommation de l'enveloppe annuelle par entreprise et par année civile : **non**. L'estimation du devis se fait au barème du jour, pas de l'année de la session (manque 4).               |

---

## Les manques, du plus grave au moins grave

### 1. 🔴 Deux champs OPCO, et les lecteurs sont coupés en deux — les nouvelles briques sont aveugles sur tous les clients existants

**Preuve.**

- La migration A1 crée `clients.opco` **vide** et ne recopie rien depuis `opco_identifie` :
  `prisma/migrations/20261003120000_opco_effectif_client_et_accord_ecrit/migration.sql:2-3`.
- L'inférence IDCC/NAF n'écrit **que** l'ancien champ : `src/server/actions/qualiopi/clients.ts:283` et `:304`
  (`opcoIdentifie = v.opcoIdentifie ?? inferOpco(...)`) ; `opco` typé n'est posé que par un choix manuel.
- Lisent **seulement l'OPCO typé** `Client.opco` :
  - régime de paiement : `src/server/qualiopi/financements/regime-paiement-session.ts:50` et `:74` ;
  - état des fonds : `src/server/qualiopi/financements/etat-fonds-opco-lecture.ts:31` (bandeaux fiche client
    `clients/[id]/page.tsx:297`, devis `devis/[id]/page.tsx:140`) ;
  - alerte `delai_facturation_opco` : `src/server/qualiopi/alertes/regle-delai-facturation-opco.ts:49-50`.
- Lisent **seulement l'ancien** `Client.opcoIdentifie` :
  - estimation de prise en charge du devis : `src/server/actions/qualiopi/devis.ts:206` ;
  - alerte `aucun_bareme_opco` (volet session) : `src/server/qualiopi/alertes/evaluateur.ts:3169-3173` ;
  - destinataire imprimé sur la facture subrogée : `src/server/qualiopi/financements/destinataire-facture.ts:87`,
    `src/server/actions/qualiopi/factures-inter.ts:174` ;
  - payeur du dossier (débiteur OPCO) : `src/server/qualiopi/financements/dossier-payeurs.ts:141` ;
  - destinataire des relances : `src/server/qualiopi/financements/relance-destinataire.ts:106` ;
  - nom du financeur posé à la création du dossier : `src/server/qualiopi/financements/dossier-financement.ts:492-493` ;
  - convention tripartite : `src/server/qualiopi/documents/production/producteurs.ts:413-430` ;
  - fiche client, case « OPCO » : `clients/[id]/page.tsx:551` ; liste des clients : `clients/page.tsx:246-247`.
- Seuls le dossier prêt à déposer, l'alerte de dépôt et le kit utilisent la règle unique `opcoDuClient`
  (`src/server/qualiopi/financements/opco-referentiel.ts:66`).

**Conséquence.** Pour tout client créé avant le 2026-10-03 (donc tous les clients réels), `opco` est vide :
régime « OPCO non couvert / inconnu » partout, aucun bandeau d'état des fonds, alerte de délai de facturation
**muette**. Sur la même page de financement, l'encart de dépôt nomme l'OPCO (via `opcoDuClient`) pendant que le
régime juste au-dessus dit qu'il n'y en a pas. Inversement, un client dont on a choisi l'OPCO typé sans toucher
l'ancien champ a un devis estimé « réglages par défaut » et une facture adressée à « OPCO (à préciser) ».

**Correction proposée.**
1. Faire passer **tous** les lecteurs listés par `opcoDuClient` / `nomOpcoDuClient` (une règle, un endroit), y
   compris `regime-paiement-session.ts`, `etat-fonds-opco-lecture.ts` (sélectionner aussi `opcoIdentifie`) et
   `regle-delai-facturation-opco.ts`.
2. Migration de données additive : `UPDATE clients SET opco = opco_identifie::"Opco" WHERE opco IS NULL AND
   opco_identifie IN (<11 slugs>)` — les slugs sont identiques à l'enum (`opco-referentiel.ts:8-10`).
3. Faire écrire l'inférence IDCC/NAF dans `opco` typé (avec une origine « inféré » vs « confirmé »), puis
   décider la fin de vie de `opcoIdentifie` (lecture seule, puis retrait en deux PR, cf. règle app/worker).
4. Un test d'architecture qui refuse toute nouvelle lecture directe de `opcoIdentifie` hors `opco-referentiel.ts`.

### 2. 🔴 L'affectation par convention collective ne connaît qu'un seul IDCC

**Preuve.** `src/server/qualiopi/crm/naf-opco.ts:232-238` : `IDCC_OPCO_MAP` contient **une** entrée (`1516` → AKTO).
`inferOpco` (`naf-opco.ts:306-311`) retombe donc presque toujours sur le NAF, que le fichier lui-même qualifie
d'« HEURISTIQUE de repli » (`naf-opco.ts:240-241`). Le besoin (1) — « affecter chaque entreprise au bon OPCO selon
son IDCC » — n'est pas rempli côté axion-ia aujourd'hui.

**Contexte.** L'import de la table SIRO (France compétences) est volontairement en attente de la coordination
Partners (INT-T60-A à INT-T67-A), ainsi que le statut probable/confirmé, le tableau des anomalies et le blocage
sans IDCC confirmé. Ce manque est donc **connu**, mais c'est le plus structurant du besoin initial : tant qu'il
n'est pas livré, toute la chaîne (barème par branche, état des fonds par branche, régime) repose sur une saisie
manuelle de l'IDCC et de l'OPCO.

**Correction proposée.** Ne pas attendre Partners pour la **donnée** : la table SIRO est publique. Charger
IDCC → OPCO dans un référentiel axion-ia versionné (seed ou table `idcc_opco` sourcée et datée), garder la
partie « contrôle croisé / anomalies / blocage » pour la coordination. À défaut, au minimum, inscrire la date
cible dans le registre Partners pour que l'attente soit visible.

### 3. 🔴 L'effectif est requis par trois briques et n'est renseigné nulle part

**Preuve.** La colonne naît vide (migration A1) ; `EffectifSource` prévoit `insee` mais aucun code ne l'alimente
(`prisma/schema.prisma:5013-5014`, « lot ultérieur »). Sans effectif :
- régime → `inconnu` « effectif non renseigné » : `regime-paiement-opco.ts:102-103` ;
- estimation → pas de tranche, pas de détection « 50 et plus, hors fonds légaux » : `crm/devis.ts:106` ;
- état des fonds → les suspensions bornées par `effectifMaxExclu` ne peuvent pas s'appliquer :
  `etat-fonds-opco-lecture.ts:28`.
La seule saisie possible est le formulaire replié de la liste des clients (manque 4). Aucune alerte ne signale
une session OPCO dont le client n'a pas d'effectif.

**Correction proposée.** (a) Relevé INSEE/Sirene (tranche d'effectif de l'unité légale, déjà utilisée par le
module prospection) à la création et au rafraîchissement du client, `effectifSource = insee` ; (b) alerte
« session OPCO à venir, client sans OPCO / sans IDCC / sans effectif » au guichet administratif, ciblée sur la
session, avant J-30.

### 4. 🟠 Besoins (5) et (6) : rien ne suit ce que l'OPCO a déjà donné à l'entreprise dans l'année

**Preuve.**
- « Enveloppe restante » = enveloppe **annuelle brute** de la fiche, jamais diminuée de ce qui a été accordé :
  `src/server/actions/qualiopi/devis.ts:198-199` (`v.opcoEnveloppeRestanteCents ?? client?.opcoEnveloppeAnnuelleCents`).
  Aucune somme de `DossierFinancement.montantAccordeCents` par client × OPCO × année civile n'existe dans le code.
- `opcoEnveloppeAnnuelleCents` et `opcoNumeroAdherent` sont acceptés par l'action (`clients.ts:136`, `:197`) mais
  **aucun formulaire de la console ne les propose** (ni `ClientBrancheForm`, ni `ClientForm`, ni `ClientEditForm`).
- L'estimation du devis est faite au barème **du jour** : `estimateOpcoCoverage` est appelée sans `asOf`
  (`devis.ts:200-209`, défaut `new Date()` dans `crm/devis.ts`), alors qu'un devis d'octobre pour une session de
  février 2027 relève du barème et de l'enveloppe 2027.
- Barèmes officiels relevés pour 5 OPCO sur 11 (AKTO, Constructys, Mobilités, OPCO Santé, OPCOMMERCE —
  `prisma/migrations/20261004090000_baremes_opco_releves_2026/migration.sql`). **Atlas** (conseil, numérique,
  bureaux d'études — le cœur de cible), OPCO EP, OPCO 2i, Afdas, Uniformation, Ocapiat : estimation sur les
  réglages par défaut… qui sont des tarifs **Atlas** non relevés (`crm/devis.ts`, clés `opco_atlas_*`).

**Correction proposée.** Une vue « Ce que l'OPCO a déjà pris en charge » sur la fiche client : somme des montants
accordés (et des montants demandés en cours) par OPCO et par année civile, comparée au plafond annuel du barème
de l'année ; l'enveloppe restante du devis = plafond − consommé. Passer la date de début prévue comme `asOf`.
Ajouter les champs enveloppe / n° d'adhérent au formulaire de branche. Relever le barème Atlas en priorité.

### 5. 🟠 Les subrogations posées avant le 1/10/2026 ne sont jamais réexaminées

**Preuve.** Le contrôle du régime n'a lieu qu'au moment où l'on **pose** la subrogation :
`src/server/actions/qualiopi/financements.ts:270-280` (`if (updateData.opcoSubrogation === true)`). Aucune
alerte, aucun écran ne repère une session déjà `opcoSubrogation = true` dont le régime calculé est désormais
`remboursement_entreprise` (`regimePaiementDeSession` n'est appelé que par cette action et par la lecture du
dossier prêt à déposer). La facture partira alors à l'OPCO (`destinataire-facture.ts:86-89`) et sera rejetée.

**Correction proposée.** Règle d'alerte `subrogation_incompatible_regime` (guichet direction, critique avant
émission de la facture) sur toute session subrogée non facturée dont le régime est `remboursement_entreprise`
sans `subrogationConfirmeeParAccord`, et même contrôle à la génération de la facture.

### 6. 🟠 Partners ne reçoit rien du nouveau cycle OPCO — à signaler à Partners

**Preuve.**
- `financement.mis_a_jour` est figé à **trois clés** `{factureId, payers[], echeanceFinanceurAt}` par REQ-INT-032
  et « HORS CONTRAT v1 » : `src/server/partners/payloads.ts:779-801`. `payers` ne porte que `payeurType` et un
  montant (`payloads.ts:455`, `:476-481`), jamais l'OPCO.
- Il n'est émis que lorsque l'**échéance du financeur** change, et seulement pour des factures déjà émises :
  `src/server/qualiopi/financements/dossier-financement.ts:188-200`. Le dépôt (`enregistrerDepotDossier`,
  `:241`), l'accord, l'accord écrit, le refus (`transitionnerDossier`, `:145`) n'émettent rien.
- Dans l'autre sens, la porte d'entrée client (`src/server/qualiopi/crm/porte-client.ts:372-391`, `DonneesFiche`)
  accepte `opcoIdentifie` mais ni `opco` typé ni `effectif` : un client apporté par Partners arrive avec l'ancien
  champ seulement (manque 1).

**Pourquoi c'est utile à Partners.** Les commissions sont payées à l'encaissement. Le régime décide **qui paie et
quand** (OPCO en subrogation vs entreprise puis remboursement) ; un refus OPCO ou un dépôt jamais fait annonce
un encaissement qui n'aura pas lieu ou qui glisse. Aujourd'hui Partners ne le voit qu'à `facture.emise`
(`subrogation: boolean`) et à `paiement.recu`.

**Correction proposée (à porter au registre Partners, pas à coder ici seul).** Proposer un événement
`financement.etape` (ou une v2 de `financement.mis_a_jour`) portant : `opco`, `regime`
(`subrogation_possible | remboursement_entreprise | inconnu`), `depotFaitLe`, `accordEcritLe`, `statut`
(déposé / accordé / refusé), `montantAccordeCents`, émis au dépôt, à l'accord et au refus — clé de fait sur le
dossier, pas sur la facture, puisque ces faits précèdent toute facture. Et ajouter `opco` / `effectif` à
`DonneesFiche` en même temps que la tâche d'import SIRO.

### 7. 🟠 Saisir l'IDCC, l'OPCO et l'effectif d'un client : où, et lequel ?

**Preuve.**
- La seule saisie est le `<details>` « Modifier » d'**une ligne de la liste** des clients
  (`clients/page.tsx:274-282`). La page d'édition du client renvoie explicitement vers la liste
  (`clients/[id]/edit/page.tsx:66` : « La branche (IDCC, taille, OPCO) se modifie depuis la liste des clients »).
- Ce formulaire présente **deux listes déroulantes** quasi identiques, « OPCO » (ancien champ, option « — (inféré) »)
  et « OPCO (référentiel) » (typé) : `src/components/admin/qualiopi/ClientBrancheForm.tsx:191-232`. Rien n'indique
  laquelle compte — et selon le manque 1, chacune alimente des écrans différents.
- La fiche client n'affiche ni l'IDCC, ni l'effectif, ni l'OPCO typé : seule la case « OPCO » lit l'ancien champ
  (`clients/[id]/page.tsx:549-553`). Un utilisateur qui voit le bandeau d'état des fonds manquer sur la fiche n'a
  aucun moyen de comprendre pourquoi.
- Le formulaire de création (`ClientForm.tsx`) propose l'IDCC mais ni l'OPCO ni l'effectif.

**Correction proposée.** Un bloc « Branche et OPCO » sur la fiche client (lecture : IDCC, convention, effectif et
sa source/date, OPCO typé avec « inféré » ou « confirmé », enveloppe, n° adhérent ; bouton Modifier sur place).
Un seul sélecteur OPCO (le typé), l'inférence affichée comme suggestion. Lien depuis l'encart de dépôt et le
bandeau quand une donnée manque (« Effectif inconnu — le renseigner »).

### 8. 🟡 Des alertes attendues n'existent pas

**Preuve et manque.**
- **Session sur une branche suspendue** : l'état des fonds n'est qu'un bandeau (fiche client, devis, texte de
  l'encart) — aucune règle n'alerte quand une session planifiée a un client dont l'OPCO/IDCC/tranche est en
  statut suspendu ou dont la date limite de dépôt est passée (`etatFondsDuClient` n'est appelé par aucune règle :
  usages dans `dossier-pret-a-deposer-lecture.ts:83`, `clients/[id]/page.tsx:297`, `devis/[id]/page.tsx:140`).
- **Veille de l'état des fonds jamais amorcée** : « Sans aucun relevé, rien » (`evaluateur.ts:3108-3112`). Si
  personne n'a jamais saisi de relevé, l'alerte `etat_fonds_perime` ne se lève jamais.
- **Données client manquantes** sur une session OPCO (OPCO, IDCC, effectif) : aucune règle (cf. manque 3).
- `aucun_bareme_opco` (volet session) ignore les clients dont seul l'OPCO typé est posé (`evaluateur.ts:3169`).

**Correction proposée.** Règle `fonds_opco_suspendus_session` (direction, J-60) ; faire lever
`etat_fonds_perime` aussi quand il n'existe **aucun** relevé ; règle « données OPCO du client incomplètes » ;
`aucun_bareme_opco` via `opcoDuClient`. Les guichets sont déjà prêts (toutes les entrées OPCO du catalogue sont
au guichet `direction`, `catalogue.ts:1205-1270`).

### 9. 🟡 La page Financement de la session ne mène pas au geste suivant

**Preuve.**
- Sans dossier OPCO ouvert, l'encart dit « le dépôt se saisit sur le dossier, depuis le Hub facturation » sans
  lien ni bouton de création (`src/components/admin/qualiopi/DepotOpcoPanel.tsx:176-180`), alors que
  `creerDossierDepuisSession` existe (`dossier-financement.ts:410`).
- L'accord écrit (date) ne se saisit qu'au Hub facturation, et en « facultatif »
  (`DossiersFinancementPanel.tsx:435`) ; il gouverne pourtant le régime (`regime-paiement-session.ts:57`).
- L'état des fonds n'apparaît sur cette page que comme une phrase dans l'encart, pas avec le
  `BandeauEtatFonds` rouge/orange utilisé ailleurs.
- Le barème de branche résolu (ce que l'OPCO donnerait) n'est pas affiché en regard du « Barème de prise en
  charge (dossier) » saisi à la main (`PriseEnChargeForm`).

**Correction proposée.** Bouton « Ouvrir le dossier OPCO » dans l'encart ; saisie de l'accord écrit au même endroit
que le dépôt ; `BandeauEtatFonds` en tête de section ; ligne « Estimation au barème : X € (source, relevé le …) ».

### 10. 🟡 Le régime ne peut jamais trancher pour OPCO Mobilités, ni voir un versement volontaire

**Preuve.** `versementVolontaire: false` et `adhesionOffreMobilites: null` sont codés en dur :
`regime-paiement-session.ts:54-55` (« Aucune donnée en base ne porte (encore) ces deux faits »). Pour Mobilités, le
régime reste donc toujours `inconnu` (`regime-paiement-opco.ts:128-141`), et un versement volontaire — qui fait
perdre la subrogation — n'est jamais pris en compte.

**Correction proposée.** Deux champs sur le client ou le dossier (« adhérent à l'offre de services Mobilités »,
« versement volontaire / conventionnel »), saisis dans le bloc Branche et OPCO.

### 11. ⚪ Restes connus, à garder visibles

- #1281 (compteur « OPCO couverts ») ouverte et bloquée — à fusionner.
- En attente Partners (INT-T60-A à INT-T67-A) : import IDCC→OPCO depuis SIRO, contrôle croisé probable/confirmé,
  tableau des anomalies, blocage du dossier sans IDCC confirmé, mandat OPCO, convention sous condition
  suspensive. Les manques 1, 2 et 6 en dépendent en partie : les livrer **dans le même lot** éviterait de
  câbler deux fois.
- Rappel de la fenêtre app/worker (~50 min) : la correction du manque 1 touche des lectures du worker
  (`src/server/queue/workers/qualiopi-formation-crons-worker.ts:1330-1335`) — lire `opco` ET `opcoIdentifie`
  pendant la transition, ne retirer l'ancien champ que dans une PR ultérieure.

---

_Relecture automatique (routine « critique de complétude »), sans modification de code._
