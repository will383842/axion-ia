# Audit — pilotage du formateur défaillant & commissions

> Rédigé **au fil de l'eau** le 2026-09-05, en LECTURE SEULE sur `wt-app30`.
> Reprise du lot F, dont la première tentative avait rendu un fichier de 0 octet
> (§ 6 de `_SESSIONS/2026-09-05_QUALIOPI-ETAT-VIVANT.md`).
>
> ⚠️ **L'arbre A BOUGÉ PENDANT L'AUDIT, et ce n'est pas une précaution de
> style : c'est arrivé.** Un autre agent travaille sur le moteur d'alertes dans
> le même arbre. À ma première lecture (**08:11**), `evaluateur.ts` pesait
> 157 926 o et n'émettait AUCUN des nouveaux codes formateur. À ma relecture de
> contrôle (**08:20**), le même fichier pesait **183 936 o** (mtime 08:14:44) et
> les émettait. **Tous les numéros de ligne d'`evaluateur.ts` cités ici ont donc
> été RE-VÉRIFIÉS après 08:20**, et l'ancre durable reste le **nom de fonction**,
> pas le numéro. Le § 1.6 raconte ce que le chantier voisin a fermé sous mes
> yeux — et le § 1.7, ce qu'il ne ferme pas.

---

## 0. Ce qui est VÉRIFIÉ, et ce qui est SUPPOSÉ

**Vérifié** — lu ligne à ligne dans le dépôt : `prisma/schema.prisma`, les
actions serveur de `src/server/actions/qualiopi/`, le service
`src/server/qualiopi/trainers/mission-formateur.ts`, le catalogue et
l'évaluateur d'alertes, les crons de
`src/server/queue/workers/qualiopi-formation-crons-worker.ts`, le moteur
`src/server/qualiopi/remuneration/` (calcul, run, statements, queries, marge),
la matrice `src/server/auth/habilitations.ts`, la SSOT marketing
`src/content/pricing.ts`.

**Non vérifié / supposé.** Je n'ai lancé **aucun** test, **aucun** typecheck,
**aucune** requête en base, et je n'ai rien vu à l'écran. Tous les constats
ci-dessous sont des constats de **CODE**. Aucun n'a été observé en production.

**Distinction imposée.** Chaque défaut du § 3 porte un tag `[code]` ou
`[données]`. Un constat sur des données de seed n'est pas un défaut de prod ; il
n'y en a aucun ici, parce que je n'ai lu aucune donnée — c'est justement ce que
dit le § 4.

---

## 1. Le formateur DÉFAILLANT

### 1.1 Les états, et qui les écrit

Trois tables portent l'état d'un formateur sur une session. Elles ne disent pas
la même chose et **aucune n'est le journal de l'autre**.

| Objet | Modèle | États |
|---|---|---|
| L'**affectation courante** | `SessionFormateur` (`prisma/schema.prisma:5812`) | pas d'état : la ligne EXISTE ou n'existe pas |
| Le **journal des propositions** | `MissionFormateur` (`prisma/schema.prisma:5842`) | `MissionFormateurStatut` (`:5760`) : `en_attente`, `acceptee`, `refusee`, `retiree`, `expiree`, `sans_reponse` |
| Le **fait constaté** | `Incident` (`:7339`) avec `faitIntervenant` (`IncidentFaitIntervenant`, `:7312`) : `annulation_tardive`, `desistement`, `retard`, `preuve_manquante`, `qualite_insuffisante`, `autre` |

