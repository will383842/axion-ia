# Frictions relevées en parcourant la console EN RÉEL — 2026-09-04

Parcours : créer un client, un stagiaire, une session, une inscription, puis
observer les documents automatiques. Console de PRODUCTION, données réelles
(SCI Invest Sun / Simone Blanc / session du 05-09).

## F1 — L'entreprise se saisit DEUX FOIS, en texte libre

`clients/new` crée « SCI Invest Sun » (raison sociale, structurée).
`stagiaires/new` redemande « Entreprise » en **texte libre**, sans lien avec le
client créé. Rien ne les relie.

Conséquence : « SCI invest sun », « Invest Sun », « SCI INVEST SUN » créent trois
entreprises différentes aux yeux d'un lecteur — et d'un auditeur. Personne ne
voit l'erreur, parce qu'aucun écran ne les rapproche.

Piste : remplacer le champ libre par une LISTE des clients existants (le même
patron que `options.ts` pour les appréciations), avec une porte de sortie pour
un stagiaire sans client rattaché.

## F2 — Les consentements ne disent pas ce qu'il en coûte

Deux cases sur `stagiaires/new` : « Consentement traitement des données
(formation) » et « Consentement communications email ». Décochées par défaut,
sans un mot sur les conséquences. J'ai dû demander à Will quoi faire.

L'une est une base légale de traitement, l'autre un confort commercial — et
l'écran les présente sur le même plan, l'une sous l'autre, même typographie.

Piste : dire ce que chacune emporte, et distinguer visuellement l'obligatoire du
facultatif.

## F3 (à confirmer) — le champ Fonction du stagiaire

Saisi « Représentante » pour Simone Blanc, qui est A LA FOIS la stagiaire et la
représentante du client. Aucun écran ne signale ce cumul — or c'est exactement
lui qui fait échouer off.30 (une seule personne physique pour deux qualités).

## F4 — En distanciel, le formulaire de session garde les mots de la porte

Session AXI-SESS-2026-001, modalité « Distanciel », type de lieu « Distanciel
(visioconférence) ». Les champs adresse / CP / ville / salle disparaissent bien
— la conditionnelle est propre. Mais trois libellés restent ceux du présentiel :

- « CONTACT SUR PLACE (NOM) » / « CONTACT SUR PLACE (TÉLÉPHONE) »
- « CONSIGNES D'ACCÈS POUR LE FORMATEUR »
- l'aide sous les consignes : « Envoyé au formateur 7 jours avant et la veille,
  **avec l'adresse, la salle** et le contact » — il n'y a ni adresse ni salle.

