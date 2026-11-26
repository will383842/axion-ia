VERDICT: À CORRIGER

# Relecture de la PR #2344 — `feat/apporteurs-presentations-regle-rdv`

Relu : `git diff origin/main...origin/feat/apporteurs-presentations-regle-rdv` (commits `034e17dee`, `8d9c9182e`).
Quatre fichiers : `passage-quotidien.ts`, `regle-attribution.ts` et deux specs.

Tests : `vitest run` sur `bascule-ancienne-regle-vers-rendez-vous.spec.ts` et `passage-rendez-vous.spec.ts`,
**65/65 verts**. `pnpm install --frozen-lockfile` n'a pas pu tourner dans cet environnement
(`node_modules/.bin` en lecture seule, EROFS). Les tests ont été lancés avec le `vitest` déjà installé.

Points solides : la décision est une fonction pure et testée. La garde est relue dans la transaction,
avec repli sur P2002. Une présentation `confirmee` n'est jamais lue et la présentation elle-même n'est
jamais modifiée. Le rejeu est idempotent (la ligne de réservation fait foi). La table absente (P2021) est
tolérée. L'étape tourne avant la confirmation tacite, et rien ne bascule quand l'interrupteur est éteint.
Le défaut bloquant est juridique, pas technique.

## Constats

### 1. 🔴 BLOQUANT : la bascule contredit l'article 13.5 du contrat 2.8 que l'apporteur a signé

- **Code** : `src/features/apporteurs-reseau/regle-attribution.ts:96-118` (`basculeVersRendezVous`) et
  `src/features/apporteurs-reseau/passage-quotidien.ts:604-622`. Le seul critère de version est
  `versionAuMoins(signatureApporteur, "2.8")`, c'est-à-dire la version **actuelle** de l'apporteur. La
  date de la déclaration n'est jamais comparée à la date d'effet de son passage en 2.8.
- **Contrat** : `src/features/apporteurs-reseau/contrat-v2.ts:667`, art. 13.5 : « la présente version
  ne s'applique qu'aux déclarations enregistrées à compter de sa prise d'effet […]. Les déclarations
  enregistrées auparavant — qu'elles aient donné lieu à une attribution provisoire, […] ou à une mise en
  attente — […] restent régies jusqu'à leur extinction par la version sous laquelle elles ont été
  faites ». Voir aussi 13.1 : toute modification passe par un avenant signé.
- **Scénario** : Paul (2.6) déclare l'entreprise X le 01/10. Le contact part le 27/10. Il signe
  l'avenant 2.8 le 20/11. L'interrupteur est allumé. Au passage du 26/11, X reçoit une ligne
  `rendez_vous` (terme au 30/11). Sous 2.6, X était confirmée par le silence **le jour même** (contact +
  30 j). C'est exactement le cas que le spec `bascule-…spec.ts:384` fige comme attendu. Sans rendez-vous
  pris d'ici le 30/11, `etapeReservationsEchues` passe X en `terminee` (`passage-quotidien.ts`, autour
  de la ligne 1650). Paul perd une attribution que son contrat lui garantissait, à quelques heures près.
- **Portée** : l'étape n'est pas une migration ponctuelle. Elle tourne **chaque jour**. Tout apporteur
  qui signe l'avenant 2.8 plus tard voit donc ses présentations en attente basculer au passage suivant.
- Le commentaire invoque une « décision de Will (26/11/2026) ». Je ne peux pas la vérifier, et elle
  n'est pas tracée dans un ADR ni dans le texte du contrat. Si elle est confirmée, il faut **soit** un
  avenant ou une clause transitoire signée qui modifie 13.5 (13.1), **soit** restreindre la bascule
  aux présentations dont `recueAt` est postérieure à la prise d'effet de la 2.8 pour cet apporteur
  (notification de l'acceptation).

### 2. 🟠 Les termes courts : bascule à quelques heures ou quelques jours du silence

`regle-attribution.ts:113-116` : seule une date de silence **déjà passée** empêche la bascule. Une
présentation dont le silence tombe plus tard dans la journée, ou dans les jours qui viennent, bascule
avec un terme parfois très proche (le spec en donne un de 4 jours). Elle passe alors en `terminee` sans
rendez-vous. L'alerte de lot (`passage-quotidien.ts:531-553`) se contente d'afficher « N j restants ».
Même si la décision du constat 1 est tenue, il faut traiter explicitement ce cas : ne pas basculer une
présentation dont le silence arrive avant le terme, ou garantir au minimum le reste du délai de l'ancienne
règle.

### 3. 🟠 L'apporteur n'est pas informé du changement de règle

À la saisie, l'apporteur a reçu un message qui annonce la confirmation par le silence
(`apporteur-presentation-recue`, cf. `interrupteur-rendez-vous.ts`, en-tête). La bascule n'envoie rien à
l'apporteur : seule une alerte **interne** part. Il découvrira la fin de sa réservation sans avoir été
prévenu de la nouvelle règle. Ce problème s'ajoute au constat 1 : changer la règle d'une déclaration
en cours sans le dire à l'intéressé.

### 4. 🟡 Alerte de lot dédoublonnée au jour : un second passage le même jour n'est pas signalé

`passage-quotidien.ts:545`, `jobId: apporteur-bascule-lot-${jour}`. `alerteInterne` ne part qu'une fois
par `jobId` (`dejaEnvoye`).
- **Scénario** : la page 1 bascule 10 présentations. Une erreur non-P2002 sur la page 2 interrompt
  l'étape : le `finally` envoie l'alerte pour les 10. Le passage est relancé le même jour et bascule les
  suivantes. Leur alerte porte le même `jobId` : elle est ignorée. Or ces présentations sont justement
  celles dont « les rendez-vous déjà pris ne sont pas proposés automatiquement ».
- Piste de correction : un `jobId` qui dépend du contenu (par exemple un hachage des ids basculés), ou une
  alerte par présentation. Par ailleurs, `jour` est calculé en UTC, pas à l'heure de Paris.

### 5. 🟡 Une seule ligne en erreur bloque toute la bascule, chaque jour

`passage-quotidien.ts:652` : toute erreur autre que P2002 ou P2021 est relancée et arrête la boucle. Une
présentation qui échoue toujours (donnée corrompue, contrainte) empêche toutes celles qui la suivent
dans l'ordre `recueAt` de basculer, jour après jour, pendant que leur silence approche. Il vaut mieux
compter l'erreur au bilan (`bilan.erreurs`) et passer à la ligne suivante.

### 6. 🟡 Tests manquants

- Aucun test n'encode l'art. 13.5 : une déclaration antérieure à la prise d'effet de la 2.8 ne doit
  **pas** basculer.
- Pas de test d'un apporteur qui passe en 2.8 **après** la première exécution de l'étape (bascule
  différée, constat 1, « Portée »).
- Pas de test de l'alerte de lot sur deux passages le même jour (constat 4).
- Pas de test d'une erreur non-P2002 au milieu d'une page (constat 5).
- Pas de test de la course avec une confirmation manuelle depuis la console : la garde relit `statut`
  sans verrou. L'effet semble bénin (une ligne orpheline sur une `confirmee`, ignorée par l'échéance),
  mais rien ne le fige.

## Ce qu'il faut pour passer à BON

1. Trancher le constat 1 par écrit (avenant ou clause transitoire), ou filtrer sur la date de prise
   d'effet de la 2.8 et ajouter le test correspondant.
2. Traiter les termes courts (constat 2) et l'information de l'apporteur (constat 3).
3. Constats 4 et 5 : corrections simples, recommandées dans la même PR.
