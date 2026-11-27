# Plan d'exécution : relevé de commission MENSUEL des apporteurs

- **Date** : 2026-11-27
- **Rôle** : concepteur. Ce document ne contient aucun code produit : un développeur l'applique lot par lot.
- **Décision d'origine (dirigeant, 27/11)** : la promesse « relevé de commission sous deux jours ouvrés » est
  remplacée par un **relevé mensuel**. En fin de mois ou au début du mois suivant, chaque apporteur reçoit un
  relevé du mois précédent, et tous le reçoivent **en même temps**. Console : vérification avant envoi, bouton
  « Envoyer les relevés à tout le monde » (idempotent), mode automatique **désactivé par défaut**, trace par
  apporteur sur sa fiche, statistiques globales.
- **Consignes ajoutées en cours de rédaction** (transmises par la session « Chantier des apporteurs ») : rien
  recréer (tableau de l'existant en tête), conformité légale citée article par article, contenu détaillé du
  relevé (ligne par commission, sous-totaux, report, cumul annuel, numéro unique, PDF A4 + e-mail + espace).
- Dépôt public : aucun montant réel, aucun nom réel. Les exemples sont fictifs et sans montant chiffré.

---

## 0. QUESTIONS AU DIRIGEANT (à trancher avant le lot 3)

> Le contrat (`src/features/apporteurs-reseau/contrat-v2.ts`, `CONTRAT_VERSION = "2.8"`) **ne contient pas
> les mots « relevé sous deux jours ouvrés »**. Il fixe en revanche **trois rythmes** que la décision du 27/11
> pourrait toucher. Le contrat ne se modifie pas sans vous.

**Q1 : le relevé mensuel S'AJOUTE-T-IL aux autofactures, ou les REMPLACE-T-IL ?** (bloquante)

Ce que dit le contrat 2.8 :

| Article | Texte (résumé fidèle) | Ligne |
| --- | --- | --- |
| 5.1 | L'autofacture est établie **le jour de l'encaissement intégral** (ou le premier jour ouvré où il est constaté), **une par encaissement**, et transmise par e-mail **avec un décompte** (commande, prix facturé, prix public, commission, date d'encaissement, avoir imputé, somme virée). | `contrat-v2.ts:374-385` |
| Annexe 2, 2.1 bis | Même règle : établie le jour de l'encaissement, **« transmise le même jour »** avec le décompte. | `contrat-v2.ts:918-928` |
| 5.3 | Échéance : 30 jours après l'émission. **« Délai indicatif » : la Société s'efforce de verser dans les deux jours ouvrés** suivant l'encaissement intégral ; ce n'est ni une échéance ni un engagement. | `contrat-v2.ts:401-419` |
| 5.4 | Même délai indicatif de deux jours ouvrés après une régularisation. | `contrat-v2.ts:434` |
| Annexe 2, 2.5 | Après la fin du mandat, le délai indicatif ne s'applique pas. | `contrat-v2.ts:971` |
| 13.2 | Un apporteur qui ne signe pas un avenant **reste sous la version qu'il a signée**. | `contrat-v2.ts:661` |

Deux lectures possibles :

- **Lecture A, RECOMMANDÉE, sans avenant.** Les autofactures et les virements continuent au fil de l'eau,
  comme le prévoient 5.1 et 2.1 bis (le code le fait déjà : job horaire `reseau-facturation`). Le relevé
  mensuel est un **récapitulatif d'information** de plus. Côté apporteur, seule disparaît la **phrase
  promotionnelle** « Nous nous efforçons de vous verser cette commission sous deux jours ouvrés » de l'e-mail
  d'autofacture (déjà retirée par la PR #2116, toujours en brouillon). Le délai indicatif reste écrit à
  l'article 5.3 : ce n'est pas un engagement, il ne coûte rien de le garder.
- **Lecture B : la facturation et le virement deviennent mensuels.** Il faut alors un **avenant 2.9** qui
  modifie 5.1, 5.3 (délai indicatif), 5.4, l'annexe 2 (2.1 bis, 2.5) et la **fiche des commissions
  (annexe 1 bis, contractuelle)**, dont le texte dit « par virement, au plus tard 30 jours après ». Trois
  conséquences :
  1. l'article 13.2 fait coexister **deux régimes**, mensuel pour les signataires de l'avenant et au fil de
     l'eau pour les autres. Le job horaire de facturation doit les distinguer ;
  2. l'échéance de 30 jours court de l'**émission** (5.3). Une émission mensuelle repousse le virement
     jusqu'à environ 60 jours après le paiement du client. Cela contredit la règle du 25/11
     (`paiement-integral.ts` : « le virement part au plus tard 30 jours après CE paiement ») et les textes
     déjà envoyés (livret, fiche, espace « Mes commissions », e-mail « commande signée ») ;
  3. il faut reprendre la numérotation, les tests de parité contrat-code et le calcul de l'échéance.

  **Ce plan est écrit pour la lecture A.** La lecture B ferait l'objet d'un lot 7 séparé, après l'avenant.

**Q2 : faut-il retirer le « délai indicatif de deux jours ouvrés » de l'article 5.3 au prochain avenant ?**
Sans avenant, la console continue d'afficher « Objectif de virement : avant le … », en orange une fois
dépassé (`apporteurs/commissions/page.tsx:81-98`), parce que le contrat le prévoit. Si vous souhaitez ne
plus le suivre, il faut un avenant. Retirer ce délai du seul code créerait un écart entre contrat et code,
interdit par `__tests__/parite-contrat-code.spec.ts:86`.

**Q3 : quel jour d'envoi ?** Proposition : le **3ᵉ jour ouvré du mois M+1, à 9 h 30 (heure de Paris)**. Les
relevés sont **préparés le 1ᵉʳ jour ouvré**, ce qui laisse deux jours pour les vérifier. Le jour doit rester
réglable dans la console (1ᵉʳ à 5ᵉ jour ouvré).

**Q4 : qui reçoit un relevé ?** « Tous les apporteurs » peut se lire de deux façons. Proposition :
(a) tout apporteur dont le contrat est **signé** (`statut = signe`), **même sans mouvement dans le mois**,
qui reçoit alors une version courte « aucun mouvement ce mois-ci » ; (b) **plus** tout apporteur résilié ou
retiré qui a eu un mouvement dans le mois ou qui a encore de l'argent en jeu (`argentEnJeu`,
`retrait.ts:340`). Variante plus sobre : ne rien envoyer en cas de mois sans mouvement. À trancher.

**Q5 : le relevé doit-il rouvrir un délai de contestation ?** Proposition : **non**. Il rappelle les délais
existants, sans en créer : 30 jours pour la forme d'une autofacture (5.2, annexe 2.4) et 12 mois pour le
calcul d'une commission (5.5). Une phrase « contestez sous N jours à réception du relevé » créerait un délai
que le contrat ne prévoit pas.

**Q6 : le cumul annuel est-il calculé en HT seulement, ou en HT et en TTC ?** Proposition : les deux, sur
l'année civile, en cohérence avec la DAS 2 (sommes versées à des tiers, déclarées en TTC pour un apporteur
assujetti). Point juridique incertain, à confirmer.

