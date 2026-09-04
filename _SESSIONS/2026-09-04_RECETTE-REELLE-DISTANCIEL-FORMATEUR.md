# Recette réelle en PRODUCTION — session AXI-SESS-2026-001

> Point de reprise tenu **au fil de l'eau**. Si la session Claude Code tombe,
> **c'est ce fichier qu'on relit en premier**, pas le transcript.
> Dernière mise à jour : 2026-09-04, ~19h50 (heure de Paris).

## 0. Où on en est en une phrase

Une vraie session de formation a été créée **en production** pour servir de
dossier de preuve Qualiopi. Le parcours a révélé **deux chantiers de fond** —
le **distanciel n'est branché que côté formateur**, et le **cycle de vie du
formateur envoie des messages incohérents** — plus 10 frictions d'écran.

## 1. Les objets réels créés en production

| Objet | Identifiant | Notes |
| --- | --- | --- |
| Client | `AXI-CLI-001` — SCI Invest Sun | id `eeaa0351-6846-4307-acaa-b7b73239a724` |
| Contact client | Simone Blanc, Représentante | `beeeditions@gmail.com` |
| Stagiaire | Simone Blanc | id `068304cd-8948-4e9b-83a6-8e79ca223b09` · `simone.blanc.26@gmail.com` · 2 consentements cochés (autorisation explicite de Will) |
| Session | `AXI-SESS-2026-001` | id `0d4e0c8b-3aaa-4ec9-a8ff-d830f8a68613` · AXI-FORM-2026-038 « journée complète » · **05/09/2026 09:00 → 17:00** |
| Formateur | Williams Jullin | id `4f0abec3-a1ee-4640-9eca-ea4f5a116e1c` |
| Convention | `AXI-DOC-2026-030` | doc id `1c9a1d29-aab6-459f-b475-2867bbbab91e` — **à RÉGÉNÉRER** (voir §2) |
| Journées | 1 journée, 2 créneaux | horaires confirmés |
| Lien d'émargement | émis | valable jusqu'au 07/09/2026 17:00 |

## 2. Données à corriger — consignes de Will du 2026-09-04 au soir