C'est le MÊME défaut que celui corrigé dans l'alerte (#980) : le message et le
titre de `session_contact_sur_place_absent` ont été rendus par modalité, le
FORMULAIRE qui alimente ces champs ne l'a pas été. La correction s'est arrêtée à
l'écran de sortie sans remonter à l'écran de saisie.

Piste : dériver les libellés de `lieuType`, comme l'évaluateur le fait déjà —
« Personne à joindre (nom) » / « Informations de connexion » en distanciel.

## F5 — Le montant HT est obligatoire et n'est jamais pré-rempli

« MONTANT HT (€) * » démarre à 0 et bloque la création. La formation est déjà
choisie, elle porte une offre, et cette offre porte un tarif — 1 900 € HT pour
AXI-FORM-2026-038, lisible sur `/qualiopi/offres`. Il a fallu ouvrir un second
onglet, trouver l'offre, lire le prix, revenir.

Un nouveau salarié ne SAIT PAS que le prix est dans « Offres » : rien sur cet
écran ne le dit. Le risque n'est pas la lenteur, c'est le chiffre inventé —
un montant faux part ensuite sur la convention et la facture.

Piste : pré-remplir depuis le tarif de l'offre au choix de la formation, en
laissant le champ modifiable, avec la mention « tarif catalogue — modifiable ».

## F6 — Rien ne réclame le lien de visioconférence d'une session à distance

Le champ « LIEN DE VISIOCONFÉRENCE » est facultatif, et une session
« Distanciel » se crée sans lui sans un mot. La convocation J-7 et le rappel
J-1 partiront alors vers un formateur et un stagiaire qui n'ont **aucun moyen
d'entrer**. L'alerte `session_contact_sur_place_absent` couvre bien l'absence de
personne à joindre — elle ne regarde pas le lien.

Symétrie manquante : sur site on garde l'adresse ET le contact ; à distance on
ne garde que le contact.

## F7 — Le paramètre « Acompte (%) » est SOUS le bouton qui le consomme

Bloc Documents → « Convention de formation ». Le bouton est en premier, le champ
« Acompte (%) » (placeholder 30, aide « 0 = totalité à réception de facture »)
apparaît EN DESSOUS. À la première utilisation on clique, la convention se
génère, et on découvre le réglage ensuite — il faut alors régénérer, ce qui
produit « une COPIE filigranée, jamais l'original ».

C'est ce qui vient de se passer sur AXI-DOC-2026-030.

Piste : champ AU-DESSUS du bouton, comme partout ailleurs dans la console.

## F8 — « Confirmer les journées » ne crée pas les créneaux

Le suivi de dossier n'a qu'une étape, « Journées de présence confirmées ».
L'écran Émargement en a DEUX, séparées par un bloc : « Confirmer ces journées »
(→ « 1 journée enregistrée ») puis, plus bas, « Générer les créneaux »
(→ « 2 créneau(x) créés »). Entre les deux, un bandeau prévient que les liens
partiraient sur « Aucune demi-journée à signer ».

Le bandeau sauve la mise, mais il faut le lire ET faire le lien avec un bouton
situé sous un autre bloc. Le suivi de dossier, lui, aurait affiché l'étape
« Fait » avec zéro créneau.

Piste : enchaîner les deux dans le même geste, ou faire porter l'étape du suivi
sur l'existence des créneaux, pas sur celle des journées.

## F9 — Les liens d'émargement se perdent si on quitte la page

« Ces liens ne sont affichés qu'ici et ne sont pas conservés en clair. Si vous
fermez cette page, il faudra en réémettre — ce qui invalidera ceux déjà
distribués. » Choix de sécurité assumé et bien expliqué. Mais le chemin naturel
— émettre, puis aller chercher l'adresse du stagiaire, puis revenir — détruit
le lien. Le bouton « Envoyer les liens par e-mail » à côté couvre le cas
courant ; le cas « je copie le lien dans le chat de la visio » (explicitement
recommandé dans l'aide juste au-dessus) ne survit pas à une navigation.

## F10 — 🔴 DÉFAUT RÉEL : les repères « (J-n) » du suivi de dossier sont faux

Session du 05/09/2026, lue le 04/09/2026. Le suivi affiche :

| Étape                   | Échéance   | Repère affiché | Réalité vs SESSION |
| ----------------------- | ---------- | -------------- | ------------------ |
| Évaluation finale       | 07/09/2026 | **(J-3)**      | J+2                |
| Attestation de fin      | 08/09/2026 | **(J-4)**      | J+3                |
| Satisfaction à chaud    | 12/09/2026 | **(J-8)**      | J+7                |
| Suivi à froid           | 12/10/2026 | **(J-38)**     | J+37               |

Le nombre est compté depuis AUJOURD'HUI, et il vaut « dans n jours ». Mais il
est écrit « J-n », notation qui, dans tout le reste du produit (convocation J-5,
convocation formateur J-7, rappel J-1, satisfaction J+1, suivi J+30) désigne un
décalage par rapport à la SESSION. Lu ainsi, « évaluation finale (J-3) » veut
dire « trois jours avant la session », soit le 02/09 — une échéance déjà passée
alors que l'écran dit « À faire avant le 07/09 » sur la même ligne.

Une notation qui contredit sa propre date sur la même ligne se fait ignorer, et
elle est ignorée dans le mauvais sens : elle fait paraître URGENT ce qui ne
l'est pas encore, et les quatre étapes concernées sont justement les quatre
d'APRÈS la session.

Piste : écrire « dans 3 jours » / « demain », ou compter réellement depuis la
session (« J+2 »).

# AUDIT DISTANCIEL DE BOUT EN BOUT — 2026-09-04

## D1 — 🔴 Le stagiaire ne reçoit JAMAIS le lien de visioconférence

Chaîne suivie ligne à ligne :

| Destination | Ce qui est servi | Fichier |
| --- | --- | --- |
| Convocation stagiaire (e-mail) | `lieu` = `formatLieu(session)` → **« Distanciel »** ou « Distanciel — meet.google.com ». Jamais l'URL. | `qualiopi-convocation.tsx` + `notifications-service.ts:218` |
| Espace stagiaire → Mes formations | titre, statut, dates. **Ni lieu, ni visio, ni horaires, ni formateur.** | `portail/mon-espace/formations/page.tsx` |
| Documents (convention, émargement) | l'HÔTE seul, jamais l'URL — choix délibéré et juste | `format-lieu.ts:92` |
| Espace FORMATEUR | l'URL complète, cliquable | `espace-formateur/sessions/[id]/page.tsx:154` |
| Convocation J-7 / rappel J-1 formateur | l'URL complète | `_infos-pratiques-formateur.tsx:62` |

`grep -rn "visio" src/app/[locale]/portail/ src/server/qualiopi/portail/` → **aucun résultat.**

Et la convocation PROMET le contraire : « Votre convocation officielle et les
**modalités pratiques (accès, matériel, règlement intérieur)** sont disponibles
dans votre espace stagiaire. » L'espace ne les contient pas.

Conclusion : le distanciel est câblé **côté formateur uniquement**. Le stagiaire
reçoit une convocation qui dit « Distanciel » et le renvoie vers un espace qui
ne dit rien. Il n'a aucun moyen d'entrer.

## D2 — 🔴 Aucun contrôle d'accès sur la visio

`lieuVisioUrl` est une URL nue en `@db.Text`. Le schéma zod ne valide que
`http(s)` (`lieu-input.ts:33`) — correct contre `javascript:`/`data:`, muet sur
le reste. Quiconque détient l'URL entre : elle est transférable, elle ne
s'expire pas, elle ne se révoque pas, et rien ne trace qui s'en est servi.

La brique qui manque EXISTE DÉJÀ dans le produit, pour l'émargement :
`creerTokenCoaching` (`token-service.ts:314`) stocke **l'empreinte de l'adresse
destinataire** à l'émission, pour qu'un lien transféré ne signe pas au nom du
destinataire initial. C'est exactement la primitive à réutiliser.

## D3 — Aucune borne d'effectif

`nbParticipantsPrevus` n'est lu QUE pour l'affichage (« 1 inscrits / 1 prévus »,
`sessions/[id]/page.tsx:657`). Aucune Server Action ne le compare aux
inscriptions : on peut inscrire 80 personnes sur une session déclarée à 12, sans
un mot.

## D4 — L'inscription ne passe pas à l'échelle

- `prisma.trainee.findMany({ where: { deletedAt: null } })` — **sans `take`**
  (`sessions/[id]/page.tsx:387`). Tout le registre est sérialisé vers le
  navigateur à chaque ouverture d'une fiche session, et rendu dans un `<select>`.
- Un stagiaire = une sélection + un aller-retour. **50 stagiaires = 50 gestes.**
- Import CSV : il en existe un, pour les **factures historiques** uniquement
  (`ImportFacturesHistoriqueForm.tsx`). Rien pour les stagiaires.

## D5 — Les liens d'émargement à 50

`envoyerLiensPourSession` boucle et passe par BullMQ (`enqueueEmail`) : le débit
est tenu par la file, pas par la requête. ✅ Ce point-là passe l'échelle.
En revanche l'écran (F9) n'affiche les liens qu'une fois et les perd à la
navigation — à 50 lignes de QR, c'est inexploitable autrement que par l'envoi
e-mail groupé.
