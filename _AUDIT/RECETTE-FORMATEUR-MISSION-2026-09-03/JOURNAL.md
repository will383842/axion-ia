# Recette UI du cycle de vie du formateur sur une session — 2026-09-03

Mandat de Will : éprouver **par l'interface**, comme un certificateur qui découvre le
produit, le lot livré par la PR #960 — accepter/refuser une mission, convocation J-7,
rappel J-1, relance J+3, expiration par le cron, et le pilotage qui croise refus,
absences, congés et habilitation. Corriger tout ce qui est trouvé.

Les étapes 1 à 13 ont été jouées lors d'une première session (acceptation, refus motivé,
lien rejoué inerte, espace formateur, congés, non-habilité, déclaration d'absence). Ce
journal couvre la **reprise à l'étape 14** et la fin de la recette.

---

## 1. L'instrument

| | |
|---|---|
| Pile | Postgres 5434 (base `axion_qualiopi_formateur_e2e`), Redis 6381/3, MailHog 8025, `next dev --webpack` sur 3000, worker BullMQ réel |
| Jeu de données | 2 formateurs (Camille Deroy, salariée, habilitée sur « IA pour bien commencer » ; Yann Broussel, sous-traitant, non habilité), 10 sessions jouées, 1 congé, 1 incident |
| Parcours | Playwright sur un profil Chrome persistant — la session admin survit d'une étape à l'autre, comme pour un humain qui garde son onglet |
| Crons | posés sur la **vraie file** (`formation-crons`), exécutés par le **vrai worker**. Aucune fonction appelée en court-circuit |
| Courriels | lus dans MailHog, corps complet, liens compris |

🔑 **Rien n'a été mesuré depuis la base.** Chaque défaut ci-dessous a d'abord été vu à
l'écran ou dans un e-mail reçu ; la base n'a servi qu'à confirmer.

---

## 2. Les sept défauts trouvés, et ce qu'ils sont devenus

### 2.1 🔴 « 5 sessions Qualiopi animées » — pour une formatrice qui n'en avait animé aucune

La fiche formateur ouvre sur un encart « Activité (calculée automatiquement) ». Il
annonçait **5 sessions animées**. Les cinq étaient `planifiee` : aucune n'avait eu lieu.
L'une d'elles était la session dont la formatrice **s'était désistée le matin même**.

`getTrainerActivityCounts` comptait toutes les `TrainingSession` portant le formateur en
`formateurPrincipalId`, **sans regarder le statut**. Trois faussetés dans un seul chiffre :

1. il comptait des sessions à venir comme des sessions animées ;
2. il comptait un désistement comme une animation ;
3. il ne lisait que `formateurPrincipalId` — un cache dénormalisé — donc **toute
   co-animation restait invisible**. C'est exactement le piège que
   `fiabilite-service.ts` documente pour son propre dénominateur, à trente lignes de là.

Ce n'est pas un chiffre décoratif : la page porte « Aperçu de la fiche (PDF) » et
« Verser la fiche au dossier (ind. 21) ». **Le chiffre part à l'auditeur.**

**Corrigé.** On compte les sessions `realisee` par l'invariant nommé du dépôt
(`whereSessionsDuFormateur` : principal OU co-animateur), et on rend à part celles qui
restent à venir — l'information que le chiffre gonflé prétendait donner, cette fois sous
son vrai nom. L'écran dit désormais : **« 0 session Qualiopi animée · 6 à venir. »**

### 2.2 🔴 Une session « hybride » ne pouvait décrire que la moitié de son lieu

`LieuFieldset` affiche l'adresse **ou** le lien de visio, selon `lieuType`, avec un
commentaire qui justifie l'exclusion — *« afficher les deux inviterait à remplir les deux,
et la convention annoncerait un lieu qui se contredit lui-même »*. Le raisonnement est
juste pour deux cas sur trois. Il oublie le troisième.

`ModaliteFormation` porte `hybride`, et le site le vend (*« format hybride possible »*).
Or `LieuType` n'a que trois valeurs, aucune ne dit « les deux ». Résultat, pour une
session hybride :

- `Sur site` → **aucun champ de visio** : les participants à distance n'ont pas de lien ;
- `Distanciel` → **aucune adresse** : ceux sur place n'ont pas d'adresse.