- **SIRET SCI Invest Sun** : `901 434 837 00018`
- **Adresse** : `4 rue Dervieux, 42000 Saint-Étienne`
- **Montant** : **100 € HT** (et non 1 900 € — le tarif catalogue avait été repris faute d'instruction)
- CV du formateur : `C:\Users\willi\Bureau\_Divers-Perso\Pesonnel cv, + autres\cv_williams_jullin_fr.pdf`
- ✅ Décision Will : **on garde cette session**, une seconde sera faite plus tard
  (nécessaire pour off.30 — voir §5).

## 3. Ce qui est PARTI pour de vrai (journal « E-mails envoyés »)

| Heure UTC | Gabarit | Destinataire | Statut |
| --- | --- | --- | --- |
| 16:30 | `formateur-mission-proposee` | williamsjullin@gmail.com | Envoyé |
| 16:40 | `formateur-rappel-j1` | williamsjullin@gmail.com | Envoyé |
| 17:00 | `qualiopi-convocation` | simone.blanc.26@gmail.com | Envoyé |

**Rien n'est parti à `beeeditions@gmail.com`** — normal, la convention n'a pas
été envoyée (Will devait valider le montant d'abord). L'adresse est saine :
14 e-mails reçus les 02 et 03/09.

⚠️ « Envoyé » = remis au serveur d'envoi. Rebonds = 0. **Ne prouve pas la boîte
de réception** : faire vérifier les spams de `simone.blanc.26@gmail.com`.

## 4. Les deux chantiers de fond

### 4.1 DISTANCIEL — branché côté formateur SEULEMENT

`grep -rn "visio" src/app/[locale]/portail/ src/server/qualiopi/portail/` → **0 résultat.**

| Destination | Reçoit | Fichier |
| --- | --- | --- |
| Espace formateur | l'URL complète | `espace-formateur/sessions/[id]/page.tsx:154` |
| Convocation J-7 / rappel J-1 formateur | l'URL complète | `_infos-pratiques-formateur.tsx:62` |
| Documents | l'HÔTE seul (délibéré, juste) | `format-lieu.ts:92` |
| **Convocation stagiaire** | **« Distanciel »**, rien d'autre | `notifications-service.ts:218` |
| **Espace stagiaire** | titre, statut, dates. **Rien d'autre** | `portail/mon-espace/formations/page.tsx` |

Et la convocation PROMET « les modalités pratiques (accès, matériel, règlement
intérieur) sont disponibles dans votre espace stagiaire ». Elles n'y sont pas.

Sécurité : `lieuVisioUrl` est une URL nue, transférable, inexpirable,
irrévocable, non tracée. La primitive qui manque existe déjà :
`creerTokenCoaching` (`token-service.ts:314`) lie un jeton à l'**empreinte de
l'adresse destinataire**.

Échelle : `prisma.trainee.findMany({ where: { deletedAt: null } })` **sans
`take`** (`sessions/[id]/page.tsx:387`) ; 1 inscription = 1 geste ; aucun import
de liste ; `nbParticipantsPrevus` jamais opposé aux inscriptions.

### 4.2 FORMATEUR — six défauts, tous confirmés dans le code

1. `formateur-mission-proposee.tsx` promet **« une semaine avant le démarrage »**, en dur.
2. `affectationsAConvoquer` **ne regarde pas le statut de la mission** → rappel J-1 envoyé à un formateur qui n'a pas accepté.
3. `proposerMissionFormateur` **ne lit pas `trainer.statut`** → un salarié / le dirigeant reçoit une demande d'accord.
4. Le retour dans la console **fonctionne** (bloc « Réponse du formateur »).
5. Délai de réponse = **jusqu'au démarrage** ; relance fixe **J+3** ; alerte exigeant `solliciteAt ≤ J-3` → pour une session à < 3 jours : **aucune relance, aucune alerte**.
6. L'accept/refus lui-même **fonctionne** (jeton HMAC, motif obligatoire, expiration, page dédiée).

**Décision de conception (arbitrée avec Will)** :
- salarié / dirigeant → **aucune demande d'accord**, lettre de mission seule ;
- sous-traitant → délai **proportionnel** `min(48 h, jusqu'à J-3)`, relance à mi-délai ;
- silence à l'échéance → statut **`sans_reponse`**, JAMAIS `refusee` (un refus
  non formulé, avec motif inventé, salirait le pilotage « refus par formateur »
  qui sert à motiver une non-reconduction, art. 8 sous-traitance) ;
- lien après échéance → page « trop tard » + **champ pour écrire à l'organisme**.

## 5. Qualiopi — ce que ce dossier prouve, et ce qu'il ne prouve pas

Couvre : **8, 9, 10, 11, 13, 17**.

⚠️ **off.30 NE TIENT PAS sur ce dossier.** La règle compte les personnes par
e-mail normalisé : `beeeditions@` et `simone.blanc.26@` valent deux. Mais c'est
**la même personne physique**, et la 3ᵉ voix serait le dirigeant de l'OF
lui-même. Ça passe la règle, pas un entretien de certification.
→ d'où la 2ᵉ session décidée par Will.

## 6. Frictions relevées — détail dans le scratchpad `frictions-ui.md`

F1 entreprise saisie deux fois · F2 consentements muets sur leurs conséquences ·
F3 cumul stagiaire/représentante non signalé · F4 libellés « sur place » en
distanciel · F5 montant HT jamais pré-rempli · F6 rien ne réclame le lien visio ·
F7 « Acompte (%) » sous le bouton qui le consomme · F8 « Confirmer les journées »
ne crée pas les créneaux · F9 liens d'émargement perdus à la navigation ·
**F10 🔴 défaut réel : les repères « (J-n) » comptés depuis aujourd'hui**
(`parcours/etat-echeance.ts:191`) — « à faire avant le 07/09 (J-3) » pour du J+2.

## 7. État git / déploiement

- `7fed255f8` — #988 off.30 appréciation formateur, **fusionnée** le 04/09 17:43 UTC (4 gates vertes). Build GHCR en cours (~50 min).
- Prod avant : `8771f7ee4`.
- Worktree de travail : `wt-app30`.

## 8. Plan de correction — 3 PR

1. **Formateur** : délai proportionnel, `sans_reponse`, gate salarié/dirigeant, e-mail dérivé du vrai délai, rappel J-1 qui exige l'accord, page « trop tard » + message.
2. **Distanciel bout en bout** : lien par personne lié à l'adresse, fenêtre H-30→fin+2h, révocation, trace ; espace stagiaire complet ; rappels J-1 et H-1 ; alerte si distanciel sans lien.
3. **Échelle + F1→F10** : inscription multiple par collage/CSV, `take` + recherche serveur, garde d'effectif.

---

## 9. Mise à jour 2026-09-04 ~20h15 — corrections appliquées

### Appliqué en production

| Quoi | Comment | Vérifié |
| --- | --- | --- |
| SIRET `90143483700018` + adresse `4 rue Dervieux, 42000 Saint-Étienne` sur `AXI-CLI-001` | **par l'UI** | ✅ relu à l'écran |
| Montant **1 900 € → 100 € HT** | **SQL direct** (aucune action d'écriture n'existe) | ✅ « MONTANT HT 100,00 € » |
| Modalité **distanciel → présentiel**, lieu **nos_locaux**, intitulé = adresse de l'OF, contact = Williams Jullin + tél, consignes d'accès | **SQL direct** | ✅ relu à l'écran |

Décision Will : « pour demain fais au plus simple, c'est juste pour le
certificateur » → **présentiel dans nos locaux**, ce qui supprime le besoin de
lien de visio et n'arme jamais l'alerte `session_contact_sur_place_absent`
(`nos_locaux` est explicitement hors périmètre de la règle).

### 🔴 Défauts NOUVEAUX découverts en corrigeant

- **N1 — `montantHtCents` n'est écrit qu'à la création.** `createSessionAction`
  est la seule écriture. Il existe `setSessionLieuAction` et
  `setSessionDatesAction`, il n'existe **pas** de `setSessionMontantAction`, et
  la page Financement l'affiche en lecture seule. Un prix saisi de travers est
  gelé, et il part sur la convention **et sur la facture**.
- **N2 — la MODALITÉ n'est modifiable nulle part après création** non plus.
  `SessionLieuForm` ne touche que `lieuType`, jamais `modalite`. On peut donc
  avoir `modalite = distanciel` et `lieuType = nos_locaux` — état incohérent
  qu'aucun écran ne signale.
- **N3 (à CONFIRMER À LA MAIN) — les boutons du bloc Documents ne réagissent
  pas.** « Convention de formation — régénérer » et « Annuler au registre »
  cliqués plusieurs fois : aucun document créé, aucun message d'erreur, aucun
  message de succès, **aucune exception console**, 8 s d'attente. Les boutons
  des AUTRES blocs (inscrire, confirmer les journées, générer les créneaux,
  émettre les liens, première génération de la convention) répondent tous
  normalement.
  ⚠️ **Ne pas conclure trop vite** : ce bloc déborde horizontalement (constaté
  en capture, contenu coupé au-delà de 1568 px) — le défaut peut être un clic
  d'automatisation qui atterrit à côté. **À trancher en cliquant à la main.**
- **N4 — `ConventionButton` ne passe JAMAIS `rectificationMotif`.** Le hook
  `useMotifRectification` existe (`DocumentsSection.tsx:220`) et le service sait
  produire une rectification **sans filigrane**
  (`documents-service.ts:168-190`), mais le bouton convention appelle
  `genererConventionAction({ sessionId, acomptePercent })` tout court. Une
  convention régénérée sortira donc filigranée « COPIE » — exactement le défaut
  que le dépôt déclare avoir corrigé pour 23 appelants. La convention est un
  des appelants oubliés.
- **N5 — l'acompte par défaut est 30 %, pas 0.** `acomptePercent ?? 30` dans
  `genererConventionAction`. Le « 30 » du champ est un vrai défaut de valeur,
  pas un exemple. `AXI-DOC-2026-030` porte donc une clause d'acompte de 30 %
  que personne n'a choisie.

### Documents produits AUTOMATIQUEMENT (cron `documents-auto.production`, :15)

`AXI-DOC-2026-031` Programme · `-032` Règlement intérieur · `-033` Livret
d'accueil · `-034` Questionnaire de positionnement · `-035` Convocation ·
`-036` Organisation de l'action. ✅ **La production documentaire automatique
fonctionne.** Ces six pièces portent encore l'ancien lieu (distanciel).

### Formateur — confirmé

`Trainer.statut = "dirigeant"` pour Williams Jullin. Le système a donc bien
demandé au **dirigeant de l'organisme** d'accepter une mission sur sa propre
session. Sa fiche est par ailleurs **complète** : CV validé le 26/07/2026,
3 domaines vérifiés le 31/07/2026 (IA générative, Formation professionnelle,
Conformité & AI Act — tous « Expert »), veille ind. 22 du 01/08/2026,
22/22 habilitations. ⚠️ Le CV annonce « IA / LLM : **Avancé** » là où la fiche
déclare « Expert » : un certificateur qui recoupe les deux le verra.

### Git

- `7fed255f8` (#988 off.30 appréciation formateur) fusionnée à 17:43 UTC,
  build `33902070264` **en cours** — prod encore sur `8771f7ee4` à 18:13 UTC.

---

## 10. Décisions Will du 2026-09-04 au soir — visio

- ✅ **Zoom validé** comme fournisseur, avec **implémentation API directe**.
- ✅ Couche agnostique conservée : un grand compte qui imposerait Teams reste possible.
- ⛔ **« Je ne veux JAMAIS de lien collé à la main. »** Le mode manuel n'est donc
  pas une option de repli offerte à l'utilisateur : il ne doit pas exister dans
  l'écran. La création de la salle est automatique ou la session distancielle
  ne se crée pas.
- ⛔ **Une commande en distanciel sans Zoom configuré doit BLOQUER**, avec un
  message qui dit quoi faire (souscrire, renseigner les identifiants API).
- ⏳ Abonnement souscrit seulement au premier client distanciel.

### Contraintes Zoom à retenir (à vérifier au contrat avant de s'engager)

- **Un hôte licencié = UNE réunion à la fois.** 50 formations distancielles
  simultanées demandent 50 hôtes licenciés. En pratique la licence suit le
  FORMATEUR, pas la session : 50 sessions en parallèle supposent de toute façon
  50 formateurs. C'est un coût linéaire, à dire à Will avant qu'il ne s'engage.
- **Le rapport de présence ne matche que si l'on passe par l'API `registrants`** :
  chaque inscrit est déclaré avec prénom, nom, e-mail, et le rapport est clé sur
  cet e-mail. Quelqu'un qui rejoindrait par le lien brut apparaîtrait sous un nom
  d'affichage libre — d'où l'interdiction du lien collé à la main, qui devient
  une exigence FONCTIONNELLE et pas seulement de sécurité.

### Émargement en distanciel — décision technique

Le rapport Zoom **ne remplace pas** la signature. Il la **pré-remplit et la
recoupe** : présence détectée → créneau proposé signé, le stagiaire confirme ;
divergence entre les deux sources → alerte. Motifs : un financeur OPCO réclame
des émargements signés, et l'indicateur 13 attend une preuve d'engagement du
bénéficiaire, pas seulement une trace technique de connexion.

## 11. Lot 1 EN COURS — cycle de vie du formateur

Branche `qualiopi/formateur-cycle-vie` (depuis `7fed255f8`).

Fait :
- `prisma/schema.prisma` : `MissionFormateurStatut += sans_reponse`,
  `MissionFormateur.echeanceReponseAt` (nullable, pas de backfill).
- `prisma/migrations/20260904190000_mission_formateur_sans_reponse/`.
- **`src/server/qualiopi/trainers/delai-reponse-mission.ts`** — module PUR :
  `accordRequis`, `echeanceReponse` (min(48 h, J-3), plancher 2 h, plafond =
  démarrage), `instantRelance` (mi-délai), `libelleEcheance`,
  `libelleInfosPratiques`.
- **19 tests verts**, et **prouvés rouges** : 3 mutations reproduisant les
  défauts d'origine (délai fixe 3 j, phrase « une semaine avant » en dur, accord
  demandé à tout le monde) → **9 tests rouges**.
- `mission-formateur.ts` : garde `accordRequis` (le dirigeant ne reçoit plus
  rien), échéance posée à la création, relance à mi-délai, `passerLesSansReponse`
  (bascule + libération de la session), refus de réponse après échéance.

Reste au lot 1 :
- `formateur-mission-proposee.tsx` : consommer `delaiReponse` + `infosPratiques`.
- `affectationsAConvoquer` (worker) : ne PAS envoyer le rappel J-1 à un
  sous-traitant qui n'a pas accepté.
- `evaluateur.ts` : alerte adossée à `echeanceReponseAt`, pas à J-3 fixe.
- Page `espace-formateur/mission/[token]` : écran « trop tard » + message.
- Catalogue d'alertes : code du message reçu après délai.

---

## 12. Lot 1 LIVRÉ — PR #991

`75f4e0f6e` sur `qualiopi/formateur-cycle-vie` → **PR #991 ouverte**, gates en cours.

Contenu : les 6 défauts formateur, le module pur `delai-reponse-mission.ts`, le
statut `sans_reponse`, l'écran « trop tard » + message, et une garde
d'isolation worker.

### 🔑 Leçon du lot, à ne pas perdre

**Un import de plus dans `mission-formateur.ts` fait entrer `next-auth` dans le
graphe du WORKER.** `alertes-service` → `evaluateur` → chaîne admin →
`next-auth`. Trois suites sont devenues INCOLLECTABLES (pas rouges :
incollectables). En production, le worker se déclarerait `ready` puis planterait
à chaque déclenchement — exactement la famille `server-only` qui a tué deux
crons de recrutement le même jour.

Parade posée : `message-apres-delai.ts` extrait, et
`src/server/qualiopi/trainers/__tests__/le-worker-ne-tire-pas-la-chaine-admin.spec.ts`
qui refuse le retour de l'import. **Vue rouge** en remettant l'import.

### Reste à faire (lots 2 et 3)

**Lot 2 — distanciel de bout en bout, adaptateur Zoom**
- Adaptateur Zoom via API `registrants` : une salle par session, **un lien par
  personne**, prénom/nom préremplis, rapport de présence récupéré.
- Couche agnostique `/portail/rejoindre/<jeton>` : jeton lié à l'empreinte de
  l'adresse, fenêtre H-30 min → fin + 2 h, révocable, tracé. L'URL réelle ne
  quitte jamais le serveur. Changer de fournisseur = changer une URL.
- Espace stagiaire : afficher lieu, horaires, formateur, bouton « Rejoindre »
  (aujourd'hui la page ne montre que titre/statut/dates, alors que la
  convocation promet « les modalités pratiques y sont »).
- Rappels stagiaire J-1 et H-1.
- **Contrôle avant vol bloquant** : une session distancielle ne se crée pas si
  Zoom n'est pas relié, ou si aucune licence d'hôte n'est libre sur le créneau.
  ⚠️ Décision Will : les licences sont à l'ORGANISME, jamais au formateur.
- `releve_connexion` : le type de document EXISTE déjà, documenté comme
  alimenté par « un import CSV plateforme distancielle », **sans producteur**.
  C'est la place du rapport Zoom, déjà creusée.
- Émargement : le rapport Zoom **pré-remplit** et **recoupe**, il ne remplace
  pas la signature (l'OPCO exige des émargements signés ; ind. 13 attend une
  preuve d'engagement, pas une trace de connexion). Divergence → alerte.

**Lot 3 — N1/N2/N4/N5 + les 10 frictions**
- N1 `setSessionMontantAction` (le prix n'est écrit qu'à la création).
- N2 modalité modifiable (aujourd'hui figée, d'où `distanciel` + `nos_locaux`
  incohérents possibles).
- N4 `ConventionButton` ne passe jamais `rectificationMotif` → régénération
  filigranée « COPIE ».
- N5 acompte par défaut 30 % invisible (`acomptePercent ?? 30`).
- N3 à trancher : les boutons du bloc Documents répondent-ils à la main ?
- F1→F10, dont F10 (repères « (J-n) » comptés depuis aujourd'hui).
