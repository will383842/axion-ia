# Audit — chaîne commerciale et OPCO (Lot 8)

**Date** : 15/08/2026 · **Étape 1** de `_SESSIONS/2026-08-15_REPRISE-NOUVELLE-CONVERSATION.md`
**Règle appliquée** : rien n'est affirmé ici sans avoir ouvert le fichier. Chaque constat porte sa
référence `fichier:ligne`. Aucun code écrit — c'est un audit, le plan vient après.

---

## 0. Périmètre réellement lu

| Domaine | Fichiers ouverts |
|---|---|
| Modèle de données | `prisma/schema.prisma` — `DossierFinancement` (7344), `DossierPayeur` (7400), `FactureFormation` (7421), `BaremeOpco` (8261), enums `FinancementType`/`OpcoStatut` (5890/5898), champs OPCO de `TrainingSession` (6040-6062) |
| Dossiers de financement | `financements/dossier-financement.ts` (intégral) |
| Validations bloquantes | `financements/validation-service.ts` (intégral) + appel réel `actions/qualiopi/sessions.ts:399-416` |
| Alertes | `alertes/catalogue.ts` (39 codes), `alertes/evaluateur.ts` — `regleOpco` (968), `regleConventionTripartite` (1033), `regleDossiersFinancement` (1539), `regleBaremeOpcoPerime` (1794), registre des règles (1880-1908) |
| Pipeline / vue Dossiers | `server/admin/dossiers-pipeline.ts:1-247` |
| Cockpit | `server/admin/pilotage-dashboard.ts:664-751` ; `qualiopi/previsionnel/calcul.ts:1-70` |
| Recouvrement | `financements/relance-paliers.ts`, `financements/relance-contexte.ts`, `actions/qualiopi/facturation-hub.ts:810-920`, cron `queue/workers/qualiopi-formation-crons-worker.ts:776-889` |
| Barèmes / calcul | `financements/opco-calcul.ts`, `financements/bareme-opco-service.ts`, `qualiopi/crm/devis.ts:86-131` |
| Devis | `actions/qualiopi/devis.ts:107-232`, `documents/templates/devis.tsx:147-305` |
| Pièces contractuelles | `templates/convention.tsx`, `templates/convention-tripartite.tsx`, `templates/kit-opco.tsx`, `templates/facture.tsx:329-333`, `financements/destinataire-facture.ts` |
| CGV / mentions | `src/content/legal.ts` (CGV FR intégrales, sections 157-530) |
| Parcours de vente | `qualiopi/vente/checklist.ts` (intégral) + son unique point de montage |
| Entrée client | `actions/qualiopi/clients.ts:145-330`, `actions/qualiopi/entrees.ts` |

---

## 1. Réponses aux quatre questions de l'étape 1

### Q1 — « Où meurt un dossier *en attente d'accord OPCO* aujourd'hui ? »

**Hypothèse du plan : « nulle part, donc invisible ». La réalité est plus précise, et plus gênante :
il ne meurt pas — il est rangé dans la colonne des affaires qui vont bien.**

Trois mécanismes existent, et chacun rate une partie du problème :

1. **La vue Dossiers ne connaît pas l'attente de financement avant la session.**
   `deriverStatutDossier` (`dossiers-pipeline.ts:194-247`) ne consulte le booléen
   `financementNonSolde` que dans la branche `realisee` (ligne 209-213). Une session `planifiee`
   dont l'OPCO n'a pas répondu retombe donc sur `signatureEnAttente ? "signature_attente" :
   "a_preparer"` (ligne 205) — **exactement la même case qu'une affaire dont l'argent est
   sécurisé**. Le plan de la vue est explicite : six colonnes, aucune ne dit « attente financeur ».