Constaté en essayant simplement de créer la session : le champ `#session-lieu-visio`
n'existait pas. Et même en forçant la valeur en base, `formatLieu` l'aurait ignorée — il
ne lit l'URL de visio que si `lieuType === "distanciel"`.

**Corrigé** aux deux étages. Le fieldset affiche les deux blocs quand la modalité est
hybride (la modalité lui est passée par `SessionForm` et par `SessionLieuForm`), et
`formatLieu` ajoute l'hôte de visio — jamais le lien complet, qui vaut clé d'accès — à une
ligne de lieu physique. Vérifié dans l'e-mail reçu :

> Lieu : Sur site — Clinique du Parc — pôle formation — 48 boulevard des Belges,
> 69006 Lyon · Salle Amphi Curie, niveau -1 · **visio meet.google.com**

Trois tests ajoutés à `format-lieu.spec.ts`, **vus rougir** contre l'ancienne
implémentation (2 échecs sur 19) puis reverdir.

### 2.3 🔴 « VOTRE SESSION DÉMARRE DANS UNE SEMAINE » — pour une session du lendemain

La convocation pratique J-7 est sélectionnée par **état**, pas par date : toute affectation
d'une session qui démarre dans les 7,5 jours et dont la trace d'envoi est vide part au
passage suivant. C'est délibéré et c'est bien — une affectation posée à J-3 ne doit pas
manquer sa convocation « parce que J-7 est passé ».

Mais l'objet et le titre du gabarit étaient **figés** : `Dans 7 jours —` et
« Votre session démarre dans une semaine ». La session 9, créée pour **le lendemain**, a
donc reçu un message annonçant une semaine de délai. Un formateur qui le lit range la date
dans la semaine suivante.

**Corrigé.** `chargerInfosPratiques` calcule `joursAvantDebut` en **jours civils de
Paris** — pas en heures divisées par 24 : une session de 09:00 convoquée la veille à 20:00
est à 13 h d'écart, et la seule réponse utile est « demain ». Le gabarit dérive objet et
titre de ce nombre. Vérifié dans MailHog, même passage de cron :

| Session | Démarrage | Objet reçu |
|---|---|---|
| AXI-SESS-2026-008 | J+7 | `Dans 7 jours — RECETTE 8 …` |
| AXI-SESS-2026-009 | **J+1** | `Demain — RECETTE 9 …` |

⚠️ Le repli, quand le délai est absent, est **« Vos informations pratiques »** — surtout
pas 7. Une valeur par défaut de 7 refabriquerait le défaut à l'identique, en silence. Le
test le dit en toutes lettres.

### 2.4 🔴 La proposition EXPIRÉE ne levait aucune alerte

Le trou le plus grave de la recette, et il s'ouvre au pire moment.

Scénario joué intégralement par l'écran : session créée pour le lendemain, proposition
envoyée, **laissée sans réponse**, dates ramenées au matin même par l'écran « Dates »,
cron `missions-formateur` posé. La proposition passe bien en `expiree`. Et la table
`alertes_systeme` ne porte **aucune ligne** au sujet du formateur — seulement « diaporama
manquant » et « convention manquante ».

Deux règles auraient dû l'attraper, et elles s'excluent l'une l'autre :

- `formateur_mission_sans_reponse` exige `statut = "en_attente"` **ET** `dateDebut > now`.
  Or le cron passe la proposition en `expiree` **à l'instant où la session démarre** :
  l'alerte s'éteint exactement quand le risque cesse d'être un risque pour devenir un fait ;
- `session_sans_formateur` exige `formateurPrincipalId: null`. Or expirer **ne retire pas**
  l'affectation — `relancerEtExpirerMissions` constate un silence, il ne décide pas à la
  place de l'organisme, et c'est la bonne doctrine.

Chacune est juste seule. Ensemble elles laissent passer le seul cas qui compte pour
l'auditeur : **une prestation vendue, animée — ou pas — par quelqu'un dont l'accord n'a
jamais été tracé.**

**Corrigé** par une cinquième règle, `formateur_mission_expiree` (critique, guichet
administratif, résolution automatique). Elle ne demande pas « affectez quelqu'un » — il est
trop tard — mais la seule question qui reste :

> Camille Deroy n'a jamais répondu à la proposition pour AXI-SESS-2026-010 « RECETTE 10 —
> expiration sans réponse », qui a démarré le 03/09/2026. L'affectation tient toujours,
> mais aucun accord n'a été tracé : vérifiez que la session a bien été animée, et
> consignez un incident si elle ne l'a pas été.

