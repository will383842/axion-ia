# ADR 0056 — Retour sur la décision du 01/09 : consentement, conservation, droits, effacement

- **Statut** : **ACCEPTÉ** sur les points tranchés (B4 : AXION IA SAS ; B1, B2, B3, B14, B16 : recommandations du plan retenues le 28/09/2026). La **date d'envoi réel du préavis** et donc la date d'ouverture sont **à compléter par la PR de mise en service** du chantier.
- **Date** : 2026-09-29
- **Auteur** : Will + Claude (chantier « enregistrement des visios »)
- **Référence** : `_AUDIT/DPA-REGISTER.md` (décision du 01/09/2026 et ses quatre motifs) ; `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/RGPD-REGISTRE-ART30.md` ; `src/content/__tests__/la-notice-ne-retarde-pas-sur-la-visio.spec.ts` ; `src/app/api/gdpr-export/route.ts` ; `src/lib/rgpd-erase.ts` ; `src/lib/pii-crypto.ts` ; `src/lib/identite-legale-ssot.ts` ; `src/lib/email/templates/preavis-sous-traitants.tsx` ; `src/server/visio/preavis-envoi.ts` ; ADR 0053, 0054, 0055.

## Contexte

Le 01/09/2026, Will a interdit tout enregistrement de rendez-vous, pour quatre motifs :

1. un robot réglé au niveau du compte ;
2. l'art. 226-1 du Code pénal (enregistrement à l'insu) ;
3. aucune durée de conservation ;
4. de la parole envoyée aux États-Unis.

Le 28/09, il revient sur cette décision. La notice publique promet aujourd'hui « ni enregistrés ni transcrits », et une garde verrouille cette promesse. Le responsable du traitement est **AXION IA SAS** (RCS Grenoble, SIREN 108 018 631), autorité de contrôle : **CNIL** (B4).

## Décision

1. **Réponse aux quatre motifs** :
   1. aucun robot : l'enregistrement se fait depuis le navigateur de Will (ADR 0054), et le Notetaker reste désactivé ;
   2. accord **annoncé oralement et confirmé** avant tout envoi de son au serveur ; destruction locale sans accord sous 3 minutes ; refus possible à tout moment. L'annonce dit que l'enregistrement vient de démarrer, qu'une IA rédige le compte rendu, que les données servent aussi au devis et aux questionnaires, et renvoie à la politique de confidentialité ;
   3. des durées **codées, testées et surveillées** (point 4) ;
   4. le son et le texte partent chez **OpenAI, LLC (États-Unis, clauses contractuelles types)**, qui ne les utilise pas pour l'entraînement ; le son est effacé de nos serveurs au plus tard 30 jours après le rendez-vous. C'est dit au client **avant** (préavis, point 9) et **au début** de chaque appel.
2. **Consentement en deux temps** :
   - la réponse à la question Calendly est un **indice**, jamais une preuve ;
   - l'**accord oral** de chaque participant est la preuve. Il est déclaré par Will (`declaration_axion`) **et** retrouvé mot pour mot par le code sur la piste client (`phrase_retrouvee_verifiee`). Le texte de l'annonce et de la réponse est conservé chiffré, avec ses horodatages et l'empreinte de la tranche audio client, **jusqu'à la fin de conservation du dossier de la rencontre + 5 ans** : la preuve ne disparaît jamais avant ce qu'elle justifie. `ConsentEvent` est écrit en `action = "information"`, **jamais `optin`** pour une déclaration de Will.
   - **Un nouveau participant** : signal, puis gain à zéro au bout de 2 minutes tant que Will n'a pas déclaré son accord ; ses segments intermédiaires ne sont jamais transmis.
   - **Information écrite (art. 13)** : Calendly et l'e-mail de confirmation pour le premier rendez-vous ; pour une rencontre créée dans la console et pour les invités, un message à coller dans le chat Meet.
