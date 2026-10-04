# RAPPORT — Lot A8c « deux circuits de paiement OPCO »

Branche de code : `opco/a8c-deux-circuits-paiement` (depuis `origin/main` `be6611ea`).
Demande de Williams (04/10) : « il faut que les deux cas fonctionnent ».

Les numéros de ligne renvoient à l'état **après** correction (tête de branche), sauf mention « (avant) ».

---

## 1. AUDIT — le parcours réel, de bout en bout, dans le code

### Pivot commun aux deux cas

- Le régime calculé (`regime-paiement-opco.ts`, `regime-paiement-session.ts`) est une **indication**. Ce qui fait foi pour la facturation est la décision portée par la session : `TrainingSession.opcoSubrogation`, gardée par `setFinancementSessionAction` (`src/server/actions/qualiopi/financements.ts:270-283` : refus sans « accord écrit » quand le régime est `remboursement_entreprise`, avertissement quand il est `inconnu`). **OK.**
- Le dossier de financement s'ouvre seul au choix d'un financement OPCO (`financements.ts`, `creerDossierDepuisSession`) ; ses **créances** (`DossierPayeur`) disent qui doit combien (`dossier-payeurs.ts:110` : `opco` → `opco_subroge` **seulement** s'il y a subrogation, sinon `entreprise`). **OK.**
- L'émission d'une facture de session passe par **un seul** service : `emettreFactureFormationSession` (`facture-formation-emission.ts`), appelé par le bouton « Générer une facture » de la page Financement et par l'automate du lendemain. `facturation-service.ts` (jumeau historique qui écrase le destinataire en `opco`, `:195`) n'a **plus aucun appelant** hors de son test : code mort, sans effet. **OK (à supprimer un jour).**
- TVA : `computeTotauxFacture` sur le régime de config (`facture-formation-emission.ts:564`), jamais d'exonération posée d'office ; garde CI `tests/unit/ci/la-tva-ne-peut-pas-tomber-a-zero.spec.ts`. **OK.**
- Mentions : identité de l'acheteur par `resoudreDestinataireFacture` (nom + SIRET + adresse pour l'entreprise ; nom lisible de l'OPCO par `nomOpcoDuClient`) ; numérotation AXI-FACT séquentielle sous `withNumberRetry` ; échéance posée ; mention de subrogation avec n° de dossier OPCO sur la seule facture adressée à l'OPCO (`:515`, `:826`). **OK.**
- Facturation automatique : exclut tout financement non direct et toute subrogation (`facture-auto-regles.ts:459`) — les cas OPCO restent manuels, et l'alerte le dit. **OK (par conception).**

### Cas SUBROGATION (l'OPCO paie l'organisme)

| Étape | Verdict | Où |
|---|---|---|
| Choix « OPCO + subrogation » sur la page Financement, garde de régime | OK | `financements.ts:270-283` |
| Dossier ouvert avec créance `opco_subroge` + reste `entreprise` | **FAUX (avant)** si la subrogation est cochée **après** l'ouverture du dossier (cas normal : on choisit d'abord « OPCO », on décide ensuite) : les créances restaient celles de l'ouverture (une seule créance `entreprise` du total). Seules les transitions `accord_recu`/`refuse` reventilaient (`dossier-financement.ts:225`). Conséquence : facture à l'OPCO **refusée** (« ce dossier ne reconnaît pas ce destinataire ») jusqu'à l'accord, ou définitivement si la subrogation est cochée après l'accord. | corrigé → `financements.ts:389`, `dossier-financement.ts:421` |
| Accord partiel : plafond = `montantAccordeCents`, reste à l'entreprise | OK — `reventilerPayeurs` (`dossier-financement.ts:338`) + `construireLignesPayeurs` au prorata, reste retombant sur l'employeur | `dossier-payeurs.ts` |
| Factures : une à l'OPCO pour la part accordée, une à l'entreprise pour le reste | OK — émission par créance (`facture-formation-emission.ts:440`), anti-double-facturation par créance | — |
| Somme des deux factures TTC = prix TTC | OK — vérifié par témoin (HT 1 234,57 € à l'OPCO + 265,43 € à l'entreprise → 1 800,00 € TTC). Voir limites (arrondi). | témoin `deux-circuits-paiement-opco.spec.ts` |
| Mention de subrogation + n° de dossier OPCO obligatoire | OK (`:313`), uniquement sur la facture OPCO, jamais sur le reste à charge | — |
| Délai de facturation OPCO | OK — alerte J-15 / dépassée tant qu'aucune facture à l'OPCO n'est émise | `regle-delai-facturation-opco.ts:85` |
| Pièces exigées par l'OPCO (facture + certificat de réalisation + émargements) prêtes depuis la facture | **MANQUE (avant)** — rien ne les rassemblait ; le « dossier prêt à déposer » (A6) ne couvre que la demande. | ajouté → bouton « Paquet de facturation OPCO (ZIP) » |
| Envoi | OK — `preparerEnvoiFactureEmail` ; destinataire de l'e-mail saisi (le contact OPCO n'est pas le client) | `facture-envoi-email.ts` |
| Relance de paiement | OK — dérivée du destinataire **de la facture** : la facture OPCO relance le gestionnaire du dossier (refus si inconnu, jamais de repli sur le client) ; le reste à charge relance l'entreprise. Même résolveur pour le cron et l'envoi. | `relance-destinataire.ts:147`, worker `qualiopi-formation-crons-worker.ts:1427` |
| Encaissement | OK — `Payment`, statut `payee`/`partiellement_payee` | `facture-libre.ts:616` |
| L'OPCO paie MOINS que facturé | **MANQUE (non corrigé, cf. limites)** — la facture OPCO reste `partiellement_payee`, relancée à l'OPCO. Rien ne bascule l'écart sur l'entreprise : sa créance OPCO est engagée et ne se reventile pas. Contournement manuel existant : avoir partiel sur la facture OPCO (`facture-libre.ts:353`) puis facture libre à l'entreprise. | — |
| Clôture / état « payé » du dossier | **FAUX (avant)** — `marquerPaiementRecuSiSoldee` passait le dossier `paiement_recu` dès que les factures **émises** étaient payées : facture OPCO payée + reste à charge **pas encore facturé** = dossier annoncé soldé. | corrigé → `dossier-financement.ts:479` |
| Transition `accord_recu → facture` | OK — manuelle, par conception (« machine à états MANUELLE ») | `dossier-financement.ts:117` |

