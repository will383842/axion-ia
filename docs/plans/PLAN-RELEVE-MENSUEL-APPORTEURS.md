# Plan d'exécution : relevé de commission MENSUEL des apporteurs

- **Date** : 2026-11-27 (révision 2 : corrige la relecture « VERDICT : À CORRIGER » sur la tête `6229570b`)
- **Rôle** : concepteur. Ce document ne contient aucun code produit : chaque lot du § 11 est confié à une
  session Sonnet, qui l'applique seule.
- Dépôt public : aucun montant réel, aucun nom réel, aucun IBAN. Les exemples sont fictifs et sans montant
  chiffré.

## Décisions du dirigeant (27/11) : elles s'imposent à chaque lot

| #   | Décision                                                                                                                                                                                               | Où elle est tenue dans ce plan                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| D1  | Relevé **MENSUEL** : en fin de mois ou au début du mois suivant, pour le **mois précédent**.                                                                                                           | § 5.1 (période close seulement), § 7                                  |
| D2  | Envoyé **à tous en même temps**.                                                                                                                                                                       | § 6.3 (un lot unique qui ne fait qu'enfiler), § 5.2 (coupure fixe)    |
| D3  | Bouton console **« Envoyer les relevés à tout le monde »**, pour vérifier les calculs d'abord. L'automatique viendra **plus tard**.                                                                    | § 8.2 ; lot 5 décrit mais **non lançable** (§ 11)                     |
| D4  | Une **trace de chaque relevé envoyé, par apporteur**, et des **statistiques globales**.                                                                                                                | § 4 (table), § 8.1 (statistiques), § 8.4 (fiche apporteur)            |
| D5  | **NE RIEN RECRÉER** : autofacturation et mandat existent (migrations `20260909210000_autofacturation_mandat`, `20261007150000_apporteurs_autofacture_attente`, `20261126140000_apporteurs_tva_figee`). | § 1 (inventaire complet, décision ligne par ligne)                    |
| D6  | Chaque apporteur est payé selon la grille de **SON** contrat signé, jusqu'à ce qu'il signe un avenant (contrat, art. 13.2).                                                                            | § 5.3 (règle LUE, jamais recalculée) ; écart du code actuel : § 0, Q8 |
| D7  | **Aucun e-mail envoyé sans un clic du dirigeant.**                                                                                                                                                     | § 7 (le worker prépare, n'envoie jamais) ; lot 5 non lançable         |
| D8  | Le relevé **récapitule** les autofactures, il ne les remplace pas (Q1 tranchée : lecture A).                                                                                                           | § 0, § 2.1                                                            |

**Fichiers interdits à tous les lots** : `legal.ts`, `cgv-*`, `journee-ia-commun.ts`, `contrat-v2.ts`,
`CONTRAT_VERSION`. Le contrat ne bouge pas : `__tests__/parite-contrat-code.spec.ts` doit rester vert sans
modification.

---

## 0. Questions au dirigeant

**Q1 : DÉCIDÉE = lecture A.** Le relevé mensuel **s'ajoute** aux autofactures, qui restent émises au fil de
l'eau le jour de l'encaissement intégral (contrat 5.1, annexe 2, 2.1 bis ; job horaire `reseau-facturation`).
Le relevé est un récapitulatif d'information. Aucun avenant n'est nécessaire. L'ancien « lot 7 » (facturation
mensuelle sous avenant 2.9) est **retiré du plan**.

Rappel de ce que dit le contrat 2.8, pour mémoire :

| Article           | Texte (résumé fidèle)                                                                                                   | Ligne                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 5.1               | Autofacture établie le jour de l'encaissement intégral, une par encaissement, transmise par e-mail avec un décompte.    | `contrat-v2.ts:374-385` |
| Annexe 2, 2.1 bis | Même règle : « transmise le même jour » avec le décompte.                                                               | `contrat-v2.ts:918-928` |
| 5.3               | Échéance : 30 jours après l'émission. Délai indicatif de deux jours ouvrés, qui n'est ni une échéance ni un engagement. | `contrat-v2.ts:401-419` |
| 13.2              | Un apporteur qui ne signe pas un avenant reste sous la version qu'il a signée.                                          | `contrat-v2.ts:661`     |

**Q2 : faut-il retirer le « délai indicatif de deux jours ouvrés » (art. 5.3) au prochain avenant ?** Sans
avenant, la console garde « Objectif de virement » (`apporteurs/commissions/page.tsx:81-98`) ; le retirer du
seul code ferait échouer `parite-contrat-code.spec.ts:86`. Aucun lot n'en dépend.

**Q3 : quel jour d'envoi ?** Sans effet sur les lots prêts : l'envoi est **manuel** (D3, D7). Les relevés sont
**préparés automatiquement le 1ᵉʳ jour ouvré** de M+1 (préparer n'envoie rien) ; le dirigeant vérifie, puis
clique. Le jour du futur mode automatique sera tranché avec le lot 5.

**Q4 : qui reçoit un relevé ? DÉFAUT RETENU (a), sous réserve de confirmation.** C'est la lecture la plus
fidèle de « tous » :

- tout apporteur au contrat **signé** (`statut = signe`), **même sans mouvement** : il reçoit une version courte
  « aucun mouvement ce mois-ci » ;
- **plus** tout apporteur résilié ou retiré qui a eu un mouvement dans le mois ou qui a encore de l'argent en
  jeu (`argentEnJeu`, `retrait.ts:340`).

Si le dirigeant préfère ne rien envoyer en cas de mois sans mouvement, il suffit d'« écarter » ces lignes (bouton
du § 8.2) : le code n'a pas à changer.

**Q5 : le relevé ne rouvre AUCUN délai de contestation.** C'est conforme à la demande et au contrat : le relevé
**rappelle** les délais existants (30 jours pour la forme d'une autofacture, art. 5.2 et annexe 2.4 ; 12 mois
pour le calcul d'une commission, art. 5.5 ; réponse motivée sous 30 jours, art. 5.6) et n'en crée pas.

**Q6 : cumul annuel en HT seul, ou en HT et TTC ?** Proposition : les deux, sur l'année civile (cohérence avec la
DAS 2). Point juridique incertain. Le calcul pur (lot 3b) produit les deux ; l'affichage du TTC se coupe d'une
ligne si la réponse est « HT seul ».

**Q7 (NOUVELLE, bloque l'affichage d'UNE règle) : où vit la règle « plafond formation de 3 jours ou plus » ?**
Elle est citée par le dirigeant, mais elle **n'existe ni dans `regles.ts` ni dans `contrat-v2.ts` sur `main`** :
les paliers `PALIERS_FORMATION` s'arrêtent à 2 jours (`regles.ts:323-366`). Tant que la réponse n'est pas
donnée, le relevé n'affiche **pas** cette règle (il n'invente rien) ; une commission de ce type apparaîtrait
avec la règle effectivement stockée (§ 5.3). Si la règle doit exister, c'est un **chantier de calcul et de
contrat** à part, hors de ce plan.

**Q8 (NOUVELLE, ARGENT) : le calcul actuel ne suit PAS la version signée par chaque apporteur.** Constat sur
`main` : `calculerCommission` (`regles.ts:510`) choisit la grille d'après la **date de signature de la
commande** (`CONFERENCE_SANS_COMMISSION_DEPUIS`, `DEVELOPPEMENT_WEB_COMMISSIONNE_DEPUIS`, `regles.ts:371-384`),
**pour tous les apporteurs**. Il ne lit jamais la version que l'apporteur a signée. Or cette version est stockée :
`ApporteurReseau.signatureApporteur.version` (`signature.ts:74` et `:195` ; absente = v2, signature antérieure
au 07/10). Conséquence possible : un apporteur signé en 2.6 ou 2.7, qui n'a pas signé de 2.8, se voit appliquer
la grille 2.8 (conférence sans commission, développement web à 15 %) pour une commande signée après le 26/11.
Cela contredit l'art. 13.2 et la décision D6. Questions :

1. Confirmez-vous que la grille suit la **version signée par l'apporteur** (et non la date de la commande) ?
2. Le lot **G1** (lecture seule, prêt) mesure combien d'apporteurs sont concernés et sous quelles versions. Le
   lot **G2** (correction du calcul) ne démarre qu'après votre réponse et la table des grilles 2.6 / 2.7 / 2.8
   qu'il produira : c'est un changement du calcul de l'argent, à relire par Opus.