3. **Chiffrement obligatoire** de tout texte issu de la parole (`enc:v1:`), par une enveloppe qui **lève** si la clé manque, dès la réception de la transcription ; le son est chiffré avant d'atteindre R2 (ADR 0054). Un témoin de clé en base vérifie que le site et le worker chiffrent avec la même clé.
4. **Conservation (B1, recommandation retenue)**. Les purges ci-dessous **ne touchent aucune pièce légale** (devis, factures, conventions, e-mails émis), gardées 5 ans sans purge (décision du 25/08).

   | Donnée                                                                     | Durée                                                                                  |
   | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
   | Son (R2, chiffré)                                                          | effacé à la validation du compte rendu, **au plus tard 30 jours** après le rendez-vous |
   | Segments de transcription                                                  | 12 mois                                                                                |
   | Citations exactes                                                          | avec le compte rendu                                                                   |
   | Compte rendu et faits d'un prospect                                        | dernière rencontre + 3 ans                                                             |
   | Compte rendu et faits d'un client                                          | max(dernière rencontre tenue, dernière facture, dernier devis signé) + 5 ans           |
   | Rencontre jamais rattachée                                                 | sa date + 3 ans                                                                        |
   | Fiche fusionnée                                                            | ancrée sur l'absorbante                                                                |
   | Questionnaires de cadrage, e-mails de suivi, suivi de rencontre            | même ancre que le client ou le prospect                                                |
   | Contenu des faits rejetés                                                  | vidé à la validation, ou à 30 jours                                                    |
   | Versions remplacées ou rejetées d'un compte rendu                          | 90 jours                                                                               |
   | Données du pilote                                                          | supprimées après le pilote                                                             |
   | Preuves d'accord (`EnregistrementConsentement`, `ConsentEvent` du circuit) | fin de conservation du dossier de la rencontre + 5 ans                                 |

   Chaque durée a sa purge, son test et son alerte **dans la PR qui la publie**. **Toute mise à blanc passe par `src/lib/rgpd-erase.ts`**, seul module qui pose le drapeau d'effacement.