Trois autres portent l'aptitude de la personne, hors session :
`TrainerHabilitation` (`:5673`, retrait daté par `retireAt`),
`TrainerAvailability` (`:5730`, fenêtre d'indisponibilité), `TrainerDocument`
(`:5181`, pièces avec `dateExpiration`) et les colonnes RC pro de `Trainer`
(`rcProAttestationUrl`, `rcProEcheanceAt`).

**Qui écrit quoi :**

| État | Écrit par | Ligne |
|---|---|---|
| `en_attente` | `proposerMissionFormateur` | `trainers/mission-formateur.ts:172` |
| `acceptee` / `refusee` | `repondreMission` — le FORMATEUR, par lien e-mail ou espace connecté | `mission-formateur.ts:606` et `:626` |
| `retiree` | `retirerMissionsEnAttente` et `proposerMissionFormateur` — l'ORGANISME | `mission-formateur.ts:351` et `:216` |
| `expiree` | cron `missions-formateur`, au DÉMARRAGE de la session | `mission-formateur.ts:387` |
| `sans_reponse` | cron, à l'échéance de réponse, AVANT le démarrage | `mission-formateur.ts:489` |
| Incident `desistement` / `annulation_tardive` | `declarerAbsenceFormateurAction` — un humain, depuis la fiche de session | `actions/qualiopi/mission-formateur.ts:178` |
| `TrainerHabilitation.retireAt` | `setTrainerHabilitationsAction` | `actions/qualiopi/trainers.ts:356` |
| `Trainer.actif = false` | `setTrainerActifAction` | `actions/qualiopi/trainers.ts:555` |

### 1.2 Ce que chaque état déclenche

| Événement | Affectation retirée ? | E-mail ? | Alerte ? |
|---|---|---|---|
| `refusee` | **OUI** — `sessionFormateur.deleteMany` + `formateurPrincipalId = null` (`mission-formateur.ts:628-637`) | non | `formateur_mission_refusee`, critique — `regleMissionFormateurRefusee`, `evaluateur.ts:2860` |
| `sans_reponse` | **OUI** — même transaction (`mission-formateur.ts:489-499`) | non | `formateur_mission_sans_reponse_delai`, critique — `evaluateur.ts:2981` |
| `expiree` | **NON** — l'affectation tient (`mission-formateur.ts:386-388`) | non | `formateur_mission_expiree`, critique — `regleMissionFormateurExpiree` |
| `retiree` | sans objet (posé sur une mission `en_attente`, l'affectation part par ailleurs) | non | **AUCUNE — et c'est motivé** : `catalogue.ts:888-895` explique que `retiree` est la ménagerie normale du dispositif |
| Incident `desistement` / `annulation_tardive` | **NON** (`actions/qualiopi/mission-formateur.ts:174-177`, le commentaire l'assume) | **non** | `formateur_desiste_session`, critique — `regleFormateurDesisteSession`, `evaluateur.ts:3270`. **Posée par le chantier voisin PENDANT cet audit** : cf. § 1.6 |
| Incident `retard`, `preuve_manquante`, `qualite_insuffisante` | **NON** | non | **AUCUNE** — aucune règle ne les lit |
| Habilitation retirée | **NON** | non | `formateur_non_habilite_assigne`, important — `regleFormateurNonHabiliteAssigne` (couvre désormais aussi la session démarrée) |
| `Trainer.actif = false` | **NON** | non | **AUCUNE** — `grep "actif: false"` sur `evaluateur.ts` et `catalogue.ts` ne rend RIEN (vérifié à 08:22) |
| Indisponibilité déclarée | **NON** | non | `formateur_indisponible_sur_session`, critique — `regleFormateurIndisponibleSurSession` |

**Un fait qui structure tout le reste : le formateur reçoit un e-mail quand on
lui PROPOSE une mission (`mission-formateur.ts:286`) ; l'organisme n'en reçoit
JAMAIS quand le formateur répond.** La totalité de la remontée vers l'humain
passe par le moteur d'alertes, c'est-à-dire par un balayage périodique et un
écran qu'il faut ouvrir. Aucun refus, aucun désistement ne pousse quoi que ce
soit vers une boîte mail.

### 1.3 Ce qui arrive aux STAGIAIRES

**Rien. Aucune ligne de code ne notifie un stagiaire d'un changement de
formateur.** Vérifié en lisant `src/server/qualiopi/notifications/notifications-service.ts` :
le mot « formateur » n'y apparaît que dans un commentaire (`:368-370`), jamais
dans une notification.

Ce n'est pas neutre, parce que **le formateur est nommé sur les pièces envoyées
au stagiaire** :

- la **convocation** porte un champ « Formateur / Formatrice »
  (`documents/templates/convocation.tsx:119`), alimenté par `resolveFormateurNom`
  (`documents/production/producteurs.ts:623`) ;
- la **grille d'évaluation** (`producteurs.ts:774`) et le **livret d'accueil**
  (`producteurs.ts:1121`) le nomment aussi.

Conséquence prouvée par le code : quand le formateur se retire après l'envoi de
la convocation, le PDF déjà remis au stagiaire nomme une personne qui
n'animera pas, **et rien ne le signale ni ne propose de réémettre**. Pire, le
repli de `resolveFormateurNom` (`producteurs.ts:118-122`) est la **raison
sociale de l'organisme** : une convocation régénérée après le retrait
n'affichera pas « formateur à désigner », elle affichera « Axion-IA » à la ligne
« Formateur / Formatrice ».

**Ce que le système fait BIEN, en revanche** : les convocations et rappels J-1
destinés au FORMATEUR ne partent qu'à qui a accepté. La sélection croise
`SessionFormateur` avec une mission `acceptee`
(`qualiopi-formation-crons-worker.ts:1877-1890`), sauf pour les statuts où
l'accord n'est pas requis (`accordRequis`). Le commentaire `:1860-1876` raconte
le défaut corrigé — proposition à 16h30, rappel « votre session de demain » à
16h40, au même destinataire qui n'avait rien accepté.

### 1.4 Ce qui arrive aux DOCUMENTS déjà émis

**Aucune pièce n'est annulée automatiquement, jamais, pour aucune cause.**
`annuleeAt` n'est écrit qu'à un seul endroit du dépôt :
`actions/qualiopi/documents.ts:2790`, dans `annulerDocumentAction`, qui exige un
`requireAdminWrite`, un motif d'au moins N caractères, et un clic humain.

Donc, quand un formateur disparaît :

- la **lettre de mission** (`documents.ts:1284`), qui le nomme, porte son tarif
  résolu par le même `resolveRegle` que la paie (`documents.ts:1266-1273`), et
  peut avoir été **signée par les deux parties**, reste **valide au registre**.
  Aucune alerte ne dit « une lettre de mission vivante nomme quelqu'un qui n'est
  plus affecté » ;
- la **convocation**, la **grille d'évaluation**, le **livret d'accueil** restent
  au registre avec l'ancien nom ;
- rien ne recense l'écart. Il n'existe **aucune règle** dans `evaluateur.ts` qui
  croise `DocumentGenere` et `SessionFormateur`.

### 1.5 Le chemin de REMPLACEMENT, et ce qu'il laisse au registre

Le chemin existe : `assignTrainerToSessionAction`
(`actions/qualiopi/trainers.ts:593`). Il est **sérieux** — il refuse un formateur
non habilité (`:657`), refuse une double affectation en croisant le planning
(`:678-690`), snapshotte le tarif (`:697`), avertit sur la conformité
documentaire (`:747`) et sur les congés (`:770`), retire les sollicitations
ouvertes des écartés (`:753`), et **propose la mission au nouveau** (`:756`).

Ce qu'il **détruit** en revanche, dans la même transaction :

```
await tx.sessionFormateur.deleteMany({
  where: { sessionId, role: "principal", trainerId: { not: trainerId } },
});
```
`actions/qualiopi/trainers.ts:707-713`

La ligne de l'ancien formateur est **supprimée**, avec elle `heuresAnimees`,
`tarifHtCents` (le tarif snapshoté à SON affectation), `convocationJ7EnvoyeeAt`
et `rappelJ1EnvoyeAt`. **Il ne reste aucune trace, dans `SessionFormateur`, du
fait qu'il a un jour été le formateur de cette session.** Ce qui subsiste : la
ligne `MissionFormateur` (le journal) et l'entrée `AdminActivity`
(`logQualiopiActivity`, `:775`).

Et le journal lui-même est incomplet : `retirerMissionsEnAttente`
(`mission-formateur.ts:338-351`) ne touche que les missions `en_attente`. **Une
mission `acceptee` d'un formateur remplacé reste `acceptee` pour toujours**,
alors que son affectation vient d'être supprimée.

### 1.6 Le chantier « alertes » a atterri PENDANT l'audit — ce qu'il a fermé

C'est un fait mesuré, pas une supposition : entre ma première lecture et ma
relecture de contrôle, `evaluateur.ts` a gagné 26 010 octets.

| | 08:11 | après 08:14:44 |
|---|---|---|
| `catalogue.ts` porte `formateur_desiste_session` (`:902`), `formateur_rc_pro_expiree` (`:936`), `formateur_rc_pro_expire_j60` (`:942`) | OUI | OUI |
| `evaluateur.ts` ÉMET ces codes | **NON — aucune occurrence** | **OUI** |

**Ce que le chantier voisin a fermé, et que je retire donc de mes défauts :**

1. **Le désistement n'est plus muet.** `regleFormateurDesisteSession`
   (`evaluateur.ts:3270`, inscrite dans `REGLES` `:3852`) lit `Incident` sur
   `faitIntervenant ∈ {desistement, annulation_tardive}`, **sans filtre de
   statut du formateur**, et couvre aussi la session DÉJÀ démarrée (titre
   distinct « Session en cours sans intervenant confirmé »).
2. **La RC pro hors sous-traitance est couverte.**
   `regleRcProFormateurHorsSousTraitance` (`evaluateur.ts:3731`, `REGLES`
   `:3858`) sur `statut: { not: "sous_traitant" }`. ⚠️ **L'EXPIRATION
   seulement** : la règle exige `rcProEcheanceAt: { not: null }`, et le
   catalogue motive le choix (`catalogue.ts:908-926`) — n'alerter jamais sur un
   devoir qui n'existe pas.
3. **Les alertes ne s'éteignent plus toutes au démarrage.**
   `regleFormateurNonHabiliteAssigne` et `regleFormateurIndisponibleSurSession`
   traitent maintenant la session commencée, et surtout
   `session_sans_formateur` passe de `important` à **`critique`** quand la
   session est passée (`evaluateur.ts:736`) — c'est l'état vers lequel se
   rabattent `formateur_mission_refusee` et
   `formateur_mission_sans_reponse_delai`, qui gardent, eux, leur borne
   `dateDebut: { gt: now }` (`:2834` et `:2955`). Le rabattement est désormais
   **de même niveau**, ce qui referme le trou n°4 de l'état vivant.

⚠️ **Corollaire de méthode.** Ce paragraphe se périme vite. Ce qui suit, non :
le § 1.7 ne liste que des lacunes **indépendantes** de ce chantier, chacune
re-vérifiée après 08:20.

### 1.7 Ce qui reste MUET, le chantier voisin ATTERRI

Six lacunes, toutes re-vérifiées **après 08:20**, toutes indépendantes de
`formateur_desiste_session`.

1. **Une mission `acceptee` ORPHELINE fait croire à trois règles que le trou est
   bouché.** `retirerMissionsEnAttente` ne retire que les `en_attente`
   (`mission-formateur.ts:347`) : une mission `acceptee` d'un formateur ensuite
   REMPLACÉ reste `acceptee`, alors que sa ligne `SessionFormateur` vient d'être
   supprimée (`trainers.ts:707-713`). Or trois règles s'en servent comme preuve
   que quelqu'un tient la place :
   `regleMissionFormateurSansReponseDelai` (`evaluateur.ts:2967` :
   `missionsFormateur: { where: { statut: "acceptee" } }`, puis
   `if (…length > 0) continue`), `regleMissionFormateurExpiree` (même motif), et
   **la nouvelle** `regleFormateurDesisteSession`, dont le test de remplacement
   est `s.missionsFormateur.some((m) => m.trainerId !== desistantId)` — il
   exclut bien le désistant, mais **pas un tiers qui n'est plus affecté**.
   Séquence entièrement dans le code : A accepte → l'organisme affecte B → la
   mission de A reste `acceptee` → B ne répond jamais, ou se désiste → **les
   trois alertes se taisent**. C'est le défaut le plus grave de cette partie,
   et le chantier voisin vient de l'étendre à une quatrième règle.
2. **Un `Trainer` désactivé reste principal sur ses sessions futures.**
   `setTrainerActifAction` (`trainers.ts:555-564`) écrit un booléen, rien
   d'autre. `grep "actif: false"` sur `evaluateur.ts` **et** `catalogue.ts` ne
   rend aucune ligne (vérifié à 08:22). La garde `isTrainerHabilite` ne joue
   qu'au moment de l'affectation (`trainers.ts:657`), jamais rétroactivement :
   la convocation partira.
3. **Le retrait d'habilitation ne dit jamais POURQUOI.**
   `setTrainerHabilitationsAction` écrit `{ retireAt, retireById }`
   (`trainers.ts:356`) — **jamais `motifRetrait`**. La colonne
   (`schema.prisma:5702`) est documentée « Écrit par l'humain qui la retire » et
   n'est écrite par **aucune** ligne du dépôt.
4. **Les incidents autres que désistement / annulation tardive ne remontent
   nulle part, pour personne.** `IncidentFaitIntervenant` porte aussi `retard`,
   `preuve_manquante`, `qualite_insuffisante` (`schema.prisma:7312`). Aucune
   règle ne les lit : ni la nouvelle `regleFormateurDesisteSession` (filtre
   explicite sur deux valeurs), ni `sous_traitant_incidents_repetes` dont les
   `FAITS_BLOQUANTS` sont les deux mêmes (`fiabilite-service.ts:31`,
   `evaluateur.ts` groupBy `faitIntervenant: { in: [...] }`).
5. **La vue « reconduction » et la FICHE restent réservées aux
   sous-traitants.** `sous_traitant_incidents_repetes` construit ses cibles
   depuis `prisma.trainer.findMany({ where: { actif: true, statut:
   "sous_traitant" } })` (`evaluateur.ts:1554`) puis `continue` sur toute cible
   absente de la liste ; et `qualiopi/formateurs/[id]/page.tsx:193-198`
   n'affiche fiabilité ET incidents que si `trainer.statut ===
   "sous_traitant"`. Un dirigeant-formateur qui fait tomber trois sessions
   déclenchera bien `formateur_desiste_session` à chaque fois, mais **sa fiche
   restera vierge** et rien ne dira « trois faits en 24 mois ».
   ⚠️ Le motif écrit — « un salarié ne se reconduit pas » — vaut pour la
   *fiabilité* ; il ne justifie pas de masquer les *incidents*.
6. **`fiabiliteFormateur` n'entre dans aucune décision.** Un seul consommateur
   applicatif dans tout le dépôt : `qualiopi/formateurs/[id]/page.tsx:194`.
   Elle ne trie pas la liste des formateurs, n'alimente aucune alerte, n'apparaît
   pas à l'affectation. Le module l'assume (`fiabilite-service.ts:12-19`,
   décision Will du 2026-08-03 : « informe, ne décide pas ») — mais informer
   suppose qu'on ouvre la fiche.

Et, transversalement au § 1.3 et au § 1.4 : **aucune notification stagiaire**,
**aucun rapprochement entre les pièces vivantes et l'affectation courante**.

## 2. Le pilotage des COMMISSIONS

### 2.1 Il y a DEUX sujets « commission », et un seul est implémenté

**Sujet A — rémunération des formateurs : implémenté, et sérieusement.**
Le modèle `commission_ca_pct` est l'un des quatre `CompensationModel`
(`schema.prisma:4991-4996`), aux côtés de `taux_journalier`, `taux_horaire`,
`forfait_prestation`.

**Sujet B — commission d'apporteur d'affaires : PROMISE EN PUBLIC, ABSENTE DU
CODE MÉTIER.** C'est le résultat le plus important de cette partie, et il est
négatif.

`src/content/pricing.ts:836-897` porte le barème :
`COMMISSION_FORMATION_PAR_JOURNEE_EUR = 500` (`:820`), 30 % de la facture sur un
audit (`:889`), 15 % sur une intégration (`:896`). Il est affiché sur les pages
publiques `/devenir-commercial-ia`, `/apporteur-affaires-…`, `/memo-isere` et
les landings de recrutement. Les **seuls** consommateurs de ces constantes sont
des composants d'affichage :
`app/[locale]/devenir-commercial-ia/page.tsx:20`,
`app/[locale]/apporteur-affaires-independant-formation-ia-entreprise/page.tsx:49`,
`app/[locale]/memo-isere/page.tsx:74`,
`components/recrutement/FacebookLandingPage.tsx:65`,
`components/recrutement/PartenaireLandingPage.tsx:52`.

Et **rien d'autre n'existe** :

- `grep -i "apporteur|commission" prisma/schema.prisma` ne rend, hors du bloc
  formateur, qu'un seul champ : `JobOffer.isCommission` (`schema.prisma:8349`),
  un booléen d'annonce d'emploi ;
- **aucun modèle** ne rattache une vente à un apporteur ; **aucun calcul** ;
  **aucun paiement** ; **aucun rapprochement**.

**Conclusion à dire telle quelle : le sujet « commission d'apporteur d'affaires »
n'est pas implémenté dans ce dépôt.** S'il vit quelque part, c'est dans
`axion-partners`. Ce qui vit ICI, c'est une **promesse publique et chiffrée**
sans back-office pour l'honorer.

### 2.2 Les modèles Prisma — vérification avant appui

Comme exigé, chaque modèle a été vérifié dans `prisma/schema.prisma` :

| Modèle cité par les docs | Existe ? |
|---|---|
| `Invoice` | **NON** |
| `Refund` | **NON** |
| `Payment` | OUI — `schema.prisma:1567` |
| `FactureFormation` | OUI — `schema.prisma:6998` |
| `TrainerCompensationRule` | OUI — `:5052` |
| `TrainerFeeLine` | OUI — `:5084` |
| `TrainerStatement` | OUI — `:5140` |

`Payment.amountCents` (`:1580`) est bien un **encaissement**, sans champ HT :
c'est le piège TTC signalé. **Il ne se referme sur personne dans ce module**,
parce qu'aucun calcul de rémunération ne lit `Payment` — voir § 2.6.

### 2.3 L'assiette : HT, et le code le prouve

L'assiette de `commission_ca_pct` est `caBaseCents`
(`remuneration/calcul.ts:280`), lui-même issu de `repartirCa` sur
`prestation.caTotalCents` (`remuneration/run.ts:422`).

`caTotalCents` est alimenté en trois points, tous en `remuneration/statements.ts` :

| Source | Valeur | Ligne |
|---|---|---|
| Session de formation | `TrainingSession.montantHtCents` | `statements.ts:168` |
| Coaching 1-to-1 | `0` — « le CA d'un coaching vit sur le contrat, pas sur la séance » | `statements.ts:194` |
| Mission d'audit | `AuditMission.montantHtCents` | `statements.ts:218` |

**L'assiette est donc bien du HT.** Le piège TTC ne se referme pas ici. Et le
zéro du coaching n'est pas silencieux : il produit une anomalie nommée
`assiette_ca_absente` (`run.ts:491-497`), écrite en base sur la ligne
(`statements.ts:281`) et relisible par `listAnomaliesPeriode`
(`queries.ts:257`).

### 2.4 Le calcul

`calculerMontantCents` (`calcul.ts:266-283`) :
`commission_ca_pct` → `Math.round((caBaseCents * commissionPct) / 100)`.

Les invariants sont posés et **motivés dans le code** :

- **centimes entiers partout**, jamais de flottant persisté (`calcul.ts:7-8`) ;
- **barème versionné, jamais muté** : `effectiveFrom` inclus / `effectiveTo`
  exclu (`couvreDate`, `calcul.ts:125-130`), résolution du plus spécifique au
  plus général (`resolveRegle`, `:154`). Augmenter un taux en septembre ne
  recalcule pas juin ;
- **snapshot du barème sur la ligne** (`snapshotRegle`, `calcul.ts:363`), pour
  que le passé soit figé par la COPIE et non par une relecture ;
- **répartition entre co-animateurs sans perte de centime** : `repartirCa`
  (`calcul.ts:220-242`) `floor` les parts et verse le reliquat au premier ;
- **la NATURE découle du statut, pas du modèle** : `natureLigne`
  (`calcul.ts:114-118`) — un salarié produit une ligne `analytique`, jamais un
  dû ; seul le `sous_traitant` produit `honoraire_du`. Snapshotée, donc un
  changement de statut ne reclasse pas le passé.
- **absence de barème = anomalie, jamais montant inventé** : `bareme_absent`
  (`run.ts:466-475`), pas de ligne écrite.

### 2.5 La validation, et le paiement

Machine à états `StatementStatut` (`schema.prisma:5025-5040`) :
`brouillon → a_valider → valide → facture_recue → paye`, plus `annule`. La
matrice de transition est explicite (`run.ts:233-236`) et
`transitionStatementAction` (`actions/qualiopi/trainer-remuneration.ts:158`) la
fait respecter.

Les gardes dures, vérifiées :

- passer à `facture_recue` exige numéro, date **et** montant de la facture reçue
  (`trainer-remuneration.ts:185-194`) ;
- passer à `paye` exige que **le montant facturé soit égal au centime près au
  montant dû** — sinon refus explicite « Facture non conforme : X € TTC facturés
  contre Y € TTC dus » (`trainer-remuneration.ts:203-210`) ;
- `valide` **fige** les lignes (`FeeLineStatut.valide`) et le run mensuel
  n'efface plus que le non-`valide` (`trainer-remuneration.ts:243-247` et
  `statements.ts:394-400`) ; la redescente `valide → a_valider` **dégèle**, avec
  le motif écrit : sans ce dégel, le run suivant doublerait le montant du mois
  (`trainer-remuneration.ts:250-257`) ;
- le run est **sérialisé** par un `pg_advisory_xact_lock` par période
  (`statements.ts:359-363`) et **idempotent** ;
- le champ de saisie de la facture est en **euros**, pas en centimes — le
  commentaire raconte le défaut corrigé : « le formulaire demandait des centimes
  à un comptable », 1200 saisi enregistrait douze euros
  (`trainer-remuneration.ts:129-146`).

### 2.6 Le rapprochement : ce qui est rapproché, et ce qui ne l'est PAS

**Rapproché** : le relevé (ce que l'OF doit) contre la **facture d'honoraires
reçue du formateur** — égalité stricte des TTC avant paiement
(`trainer-remuneration.ts:207`). C'est le seul rapprochement du module, et il
est bon.

**PAS rapproché** — et c'est le trou : **rien ne relie la rémunération du
formateur à ce que le CLIENT a réellement payé.**

- L'assiette est `TrainingSession.montantHtCents` — le montant **vendu**
  (`statements.ts:168`) ;
- `FactureFormation` (`schema.prisma:6998`) et `Payment` (`:1567`) ne sont
  importés par **aucun** fichier de `src/server/qualiopi/remuneration/` ;
- le cockpit de marge lui-même compare `TrainingSession.montantHtCents` à la
  somme des `TrainerFeeLine.montantHtCents` (`remuneration/marge.ts:199`) —
  du CA **facturable**, jamais du CA **encaissé**. L'en-tête du module le dit
  (`marge.ts:5-7`) sans nommer la conséquence.

Conséquence, entièrement dans le code : **un sous-traitant peut être payé au
centime près sur une session que le client n'a jamais réglée.** Aucune garde,
aucune alerte, aucun écran ne croise les deux. Et pour un formateur au modèle
`commission_ca_pct`, la commission est due sur un chiffre d'affaires qui peut
n'être jamais entré.

### 2.7 Qui a le droit d'engager l'argent du formateur

`src/server/auth/habilitations.ts:53-79` énumère les **sept** actes engageants :
`contresigner`, `attester`, `conclure_devis`, `facturer`, `habiliter_formateur`,
`deposer_demande_financeur`, `revoquer_signature`. **Aucun ne couvre la
rémunération d'un formateur.**

Or `requireAdminWrite` autorise `super_admin, admin, responsable_qualite,
secretaire, editor` (`ROLES_ECRITURE`, `habilitations.ts:150-158`, via
`peutEcrire` `:161`).

Toutes les actions monétaires du module s'en contentent :

| Action | Garde | Ligne |
|---|---|---|
| `runRemunerationMensuelleAction` | `requireAdminWrite` | `trainer-remuneration.ts:66` |
| `transitionStatementAction` (dont `→ paye`) | `requireAdminWrite` | `:161` |
| `createCompensationRuleAction` (pose un taux) | `requireAdminWrite` | `:326` |
| `closeCompensationRuleAction` | `requireAdminWrite` | `:398` |

**Un compte `editor` peut donc créer le barème d'un formateur et marquer son
relevé « payé ».** Alors que le même `editor` ne peut ni émettre une facture ni
contresigner — parce que ces deux-là, eux, passent par `requireHabilitation`.
L'asymétrie est nette : le code protège l'argent qui ENTRE, pas celui qui SORT.

---

## 3. Les défauts trouvés, par gravité

Chacun porte son `chemin:ligne`, son tag, et le geste minimal.

### CRITIQUE

**D1 — `[code]` Une mission `acceptee` ORPHELINE éteint TROIS alertes
critiques.** `retirerMissionsEnAttente` ne retire que les `en_attente`
(`mission-formateur.ts:347`) ; `assignTrainerToSessionAction` supprime la ligne
`SessionFormateur` de l'ancien (`trainers.ts:707-713`) sans toucher à sa mission
`acceptee`. Trois règles lisent alors cette mission fantôme comme la preuve que
quelqu'un tient la place : `regleMissionFormateurSansReponseDelai`
(`evaluateur.ts:2967`), `regleMissionFormateurExpiree`, et **la toute nouvelle**
`regleFormateurDesisteSession` (`evaluateur.ts:3270`, test
`some((m) => m.trainerId !== desistantId)`). Une session peut démarrer sans
personne, **en silence**. → Croiser la mission `acceptee` avec l'existence d'une
ligne `SessionFormateur` du même `trainerId` ; ou, plus simple et plus sûr,
passer à `retiree` les missions `acceptee` des formateurs écartés dans
`assignTrainerToSessionAction`.
⚠️ **À signaler au chantier voisin AVANT sa fusion** : sa règle hérite du
défaut, elle ne le crée pas.

**D2 — `[code]` Un formateur peut être payé sur une session que le client n'a
jamais réglée.** Assiette = `TrainingSession.montantHtCents`
(`remuneration/statements.ts:168`) ; **aucun** fichier de
`src/server/qualiopi/remuneration/` n'importe `Payment` ni `FactureFormation`.
Le seul rapprochement du module oppose le relevé à la facture d'HONORAIRES du
formateur (`trainer-remuneration.ts:207`), jamais à l'encaissement du client.
→ Au minimum, afficher l'état d'encaissement sur l'écran du relevé et le DIRE
avant le passage à `paye`. **Ne rien verrouiller sans Will** : payer un
sous-traitant avant encaissement peut être une décision assumée — mais elle doit
être prise, pas subie.

**D3 — `[code]` Un `editor` peut créer un barème et marquer un relevé « payé ».**
`runRemunerationMensuelleAction` (`trainer-remuneration.ts:66`),
`transitionStatementAction` (`:161`), `createCompensationRuleAction` (`:326`),
`closeCompensationRuleAction` (`:398`) n'utilisent que `requireAdminWrite`, qui
autorise `editor` (`habilitations.ts:150-158`, via `peutEcrire` `:161`). Or
`facturer` est réservé à la direction (`habilitations.ts:243`) et la liste des
sept `ActeEngageant` (`habilitations.ts:53-79`) **n'en contient aucun pour la
rémunération d'un formateur**. Le code protège l'argent qui ENTRE, pas celui qui
SORT. → Ajouter un `ActeEngageant` (`remunerer_formateur`) ou étendre
`facturer`, et basculer ces quatre actions sur `requireHabilitation`.

### IMPORTANT

**D4 — `[code]` Trois faits d'incident sur cinq ne remontent nulle part.**
`IncidentFaitIntervenant` (`schema.prisma:7312`) porte `retard`,
`preuve_manquante`, `qualite_insuffisante` — aucune règle ne les lit. La
nouvelle `regleFormateurDesisteSession` filtre explicitement sur deux valeurs,
et `sous_traitant_incidents_repetes` compte les deux mêmes
(`fiabilite-service.ts:31`). → Décider ce que fait le système d'une preuve
manquante ou d'une qualité insuffisante : les compter dans la vue reconduction,
ou assumer par écrit qu'ils ne servent qu'à l'archive.

**D5 — `[code]` La fiche et la vue reconduction ignorent les formateurs non
sous-traitants.** `evaluateur.ts:1554` (cibles de
`sous_traitant_incidents_repetes`) et
`qualiopi/formateurs/[id]/page.tsx:193-198` (fiabilité ET incidents) filtrent
`statut: "sous_traitant"`. Un dirigeant-formateur qui fait tomber trois sessions
déclenche bien l'alerte à chaque fois, mais sa fiche reste vierge. → Afficher le
bloc incidents pour tous les statuts (le motif « un salarié ne se reconduit
pas » vaut pour la fiabilité, pas pour l'historique des faits).

**D6 — `[code]` Le remplacement détruit la trace de l'ancien formateur.**
`trainers.ts:707-713` supprime la ligne `SessionFormateur` avec `heuresAnimees`,
`tarifHtCents`, `convocationJ7EnvoyeeAt`, `rappelJ1EnvoyeAt`. Idem sur refus
(`mission-formateur.ts:634`) et sur `sans_reponse` (`:497`). Ne subsistent que
la ligne `MissionFormateur` et l'`AdminActivity`. → Même remède que celui appliqué
à `TrainerHabilitation` le 2026-08-17 (`schema.prisma:5677-5700` raconte
pourquoi) : retirer par une DATE, ne pas supprimer la ligne. Le raisonnement y
est déjà écrit — « supprimer détruisait la preuve de conformité d'une session
passée » — et il vaut mot pour mot ici.

**D7 — `[code]` La colonne `motifRetrait` d'habilitation n'est écrite par
personne.** Déclarée `schema.prisma:5702`, documentée « Écrit par l'humain qui
la retire », et `setTrainerHabilitationsAction` n'écrit que
`{ retireAt, retireById }` (`trainers.ts:356`). Aucune autre écriture dans le
dépôt. → Soit demander le motif au formulaire, soit retirer la colonne : une
colonne documentée mais toujours nulle fait croire à l'auditeur qu'on saura
répondre.

**D8 — `[code]` Un formateur désactivé reste principal sur ses sessions
futures.** `setTrainerActifAction` (`trainers.ts:555-564`) écrit un booléen ;
`grep "actif: false"` sur `evaluateur.ts` et `catalogue.ts` ne rend rien
(vérifié à 08:22). La garde `isTrainerHabilite` ne joue qu'à l'affectation
(`trainers.ts:657`). → Une règle qui croise `Trainer.actif = false` avec les
`sessionFormateurs` de sessions non terminées.

**D9 — `[code]` Aucune pièce n'est signalée quand la personne qu'elle nomme
disparaît.** La convocation (`templates/convocation.tsx:119`), la grille
(`producteurs.ts:774`), le livret (`:1121`) et la lettre de mission
(`documents.ts:1284`) nomment le formateur ; `annuleeAt` n'est écrit qu'à la
main (`documents.ts:2790`). Et le repli de `resolveFormateurNom`
(`producteurs.ts:118-122`) affiche la **raison sociale de l'organisme** à la
ligne « Formateur / Formatrice ». → Une règle « pièce vivante nommant un
formateur qui n'est plus affecté », et un repli explicite (« formateur à
désigner ») au lieu de la raison sociale.

**D10 — `[code]` Aucun stagiaire n'est prévenu d'un changement de formateur.**
`notifications/notifications-service.ts` ne mentionne « formateur » que dans un
commentaire (`:368-370`). → À arbitrer : faut-il prévenir ? Le code n'a pas
tranché, il n'a rien prévu.

### À SIGNALER — pas un défaut de code, un écart entre la promesse et l'outil

**D11 — `[code]` La commission d'apporteur d'affaires est publiée et chiffrée,
sans aucun back-office.** `content/pricing.ts:820` (500 €/journée), `:889`
(30 % de la facture d'audit), `:896` (15 % d'intégration), affichés sur les pages
publiques ; **aucun modèle, aucun calcul, aucun paiement, aucun rapprochement**
dans ce dépôt. Rien ne rattache une vente à un apporteur. → Ce n'est pas à
corriger dans `axion-ia` : c'est à **arbitrer** — le sujet vit-il dans
`axion-partners` ? En attendant, personne ne peut répondre « combien doit-on à
qui ce mois-ci ? » depuis cet outil.

**D12 — `[code]` Le mot « facture » de la promesse d'apporteur ne dit pas HT ou
TTC.** « 30 % de la facture » (`pricing.ts:889`), « 15 % de la facture »
(`:896`). Sur une facture assujettie à 20 %, l'écart entre les deux lectures est
de 20 % de la commission. C'est exactement le piège que le module formateur, lui,
a évité en nommant ses champs `montantHtCents`. → Écrire « HT » dans la copie
publique.

---

## 4. Ce que je n'ai PAS pu établir

1. **Rien n'a été observé à l'écran ni en base.** Je n'ai lancé ni test, ni
   typecheck, ni requête. Tous les constats sont des lectures de code.
2. **Aucun constat de DONNÉES.** Je ne sais pas combien de sessions ont un
   formateur, combien de `TrainerCompensationRule` existent en production,
   ni si un seul relevé y a jamais été émis. **Aucun défaut ci-dessus n'est
   tagué `[données]` — parce qu'aucun ne repose sur des données.** Si un chiffre
   est nécessaire pour arbitrer D2 ou D11, il reste à mesurer en prod.
3. **Le modèle `commission_ca_pct` est-il seulement utilisé ?** Le code le
   supporte ; je ne sais pas si un barème de ce type existe. Si aucun, D2 perd
   la moitié de sa portée (la commission au %) et garde l'autre (le paiement d'un
   forfait sur une session non encaissée).
4. **Je n'ai pas ouvert `axion-partners`.** Mon périmètre était ce dépôt.
   L'affirmation du § 2.1 est bornée : « pas implémenté **ici** ».
5. **Je n'ai pas vérifié les tests.** Les fichiers `.spec.ts` du module
   rémunération existent et sont nombreux (`calcul.spec.ts` 682 l.,
   `run.spec.ts` 1005 l., `statements.spec.ts` 517 l.) ; je ne les ai pas lus et
   ne les ai pas exécutés. **Je ne peux donc pas dire qu'une garde rougit.**
6. **L'arbre a bougé pendant l'audit, et il peut rebouger.** Le chantier voisin
   a atterri entre 08:11 et 08:14:44 ; tout ce qui touche `evaluateur.ts` a été
   re-vérifié après 08:20, mais **je ne peux rien affirmer de son état après
   08:25**. L'ancre durable est le nom de fonction, jamais le numéro de ligne.
   Les six lacunes du § 1.7 sont, elles, indépendantes de ce chantier — sauf D1,
   que ce chantier **étend** sans le savoir, et qu'il faut lui signaler avant
   fusion.
7. **Je n'ai pas relu ce que le chantier voisin écrit en ce moment ailleurs.**
   Je n'ai lu que `catalogue.ts` et `evaluateur.ts`. S'il touche aussi
   `mission-formateur.ts` ou les actions, mes citations de ces fichiers datent
   d'avant 08:15.
8. **Je n'ai pas suivi le chemin du coaching 1-to-1 ni celui des `AuditMission`
   jusqu'au bout.** Les trois types de prestation partagent `TrainerFeeLine`,
   mais je n'ai vérifié en détail que le chemin `formation_collective`.
