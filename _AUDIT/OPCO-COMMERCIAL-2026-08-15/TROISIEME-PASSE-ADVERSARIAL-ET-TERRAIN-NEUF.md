# Troisième passe — réfutation de J1-J4 et trois terrains neufs

**Date** : 15/08/2026, 3ᵉ passage · **Méthode** : lecture de code, tentative de RÉFUTATION d'abord.
**Cible** : `_AUDIT/2026-08-15_AUDIT-SCALABILITE-100-FORMATEURS.md` (défauts de justesse J1→J4).

**Résultat : 3 survivants sur 4.** J2 tombe. J1 survit amputé de sa moitié la plus grave.

---

# PARTIE 1 — Adversarial sur J1 → J4

## J1 — « Un PDF de facture peut porter le numéro d'un autre client » → **SURVIT, amputé**

### Ce qui résiste

Le mécanisme est réel et je n'ai pas pu le réfuter. Dans `facturation-service.ts`, la boucle
`for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)` (`:238`) contient, dans cet ordre :

1. `nextNumero("facture", …)` — allocation (`:247`) ;
2. `generateDocument({ type: "facture", … })` — **rendu PDF + écriture `DocumentGenere` + upload R2**
   (`:296-301`) ;
3. `prisma.factureFormation.create(…)` (`:308`) ;
4. sur P2002, `continue` (`:346`) — **qui repart au 1., sans rien défaire du 2.**

Le `DocumentGenere` du tour perdu reste en base. Et il est **visible** : la fiche session le liste
par `where: { sessionId: id }` sans exclure les orphelins
(`sessions/[id]/page.tsx:268-269`). Deux PDF téléchargeables, deux numéros `AXI-FACT`, un seul au
registre comptable.

### Ce qui tombe — la « fuite inter-clients »

**Réfuté.** L'orphelin porte les données du **bon** client : `resoudreDestinataireFacture` est appelé
**avant** la boucle (`:159-162`), et `factureData.client` (`:268-272`) est reconstruit à l'identique
à chaque tour. Le PDF orphelin de la session de A contient l'identité de A. Ce qui est faux, c'est le
**numéro**, pas le destinataire. Aucun client ne voit les données d'un autre par ce chemin.

La qualification correcte est : **deux pièces portant deux numéros de la série légale pour une seule
facture inscrite aux livres** — irrégularité art. 242 nonies A (numéro attribué à une pièce absente
du registre), pas fuite de données.

### Ce qui tombe aussi — « dès ~6 émissions simultanées, erreur 500 »

**Réfuté comme seuil.** `withNumberRetry` relance la closure **entière** (`retry.ts:38-48`), et
`nextNumero` relit `MAX(séquence)` à chaque tour (`allocate.ts:111`, appelé depuis
`facturation-service.ts:247` **dans** la boucle). Le module documente explicitement cette
convergence (`allocate.ts:25-28`) : le maximum progresse dès qu'une insertion concurrente aboutit.

Un acteur n'échoue donc qu'après avoir perdu **5 tours consécutifs** — un entrelacement adverse
parfait, pas « 6 émissions simultanées ». À 6 acteurs concurrents, l'issue nominale est : **tous
réussissent, en laissant jusqu'à 5 PDF orphelins**. Le défaut n'est pas l'erreur 500, c'est la
traînée d'orphelins — ce qui rend le correctif proposé (rendre le PDF **après** la transaction)
d'autant plus juste.

> **Verdict** : confirmé sur le mécanisme et sur la conséquence comptable ; réfuté sur la fuite
> inter-clients et sur le seuil.

## J2 — « Les indicateurs 4, 8 et 30 afficheront un chiffre FAUX » → **RÉFUTÉ**

### La citation ne correspond à rien dans le fichier

