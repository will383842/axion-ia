# RELECTURE A09 — lot A8c « deux circuits de paiement OPCO »

Branche relue : `opco/a8c-deux-circuits-paiement` @ `c3c845b0` (diff contre `origin/main`).
Rapport lu : `rapports/opco-a8c-deux-circuits-paiement:RAPPORT.md`.
Lentilles : **EXACTITUDE** et **SÉCURITÉ** (argent : destinataire des factures, créances, état payé, e-mail à l'entreprise avec pièces jointes). Aucun code de la PR n'a été modifié.

## Tests lancés

- `pnpm install`, `DATABASE_URL=…stub.invalid… pnpm prisma:generate` : OK.
- `pnpm vitest run src/server/qualiopi/financements/ src/server/qualiopi/facturation/ src/server/actions/qualiopi/` : **122 fichiers, 1 779 tests verts, 0 échec**.
- Nouveaux témoins et `src/server/email/apercu/` : **9 fichiers, 190 tests verts**.
- Témoin de relecture local (non poussé, retiré ensuite) pour le défaut n° 1 ci-dessous : il **passe**, donc le défaut est réel (sortie plus bas).

---

## 🔴 Défaut bloquant (EXACTITUDE)

### 1. Cocher ou décocher la subrogation APRÈS une première facture crée une double créance, sans avertissement

`src/server/qualiopi/financements/dossier-financement.ts:400-405` + `:437-449`

`alignerDossiersSurSubrogation` décide qu'un dossier est « engagé » d'après son **statut** seulement (`a_monter`, `envoye`, `accord_recu`, `refuse` sont reventilables). Or **l'émission d'une facture ne fait pas passer le dossier à `facture`** : aucun code de `facture-formation-emission.ts` n'écrit ce statut, et le rapport le confirme (« `accord_recu → facture` : manuelle »). Après la première facture, un dossier reste donc normalement en `accord_recu`, avec une créance déjà rattachée à une facture (`factureFormationId` rempli).

`reventilerPayeurs` garde bien la ligne facturée telle quelle, mais elle ne retire du nouveau partage que ce que le **financeur** a déjà pris (`engageFinanceur` : seulement `opco_subroge` et `france_travail`, `:362-375`). Quand le circuit change, le nouveau partage ne porte plus le même type de payeur, et ce retrait ne joue pas.

**Scénario A (décocher) :** session OPCO à 1 500 € HT, subrogation, accord de 1 000 €. La facture à l'OPCO (1 000 €) est émise. Le dossier reste en `accord_recu`. On décoche la subrogation (erreur, ou l'OPCO exige finalement le remboursement).
→ créances : OPCO 1 000 € (facturée, gardée) **+ entreprise 1 500 €** (nouvelle) = **2 500 € pour une prestation à 1 500 €**.
→ `engages` est vide, donc **aucun avertissement** n'est affiché.
→ « Générer une facture » à l'entreprise passe : `choisirCreancePourFacture` trouve une créance entreprise libre de 1 500 €, et la garde anti-doublon (`facture-formation-emission.ts`, `couvrantes`) ignore la facture OPCO puisqu'elle est rattachée à une créance. **1 500 € HT réclamés en double.**

Sortie du témoin de relecture (prisma simulé, dossier `accord_recu`, créance OPCO 1 000 € facturée, session passée à `opcoSubrogation: false`) :

```
RESULTAT {"r":{"alignes":["d1"],"engages":[]},
          "created":[{"payeurType":"entreprise","payeurNom":"ACME","montantAttenduCents":150000,"dossierId":"d1"}]}
```

**Scénario B (cocher), symétrique :** remboursement, facture entreprise de 1 500 € émise (dossier `accord_recu`), puis on coche la subrogation avec l'accord écrit et le n° de dossier.
→ créances : entreprise 1 500 € (facturée) + `opco_subroge` 1 000 € + entreprise 500 €. La facture à l'OPCO de 1 000 € passe alors le nouveau contrôle de circuit **et** la garde par créance.

Ce défaut est **introduit par la PR** : avant elle, changer la subrogation ne touchait pas aux créances. Il contredit aussi la promesse écrite dans la JSDoc et dans le rapport (« un dossier déjà facturé n'est pas touché… l'écran le dit »).

**Correctif proposé (petit) :** dans `alignerDossiersSurSubrogation`, considérer un dossier comme engagé dès qu'**une de ses créances porte `factureFormationId`** (ou qu'une facture vivante lui est rattachée), quel que soit son statut. Le ranger alors dans `engages` sans le reventiler. Ajouter le témoin « `accord_recu` + créance facturée → non reventilé, avertissement affiché ».