2. **Le suivi du dossier n'existe que si quelqu'un a créé le dossier à la main.**
   `creerDossierDepuisSession` (`dossier-financement.ts:130`) n'a **qu'un seul appelant** :
   `actions/qualiopi/facturation-hub.ts:499`, c'est-à-dire un bouton dans le hub facturation. Rien
   ne le déclenche à la création de la session ni à la conclusion de la convention. Or les deux
   alertes de suivi — « envoyé sans réponse +30 j » (`evaluateur.ts:1543`) et « paiement financeur
   en retard » (`evaluateur.ts:1566`) — portent **sur `DossierFinancement`**. Pas de dossier, pas
   d'alerte, pas de ligne au cockpit (`pilotage-dashboard.ts:671-716`). Le suivi est opt-in.

3. **L'alerte d'anticipation ne couvre pas le cas le plus courant.**
   `regleOpco` (`evaluateur.ts:968`) exige, en plus de `opcoStatut = non_demande`, la condition
   `OR: [{ opcoSubrogation: true }, { dossiersFinancement: { some: {} } }]` (lignes 983 et 1014).
   Cette garde a été posée pour une bonne raison (F56 : sans elle, toute session levait une alerte
   critique). Mais elle a un effet de bord : **une session `financementType = "opco"`, sans
   subrogation et sans dossier créé, ne lève rien — ni à J-7, ni au démarrage.**

**Ce qui, en revanche, fonctionne vraiment** : le blocage du démarrage. `transitionSessionAction`
(`sessions.ts:399-416`) refuse `en_cours` si une validation critique tombe, et
`validateOpcoAccord` (`validation-service.ts:110`) se déclenche sur `financementType === "opco"`
**sans** exiger la subrogation. Refus côté serveur, message explicite.

> **Le résumé opérationnel** : le système **empêche** de démarrer sans accord, mais ne **prévient**
> pas qu'il va l'empêcher. Le dossier reste rangé dans « À préparer » jusqu'au matin de la
> formation, où le bouton « démarrer » refuse. La faute est évitée ; la surprise, non.

### Q2 — « Qui dépose la demande de prise en charge ? »

Décision Will du 15/08 : **c'est nous, avec mandat écrit du client.**

**Constat : ce mandat n'existe dans aucune pièce.**

- `convention.tsx` : les 11 sections lues (objet, conditions financières §3 lignes 272-324,
  annulation, obligations, RGPD, PI, responsabilité, différends, annexes, signatures) ne
  contiennent **pas une occurrence** de « OPCO », « financeur », « subrogation » ou « mandat ».
- `src/content/legal.ts` (CGV) : **0 occurrence** de « subrog ». « OPCO » n'apparaît que dans la
  *procédure de réclamation* (ligne 1004), pour dire que le financeur peut être informé d'un litige.
- Seule mention approchante, dans la tripartite (`convention-tripartite.tsx:199-203`) : « En
  application de la subrogation de paiement, l'OPCO versera directement sa participation […]. Le
  solde restant à charge reste dû par le client. »

Cette phrase couvre le **reste à charge connu d'avance**. Elle ne dit rien du mandat de dépôt, ni
du refus, ni de la réduction, ni du non-paiement du financeur.

### Q3 — « Que se passe-t-il si l'OPCO refuse ou réduit ? »

**Juridiquement : le client reste débiteur. Contractuellement : rien ne le dit.**

Aucune clause, ni aux CGV ni à la convention, ne prévoit le report de la charge sur le client en cas
de refus, de réduction, de dossier incomplet, ou de non-paiement du financeur après accord. En
subrogation, la facture est libellée à l'OPCO (`destinataire-facture.ts:79-83`) — sans SIRET ni
adresse, ce qui est correct et documenté — mais **aucun texte ne permet de la réémettre au client**
si l'OPCO ne paie pas.

Techniquement le système sait faire (`DossierPayeur` gère N payeurs, `schema:7400`) ; c'est le
contrat qui manque.

### Q4 — Subrogation : conditions cumulatives et paiement sur pièces

**Bien couvert côté blocage, à moitié couvert côté pièce, pas couvert côté contrat.**