`conformite-service.ts` ne contient **aucun `take: 2000`**. Ses deux seuls `take` sont
**`take: 200`**, lignes **171** et **196**, tous deux sur `prisma.formation.findMany` — ils bornent
le **catalogue de formations** (22 aujourd'hui), qui ne croît pas avec les inscriptions.

Recherche sur tout `src/` : les deux seules occurrences de `take: 2000` sont
`satisfaction/synthese-service.ts:201` et `content-similarity-monitor-worker.ts:79`. Ni l'une ni
l'autre n'est dans `conformite-service.ts`.

### Et les trois indicateurs sont calculés par des agrégats SQL exacts

| Ind. | Entrée | Source | Verdict |
|---|---|---|---|
| off.8 | `nbEvaluationsInitiales` | `prisma.evaluationAcquis.count({ where: { type: "initiale" } })` — `:137` | `nbEvaluationsInitiales > 0` (`:528`) |
| off.4 | `nbPositionnementsBesoin` | `prisma.questionnaire.count({ where: { type: "positionnement", reponduAt: { not: null } } })` — `:257` | `nbFormations > 0 && nbPositionnementsBesoin > 0` (`:490`) |
| off.30 | `nbAppreciations` / `nbAppreciationSourcesDistinctes` | `prisma.appreciation.count()` — `:140` · `prisma.appreciation.groupBy({ by: ["source"] })` — `:253` | `nbAppreciationSourcesDistinctes >= 2` (`:787`) |

Le fichier compte **37 `.count(`** pour **3 `findMany`**. Et les verdicts sont des **seuils booléens**
(`> 0`, `>= 2`) : même une troncature ne pourrait pas les faire basculer à 60 000 inscriptions,
puisque les valeurs sont alors très au-dessus du seuil. Le `groupBy` sur `source` rend au plus
4 lignes — les 4 sources de l'énumération.

### Le grain de vérité, ailleurs

Deux constats réels que J2 vise mal :

1. **`satisfaction/synthese-service.ts:201`** — `take: 2000`, mais **avec** `orderBy: { reponduAt: "desc" }`
   (`:200`), donc déterministe, contrairement à ce qu'affirme J2. Reste que les moyennes de
   satisfaction sont calculées sur les **2 000 réponses les plus récentes** : à 60 000 inscriptions,
   c'est une fenêtre glissante silencieuse. **C'est un vrai défaut — à réécrire sur le bon fichier.**
2. **`MAX_LIGNES_FINANCES = 5000`** (`pilotage-dashboard.ts:347`) existe bien, appliqué en `:356,
   :386, :391, :446, :455`. Mais il ne borne que **coaching et missions d'audit**, sommés en JS. Le
   CA principal, lui, vient de `formations._sum.montantHtCents + audits._sum.montantHtCents`
   (`:340`) — un **agrégat SQL exact**. « Chiffre d'affaires sous-déclaré » ne vaut donc pas pour le
   CA formation, celui qui suit les 100 formateurs.

> **Verdict** : réfuté sur le fichier, sur les lignes, sur l'objet et sur la conséquence. À
> reformuler entièrement autour de `synthese-service.ts:201`.

## J3 — « Deux attestations pour la même session, toutes deux vérifiables » → **SURVIT**

Réfutation tentée sur trois angles, tous échoués :

1. **Un verrou côté cron ?** Non. `handleAttestationsAuto` fait un `findMany` sur
   `attestationGenereeAt: null` (`crons-worker.ts:379`) puis
   `for (…) await genererAttestationPourEnrollment(id)` (`:396-398`) — **aucune revendication
   atomique**, contrairement au patron `updateMany`-claim qui existe pourtant dans le dépôt
   (`notifications-service.ts:628-632`).
2. **Une contrainte en base ?** Non. Le commentaire cité (`schema.prisma:6671`) est exact — mais il
   porte sur `DocumentGenere`, où l'absence de `@@unique(session,type)` est **délibérée et correcte**
   (attestation et certificat sont par stagiaire). Le point juste est ailleurs : **rien ne contraint
   `Enrollment.attestationGenereeAt`**.
3. **Une fenêtre trop étroite pour être atteinte ?** Non. La lecture est en `:135`, l'écriture en
   `:415-421`, et le rendu `@react-pdf/renderer` est entre les deux.

**Correction de formulation** : le doublon est par **inscription** (`Enrollment`), pas « pour la même
session ». Le chemin réaliste est le cron de 09:00 croisant un clic manuel, pas deux crons — le
worker est unique et séquentiel.

> **Verdict** : confirmé.

## J4 — « La convocation peut être perdue, ou envoyée en double » → **SURVIT, et est sous-estimé**

L'asymétrie est exacte, et je l'ai vérifiée ligne à ligne :

| Envoi | jobId | clé de date |
|---|---|---|
| **convocation** | `qualiopi-convocation-${enrollmentId}` (`notifications-service.ts:171`) | ❌ **aucune** |
| rappel J-7 | `…-${enrollment.id}-${dk}` (`:245`) | ✅ |
| satisfaction J+1 | `…-${enrollmentId}-${dk}` (`:307`) | ✅ |
| suivi J+30 | `…-${enrollmentId}-${dk}` (`:358`) | ✅ |
| enquête entreprise | `…-${sessionId}-${dk}` (`:608`) | ✅ |

Et le cron sélectionne bien sur une fenêtre `[now+4,5 j, now+5,5 j]` (`crons-worker.ts:694-701`)
**sans aucune colonne d'état**.

**Deux précisions qui aggravent le constat :**

- La rétention n'est pas seulement `count: 1000` : c'est
  `removeOnComplete: { age: 7 * 24 * 3600, count: 1000 }` (`queues.ts:49`). La déduplication expire
  donc au **min(7 jours, 1 000 jobs)** — le plafond d'âge mord **même à faible volume**.
- La moitié « **perdue** » est la plus grave, et J4 la mentionne sans l'appuyer : **sans colonne
  d'état, une exécution manquée est définitivement manquée.** Un déploiement, un redémarrage worker
  ou une coupure Redis pendant la fenêtre quotidienne, et la convocation réglementaire (off.9) n'est
  jamais envoyée — rien ne la rattrape, rien ne la signale.
- `attestation-disponible` (`:427`) partage le même défaut de jobId sans date. Sans portée
  réglementaire, mais le correctif est le même.

> **Verdict** : confirmé, et à durcir.

### Récapitulatif de la passe adversariale

| Défaut | Verdict | Ce qui change |
|---|---|---|
| **J1** | ⚠️ **survit amputé** | fuite inter-clients **réfutée** · seuil « 6 émissions » **réfuté** · irrégularité comptable **confirmée** |
| **J2** | ❌ **tombe** | mauvais fichier, mauvaises lignes, indicateurs calculés par `count()`/`groupBy` exacts · salvage : `synthese-service.ts:201` |
| **J3** | ✅ **confirmé** | doublon par **inscription**, pas par session |
| **J4** | ✅ **confirmé et aggravé** | `age: 7 j` en plus du `count` · la perte prime sur le doublon |

---

# PARTIE 2 — Terrain neuf

## A. Rôles et habilitations — qui peut faire quoi **côté serveur**

### Il n'existe que quatre rôles, et un seul verrou d'engagement

`actions/qualiopi/_guards.ts:19-34` **ré-exporte** les gardes de la Knowledge Base sans en ajouter
aucune. Son en-tête l'assume (`:4-7`) : « Réutilise les guards RBAC de la Knowledge Base […] **AUCUN
nouveau rôle NextAuth** ». Les rôles sont donc `super_admin | admin | editor | reader`, et
`requireAdminWrite` autorise **les trois premiers** (`knowledge/_guards.ts:27-33`).

⚠️ Au passage : `requireAdminWrite` est **redéfini à l'identique dans quatre modules**
(`site-explorer/_guards.ts:22`, `backups/_guards.ts:22`, `knowledge/_guards.ts:27`,
`intervention-documents/_guards.ts:22`) — 27 définitions de gardes `require*` au total dans `src/`.
Il n'y a pas de SSOT d'autorisation ; il y a un patron recopié.

Répartition dans `src/server/actions/qualiopi/*.ts` :

| Garde | Occurrences | Rôles admis |
|---|---|---|
| `requireAdminWrite` | **311** | super_admin, admin, **editor** |
| `requireAdminDelete` | 29 | super_admin |
| `requireAdminPublish` | 23 | super_admin, admin |
| `requireSuperAdmin` | 11 | super_admin |
| `requireAdminRead` | 10 | + reader |

### La matrice du Lot 10, confrontée au code

Le plan demande de vérifier si l'exclusion de l'`editor` sur la contresignature « est appliquée
partout ou seulement là ». **Réponse : seulement là.**

L'unique expression serveur de la frontière « engage l'organisme » est
`ROLES_ADMIN_HABILITES = new Set(["super_admin", "admin"])`
(`documents/signature/document-signature-service.ts:597`), avec **un seul site d'appel** :
`habiliter()` (`:475-484`), qui vérifie aussi `status === "active"`. La constante n'est pas exportée.

Confrontation avec les cinq interdits du Lot 10 :

| Acte que le Lot 10 déclare non délégable | Garde réelle | `editor` peut ? |
|---|---|---|
| Contresigner (convention, lettre de mission) | `ROLES_ADMIN_HABILITES` (`document-signature-service.ts:480`) | ❌ **non** — le seul verrou qui tient |
| **Émettre une attestation** | `requireAdminWrite` (`evaluations.ts:141`) | ✅ **oui** |
| **Conclure un devis** | `requireAdminWrite` (`devis.ts:653`) | ✅ **oui** |
| **Émettre une facture** | `requireAdminWrite` (`facturation-hub.ts:79`) | ✅ **oui** |
| **Habiliter un formateur** | `requireAdminWrite` (`trainers.ts:286`, `setTrainerHabilitationsAction`) | ✅ **oui** |

S'y ajoute `verifierSousTraitantAction` (`financements.ts:688`), également `requireAdminWrite`, qui
pose `sousTraitantVerifieAt` — **la clé qui débloque `validateSousTraitant`**
(`validation-service.ts:259-269`) et autorise un sous-traitant à être formateur principal.

> 🔴 **Conclusion** : la matrice du Lot 10 est aujourd'hui appliquée sur **1 ligne sur 5**. Un compte
> `editor` peut attester, facturer, conclure et habiliter. Et comme il n'existe ni rôle
> « secrétaire » ni rôle « responsable qualité », la matrice n'est pas seulement non appliquée :
> elle n'est pas **exprimable** sans créer des rôles. C'est le préalable du Lot 10, et c'est aussi
> ce qui bloque le Lot 14 (destinataire dérivé) et le Lot 15 (parcours par rôle).

## B. La flotte de formateurs à la cible 100

### Ce qui tient déjà — solide

- **`TrainerHabilitation`** (`schema.prisma:6290-6304`) : table dédiée, `@@unique([trainerId,
  formationId])`, avec `habiliteAt` **et** `habiliteById` — la traçabilité qu'exigent les
  ind. 21/22 existe.
- **`isTrainerHabilite`** (`trainers/trainers.ts:130-150`) : fonction pure, trois règles — actif,
  habilité sur CETTE formation, et sous-traitant vérifié. Appliquée **côté serveur** à
  l'assignation, avec refus explicite (`actions/qualiopi/trainers.ts:605-612`).
- L'en-tête `trainers.ts:103-110` documente un défaut déjà payé et corrigé : la colonne legacy
  `formationsHabilitees` contenait des **slugs** quand la garde compare des **UUID** — donc
  « 33 habilitations » affichées, zéro vues par la garde. **Ne jamais dériver l'habilitation d'autre
  chose que `TrainerHabilitation`.**
- **`SessionFormateur`** : jointure normalisée, un seul `principal` par session garanti par un index
  partiel SQL, `tarifHtCents` snapshoté à l'affectation (`schema.prisma:6383` et suivantes).
- Dual-write transactionnel `formateurPrincipalId` ↔ `SessionFormateur`
  (`actions/qualiopi/trainers.ts:616-625`).

### 🔴 Le défaut de la flotte : la double-affectation est **détectée, jamais empêchée**

La note de reprise affirmait « la double-affectation n'est pas détectée ». **C'est inexact, et la
réalité est plus perverse** : la détection existe.

`getTrainerConflicts(trainerId, cible)` (`features/admin-planning/queries.ts:324`) lit les autres
prestations qui **chevauchent** la cible, sur une fenêtre ± 1 jour. Son propre commentaire pose le
diagnostic (`:317-321`) : « *Rien n'empêchait jusqu'ici d'affecter un formateur à deux prestations
simultanées : la garde `isTrainerHabilite` ne vérifie que l'habilitation, jamais la disponibilité.
Cette lecture alimente l'alerte de la fiche 360°.* »

Or cette fonction a **exactement un appelant** :
`(admin)/[adminPrefix]/planning/[type]/[id]/page.tsx:102` — **une page de détail**.

Donc : le conflit s'affiche à qui ouvre la fiche du planning, **après** l'affectation, et
l'affectation elle-même ne le consulte jamais (`actions/qualiopi/trainers.ts:605-612` ne teste que
l'habilitation). À un formateur, on ouvre la fiche. À cent, personne ne l'ouvre.

> **Formulation juste** : *le conflit est visible sur une page que personne n'ouvrira à cent
> formateurs, et invisible là où la décision se prend.* Le correctif est court : appeler
> `getTrainerConflicts` dans l'action d'assignation et refuser (ou exiger une confirmation motivée).

### Le second manque : `TrainerAvailability` ne connaît que le déclaré

`TrainerAvailability` (`schema.prisma:6323-6342`) ne porte que `conge | maladie |
formation_interne | indisponible` (`:6307-6312`), en bornes **jour** inclusives. Une session animée
n'y figure pas. La disponibilité réelle d'un formateur est donc la **différence** entre deux tables
qu'aucune requête ne rapproche à l'affectation.

### Ce qui manquera à 100 et n'existe pas

- **Aucun index sur la charge** : `Trainer` porte `statut`, `actif`, `region`, `rcProEcheanceAt`,
  `sousTraitantProchaineVerifAt` (`schema.prisma:6247-6253`) — rien qui réponde à « qui est libre la
  semaine du 12 ? ».
- La vue « mes 100 formateurs sont-ils tous habilités, sous contrat, à jour de leur veille ? »
  n'existe sous aucune forme agrégée : les pièces sont sur la fiche individuelle
  (`TrainerDocument`, `schema.prisma:5833`) et les alertes tombent une par une
  (`evaluateur.ts` : `cv_formateur_perime`, `sous_traitant_rc_pro_expiree`, etc.).

## C. Le portail entreprise — ce qui existe vraiment, et le cloisonnement

### Vérification : il n'existe pas, et le modèle d'accès est verrouillé sur le stagiaire

`PortailAcces` (`schema.prisma:8088-8100`) porte **`traineeId`** en FK obligatoire, avec
`onDelete: Cascade` sur `Trainee`. Il n'y a **ni `clientId`, ni `contactId`**. Les routes sous
`src/app/[locale]/portail/` sont : `acces`, `acces-invalide`, `demander-acces`, `emarger`, `enquete`,
`mon-espace`, `signer` — toutes stagiaire, à une exception.

### L'exception, qui est le bon point de départ

`portail/enquete/[token]` est la **seule** surface déjà destinée à l'entreprise. Elle n'utilise pas
`PortailAcces` : elle résout `prisma.questionnaire.findUnique({ where: { token } })`
(`portail/enquete/[token]/page.tsx:42-43`), et son commentaire porte déjà la règle de cloisonnement
qu'il faudra généraliser (`:40-41`) :

> « *Jeton inconnu ou d'un AUTRE type de questionnaire → 404, sans détail : un jeton stagiaire ne
> doit jamais ouvrir le formulaire entreprise.* »

C'est exactement le principe à étendre : **un jeton porte un périmètre, et un périmètre ne se déduit
jamais du porteur**.

### Le cloisonnement RGPD, tel que le code l'impose déjà

Le point dur n'est pas l'accès, c'est ce que l'entreprise **ne doit pas** voir. `Appreciation`
(`schema.prisma:8104-8116`) porte à la fois `source`, `traineeId` **et** `clientId`, plus `note` et
`commentaire`. Un portail entreprise naïf qui filtrerait sur `clientId` exposerait donc les
**appréciations nominatives des salariés**, commentaire libre inclus.

Or l'indicateur 30 repose sur la sincérité de ces retours : un salarié qui sait son employeur lecteur
ne répond plus librement. **Agrégé oui, nominatif non** — et la garde doit être écrite dans la
requête, pas dans l'écran.

### Ce qu'il faudrait, minimalement

1. Un modèle d'accès **jumeau** de `PortailAcces`, rattaché au **contact** du client (pas à
   l'entreprise en général) — le patron d'entropie existe et est bon :
   `randomBytes(32)` + `timingSafeEqual` + unicité DB.
2. Un périmètre **écrit** : sessions du client, pièces contractuelles, factures et reste à charge,
   avancement des stagiaires **en agrégé**.
3. Une garde de non-exposition testée par un **test négatif** : un jeton entreprise qui atteint une
   `Appreciation` nominative = rouge.
4. Le lien avec le Lot 8 est direct : en subrogation, l'OPCO ne paie **que sur pièces**. Un espace où
   le client récupère ses pièces seul raccourcit le délai d'encaissement — c'est le seul argument de
   trésorerie du lot.

---

## Ce que cette passe n'a pas fait

- **Aucune mesure exécutée**, comme les deux passes précédentes. Les verdicts J1/J3/J4 portent sur
  des chemins de code, pas sur des incidents observés en production.
- Je n'ai pas rejoué les autres constats de l'audit de scalabilité (S1→S6, partie 3) : la consigne
  portait sur J1→J4.
- La flotte : je n'ai pas ouvert `TrainerDocument` ni `fiabilite-service.ts` ligne à ligne — seuls
  leur existence et leur périmètre sont établis ici.