Le relevé, lui, **n'est pas bloqué** par Q8 : il affiche la règle et la version **stockées sur la commission**
au moment du calcul (§ 5.3), jamais une règle recalculée.

---

## 1. Existant : réutilisé, étendu, écarté (D5)

### 1.1 Les migrations nommées par le dirigeant et leurs voisines

| Migration                                       | Ce qu'elle a posé                                                                                                                                                                                                                                   | Décision pour le relevé                                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260909210000_autofacturation_mandat`         | Mandat d'autofacturation des **formateurs** (`trainers.mandat_autofacturation_*`), cycle de l'autofacture formateur (`autofacture_at`, `autofacture_transmise_at`, `contestation_avant_at`, `contestee_at`), `DocumentType.autofacture_honoraires`. | **Réutilisé comme modèle de cycle, pas comme table.** On reprend la séparation « préparé → transmis → contestable » et l'idée de dater la transmission (ici `envoyeAt`). Aucune colonne de cette migration n'est modifiée. |
| `20260912100000_autofacture_document_id`        | Lien **direct** `trainer_statements.autofacture_document_id` → `documents_generes`. Leçon écrite (`schema.prisma`, `TrainerStatement`) : sans lien direct, le rattrapage a envoyé le PDF du mauvais mois.                                           | **Leçon reprise** : le relevé porte la clé de SON PDF sur sa propre ligne (`pdfR2Key` + `pdfSha256`), la clé contient le numéro du relevé, et l'e-mail joint cette clé-là, jamais « le dernier PDF de l'apporteur ».       |
| `20261007090000_apporteurs_avoir_emission`      | `avoirNumero` et date d'émission des avoirs apporteur.                                                                                                                                                                                              | **Lu** pour la section B (avoirs du mois).                                                                                                                                                                                 |
| `20261007150000_apporteurs_autofacture_attente` | `commissions_apporteur.autofacture_attente_motif` et `autofacture_attente_depuis`.                                                                                                                                                                  | **Lu** pour la section D (en attente d'autofacture, **datée** : reconstituable à la coupure, § 5.2).                                                                                                                       |
| `20261126140000_apporteurs_tva_figee`           | `pieces_autofacture_apporteur` (numéro, genre, régime de TVA figé, totaux HT/TVA/TTC, `emise_at`) et `apporteur_regime_tva_changements`.                                                                                                            | **Source de vérité des montants** : HT, TVA, TTC et mention 293 B lus sur la pièce figée. Aucun recalcul de TVA.                                                                                                           |
| `20261126150000_apporteur_changement_iban`      | Demandes de changement d'IBAN, figées par **triggers SQL** (`…_garde_update`, `…_refuse_delete`).                                                                                                                                                   | **Modèle repris** pour le trigger de figement du relevé (§ 2.4) et pour son test statique.                                                                                                                                 |

### 1.2 Code et objets

| Existant                                                                                                                                                                   | Ce qu'il fait                                                                                                                                                                                                                                                      | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`TrainerStatement`** (`schema.prisma:5822`, `trainer_statements`)                                                                                                        | **Relevé mensuel sous autofacturation des FORMATEURS** : `periodeYear`/`periodeMonth`, `statut`, régime de TVA figé à la validation, totaux HT/TVA/TTC, `autofactureDocumentId`, transmission, fenêtre de contestation (`server/actions/qualiopi/autofacture.ts`). | **Écarté comme table, repris comme modèle.** Raisons : clé étrangère obligatoire vers `Trainer` (`onDelete: Restrict`) ; c'est une **facture** (série, contestation 8 jours) alors que le relevé apporteur n'en est **pas** une (D8) ; l'étendre mélangerait deux régimes juridiques dans une table. Repris : période + statut + régime figé + lien direct vers le PDF + date de transmission.                                                                                                                                                                                                        |
| `DocumentGenere` (`documents_generes`, `schema.prisma:7599`)                                                                                                               | Registre des pièces Qualiopi : numéro unique, `hashSha256`, `suppressionPrevueAt = création + 5 ans`, enum `DocumentType`, rattachements formation / session / stagiaire / client / formateur.                                                                     | **Écarté pour le PDF du relevé**, choix justifié : (1) `suppressionPrevueAt` y vaut 5 ans, alors que le relevé suit les 10 ans des autofactures (§ 2.3) ; (2) aucune colonne de rattachement à un apporteur ; (3) un nouveau `DocumentType` = `ALTER TYPE … ADD VALUE`, non transactionnel, pour un document qui n'est pas Qualiopi ; (4) les PDF d'autofacture **apporteurs** ne l'utilisent déjà pas (`commissions.ts:919`, clé R2 `apporteurs/autofactures/<id>/<numero>.pdf`). On garde donc une clé R2 sur la ligne, **avec** l'empreinte SHA-256 du PDF (ce que `documents_generes` apportait). |
| `AutofactureHonorairesPdf` et `genererPdfAutofacture` (`commissions.ts:833-930`)                                                                                           | PDF d'autofacture apporteur, rendu par le gabarit des formateurs ; `storeAndSignPdf` (`server/qualiopi/documents/render.ts:72`) écrit dans R2.                                                                                                                     | **Modèle** du PDF du relevé (même police, même stockage). Fichier séparé : le relevé n'est pas une facture, il ne doit pas en porter le gabarit.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `docs/tableaux-de-bord-apporteurs.md` § 2.7 (« cycle mensuel de versement »), § 4 et § 5                                                                                   | Spécification du 23/08 : le 1ᵉʳ, un relevé par apporteur, envoyé par e-mail et dans l'espace ; versement le 5 ; seuil minimal de versement ; historique téléchargeable ; bouton « générer les relevés du mois ».                                                   | **Repris** : un relevé par apporteur au début du mois, historique téléchargeable (lot 6), bouton console (lot 4a). **Abandonné** depuis la décision du 06/10 (facturation au fil de l'eau, `facturation.ts:1-17`) : versement groupé le 5 et seuil de 50 €. Le lot 3a ajoute en tête du § 2.7 un renvoi vers ce plan.                                                                                                                                                                                                                                                                                 |
| `features/apporteurs-reseau/facturation.ts`, job `reseau-facturation` (`queues.ts:263-270`)                                                                                | Autofacture au fil de l'eau, une par passe, avoirs de la même série, e-mail `apporteur-releve`.                                                                                                                                                                    | **Inchangés** (D8). Seuls l'en-tête de `facturation.ts` et le commentaire de `queues.ts:266` changent (lot 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `allouerNumerosAutofacture` + `verrouillerSerieAutofacture` (`commissions.ts:700-760`)                                                                                     | Numérotation `AXI-APP` : borne haute + 1, puis verrou consultatif de **transaction** et contrôle dans la transaction qui écrit.                                                                                                                                    | **Modèle** de la numérotation `REL-` (§ 6.1). La série `REL-` est **distincte** et n'entre pas au registre `numeros_emis` (ce n'est pas une pièce comptable).                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Gabarit `apporteur-releve` (`apporteur-demarrage.tsx:347-366`, `958-1000`)                                                                                                 | Malgré son nom, c'est l'e-mail d'**autofacture**.                                                                                                                                                                                                                  | Gardé sous ce nom (contrat app ↔ worker). Nouveau gabarit **distinct** `apporteur-releve-mensuel` (lot 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `CommissionApporteur.releveMois`                                                                                                                                           | Reliquat de l'ancien relevé ; marqueur « reprise imputée » dans les écritures (`facturation.ts:449-457`).                                                                                                                                                          | **Ne pas réutiliser.** Lu seulement en contrôle de cohérence (§ 5.2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `moisParis` (`commissions.ts:667`), `autofacture-donnees.ts` (`totalTtcPieceCents`, `aVirerPartielCents`, `echeancePaiement`, `objectifVirement`, `dateFr`, `libelleMois`) | Calculs et formats déjà testés.                                                                                                                                                                                                                                    | **Réutilisés.** Le calcul des jours ouvrés d'`objectifVirement` (l. 451) est extrait en helper partagé (lot 3b).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `paiementsIntegrauxParFacture` (`paiement-integral.ts`), `etat-commission.ts`                                                                                              | Date d'encaissement intégral ; libellé d'état.                                                                                                                                                                                                                     | **Réutilisés.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `espace-commissions-assemblage.ts` (`emission()`, l. 116 ; parrainage, l. 272)                                                                                             | Assemblage pur de « Mes commissions ».                                                                                                                                                                                                                             | **Réutilisé** (repli de date d'émission, regroupement du parrainage sans nom de filleul).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `envois.ts` (`envoyer`, `dejaEnvoye`, `jobIdSansDeuxPoints`, listes de gabarits), `retrait.ts` (`GABARITS_ARGENT`, `argentEnJeu`)                                          | Envoi idempotent, filtre des retirés.                                                                                                                                                                                                                              | **Réutilisés ; listes étendues** (lot 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `settings` + modèle `formateurs-independants/interrupteurs.ts`                                                                                                             | Interrupteurs console, « absent ou illisible = position sûre ».                                                                                                                                                                                                    | **Réutilisés** pour le futur mode automatique (lot 5, non lançable).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `apporteur-crons-worker.ts` (l. 41-80) et file `apporteur-crons`                                                                                                           | Programme du réseau. ⚠️ Un nom de job inconnu retombe sur `passerRelancesInvitation` (rappels arrêtés le 26/10).                                                                                                                                                   | **Corrigé d'abord** (lot 0), puis **étendu** (lot 4c).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `retention-purge-worker.ts`                                                                                                                                                | Purge RGPD ; « aucun effacement automatique de données de personnes » sauf exceptions déclarées (l. 7-11, 318).                                                                                                                                                    | **Inchangé** : le relevé suit la conservation des autofactures (§ 2.3). Le lot 3a ajoute la table au registre des traitements.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Console `/apporteurs/commissions`, fiche `/apporteurs/[id]`, espace `mes-commissions` et `factures/[numero]/route.ts`                                                      | Écrans existants.                                                                                                                                                                                                                                                  | Commissions : **inchangée**. Fiche : **nouveau bloc** (lot 4b). Espace : **nouvelle section et route copiée** (lot 6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Aperçu des e-mails (`catalogue.ts`, `payloads-exemple.ts`), `outbox-policy.ts`                                                                                             | Catalogue et politique d'envoi.                                                                                                                                                                                                                                    | **Étendus** (lot 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| PR #2116 (brouillon), #2387, #2400, #2259, #2261, ADR 0051                                                                                                                 | Phrase « deux jours ouvrés » ; avoir client ; textes 2.8 ; plans de l'espace ; frontière console / Partners.                                                                                                                                                       | #2116 = lot 1 (à finaliser, pas à refaire). #2387 et #2400 : le gabarit du relevé est dans un **fichier neuf** (lot 2), donc plus de conflit sur `apporteur-demarrage.tsx`. #2259/#2261 : à lire avant le lot 6. ADR 0051 : rappelée dans l'ADR du relevé.                                                                                                                                                                                                                                                                                                                                            |
| Relevé mensuel apporteur, écran de vérification, statistiques, passage mensuel                                                                                             | —                                                                                                                                                                                                                                                                  | **À créer** : aucun équivalent côté apporteurs (le seul relevé mensuel existant est celui des formateurs, écarté ci-dessus).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

---

## 2. Conformité légale (France)

1. **Facturation inchangée : autofacturation sous mandat** (CGI art. 289, I-2 ; annexe II art. 242 nonies A ;
   contrat 5.2 et annexe 2). Le relevé **n'est PAS une facture** : ni numéro `AXI-APP`, ni le mot « facture »
   dans son titre, ni échéance propre. En tête et en pied : « Document d'information, qui n'est pas une facture.
   Seules les autofactures et les avoirs joints à vos e-mails précédents font foi (contrat, article 5.1 et
   annexe 2). » Il **renvoie** au numéro de chaque autofacture et de chaque avoir.
2. **TVA** : HT, TVA, TTC **lus sur `PieceAutofactureApporteur`**, jamais recalculés au régime actuel. Pour une
   pièce en franchise, la mention « TVA non applicable, article 293 B du CGI » est reprise de la pièce.
3. **Conservation, bornée** : le relevé **suit la conservation des autofactures**, soit **10 ans à compter de la
   clôture de l'exercice** de sa période (code de commerce, art. L.123-22 ; contrat, art. 9), puis suppression
   ou anonymisation par la procédure manuelle déjà prévue pour les pièces comptables (le worker de purge ne
   l'efface pas automatiquement, comme les autofactures). Durée inscrite au **registre des traitements** (RGPD,
   art. 5.1.e et 30) par le lot 3a. Clé étrangère `onDelete: Restrict`.
4. **Jamais modifié après l'envoi, garanti EN BASE** : un **trigger SQL** (`releves_mensuels_apporteur_garde_update`)
   refuse toute modification de `numero`, `apporteur_id`, `periode`, `rang`, `coupure_at`, `contenu`,
   `empreinte_sha256`, `pdf_r2_key`, `pdf_sha256` dès que l'ancien `statut` n'est plus `prepare`, et refuse
   tout retour d'`envoye` vers un autre statut. Un second trigger (`…_refuse_delete`) refuse la suppression
   d'une ligne qui n'est pas `prepare`. Modèle : `20261126150000_apporteur_changement_iban`. La garde
   applicative (`updateMany … where statut = prepare`) reste en premier rideau. La clé R2 du PDF contient le
   numéro du relevé et n'est jamais réécrite après l'envoi. Une erreur se corrige par un **relevé
   rectificatif** (`-R1`, `-R2`…, lien vers l'original, mention « Rectifie le relevé n° … du … »).
5. **RGPD (art. 5.1.c, minimisation)** : `contenu` ne stocke que la dénomination de l'entreprise présentée, le
   numéro et la date de la facture client, la prestation, les montants, statuts et numéros de pièces. Aucun nom
   de contact, e-mail ou téléphone de l'entreprise cliente. Les coordonnées de l'apporteur (`decryptPii`)
   n'apparaissent **que dans le PDF**. Le PDF est stocké dans R2 **sans chiffrement applicatif**
   (`storeAndSignPdf` → `uploadToR2`), avec le seul chiffrement par défaut du fournisseur, **comme les PDF
   d'autofacture** ; l'accès passe uniquement par une route contrôlée (jeton + `apporteurId`) ou par la
   console. Aucun lien public.
6. **Réclamations** : contact (adresse de réponse de l'e-mail) et **rappel** des délais du contrat (Q5) ; aucun
   délai nouveau.
7. **Requalification (salariat)** : ni « rémunération mensuelle », ni « salaire », ni « objectif », ni
   « challenge ». Un récapitulatif de commissions sur des affaires précises.

---

## 3. Occurrences de texte à modifier

| #   | Fichier:ligne                                                              | Action                                                                                                                                              | Lot |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1   | `src/lib/email/templates/apporteur-demarrage.tsx:351`                      | Supprimer « Nous nous efforçons de vous verser cette commission sous deux jours ouvrés » (**PR #2116**, à rebaser).                                 | 1   |
| 2   | `src/lib/email/templates/__tests__/cliquets/g7.ts`                         | Retirer `apporteur-releve` de la dette `delaiEnDur` (#2116).                                                                                        | 1   |
| 3   | `src/server/queue/queues.ts:266`                                           | Commentaire : « … autofacture dans l'heure (contrat 5.1) ; récapitulatif mensuel : voir `releve-mensuel/` ».                                        | 1   |
| 4   | `src/features/apporteurs-reseau/facturation.ts:1-17`                       | En-tête : « Autofacture au fil de l'eau (contrat 5.1) ; le relevé MENSUEL d'information est dans `releve-mensuel/` (décision du 27/11) ».           | 1   |
| 5   | `src/app/apporteur/dossier/[id]/[jeton]/mes-commissions/textes.ts:21`      | Ajouter : « Au début de chaque mois, vous recevez aussi un relevé récapitulatif du mois précédent. » Seulement **après** un premier mois envoyé.    | 6   |
| 6   | `docs/tableaux-de-bord-apporteurs.md` § 2.7                                | Bandeau : « Remplacé par la facturation au fil de l'eau (06/10) et par le relevé d'information de `docs/plans/PLAN-RELEVE-MENSUEL-APPORTEURS.md`. » | 3a  |
| 7   | Contrat, fiche des commissions (annexe 1 bis), livret                      | **Ne pas toucher** (art. 13.1 ; fichiers interdits).                                                                                                | —   |
| 8   | `autofacture-donnees.ts:403, 451`, `apporteurs/commissions/page.tsx:81-98` | **Gardés** tant que le contrat prévoit le délai indicatif (Q2).                                                                                     | —   |

Interdits de rédaction pour tous les textes : jamais le nom de la ville du siège dans un texte apporteur, jamais
la formule de non-garantie de gains bannie, aucun montant en euros codé en dur dans un gabarit.

---

## 4. Schéma de données (lot 3a) : migration ADDITIVE

Migration `prisma/migrations/2026MMDDHHMMSS_apporteur_releve_mensuel/` : `CREATE TYPE`, `CREATE TABLE`, deux
colonnes **nullables** ajoutées à `commissions_apporteur`, index et triggers. Aucune colonne existante modifiée
ni supprimée, aucun `UPDATE`, aucun remplissage rétroactif.

```prisma
enum StatutReleveMensuel {
  prepare          // calculé, vérifiable, recalculable (seul statut modifiable en contenu)
  envoi_en_cours   // pris par un lot (prisAt) ; repris après 10 min (§ 6.4)
  envoye           // e-mail enfilé ; l'état de remise se lit dans EmailLog
  echec            // l'enfilage a échoué : renvoyable par un clic
  ecarte           // écarté par un administrateur pour cette période (motif obligatoire)
  @@map("statut_releve_mensuel")
}

model ReleveMensuelApporteur {
  id              String               @id @default(uuid()) @db.Uuid
  numero          String               @unique @db.VarChar(40)   // REL-AAAA-MM-NNNN[-Rk], série distincte d'AXI-APP
  apporteurId     String               @map("apporteur_id") @db.Uuid
  apporteur       ApporteurReseau      @relation(fields: [apporteurId], references: [id], onDelete: Restrict)
  periode         String               @db.Char(7)               // AAAA-MM (mois de Paris)
  rang            Int                  @default(0)               // 0 = origine ; k = k-ième rectificatif
  rectifieId      String?              @map("rectifie_id") @db.Uuid
  statut          StatutReleveMensuel  @default(prepare)
  formatVersion   Int                  @default(1) @map("format_version")
  coupureAt       DateTime             @map("coupure_at") @db.Timestamptz(3)   // 1er M+1 00:00 Paris (§ 5.2)
  contenu         Json                                            // instantané figé, sans PII de l'apporteur
  empreinteSha256 String               @map("empreinte_sha256") @db.Char(64)   // sha256(JSON canonique(contenu))
  pdfR2Key        String?              @map("pdf_r2_key") @db.VarChar(300)     // apporteurs/releves/<apporteurId>/<numero>-<empreinte8>.pdf
  pdfSha256       String?              @map("pdf_sha256") @db.Char(64)
  // Totaux dénormalisés pour les statistiques (centimes ; jamais relus pour réémettre)
  nbLignes          Int @default(0) @map("nb_lignes")
  facturesHtCents   Int @default(0) @map("factures_ht_cents")
  avoirsHtCents     Int @default(0) @map("avoirs_ht_cents")
  viresTtcCents     Int @default(0) @map("vires_ttc_cents")
  enAttenteHtCents  Int @default(0) @map("en_attente_ht_cents")
  cumulAnneeHtCents Int @default(0) @map("cumul_annee_ht_cents")
  emailJobId      String?              @unique @map("email_job_id") @db.VarChar(120)
  prepareAt       DateTime             @default(now()) @map("prepare_at") @db.Timestamptz(3)
  prisAt          DateTime?            @map("pris_at") @db.Timestamptz(3)
  envoyeAt        DateTime?            @map("envoye_at") @db.Timestamptz(3)
  envoyePar       String?              @map("envoye_par") @db.VarChar(60)  // "console:<adminId>" (jamais "automatique" avant le lot 5)
  lotId           String?              @map("lot_id") @db.Uuid
  motifEcart      String?              @map("motif_ecart") @db.VarChar(300)
  erreur          String?              @db.VarChar(300)
  creeAt          DateTime             @default(now()) @map("cree_at") @db.Timestamptz(3)
  majAt           DateTime             @updatedAt @map("maj_at") @db.Timestamptz(3)

  @@unique([apporteurId, periode, rang])
  @@index([periode, statut])
  @@index([apporteurId])
  @@map("releves_mensuels_apporteur")
}

model LotReleveMensuel {
  id            String    @id @default(uuid()) @db.Uuid
  periode       String    @db.Char(7)
  declenchePar  String    @map("declenche_par") @db.VarChar(60)
  debutAt       DateTime  @default(now()) @map("debut_at") @db.Timestamptz(3)
  finAt         DateTime? @map("fin_at") @db.Timestamptz(3)
  abandonneAt   DateTime? @map("abandonne_at") @db.Timestamptz(3)   // lot mort repris (§ 6.3)
  nbCibles      Int       @default(0) @map("nb_cibles")
  nbEnvoyes     Int       @default(0) @map("nb_envoyes")
  nbDejaEnvoyes Int       @default(0) @map("nb_deja_envoyes")
  nbEchecs      Int       @default(0) @map("nb_echecs")
  nbBloques     Int       @default(0) @map("nb_bloques")
  @@index([periode])
  @@map("lots_releve_mensuel")
}
```

SQL brut ajouté à la même migration :

- `CREATE UNIQUE INDEX "lots_releve_mensuel_un_en_cours" ON "lots_releve_mensuel" ("periode") WHERE "fin_at"
IS NULL AND "abandonne_at" IS NULL;` : **un seul lot vivant par période**, garanti en base (§ 6.3).
- Triggers `releves_mensuels_apporteur_garde_update` et `releves_mensuels_apporteur_refuse_delete` (§ 2.4).

Ajouts à `CommissionApporteur` (**nullables**, posés au calcul par le lot R, jamais rétroactivement) :

```prisma
  regleAppliquee  String? @map("regle_appliquee") @db.VarChar(40)  // code fermé, § 5.3
  versionContrat  String? @map("version_contrat") @db.VarChar(10)  // version signée par l'apporteur au calcul ("2.6", "2.8"…)
```

- Relation inverse `relevesMensuels ReleveMensuelApporteur[]` sur `ApporteurReseau`.
- **Contrat `stub.invalid`** : aucune page SSG ne lit ces tables ; pages de la console dynamiques.
- **Fenêtre app/worker** : colonnes nouvelles nullables ou avec défaut ; le code du worker tolère la table
  absente (P2021).

---

## 5. Calcul du relevé

### 5.1 Période

Mois civil **de Paris** : `[1er M 00:00 Europe/Paris ; 1er M+1 00:00 Europe/Paris[`, comparé par
`moisParis(date) === periode`. **Une période ne se prépare qu'une fois close** : refus serveur si
`periode >= moisParis(now)`.

### 5.2 Coupure fixe : le relevé est reproductible

Chaque relevé est **arrêté à `coupureAt` = 1er M+1 00:00 Paris**, à partir des **dates d'événement** seulement.
Un événement postérieur à la coupure (un « Virement fait » le 2, une vigilance levée le 3) **ne change pas** le
relevé de M : il apparaîtra dans celui de M+1. Ainsi, recalculer le relevé au moment de l'envoi rend la même
empreinte, et l'envoi groupé (D2) n'est plus bloqué apporteur par apporteur.

| Section                                   | Règle exacte, bornée par la coupure                                                                                                                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Commissions facturées dans le mois** | `autofactureNumero ≠ null`, `avoirNumero = null`, `statut ≠ annulee`, `moisParis(autofactureEmiseAt ?? majAt) = periode` (repli `emission()` de `espace-commissions-assemblage.ts:116`).                                                                                                     |
| **B. Avoirs émis dans le mois**           | `avoirNumero ≠ null`, `moisParis(PieceAutofactureApporteur[avoirNumero].emiseAt) = periode`.                                                                                                                                                                                                 |
| **C. Virements du mois**                  | `verseeAt ∈ période`, regroupés par `autofactureNumero` ; montant = TTC de l'autofacture moins TTC des avoirs imputés (`aVirerPartielCents`). Net nul : « réglé par compensation (art. 12.4) ».                                                                                              |
| **D1. Facturé, non viré à la coupure**    | `autofactureEmiseAt < coupure` et (`verseeAt = null` ou `verseeAt ≥ coupure`), avec l'échéance `echeancePaiement`.                                                                                                                                                                           |
| **D2. En attente d'autofacture**          | `autofactureAttenteDepuis < coupure` et (`autofactureEmiseAt = null` ou `≥ coupure`), avec `autofactureAttenteMotif`.                                                                                                                                                                        |
| **D3. Autres attentes (indicatif)**       | `a_qualifier`, `en_attente_vigilance`, `litigeDepuis ≠ null` pour les lignes créées avant la coupure. Ces statuts **n'ont pas de date de sortie** : D3 est donc **figée à la préparation**, libellée « à titre indicatif, au JJ/MM/AAAA », et **exclue de l'empreinte de contrôle** (§ 6.2). |
| **E. Cumul de l'année**                   | Somme HT de A moins somme HT de B sur `[1er janvier ; coupure[`, plus le TTC viré (C) sur la même plage (Q6). Calcul direct, jamais à partir des relevés précédents.                                                                                                                         |

- Une commission figure **une seule fois** en A (la date d'émission est unique et immuable). Encaissée en M et
  facturée en M+1, elle apparaît en D2 de M puis en A de M+1.
- Parrainage : en A, sous « Parrainage (art. 4.6) », sans nom de filleul.
- **Contrôle de cohérence** (non bloquant) : pour toute ligne de A, `releveMois === moisParis(autofactureEmiseAt)` ;
  écart signalé par `signalerErreurReseau`.

### 5.3 Contenu figé (`formatVersion = 1`) : la règle est LUE, jamais recalculée

Une ligne par commission (A et B) : date d'émission ; entreprise (dénomination) ; prestation (libellé du
`palier`) ; facture client (numéro, date) et date d'encaissement intégral (`paiementsIntegrauxParFacture`) ;
base (`factureHtCents`, `prixPublicHtCents`) ; **règle appliquée et version du contrat** ; HT, TVA, TTC (pièce
figée) et mention 293 B ; statut (facturée avec échéance, versée avec date et référence = numéro d'autofacture,
jamais l'IBAN ; reprise ou avoir) ; numéros de pièce.

**Règle appliquée : liste FERMÉE des codes affichables** (`regleAppliquee`, posé au calcul par le lot R) :

| Code                            | Libellé affiché                                              | Source au calcul                                            |
| ------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `forfait_palier`                | « Forfait du palier <libellé> »                              | `calculerCommission`, formation au prix public              |
| `prorata_remise`                | « Forfait au prorata du prix facturé (art. 4.1 bis) »        | formation, HT facturé < prix public                         |
| `forfait_sessions`              | « Forfait × N sessions »                                     | `quantite > 1`                                              |
| `taux_ht`                       | « N % du HT facturé »                                        | audit, intégration, développement web                       |
| `plafond_base`                  | « Base plafonnée au total HT hors récurrent »                | `plafondBaseCommissionnableCents` a réduit la base          |
| `parrainage_10`                 | « Parrainage : 10 % de la commission du filleul (art. 4.6) » | ligne `parrainage = true`                                   |
| `tarif_avant_date_effet`        | « Tarif du contrat en vigueur à la commande »                | conférence signée avant `CONFERENCE_SANS_COMMISSION_DEPUIS` |
| `journee_ia`                    | « Forfait Journée IA »                                       | `calculerCommissionJourneeIa`                               |
| _(réservé)_ `formation_3j_plus` | **non affiché** tant que Q7 n'est pas tranchée               | —                                                           |

- Une commission **antérieure** au lot R (`regleAppliquee = null`) affiche « Règle : voir le décompte de
  l'autofacture n° … ». Le relevé **ne recalcule jamais** une règle : une grille changée depuis (contrat 2.8,
  plafond du 26/11) ne peut pas contredire le montant de la pièce figée.
- `versionContrat` affiché « Contrat v X.Y » ; `null` → rien n'est affiché.

Puis : sous-totaux par statut ; total du mois (facturé HT, avoirs HT, net HT, TVA, TTC, viré) ; report (D1, D2,
D3) ; cumul (E) ; en-tête (numéro, période, date de coupure, les deux parties depuis la constante légale
existante, contact et rappel des délais, mention « n'est pas une facture »).

**Empreintes** : `empreinteSha256 = sha256(JSON canonique(contenu))` (clés triées, centimes entiers, dates
ISO) ; `pdfSha256 = sha256(octets du PDF)`. Helper canonique **pur et testé**.

### 5.4 Où vit le code

`src/features/apporteurs-reseau/releve-mensuel/`, **sans `server-only`** (le worker l'atteint par `tsx`) :
`types.ts`, `periode.ts`, `calcul.ts`, `empreinte.ts` (purs) ; `lecture.ts`, `numerotation.ts`,
`preparation.ts`, `envoi.ts`, `reprise.ts`, `statistiques.ts` (Prisma) ; `pdf.tsx` (rendu) ; `interrupteurs.ts`
(lot 5).

---

## 6. Idempotence : jamais deux fois, jamais perdu en silence

### 6.1 Préparation et numérotation

- La préparation crée **une ligne par apporteur cible, chacune dans sa propre transaction courte** :
  `SELECT pg_advisory_xact_lock(hashtext('serie-releve-apporteur'))`, lecture de la borne haute des numéros
  `REL-AAAA-MM-` (jamais un comptage), `INSERT`. Modèle : `verrouillerSerieAutofacture`. **Plus de
  `createMany({ skipDuplicates })`**, qui avalait aussi une collision sur `numero`.
- Erreur P2002 sur `(apporteur_id, periode, rang)` = déjà préparé : normal, compté « déjà préparé ». P2002 sur
  `numero` = **anomalie** (impossible sous verrou) : remontée, jamais ignorée.
- **Contrôle de complétude** après chaque passe : `count(rang = 0, periode)` comparé au nombre de cibles (Q4,
  moins les écartés). Tout écart = **anomalie bloquante** affichée en tête de l'écran ; le bouton d'envoi est
  désactivé tant qu'elle existe.
- Le **PDF est rendu et stocké à la préparation** (et à chaque recalcul tant que `prepare`), clé
  `apporteurs/releves/<apporteurId>/<numero>-<empreinte8>.pdf`. L'écran de vérification montre ce PDF-là ;
  l'envoi ne rend rien.
- Préparation **par tranches de 25 apporteurs**, reprenable : chaque appel traite les cibles sans ligne, puis
  rend « reste N ». Le passage quotidien du worker (lot 4c) enchaîne toutes les tranches.

### 6.2 Recalcul et contrôle avant envoi

- Recalcul autorisé seulement si `statut = prepare` (garde applicative + trigger).
- Juste avant d'enfiler, le lot recalcule A, B, C, D1, D2 et E (bornés par la coupure) et compare leur empreinte
  à celle stockée (D3 exclue). Un écart ne peut venir que d'une **modification d'un événement antérieur à la
  coupure** (correction d'une date, d'un montant) : la ligne repasse en `prepare` avec
  `erreur = "données du mois modifiées depuis la vérification"`, comptée en `nbBloques`, et rien ne part pour
  elle. Les autres apporteurs partent.

### 6.3 Un seul lot par période

- Démarrer un lot = `INSERT` dans `lots_releve_mensuel`. L'index unique partiel (§ 4) refuse un second lot
  vivant : « un envoi est déjà en cours pour cette période ». Pas de verrou de transaction longue, pas de
  verrou consultatif de session.
- Le lot écrit `finAt` dans un `finally`. Un lot sans `finAt` depuis plus de 15 minutes est **mort** (processus
  tué) : le lot suivant le marque `abandonneAt` avant de s'insérer, après la reprise du § 6.4.
- Le lot ne fait **qu'enfiler** des e-mails (le PDF existe déjà) : N appels `envoyer()`, par tranches de 50 avec
  reprise ; tous partent dans la même minute (D2).

### 6.4 Prise et reprise de `envoi_en_cours`

- Prise : `updateMany where { id, statut in [prepare, echec] } → envoi_en_cours, prisAt = now()`. `count ≠ 1` :
  déjà pris, ligne suivante.
- **Reprise** (au début de chaque lot et de chaque passage du worker) : toute ligne `envoi_en_cours` avec
  `prisAt` de plus de 10 minutes est examinée. Si `dejaEnvoye(jobId)` (EmailLog) ou si la file d'e-mails
  contient le job `jobId` → `envoye` (avec `envoyeAt = prisAt`) ; sinon → `echec`, `erreur = "envoi interrompu"`.
  Elle redevient alors renvoyable par un clic.

### 6.5 E-mail, statut, rectificatif

- `jobId = apporteur-releve-mensuel-<AAAA-MM>-r<rang>-<apporteurId>` (`jobIdSansDeuxPoints`) ; `dejaEnvoye(jobId)`
  vérifié avant `envoyer()` ; BullMQ refuse un `jobId` déjà présent.
- Après l'enfilage : `envoye`, `envoyeAt`, `envoyePar`, `emailJobId`. Échec d'enfilage : `echec` + message. État
  réel de remise : `EmailLog` par `jobId`. « Renvoyer » seulement si `EmailLog = failed` et `dejaEnvoye = false`.
- Rectificatif : action **individuelle** (un clic) ; crée `rang = max + 1`, numéro `-Rk`, `rectifieId`, nouveau
  `jobId`. Le bouton global ne vise que `rang = 0`.

---

## 7. Passage quotidien du worker (lot 4c) : il PRÉPARE, il n'envoie JAMAIS

- Type `releve-mensuel` ajouté à `ApporteurCronJobType` (`server/queue/types.ts:296`) et à `bootRepeatableJobs`
  (`queues.ts:1697+`), file `apporteur-crons`, `repeat: { pattern: "30 9 * * *", tz: "Europe/Paris" }`.
- À partir du 1ᵉʳ jour ouvré de M+1 : reprise des `envoi_en_cours` (§ 6.4), puis préparation des relevés de
  M-1 manquants (toutes les tranches), puis **une** alerte interne au dirigeant « Relevés de <mois> prêts à
  vérifier » (`alerteInterne`, clé `releve-mensuel-pret-<AAAA-MM>`). **Aucun e-mail à un apporteur** (D7). Un
  passage quotidien donne le rattrapage si le worker était arrêté.
- Tolère la table absente (P2021) : journal « table absente, passage sauté ».

**Deux conteneurs** (AGENTS.md, « DEUX conteneurs » et « D8b ») : règle symétrique.

1. **Lot 0 en ligne avant le lot 4c** : un ancien worker qui recevrait `releve-mensuel` lancerait aujourd'hui les
   rappels d'invitation arrêtés le 26/10.
2. La console **n'enfile jamais** de job sur `apporteur-crons` ; elle n'enfile que des e-mails.
3. Gabarit `apporteur-releve-mensuel` sans `gabaritRepli` possible (`apporteur-releve` dirait « votre commission
   est facturée ») : le lot 2 est **en ligne au moins un créneau avant** le lot 4a. La PR 4a le prouve par
   `grep -rl "apporteur-releve-mensuel" /app/src` dans le conteneur worker.
4. La migration (lot 3a) est en ligne au moins un créneau avant tout lot qui écrit dans ses tables ;
   `prisma migrate status` après l'atterrissage.

---

## 8. Écrans de la console

Pages dynamiques, composants serveur, charte de la console, aucune bibliothèque cliente nouvelle (bucket admin,
ADR 0049 et 0077).

1. **`/[adminPrefix]/apporteurs/releves`** (lot 3e) : cartes (apporteurs signés, avec mouvement, facturé HT du
   mois, viré, en attente, cumul de l'année), **évolution sur 12 mois** (colonnes dénormalisées pour les mois
   préparés, calcul direct sinon ; barre CSS), liste des périodes (préparés, envoyés, échecs, écartés).
2. **`/[adminPrefix]/apporteurs/releves/[periode]`** : vérification avant envoi.
   - Lecture (lot 3e) : tableau par apporteur (commissions, HT/TVA/TTC, avoirs, viré, en attente, statut,
     empreinte courte), lien « Aperçu » vers **le PDF stocké** et l'e-mail rendu depuis le contenu figé ;
     bandeau d'anomalies bloquantes (complétude § 6.1, e-mail absent, données modifiées § 6.2).
   - Actions (lot 3c) : « Préparer les relevés de <mois> » (par tranches, « reste N »), « Recalculer »,
     « Écarter cet apporteur » (motif obligatoire).
   - Actions (lot 4a) : **« Envoyer les relevés à tout le monde »**, confirmation par saisie de `AAAA-MM`, garde
     `peutEngager(role, "facturer")` ; « Déjà envoyés : N ; à envoyer : M » ; après un envoi complet, bouton
     désactivé « Tous les relevés de <mois> sont partis le … » ; « Renvoyer les échecs » ; résultat du lot.
3. **Mode automatique** (lot 5, **non lançable**, cf. § 11).
4. **Fiche apporteur** (lot 4b) : bloc `RelevesMensuels.tsx` (période, numéro, date d'envoi, statut d'envoi lu
   dans `EmailLog`, empreinte, PDF par lien protégé, rectificatifs) ; bouton « Établir un relevé rectificatif ».
5. **Espace apporteur** (lot 6) : section « Mes relevés » et route `releves/[numero]/route.ts` copiée de
   `factures/[numero]/route.ts`.

---

## 9. E-mail `apporteur-releve-mensuel` (lot 2)

- **Fichier neuf** `src/lib/email/templates/apporteur-releve-mensuel.tsx` (et non `apporteur-demarrage.tsx`,
  pour ne pas entrer en conflit avec #2116, #2387, #2400), kit `_kit-apporteur.tsx`, famille « B »,
  `signature="fondateur-court"`.
- Objet : « Votre relevé de commissions de <mois> » ; variante « Votre relevé de <mois> : aucun mouvement ».
- Corps : total du mois (payload), nombre de commissions, report, phrase « Ce relevé est un récapitulatif, qui
  n'est pas une facture : vos autofactures restent les pièces qui font foi. », rappel des délais (Q5).
- Pièce jointe : `attachments` avec la `r2Key` **portée par le payload** (= `pdfR2Key` de la ligne, § 1.1).
- Enregistrement : `server/queue/types.ts` (`EmailJobName`), `lib/email/templates/index.tsx`,
  `server/email/outbox-policy.ts`, `server/email/apercu/catalogue.ts` + `payloads-exemple.ts` (exemple fictif),
  `envois.ts` (trois listes où figure `apporteur-releve`, l. 50, 78, 131), `retrait.ts` (`GABARITS_ARGENT`).
- Cliquets `g1` à `g9` verts sans dette ajoutée ; `chaque-e-mail-ouvre-l-espace.spec.ts` couvre le gabarit.

---

## 10. Tests (rouges d'abord, dans le lot qui les possède)

| Fichier                                                              | Verrouille                                                                                                                                                                                                                                                                  | Lot  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `server/queue/workers/__tests__/apporteur-crons-nom-inconnu.spec.ts` | Un nom inconnu n'exécute **pas** `passerRelancesInvitation` ; `relance-invitation` exact l'exécute.                                                                                                                                                                         | 0    |
| `lib/email/templates/__tests__/apporteur-releve-mensuel.spec.tsx`    | Rendu, variante sans mouvement, « n'est pas une facture », aucun délai ni montant en dur, lien vers l'espace, pièce jointe = `r2Key` du payload.                                                                                                                            | 2    |
| `releve-mensuel/__tests__/migration-additive.spec.ts`                | Lecture statique du SQL : que des `CREATE`/`ADD COLUMN` nullables, aucun `UPDATE`/`DELETE`, index unique partiel présent (modèle : `le-changement-d-iban-n-ajoute-rien-aux-tables-existantes.spec.ts`).                                                                     | 3a   |
| `releve-mensuel/__tests__/trigger-figement.spec.ts`                  | Le corps du trigger couvre **chacune** des colonnes figées et le retour depuis `envoye` ; le trigger de suppression existe.                                                                                                                                                 | 3a   |
| `__tests__/periode.spec.ts`                                          | Bornes de Paris aux changements d'heure ; période non close refusée ; Nᵉ jour ouvré avec fériés.                                                                                                                                                                            | 3b   |
| `__tests__/calcul.spec.ts`                                           | A à E ; 23 h 30 le dernier jour ; jamais deux fois en A ; **un virement daté après la coupure ne change pas le relevé** ; D3 hors empreinte ; règle LUE (`regleAppliquee = null` → renvoi au décompte) ; `formation_3j_plus` jamais affiché ; TVA lue sur la pièce ; 293 B. | 3b   |
| `__tests__/empreinte.spec.ts`                                        | JSON canonique stable ; empreinte change au moindre centime.                                                                                                                                                                                                                | 3b   |
| `__tests__/rgpd-contenu.spec.ts`                                     | `contenu` sans `email`, `telephone`, `iban`, `prenom`, `nom` de contact.                                                                                                                                                                                                    | 3b   |
| `__tests__/n-est-pas-une-facture.spec.tsx`                           | PDF : « n'est pas une facture », jamais `AXI-APP-` comme numéro du relevé ni « Autofacturation » en titre.                                                                                                                                                                  | 3d   |
| `__tests__/numerotation-concurrence.spec.ts`                         | Deux préparations concurrentes : numéros distincts, verrou pris dans chaque transaction ; P2002 sur `numero` remonté, jamais avalé.                                                                                                                                         | 3c   |
| `__tests__/preparation-complete.spec.ts`                             | Deux préparations = un relevé ; tranches reprenables ; **une cible sans relevé = anomalie bloquante** ; PDF stocké à la préparation avec `pdfSha256`.                                                                                                                       | 3c   |
| `__tests__/regle-figee-au-calcul.spec.ts`                            | La création d'une commission pose `regleAppliquee` (code de la liste fermée) et `versionContrat` (lu sur `signatureApporteur.version`, `null` si absent).                                                                                                                   | R    |
| `__tests__/idempotence-envoi.spec.ts`                                | Un seul lot vivant par période ; un enfilage par apporteur malgré deux clics ; `envoye` jamais repris ; « Renvoyer » refusé si `dejaEnvoye`.                                                                                                                                | 4a   |
| `__tests__/reprise-envoi-en-cours.spec.ts`                           | `envoi_en_cours` de plus de 10 min : job présent → `envoye` ; absent → `echec` ; lot mort → `abandonneAt`.                                                                                                                                                                  | 4a   |
| `__tests__/rectificatif.spec.ts`                                     | `rang = 1`, numéro `-R1`, original intact ; bouton global ignore `rang > 0`.                                                                                                                                                                                                | 4b   |
| `__tests__/job-releve-mensuel.spec.ts`                               | Le passage prépare et alerte, **n'enfile aucun e-mail d'apporteur** ; rattrapage le lendemain ; une seule alerte ; P2021 : passage sauté.                                                                                                                                   | 4c   |
| Route `releves/[numero]/route.spec.ts`                               | Jeton d'un autre apporteur, numéro mal formé, interrupteur éteint : 404.                                                                                                                                                                                                    | 6    |
| `__tests__/grille-suit-la-version-signee.spec.ts`                    | Apporteur signé 2.6 sans avenant : sa grille s'applique après le 26/11 (rouge aujourd'hui, Q8).                                                                                                                                                                             | G2   |
| `parite-contrat-code.spec.ts` (existant)                             | **Vert sans modification** dans tous les lots.                                                                                                                                                                                                                              | tous |

---

## 11. Lots Sonnet

Règles communes : PR **en brouillon** jusqu'à la fin du lot (AGENTS.md, CI-LOT1) ; tests rouges écrits et
poussés **avant** le code ; un lot ne touche **que** ses fichiers possédés (un fichier hors liste = arrêter et
demander) ; fichiers interdits du préambule ; dépôt public. Modèle : **Sonnet** sauf mention.

### Vague 1 : en parallèle, aucune dépendance entre eux — PRÊTS

| Lot    | Objet                                                                                                                                                                                                                                                                                                                                            | Fichiers possédés                                                                                                                                                                                                                                                      | Tests rouges d'abord                                                                     | Migration | Dépend de |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------- | --------- |
| **0**  | Routage `apporteur-crons` : un nom inconnu est journalisé et ignoré.                                                                                                                                                                                                                                                                             | `src/server/queue/workers/apporteur-crons-worker.ts` ; son test                                                                                                                                                                                                        | `apporteur-crons-nom-inconnu.spec.ts`                                                    | non       | —         |
| **1**  | Finaliser **#2116** (sur sa branche) + commentaires § 3, l. 3 et 4.                                                                                                                                                                                                                                                                              | `apporteur-demarrage.tsx` (l. 351 seulement), `cliquets/g7.ts`, `queues.ts` (l. 266, commentaire seulement), `facturation.ts` (en-tête seulement)                                                                                                                      | test de rendu existant de `apporteur-releve` sans la phrase                              | non       | —         |
| **2**  | Gabarit `apporteur-releve-mensuel` et son enregistrement. **Aucun émetteur.**                                                                                                                                                                                                                                                                    | `templates/apporteur-releve-mensuel.tsx` (neuf), `templates/index.tsx`, `server/queue/types.ts` (`EmailJobName` seulement), `outbox-policy.ts`, `apercu/catalogue.ts`, `apercu/payloads-exemple.ts`, `envois.ts` (listes), `retrait.ts` (`GABARITS_ARGENT`) ; son test | `apporteur-releve-mensuel.spec.tsx`                                                      | non       | —         |
| **3a** | Migration additive (§ 4) + triggers + index partiel ; registre des traitements ; bandeau § 2.7 du document de 08/23 ; ADR « Relevé mensuel des apporteurs » (numéro libre suivant, ≥ 0078 ; rappel ADR 0051).                                                                                                                                    | `prisma/schema.prisma` (modèles neufs + 2 colonnes `CommissionApporteur` + relation inverse), `prisma/migrations/<horodatage>_apporteur_releve_mensuel/`, `docs/adr/00NN-releve-mensuel-apporteurs.md`, `docs/tableaux-de-bord-apporteurs.md`, registre RGPD           | `migration-additive.spec.ts`, `trigger-figement.spec.ts`                                 | **OUI**   | —         |
| **3b** | Modules purs : `types.ts` (type `ContenuReleveV1` exporté), `periode.ts`, `calcul.ts`, `empreinte.ts` ; extraction du helper jours ouvrés. Entrées = lignes simulées, **sans Prisma**.                                                                                                                                                           | `releve-mensuel/{types,periode,calcul,empreinte}.ts` (neufs), `autofacture-donnees.ts` (extraction du helper, sans changer de comportement) ; leurs tests                                                                                                              | `periode`, `calcul`, `empreinte`, `rgpd-contenu`                                         | non       | —         |
| **G1** | **Mesure, lecture seule** (Q8) : répartition des apporteurs signés par `signatureApporteur.version`, commissions créées depuis le 26/11 par version, et table des grilles 2.6 / 2.7 / 2.8 reconstituée depuis l'historique git de `contrat-v2.ts` **sans le modifier**. Rapport en commentaire de PR, sans données personnelles ni montant réel. | `scripts/apporteurs/mesure-versions-contrat.ts` (neuf, lecture seule), `docs/plans/MESURE-GRILLE-PAR-VERSION.md`                                                                                                                                                       | aucun (script en lecture seule ; un test vérifie qu'il n'appelle aucune écriture Prisma) | non       | —         |

### Vague 2 : en parallèle — PRÊTS dès que leurs dépendances sont FUSIONNÉES

| Lot     | Objet                                                                                                                                                                                      | Fichiers possédés                                                                                                                                                                                                                      | Tests rouges d'abord                                                                         | Migration            | Dépend de       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------- | --------------- |
| **3d**  | PDF A4 `@react-pdf/renderer` à partir de `ContenuReleveV1` ; fonction `rendreEtStockerPdfReleve(contenu, cle)` → `{ r2Key, sha256 }`.                                                      | `releve-mensuel/pdf.tsx` (neuf) ; son test                                                                                                                                                                                             | `n-est-pas-une-facture.spec.tsx`                                                             | non                  | 3b              |
| **R**   | Poser `regleAppliquee` et `versionContrat` à la **création** de chaque commission (aucun rétroactif). `calculerCommission` renvoie en plus un code de règle ; **aucun montant ne change**. | `regles.ts` (type de retour seulement), `passage-quotidien.ts` (blocs de `commissionApporteur.create`, l. 1300-1400), `avoir-client.ts`, `manquement.ts`, `resiliation.ts`, `facturation.ts:128` (champ ajouté aux `create` seulement) | `regle-figee-au-calcul.spec.ts` ; tous les tests de montant existants **inchangés et verts** | non (colonnes du 3a) | 3a **en ligne** |
| **3e**  | Écrans en **lecture** : page `releves` (statistiques, 12 mois) et page `releves/[periode]` (tableau, anomalies, aperçu). `statistiques.ts`.                                                | `app/[locale]/(admin)/[adminPrefix]/apporteurs/releves/**` (pages), `components/admin/apporteurs/releves/**`, `releve-mensuel/statistiques.ts` ; lien dans le menu des apporteurs                                                      | rendu des pages avec données simulées ; garde de rôle                                        | non                  | 3a, 3b          |
| **4b'** | Bloc `RelevesMensuels.tsx` de la fiche apporteur, **lecture seule** (statut lu dans `EmailLog`).                                                                                           | `components/admin/apporteurs/fiche/RelevesMensuels.tsx` (neuf), point d'insertion dans la page de la fiche                                                                                                                             | rendu : envoyé / en file / échoué ; empreinte courte                                         | non                  | 3a              |

### Vague 3 — PRÊTS dès que leurs dépendances sont fusionnées (et EN LIGNE quand indiqué)

| Lot    | Objet                                                                                                                                                                        | Fichiers possédés                                                                                                                                                                                                     | Tests rouges d'abord                               | Migration | Dépend de                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| **3c** | `lecture.ts`, `numerotation.ts`, `preparation.ts` (tranches, complétude, PDF à la préparation) ; actions « Préparer », « Recalculer », « Écarter » branchées sur l'écran 3e. | `releve-mensuel/{lecture,numerotation,preparation}.ts` (neufs), `releve-mensuel/actions-preparation.ts` (Server Actions), boutons dans `components/admin/apporteurs/releves/` (fichier neuf `ActionsPreparation.tsx`) | `numerotation-concurrence`, `preparation-complete` | non       | 3a **en ligne**, 3b, 3d, 3e                                        |
| **4a** | Envoi : `envoi.ts`, `reprise.ts`, lot unique par période, bouton « Envoyer les relevés à tout le monde », « Renvoyer les échecs ». **Seul émetteur du gabarit, sur clic.**   | `releve-mensuel/{envoi,reprise}.ts`, `releve-mensuel/actions-envoi.ts`, `components/admin/apporteurs/releves/BoutonEnvoyerATous.tsx` (neuf)                                                                           | `idempotence-envoi`, `reprise-envoi-en-cours`      | non       | 3c ; **2 en ligne** depuis un créneau (preuve worker dans la PR)   |
| **4c** | Passage quotidien `releve-mensuel` du worker : reprise, préparation, alerte interne. **Aucun e-mail d'apporteur.**                                                           | `server/queue/workers/apporteur-crons-worker.ts` (branche `releve-mensuel`), `server/queue/types.ts` (`ApporteurCronJobType`), `server/queue/queues.ts` (`bootRepeatableJobs`, une entrée)                            | `job-releve-mensuel.spec.ts`                       | non       | **0 en ligne**, 3c ; 4a fusionné (pour `reprise.ts`)               |
| **4b** | Rectificatif individuel (bouton sur la fiche).                                                                                                                               | `releve-mensuel/rectificatif.ts`, bouton ajouté à `RelevesMensuels.tsx`                                                                                                                                               | `rectificatif.spec.ts`                             | non       | 4a, 4b'                                                            |
| **6**  | Espace apporteur : « Mes relevés », route `releves/[numero]`, phrase § 3 l. 5.                                                                                               | `app/apporteur/dossier/[id]/[jeton]/mes-commissions/**` (section neuve), `.../releves/[numero]/route.ts` (neuf), `textes.ts` (une phrase)                                                                             | `route.spec.ts` (404 croisés)                      | non       | 3a, 3d ; lire #2259 et #2261 ; phrase après un premier mois envoyé |

### NON LANÇABLES (décision du dirigeant requise)

| Lot    | Pourquoi il attend                                                                                                                                                                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5**  | Mode automatique : le dirigeant a dit « automatique plus tard » et « aucun e-mail sans mon clic » (D3, D7). Ne se lance que sur sa demande écrite, après au moins un mois envoyé à la main. Spécification conservée : interrupteur `apporteurs.releve-mensuel.auto` (absent = éteint), allumage `super_admin` seulement, jour ouvré 1 à 5, journal d'audit. |
| **G2** | Correction du calcul pour suivre la version signée (D6, Q8). Attend la réponse à Q8 et le rapport G1. Change le calcul de l'argent : **Opus**, test rouge `grille-suit-la-version-signee.spec.ts` d'abord.                                                                                                                                                  |
| —      | Règle « formation de 3 jours ou plus » (Q7) : hors de ce plan tant qu'elle n'est pas définie.                                                                                                                                                                                                                                                               |

**Premier mois réel** : le worker prépare le 1ᵉʳ jour ouvré ; le dirigeant vérifie à l'écran (PDF stockés,
statistiques) ; il clique « Envoyer les relevés à tout le monde ». Rien d'autre ne part.

---

## 12. Risques

| Risque                                                                   | Gravité   | Parade                                                                                            |
| ------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| Un apporteur payé avec une grille qu'il n'a pas signée                   | **Haute** | Q8, lots G1 puis G2 ; le relevé affiche la version stockée et ne recalcule rien.                  |
| Le relevé est pris pour une facture                                      | Haute     | Mention « n'est pas une facture », série `REL-` distincte, test dédié.                            |
| Un relevé perdu en silence (collision de numéro, préparation incomplète) | Haute     | Numérotation sous verrou, P2002 sur `numero` remonté, contrôle de complétude bloquant.            |
| Double envoi                                                             | Haute     | Lot unique par période (index partiel), prise conditionnelle, `jobId` déterministe, `dejaEnvoye`. |
| Un relevé envoyé réécrit plus tard                                       | Haute     | Trigger SQL de figement + refus de suppression ; rectificatif seulement.                          |
| Un ancien worker exécute un job inconnu comme `relance-invitation`       | **Haute** | Lot 0 en ligne avant 4c ; la console n'enfile jamais sur `apporteur-crons`.                       |
| Un e-mail part sans clic                                                 | Haute     | Le worker n'enfile aucun e-mail d'apporteur (test 4c) ; lot 5 non lançable.                       |
| Envoi bloqué en `envoi_en_cours`                                         | Moyenne   | `prisAt` + reprise à 10 min, lecture d'`EmailLog` et de la file.                                  |
| Blocages en cascade entre vérification et envoi                          | Moyenne   | Coupure fixe ; D3 hors empreinte ; seul un changement d'un événement antérieur bloque.            |
| Server Action trop longue                                                | Moyenne   | PDF rendu à la préparation, tranches de 25 (préparation) et 50 (envoi), reprise.                  |
| Gabarit inconnu d'un ancien worker                                       | Moyenne   | Lot 2 en ligne un créneau avant 4a ; preuve par `grep` dans le conteneur.                         |
| Fuseau ou heure d'été                                                    | Moyenne   | `moisParis` partout ; tests aux changements d'heure.                                              |
| Indice de salariat                                                       | Moyenne   | Vocabulaire du § 2.7.                                                                             |
| Conflits de fusion                                                       | Faible    | Fichiers possédés par lot ; gabarit dans un fichier neuf.                                         |
