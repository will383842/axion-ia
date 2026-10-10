# Registre des traitements de données personnelles — octobre 2026

> **Article 30 du RGPD.** Ce registre remplace, pour l'inventaire, celui de mai 2026
> (`_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/RGPD-REGISTRE-ART30.md`), qui ignorait la
> plupart des activités actuelles. Il décrit ce que le **code** fait réellement au
> 2026-10-10 (commit `0bc2fbc1`), et le compare à ce que la politique de
> confidentialité **annonce** (`src/content/legal.ts`).
>
> ⚠️ **Dépôt public : ce document ne contient aucune donnée réelle** (ni nom, ni adresse,
> ni volume relevé en base). Il n'a consulté aucune donnée de production : quand un
> traitement dépend d'un interrupteur posé dans Coolify, c'est écrit « à vérifier ».
>
> Les **écarts** (ce qui ne va pas) sont dans [`ECARTS-2026-10.md`](./ECARTS-2026-10.md).
> Les mêmes informations, en données structurées pour la future page « Conformité RGPD »
> de la console, sont dans [`registre.json`](./registre.json). Ce document et celui des
> écarts sont **générés à partir de `registre.json`** : corriger d'abord le JSON.

## Qui est responsable

|                                           |                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Responsable du traitement                 | AXION IA SAS (marque Axion-IA) — SIREN 108 018 631                         |
| Contact pour les données personnelles     | `contact@axion-ia.com`                                                     |
| Délégué à la protection des données (DPO) | aucun (désignation non obligatoire, même mention que la politique publiée) |
| Autorité de contrôle                      | CNIL                                                                       |

## En bref