| Condition | État |
|---|---|
| Accord de l'OPCO avant l'action | ✅ bloquant (`validation-service.ts:110`, appliqué `sessions.ts:400`) |
| Convention tripartite signée avant l'action | ✅ bloquant (`validation-service.ts:137`) + alerte J-3 (`evaluateur.ts:1033`) |
| Accord de prise en charge écrit annexé | ✅ listé en annexe de la tripartite (`convention-tripartite.tsx:281-283`) |
| « L'OPCO ne paie que sur pièces » | ⚠️ le kit OPCO liste les pièces (`kit-opco.tsx:161-179`) mais **les cases sont des rectangles dessinés** (ligne 189) : le PDF n'indique pas si la pièce existe réellement en base |
| Que faire si le paiement n'arrive pas | ❌ aucune clause contractuelle (cf. Q3) |

---

## 2. Constats classés

### ✅ Ce qui est déjà là — ne pas le refaire

1. Modèle de données correct et déjà multi-payeurs : `DossierFinancement` + `DossierPayeur`
   (subrogation = une ligne OPCO + une ligne entreprise, `schema:7397-7416`).
2. Machine à états à verrou optimiste, transitions manuelles, aucun e-mail automatique
   (`dossier-financement.ts:20-91`) — cohérent avec la frontière « ce qui engage reste humain ».
3. Pont encaissement → dossier best-effort (`dossier-financement.ts:99`).
4. Blocage serveur du démarrage : OPCO, tripartite, CPF/EDOF, France Travail AIF/POEI
   (`validation-service.ts` + `sessions.ts:399`).
5. Deux alertes de suivi financeur + reprise au cockpit, mêmes règles des deux côtés
   (`evaluateur.ts:1539`, `pilotage-dashboard.ts:667-716`).
6. Échelle de relance J1→J60 avec mise en demeure, reste dû **net**, garde « créance éteinte »
   (`facturation-hub.ts:864-876`) et fraîcheur du pointage bancaire (`relance-contexte.ts:50-77`).
7. OPCO du client inféré d'IDCC puis NAF à la création (`clients.ts:165`).
8. Estimation de devis correctement encadrée : « indicative, non contractuelle — sous réserve de
   l'accord de prise en charge » (`devis.tsx:291-305`).

### 🔴 Trous — par ordre d'impact sur le chiffre d'affaires

**T1 — Le dossier de financement est optionnel, donc le suivi l'est aussi.**
Un seul appelant manuel (`facturation-hub.ts:499`). Aucun déclenchement à la conclusion de la
convention. Tout le suivi OPCO (alertes, cockpit, colonne « à solder ») en dépend.

**T2 — Aucune colonne « en attente d'accord financeur » dans la vue Dossiers.**
`dossiers-pipeline.ts:205` — l'attente de financement avant session est invisible.

**T3 — Le filet d'alerte OPCO exige la subrogation ; le blocage, non.**
Incohérence entre `evaluateur.ts:983/1014` (exige subrogation OU dossier) et
`validation-service.ts:111` (suffit `financementType = opco`). Résultat : on découvre le blocage au
moment de démarrer.

**T4 — En subrogation, la relance d'impayé part au mauvais débiteur.**
`facturation-hub.ts:855` : `to = input.to ?? facture.client?.contactEmail`. Ligne 909, le nom
affiché est celui du client. Le `select` (lignes 831-851) ne lit **ni** `destinataire`, **ni**
`subrogation`, **ni** `numeroDossierOpco`, et l'e-mail du gestionnaire existe pourtant
(`DossierFinancement.financeurContactEmail`, `schema:7356`). Le cron ne filtre pas non plus sur le
destinataire (`worker:780-804`). **Une mise en demeure au ton « avant contentieux », avec pénalités
L.441-10, peut donc partir à un client qui ne doit rien sur cette facture.** C'est la version
symétrique de la faute que `relance-contexte.ts` a été écrit pour éviter.

**T5 — Aucune clause OPCO dans les pièces contractuelles.** (cf. Q2/Q3.) Manquent : mandat de
dépôt, refus/réduction → client débiteur, non-paiement du financeur → report sur le client,
conditions cumulatives de la subrogation.