---

## Les points demandés, un par un

### (1) Refus d'une facture à l'OPCO hors subrogation — **OK**

`circuit-paiement-opco.ts:65-77`, appelé dans `facture-formation-emission.ts:324`.
- `mixte` : traité comme OPCO (`financeParOpco`), même ensemble que `financementAdmetSubrogation`. Avec subrogation, la facture à l'OPCO passe. Sans subrogation, elle est refusée, ce qui est juste : `typePayeurDe("mixte")` ne crée de toute façon jamais de créance `opco_subroge` sans subrogation.
- France Travail : seul `destinataire === "opco"` est contrôlé. `france_travail` n'est pas touché.
- Subrogation confirmée par accord écrit : la garde de `setFinancementSessionAction` pose `opcoSubrogation = true`, donc le circuit est `subrogation` et la facture passe.
- Sessions antérieures au 1/10/2026 déjà subrogées : `opcoSubrogation = true` en base, donc la facture passe. Le contrôle ne lit aucune date.
- `opcoSubrogation` est bien dans le `select` de l'émission (`:227`).
- Petit point : une session portant encore un résidu `opcoSubrogation = true` avec un type `direct` (possible seulement avant le correctif R-12 du 17/09) reçoit « pas financée par un OPCO ». C'est cohérent.

### (2) `alignerDossiersSurSubrogation` — **défaut n° 1 ci-dessus**, le reste est OK

- Dossier en `facture` / `paiement_recu` : non reventilé, avertissement affiché. OK.
- Créance facturée : la ligne elle-même n'est jamais réécrite (`deleteMany` sur `factureFormationId: null`). OK. Mais le reste du dossier, lui, est réécrit (défaut n° 1).
- Transaction : chaque reventilation fait `deleteMany` + `createMany` dans un `$transaction`. Le drapeau `subrogation` du dossier est écrit **hors** de cette transaction, et `reventilerPayeurs` avale ses erreurs. Une panne entre les deux laisse donc le drapeau aligné et les créances anciennes, sans rien signaler à l'écran. Petit défaut, voir P2.
- Idempotence : oui (recalcul complet). L'action n'appelle l'alignement que si la valeur change réellement.
- Décision saisie : la session est écrite **avant** l'alignement, dans un `try/catch`. Elle n'est jamais perdue. OK.

### (3) « Paiement reçu = toutes les créances non nulles facturées et payées » — **OK**

`dossier-financement.ts:475-482`
- Créance à 0 € : ignorée (`> 0`). Témoin présent.
- Facture annulée ou soldée par avoir : une créance n'est **jamais** détachée de sa facture (aucun code ne remet `factureFormationId` à `null`). Elle ne compte donc pas comme « reste à facturer » : pas de nouveau blocage.
- Pas de blocage « à vie » : la transition manuelle vers `paiement_recu` reste possible (`TransitionDossierSchema`).
- Cas résiduel, petit : si le rattachement de la créance échoue alors que l'émission a réussi (best-effort, canal Partners fermé, `facture-formation-emission.ts:664-678`), la créance reste libre et le passage automatique ne se fait plus. Il reste la sortie manuelle. Le défaut n° 1 laisse lui aussi une créance libre parasite qui retient le dossier.

### (4) E-mail de remboursement — **OK**

`transmission-remboursement-opco.ts`, `facture-libre.ts:647-660`
- Jamais en subrogation : `f.subrogation` ou un circuit autre que `remboursement` donnent `sans_objet`.
- Jamais à l'OPCO : seul `destinataire === "entreprise"` passe. Le destinataire de l'e-mail est `client.contactEmail` de la facture, jamais un contact OPCO.
- Jamais deux fois : comptage `emailOutbox` + `emailLog` par `template` et `entityId`. Seul l'encaissement **soldant** le déclenche.
- Garé en validation : `exigerValidation: true` + ajout à `EMAILS_A_VALIDER_PAR_DEFAUT`.
- Aucune promesse : « La décision et le montant du remboursement relèvent de votre OPCO, selon son accord de prise en charge. » OK.
- Une panne n'annule pas l'encaissement : appel après la transaction de paiement, dans un `try/catch`. OK.
- Pièces jointes : les certificats et relevés de la **session**, sans filtre par client. Sur le chemin d'émission concerné (facture de session, `clientId = session.clientId`, intra), ce sont bien ceux du client. Les factures inter-entreprises (`factures-inter.ts`) n'écrivent pas de `clientId` : l'e-mail tombe alors en `impossible` (« aucun e-mail de contact »). **Pas de fuite démontrée**, mais c'est un manque fonctionnel en inter. Voir P1 pour la seule fenêtre restante.