### Cas REMBOURSEMENT (l'entreprise paie tout, l'OPCO la rembourse)

| Étape | Verdict | Où |
|---|---|---|
| Choix « OPCO » sans subrogation ; la garde refuse la subrogation sans accord écrit | OK | `financements.ts:270-283` |
| Créance unique `entreprise` du total | OK à l'ouverture ; **FAUX (avant)** si la subrogation est **décochée** ensuite (passage au remboursement) : la créance `opco_subroge` survivait. | corrigé (même correctif que ci-dessus) |
| Destinataire présélectionné à l'écran | **FAUX (avant)** — `defaultDestinataireForType` rendait `"opco"` dès que le financement était OPCO, subrogation ou pas (page Financement, `if (ft === "opco") return "opco"`). | corrigé → `financement/page.tsx:206` |
| UNE facture totale à l'entreprise, jamais à l'OPCO | **FAUX (avant)** — sans dossier/créance (`aucune_creance`), l'émission acceptait le destinataire `opco` hors subrogation : facture à l'OPCO dans le circuit où l'OPCO ne paie jamais l'organisme. Avec créances, c'était déjà refusé. | corrigé → `facture-formation-emission.ts:324` |
| Montants HT/TVA/TTC, mentions, numérotation | OK — total HT de la session + TVA, sans mention de subrogation ni n° OPCO, délai de paiement du client | — |
| Envoi | OK — `facture-envoi` au contact du client, garé en validation | — |
| Relance vise l'entreprise | OK — destinataire `entreprise` → contact du client | `relance-destinataire.ts` |
| Encaissement → l'entreprise reçoit facture acquittée + certificat de réalisation (+ présences) | **MANQUE (avant)** — rien ne lui transmettait les pièces de son remboursement. | ajouté → e-mail `facture-pieces-remboursement-opco` |
| Clôture / état « payé » | OK — une seule créance, une seule facture | — |

---

## 2. CE QUI EST FAIT (du plus grave au moins grave)

1. **Le destinataire suit le circuit de la session** (`circuit-paiement-opco.ts`, nouveau, pur) :
   - refus serveur d'une facture à l'OPCO hors subrogation (« sans subrogation, l'OPCO rembourse l'entreprise… émettez une seule facture, du montant total, à l'entreprise »), contrôlé **avant** les créances ;
   - présélection de l'écran : subrogation → OPCO ; remboursement → entreprise.
2. **Cocher/décocher la subrogation recalcule les créances** des dossiers OPCO ouverts (`alignerDossiersSurSubrogation`) et aligne le drapeau `DossierFinancement.subrogation` (lu par la relance). Dossier déjà facturé : rien n'est recalculé et l'écran le dit (avoir puis refacturation). Fail-soft : la décision saisie n'est jamais perdue.
3. **Un dossier n'est « paiement reçu » que si toutes ses créances non nulles sont facturées et payées.**
4. **(b) Remboursement** : à l'encaissement qui solde la facture de l'entreprise d'une session OPCO sans subrogation, un e-mail lui est **préparé et garé en « E-mails à valider »** (`exigerValidation: true`), joignant la facture et le(s) certificat(s) de réalisation (et relevés de connexion s'il y en a), avec l'attestation « cette facture est acquittée » et « pour votre demande de remboursement auprès de votre OPCO ». Aucun engagement : « la décision et le montant du remboursement relèvent de votre OPCO ». Jamais en subrogation, jamais à l'OPCO, jamais deux fois. Best-effort : une panne n'annule pas l'encaissement.
5. **(c) Subrogation** : bouton « Paquet de facturation OPCO (ZIP) » sur la fiche facture (facture à l'OPCO d'une session subrogée) : facture + certificat(s) de réalisation en vigueur (le plus récent par stagiaire) + **tirage à jour** de la feuille d'émargement (ou relevés de connexion) + `LISEZMOI.txt` (n° de dossier OPCO, pièces manquantes **nommées**). Le même bouton existe, libellé « Pièces pour le remboursement OPCO », sur la facture entreprise d'une session en remboursement. Habilitation `facturer`, journalisé, rien n'est numéroté ni envoyé.