**T6 — La convention TRIPARTITE est restée à la version d'avant le 02/08.**
La bipartite a reçu ce jour-là les trois mentions exigées par L.6353-1 — moyens pédagogiques, suivi
de l'exécution et évaluation, sanction de la formation (`convention.tsx:251-268`) — puis les
sections 5 à 9 (obligations, RGPD, PI, responsabilité, droit applicable, lignes 368-451). **La
tripartite n'a reçu ni les unes ni les autres** : son type `ConventionTripartiteData`
(`convention-tripartite.tsx:28-75`) ne porte même pas les champs, et son corps s'arrête à
« 4. Annulation » puis annexes et signatures. Elle invoque pourtant L.6353-1 en tête
(`ligne 157`). **C'est la pièce que lit l'OPCO, et c'est la moins complète des deux.**

**T7 — L'estimation OPCO retombe sur le barème Atlas pour tous les OPCO.**
`crm/devis.ts:87-115` : les tarifs `opco_atlas_*` sont la base ; le barème central ne prime que
« champ par champ s'il est renseigné » (ligne 103). Or `BaremeOpco` est **livrée vide** par
construction (`schema:8259` : « structure livrée VIDE, tous les plafonds nullable »). Tant qu'aucun
relevé n'est saisi, un client relevant d'Akto ou d'Uniformation reçoit une estimation calculée aux
tarifs **Atlas**. Et l'alerte `bareme_opco_perime` (`evaluateur.ts:1794`) ne balaie que les lignes
existantes : **zéro ligne = zéro alerte**. Rien ne signale qu'aucun barème n'a jamais été relevé —
c'est le motif « une garde ne vaut que si elle rougit ».

**T8 — L'estimation s'imprime sans garde de certification.**
`createDevisAction` (`devis.ts:159-182`) calcule et enregistre `montantOpcoEstimeCents` sans
consulter `isQualiopiCertificationObtenue()`. L'avertissement existe
(`validate­FinancementMutualiseSansCertification`, `validation-service.ts:87`) mais il est
non bloquant **et il vit sur la page financement d'une session** — donc après le devis. Tant que le
certificat n'est pas délivré, un devis peut porter « Prise en charge estimée : X € » pour un
financement légalement inaccessible (L.6316-1). Même défaut que le drapeau prod, un étage plus bas.

**T9 — La checklist des pièces par financement n'existe que dans le tunnel de vente.**
`construireChecklistVente` (`vente/checklist.ts:212`) n'a qu'un point de montage :
`components/admin/qualiopi/VenteWizard.tsx`, lui-même monté uniquement sur
`/qualiopi/vente/new`. Une affaire reprise le lendemain n'a plus de checklist. Pour l'objectif
« n'importe quelle secrétaire gère le système », c'est le manque le plus structurant du lot.
À noter aussi : la table `PIECES_PAR_FINANCEMENT` (ligne 84) ne comporte **aucun item pour le
dossier de financement lui-même** — le kit OPCO est une pièce, la demande de prise en charge n'est
pas une étape.

### ⚠️ Mineurs, mais à ne pas perdre

- **T10** — Le kit OPCO n'est pas dérivé de la réalité : cases vides dessinées (`kit-opco.tsx:189`),
  sans vérifier que convention, émargements, certificat et facture existent. « Le dossier Qualiopi
  devient le dossier de trésorerie » n'est pas encore vrai.
- **T11** — `catch { financementEntries = [] }` (`sessions.ts:404`) : une erreur de lecture ouvre
  la garde de démarrage. Fail-soft sur un contrôle bloquant.
- **T12** — Le prévisionnel compte 100 % du CA des sessions planifiées
  (`previsionnel/calcul.ts:6-8`) sans distinguer celles dont le financement n'est pas accordé.
- **T13** — Aucune trace de la **date d'accord écrit** distincte de `accordAt` (horodatage de la
  saisie) : en cas de contrôle, « accord reçu **avant** l'action » se prouve par la pièce, pas par
  le clic. La pièce n'est pas exigée à la transition (`dossier-financement.ts:55-91`).