Elle s'éteint dès qu'une mission `acceptee` couvre la session (co-animation proposée à
deux, un seul répond), et ne lève qu'une alerte par session. Après correction, le cron
la lève sur **deux** sessions réellement muettes — la 010, et la 005, dont la formatrice
s'était désistée.

### 2.5 🔴 Le registre des incidents ne savait pas nommer une salariée

Le menu « Intervenant externe mis en cause » ne proposait que **Yann Broussel** :
`prisma.trainer.findMany({ where: { actif: true, statut: "sous_traitant" } })`.

Deux choses le contredisaient déjà dans le produit :

- « Déclarer une absence », sur la fiche de session, ouvre un incident avec `trainerId`
  pour **n'importe quel** formateur. L'incident de Camille Deroy, **salariée**, est en
  base — et le registre ne savait pas l'y saisir ;
- la fiche formateur affiche « 1 absence consignée » **pour tous les statuts** (décision du
  2026-09-03 : *« un salarié qui refuse ou ne vient pas est un fait à piloter »*), et elle
  renvoie explicitement vers ce registre. Cette phrase était donc à moitié fausse.

Conséquence : un incident constaté **hors session** — un désistement appris après coup —
était inattribuable à une salariée, et n'atteignait jamais sa fiche.

**Corrigé.** La liste porte tous les formateurs actifs, chacun suivi de son statut
(« Camille Deroy (salarié) », « Yann Broussel (sous-traitant) », « … (organisme) ») : les
suites ne sont pas les mêmes — art. 8 pour un externe, RH pour un salarié. Le champ reste
facultatif et l'art. 7 ne concerne toujours que les externes : c'était la **liste** qui
était trop étroite, pas la règle.

### 2.6 ⚠️ « Salle Salle Vercors » sur la convention

`formatLieu` préfixe « Salle ». Le champ s'appelle « Salle » et n'avait aucun exemple : on
y saisit naturellement « Salle Vercors », et la convention imprime « Salle Salle Vercors ».
Vu aussi sur la session 4 : « Salle Atelier 2, bâtiment B ».

**Corrigé** par le geste le plus léger qui ferme la porte — un `placeholder`
« Ex. : Vercors, 2e étage ». Le formateur reste libre de ce qu'il écrit ; il sait
seulement ce que le document ajoutera devant.

### 2.7 🔴 La confirmation d'acceptation ne s'affichait jamais

En acceptant **vraiment** une mission par le lien de l'e-mail, l'écran rendu une seconde
après le clic disait :

> Cette proposition n'attend plus de réponse : acceptée.

C'est un constat écrit pour quelqu'un qui rouvre un vieux lien. La phrase qui répond à la
seule question du formateur — *« et maintenant ? »* — existe bien dans
`MissionReponseForm`, mais elle **n'apparaît jamais** : le formulaire la rend, puis
`router.refresh()` re-rend le Server Component, qui constate que la mission a quitté
`en_attente`, cesse de rendre le formulaire, et emporte son état avec lui. Du code mort en
pratique, et le formateur qui vient de s'engager pour une journée lit un constat froid.

**Corrigé** en sortant les deux phrases dans un module partagé
(`espace-formateur/mission-copy.ts`) que la page serveur et le formulaire lisent tous les
deux. `retiree` et `expiree` gardent le constat neutre — personne n'a répondu, il n'y a pas
de suite à promettre. Vérifié à l'écran :