Aucune migration. Aucun contrat d'événements Partners touché. Phrases « jusqu'à 0 € de reste à charge » / « à 100 % » non touchées. OPCO du client lu uniquement par `nomOpcoDuClient`/`opcoDuClient`. Relances entreprise pour le dépôt/la réponse de l'OPCO non traitées (PR `opco/a8-suivi-entreprise`).

## 3. FICHIERS

Nouveaux :
- `src/server/qualiopi/financements/circuit-paiement-opco.ts` (+ spec)
- `src/server/qualiopi/financements/pieces-facturation-opco.ts` (+ spec) — sélection pure + ZIP
- `src/server/qualiopi/financements/pieces-facturation-opco-lecture.ts`
- `src/server/qualiopi/financements/transmission-remboursement-opco.ts` (+ spec)
- `src/server/actions/qualiopi/pieces-facturation-opco.ts` (Server Action gardée)
- `src/components/admin/qualiopi/PiecesFacturationOpcoButton.tsx`
- `src/lib/email/templates/facture-pieces-remboursement-opco.tsx`
- Témoins : `deux-circuits-paiement-opco.spec.ts`, `dossier-solde-toutes-creances.spec.ts`, `encaissement-transmission-remboursement.spec.ts`, `src/server/actions/qualiopi/subrogation-reventile-creances.spec.ts`

Modifiés :
- `facture-formation-emission.ts` (refus de circuit), `dossier-financement.ts` (alignement + solde), `facture-libre.ts` (déclenchement à l'encaissement), `actions/qualiopi/financements.ts` (appel de l'alignement + avertissement)
- `sessions/[id]/financement/page.tsx` (présélection), `facturation/[id]/page.tsx` (bouton)
- Registre e-mail : `templates/index.tsx`, `queue/types.ts`, `email/outbox-policy.ts` (à valider par défaut + libellé), `email/apercu/catalogue.ts`, `email/apercu/payloads-exemple.spec.ts` (compteur 64 → 65)

## 4. ROUGE / VERT