---

## 1. Existant : réutilisé, étendu ou à créer

| Existant (fichier ou objet) | Ce qu'il fait aujourd'hui | Décision |
| --- | --- | --- |
| `features/apporteurs-reseau/facturation.ts` | Facturation **au fil de l'eau** depuis la décision du 06/10 (« plus de relevé mensuel ni de seuil »). Une autofacture par apporteur et par passe, avoirs de la même série, e-mail `apporteur-releve`, alerte « À virer ». | **Réutilisé, sans modification de logique** (lecture A). Seul l'en-tête du fichier est mis à jour (§ 3). |
| Job `reseau-facturation` (`queues.ts:263-270`, `PATTERN_RESEAU_FACTURATION = "10 * * * *"`) | Lance la facturation horaire. | **Inchangé.** Seul le commentaire de la ligne 266 change. |
| Gabarit `apporteur-releve` (`lib/email/templates/apporteur-demarrage.tsx:347-366`, `958-1000`) | Malgré son nom, c'est l'**e-mail d'autofacture** (« Votre commission est facturée »). | **Gardé sous ce nom** : c'est un contrat entre l'app et le worker, et le renommer casserait les jobs en vol. Seule la phrase « deux jours ouvrés » disparaît (#2116). Dans la console, on l'appelle « autofacture » pour éviter la confusion avec le nouveau relevé. |
| Colonne `CommissionApporteur.releveMois` (`schema.prisma:16855+`) | Reliquat de l'ancien relevé mensuel. Aujourd'hui posée à `moisParis(maintenant)` à la facturation et utilisée comme marqueur « reprise imputée » (`facturation.ts:449-457`, `releveMois: null` dans les filtres). | **Ne PAS la réutiliser** pour le relevé : elle a deux sens et sert de garde dans les écritures. On la lit seulement pour un contrôle de cohérence (§ 5.4). |
| `PieceAutofactureApporteur` (`schema.prisma:16906`) | Pièces figées : numéro, genre (facture ou avoir), régime de TVA, totaux HT, TVA et TTC, `emiseAt`. | **Réutilisée comme source de vérité** des montants et de la TVA de chaque pièce. On ne recalcule jamais la TVA. |
| `commissions.ts` : `moisParis`, `genererPdfAutofacture`, `PREFIXE_AUTOFACTURE` | Mois de Paris, PDF d'autofacture (`@react-pdf/renderer`), série AXI-APP. | `moisParis` est **réutilisée**. Le PDF du relevé **suit le modèle** du PDF d'autofacture (même stockage R2, même police), dans un fichier séparé. |
| `autofacture-donnees.ts` : `totalTtcPieceCents`, `aVirerPartielCents`, `echeancePaiement`, `objectifVirement`, `jourParis`, `dateFr`, `libelleMois` | Calculs et formats déjà testés. | **Réutilisés** : TTC, somme virée, échéance, libellés. Le calcul des jours ouvrés (`objectifVirement`, l. 451) est **extrait en helper partagé** pour trouver le « Nᵉ jour ouvré du mois ». |
| `paiement-integral.ts` : `paiementsIntegrauxParFacture` | Date d'encaissement intégral par facture client. | **Réutilisée** pour la colonne « date d'encaissement ». |
| `espace-commissions.ts` et `espace-commissions-assemblage.ts` | Vue « Mes commissions » : état par commission, virements à venir, régime figé par pièce. | **Étendus** : la fonction d'assemblage pure sert de base aux lignes du relevé (mêmes états, mêmes libellés). Ajout d'une section « Mes relevés ». |
| `etat-commission.ts` | Libellé d'état d'une commission (facturée, versée, en attente…). | **Réutilisé** pour la colonne « statut ». |
| `envois.ts` : `envoyer`, `dejaEnvoye`, `jobIdSansDeuxPoints`, listes de gabarits | Envoi idempotent par `jobId` et `EmailLog`, filtre des apporteurs retirés, lien vers l'espace. | **Réutilisés tels quels.** On ajoute le nouveau gabarit aux listes. |
| `retrait.ts` : `GABARITS_ARGENT`, `argentEnJeu` | Les apporteurs retirés reçoivent encore les e-mails d'argent. | **Étendu** : le relevé mensuel est un e-mail d'argent. |
| Table `settings` (`Setting`, `schema.prisma:1699`) et modèle d'interrupteurs (`server/qualiopi/formateurs-independants/interrupteurs.ts` : absent ou illisible = position sûre) | Interrupteurs pilotés depuis la console. | **Réutilisés** pour le mode automatique (clé `apporteurs.releve-mensuel.*`). |
| `apporteur-crons-worker.ts` et file `apporteur-crons` (`queues.ts:1690-1740`) | Programme répétable du réseau, purge des entrées obsolètes. | **Étendus** : nouveau passage `releve-mensuel` (lot 4). ⚠️ Défaut de routage à corriger d'abord (lot 0). |
| Console `/[adminPrefix]/apporteurs/commissions` (page, `autofacture/`, `export/`) | Commissions, autofactures, « Virement fait ». | **Pas modifiée** (sauf libellés). Le relevé a sa propre page. |
| Fiche `/[adminPrefix]/apporteurs/[id]` (`components/admin/apporteurs/fiche/*`, dont `HistoriqueEmails.tsx`) | Blocs de la fiche, historique des e-mails. | **Étendue** : nouveau bloc « Relevés mensuels ». |
| Espace apporteur `app/apporteur/dossier/[id]/[jeton]/mes-commissions` et `factures/[numero]/route.ts` | Page en lecture seule (interrupteur `APPORTEUR_MES_COMMISSIONS_ENABLED`) et téléchargement des pièces avec contrôle du propriétaire. | **Étendus** : section « Mes relevés » et route `releves/[numero]` sur le **même modèle**. |
| Aperçu des e-mails (`server/email/apercu/catalogue.ts`, `payloads-exemple.ts`) et `outbox-policy.ts` | Catalogue, aperçu, politique d'envoi. | **Étendus** (nouveau gabarit). |
| PR **#2116** (brouillon) | Retire la phrase « deux jours ouvrés » de l'e-mail d'autofacture et met à jour le cliquet `g7`. | **À finaliser, pas à refaire** : c'est le lot 1. |
| PR #2259 et #2261 (plans « Mes commissions » et « challenges du mois ») | Plans de l'espace apporteur. | **À lire** avant le lot 6 pour aligner « Mes relevés » sur l'écran prévu. |
| PR #2387 (e-mail quand l'avoir d'un client réduit une commission) | Touche `apporteur-demarrage.tsx`, `outbox-policy.ts` et le catalogue. | **Risque de conflit** de fusion sur les mêmes fichiers : rebaser le lot 2 après elle. |
| PR #2400 (textes alignés sur le contrat 2.8, touche `faq.tsx`) | — | Coordination : voir § 3, ligne 12. |
| ADR 0051 (frontière console / Axion Partners) | La console porte l'apporteur jusqu'au contrat, Axion Partners ensuite (sans production aujourd'hui). | ⚠️ **À rappeler dans l'ADR du relevé** (lot 3) : le relevé est construit dans la console, faute de Partners en production. |
| Modèle de relevé mensuel, écran de vérification, job mensuel, statistiques | — | **À créer** (inexistants : recherche « relevé », « releve », « statement », « autofactur », « commission » dans le code, les plans, les ADR et les PR ouvertes ou fermées). |

---

## 2. Conformité légale (France)

1. **Facturation inchangée : autofacturation sous mandat.** Base légale : CGI art. 289, I-2 et mentions de
   l'art. 242 nonies A de l'annexe II ; contrat 5.2 et annexe 2 ; mention « Autofacturation ». Le relevé
   **n'est PAS une facture**. Il ne porte **ni** numéro de la série `AXI-APP`, **ni** le mot « facture » dans
   son titre, **ni** de date d'échéance propre. En tête et en pied, il porte la mention : « Document
   d'information, qui n'est pas une facture. Seules les autofactures et les avoirs joints à vos e-mails
   précédents font foi (contrat, article 5.1 et annexe 2). » Il **renvoie** au numéro de chaque autofacture
   et de chaque avoir.
2. **TVA.** Pour chaque ligne, les colonnes HT, TVA et TTC sont **lues sur la pièce figée**
   (`PieceAutofactureApporteur.regimeTva` et ses totaux), jamais recalculées au régime actuel de
   l'apporteur, car son régime peut avoir changé entre-temps (`ChangerRegimeTva`). Pour une pièce en
   franchise en base, la ligne porte la mention « TVA non applicable, article 293 B du CGI », reprise de la
   pièce (contrat 4.7 ; mention CIBS quand elle entrera en vigueur, comme le PDF d'autofacture).
3. **Conservation.** Les relevés envoyés sont conservés **10 ans** (code de commerce, art. L.123-22 ; contrat,
   art. 9, `contrat-v2.ts:535`, pour les décomptes). Ce n'est pas une obligation certaine pour un document
   d'information, mais c'est une précaution prise par alignement sur les décomptes. Le contenu est **figé** :
   JSON plus empreinte SHA-256 plus PDF dans R2, clé immuable. Aucune purge automatique. Clé étrangère
   `onDelete: Restrict`.
4. **Jamais modifié après l'envoi.** Une erreur se corrige par un **relevé rectificatif** : nouveau numéro
   (suffixe `-R1`, `-R2`…), lien vers le relevé d'origine, mention « Rectifie le relevé n° … du … ». Une
   garde en base l'impose : `updateMany` conditionné à `statut = prepare`.
5. **RGPD (art. 5.1.c, minimisation).** Le contenu figé ne stocke que ce qui est nécessaire : dénomination de
   l'entreprise présentée, numéro et date de la facture client, prestation, montants, statuts, numéros de
   pièces. **Aucun** nom de contact, e-mail ou téléphone de l'entreprise cliente. Les coordonnées de
   l'apporteur (déchiffrées par `decryptPii`) n'apparaissent **que dans le PDF**, qui est chiffré au repos
   comme les autofactures, et **pas** dans la colonne JSON. **Accès** : l'apporteur concerné, par son espace
   (jeton et contrôle `apporteurId`, même garde que `factures/[numero]/route.ts`), et les administrateurs de
   la console. Aucune autre exposition, pas de lien public.
6. **Réclamations.** Le relevé indique le contact (adresse de réponse de l'e-mail, comme les autofactures) et
   **rappelle** les délais du contrat : 30 jours pour la forme d'une autofacture (5.2, annexe 2.4), 12 mois
   pour le calcul d'une commission (5.5), et une réponse motivée sous 30 jours (5.6). Voir Q5.
7. **Requalification (salariat).** Un relevé mensuel « comme une fiche de paie » est un indice défavorable
   (voir les PR #2260 et #2267). Le relevé ne parle ni de « rémunération mensuelle », ni de « salaire », ni
   d'« objectif ». Il reste un **récapitulatif de commissions sur des affaires précises**. Le mot
   « challenge » n'y figure pas.

---

## 3. Occurrences à modifier (lecture A)

| # | Fichier:ligne | Texte actuel (extrait) | Action |
| --- | --- | --- | --- |
| 1 | `src/lib/email/templates/apporteur-demarrage.tsx:351` | « … Nous nous efforçons de vous verser cette commission sous deux jours ouvrés. » | Supprimer la phrase : **PR #2116**, à rebaser et finaliser (lot 1). |
| 2 | `src/lib/email/templates/__tests__/cliquets/g7.ts` | `apporteur-releve` dans la dette `delaiEnDur` | Retiré par #2116. |
| 3 | `src/server/queue/queues.ts:266` | « reçoit son autofacture dans l'heure (objectif de virement : deux jours ouvrés) » | Commentaire : « … autofacture dans l'heure (contrat 5.1) ; récapitulatif mensuel : passage `releve-mensuel` ». |
| 4 | `src/features/apporteurs-reseau/facturation.ts:1-17` | « Plus de relevé mensuel ni de seuil … » | En-tête : « Autofacture au fil de l'eau (contrat 5.1) ; le relevé MENSUEL d'information est dans `releve-mensuel/` (décision du 27/11) ». |
| 5 | `src/app/apporteur/dossier/[id]/[jeton]/mes-commissions/textes.ts:21` | « … virement au plus tard 30 jours après ce paiement. » | Ajouter : « Au début de chaque mois, vous recevez aussi un relevé récapitulatif du mois précédent. » (lot 6) |
| 6 | `apporteur-demarrage.tsx` (~l. 345), `commandeSignee.suite` | « … puis nous faisons le virement au plus tard 30 jours après ce paiement. » | Ajouter la même phrase sur le relevé mensuel, après l'activation du lot 5 (pas avant : on n'annonce pas un relevé qui ne part pas encore). |
| 7 | `src/features/admin-imprimes/TrameEchangeApporteur.tsx:300-301` | « Virement sous 30 jours au plus tard. » | Compatible. Ajout facultatif de « Relevé récapitulatif chaque début de mois. » |
| 8 | `private/apporteurs/livret-apporteur.pdf`, p. 5 | « Axion IA prépare votre facture, avec le détail du calcul. Virement au plus tard 30 jours après. » | **Compatible avec la lecture A.** Le source du livret n'est pas dans le dépôt : si une mention du relevé est voulue, la régénérer hors dépôt (question d'édition, sans urgence). |
| 9 | `private/apporteurs/fiche-des-commissions.pdf` (**annexe 1 bis, CONTRACTUELLE**) | « par virement, au plus tard 30 jours après » | **Ne pas toucher** (art. 13.1 : n'évolue que par avenant). |
| 10 | `src/features/apporteurs-reseau/contrat-v2.ts:410, 434, 971` | délai indicatif de deux jours ouvrés | **CONTRAT, interdit sans le dirigeant** (Q1, Q2). |
| 11 | `autofacture-donnees.ts:403, 451` et `apporteurs/commissions/page.tsx:81-98` | « Objectif de virement (2 jours ouvrés) » | **Gardés** tant que le contrat le prévoit (Q2). Tests associés : `autofacture-donnees.spec.ts:179` et `parite-contrat-code.spec.ts:86`, inchangés. |
| 12 | `src/components/recrutement/landings/faq.tsx:32` | « … vous nous la facturez et nous la réglons. » | Hors relevé, mais **faux** : c'est Axion qui facture (autofacturation). PR #2400 touche ce fichier : le signaler à cette PR plutôt que de corriger ici. |
| 13 | `SectionsPub.tsx:224`, `SectionsPrincipale.tsx:174` | « Quand l'entreprise a réglé, nous vous versons votre commission. » | Compatible, rien à faire. |
| 14 | Libellés de la console qui disent « relevé » pour l'autofacture (vérifier avec `grep -rn -i "relev" src/app/[locale]/(admin)/[adminPrefix]/apporteurs src/components/admin/apporteurs`) | — | Renommer en « autofacture » quand il s'agit de l'autofacture. Aucune occurrence trouvée au 27/11 : à revérifier au lot 3. |

**Interdits de rédaction**, rappelés pour tous les textes du chantier : jamais le nom de la ville du siège
dans un texte apporteur, jamais la formule de non-garantie de gains bannie, aucun montant en euros codé en
dur dans un gabarit (les montants viennent du payload).

---

## 4. Schéma de données : migration ADDITIVE seulement

Migration `prisma/migrations/2026MMDDHHMMSS_apporteur_releve_mensuel/`. Elle ne fait **que** des `CREATE` :
aucune colonne modifiée ni supprimée, aucune réécriture de `commissions_apporteur`, aucun remplissage
rétroactif.

```prisma
enum StatutReleveMensuel {
  prepare          // calculé, vérifiable, recalculable
  envoi_en_cours   // pris par un envoi (verrou logique)
  envoye           // remis à la file d'e-mails ; l'état de remise se lit dans EmailLog
  echec            // l'enfilage a échoué : renvoyable
  ecarte           // écarté par un administrateur pour cette période (motif obligatoire)
  @@map("statut_releve_mensuel")
}

model ReleveMensuelApporteur {
  id              String               @id @default(uuid()) @db.Uuid
  numero          String               @unique @db.VarChar(40)   // REL-AAAA-MM-NNNN[-Rk], série DISTINCTE d'AXI-APP
  apporteurId     String               @map("apporteur_id") @db.Uuid
  apporteur       ApporteurReseau      @relation(fields: [apporteurId], references: [id], onDelete: Restrict)
  periode         String               @db.Char(7)               // AAAA-MM (mois de Paris)
  rang            Int                  @default(0)               // 0 = relevé d'origine ; k = k-ième rectificatif
  rectifieId      String?              @map("rectifie_id") @db.Uuid
  statut          StatutReleveMensuel  @default(prepare)
  formatVersion   Int                  @default(1) @map("format_version")
  contenu         Json                                            // instantané figé (§ 5.3), sans PII de l'apporteur
  empreinteSha256 String               @map("empreinte_sha256") @db.Char(64)
  pdfR2Key        String?              @map("pdf_r2_key") @db.VarChar(300)
  // Totaux dénormalisés pour les statistiques (centimes ; jamais lus pour réémettre)
  nbLignes          Int @default(0) @map("nb_lignes")
  facturesHtCents   Int @default(0) @map("factures_ht_cents")
  avoirsHtCents     Int @default(0) @map("avoirs_ht_cents")
  viresTtcCents     Int @default(0) @map("vires_ttc_cents")
  enAttenteHtCents  Int @default(0) @map("en_attente_ht_cents")
  cumulAnneeHtCents Int @default(0) @map("cumul_annee_ht_cents")
  emailJobId      String?              @unique @map("email_job_id") @db.VarChar(120)
  prepareAt       DateTime             @default(now()) @map("prepare_at") @db.Timestamptz(3)
  envoyeAt        DateTime?            @map("envoye_at") @db.Timestamptz(3)
  envoyePar       String?              @map("envoye_par") @db.VarChar(60)  // "console:<adminId>" | "automatique"
  lotId           String?              @map("lot_id") @db.Uuid
  motifEcart      String?              @map("motif_ecart") @db.VarChar(300)
  erreur          String?              @db.VarChar(300)
  creeAt          DateTime             @default(now()) @map("cree_at") @db.Timestamptz(3)
  majAt           DateTime             @updatedAt @map("maj_at") @db.Timestamptz(3)

  @@unique([apporteurId, periode, rang])      // ← CŒUR DE L'IDEMPOTENCE
  @@index([periode, statut])
  @@index([apporteurId])
  @@map("releves_mensuels_apporteur")
}

model LotReleveMensuel {
  id          String    @id @default(uuid()) @db.Uuid
  periode     String    @db.Char(7)
  declenchePar String   @map("declenche_par") @db.VarChar(60)   // "console:<adminId>" | "automatique"
  debutAt     DateTime  @default(now()) @map("debut_at") @db.Timestamptz(3)
  finAt       DateTime? @map("fin_at") @db.Timestamptz(3)
  nbCibles    Int       @default(0) @map("nb_cibles")
  nbEnvoyes   Int       @default(0) @map("nb_envoyes")
  nbDejaEnvoyes Int     @default(0) @map("nb_deja_envoyes")
  nbEchecs    Int       @default(0) @map("nb_echecs")
  nbBloques   Int       @default(0) @map("nb_bloques")     // empreinte changée depuis la vérification
  @@index([periode])
  @@map("lots_releve_mensuel")
}
```

- Ajouter la relation inverse `relevesMensuels ReleveMensuelApporteur[]` à `ApporteurReseau`. Prisma ne
  produit pas de SQL pour un champ de relation inverse.
- **Interrupteurs** (table `settings`, pas de migration) : `apporteurs.releve-mensuel.auto` (booléen ;
  **absent ou illisible = ÉTEINT**) et `apporteurs.releve-mensuel.jour-ouvre` (entier de 1 à 5 ; absent = 3).
  Un module unique `releve-mensuel/interrupteurs.ts` les lit, sur le modèle de
  `formateurs-independants/interrupteurs.ts`.
- **Contrat de build `stub.invalid`** : aucune page SSG ne lit ces tables. Les pages de la console sont
  dynamiques. Rien à ajouter au Proxy Prisma.
- **Fenêtre app/worker** : les nouvelles tables ne sont lues que par du code qui arrive **après** la
  migration (§ 8). Toutes les colonnes nouvelles ont une valeur par défaut ou acceptent la valeur nulle.

---

## 5. Calcul du relevé

### 5.1 Période

Le mois civil **de Paris** : `[1er M 00:00 Europe/Paris ; 1er M+1 00:00 Europe/Paris[`. On le compare
toujours par `moisParis(date) === periode` (`commissions.ts:667`), jamais par un décalage UTC écrit en dur.
**Une période ne se prépare qu'une fois close** : le refus est côté serveur si `periode >= moisParis(now)`.

### 5.2 Règle d'appartenance (une commission figure UNE fois dans les « facturées »)

| Section du relevé | Règle exacte | Source dans le code |
| --- | --- | --- |
| **A. Commissions facturées dans le mois** | lignes `CommissionApporteur` avec `autofactureNumero ≠ null`, `avoirNumero = null`, `statut ∈ {due, versee}` et `moisParis(autofactureEmiseAt ?? majAt) = periode` | Date d'émission : même repli que `espace-commissions-assemblage.ts:116` (`emission()`). Écriture : `facturation.ts:449-470`. |
| **B. Avoirs émis dans le mois** (reprises, art. 4.5) | lignes `statut = reprise`, `avoirNumero ≠ null`, et `moisParis(PieceAutofactureApporteur[avoirNumero].emiseAt) = periode` (repli : `autofactureEmiseAt` de la ligne) | `facturation.ts:472-484` (l'avoir est émis avec l'autofacture suivante). |
| **C. Virements effectués dans le mois** | lignes `statut = versee` avec `moisParis(verseeAt) = periode`, regroupées par `autofactureNumero`. Montant : TTC de l'autofacture moins TTC des avoirs imputés, comme `aVirer` (`facturation.ts:396-410`) et `aVirerPartielCents`. Le net nul réglé par compensation est libellé « réglé par compensation (art. 12.4) ». | `marquerVerse` (`facturation.ts`), `aVirerPartielCents` (`autofacture-donnees.ts`). |
| **D. Report : en attente à la date du relevé** | état **au moment de la préparation** (libellé « au JJ/MM/AAAA ») : `a_qualifier` ; `due` avec `autofactureNumero = null` (motif `autofactureAttenteMotif`) ; `en_attente_vigilance` ; `litigeDepuis ≠ null` ; `due` facturée non versée (avec échéance `echeancePaiement`) ; reprises `statut = reprise`, `releveMois = null` (à imputer, art. 12.4) | Statuts : `schema.prisma:16832` ; libellés : `etat-commission.ts`. |
| **E. Cumul de l'année** | somme HT de A moins la somme HT de B sur `[janvier de l'année de la période ; fin de la période]`, plus le cumul TTC viré (C) sur la même plage (Q6) | Calcul en direct, pas à partir des relevés précédents : un relevé manquant ne fausse pas le cumul. |

- **Pourquoi la date d'émission et pas la date d'encaissement** : un encaissement du mois M peut ne pas être
  facturé en M (fiche incomplète, vigilance, litige, prestation non réalisée : `facturation.ts`,
  `autofactureAttenteMotif`). La date d'émission est **unique et immuable** par ligne, ce qui garantit
  qu'une commission ne figure jamais deux fois en A sur deux relevés. La date d'encaissement est
  **affichée** sur la ligne (colonne dédiée), sans servir de clé.
- Les lignes `annulee` sont exclues. Les lignes de parrainage (`parrainage = true`) figurent en A, regroupées
  sous « Parrainage (art. 4.6) », sans nom de filleul (même règle que `espace-commissions-assemblage.ts:272`).
- **Contrôle de cohérence** (test, pas condition d'exécution) : pour toute ligne de A,
  `releveMois === moisParis(autofactureEmiseAt)`. Un écart est remonté par `signalerErreurReseau`, sans
  bloquer.

### 5.3 Contenu figé (`contenu`, `formatVersion = 1`)

Une **ligne par commission** (sections A et B), avec :

- la date d'émission de la pièce ;
- l'entreprise présentée (dénomination) ;
- la prestation (libellé du palier : Journée IA, formation, mise en service…, depuis `palier` et la grille) ;
- la facture client (numéro et date) et la date d'encaissement intégral (`paiementsIntegrauxParFacture`) ;
- la base de calcul (`factureHtCents`, `prixPublicHtCents`) et la règle appliquée (forfait, prorata de
  remise 4.1 bis, plafond, parrainage à 10 %), formulée en texte à partir des mêmes fonctions que le
  décompte de l'autofacture ;
- les montants HT, TVA et TTC (lus sur la pièce figée), avec la mention 293 B si elle s'applique ;
- le statut : facturée (échéance), versée (date et référence du virement = numéro d'autofacture, l'IBAN
  n'est jamais affiché), reprise ou avoir (numéro, pièce rectifiée) ;
- les numéros de pièce : autofacture ou avoir.

Viennent ensuite :

- les **sous-totaux par statut** ;
- le **total du mois** : facturé HT, avoirs HT, net HT, TVA, TTC, et viré dans le mois ;
- le **report des montants en attente** (section D) ;
- le **cumul de l'année** (section E) ;
- l'**en-tête** : numéro du relevé, période, date de préparation, les **deux parties** (pour la Société, la
  dénomination, le SIREN et l'adresse depuis la constante légale existante ; pour l'apporteur, la
  dénomination et le SIREN, ses nom et adresse seulement dans le PDF), le contact pour une réclamation et le
  rappel des délais (§ 2.6), la mention « n'est pas une facture ».

L'empreinte est calculée ainsi : `empreinteSha256 = sha256(JSON canonique(contenu))`. Les clés sont triées,
les montants en centimes entiers et les dates au format ISO. Le helper canonique est **pur et testé**.

### 5.4 Où vit le code

Nouveau dossier `src/features/apporteurs-reseau/releve-mensuel/`, **sans `server-only`** (le worker l'atteint
par `tsx`) :

- `periode.ts` (pur) : période close, bornes de Paris, Nᵉ jour ouvré du mois (helper extrait de
  `objectifVirement`) ;
- `calcul.ts` (pur) : lignes et totaux à partir des lignes lues ; sans Prisma ;
- `lecture.ts` : requêtes Prisma bornées par apporteur, regroupées pour éviter les N+1 ;
- `empreinte.ts` (pur) ;
- `preparation.ts` : création ou recalcul des `prepare` ;
- `envoi.ts` : prise, enfilage, statut ;
- `pdf.tsx` : PDF A4 `@react-pdf/renderer`, sur le modèle de `genererPdfAutofacture` ;
- `interrupteurs.ts` ;
- `statistiques.ts`.

---

## 6. Idempotence : jamais deux fois le même relevé

1. **Base** : `@@unique([apporteurId, periode, rang])`. « Préparer » fait un `createMany({ skipDuplicates:
   true })` pour `rang = 0`. Un second clic ne crée rien.
2. **Recalcul** : autorisé **seulement** quand `statut = prepare` (`updateMany where { id, statut: "prepare"
   }`). Sinon refus.
3. **Prise** : avant d'envoyer, `updateMany where { id, statut: { in: ["prepare", "echec"] } } → envoi_en_cours`.
   Si `count ≠ 1`, la ligne est déjà prise : on passe à la suivante (deux envois concurrents, ou le bouton
   pendant le passage automatique).
4. **Ce qui part est ce qui a été vérifié** : juste avant l'enfilage, on **recalcule** le contenu et on
   compare l'empreinte. Si elle diffère, par exemple parce qu'un « Virement fait » a eu lieu entre la
   vérification et l'envoi, la ligne revient en `prepare` avec `erreur = "contenu changé depuis la
   vérification"`. Elle est comptée en `nbBloques`, **rien ne part**, et l'écran la signale « à revérifier ».
5. **E-mail** : `jobId = apporteur-releve-mensuel-<AAAA-MM>-r<rang>-<apporteurId>`, sans deux-points
   (`jobIdSansDeuxPoints`). On vérifie `dejaEnvoye(jobId)` (`EmailLog`, `envois.ts:239`) **avant**
   `envoyer()`. BullMQ refuse de son côté un `jobId` déjà présent.
6. **Verrou de période** : `pg_try_advisory_xact_lock(hashtext('releve-mensuel:' || periode))` autour d'un
   lot. Un second lot simultané répond « un envoi est déjà en cours pour cette période ».
7. **Après l'enfilage** : `statut = envoye`, `envoyeAt`, `envoyePar`, `emailJobId`. Si l'enfilage échoue
   (`envoyer` rend `"indisponible"`), `statut = echec` avec un message : la ligne est renvoyable par le
   même bouton. L'état **réel** de remise (envoyé ou échoué) se lit dans `EmailLog` par `jobId`. Le bouton
   « Renvoyer » n'est proposé que si `EmailLog` est `failed` **et** que `dejaEnvoye` rend `false`
   (`envoyer` appelle déjà `retirerEnvoiEchoue`).
8. **Rectificatif** : action **individuelle** (jamais par le bouton global). Elle crée `rang = max + 1`, un
   nouveau numéro `-Rk`, `rectifieId` et un nouveau `jobId`. Le bouton global ne vise que `rang = 0`.

---

## 7. Job mensuel BullMQ

- **Type** : `releve-mensuel`, ajouté à `ApporteurCronJobType` (`server/queue/types.ts:296`) et au programme
  de `bootRepeatableJobs` (`queues.ts:1697+`), sur la file existante `apporteur-crons`.
- **Cadence** : un passage **quotidien**, avec `repeat: { pattern: "30 9 * * *", tz: "Europe/Paris" }` (comme
  le récap des clients, `queues.ts`, « 7 h 30 à PARIS : tz »). Le job décide lui-même :
  1. le 1ᵉʳ jour ouvré du mois, si la période M-1 n'est pas préparée, il **prépare** et envoie **une** alerte
     interne « Relevés de <mois> prêts à vérifier » (`destinataireAlertesInternes`, clé d'idempotence
     `releve-mensuel-pret-<AAAA-MM>`). Cette étape tourne **même mode automatique éteint** ;
  2. si `apporteurs.releve-mensuel.auto` est ALLUMÉ **et** que l'on est au Nᵉ jour ouvré ou après, et que des
     relevés `rang = 0` de M-1 restent en `prepare` ou `echec`, il lance le **même** lot que le bouton
     (`envoyePar = "automatique"`) ;
  3. un passage quotidien plutôt qu'un cron mensuel donne le **rattrapage** : si le worker était arrêté ce
     jour-là, le passage suivant fait le travail. La garde est la période et le statut, pas la date exacte.
- **Purge des répétables** : la clé `wanted` est `${name}|${pattern}` (`queues.ts:1724`). L'ajout est sans
  effet sur les autres entrées.

### ⚠️ Deux conteneurs (AGENTS.md, « DEUX conteneurs, DEUX vitesses » et « D8b »)

Le worker est reconstruit depuis les sources TypeScript. Il peut atterrir **avant** l'app (auto-déploiement
Coolify) ou **après** elle (job `deploy_worker`, D8b). La règle est symétrique : chaque PR doit tolérer les
deux sens pendant environ une heure.

1. **Défaut de routage existant, à corriger en premier (lot 0).** Dans `apporteur-crons-worker.ts:41-80`, un
   job **au nom inconnu** retombe sur `relance-invitation`, qui lance `passerRelancesInvitation()`. Or ces
   rappels ont été **retirés sur ordre du dirigeant le 26/10**. Un ancien worker qui recevrait un job
   `releve-mensuel` enverrait donc des rappels d'invitation. Correctif : un nom inconnu est **journalisé et
   ignoré** ; `relance-invitation` n'est exécuté que sur son nom exact. Ce correctif doit être **en ligne
   au moins un créneau avant** le lot 4.
2. **La console n'enfile JAMAIS de job sur `apporteur-crons`.** Le bouton exécute le lot **dans le
   conteneur du site** (Server Action) et n'enfile que des **e-mails**. Seul le worker pose le répétable
   (`bootRepeatableJobs` n'est appelé que par `worker.ts:216`).
3. **Nouveau gabarit `apporteur-releve-mensuel`.** Aucun ancien gabarit ne peut servir de `gabaritRepli` :
   `apporteur-releve` dirait « Votre commission est facturée », ce qui serait faux. Il n'y a donc **pas de
   repli**, et la règle est d'ordre : le gabarit est livré au lot 2, et le premier émetteur au lot 4, **au
   moins un créneau de mise en ligne plus tard**. Le lot 4 le vérifie dans sa description, en lisant le
   contenu du conteneur worker : `grep -rl "apporteur-releve-mensuel" /app/src`.
4. **Migration** : l'entrypoint qui migre est celui de l'**app**. Le code du worker qui lit les nouvelles
   tables (lot 4) doit **tolérer leur absence** : `try/catch` sur l'erreur Prisma P2021, journal « table
   absente, passage sauté », aucun envoi. Il ne doit jamais planter. Le lot 3 (migration) part au moins un
   créneau avant le lot 4.
5. **Vérifier l'atterrissage des deux conteneurs** : en-tête `x-axion-build-sha` pour l'app, `grep` d'un
   marqueur dans `/app/src` pour le worker (AGENTS.md), puis `prisma migrate status` après le lot 3.

---

## 8. Écrans de la console

Les pages sont dynamiques et les composants serveur, dans la charte de la console. Pas de bibliothèque
cliente nouvelle, à cause du budget du bucket console admin (ADR 0049 et 0077).

1. **`/[adminPrefix]/apporteurs/releves`** : périodes et statistiques globales.
   - Cartes : nombre d'apporteurs signés, apporteurs avec mouvement dans le mois, total HT facturé du mois,
     total viré, en attente, cumul de l'année.
   - **Évolution sur 12 mois** : tableau mensuel (facturé HT, viré, nombre d'apporteurs actifs) avec écart
     au mois précédent. Les colonnes dénormalisées servent pour les mois préparés ; le calcul direct
     (`statistiques.ts`) sert pour les autres. Une barre horizontale CSS suffit, sans bibliothèque de
     graphique.
   - Liste des périodes : préparés, envoyés, échecs, écartés.
   - Lecture : administrateurs de la console.
2. **`/[adminPrefix]/apporteurs/releves/[periode]`** : **vérification avant envoi**.
   - Tableau par apporteur : nom, nombre de commissions, facturé HT / TVA / TTC, avoirs, viré, en attente,
     statut du relevé, empreinte courte (8 caractères), lien « Aperçu » (PDF et e-mail rendus depuis le
     contenu figé, sans envoi : réutiliser l'aperçu du catalogue).
   - **Bandeau d'anomalies bloquantes**, ligne par ligne : e-mail absent ou en erreur, commission
     `a_qualifier`, autofacture en attente (motif), contenu changé depuis la vérification.
   - Boutons :
     - « Préparer les relevés de <mois> » (si non préparés) ;
     - « Recalculer » (lignes `prepare` seulement) ;
     - « Écarter cet apporteur » (motif obligatoire) ;
     - **« Envoyer les relevés à tout le monde »**, avec confirmation en deux temps : on saisit `AAAA-MM`
       pour confirmer, sur le modèle de « Virement fait », qui exige `confirmer=oui`. L'écran affiche
       « Déjà envoyés : N ; à envoyer : M ». Après un envoi complet, le bouton est désactivé et indique
       « Tous les relevés de <mois> sont partis le … » ;
     - « Renvoyer les échecs ».
   - Garde : `peutEngager(role, "facturer")`, la même que `actions-commissions.ts:31-37` (envoyer, recalculer,
     écarter).
   - Résultat du lot affiché : envoyés, déjà envoyés, bloqués, échecs (depuis `LotReleveMensuel`).
3. **Mode automatique** (lot 5) : bloc « Envoi automatique » sur la page 1, avec un interrupteur (éteint
   par défaut) et le jour ouvré (1 à 5). Allumer est réservé à `super_admin`. Allumer exige qu'**au moins
   une période ait déjà été envoyée à la main sans échec**, condition relue côté serveur au moment du geste.
   Éteindre n'a aucun préalable. Chaque changement est journalisé (qui, quand) dans `settings.updatedBy` et
   au journal d'audit existant.
4. **Fiche apporteur `/[adminPrefix]/apporteurs/[id]`** : nouveau bloc `RelevesMensuels.tsx` dans
   `components/admin/apporteurs/fiche/`. Il affiche, pour chaque relevé : période, numéro, date d'envoi,
   **statut d'envoi** (lu dans `EmailLog` par `emailJobId` : en file, envoyé, échoué), empreinte (8
   caractères, et complète au survol), PDF (lien protégé) et rectificatifs. Bouton « Établir un relevé
   rectificatif » (garde « facturer »).
5. **Espace apporteur** (lot 6, derrière `APPORTEUR_MES_COMMISSIONS_ENABLED`) : section « Mes relevés » dans
   `mes-commissions` et route `releves/[numero]/route.ts`, **copiée** de `factures/[numero]/route.ts`
   (contrôle du jeton, de `apporteurId` et du format du numéro, en-têtes `no-store`).

---

## 9. E-mail du relevé (`apporteur-releve-mensuel`)

- Gabarit dans `apporteur-demarrage.tsx`, nouvelle clé `COPY_DEMARRAGE.releveMensuel`, famille « B »,
  `signature="fondateur-court"` comme `apporteur-releve`.
- Objet : « Votre relevé de commissions de <mois> ». Variante sans mouvement : « Votre relevé de <mois> :
  aucun mouvement ».
- Corps court : le total du mois (montant **issu du payload**), le nombre de commissions, le report en
  attente, puis « Le détail ligne par ligne est dans le relevé joint (PDF) et dans votre espace. Ce relevé
  est un récapitulatif, qui n'est pas une facture : vos autofactures restent les pièces qui font foi. »,
  puis le rappel des délais de réclamation (§ 2.6).
- Pièce jointe : le PDF du relevé (`attachments` avec `r2Key`, même mécanisme que l'autofacture).
- À enregistrer :
  - `server/queue/types.ts` (`EmailJobName`) ;
  - `lib/email/templates/index.tsx` (objet et composant) ;
  - `server/email/outbox-policy.ts` (libellé « Apporteur : relevé mensuel de commissions ») ;
  - `server/email/apercu/catalogue.ts` et `payloads-exemple.ts` (exemple **fictif**, montants factices
    formatés par le code) ;
  - `envois.ts`, dans les **trois** listes où figure `apporteur-releve` (l. 50, 78, 131) ;
  - `retrait.ts`, dans `GABARITS_ARGENT`.
- Lien vers l'espace : automatique par `avecLienEspace` (`envois.ts`). Vérifier que
  `__tests__/chaque-e-mail-ouvre-l-espace.spec.ts` le couvre.
- Faire passer les cliquets `lib/email/templates/__tests__/cliquets/g1` à `g9` (délai en dur, montants,
  mots interdits), sans ajouter de dette.

---

## 10. Tests à écrire

| Fichier (proposé) | Ce qu'il verrouille |
| --- | --- |
| `releve-mensuel/__tests__/periode.spec.ts` | Bornes de Paris aux changements d'heure (dernier dimanche de mars et d'octobre) ; période non close refusée ; Nᵉ jour ouvré avec fériés (1er janvier, 1er mai, 15 août…). |
| `__tests__/calcul.spec.ts` | Règle A, B, C, D, E : une commission émise le dernier jour du mois à 23 h 30 de Paris tombe dans M, pas dans M+1 ; encaissée en M mais facturée en M+1, elle apparaît en D de M puis en A de M+1, **jamais deux fois en A** ; avoir dans le mois de son émission ; compensation intégrale libellée ; parrainage sans nom de filleul ; `annulee` exclue ; TVA lue sur la pièce figée même après un changement de régime ; mention 293 B. |
| `__tests__/empreinte.spec.ts` | JSON canonique stable (ordre des clés, centimes), empreinte identique pour un contenu identique, différente au moindre centime. |
| `__tests__/idempotence.spec.ts` | Deux préparations créent un seul relevé ; deux lots concurrents donnent un seul enfilage par apporteur ; un relevé `envoye` n'est jamais recalculé ; une empreinte changée bloque, rien ne part ; « Renvoyer » refusé si `dejaEnvoye`. |
| `__tests__/rectificatif.spec.ts` | Le rectificatif crée `rang = 1` et le numéro `-R1` ; l'original reste intact ; le bouton global ignore les rangs supérieurs à 0. |
| `__tests__/n-est-pas-une-facture.spec.tsx` | Le PDF et l'e-mail portent « n'est pas une facture », ne contiennent jamais `AXI-APP-` comme numéro du relevé, ni « Autofacturation » comme titre. |
| `__tests__/rgpd-contenu.spec.ts` | `contenu` ne contient aucune clé `email`, `telephone`, `iban`, `prenom` ou `nom` de contact. |
| `server/queue/workers/__tests__/apporteur-crons-nom-inconnu.spec.ts` (lot 0) | Un nom inconnu n'exécute **pas** `passerRelancesInvitation`. |
| `__tests__/job-releve-mensuel.spec.ts` | Mode automatique éteint : préparation et alerte seulement, aucun e-mail. Allumé : envoi au Nᵉ jour ouvré, rattrapage le lendemain, aucun renvoi le surlendemain. Table absente (P2021) : passage sauté sans erreur. |
| `__tests__/interrupteurs-releve.spec.ts` | Absent ou illisible = éteint ; allumage refusé sans envoi manuel préalable. |
| `lib/email/templates/__tests__/apporteur-releve-mensuel.spec.tsx` | Rendu, variante sans mouvement, aucun délai en dur, aucun mot interdit, lien vers l'espace. |
| Route `releves/[numero]/route.spec.ts` | Jeton d'un autre apporteur : 404 ; numéro mal formé : 404 ; interrupteur éteint : 404. |
| Garde existante `parite-contrat-code.spec.ts` | **Doit rester verte sans modification** : preuve que le contrat n'a pas bougé. |

---

## 11. Découpage en PR (ordre imposé)

Chaque PR est ouverte **en brouillon** et passe « prête » une seule fois, à la fin (AGENTS.md, CI-LOT1). Une
PR ne doit jamais contenir le premier émetteur d'un nom (job ou gabarit) que le worker ne connaît pas encore.

| Lot | Contenu | Dépend de | Remarque deux conteneurs |
| --- | --- | --- | --- |
| **0** | Routage `apporteur-crons` : nom inconnu journalisé et ignoré. Test. | — | Doit être **en ligne** avant le lot 4. |
| **1** | Finaliser **#2116** (phrase « deux jours ouvrés » retirée, cliquet `g7`) ; commentaires `queues.ts:266` et en-tête de `facturation.ts`. | — | Texte seul, sans contrat partagé. |
| **2** | Gabarit `apporteur-releve-mensuel` et son enregistrement partout (§ 9), aperçu, tests de rendu. **Aucun émetteur.** | rebaser après #2387 | Le worker apprend le gabarit **avant** tout émetteur. |
| **3** | Migration additive (§ 4), module `releve-mensuel/` (`periode`, `calcul`, `lecture`, `empreinte`, `preparation`, `pdf`), écrans 1 et 2 **en lecture et préparation seulement** (pas de bouton d'envoi), statistiques, ADR « Relevé mensuel des apporteurs » (n° suivant 0077), tests de calcul. | 2 | Vérifier `prisma migrate status` après l'atterrissage. |
| **4** | Envoi : `envoi.ts`, bouton « Envoyer à tout le monde », « Renvoyer les échecs », rectificatif, bloc fiche apporteur, passage quotidien `releve-mensuel` (préparation et alerte ; envoi seulement si l'interrupteur est allumé, et il est **absent** à ce stade), tests d'idempotence. | 0, 2 et 3 **en ligne** | Le passage tolère l'absence de table. Description de la PR : preuve que le worker connaît le gabarit. |
| **5** | Mode automatique : interrupteur dans la console, jour ouvré, garde d'allumage, journal. | 4, et **un mois envoyé à la main** | Désactivé par défaut. |
| **6** | Espace apporteur : « Mes relevés », route de téléchargement, phrase des textes 5 et 6 (§ 3). | 4 ; lire #2259 et #2261 | Derrière `APPORTEUR_MES_COMMISSIONS_ENABLED`. |
| 7 | *(seulement en lecture B, après avenant signé)* Facturation mensuelle pour les signataires de l'avenant. | Q1 = B | Hors de ce plan. |

**Premier mois réel** : préparer, vérifier à l'écran, envoyer à la main (lot 4), puis seulement ensuite
allumer le mode automatique (lot 5).

---

## 12. Risques

| Risque | Gravité | Parade |
| --- | --- | --- |
| Lire la décision comme « facturer au mois » sans avenant, ce qui viole 5.1 et l'annexe 2.1 bis | **Haute** | Q1 en tête ; plan en lecture A ; `parite-contrat-code.spec.ts` inchangé. |
| Le relevé est pris pour une facture : double déclaration de TVA, contestation | Haute | Mention « n'est pas une facture », série `REL-` distincte, test dédié. |
| Double envoi (double clic, bouton et automate, relance d'un job) | Haute | Unicité (apporteur, période, rang), prise conditionnelle, `jobId` déterministe, `dejaEnvoye`, verrou consultatif. |
| Ce qui part diffère de ce qui a été vérifié | Moyenne | Empreinte recomparée avant l'enfilage ; blocage et « à revérifier ». |
| Un ancien worker exécute un job inconnu comme `relance-invitation` (rappels arrêtés le 26/10) | **Haute** | Lot 0 en ligne avant le lot 4 ; la console n'enfile jamais sur `apporteur-crons`. |
| Gabarit inconnu d'un ancien worker, sans repli possible | Moyenne | Ordre lot 2, puis un créneau, puis lot 4 ; vérification du contenu du worker. |
| Worker plus récent que la migration (P2021) | Moyenne | Tolérance à la table absente ; lot 3 un créneau avant le lot 4. |
| Fuseau ou heure d'été : une commission de 23 h 30 au mauvais mois | Moyenne | `moisParis` partout, tests aux changements d'heure. |
| Confusion des noms (`apporteur-releve` = autofacture, `releveMois` = marqueur d'imputation) | Moyenne | Ne pas réutiliser ; commentaires explicites ; libellés de la console « autofacture ». |
| Indice de salariat (« paie mensuelle ») | Moyenne | Vocabulaire du § 2.7 ; relire avec les PR #2260 et #2267. |
| Conflits de fusion avec #2116, #2387, #2400 (mêmes fichiers) | Faible | Ordre de rebase indiqué au § 11. |
| Bruit pour des apporteurs sans activité | Faible | Q4 (variante courte ou aucun envoi). |
| Disque du VPS (PDF dans R2, pas sur le VPS) | Faible | Stockage R2 comme les autofactures ; rien dans `/tmp`. |