---

## 3. Ce qui relève d'une décision de Will (à trancher avant d'écrire une ligne)

1. **Clause de mandat** — texte du mandat de dépôt, et refus explicite de toute promesse d'issue
   (« nous déposons, l'OPCO décide »). À rédiger, puis à faire relire par l'avocat **en même temps**
   que les CGV renforcées qui l'attendent déjà.
2. **Clause de refus/réduction** — formulation du maintien de la dette client. Convention **et**
   CGV : les deux, sinon la clause s'interprète contre le rédacteur (art. 1190 C. civ. — argument
   déjà retenu au dossier CGV du 14/08).
3. **Clause de subrogation** — conditions cumulatives + défaut de paiement du financeur → report.
4. **Politique de relance financeur** : à quel délai relance-t-on un OPCO silencieux (le seuil codé
   est 30 jours), par quel canal, et qui signe la relance.
5. **Barèmes à relever en priorité** : quels OPCO réels des premiers clients (le fallback Atlas
   n'est acceptable que pour Atlas).
6. ⛔ **Rappel non négociable, inchangé** : aucune promesse de financement dans le produit tant que
   NDA et certificat manquent. Une estimation se formule comme une estimation — c'est déjà le cas
   sur le PDF, ça ne l'est pas sur la condition d'accès (T8).

---

## 4. Découpage proposé du Lot 8 (à exécuter après arbitrage, pas maintenant)

| Sous-lot | Contenu | Dépend de | Effort |
|---|---|---|---|
| **8A — Contrats** | Clauses mandat / refus-réduction / subrogation / défaut financeur, dans CGV **et** convention **et** tripartite | décisions 1-3 + avocat | 0,5 j de code après validation du texte |
| **8B — Tripartite au niveau de la bipartite** | 3 mentions L.6353-1 + sections 5→9, champs ajoutés au type | — | 0,5 j |
| **8C — Le dossier n'est plus optionnel** | Création du `DossierFinancement` au moment où le financement est déclaré ; item « demande de prise en charge » dans la checklist | — | 1 j |
| **8D — Rendre l'attente visible** | Colonne « Attente financeur » dans la vue Dossiers + alignement `regleOpco` sur `financementType` (T3) | 8C | 0,5 j |
| **8E — Relance au bon débiteur** | Destinataire dérivé de `destinataire`/subrogation, e-mail du gestionnaire, refus de relancer un client sur une facture OPCO | — | 0,5 j |
| **8F — Barèmes** | Écran de saisie des relevés + alerte « aucun barème relevé pour l'OPCO X » + retrait du fallback Atlas silencieux (nommer la source de l'estimation) | décision 5 | 1 j |
| **8G — Garde de certification sur l'estimation** | `createDevisAction` refuse/annote l'estimation mutualisée tant que le certificat manque | — | 0,25 j |
| **8H — Checklist persistante** | Sortir la checklist du wizard, la monter sur la fiche session/affaire | — | 0,5 j (⚠️ recoupe le Lot 1 du plan console) |

**Total ≈ 4,75 j**, dont 8A bloqué par l'avocat.

---

## 5. Ce que cet audit ajoute au plan console

Conformément à la règle qui a motivé la séparation, voici les exigences que le Lot 8 impose au plan
console — et qui auraient obligé à le refaire s'il avait été exécuté d'abord :

1. **Le hub d'affaire doit porter un état de financement** (Lot 1 / Lot 2) : « accord obtenu /
   demandé le / refusé », pas seulement des pièces.
2. **La checklist du Lot 1 et celle du tunnel de vente sont la même chose** (T9) — il faut une
   seule implémentation, sinon deux vérités divergeront.
3. **La vue Dossiers gagne une septième colonne** (T2) : le Lot 4 (perf) doit en tenir compte dans
   ses mesures de rendu.
4. **Le Lot 10 (rôles) hérite d'un interdit supplémentaire** : déposer une demande de prise en
   charge engage l'organisme au nom du client (mandat) — c'est un acte habilité, pas une tâche de
   saisie.