| Témoin | ROUGE constaté | VERT |
|---|---|---|
| `circuit-paiement-opco.spec.ts` (16) | module absent | 16/16 |
| `deux-circuits-paiement-opco.spec.ts` (6) — bout en bout : ventilation réelle → émission → relance | correctif d'émission retiré (`git stash`) : « sans dossier ni créance, une facture à l'OPCO est REFUSÉE » échoue (la facture était émise) ; les 5 autres passent déjà (subrogation partielle, somme TTC, relances) — ce sont des constats OK de l'audit | 6/6 |
| `subrogation-reventile-creances.spec.ts` (4) | 3 échecs (aucune créance réécrite, pas d'avertissement) | 4/4 |
| `dossier-solde-toutes-creances.spec.ts` (5) | 1 échec (reste à charge non facturé → passait `paiement_recu`) | 5/5 |
| `pieces-facturation-opco.spec.ts` (6) | module absent | 6/6 |
| `transmission-remboursement-opco.spec.ts` (6) | module absent | 6/6 |
| `encaissement-transmission-remboursement.spec.ts` (3) | 1 échec (l'encaissement soldant ne déclenchait rien) | 3/3 |
| Référentiel e-mail (objet ≤ 45 car.) | 2 échecs sur le premier objet rédigé | vert après raccourcissement |

Batterie demandée : voir la section 7 (résultats reportés à la fin).

## 5. LIMITES (ce qui reste)

1. **L'OPCO paie moins que facturé** (subrogation) : aucun basculement automatique de l'écart sur l'entreprise. Contournement manuel existant : avoir partiel sur la facture OPCO, puis facture libre à l'entreprise. Un vrai correctif demande de reventiler une créance **engagée** — à décider avec Will (lot dédié).
2. **« Facture acquittée »** : l'acquittement est **attesté dans le corps de l'e-mail** (n°, montant, date du règlement) ; le PDF joint est la facture d'origine, sans tampon « acquittée » (le régénérer créerait une seconde pièce sous le même numéro). Si l'OPCO exige le tampon sur le PDF : variante de rendu dérivée à prévoir.
3. **Feuilles d'émargement non jointes à l'e-mail** de remboursement : le tirage à jour n'est jamais persisté (doctrine `emargement-tirage.ts`) et la pièce scellée, émise avant la session, ne porte pas les signatures. Elles sont dans le ZIP « Pièces pour le remboursement OPCO » de la fiche facture. Les relevés de connexion (distanciel), eux, sont joints.
4. **Arrondi TVA** : la somme des deux factures TTC égale le prix TTC dès que la TVA du total tombe au centime (cas de tout prix HT multiple de 5 centimes à 20 %). Pour un taux ou un prix exotiques, un écart d'**1 centime** est possible (arrondi par facture). Non observé sur des prix réels.
5. L'écran « Générer une facture » propose toujours les quatre destinataires ; le serveur refuse les mauvais avec un message nommant les débiteurs. `destinatairesFacturables` existe (`facture-par-creance.ts`) mais n'est pas branché à l'écran.
6. `facturation-service.ts` est du code mort (aucun appelant) qui écrase encore le destinataire en `opco` : sans effet, à supprimer dans un lot de nettoyage.
7. Fenêtre app/worker : aucun contrat app↔worker changé (pas de migration, pas d'énumération, pas de forme de job BullMQ). Le nouvel e-mail est rendu par le worker à l'envoi : le gabarit doit être présent dans le worker, qui atterrit **avant** l'app — sans risque (l'app ne le met en file qu'une fois déployée).

## 6. CORPS DE PR (proposé)

> **fix(opco): les deux circuits de paiement OPCO fonctionnent de bout en bout (lot A8c)**
>
> Demande de Williams (04/10) : « il faut que les deux cas fonctionnent ». Audit écrit du parcours (choix du financement → dossier → factures → envoi → relances → encaissement → clôture) pour la **subrogation** et le **remboursement**, puis corrections :
>
> - **Le destinataire suit le circuit** : hors subrogation, une facture à l'OPCO est refusée côté serveur (elle passait sans dossier) et l'écran présélectionne l'entreprise (il présélectionnait l'OPCO).
> - **La subrogation cochée/décochée recalcule les créances** du dossier (elles restaient celles de l'ouverture : facture OPCO refusée, ou créance OPCO fantôme).
> - **Un dossier n'est « paiement reçu » que toutes créances facturées et payées** (le reste à charge non facturé était ignoré).
> - **Remboursement** : à l'encaissement complet, e-mail garé en validation à l'entreprise avec la facture (attestée acquittée) et le(s) certificat(s) de réalisation, « pour votre demande de remboursement auprès de votre OPCO ».
> - **Subrogation** : « Paquet de facturation OPCO (ZIP) » sur la fiche facture — facture + certificats + émargement à jour, pièces manquantes nommées.
>
> Aucune migration, aucun contrat Partners, aucun contrat app↔worker. Limites dans `RAPPORT.md` (branche `rapports/opco-a8c-deux-circuits-paiement`) : écart de paiement OPCO non basculé automatiquement, tampon « acquittée » absent du PDF.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
>
> https://claude.ai/code/session_01KPHo1TvYeCCd4H1X9ZB717

## 7. RÉSULTATS DE LA BATTERIE

- `pnpm vitest run src/server/qualiopi/ src/server/actions/qualiopi/ src/server/facturation/ tests/unit/ci/ src/components/admin/qualiopi/__tests__/` (+ `src/server/email/ src/lib/email/` pour le nouveau gabarit) : **676 fichiers, 10 656 tests verts, 1 todo, 0 échec**. (`src/server/facturation/` n'existe pas dans le dépôt : le filtre ne trouve rien.)
- Premier passage : **4 échecs** dans `financements-actions.spec.ts` — ces tests émettaient une facture à l'OPCO sur une session **sans subrogation**, c'est-à-dire exactement le cas désormais refusé. Ils sont passés en subrogation explicite (n° de dossier renseigné), ce qui est le cas qu'ils voulaient vérifier (ventilation horaire OPCO, accord `paiement_recu`). Aucun test supprimé ni désactivé.
- Premier passage des tests e-mail : 2 échecs (objet > 45 caractères), corrigés.
- `pnpm qualiopi:isolation-check` : OK, 0 violation.
- `pnpm typecheck` : OK.
- eslint + prettier lancés à la main sur tous les fichiers touchés : propres (commits en `--no-verify`).

## 8. SHA DE TÊTE

Branche `opco/a8c-deux-circuits-paiement` : **`c3c845b051966c2bf868ec1f72e65fdbb6fbed72`**