- **41 traitements** trouvés (le registre de mai en décrivait une dizaine).
- **24 écarts**, dont 2 critiques, 9 élevés, 10 moyens, 3 faibles.
- **Règle de conservation actuelle** (décision de Will du 2026-10-07, « coupe tous les effacements ») : plus rien n'est effacé automatiquement, sauf (1) la pièce d'identité d'un apporteur dès qu'elle est vérifiée, et les pièces d'identité et RIB d'un dossier refusé ; (2) le **son** des visios (au plus tard 30 jours) ; (3) des données purement techniques (mesures de performance 6 mois, parcours et journaux de génération 12 mois, file d'envoi vers le CRM 30 jours).
- **Comment une personne exerce ses droits aujourd'hui** : en écrivant à `contact@axion-ia.com`. La page `/mes-donnees` n'a pas de formulaire ; l'équipe s'appuie ensuite sur les outils d'export et d'effacement (`/api/gdpr-export`, `/api/gdpr-erase`), sur la console, ou sur le portail pour les stagiaires. Chaque e-mail commercial porte un lien d'opposition en un clic.

## Vue d'ensemble

| N°          | Traitement                                                                           | Personnes                                                                                                                                           | Base légale                                                                                   | Annoncé dans la politique ? | Suppression automatique            | État                                          | Écarts                  |
| ----------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------- | --------------------------------------------- | ----------------------- |
| [T01](#t01) | Demandes de contact et de devis                                                      | Prospects qui remplissent un formulaire du site; Demandeurs du rapport ROI…                                                                         | 6.1.b (mesures précontractuelles) ; 6.1.f (suivi de la relation)                              | ✅ oui                      | aucune suppression automatique     | En service                                    | E05, E07, E09, E10, E11 |
| [T02](#t02) | Réservations d'appel (Calendly) et suivi des rendez-vous                             | Prospects qui réservent un appel sur /appel; Candidats apporteurs qui réservent l'échange de 15 min…                                                | 6.1.b (mesures précontractuelles) ; 6.1.f pour la note de suivi                               | ✅ oui                      | aucune suppression automatique     | En service                                    | E05, E07, E09, E12      |
| [T03](#t03) | Clients et dossier client                                                            | Contacts des entreprises clientes ou prospectes; Clients particuliers…                                                                              | 6.1.b (contrat) ; 6.1.c (obligations comptables) ; 6.1.f (prospects)                          | 🟠 en partie                | aucune suppression automatique     | En service                                    | E04, E05, E12           |
| [T04](#t04) | Enregistrement, transcription et compte rendu des visios (et dictée après un appel)  | Participants aux rendez-vous Google Meet; Williams…                                                                                                 | 6.1.a (accord oral au début de la réunion) ; 6.1.f pour la dictée                             | 🟠 en partie                | suppression automatique partielle  | Tests internes seulement                      | E05, E14                |
| [T05](#t05) | Chatbot du site                                                                      | Visiteurs qui écrivent au chatbot                                                                                                                   | non annoncée (6.1.f ou 6.1.b à décider)                                                       | ❌ non                      | suppression automatique partielle  | Dépend d'un interrupteur (à vérifier en prod) | E02, E03, E05, E08, E14 |
| [T06](#t06) | Envoi du guide IA entreprise                                                         | Personnes qui demandent le guide                                                                                                                    | 6.1.b (exécution de la demande) ; 6.1.f (inscription au CRM au clic)                          | ✅ oui                      | aucune suppression automatique     | En service                                    | —                       |
| [T07](#t07) | Lettre d'information                                                                 | Abonnés                                                                                                                                             | 6.1.f (adresse pro, art. L.34-5 CPCE) ; 6.1.a (adresse perso)                                 | ✅ oui                      | aucune suppression automatique     | En service                                    | E09                     |
| [T08](#t08) | Avis clients                                                                         | Clients qui déposent un avis                                                                                                                        | 6.1.a (consentement à la publication)                                                         | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E07, E19           |
| [T09](#t09) | Demandes de passage dans le podcast                                                  | Dirigeants qui demandent à être invités                                                                                                             | 6.1.b                                                                                         | 🟠 en partie                | aucune suppression automatique     | En service                                    | E09                     |
| [T10](#t10) | Gestion des stagiaires, inscriptions, documents et financements                      | Stagiaires et bénéficiaires; Contacts sur place des clients…                                                                                        | 6.1.b (contrat de formation) ; 6.1.c (obligations des organismes de formation)                | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E04, E07           |
| [T11](#t11) | Référent handicap et besoins d'adaptation                                            | Stagiaires qui déclarent un handicap, un problème de santé ou un besoin d'aménagement                                                               | 6.1.c + 9.2.b/g (obligation d'accessibilité) — à confirmer, ou 9.2.a (consentement explicite) | ❌ non                      | aucune suppression automatique     | En service                                    | E01, E03, E14           |
| [T12](#t12) | Émargement et relevés de présence                                                    | Stagiaires; Formateurs…                                                                                                                             | 6.1.c (obligation légale des organismes de formation) ; 6.1.b                                 | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E04, E07           |
| [T13](#t13) | Évaluations, questionnaires, appréciations, réclamations et incidents                | Stagiaires; Réclamants…                                                                                                                             | 6.1.c / 6.1.f                                                                                 | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E04, E07, E15      |
| [T14](#t14) | Signature électronique des pièces (conventions, devis, lettres de mission, contrats) | Signataires côté client; Stagiaires…                                                                                                                | 6.1.b ; 6.1.c (preuve)                                                                        | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E04, E16           |
| [T15](#t15) | Coaching individuel                                                                  | Bénéficiaires du coaching; Tuteurs en entreprise                                                                                                    | 6.1.b                                                                                         | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E07                |
| [T16](#t16) | Formateurs et salariés (dossier, contrat, pièces, missions, disponibilités)          | Formateurs salariés; Formateurs indépendants et sous-traitants…                                                                                     | 6.1.b (contrat) ; 6.1.c (droit du travail, Qualiopi)                                          | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E04, E07, E11, E15 |
| [T17](#t17) | Rémunération et autofacturation des formateurs                                       | Formateurs salariés et indépendants                                                                                                                 | 6.1.b ; 6.1.c (obligations comptables et fiscales)                                            | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E13                |
| [T18](#t18) | Partenaires et sous-traitants de formation (registres Qualiopi)                      | Interlocuteurs des sociétés sous-traitantes et partenaires                                                                                          | 6.1.b / 6.1.f                                                                                 | ❌ non                      | aucune suppression automatique     | En service                                    | E03, E07                |
| [T19](#t19) | Candidats apporteurs d'affaires (tunnels, relances, invitation)                      | Personnes intéressées par le réseau; Candidats à un emploi à qui le réseau est proposé                                                              | 6.1.b ; 6.1.f (personne recommandée ; candidat emploi à qui on propose le réseau)             | 🟠 en partie                | aucune suppression automatique     | En service                                    | E09, E11, E23           |
| [T20](#t20) | Dossier d'apporteur : contrat, pièces, IBAN, signature                               | Apporteurs; Parrains et filleuls                                                                                                                    | 6.1.b (contrat) ; 6.1.c (vigilance, art. L.8222-1 C. trav.)                                   | 🟠 en partie                | suppression automatique partielle  | En service                                    | E06                     |
| [T21](#t21) | Commissions, autofactures et relevés des apporteurs                                  | Apporteurs                                                                                                                                          | 6.1.b ; 6.1.c (art. L.123-22 C. com.)                                                         | 🟠 en partie                | aucune suppression automatique     | En service                                    | —                       |
| [T22](#t22) | Personnes présentées par un apporteur                                                | Dirigeants et salariés d'entreprises dont un apporteur nous transmet les coordonnées                                                                | 6.1.f (+ information art. 14 au premier message)                                              | ✅ oui                      | aucune suppression automatique     | En service                                    | E17                     |
| [T23](#t23) | Candidatures aux offres d'emploi, entretiens et vivier                               | Candidats qui postulent sur /carrieres; Candidats spontanés                                                                                         | 6.1.b ; 6.1.a (vivier)                                                                        | 🟠 en partie                | aucune suppression automatique     | En service                                    | E05, E07, E09, E12, E18 |
| [T24](#t24) | Monteurs et vidéastes freelance (candidatures vidéo)                                 | Candidats monteurs vidéo et vidéastes freelance; Monteurs en poste                                                                                  | 6.1.b                                                                                         | 🟠 en partie                | aucune suppression automatique     | En service                                    | E09, E12, E13, E18      |
| [T25](#t25) | Synchronisation vers Axion CRM Pro                                                   | Auteurs de formulaires, invités Calendly, demandeurs du guide, abonnés, auteurs d'avis, demandeurs de podcast, leads du chatbot, personnes opposées | 6.1.f                                                                                         | 🟠 en partie                | suppression automatique partielle  | En service                                    | E10, E12, E19           |
| [T26](#t26) | Base de prospection entreprises, organisateurs d'événements, fédérations             | Dirigeants et responsables d'entreprises; Professionnels de santé…                                                                                  | 6.1.f (+ information art. 14)                                                                 | 🟠 en partie                | aucune suppression automatique     | Fait dans une autre application               | E05, E14, E20           |
| [T27](#t27) | Synchronisation vers Axion Partners                                                  | Apporteurs, candidats apporteurs, clients                                                                                                           | 6.1.b / 6.1.f                                                                                 | ❌ non                      | aucune suppression automatique     | Dépend d'un interrupteur (à vérifier en prod) | —                       |
| [T28](#t28) | Mesure d'audience (Plausible), parcours et performance du site                       | Visiteurs du site                                                                                                                                   | 6.1.f (exemption CNIL de mesure d'audience)                                                   | ✅ oui                      | suppression automatique en service | En service                                    | E21                     |
| [T29](#t29) | Traceurs soumis au consentement : Microsoft Clarity, LinkedIn Insight, pixel Meta    | Visiteurs qui acceptent le bandeau cookies                                                                                                          | 6.1.a (consentement, art. 82 loi I&L)                                                         | 🟠 en partie                | suppression automatique en service | Dépend d'un interrupteur (à vérifier en prod) | E21                     |
| [T30](#t30) | Comptes de la console, journal d'activité et anti-abus                               | Administrateurs et membres de l'équipe; Visiteurs qui déclenchent un piège anti-robot…                                                              | 6.1.f (sécurité) ; 6.1.c (art. 32)                                                            | 🟠 en partie                | aucune suppression automatique     | En service                                    | E10, E11                |
| [T31](#t31) | Envoi des e-mails et copies des envois                                               | Toute personne à qui le site écrit                                                                                                                  | 6.1.b / 6.1.f                                                                                 | 🟠 en partie                | aucune suppression automatique     | En service                                    | E04                     |
| [T32](#t32) | Notifications internes (Telegram, WhatsApp)                                          | Toutes les personnes dont une demande déclenche une alerte                                                                                          | 6.1.f                                                                                         | 🟠 en partie                | aucune suppression automatique     | En service                                    | E01, E09, E13           |
| [T33](#t33) | Lecture de la boîte Zoho Mail contact@axion-ia.com                                   | Candidats apporteurs et candidats emploi qui répondent par e-mail; Tout expéditeur de la boîte                                                      | 6.1.f                                                                                         | ✅ oui                      | aucune suppression automatique     | En service                                    | E04                     |
| [T34](#t34) | Gestion des droits RGPD et des preuves de consentement                               | Personnes qui exercent un droit, qui consentent ou qui s'opposent                                                                                   | 6.1.c (art. 7.1, 12 à 21 RGPD)                                                                | ✅ oui                      | aucune suppression automatique     | En service                                    | E07, E24                |
| [T35](#t35) | Sauvegardes                                                                          | Toutes les personnes présentes en base et dans les fichiers                                                                                         | 6.1.f / 6.1.c (art. 32)                                                                       | ❌ non                      | suppression automatique partielle  | En service                                    | E13, E22                |
| [T36](#t36) | Studio vidéo et console éditoriale (invités, transcriptions)                         | Invités du podcast / des vidéos; Membres de l'équipe éditoriale                                                                                     | 6.1.a (autorisation de droit à l'image) / 6.1.b                                               | ❌ non                      | aucune suppression automatique     | Prévu, rien n'est rempli                      | E03, E07                |
| [T37](#t37) | Banque d'images et retours sur la base de connaissances                              | Photographes crédités; Visiteurs qui notent un article de la base de connaissances…                                                                 | 6.1.f                                                                                         | 🟠 en partie                | aucune suppression automatique     | En service                                    | E08                     |
| [T38](#t38) | Facturation clients et encaissements                                                 | Clients                                                                                                                                             | 6.1.b ; 6.1.c (code de commerce, CGI)                                                         | 🟠 en partie                | aucune suppression automatique     | En service                                    | E04, E08, E13           |
| [T39](#t39) | Espace ressources et documents d'intervention                                        | Formateurs et commerciaux destinataires de documents                                                                                                | 6.1.b / 6.1.f                                                                                 | ❌ non                      | suppression automatique partielle  | En service                                    | E03, E11                |
| [T40](#t40) | Documents de la société                                                              | Dirigeant; Salariés…                                                                                                                                | 6.1.c                                                                                         | ❌ non                      | aucune suppression automatique     | En service                                    | —                       |
| [T41](#t41) | Baromètre / observatoire                                                             | Répondants au baromètre                                                                                                                             | 6.1.f                                                                                         | ❌ non                      | aucune suppression automatique     | En service                                    | E03                     |

## Les fiches

### Commercial

<a id="t01"></a>

#### T01 — Demandes de contact et de devis

**État :** En service · **Annoncé dans la politique :** ✅ oui · **Écarts :** E05, E07, E09, E10, E11

|                          |                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Prospects qui remplissent un formulaire du site (audit, devis, formation, implémentation, presse, partenariat, investisseur, intervention, support)<br>• Demandeurs du rapport ROI (simulateur)<br>• Visiteurs dont le chatbot capte les coordonnées                                                                                                                        |
| **Données**              | • Nom, e-mail, téléphone (chiffrés)<br>• Entreprise, SIREN, secteur, adresse, effectif, fonction<br>• Message libre, budget, délai, ville<br>• Provenance (UTM, page d'origine), user-agent, référent<br>• Adresse IP en clair (colonne dite « dépréciée » mais toujours écrite) et empreinte d'IP<br>• Notes internes de l'équipe, réponses envoyées par l'équipe (en clair) |
| **Pourquoi (finalité)**  | Répondre à la demande, préparer un devis, suivre la relation commerciale.                                                                                                                                                                                                                                                                                                     |
| **Base légale**          | 6.1.b (mesures précontractuelles) ; 6.1.f (suivi de la relation) — Annoncé dans la politique (« Exécution contractuelle… intérêt légitime… suivi de la relation »).                                                                                                                                                                                                           |
| **Durée annoncée**       | « Demandes commerciales : conservées pour garder la trace de nos échanges ; elles ne sont pas supprimées automatiquement, et vous pouvez en demander l'effacement à tout moment. » <br>_Source : src/content/legal.ts — section « Durée de conservation »_                                                                                                                    |
| **Durée réelle (code)**  | **aucune suppression automatique.** Aucune suppression automatique (purge des demandes archivées retirée le 2026-10-07). Corbeille récupérable en console ; effacement définitif réservé au super-administrateur.                                                                                                                                                             |
| **Sécurité**             | • Nom, e-mail, téléphone chiffrés AES-256-GCM (encryptPii)<br>• Empreinte HMAC de l'e-mail pour l'export/effacement<br>• Anti-robot Turnstile, champ leurre, limitation de débit<br>• ⚠️ Lecture des demandes déchiffrées possible avec le rôle « reader »                                                                                                                    |
| **Droits, aujourd'hui**  | E-mail à contact@axion-ia.com ; export et effacement par /api/gdpr-export et /api/gdpr-erase (lien reçu par e-mail) ; effacement console.<br>**Manque :** • Les réponses envoyées par l'équipe (SubmissionReply) ne sont ni exportées ni effacées<br>• L'empreinte d'IP n'est pas effacée                                                                                     |
| **Fichiers sources**     | `src/features/unified-contact/actions.ts`, `src/features/roi-report/actions.ts`, `src/features/admin-submissions/`, `src/features/admin-inbox/queries.ts`, `prisma/schema.prisma (Submission, SubmissionReply)`                                                                                                                                                               |

| Destinataire                              | Ce qu'il reçoit                                                                                | Pays                 | Hors UE | Sur /sous-processeurs |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- | ------- | --------------------- |
| Telegram (messagerie interne de l'équipe) | alerte immédiate : nom, e-mail, téléphone, 500 premiers caractères du message, en clair        | Émirats arabes unis  | oui     | oui                   |
| ZeptoMail (Zoho)                          | accusé de réception et réponses de l'équipe                                                    | UE                   | non     | oui                   |
| Axion CRM Pro                             | copie du contact (e-mail, nom, téléphone, entreprise, ville, consentement ; jamais le message) | UE (serveur Hetzner) | non     | outil interne         |
| Cloudflare (Turnstile)                    | anti-robot : jeton et adresse IP                                                               | États-Unis           | oui     | oui                   |
| WhatsApp via CallMeBot                    | alerte sans donnée personnelle (catégorie et heure seulement)                                  | inconnu              | oui     | **NON**               |

<a id="t02"></a>

#### T02 — Réservations d'appel (Calendly) et suivi des rendez-vous

**État :** En service · **Annoncé dans la politique :** ✅ oui · **Écarts :** E05, E07, E09, E12

|                          |                                                                                                                                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Prospects qui réservent un appel sur /appel<br>• Candidats apporteurs qui réservent l'échange de 15 min<br>• Visiteurs de salon (GOFAB et autres rendez-vous « salon »)<br>• Invités ajoutés à une réservation                                                                                          |
| **Données**              | • Nom, e-mail, téléphone (en clair)<br>• Réponses au formulaire de réservation, besoin<br>• Lien de visio ou numéro, date, liens d'annulation<br>• Provenance (UTM, référent)<br>• Contenu complet reçu de Calendly<br>• Note de suivi rédigée par l'équipe, note sur 20, décision                        |
| **Pourquoi (finalité)**  | Prendre et rappeler les rendez-vous, préparer l'échange, suivre la relation commerciale.                                                                                                                                                                                                                  |
| **Base légale**          | 6.1.b (mesures précontractuelles) ; 6.1.f pour la note de suivi — La politique décrit le rendez-vous et les données saisies (section « Rendez-vous de découverte »).                                                                                                                                      |
| **Durée annoncée**       | « Seules les informations que vous saisissez au moment de la réservation […] sont conservées, dans les conditions décrites ci-dessus » (= demandes commerciales : pas de suppression automatique). <br>_Source : src/content/visio-annonce-textes.ts (section « Rendez-vous de découverte » de legal.ts)_ |
| **Durée réelle (code)**  | **aucune suppression automatique.** Purge des rendez-vous Calendly retirée le 2026-10-07 : conservation sans limite.                                                                                                                                                                                      |
| **Sécurité**             | • Accès réservé aux rôles super_admin, admin, editor<br>• Coordonnées masquées pour les autres rôles dans la boîte de réception<br>• ⚠️ Aucune donnée chiffrée dans la table des rendez-vous                                                                                                              |
| **Droits, aujourd'hui**  | E-mail ; export et effacement (anonymisation) par /api/gdpr-*.<br>**Manque :** • Un invité ajouté à la réservation n'est pas retrouvé : la recherche ne porte que sur la personne qui a réservé                                                                                                           |
| **Fichiers sources**     | `src/server/calendly/`, `src/features/admin-calendly/`, `src/features/admin-rendezvous/`, `src/server/google-calendar/`, `src/app/api/calendly/`                                                                                                                                                          |

| Destinataire             | Ce qu'il reçoit                                                                     | Pays                 | Hors UE | Sur /sous-processeurs |
| ------------------------ | ----------------------------------------------------------------------------------- | -------------------- | ------- | --------------------- |
| Calendly                 | prise de rendez-vous ; notre serveur crée et lit les réservations                   | États-Unis           | oui     | oui                   |
| Google Agenda            | rendez-vous ajoutés depuis la console (nom, téléphone, note)                        | Irlande / monde      | oui     | oui                   |
| Google Meet              | tenue de la visio                                                                   | Irlande / monde      | oui     | oui                   |
| Telegram                 | alerte : nom, e-mail, téléphone, heure, réponses, en clair                          | Émirats arabes unis  | oui     | oui                   |
| ZeptoMail                | confirmation et rappels J-2, J-1, H-1                                               | UE                   | non     | oui                   |
| Axion CRM Pro            | copie du rendez-vous (sans le téléphone dans les réponses)                          | UE                   | non     | outil interne         |
| Plausible (auto-hébergé) | événement d'audience côté serveur                                                   | Allemagne            | non     | oui                   |
| Meta (API Conversions)   | événement « Schedule » pour un candidat apporteur venu de Facebook, si consentement | Irlande / États-Unis | oui     | oui                   |

<a id="t03"></a>

#### T03 — Clients et dossier client

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E04, E05, E12

|                          |                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Contacts des entreprises clientes ou prospectes<br>• Clients particuliers<br>• Personnes simplement citées dans un dossier                                                                                                                                                                                                                                            |
| **Données**              | • Nom, fonction, e-mail, téléphone des contacts (en clair)<br>• Notes, contexte, besoins identifiés<br>• Projets, devis, brouillons de vente<br>• Documents du projet (fichiers en base, non chiffrés)<br>• Questionnaires de cadrage et réponses (chiffrés)<br>• E-mails de suivi<br>• Opposition au traitement par IA<br>• Fichiers partagés (stockage Cloudflare R2) |
| **Pourquoi (finalité)**  | Gérer la relation client, établir devis et propositions, préparer et suivre les prestations.                                                                                                                                                                                                                                                                            |
| **Base légale**          | 6.1.b (contrat) ; 6.1.c (obligations comptables) ; 6.1.f (prospects) — « Exécution contractuelle (RGPD art. 6.1.b) pour les clients ».                                                                                                                                                                                                                                  |
| **Durée annoncée**       | « Données clients : 5 ans après fin de prestation (obligation comptable française). » <br>_Source : src/content/legal.ts — section « Durée de conservation »_                                                                                                                                                                                                           |
| **Durée réelle (code)**  | **aucune suppression automatique.** Aucune suppression automatique : les échéances de 3 ans (prospect) et 5 ans (client) calculées par le code ne sont plus appliquées depuis le 2026-10-07. Garde sans limite.                                                                                                                                                         |
| **Sécurité**             | • Fiche : écriture réservée aux rôles d'écriture<br>• Échanges, faits, comptes rendus : super_admin et admin seulement<br>• Fichiers analysés par antivirus (ClamAV)<br>• ⚠️ Coordonnées des contacts et documents non chiffrés                                                                                                                                         |
| **Droits, aujourd'hui**  | E-mail ; export du dossier par /api/gdpr-export ; effacement ciblé par /api/gdpr-erase (la fiche liée à une facture est conservée, art. 17.3.b).<br>**Manque :** • Aucune action de console pour l'effacement ciblé<br>• Le titre d'un projet qui nomme une personne n'est pas réécrit                                                                                  |
| **Fichiers sources**     | `src/features/dossier-client/`, `src/server/clients/`, `src/features/personne/`, `src/server/partages/`, `src/lib/rgpd-dossier-client.ts`                                                                                                                                                                                                                               |

| Destinataire                       | Ce qu'il reçoit                                                                                     | Pays                  | Hors UE | Sur /sous-processeurs |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------- | ------- | --------------------- |
| Hetzner                            | hébergement de la base                                                                              | Allemagne             | non     | oui                   |
| Cloudflare R2                      | fichiers partagés                                                                                   | États-Unis (stockage) | oui     | oui                   |
| ZeptoMail                          | e-mails au client                                                                                   | UE                    | non     | oui                   |
| API Recherche d'entreprises (État) | vérification du SIREN / de la raison sociale                                                        | France                | non     | service public        |
| OpenAI                             | questionnaire et e-mail de suivi rédigés par IA — seulement sur une rencontre de test (mode pilote) | États-Unis            | oui     | oui                   |
| Axion CRM Pro                      | suivi de la relation                                                                                | UE                    | non     | outil interne         |

<a id="t04"></a>

#### T04 — Enregistrement, transcription et compte rendu des visios (et dictée après un appel)

**État :** Tests internes seulement · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E05, E14

|                          |                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Participants aux rendez-vous Google Meet<br>• Williams (sa piste, ses dictées)<br>• Personnes citées pendant l'échange                                                                                                                                                                                                                                         |
| **Données**              | • Son en deux pistes (morceaux de 10 s chiffrés)<br>• Transcription horodatée (chiffrée)<br>• Compte rendu et faits extraits avec leur citation (chiffrés)<br>• Preuve d'accord (texte de l'annonce et réponse, chiffrés)                                                                                                                                        |
| **Données sensibles**    | Voix (enregistrement audio)                                                                                                                                                                                                                                                                                                                                      |
| **Pourquoi (finalité)**  | Tirer un compte rendu fidèle, relu et validé par Williams, et les faits utiles au projet du client.                                                                                                                                                                                                                                                              |
| **Base légale**          | 6.1.a (accord oral au début de la réunion) ; 6.1.f pour la dictée — Texte prêt dans visio-annonce-textes.ts, NON publié tant que ETAT_COMPTES_RENDUS_VISIO = « pending_activation ».                                                                                                                                                                             |
| **Durée annoncée**       | Aujourd'hui : « Ces rendez-vous ne sont ni enregistrés ni transcrits. » Après activation : son effacé à la validation du compte rendu, au plus tard 30 jours ; le reste sans suppression automatique. <br>_Source : src/content/visio-annonce-textes.ts (RDV_DECOUVERTE, CONSERVATION_VISIO)_                                                                    |
| **Durée réelle (code)**  | **suppression automatique partielle.** Le son est bien effacé (validation, refus, retrait d'accord, au plus tard 30 jours). Transcription, comptes rendus, faits, preuves : plus aucune purge depuis le 2026-10-07.                                                                                                                                              |
| **Sécurité**             | • Chiffrement strict sans repli en clair (chiffrer-parole)<br>• Accès super_admin et admin<br>• Extension d'enregistrement authentifiée par jeton d'appareil (90 jours)<br>• Refus si le client est opposé à l'IA ou si son préavis court<br>• Mode effectif bridé à « pilote » (rencontres de test) tant que la notice n'est pas publiée ; dictée refusée (503) |
| **Droits, aujourd'hui**  | Retrait de l'accord en console ; export des paroles du demandeur et effacement ciblé par /api/gdpr-*.                                                                                                                                                                                                                                                            |
| **Fichiers sources**     | `src/server/visio/`, `src/features/admin-enregistreur/`, `src/features/dossier-client/compte-rendu-gestes.ts`, `src/content/visio-annonce-textes.ts`, `extensions/enregistreur-meet/`                                                                                                                                                                            |

| Destinataire            | Ce qu'il reçoit                              | Pays                  | Hors UE | Sur /sous-processeurs |
| ----------------------- | -------------------------------------------- | --------------------- | ------- | --------------------- |
| OpenAI (comptes rendus) | transcription et rédaction — DPA « pending » | États-Unis            | oui     | oui                   |
| Cloudflare R2           | son chiffré, temporaire                      | États-Unis (stockage) | oui     | oui                   |
| Telegram                | alertes techniques du circuit, sans contenu  | Émirats arabes unis   | oui     | oui                   |

<a id="t05"></a>

#### T05 — Chatbot du site

**État :** Dépend d'un interrupteur (à vérifier en prod) · **Annoncé dans la politique :** ❌ non · **Écarts :** E02, E03, E05, E08, E14

|                          |                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Visiteurs qui écrivent au chatbot                                                                                                                                                                                                                                                                                                     |
| **Données**              | • Texte libre tapé par le visiteur (peut contenir nom, e-mail, situation)<br>• Résumé de la conversation, profil déduit (structure, secteur, besoin, maturité)<br>• Page d'origine, empreinte d'IP<br>• Coordonnées si le visiteur les laisse (deviennent une demande T01)<br>• Questions transmises à l'équipe (escalade, avec e-mail) |
| **Pourquoi (finalité)**  | Répondre aux questions des visiteurs et transmettre une demande à l'équipe.                                                                                                                                                                                                                                                             |
| **Base légale**          | non annoncée (6.1.f ou 6.1.b à décider) — Le chatbot n'est pas décrit dans la politique.                                                                                                                                                                                                                                                |
| **Durée annoncée**       | Rien d'annoncé pour le chatbot. <br>_Source : src/content/legal.ts_                                                                                                                                                                                                                                                                     |
| **Durée réelle (code)**  | **suppression automatique partielle.** Conversations, messages et escalades : plus de purge depuis le 2026-10-07. Seuls le cache de réponses et la table d'idempotence sont effacés à 12 mois.                                                                                                                                          |
| **Sécurité**             | • Empreinte d'IP<br>• Lecture en console pour tous les rôles                                                                                                                                                                                                                                                                            |
| **Droits, aujourd'hui**  | E-mail ; export/effacement par /api/gdpr-* uniquement si la conversation est liée à un lead ou une escalade.<br>**Manque :** • Une conversation anonyme où le visiteur a tapé ses données est introuvable                                                                                                                               |
| **Fichiers sources**     | `src/server/chatbot/`, `src/app/api/chatbot/`, `src/features/admin-chatbot/`, `src/lib/rgpd-export-chat.ts`                                                                                                                                                                                                                             |

| Destinataire                     | Ce qu'il reçoit                                                       | Pays                | Hors UE | Sur /sous-processeurs |
| -------------------------------- | --------------------------------------------------------------------- | ------------------- | ------- | --------------------- |
| OpenAI (par défaut) ou Anthropic | génération des réponses : les messages du visiteur partent tels quels | États-Unis          | oui     | **NON**               |
| Voyage AI                        | classement des passages : reçoit la question du visiteur              | États-Unis          | oui     | **NON**               |
| Telegram                         | lead (nom, e-mail, téléphone, besoin) et escalades                    | Émirats arabes unis | oui     | oui                   |
| Axion CRM Pro                    | lead capté                                                            | UE                  | non     | outil interne         |

### Marketing

<a id="t06"></a>

#### T06 — Envoi du guide IA entreprise

**État :** En service · **Annoncé dans la politique :** ✅ oui

|                          |                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Personnes qui demandent le guide (/guide-ia, encart d'article, envoi depuis la console)                                                                                                                |
| **Données**              | • E-mail, page d'origine, langue<br>• Version du texte d'information présenté<br>• Dates d'envoi, d'affichage du lien, de clic<br>• Empreintes de l'e-mail et de l'IP (registre de preuve)               |
| **Pourquoi (finalité)**  | Envoyer le guide demandé ; savoir s'il a été ouvert.                                                                                                                                                     |
| **Base légale**          | 6.1.b (exécution de la demande) ; 6.1.f (inscription au CRM au clic) — Décrit en détail dans la section « Guide IA entreprise et lettre d'information ».                                                 |
| **Durée annoncée**       | « … sont conservées pour garder la trace de nos échanges ; elles ne sont pas supprimées automatiquement. » <br>_Source : src/content/legal.ts — section « Guide IA entreprise et lettre d'information »_ |
| **Durée réelle (code)**  | **aucune suppression automatique.** Aucune suppression automatique (purgerLettreEtGuide retirée du planning). Conforme à l'annonce.                                                                      |
| **Sécurité**             | • Jetons aléatoires<br>• Empreintes HMAC/SHA-256 salées dans le registre de preuve<br>• Anti-robot Turnstile, vérification MX                                                                            |
| **Droits, aujourd'hui**  | Lien de désinscription en un clic ; export et effacement par /api/gdpr-* ; effacement console.                                                                                                           |
| **Fichiers sources**     | `src/features/guide-ia/`, `src/server/guide-ia/`, `src/app/api/guide-ia/telecharger/`, `src/server/crm-sync/lettre-guide.ts`                                                                             |

| Destinataire  | Ce qu'il reçoit                                                                           | Pays                | Hors UE | Sur /sous-processeurs |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------- | ------- | --------------------- |
| ZeptoMail     | envoi du guide                                                                            | UE                  | non     | oui                   |
| Telegram      | alerte avec adresse masquée                                                               | Émirats arabes unis | oui     | oui                   |
| Axion CRM Pro | contact créé au clic sur le guide (interrupteur CRM_SYNC_GUIDE_ENABLED, fermé par défaut) | UE                  | non     | outil interne         |

<a id="t07"></a>

#### T07 — Lettre d'information

**État :** En service · **Annoncé dans la politique :** ✅ oui · **Écarts :** E09

|                          |                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Abonnés (adresse professionnelle : intérêt légitime ; adresse personnelle : case cochée)                                                                                       |
| **Données**              | • E-mail, langue, statut, provenance<br>• Dates d'inscription, confirmation, désinscription, rebond<br>• Version du texte présenté, empreinte d'IP                               |
| **Pourquoi (finalité)**  | Envoyer 1 à 2 e-mails par mois. Aucune lettre n'est envoyée à ce jour (MailWizz/PowerMTA non en service).                                                                        |
| **Base légale**          | 6.1.f (adresse pro, art. L.34-5 CPCE) ; 6.1.a (adresse perso) — Annoncé.                                                                                                         |
| **Durée annoncée**       | « … ne sont pas supprimées automatiquement. Après une désinscription, votre adresse reste conservée pour qu'aucun envoi ne vous parvienne. » <br>_Source : src/content/legal.ts_ |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme : purge des désinscrits retirée du planning.                                                                                        |
| **Sécurité**             | • Jetons aléatoires, IP hachée (colonne IP en clair supprimée le 2026-09-25)                                                                                                     |
| **Droits, aujourd'hui**  | Désinscription en un clic ; export/effacement /api/gdpr-* ; effacement console.                                                                                                  |
| **Fichiers sources**     | `src/features/newsletter/`, `src/server/newsletter/`, `src/features/admin-newsletter/`                                                                                           |

| Destinataire  | Ce qu'il reçoit                                                       | Pays                | Hors UE | Sur /sous-processeurs |
| ------------- | --------------------------------------------------------------------- | ------------------- | ------- | --------------------- |
| ZeptoMail     | confirmation d'inscription                                            | UE                  | non     | oui                   |
| Telegram      | alerte d'inscription (adresse en clair d'après l'inventaire Telegram) | Émirats arabes unis | oui     | oui                   |
| Axion CRM Pro | inscription confirmée, désinscriptions                                | UE                  | non     | outil interne         |

<a id="t08"></a>

#### T08 — Avis clients

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E07, E19

|                          |                                                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Clients qui déposent un avis                                                                                                                                                          |
| **Données**              | • Prénom, initiale du nom, entreprise, ville<br>• Titre et commentaire<br>• Photo (portrait ou logo)<br>• E-mail (chiffré, sans empreinte)<br>• Empreinte d'IP, version du consentement |
| **Données sensibles**    | Photographie (image de la personne)                                                                                                                                                     |
| **Pourquoi (finalité)**  | Publier les avis après modération.                                                                                                                                                      |
| **Base légale**          | 6.1.a (consentement à la publication) — Non décrit dans la politique.                                                                                                                   |
| **Durée annoncée**       | Rien d'annoncé. <br>_Source : src/content/legal.ts_                                                                                                                                     |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conservation sans limite ; suppression manuelle par le super-administrateur.                                                                        |
| **Sécurité**             | • E-mail chiffré<br>• Photos sur le volume du serveur, sauvegardées dans R2                                                                                                             |
| **Droits, aujourd'hui**  | E-mail puis suppression manuelle en console.<br>**Manque :** • Ni export ni effacement par /api/gdpr-* : l'e-mail chiffré sans empreinte est introuvable                                |
| **Fichiers sources**     | `src/features/review-submission/actions.ts`, `src/features/admin-reviews/`, `src/server/reviews/`                                                                                       |

| Destinataire  | Ce qu'il reçoit                                                        | Pays                | Hors UE | Sur /sous-processeurs |
| ------------- | ---------------------------------------------------------------------- | ------------------- | ------- | --------------------- |
| Telegram      | prénom, initiale, extrait                                              | Émirats arabes unis | oui     | oui                   |
| Axion CRM Pro | reçoit le NOM DE FAMILLE COMPLET, qui n'est même pas gardé sur le site | UE                  | non     | outil interne         |
| ZeptoMail     | e-mails de confirmation                                                | UE                  | non     | oui                   |

<a id="t09"></a>

#### T09 — Demandes de passage dans le podcast

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E09

|                          |                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Dirigeants qui demandent à être invités                                                                             |
| **Données**              | • Nom, e-mail, téléphone (chiffrés)<br>• Entreprise, ville, code postal, activité<br>• Empreinte d'IP, notes internes |
| **Pourquoi (finalité)**  | Étudier la demande et organiser l'enregistrement.                                                                     |
| **Base légale**          | 6.1.b — Couvert implicitement par « demandes commerciales ».                                                          |
| **Durée annoncée**       | Comme les demandes commerciales : pas de suppression automatique. <br>_Source : src/content/legal.ts_                 |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme.                                                                         |
| **Sécurité**             | • Coordonnées chiffrées                                                                                               |
| **Droits, aujourd'hui**  | Export et effacement par /api/gdpr-* ; suppression console.                                                           |
| **Fichiers sources**     | `src/features/podcast-request/`, `src/features/admin-podcast-requests/`                                               |

| Destinataire  | Ce qu'il reçoit               | Pays                | Hors UE | Sur /sous-processeurs |
| ------------- | ----------------------------- | ------------------- | ------- | --------------------- |
| Telegram      | nom, e-mail, téléphone, ville | Émirats arabes unis | oui     | oui                   |
| ZeptoMail     | accusé de réception           | UE                  | non     | oui                   |
| Axion CRM Pro | contact                       | UE                  | non     | outil interne         |

### Formation (Qualiopi)

<a id="t10"></a>

#### T10 — Gestion des stagiaires, inscriptions, documents et financements

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E04, E07

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Stagiaires et bénéficiaires (CPF, OPCO, France Travail)<br>• Contacts sur place des clients<br>• Contacts des financeurs                                                                                                                                                                                                                                                                                                                                                  |
| **Données**              | • Nom, prénom, e-mail, téléphone, entreprise, fonction (en clair)<br>• Inscriptions, statut, motif de sortie (texte libre), taux de présence<br>• Adaptations réalisées (texte libre en clair)<br>• Numéro de dossier OPCO, type de financement, montants<br>• Documents générés : convention, convocation, attestation, certificat de réalisation (PDF sur R2)<br>• Factures de formation (destinataire, adresse)<br>• Accès au portail stagiaire (jeton, cookie 90 jours) |
| **Pourquoi (finalité)**  | Exécuter l'action de formation, produire les preuves Qualiopi, le BPF et les pièces pour les financeurs.                                                                                                                                                                                                                                                                                                                                                                    |
| **Base légale**          | 6.1.b (contrat de formation) ; 6.1.c (obligations des organismes de formation) — Annoncé dans la convention (art. 6), le livret d'accueil et le règlement intérieur ; pas dans la politique du site.                                                                                                                                                                                                                                                                        |
| **Durée annoncée**       | Livret d'accueil : « conservées pendant 5 ans à compter de la fin de votre formation ». Règlement intérieur : « conservées pendant cinq (5) ans ». Convention : « conservation des pièces justificatives pendant cinq (5) ans ». <br>_Source : src/server/qualiopi/documents/templates/livret-accueil.tsx, reglement-interieur.tsx, convention.tsx_                                                                                                                         |
| **Durée réelle (code)**  | **aucune suppression automatique.** Une date « suppression prévue » (+5 ans) est écrite sur les documents, mais AUCUN code ne l'applique (script de simulation seulement). Garde sans limite.                                                                                                                                                                                                                                                                               |
| **Sécurité**             | • Rôles de console et habilitations (requireAdminRead/Write, requireHabilitation)<br>• Chaque action Qualiopi est journalisée<br>• Lecture des PDF par lien signé de 15 min                                                                                                                                                                                                                                                                                                 |
| **Droits, aujourd'hui**  | Depuis le portail stagiaire : demande d'export ou de suppression, traitée à la main en console sous 30 jours (accusé de réception). E-mail.<br>**Manque :** • /api/gdpr-* ne couvre pas les stagiaires<br>• L'export omet réclamations, signatures de documents, factures, incidents<br>• La suppression laisse intacts : motif de sortie, adaptations réalisées, PDF qui portent le nom, réclamations, appréciations, factures, relevés de connexion                       |
| **Fichiers sources**     | `src/server/qualiopi/`, `src/server/actions/qualiopi/trainees.ts`, `src/server/actions/qualiopi/enrollments.ts`, `src/server/qualiopi/portail/`, `src/app/[locale]/portail/`, `src/server/qualiopi/financements/`, `src/server/qualiopi/legal/retention-echeance.ts`                                                                                                                                                                                                        |

| Destinataire               | Ce qu'il reçoit                                                   | Pays                  | Hors UE | Sur /sous-processeurs |
| -------------------------- | ----------------------------------------------------------------- | --------------------- | ------- | --------------------- |
| Cloudflare R2              | documents PDF                                                     | États-Unis (stockage) | oui     | oui                   |
| ZeptoMail                  | convocations, conventions, attestations, liens d'accès            | UE                    | non     | oui                   |
| Entreprise cliente et OPCO | pièces de remboursement (envoi validé à la main ou ZIP à déposer) | France                | non     | service public        |

<a id="t11"></a>

#### T11 — Référent handicap et besoins d'adaptation

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E01, E03, E14

|                          |                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Stagiaires qui déclarent un handicap, un problème de santé ou un besoin d'aménagement                                                                                                        |
| **Données**              | • Case « situation de handicap »<br>• Détail de la situation (chiffré)<br>• Détail d'adaptation du questionnaire de positionnement (chiffré)<br>• Adaptations réalisées (texte libre en clair) |
| **Données sensibles**    | Données de santé (art. 9 RGPD)                                                                                                                                                                 |
| **Pourquoi (finalité)**  | Adapter la formation (obligation Qualiopi, indicateurs 20 et 26).                                                                                                                              |
| **Base légale**          | 6.1.c + 9.2.b/g (obligation d'accessibilité) — à confirmer, ou 9.2.a (consentement explicite) — Aucune base écrite dans la politique ; le livret ne parle pas de santé.                        |
| **Durée annoncée**       | Rien de spécifique (5 ans pour l'ensemble des données de formation). <br>_Source : livret-accueil.tsx_                                                                                         |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite ; effacé (détail chiffré) seulement si une suppression est traitée en console.                                                           |
| **Sécurité**             | • Détail chiffré par un point d'entrée unique<br>• Lecture du détail : super-administrateur seulement, journalisée<br>• ⚠️ « Adaptations réalisées » en clair                                  |
| **Droits, aujourd'hui**  | Consultation sur le portail ; export (détail déchiffré) et suppression via demande portail.<br>**Manque :** • « Adaptations réalisées » non effacé par la suppression                          |
| **Fichiers sources**     | `src/server/actions/qualiopi/portail.ts (l. 405 et 767)`, `src/server/qualiopi/adaptation/detail-sante-chiffre.ts`, `src/server/qualiopi/positionnement/`                                      |

| Destinataire | Ce qu'il reçoit                                                                         | Pays                | Hors UE | Sur /sous-processeurs |
| ------------ | --------------------------------------------------------------------------------------- | ------------------- | ------- | --------------------- |
| Telegram     | ⚠️ « Prénom Nom a déclaré une situation de handicap ou un problème de santé… » EN CLAIR | Émirats arabes unis | oui     | oui                   |
| Formateur    | voit seulement « besoin d'adaptation : oui »                                            | France              | non     | outil interne         |

<a id="t12"></a>

#### T12 — Émargement et relevés de présence

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E04, E07

|                          |                                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Stagiaires<br>• Formateurs (contresignature)<br>• Tuteurs<br>• Participants d'une visio importés d'un fichier Zoom/Teams/Meet (y compris non stagiaires)                                                                                         |
| **Données**              | • Nom, e-mail du signataire<br>• IMAGE de la signature manuscrite (R2)<br>• Empreintes d'IP et de navigateur, chaîne d'intégrité<br>• Créneaux, heures de connexion/déconnexion<br>• Fichier brut des relevés de connexion (noms, e-mails, durées) |
| **Données sensibles**    | Signature manuscrite                                                                                                                                                                                                                               |
| **Pourquoi (finalité)**  | Prouver l'assiduité (indicateur 12), établir le certificat de réalisation, justifier auprès des financeurs.                                                                                                                                        |
| **Base légale**          | 6.1.c (obligation légale des organismes de formation) ; 6.1.b — Annoncé dans la convention (« données d'émargement »).                                                                                                                             |
| **Durée annoncée**       | 5 ans (convention, livret, règlement intérieur). <br>_Source : templates Qualiopi_                                                                                                                                                                 |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite. Images d'émargement purgées seulement lors d'une suppression traitée en console ; images de contresignature des formateurs jamais purgées.                                                  |
| **Sécurité**             | • Jetons hachés, IP et navigateur hachés<br>• Chaîne d'empreintes scellée (inaltérabilité)                                                                                                                                                         |
| **Droits, aujourd'hui**  | Via la demande portail (stagiaires).<br>**Manque :** • Les participants non stagiaires du fichier de relevés n'ont aucun moyen de savoir ni d'agir<br>• Formateurs : rien                                                                          |
| **Fichiers sources**     | `src/server/qualiopi/emargement/`, `src/server/qualiopi/presence/`, `src/server/actions/qualiopi/presence.ts`                                                                                                                                      |

| Destinataire  | Ce qu'il reçoit                                        | Pays                  | Hors UE | Sur /sous-processeurs |
| ------------- | ------------------------------------------------------ | --------------------- | ------- | --------------------- |
| Cloudflare R2 | images de signature, feuilles PDF, fichiers de relevés | États-Unis (stockage) | oui     | oui                   |
| ZeptoMail     | liens d'émargement                                     | UE                    | non     | oui                   |

<a id="t13"></a>

#### T13 — Évaluations, questionnaires, appréciations, réclamations et incidents

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E04, E07, E15

|                          |                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Stagiaires<br>• Réclamants<br>• Formateurs mis en cause dans un incident                                                                                                                                                                                                                                                            |
| **Données**              | • Scores, niveau, compétences, recommandations<br>• Réponses aux questionnaires, note globale<br>• Appréciations (commentaire avec nom et fonction du répondant, peut juger le formateur)<br>• Réclamations : nom, e-mail, objet, description, réponse<br>• Incidents : faits reprochés à un intervenant, niveau de vigilance calculé |
| **Pourquoi (finalité)**  | Mesurer les acquis et la satisfaction, traiter les réclamations, suivre la fiabilité des intervenants (Qualiopi).                                                                                                                                                                                                                     |
| **Base légale**          | 6.1.c / 6.1.f — Évaluations annoncées (convention, livret) ; réclamations et notation des intervenants non annoncées.                                                                                                                                                                                                                 |
| **Durée annoncée**       | 5 ans (documents Qualiopi). <br>_Source : templates Qualiopi_                                                                                                                                                                                                                                                                         |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite.                                                                                                                                                                                                                                                                                |
| **Sécurité**             | • Lectures gardées par requireAdminRead ; actions journalisées                                                                                                                                                                                                                                                                        |
| **Droits, aujourd'hui**  | Demande portail pour les stagiaires ; e-mail.<br>**Manque :** • Réclamations jamais exportées ni effacées<br>• Commentaires d'appréciation non effacés                                                                                                                                                                                |
| **Fichiers sources**     | `src/server/qualiopi/evaluations/`, `src/server/qualiopi/satisfaction/`, `src/server/actions/qualiopi/reclamations.ts`, `src/server/qualiopi/trainers/fiabilite-service.ts`                                                                                                                                                           |

| Destinataire | Ce qu'il reçoit | Pays      | Hors UE | Sur /sous-processeurs |
| ------------ | --------------- | --------- | ------- | --------------------- |
| Hetzner      | hébergement     | Allemagne | non     | oui                   |

<a id="t14"></a>

#### T14 — Signature électronique des pièces (conventions, devis, lettres de mission, contrats)

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E04, E16

|                          |                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Signataires côté client<br>• Stagiaires<br>• Formateurs et salariés                                                                                                           |
| **Données**              | • Nom, e-mail, qualité du signataire<br>• Image de la signature (R2)<br>• Empreintes d'IP et de navigateur, chaîne d'intégrité<br>• Administrateur qui a recueilli la signature |
| **Données sensibles**    | Signature manuscrite                                                                                                                                                            |
| **Pourquoi (finalité)**  | Recueillir et prouver la signature des pièces contractuelles.                                                                                                                   |
| **Base légale**          | 6.1.b ; 6.1.c (preuve) — Non décrit dans la politique (DocuSeal y est cité, mais n'est plus utilisé).                                                                           |
| **Durée annoncée**       | 5 ans (« suppression prévue » écrite sur la ligne). <br>_Source : src/server/qualiopi/legal/retention-echeance.ts_                                                              |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite ; images de signature jamais purgées.                                                                                     |
| **Sécurité**             | • Jetons hachés, IP et navigateur hachés<br>• Chaîne d'empreintes                                                                                                               |
| **Droits, aujourd'hui**  | Effacement /api/gdpr-* : jetons révoqués, adresse pseudonymisée ; signatures conservées (preuve).<br>**Manque :** • Non exporté                                                 |
| **Fichiers sources**     | `src/server/qualiopi/documents/signature/`, `src/app/api/docuseal/webhook/route.ts`                                                                                             |

| Destinataire            | Ce qu'il reçoit                                                       | Pays                  | Hors UE | Sur /sous-processeurs |
| ----------------------- | --------------------------------------------------------------------- | --------------------- | ------- | --------------------- |
| Cloudflare R2           | images et exemplaires signés                                          | États-Unis (stockage) | oui     | oui                   |
| ZeptoMail               | liens de signature, exemplaire signé                                  | UE                    | non     | oui                   |
| DocuSeal (auto-hébergé) | plus utilisé ; le webhook reste ouvert et stocke tout ce qu'il reçoit | Allemagne             | non     | oui                   |

<a id="t15"></a>

#### T15 — Coaching individuel

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E07

|                          |                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Bénéficiaires du coaching<br>• Tuteurs en entreprise                                                                                                                                                                                                        |
| **Données**              | • Nom et e-mail du bénéficiaire et du tuteur (en clair)<br>• Cartographie d'activité, irritants, comptes rendus de séance<br>• Champs « données sensibles » et « notes confidentielles » (texte libre)<br>• Image de signature de séance (R2), empreinte d'IP |
| **Données sensibles**    | Texte libre pouvant contenir des informations personnelles sensibles                                                                                                                                                                                          |
| **Pourquoi (finalité)**  | Conduire et prouver les séances de coaching.                                                                                                                                                                                                                  |
| **Base légale**          | 6.1.b — Non annoncé.                                                                                                                                                                                                                                          |
| **Durée annoncée**       | Rien d'annoncé. <br>_Source : —_                                                                                                                                                                                                                              |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite ; suppression manuelle par le formateur.                                                                                                                                                                |
| **Sécurité**             | • Accès limité au formateur propriétaire de la séance et à la console coaching                                                                                                                                                                                |
| **Droits, aujourd'hui**  | E-mail ; seules les signatures sont effacées par /api/gdpr-*.<br>**Manque :** • Ni export ni effacement des contenus de coaching                                                                                                                              |
| **Fichiers sources**     | `src/server/actions/formateur/coaching.actions.ts`, `src/server/coaching-admin/`                                                                                                                                                                              |

| Destinataire  | Ce qu'il reçoit | Pays                  | Hors UE | Sur /sous-processeurs |
| ------------- | --------------- | --------------------- | ------- | --------------------- |
| Cloudflare R2 | signatures      | États-Unis (stockage) | oui     | oui                   |

### Ressources humaines

<a id="t16"></a>

#### T16 — Formateurs et salariés (dossier, contrat, pièces, missions, disponibilités)

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E04, E07, E11, E15

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Formateurs salariés<br>• Formateurs indépendants et sous-traitants<br>• Autres salariés (secrétariat, marketing, développement)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Données**              | • Nom, prénom, e-mail, téléphone, adresses<br>• Date et lieu de naissance, adresse personnelle (contrat de travail)<br>• Poste, classification, durée, période d'essai, salaire fixe, tarif journalier<br>• CV, compétences, habilitations, entretiens professionnels<br>• Pièces : contrat, DPAE, attestation URSSAF, Kbis, NDA, RC pro, diplômes, RIB (liens saisis par l'admin)<br>• Missions, refus, désistements<br>• Indisponibilités, dont le type « maladie »<br>• IBAN (champ posé le 2026-10-10, chiffrement imposé, non encore utilisé) |
| **Données sensibles**    | Indication de santé (indisponibilité « maladie »), IBAN (à venir)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Pourquoi (finalité)**  | Gérer les contrats de travail et de sous-traitance, affecter les missions, justifier les compétences (Qualiopi).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Base légale**          | 6.1.b (contrat) ; 6.1.c (droit du travail, Qualiopi) — Contrat de travail : « traitées aux seules fins de la gestion du contrat de travail et conservées pendant la durée légale applicable ». Rien pour les indépendants.                                                                                                                                                                                                                                                                                                                         |
| **Durée annoncée**       | « Pendant la durée légale applicable » (contrat de travail). <br>_Source : src/server/qualiopi/documents/templates/contrat-travail.tsx_                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite ; « suppression » d'une pièce = archivage.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Sécurité**             | • Écriture réservée et habilitation « habiliter_formateur »<br>• Espace formateur par lien magique (15 min) puis cookie 30 jours<br>• ⚠️ Adresse IP en clair dans les liens magiques<br>• Numéro de sécurité sociale volontairement non collecté                                                                                                                                                                                                                                                                                                   |
| **Droits, aujourd'hui**  | Rien d'outillé : demande par e-mail traitée à la main.<br>**Manque :** • Aucun export ni effacement pour les formateurs et salariés<br>• Aucune information RGPD pour les indépendants                                                                                                                                                                                                                                                                                                                                                             |
| **Fichiers sources**     | `src/server/actions/qualiopi/trainers.ts`, `src/server/actions/qualiopi/trainer-contrat.ts`, `src/server/qualiopi/trainers/`, `src/server/rh/`, `src/server/formateur/`, `src/server/qualiopi/formateurs-independants/`                                                                                                                                                                                                                                                                                                                            |

| Destinataire  | Ce qu'il reçoit                | Pays                  | Hors UE | Sur /sous-processeurs |
| ------------- | ------------------------------ | --------------------- | ------- | --------------------- |
| ZeptoMail     | propositions de mission, liens | UE                    | non     | oui                   |
| Cloudflare R2 | lettres de mission, contrats   | États-Unis (stockage) | oui     | oui                   |

<a id="t17"></a>

#### T17 — Rémunération et autofacturation des formateurs

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E13

|                          |                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Formateurs salariés et indépendants                                                                                                                                                                    |
| **Données**              | • Règles de rémunération, lignes d'honoraires, relevés<br>• Numéro de facture, autofacture, contestation<br>• Date et moyen de paiement, référence de virement<br>• SIRET, TVA, mandat d'autofacturation |
| **Pourquoi (finalité)**  | Payer les formateurs et émettre les autofactures.                                                                                                                                                        |
| **Base légale**          | 6.1.b ; 6.1.c (obligations comptables et fiscales) — Non annoncé aux intéressés.                                                                                                                         |
| **Durée annoncée**       | Rien d'annoncé. <br>_Source : —_                                                                                                                                                                         |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite (pièces comptables : 10 ans minimum de toute façon).                                                                                               |
| **Sécurité**             | • Rôles d'écriture                                                                                                                                                                                       |
| **Droits, aujourd'hui**  | Rien d'outillé.<br>**Manque :** • Aucun export                                                                                                                                                           |
| **Fichiers sources**     | `src/server/qualiopi/remuneration/`, `src/server/actions/qualiopi/trainer-remuneration.ts`, `src/server/actions/qualiopi/autofacture.ts`                                                                 |

| Destinataire  | Ce qu'il reçoit                                                               | Pays                  | Hors UE | Sur /sous-processeurs |
| ------------- | ----------------------------------------------------------------------------- | --------------------- | ------- | --------------------- |
| Cloudflare R2 | autofactures PDF                                                              | États-Unis (stockage) | oui     | oui                   |
| TIIME         | réception des autofactures prévue (aucune intégration à ce jour, simple lien) | France                | non     | **NON**               |

### Formation (Qualiopi)

<a id="t18"></a>

#### T18 — Partenaires et sous-traitants de formation (registres Qualiopi)

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E07

|                          |                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Interlocuteurs des sociétés sous-traitantes et partenaires                                                     |
| **Données**              | • Nom, e-mail, fonction de l'interlocuteur (en clair)<br>• SIRET, NDA, attestation RC pro, CV, capture data.gouv |
| **Pourquoi (finalité)**  | Tenir les registres Qualiopi des partenariats et de la sous-traitance.                                           |
| **Base légale**          | 6.1.b / 6.1.f — Non annoncé.                                                                                     |
| **Durée annoncée**       | Rien d'annoncé. <br>_Source : —_                                                                                 |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite.                                                           |
| **Sécurité**             | • Écriture réservée, actions journalisées                                                                        |
| **Droits, aujourd'hui**  | E-mail.<br>**Manque :** • Hors de la chaîne d'effacement                                                         |
| **Fichiers sources**     | `src/server/actions/qualiopi/partenariats.ts`, `prisma/schema.prisma (Partenariat, SousTraitant)`                |

| Destinataire | Ce qu'il reçoit | Pays      | Hors UE | Sur /sous-processeurs |
| ------------ | --------------- | --------- | ------- | --------------------- |
| Hetzner      | hébergement     | Allemagne | non     | oui                   |

### Réseau d'apporteurs

<a id="t19"></a>

#### T19 — Candidats apporteurs d'affaires (tunnels, relances, invitation)

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E09, E11, E23

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Personnes intéressées par le réseau (Facebook/Instagram, LinkedIn, /indeed, /leboncoin, /memo-isere, accès direct, saisie console)<br>• Candidats à un emploi à qui le réseau est proposé                                                                                                                                                                                                                                                                                                             |
| **Données**              | • Prénom, nom, e-mail, téléphone (chiffrés)<br>• Ville, code postal, expériences, usages de l'IA, zones, pitch, disponibilité, permis/véhicule, statut, LinkedIn, message<br>• Date de naissance et nationalité (facultatives, en clair)<br>• Réponse « nombre de dirigeants connus » (page vidéo)<br>• Score de candidature<br>• Réponse au bandeau cookies, identifiants Facebook (si consentement)<br>• Adresse IP EN CLAIR + empreinte, user-agent<br>• CV importé à la main depuis Indeed (script) |
| **Données sensibles**    | Nationalité                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Pourquoi (finalité)**  | Étudier la candidature, envoyer les documents demandés, relancer, inviter à un échange.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Base légale**          | 6.1.b ; 6.1.f (personne recommandée ; candidat emploi à qui on propose le réseau) — Annoncé (section « Réseau d'apporteurs d'affaires »).                                                                                                                                                                                                                                                                                                                                                               |
| **Durée annoncée**       | « Votre dossier est conservé pour garder la trace de nos échanges ; il n'est pas supprimé automatiquement. » <br>_Source : src/content/legal.ts — section « Réseau d'apporteurs d'affaires »_                                                                                                                                                                                                                                                                                                           |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme. L'« archivage automatique » n'est qu'un changement de statut.                                                                                                                                                                                                                                                                                                                                                                                             |
| **Sécurité**             | • Coordonnées chiffrées<br>• Preuve de consentement en empreinte<br>• Fiche ouverte au rôle « consultation » mais coordonnées masquées hors rôles habilités (prénom et nom restent visibles)                                                                                                                                                                                                                                                                                                            |
| **Droits, aujourd'hui**  | Lien d'opposition dans chaque e-mail (arrête aussi les relances) ; export et effacement /api/gdpr-*.                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Fichiers sources**     | `src/features/commercial-application/`, `src/lib/commercial-application/model.ts`, `src/server/meta/`, `scripts/import-cv-apporteurs.mjs`                                                                                                                                                                                                                                                                                                                                                               |

| Destinataire                   | Ce qu'il reçoit                                                                       | Pays                 | Hors UE | Sur /sous-processeurs |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------------------- | ------- | --------------------- |
| ZeptoMail                      | kit à +30 min, relances J+2/J+7, invitation et rappels                                | UE                   | non     | oui                   |
| Telegram                       | nom, ville, zone, disponibilité                                                       | Émirats arabes unis  | oui     | oui                   |
| Calendly                       | réservation de l'échange                                                              | États-Unis           | oui     | oui                   |
| Meta (pixel + API Conversions) | si consentement : e-mail, téléphone, prénom, ville hachés ; IP et navigateur en clair | Irlande / États-Unis | oui     | oui                   |
| Zoho Mail (lecture)            | repérage des réponses à l'invitation                                                  | UE                   | non     | oui                   |
| Axion CRM Pro                  | seulement en cas d'opposition (e-mail + motif)                                        | UE                   | non     | outil interne         |

<a id="t20"></a>

#### T20 — Dossier d'apporteur : contrat, pièces, IBAN, signature

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E06

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Apporteurs (souvent micro-entrepreneurs)<br>• Parrains et filleuls                                                                                                                                                                                                                                                                                                                                                         |
| **Données**              | • Prénom, nom, e-mail, téléphone, IBAN (chiffrés)<br>• SIREN, dénomination, adresse (souvent le domicile, en clair), NAF, statut, TVA, déclarations<br>• Pièces : pièce d'identité, RIB, RC pro, attestation de vigilance, immatriculation (octets chiffrés en base)<br>• Signature : nom tapé, date, empreinte d'IP, navigateur, texte du contrat (en clair dans un JSON)<br>• Contrat signé (PDF sur R2)<br>• Note interne |
| **Données sensibles**    | Pièce d'identité, IBAN                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Pourquoi (finalité)**  | Vérifier, contracter avec et suivre un apporteur.                                                                                                                                                                                                                                                                                                                                                                            |
| **Base légale**          | 6.1.b (contrat) ; 6.1.c (vigilance, art. L.8222-1 C. trav.) — Couvert par la section « Réseau d'apporteurs d'affaires » (« si vous complétez le dossier, s'y ajoutent les réponses… ») — pièces, IBAN et signature non détaillés.                                                                                                                                                                                            |
| **Durée annoncée**       | « … n'est pas supprimé automatiquement. » <br>_Source : src/content/legal.ts_                                                                                                                                                                                                                                                                                                                                                |
| **Durée réelle (code)**  | **suppression automatique partielle.** Pièce d'identité effacée dès qu'elle est jugée conforme, et quand elle est remplacée. Dossier refusé : identité et RIB effacés, IBAN vidé. MAIS : RC pro, vigilance et immatriculation jamais effacées (même refus) ; pièces d'un dossier abandonné, retiré ou résilié jamais effacées (y compris une pièce d'identité jamais jugée).                                                 |
| **Sécurité**             | • Coordonnées et IBAN chiffrés ; IBAN affiché masqué<br>• Pièces chiffrées (AXB1), antivirus au dépôt et à la lecture<br>• Ouverture des pièces et du contrat : super_admin et admin<br>• ⚠️ Ouverture d'une pièce d'identité ou d'un RIB NON journalisée<br>• ⚠️ Lien personnel du dossier sans date d'expiration                                                                                                           |
| **Droits, aujourd'hui**  | Export complet et effacement /api/gdpr-* (conservation légale motivée si contrat contresigné ou commissions) ; suppression console sous conditions.                                                                                                                                                                                                                                                                          |
| **Fichiers sources**     | `src/features/apporteurs-reseau/donnees.ts`, `src/features/apporteurs-reseau/verification.ts`, `src/features/apporteurs-reseau/pieces-chiffrement.ts`, `src/features/apporteurs-reseau/signature.ts`, `src/lib/rgpd-reseau-apporteur.ts`                                                                                                                                                                                     |

| Destinataire                       | Ce qu'il reçoit                      | Pays                  | Hors UE | Sur /sous-processeurs |
| ---------------------------------- | ------------------------------------ | --------------------- | ------- | --------------------- |
| API Recherche d'entreprises (État) | vérifier SIREN/SIRET                 | France                | non     | service public        |
| Cloudflare R2                      | contrat signé                        | États-Unis (stockage) | oui     | oui                   |
| ZeptoMail                          | contrat signé en pièce jointe, liens | UE                    | non     | oui                   |

<a id="t21"></a>

#### T21 — Commissions, autofactures et relevés des apporteurs

**État :** En service · **Annoncé dans la politique :** 🟠 en partie

|                          |                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Personnes concernées** | • Apporteurs                                                                                                                                     |
| **Données**              | • Montants, palier, facture liée, mois de relevé<br>• Numéros d'autofacture et d'avoir, litiges<br>• Autofactures PDF : nom, adresse, SIREN, TVA |
| **Pourquoi (finalité)**  | Calculer et payer les commissions, émettre les autofactures.                                                                                     |
| **Base légale**          | 6.1.b ; 6.1.c (art. L.123-22 C. com.) — Finalité « calculer la rémunération de l'apporteur » citée côté personnes présentées.                    |
| **Durée annoncée**       | Pas de suppression automatique. <br>_Source : src/content/legal.ts_                                                                              |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme (obligation comptable de 10 ans).                                                                   |
| **Sécurité**             | • Exports réservés au droit « facturer »                                                                                                         |
| **Droits, aujourd'hui**  | Export /api/gdpr-* ; conservation légale opposée à l'effacement.                                                                                 |
| **Fichiers sources**     | `src/features/apporteurs-reseau/facturation.ts`, `src/features/apporteurs-reseau/commissions.ts`                                                 |

| Destinataire  | Ce qu'il reçoit | Pays                  | Hors UE | Sur /sous-processeurs |
| ------------- | --------------- | --------------------- | ------- | --------------------- |
| Cloudflare R2 | autofactures    | États-Unis (stockage) | oui     | oui                   |
| ZeptoMail     | relevé mensuel  | UE                    | non     | oui                   |

<a id="t22"></a>

#### T22 — Personnes présentées par un apporteur

**État :** En service · **Annoncé dans la politique :** ✅ oui · **Écarts :** E17

|                          |                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Dirigeants et salariés d'entreprises dont un apporteur nous transmet les coordonnées                                                                                    |
| **Données**              | • Nom, e-mail, téléphone (chiffrés)<br>• Fonction, besoin, note, date de l'échange (en clair)<br>• SIREN, SIRET, dénomination                                             |
| **Pourquoi (finalité)**  | Présenter nos services, suivre la relation, calculer la commission.                                                                                                       |
| **Base légale**          | 6.1.f (+ information art. 14 au premier message) — Annoncé (ancre #personnes-presentees-par-un-apporteur).                                                                |
| **Durée annoncée**       | « … tant qu'elles restent exactes et que vous exercez la fonction […] ; elles ne sont pas supprimées automatiquement. » <br>_Source : src/content/legal.ts_               |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme.                                                                                                                             |
| **Sécurité**             | • Coordonnées chiffrées, visibles seulement des rôles habilités                                                                                                           |
| **Droits, aujourd'hui**  | Lien d'opposition ; export et effacement (anonymisation) /api/gdpr-*.                                                                                                     |
| **Fichiers sources**     | `src/features/apporteurs-reseau/presentations.ts`, `src/features/apporteurs-reseau/declaration-entreprise.ts`, `src/features/apporteurs-reseau/coordonnees-presentees.ts` |

| Destinataire                       | Ce qu'il reçoit                                  | Pays   | Hors UE | Sur /sous-processeurs |
| ---------------------------------- | ------------------------------------------------ | ------ | ------- | --------------------- |
| ZeptoMail                          | premier message (art. 14) avec lien d'opposition | UE     | non     | oui                   |
| API Recherche d'entreprises (État) | vérifier l'établissement                         | France | non     | service public        |
| L'apporteur                        | informé des seules suites utiles à sa commission | France | non     | service public        |

### Recrutement

<a id="t23"></a>

#### T23 — Candidatures aux offres d'emploi, entretiens et vivier

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E05, E07, E09, E12, E18

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Candidats qui postulent sur /carrieres (offres diffusées aussi sur Indeed, leboncoin…)<br>• Candidats spontanés                                                                                                                                                                                                                                                                                                                                                                                             |
| **Données**              | • Prénom, nom, e-mail, téléphone (chiffrés)<br>• Civilité, ville, poste actuel, expérience, disponibilité, LinkedIn, motivation, réponses, rémunération souhaitée<br>• CV et photo (facultatifs, sur le disque du serveur, non chiffrés)<br>• Empreinte d'IP, user-agent en clair, provenance<br>• Notes internes, motif de refus, journal du dossier, réponses envoyées, entretiens et compte rendu<br>• Réponses reçues par e-mail (date, objet en clair, extrait chiffré)<br>• Accord vivier et opposition |
| **Données sensibles**    | Photographie                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Pourquoi (finalité)**  | Recruter ; recontacter pour d'autres postes si accord vivier.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Base légale**          | 6.1.b ; 6.1.a (vivier) — Annoncé (sections « Candidatures et recrutement », « Conservation des candidatures »).                                                                                                                                                                                                                                                                                                                                                                                               |
| **Durée annoncée**       | « … conservé pour garder la trace de nos échanges ; il n'est pas supprimé automatiquement. » <br>_Source : src/content/legal.ts_                                                                                                                                                                                                                                                                                                                                                                              |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme à l'annonce (purge des candidatures retirée).                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Sécurité**             | • Coordonnées chiffrées<br>• Accès aux dossiers réservé (super_admin, admin, responsable qualité, secrétaire)<br>• Chaque ouverture, téléchargement, export est journalisé<br>• Turnstile, limitation de débit, champ leurre<br>• Aucun envoi au CRM (ADR 0047)                                                                                                                                                                                                                                               |
| **Droits, aujourd'hui**  | Opposition au vivier en un clic ; export et effacement /api/gdpr-* ; suppression console (super_admin).<br>**Manque :** • L'export oublie ville, motivation, réponses, disponibilité, notes, journal, réponses envoyées, entretiens, vidéos, liens, provenance, accord vivier                                                                                                                                                                                                                                 |
| **Fichiers sources**     | `src/features/job-application/actions.ts`, `src/features/admin-job-applications/`, `src/server/careers/`, `src/server/vivier/`, `src/server/careers/candidature-rgpd.ts`                                                                                                                                                                                                                                                                                                                                      |

| Destinataire                                     | Ce qu'il reçoit                                                                                          | Pays                | Hors UE | Sur /sous-processeurs |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------- | ------- | --------------------- |
| Telegram                                         | nom, e-mail, téléphone, ville, rémunération souhaitée, 500 caractères de motivation, réponses — EN CLAIR | Émirats arabes unis | oui     | oui                   |
| ZeptoMail                                        | accusé de réception, réponses, rappels d'entretien                                                       | UE                  | non     | oui                   |
| Zoho Mail (lecture)                              | repérage des réponses (interrupteur éteint par défaut)                                                   | UE                  | non     | oui                   |
| Cloudflare (Turnstile, sauvegardes R2 chiffrées) | anti-robot, sauvegarde des CV                                                                            | États-Unis          | oui     | oui                   |

<a id="t24"></a>

#### T24 — Monteurs et vidéastes freelance (candidatures vidéo)

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E09, E12, E13, E18

|                          |                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Candidats monteurs vidéo et vidéastes freelance<br>• Monteurs en poste (membres de la console éditoriale)                                                                                                                        |
| **Données**              | • Comme T23, plus les tarifs<br>• Jusqu'à 3 vidéos (200 Mo chacune, sur le disque du serveur)<br>• Liens vers leurs réalisations (vérifiés chaque semaine)<br>• Une fois en poste : nom, e-mail, rôle                              |
| **Données sensibles**    | Image et voix (vidéos)                                                                                                                                                                                                             |
| **Pourquoi (finalité)**  | Sélectionner des prestataires vidéo ; leur donner accès à leur file de travail.                                                                                                                                                    |
| **Base légale**          | 6.1.b — Couvert par la section « Candidatures et recrutement » (vidéos et vérification des liens non mentionnées).                                                                                                                 |
| **Durée annoncée**       | Comme T23 : pas de suppression automatique. <br>_Source : src/content/legal.ts_                                                                                                                                                    |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme.                                                                                                                                                                                      |
| **Sécurité**             | • Vidéos analysées par antivirus, lisibles en console une fois disponibles<br>• Vue console cloisonnée<br>• Jeton signé pour compléter les tarifs                                                                                  |
| **Droits, aujourd'hui**  | Comme T23 ; vidéos effacées par l'effacement art. 17.<br>**Manque :** • Vidéos non exportées                                                                                                                                       |
| **Fichiers sources**     | `src/lib/careers/video-editor-offer.ts`, `src/server/careers/videos-candidat.ts`, `src/server/careers/liens-surveilles.ts`, `src/features/admin-job-applications/video-freelance.ts`, `src/server/recrutement/jeton-complement.ts` |

| Destinataire                                           | Ce qu'il reçoit                                | Pays                | Hors UE | Sur /sous-processeurs |
| ------------------------------------------------------ | ---------------------------------------------- | ------------------- | ------- | --------------------- |
| Telegram (salon dédié)                                 | nom, ville, e-mail, téléphone, prix — en clair | Émirats arabes unis | oui     | oui                   |
| WhatsApp via CallMeBot                                 | alerte sans contenu                            | inconnu             | oui     | **NON**               |
| YouTube, Vimeo, TikTok (oEmbed) et sites des candidats | vérification hebdomadaire des liens fournis    | États-Unis / Chine  | oui     | **NON**               |

### Commercial

<a id="t25"></a>

#### T25 — Synchronisation vers Axion CRM Pro

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E10, E12, E19

|                          |                                                                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Auteurs de formulaires, invités Calendly, demandeurs du guide, abonnés, auteurs d'avis, demandeurs de podcast, leads du chatbot, personnes opposées                                                                                  |
| **Données**              | • E-mail en clair et son empreinte, prénom, nom, téléphone<br>• Entreprise (SIREN, nom, ville, site, taille, secteur)<br>• Version et date du consentement<br>• Provenance, type de rendez-vous, besoin (tronqué), jusqu'à 10 réponses |
| **Pourquoi (finalité)**  | Suivre la relation commerciale dans l'outil CRM interne ; propager oppositions et effacements.                                                                                                                                         |
| **Base légale**          | 6.1.f — Annoncé pour le guide (« logiciel interne de gestion de la relation client (CRM) ») ; pas pour les autres sources.                                                                                                             |
| **Durée annoncée**       | Rien côté CRM. <br>_Source : —_                                                                                                                                                                                                        |
| **Durée réelle (code)**  | **suppression automatique partielle.** File d'envoi du site : lignes envoyées effacées à 30 jours ; lignes en échec gardées sans limite (données en clair). Côté CRM : inconnu depuis ce dépôt.                                        |
| **Sécurité**             | • Envoi HTTPS signé HMAC<br>• ⚠️ La console « synchro CRM » affiche le contenu complet des lignes en erreur au rôle consultation<br>• ⚠️ Données déchiffrées en clair dans la file d'envoi                                             |
| **Droits, aujourd'hui**  | Accès et effacement propagés au CRM ; oppositions propagées dans les deux sens.                                                                                                                                                        |
| **Fichiers sources**     | `src/server/crm-sync/`, `src/server/queue/workers/crm-sync-worker.ts`, `src/app/api/internal/crm-webhook/`                                                                                                                             |

| Destinataire                                         | Ce qu'il reçoit      | Pays | Hors UE | Sur /sous-processeurs |
| ---------------------------------------------------- | -------------------- | ---- | ------- | --------------------- |
| Axion CRM Pro (application Laravel, serveur Hetzner) | destinataire interne | UE   | non     | outil interne         |

<a id="t26"></a>

#### T26 — Base de prospection entreprises, organisateurs d'événements, fédérations

**État :** Fait dans une autre application · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E05, E14, E20

|                          |                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Personnes concernées** | • Dirigeants et responsables d'entreprises (sources publiques)<br>• Professionnels de santé (RPPS)<br>• Organisateurs d'événements professionnels                                                                                                                  |
| **Données**              | • Nom, prénoms, fonction, photo, LinkedIn<br>• E-mails et téléphones nominatifs<br>• Pour les praticiens : RPPS, profession, spécialité, adresse, téléphone, e-mail<br>• Événements : nom, dates, lieu, public                                                     |
| **Pourquoi (finalité)**  | Constituer une base d'entreprises et proposer nos services / les interventions de Williams.                                                                                                                                                                        |
| **Base légale**          | 6.1.f (+ information art. 14) — Annoncé pour les organisateurs d'événements (ancre #organisateurs-evenements). La prospection des entreprises et des praticiens n'est PAS décrite.                                                                                 |
| **Durée annoncée**       | Organisateurs : « pendant la durée de nos échanges ». Rien pour la base d'entreprises. <br>_Source : src/content/legal.ts_                                                                                                                                         |
| **Durée réelle (code)**  | **aucune suppression automatique.** Tables présentes dans le schéma du site, alimentées par Axion CRM Pro (un test parle de ~4,29 M entreprises et ~1,32 M personnes). Purges retirées ; données en clair ; journal d'accès et liste d'opposition sans aucun code. |
| **Sécurité**             | • ⚠️ Aucun chiffrement<br>• Aucune console dans ce dépôt (menu « Prospection » = lien vers le CRM)                                                                                                                                                                 |
| **Droits, aujourd'hui**  | Réponse « STOP » ou e-mail (organisateurs). Rien côté site pour la base d'entreprises.<br>**Manque :** • /api/gdpr-* ne touche pas les tables de prospection<br>• Liste d'opposition inerte                                                                        |
| **Fichiers sources**     | `prisma/schema.prisma (Prospection*, l. 11543-12098)`, `src/server/queue/workers/__tests__/prospection-aucune-purge-automatique.spec.ts`, `_PROSPECTION-BASE-ENTREPRISES/AIPD-ET-MENTIONS-PRETES.md`, `src/components/admin/ui/AdminSidebarNav.tsx`                |

| Destinataire  | Ce qu'il reçoit                | Pays | Hors UE | Sur /sous-processeurs |
| ------------- | ------------------------------ | ---- | ------- | --------------------- |
| Axion CRM Pro | outil qui collecte et exploite | UE   | non     | outil interne         |

<a id="t27"></a>

#### T27 — Synchronisation vers Axion Partners

**État :** Dépend d'un interrupteur (à vérifier en prod) · **Annoncé dans la politique :** ❌ non

|                          |                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Apporteurs, candidats apporteurs, clients                                                                                                               |
| **Données**              | • Identifiants, statuts, montants (jamais nom, e-mail, téléphone)<br>• Exception : Partners peut lire les coordonnées d'un candidat (5 lectures par 24 h) |
| **Pourquoi (finalité)**  | Alimenter l'application interne des apporteurs.                                                                                                           |
| **Base légale**          | 6.1.b / 6.1.f — Non annoncé (application interne).                                                                                                        |
| **Durée annoncée**       | — <br>_Source : —_                                                                                                                                        |
| **Durée réelle (code)**  | **aucune suppression automatique.** Désactivé par défaut (PARTNERS_SYNC_ENABLED absent).                                                                  |
| **Sécurité**             | • HMAC, liste d'IP autorisées, journal sans clair                                                                                                         |
| **Droits, aujourd'hui**  | —                                                                                                                                                         |
| **Fichiers sources**     | `src/server/partners/`, `src/server/partners-sync/`                                                                                                       |

| Destinataire   | Ce qu'il reçoit     | Pays    | Hors UE | Sur /sous-processeurs |
| -------------- | ------------------- | ------- | ------- | --------------------- |
| Axion Partners | application interne | inconnu | non     | outil interne         |

### Site et technique

<a id="t28"></a>

#### T28 — Mesure d'audience (Plausible), parcours et performance du site

**État :** En service · **Annoncé dans la politique :** ✅ oui · **Écarts :** E21

|                          |                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Visiteurs du site                                                                                                                                                                                                                                                                                                                             |
| **Données**              | • Pages vues anonymisées, référents, navigateur agrégé (Plausible)<br>• Événements serveur Plausible (IP et navigateur transmis à l'outil auto-hébergé)<br>• Parcours (identifiant de session, route, secteur, effectif, UTM)<br>• Mesures de performance (URL, appareil, user-agent)<br>• Cookie « axion_utm » 30 jours posé sans consentement |
| **Pourquoi (finalité)**  | Statistiques d'audience anonymes, attribution des réservations, performance.                                                                                                                                                                                                                                                                    |
| **Base légale**          | 6.1.f (exemption CNIL de mesure d'audience) — Annoncé (« statistiques d'audience anonymes »).                                                                                                                                                                                                                                                   |
| **Durée annoncée**       | « … mesures de performance et d'audience du site, effacées au plus tard 12 mois après leur collecte. » <br>_Source : src/content/legal.ts_                                                                                                                                                                                                      |
| **Durée réelle (code)**  | **suppression automatique en service.** Conforme : performance 6 mois, parcours 12 mois. Plausible : rétention gérée par l'outil (non vérifiée).                                                                                                                                                                                                |
| **Sécurité**             | • Aucun cookie pour Plausible                                                                                                                                                                                                                                                                                                                   |
| **Droits, aujourd'hui**  | Non applicable (données anonymes).                                                                                                                                                                                                                                                                                                              |
| **Fichiers sources**     | `src/components/analytics/Plausible.tsx`, `src/lib/analytics/plausible-serveur.ts`, `src/lib/analytics/funnel-beacon.ts`, `src/app/api/vitals/route.ts`, `src/lib/utm.ts`, `src/proxy.ts`                                                                                                                                                       |

| Destinataire             | Ce qu'il reçoit   | Pays      | Hors UE | Sur /sous-processeurs |
| ------------------------ | ----------------- | --------- | ------- | --------------------- |
| Plausible (auto-hébergé) | mesure d'audience | Allemagne | non     | oui                   |

<a id="t29"></a>

#### T29 — Traceurs soumis au consentement : Microsoft Clarity, LinkedIn Insight, pixel Meta

**État :** Dépend d'un interrupteur (à vérifier en prod) · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E21

|                          |                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Visiteurs qui acceptent le bandeau cookies                                                                                                                                      |
| **Données**              | • Cookies d'identification (Clarity, LinkedIn, _fbp/_fbc)<br>• IP, navigateur, pages, clics et défilement (Clarity)<br>• Pour Meta : appariement avec un compte (données hachées) |
| **Pourquoi (finalité)**  | Analyse qualitative de l'ergonomie (Clarity) ; mesure et ciblage publicitaire (LinkedIn, Meta, limité au tunnel Facebook).                                                        |
| **Base légale**          | 6.1.a (consentement, art. 82 loi I&L) — Clarity annoncé ; Meta seulement dans la section apporteurs ; LinkedIn non annoncé.                                                       |
| **Durée annoncée**       | Durées des cookies sur /sous-processeurs ; choix du bandeau 13 mois. <br>_Source : src/content/subprocessors.ts_                                                                  |
| **Durée réelle (code)**  | **suppression automatique en service.** Cookies expirent seuls. Les trois outils sont « pending_activation » (identifiants non posés).                                            |
| **Sécurité**             | • Chargement seulement après acceptation ; jamais en console ni sur les URL secrètes                                                                                              |
| **Droits, aujourd'hui**  | Page /preferences-cookies.                                                                                                                                                        |
| **Fichiers sources**     | `src/components/analytics/CookieConsent.tsx`, `src/components/analytics/Clarity.tsx`, `src/components/analytics/LinkedInInsight.tsx`, `src/components/analytics/MetaPixel.tsx`    |

| Destinataire      | Ce qu'il reçoit          | Pays                 | Hors UE | Sur /sous-processeurs |
| ----------------- | ------------------------ | -------------------- | ------- | --------------------- |
| Microsoft Clarity | analyse d'ergonomie      | États-Unis           | oui     | oui                   |
| LinkedIn          | reciblage                | Irlande / États-Unis | oui     | oui                   |
| Meta              | pixel et API Conversions | Irlande / États-Unis | oui     | oui                   |

<a id="t30"></a>

#### T30 — Comptes de la console, journal d'activité et anti-abus

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E10, E11

|                          |                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Administrateurs et membres de l'équipe<br>• Visiteurs qui déclenchent un piège anti-robot<br>• Personnes qui exercent un droit (trace de l'export/effacement)                                                                                                                                                                                |
| **Données**              | • Nom, e-mail, mot de passe haché (argon2id), rôle<br>• Secret de double authentification (EN CLAIR)<br>• Dernière IP de connexion (en clair)<br>• Journal : action, cible, modifications, IP EN CLAIR, navigateur ; e-mail saisi lors d'une connexion échouée<br>• Qui a lu quel message<br>• Clés de limitation de débit (IP/e-mail, 15 min) |
| **Pourquoi (finalité)**  | Sécuriser l'accès, tracer les actions, lutter contre les abus.                                                                                                                                                                                                                                                                                 |
| **Base légale**          | 6.1.f (sécurité) ; 6.1.c (art. 32) — « Sécurité du site » annoncé.                                                                                                                                                                                                                                                                             |
| **Durée annoncée**       | « Journaux techniques : conservés sans suppression automatique… » <br>_Source : src/content/legal.ts_                                                                                                                                                                                                                                          |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme pour le journal (purge retirée). Clés anti-abus : 15 min.                                                                                                                                                                                                                                         |
| **Sécurité**             | • Mot de passe argon2id, limitation des essais<br>• ⚠️ 2FA facultative et secret stocké en clair<br>• Sessions JWT 30 jours<br>• ⚠️ Aucune sécurité au niveau des lignes (RLS) dans Postgres : tout repose sur le code                                                                                                                         |
| **Droits, aujourd'hui**  | Non exporté ni effacé (déclaré « immuable »).<br>**Manque :** • IP et e-mails en clair dans le journal non couverts                                                                                                                                                                                                                            |
| **Fichiers sources**     | `src/auth.ts`, `src/features/admin-auth/actions.ts`, `src/features/admin-users/`, `src/features/admin-activity-logs/`, `src/lib/limites-connexion-admin.ts`, `src/lib/security/honeypot-observable.ts`, `src/server/mcp/`                                                                                                                      |

| Destinataire                                        | Ce qu'il reçoit                                        | Pays                          | Hors UE | Sur /sous-processeurs |
| --------------------------------------------------- | ------------------------------------------------------ | ----------------------------- | ------- | --------------------- |
| Sentry                                              | erreurs, avec nettoyage des données personnelles       | États-Unis ou UE selon le DSN | oui     | oui                   |
| Serveur MCP « axion-ops » (assistant vocal interne) | lit la boîte de réception : NOMS des contacts en clair | interne                       | non     | outil interne         |

<a id="t31"></a>

#### T31 — Envoi des e-mails et copies des envois

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E04

|                          |                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Toute personne à qui le site écrit                                                                                                                                                |
| **Données**              | • Adresse du destinataire, gabarit, statut, rebonds<br>• Copie complète : objet, corps, noms des pièces jointes (en clair)<br>• File d'attente : contenu complet du message         |
| **Pourquoi (finalité)**  | Envoyer les e-mails et garder la preuve de ce qui a été envoyé.                                                                                                                     |
| **Base légale**          | 6.1.b / 6.1.f — ZeptoMail cité ; copie des envois non annoncée en tant que telle.                                                                                                   |
| **Durée annoncée**       | Journaux techniques : sans suppression automatique. (Le code annonce encore « 12 mois » dans un commentaire.) <br>_Source : src/content/legal.ts ; src/server/email/copie-envoi.ts_ |
| **Durée réelle (code)**  | **aucune suppression automatique.** Aucune purge depuis le 2026-10-07.                                                                                                              |
| **Sécurité**             | • Secrets masqués dans la copie                                                                                                                                                     |
| **Droits, aujourd'hui**  | Export ; effacement (journal pseudonymisé, copie et file supprimées).                                                                                                               |
| **Fichiers sources**     | `src/lib/email/client.ts`, `src/server/queue/workers/email-worker.ts`, `src/server/email/`                                                                                          |

| Destinataire                | Ce qu'il reçoit                  | Pays | Hors UE | Sur /sous-processeurs |
| --------------------------- | -------------------------------- | ---- | ------- | --------------------- |
| ZeptoMail (Zoho, région UE) | relais d'envoi : message complet | UE   | non     | oui                   |

<a id="t32"></a>

#### T32 — Notifications internes (Telegram, WhatsApp)

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E01, E09, E13

|                          |                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Personnes concernées** | • Toutes les personnes dont une demande déclenche une alerte                                                                                                                                                             |
| **Données**              | • Contact, devis, presse, candidatures, rendez-vous, podcast : nom, e-mail, téléphone et message EN CLAIR<br>• Demandes RGPD et guide : données masquées<br>• Stagiaire : nom + nature « handicap ou problème de santé » |
| **Données sensibles**    | Santé (une alerte)                                                                                                                                                                                                       |
| **Pourquoi (finalité)**  | Prévenir l'équipe pour rappeler rapidement.                                                                                                                                                                              |
| **Base légale**          | 6.1.f — Déclaré sur /sous-processeurs ; partiellement dans la politique.                                                                                                                                                 |
| **Durée annoncée**       | — <br>_Source : src/content/subprocessors.ts_                                                                                                                                                                            |
| **Durée réelle (code)**  | **aucune suppression automatique.** Les messages restent dans Telegram sans limite (hors du contrôle du site).                                                                                                           |
| **Sécurité**             | • Messages tronqués à 800 caractères<br>• Masquage seulement pour RGPD, guide, réponses de candidats                                                                                                                     |
| **Droits, aujourd'hui**  | Rien : les messages Telegram ne sont pas effacés par l'effacement art. 17.<br>**Manque :** • Effacement impossible des messages déjà envoyés                                                                             |
| **Fichiers sources**     | `src/server/notifications/format.ts`, `src/server/notifications/index.ts`, `src/server/notifications/channels/telegram.ts`, `src/server/notifications/channels/whatsapp.ts`                                              |

| Destinataire         | Ce qu'il reçoit                                                             | Pays                                               | Hors UE | Sur /sous-processeurs |
| -------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- | ------- | --------------------- |
| Telegram FZ-LLC      | 8 à 11 groupes ; aucun DPA ; « SCC » déclarées mais Telegram n'en signe pas | Émirats arabes unis (pas de décision d'adéquation) | oui     | oui                   |
| CallMeBot (WhatsApp) | catégorie et heure + numéro de Will                                         | inconnu                                            | oui     | **NON**               |

<a id="t33"></a>

#### T33 — Lecture de la boîte Zoho Mail contact@axion-ia.com

**État :** En service · **Annoncé dans la politique :** ✅ oui · **Écarts :** E04

|                          |                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Candidats apporteurs et candidats emploi qui répondent par e-mail<br>• Tout expéditeur de la boîte (lu puis ignoré)                                                                              |
| **Données**              | • Expéditeur, date, objet, résumé calculé par Zoho (jamais le corps ni les pièces jointes)<br>• Conservé si reconnu : empreinte de l'expéditeur, objet en clair, extrait de 300 caractères chiffré |
| **Pourquoi (finalité)**  | Arrêter les relances et rattacher la réponse au bon dossier.                                                                                                                                       |
| **Base légale**          | 6.1.f — Annoncé (sections apporteurs et candidatures).                                                                                                                                             |
| **Durée annoncée**       | Conservé dans le dossier, sans suppression automatique. <br>_Source : src/content/legal.ts_                                                                                                        |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme (le commentaire du schéma « purge 24 mois » est faux).                                                                                                |
| **Sécurité**             | • Portées OAuth en lecture seule<br>• Extrait chiffré                                                                                                                                              |
| **Droits, aujourd'hui**  | Export et effacement /api/gdpr-*.                                                                                                                                                                  |
| **Fichiers sources**     | `src/server/zoho-mail/client.ts`, `src/features/commercial-application/reponses-entrantes-apporteur.ts`, `src/features/admin-job-applications/reponses-entrantes-candidature.ts`                   |

| Destinataire | Ce qu'il reçoit                                           | Pays                | Hors UE | Sur /sous-processeurs |
| ------------ | --------------------------------------------------------- | ------------------- | ------- | --------------------- |
| Zoho Mail    | boîte lue en lecture seule (centre UE)                    | UE                  | non     | oui                   |
| Telegram     | apporteurs : nom et objet ; candidats : intitulé du poste | Émirats arabes unis | oui     | oui                   |

### Conformité

<a id="t34"></a>

#### T34 — Gestion des droits RGPD et des preuves de consentement

**État :** En service · **Annoncé dans la politique :** ✅ oui · **Écarts :** E07, E24

|                          |                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Personnes qui exercent un droit, qui consentent ou qui s'opposent                                                                                                                                                                                                                                                           |
| **Données**              | • Registre des consentements : empreinte de l'e-mail, version du texte, action, empreintes d'IP et de navigateur<br>• Liste d'opposition : empreinte de l'e-mail seulement<br>• Demandes RGPD des stagiaires (type, statut, dates)<br>• Journal des effacements (table, ligne, motif) pour les rejouer après une restauration |
| **Pourquoi (finalité)**  | Prouver les consentements, respecter les oppositions, répondre aux demandes.                                                                                                                                                                                                                                                  |
| **Base légale**          | 6.1.c (art. 7.1, 12 à 21 RGPD) — —                                                                                                                                                                                                                                                                                            |
| **Durée annoncée**       | « … votre opposition est conservée pour être respectée. » <br>_Source : src/content/legal.ts_                                                                                                                                                                                                                                 |
| **Durée réelle (code)**  | **aucune suppression automatique.** Conforme.                                                                                                                                                                                                                                                                                 |
| **Sécurité**             | • Jeton HMAC 24 h (rejouable pendant 24 h, e-mail dans l'URL)<br>• Limites : 3 exports / jour, 1 effacement / jour                                                                                                                                                                                                            |
| **Droits, aujourd'hui**  | /mes-donnees n'a AUCUN formulaire : renvoi vers contact@axion-ia.com. Aucun écran n'appelle /api/gdpr-export/request ni /api/gdpr-erase.<br>**Manque :** • Pas de libre-service réel<br>• Modèles de réponse DPO obsolètes (citent un modèle « Bookings » disparu)                                                            |
| **Fichiers sources**     | `src/app/[locale]/mes-donnees/`, `src/app/api/gdpr-export/`, `src/app/api/gdpr-erase/route.ts`, `src/lib/rgpd-erase.ts`, `src/lib/consents/`, `src/server/email/opposition.ts`, `docs/dpo-templates/`                                                                                                                         |

| Destinataire | Ce qu'il reçoit         | Pays                | Hors UE | Sur /sous-processeurs |
| ------------ | ----------------------- | ------------------- | ------- | --------------------- |
| ZeptoMail    | liens d'export, accusés | UE                  | non     | oui                   |
| Telegram     | alerte masquée          | Émirats arabes unis | oui     | oui                   |

### Site et technique

<a id="t35"></a>

#### T35 — Sauvegardes

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E13, E22

|                          |                                                                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Toutes les personnes présentes en base et dans les fichiers                                                                                                                                                                                            |
| **Données**              | • Copies chiffrées de la base, de Redis, de Plausible, de DocuSeal, des fichiers (CV, avis, documents), de la banque d'images<br>• Copie NON rechiffrée des pièces légales (documents, supports, émargement) dans un second compartiment verrouillé 1 an |
| **Données sensibles**    | Toutes celles de la base                                                                                                                                                                                                                                 |
| **Pourquoi (finalité)**  | Pouvoir restaurer en cas d'incident.                                                                                                                                                                                                                     |
| **Base légale**          | 6.1.f / 6.1.c (art. 32) — —                                                                                                                                                                                                                              |
| **Durée annoncée**       | Rien. <br>_Source : —_                                                                                                                                                                                                                                   |
| **Durée réelle (code)**  | **suppression automatique partielle.** Rotations 7 / 4 / 12 (quotidien / hebdo / mensuel), 24 horaires ; DocuSeal mensuel 24. ⚠️ Miroir Hetzner Storage Box sans rotation dans le script.                                                                |
| **Sécurité**             | • Chiffrement AES-256 avant envoi<br>• Effacements rejoués après restauration                                                                                                                                                                            |
| **Droits, aujourd'hui**  | Les effacements sont rejoués après restauration.                                                                                                                                                                                                         |
| **Fichiers sources**     | `scripts/backup-lib.sh`, `scripts/backup-postgres-r2.sh`, `scripts/run-storagebox-mirror.sh`, `scripts/backup-documents-r2.sh`, `scripts/rgpd-rejouer-effacements.ts`, `infra/pgbackrest/pgbackrest.conf`                                                |

| Destinataire        | Ce qu'il reçoit                                                                    | Pays                  | Hors UE | Sur /sous-processeurs |
| ------------------- | ---------------------------------------------------------------------------------- | --------------------- | ------- | --------------------- |
| Cloudflare R2       | sauvegarde principale                                                              | États-Unis (stockage) | oui     | oui                   |
| Hetzner Storage Box | miroir                                                                             | Allemagne             | non     | oui                   |
| GitHub Actions      | exercice de restauration mensuel, tâches planifiées avec les secrets de production | États-Unis            | oui     | **NON**               |

### Contenus

<a id="t36"></a>

#### T36 — Studio vidéo et console éditoriale (invités, transcriptions)

**État :** Prévu, rien n'est rempli · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E07

|                          |                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Invités du podcast / des vidéos<br>• Membres de l'équipe éditoriale                                                                                                                              |
| **Données**              | • Invité : nom, entreprise, e-mail, téléphone, note, autorisation de droit à l'image (en clair)<br>• Transcription des vidéos (peut contenir la parole d'invités)<br>• Membres : nom, e-mail, rôle |
| **Données sensibles**    | Image et voix des invités                                                                                                                                                                          |
| **Pourquoi (finalité)**  | Produire et publier les contenus vidéo.                                                                                                                                                            |
| **Base légale**          | 6.1.a (autorisation de droit à l'image) / 6.1.b — Non annoncé.                                                                                                                                     |
| **Durée annoncée**       | Rien. <br>_Source : —_                                                                                                                                                                             |
| **Durée réelle (code)**  | **aucune suppression automatique.** Tables des invités sans aucun code d'écriture à ce jour (inerte) ; lues et exportées par la console.                                                           |
| **Sécurité**             | • Permissions de la console éditoriale                                                                                                                                                             |
| **Droits, aujourd'hui**  | Rien.<br>**Manque :** • Hors de la chaîne d'effacement                                                                                                                                             |
| **Fichiers sources**     | `prisma/schema.prisma (EdInvite, EdEpisodeInvite, EdMembre, EdAsset)`, `src/server/editorial/`, `src/app/[locale]/(admin)/[adminPrefix]/console-editoriale/export/route.ts`                        |

| Destinataire           | Ce qu'il reçoit | Pays      | Hors UE | Sur /sous-processeurs |
| ---------------------- | --------------- | --------- | ------- | --------------------- |
| Hetzner (disque local) | médias          | Allemagne | non     | oui                   |

<a id="t37"></a>

#### T37 — Banque d'images et retours sur la base de connaissances

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E08

|                          |                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Photographes crédités (Unsplash)<br>• Visiteurs qui notent un article de la base de connaissances<br>• Personnes éventuellement visibles sur les photos  |
| **Données**              | • Nom et lien du photographe<br>• Journaux d'usage et de téléchargement (empreinte d'IP, user-agent)<br>• Retours : empreinte d'IP, identifiant de session |
| **Pourquoi (finalité)**  | Créditer les images, mesurer leur usage, améliorer les contenus.                                                                                           |
| **Base légale**          | 6.1.f — Non annoncé en tant que tel.                                                                                                                       |
| **Durée annoncée**       | Journaux techniques : sans suppression automatique. <br>_Source : src/content/legal.ts_                                                                    |
| **Durée réelle (code)**  | **aucune suppression automatique.** Purge des journaux d'images retirée le 2026-10-07.                                                                     |
| **Sécurité**             | • Empreintes d'IP ; outil « oublier une empreinte »                                                                                                        |
| **Droits, aujourd'hui**  | Outil console pour oublier une empreinte d'IP.                                                                                                             |
| **Fichiers sources**     | `src/server/image-bank/`, `src/server/actions/image-bank/forget-ip-hash.action.ts`                                                                         |

| Destinataire              | Ce qu'il reçoit                                      | Pays        | Hors UE | Sur /sous-processeurs |
| ------------------------- | ---------------------------------------------------- | ----------- | ------- | --------------------- |
| Anthropic (vision)        | description des images pour le référencement         | États-Unis  | oui     | oui                   |
| Nominatim (OpenStreetMap) | géocodage de lieux pour les images (pas de visiteur) | Royaume-Uni | oui     | oui                   |

### Gestion

<a id="t38"></a>

#### T38 — Facturation clients et encaissements

**État :** En service · **Annoncé dans la politique :** 🟠 en partie · **Écarts :** E04, E08, E13

|                          |                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Personnes concernées** | • Clients (contacts, particuliers)                                                                                                                                             |
| **Données**              | • Devis et lignes<br>• Encaissements manuels (virement, chèque, espèces), référence, notes<br>• Numéros émis (sans donnée personnelle)                                         |
| **Pourquoi (finalité)**  | Facturer et suivre les paiements.                                                                                                                                              |
| **Base légale**          | 6.1.b ; 6.1.c (code de commerce, CGI) — « Données clients : 5 ans… (obligation comptable) ».                                                                                   |
| **Durée annoncée**       | « 5 ans après fin de prestation (obligation comptable française) » — l'obligation légale pour les pièces comptables est de 10 ans. <br>_Source : src/content/legal.ts_         |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite. TIIME : simple lien externe, aucune intégration. Stripe : éteint. Facturation électronique : adaptateur non implémenté. |
| **Sécurité**             | • Rôles d'écriture                                                                                                                                                             |
| **Droits, aujourd'hui**  | Conservation légale opposée à l'effacement.                                                                                                                                    |
| **Fichiers sources**     | `src/server/actions/qualiopi/devis.ts`, `src/lib/stripe.ts`, `src/lib/admin-nav.ts`, `src/server/qualiopi/financements/e-invoicing/pa-adapter.ts`                              |

| Destinataire | Ce qu'il reçoit                                               | Pays    | Hors UE | Sur /sous-processeurs |
| ------------ | ------------------------------------------------------------- | ------- | ------- | --------------------- |
| TIIME        | logiciel comptable utilisé à la main (lien depuis la console) | France  | non     | **NON**               |
| Stripe       | éteint                                                        | Irlande | non     | oui                   |

### Formation (Qualiopi)

<a id="t39"></a>

#### T39 — Espace ressources et documents d'intervention

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03, E11

|                          |                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Formateurs et commerciaux destinataires de documents                                                         |
| **Données**              | • E-mail et nom (en clair)<br>• Liens de connexion (adresse IP EN CLAIR)<br>• Journal de qui a téléchargé quoi |
| **Pourquoi (finalité)**  | Donner accès aux supports et savoir qui les a récupérés.                                                       |
| **Base légale**          | 6.1.b / 6.1.f — Non annoncé.                                                                                   |
| **Durée annoncée**       | Rien. <br>_Source : —_                                                                                         |
| **Durée réelle (code)**  | **suppression automatique partielle.** Liens expirés effacés à la demande suivante ; le reste sans limite.     |
| **Sécurité**             | • Jetons hachés                                                                                                |
| **Droits, aujourd'hui**  | Effacement (pseudonymisation) /api/gdpr-*.<br>**Manque :** • Non exporté                                       |
| **Fichiers sources**     | `src/server/intervention-documents/`, `src/server/actions/ressources/auth.actions.ts`                          |

| Destinataire  | Ce qu'il reçoit    | Pays                  | Hors UE | Sur /sous-processeurs |
| ------------- | ------------------ | --------------------- | ------- | --------------------- |
| Cloudflare R2 | supports           | États-Unis (stockage) | oui     | oui                   |
| ZeptoMail     | liens de connexion | UE                    | non     | oui                   |

### Gestion

<a id="t40"></a>

#### T40 — Documents de la société

**État :** En service · **Annoncé dans la politique :** ❌ non

|                          |                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Dirigeant<br>• Salariés (dont salariés étrangers)<br>• Formateurs                                                           |
| **Données**              | • Pièce d'identité du dirigeant<br>• RIB<br>• Liste nominative des salariés étrangers<br>• CV et liste des formateurs         |
| **Données sensibles**    | Pièce d'identité, Nationalité (liste des salariés étrangers)                                                                  |
| **Pourquoi (finalité)**  | Tenir les justificatifs de la société (Qualiopi, administrations, banques).                                                   |
| **Base légale**          | 6.1.c — Interne.                                                                                                              |
| **Durée annoncée**       | Rien. <br>_Source : —_                                                                                                        |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite.                                                                        |
| **Sécurité**             | • Marquage « sensible », rôles d'écriture                                                                                     |
| **Droits, aujourd'hui**  | Interne.                                                                                                                      |
| **Fichiers sources**     | `src/server/actions/societe-documents/documents.actions.ts`, `src/server/societe-documents/`, `src/server/console-documents/` |

| Destinataire           | Ce qu'il reçoit | Pays      | Hors UE | Sur /sous-processeurs |
| ---------------------- | --------------- | --------- | ------- | --------------------- |
| Hetzner (disque local) | stockage        | Allemagne | non     | oui                   |

### Contenus

<a id="t41"></a>

#### T41 — Baromètre / observatoire

**État :** En service · **Annoncé dans la politique :** ❌ non · **Écarts :** E03

|                          |                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| **Personnes concernées** | • Répondants au baromètre                                                                          |
| **Données**              | • Identifiant visiteur (empreinte d'IP)<br>• Taille, secteur, région, rôle du répondant, réponses  |
| **Pourquoi (finalité)**  | Publier des statistiques agrégées sur l'usage de l'IA.                                             |
| **Base légale**          | 6.1.f — Non annoncé.                                                                               |
| **Durée annoncée**       | Rien. <br>_Source : —_                                                                             |
| **Durée réelle (code)**  | **aucune suppression automatique.** Garde sans limite ; seuls des agrégats partent au modèle d'IA. |
| **Sécurité**             | • Pseudonyme                                                                                       |
| **Droits, aujourd'hui**  | Non applicable en pratique (pseudonyme).                                                           |
| **Fichiers sources**     | `src/server/actions/observatoire/public.ts`, `src/server/observatoire/`                            |

## Tables prévues mais vides

Ces tables existent dans le schéma, mais aucun code ne les remplit aujourd'hui. Elles ne sont pas des traitements ; elles le deviendront le jour où un code y écrira, et devront alors entrer dans ce registre.

- Survey / SurveyResponse (aucun usage)
- LienPartage / LienPartageAcces (lot non livré)
- TrainerDocumentContenu, PreuveVigilance, VerificationRegistreSousTraitance, ChoixFormateurSession (aucun écrivain)
- ProspectionSuppressionEntry, ProspectionAccessLog (aucun code)
- EdInvite / EdEpisodeInvite (aucun écrivain)

## Méthode et limites

- Inventaire en lecture seule du dépôt au commit indiqué : schéma Prisma, src/features, src/server, workers BullMQ, intégrations, src/content/legal.ts (ce qui est ANNONCÉ) et src/content/subprocessors.ts. Aucune donnée de production consultée : l'état réel des interrupteurs (variables Coolify) n'est pas vérifiable depuis le dépôt et est signalé comme tel.
- Hors de ce dépôt, donc **non inventoriés** : Axion CRM Pro (collecte de la base de prospection, envois, durées côté CRM), Axion Partners, l'assistant vocal axion-ops, et ce qui se fait à la main dans TIIME, Zoho Mail ou Google Drive.
- À refaire à chaque nouveau traitement, nouveau prestataire ou changement de durée, et au moins une fois par an.