> **Mission acceptée.** Les informations pratiques (adresse, salle, contact sur place,
> consignes d'accès) vous parviendront une semaine avant le démarrage, et restent
> consultables dans votre espace.

⚠️ **Le premier essai de correction a rendu un 500**, et c'est le vrai enseignement : la
constante avait été exportée depuis le fichier `"use client"`. Dans l'App Router, **tout**
export d'un module `"use client"` devient une référence client — un Server Component qui y
lit `.titre` trouve `undefined`. Rien dans le typage ne l'annonce ; seul l'écran le dit. Le
module partagé est donc un `.ts` sans directive, et un test le verrouille.

---

## 3. Ce qui a été éprouvé et qui tient

| Étape | Preuve |
|---|---|
| Proposition de mission | e-mail reçu, lieu complet, effectif, lien signé borné au démarrage |
| Acceptation par le lien | statut `acceptee` ; écran de confirmation qui dit la suite (§2.7) ; lien rejoué **inerte** |
| Refus motivé | motif obligatoire, affectation retirée, alerte `formateur_mission_refusee` avec le motif cité |
| Convocation J-7 | adresse, salle, visio, contact sur place, consignes, horaires, effectif, lien d'espace ; mention « vous n'avez pas encore confirmé » quand la mission est en attente |
| Rappel J-1 | « À DEMAIN », heure de démarrage, mêmes infos pratiques, consigne d'empêchement de dernière minute |
| Relance J+3 | `Relance mission —` / « VOTRE RÉPONSE EST ATTENDUE » ; **une seule fois** — second passage du cron : `0 relance(s)` |
| Expiration | `expiree` au passage du cron, sans toucher à l'affectation |
| Congés × session | alerte critique « Formateur indisponible sur les dates de la session … 1 jour (Congés) : 13/10 » |
| Habilitation | assignation d'un non-habilité **refusée** à l'écran : « Assignation refusée : Formateur non habilité sur cette formation » ; l'option porte déjà « (non habilité) » |
| Absence | incident ouvert, gravité majeure, `fait = desistement`, visible au registre et compté sur la fiche |
| Journées hors plage | avancer les dates d'une session le DIT : « 1 journée déclarée sur 1 tombe hors de cette plage … la feuille d'émargement imprime les JOURNÉES, pas la plage » |
| Pilotage — liste | colonne « REFUS · ABSENCES (24 MOIS) » : « 1 refus · 1 absence · 3 sans réponse · 2 expirées / 9 proposées » |
| Pilotage — fiche | même compte, plus le **dernier motif de refus cité en clair**, daté, avec le numéro de session |

---

## 4. Observations qui ne sont pas des défauts

- **Fiabilité et incidents ne sont chargés que pour les sous-traitants.** C'est une
  décision documentée (« un salarié ne se “reconduit” pas, le bloc se lirait comme un
  reproche »), et le bloc « missions proposées », lui, couvre bien tous les statuts.
- **Le lien « Ne plus recevoir de sollicitations commerciales » figure sur les e-mails de
  mission.** Sa portée est explicitement limitée au marketing (`opposition.ts`) : un
  formateur qui clique continue de recevoir ses convocations.
- **`enqueueEmail` rend `enqueued: true` même quand BullMQ a dédupliqué le `jobId`.**
  Rencontré en rejouant un cron après avoir remis une trace d'envoi à zéro. Sans effet en
  production — le `jobId` et la trace sont tous deux par affectation, donc en pas de deux —
  mais le « rattrapage » que promet l'en-tête de `convocation-formateur.ts` ne renverrait
  pas un second message si la première mise en file avait réussi. À garder en tête si un
  jour on veut un vrai renvoi.
- **La liste des sessions ne dit rien du statut de la mission.** C'est l'écran d'alertes
  qui répond à « quelles sessions n'ont pas de formateur confirmé ». Acceptable tant que
  l'alerte existe — ce qui, depuis §2.4, est vrai jusqu'au bout.
- **Bandeau SPÉCIMEN et « aucun client rattaché »** : artefacts de la base de recette
  (identité d'organisme non renseignée, sessions sans client). Pas des défauts.
- **`next dev` redémarre sur seuil mémoire** pendant les longues passes. Comportement du
  serveur de développement, sans rapport avec le produit.

---

## 5. Reste Will

1. **Contact sur place et consignes d'accès sur chaque session vendue.** Le lot les
   transporte fidèlement jusqu'au formateur ; encore faut-il les saisir. Une session sans
   contact envoie une convocation techniquement complète et pratiquement muette.
2. **Le libellé « Intervenant mis en cause » couvre désormais les salariés.** Vérifier que
   c'est bien l'intention : le champ sert à la fois l'art. 7 (externes, reconduction) et le
   pilotage RH interne, et rien ne les distingue à l'écran hormis le statut affiché.
3. **Deux messages le même jour** quand une affectation est posée à J-1 : la convocation
   (« Demain — informations pratiques ») puis le rappel (« C'est demain »). Défendable —
   chacun dit autre chose — mais c'est un choix à assumer, ou à fusionner.