### (5) ZIP « Paquet de facturation OPCO » — **OK**, avec une réserve RGPD (P1)

`actions/qualiopi/pieces-facturation-opco.ts`
- Habilitation `facturer` vérifiée en premier, action journalisée. OK.
- Contenu : la facture, puis les certificats en vigueur, les relevés et le tirage d'émargement **de la session de la facture**. Rien d'une autre session. OK.
- Aucune numérotation, aucun envoi : lecture du registre, tirage non persisté, renvoi en base64 à l'admin. OK.
- Réserve : voir P1 (facture inter-entreprises par inscription).

### (6) TVA et somme des deux factures — **OK**

L'émission n'est pas modifiée sur ce point : `computeTotauxFacture`, la garde CI `la-tva-ne-peut-pas-tomber-a-zero` reste en place, et le témoin 1 234,57 + 265,43 € HT donne bien 1 800,00 € TTC. Un écart d'un centime reste possible à cause de l'arrondi par facture (limite n° 4 du rapport). C'est antérieur à la PR et documenté.

---

## Petits défauts (non bloquants)

- **P1 — RGPD, ZIP sur facture inter-entreprises.** `chargerPiecesFacturation` (`pieces-facturation-opco-lecture.ts:88-101`) lit **tous** les certificats et relevés de la session, et le tirage d'émargement couvre toute la session. Il ignore `FactureFormation.enrollmentId`. Pour une facture par inscription (`factures-inter.ts`) à l'OPCO d'une session inter subrogée, le paquet contient les certificats et signatures des stagiaires des **autres entreprises**, dont l'OPCO peut être différent. Ce paquet est fait pour être déposé chez l'OPCO de l'inscription. Il faut le filtrer par `enrollment.traineeId` quand `enrollmentId` est rempli, ou refuser le paquet sur ces factures. Même filtre côté e-mail, par défense en profondeur : une facture de session émise par le bouton « Générer une facture » sur une session dont des inscriptions portent un autre `clientId` part sous le `clientId` de la session (défaut antérieur à la PR) et joindrait les certificats des autres clients.
- **P2** — L'écriture du drapeau `DossierFinancement.subrogation` et la reventilation ne sont pas atomiques, et `reventilerPayeurs` avale ses erreurs. En cas de panne, le drapeau est aligné, les créances ne le sont pas, et l'écran ne dit rien. À regrouper dans une seule transaction, ou à faire remonter l'échec dans l'avertissement.
- **P3** — Pour un dossier `a_monter`/`envoye`, l'alignement prend comme plafond `montantAccordeCents ?? montantDemandeCents`. L'ouverture du dossier, elle, partait du barème de la session. Le reste à charge affiché peut donc changer au simple fait de cocher la subrogation. Sans effet sur l'argent tant qu'aucune facture n'existe, mais à vérifier.
- **P4** — L'e-mail de remboursement part (une fois validé) même sans aucun certificat de réalisation au registre. La liste des pièces le dit honnêtement, mais l'entreprise ne peut rien en faire auprès de son OPCO. Suggestion : ajouter un signal « certificat manquant » dans la carte de validation.
- **P5** — Le paquet ZIP et l'e-mail ne vérifient pas l'état de la session ni du certificat par rapport à la facture (une régénération du certificat après encaissement n'est pas renvoyée). Acceptable pour ce lot.

---

## Verdicts

- **EXACTITUDE : `refuse`** — défaut n° 1, `src/server/qualiopi/financements/dossier-financement.ts:400-449`. Changer la subrogation sur un dossier `accord_recu` qui porte déjà une facture recrée une créance du total à côté de la créance facturée (2 500 € de créances pour 1 500 €). La seconde facture est alors émissible et aucun avertissement n'est affiché. Le correctif est petit : est engagé tout dossier dont une créance porte `factureFormationId`.
- **SÉCURITÉ : `accepte`** — habilitation, garage en validation, destinataire, anti-doublon et tolérance aux pannes sont corrects. Aucune fuite démontrée sur le chemin livré. La réserve RGPD P1 (paquet sur facture inter-entreprises) est à corriger dans la foulée.