5. **Retrait de l'accord (B2, recommandation retenue)** : pendant l'appel, « Refus » ; **après l'appel**, bouton « Le client retire son accord pour ce rendez-vous » → `retirerAccordRencontre()` (dans `rgpd-erase.ts`). Effacés : son, segments, transcriptions, toutes les versions de compte rendu, contenu de **tous** les faits de la rencontre (validés compris), valeurs des `PreRemplissage` liés ; les comptes rendus des rencontres **suivantes** du même client passent `a_regenerer`. Gardés : la preuve d'accord initiale, l'événement de retrait, les journaux sans contenu, les devis et e-mails déjà émis. Si le retrait arrive après une passe, le texte a déjà été traité par OpenAI (journaux d'abus conservés au plus 30 jours par OpenAI) : c'est dit dans la notice.
6. **Droits** : **accès (art. 15)** en libre-service pour les paroles et faits propres à la personne, sa fiche, et les faits dont elle est le sujet (énoncé seul, sans citation d'un tiers) ; une demande qui touche le dossier d'une entreprise reçoit une réponse manuelle, avec occultation des tiers. **Rectification (art. 16)** : rejet du fait inexact (motif `rectification`) et fait corrigé, journalisés. **Effacement (art. 17)** ciblé, sur **toutes** les adresses de la personne ; toutes les versions de compte rendu où elle a parlé ou été citée passent `a_regenerer`. **Opposition (art. 21)** : une case sur la fiche de la personne bloque enregistrement et dictée. **Personnes citées sans être présentes (art. 14)** : phrase dans la notice et ligne d'information dans le premier e-mail qu'elles reçoivent.
7. **Dictée après un appel téléphonique** : pas de consentement demandé, base **intérêt légitime (6.1.f)** (B14, recommandation retenue), une phrase dans la notice, une ligne au registre. La dictée reste verrouillée par `DICTEE_ANNONCEE` tant que la notice ne la mentionne pas.
8. **Entité responsable (B4)** : **AXION IA SAS**, identité lue dans `src/lib/identite-legale-ssot.ts` et par `resolveLegalIdentity()`, la même dans la notice, le préavis et les deux registres. Garde « une seule entité responsable » (SIREN comparé) posée avec la mise en service.
9. **Préavis aux clients actifs (B3)** : un client qui a au moins un devis, une facture de formation, une session, une inscription financée, un contrat de coaching, une mission d'audit ou un dossier de financement a signé sous l'ancienne liste de sous-traitants. Il reçoit un **préavis de 30 jours** (`preavis-sous-traitants`), mis en file par `scripts/visio/envoyer-preavis.ts`, **toujours garé pour validation** (Will le relit). La date d'effet est calculée au rendu, donc à l'envoi réel. La date d'envoi réel est relevée dans `email_outbox` ; **le mode `ouvert` ne devient effectif qu'à `envoi + 30 jours`**, contrôlé par le code. _Date d'envoi réel : à compléter par la PR de mise en service._
10. **Registres** : une fiche « Enregistrement et compte rendu des rendez-vous » (6.1.a) et une fiche « Dictée après l'appel » (6.1.f) au registre des activités de traitement ; le registre des destinataires reçoit OpenAI pour les comptes rendus (finalité, données, États-Unis, clauses contractuelles types, pas d'entraînement, DPA). Aucun destinataire de la parole n'est activé sans son cadre écrit (garde).
11. **Sauvegardes** : la notice annonce le délai réel d'effacement dans les sauvegardes, mesuré sur ce qui existe ; `EffacementJournal` est rejoué après toute restauration.
12. **Périmètre** : clients et prospects, sur une liste blanche de types Calendly. **Jamais** les candidats, les apporteurs ni les formations. Aucun enregistrement ad hoc.
13. **Mise en service en une seule PR** : notice, sous-traitants, registres, gardes réécrites, purges et ouverture du drapeau, **après** la fin du préavis. La garde `la-notice-ne-retarde-pas-sur-la-visio` est **réécrite, pas supprimée** : elle cible la section « Rendez-vous de découverte », suit l'état de l'entrée OpenAI (comptes rendus) et garde son test du Notetaker.
14. **Analyse d'impact complète** (art. 35.7), relue par Will **avant** l'ouverture, **rangée hors du dépôt public** (B16, recommandation retenue), avec une ligne de renvoi dans le registre.

## Conséquences

- **Positives** : chacun des quatre motifs du 01/09 reçoit une réponse vérifiable ; la preuve de l'accord survit au son ; le client est prévenu avant, et au début de chaque appel.
- **Négatives** : le préavis de 30 jours retarde l'ouverture ; la réponse manuelle aux demandes d'accès prend du temps à Will ; l'effacement dans les sauvegardes n'est pas immédiat.

## Alternatives écartées

- Consentement en trois temps avec une case sur le site : elle suppose la réservation directe, que Will refuse.
- Export complet du compte rendu sur demande d'accès : il livrerait la parole de tiers (art. 15.4).
- Effacement du dossier entier dès qu'un seul participant le demande.
- Rédaction par un autre fournisseur (API Anthropic ou Mistral, ou l'abonnement grand public de Will) : voir ADR 0055.
- Conservation sans limite du son : le son n'est utile que jusqu'au compte rendu validé.

## Ce que cet ADR ne décide pas

- La date d'envoi réel du préavis, donc la date d'ouverture (PR de mise en service).
- Une clé de chiffrement par enregistrement pour les textes en base (effacement par destruction de la clé) : reporté.
- L'AAD (`enc:v2`) : avec le chantier de rotation des clés.
- La place des registres dans le dépôt public (décision de Will en suspens, hors chantier).
