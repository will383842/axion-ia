# RELECTURE — PR #1279, lot OPCO A6 « dossier prêt à déposer »

Relecteur A09. Lentilles : **EXACTITUDE** et **SÉCURITÉ**. Tête relue : `opco/a6-dossier-pret-a-deposer` @ `c87ddf3a`.
Périmètre : l'apport propre d'A6 (`git diff origin/opco/a5-etat-des-fonds...origin/opco/a6-dossier-pret-a-deposer`),
hors A3 (`regime-paiement*`, `regle-delai-facturation-opco*`). Aucun code de la PR n'a été modifié.

Tests lancés sur la tête (worktree, `pnpm install` + `prisma:generate`) :
`pnpm vitest run src/server/qualiopi/sessions/__tests__/ src/server/qualiopi/alertes/ src/server/qualiopi/documents/ tests/unit/ci/ src/lib/admin-nav.test.ts src/lib/admin-nav-icons.test.ts src/components/admin/qualiopi/__tests__/ src/server/qualiopi/financements/dossier-pret-a-deposer src/server/actions/qualiopi/facturation-hub-depot-accord.spec.ts`
→ **231 fichiers, 2 878 tests verts** (1 todo). Ni la suite complète ni `next build` n'ont été lancés.

## 🔴 Défaut bloquant (EXACTITUDE)

### Le ZIP joint la convention VIERGE en l'annonçant « signée »

- `src/server/qualiopi/financements/dossier-pret-a-deposer.ts:41-47` : la convention n'est retenue **que si**
  `statutSignature === "signee"` (l. 92). Elle porte le libellé « Convention de formation signée ».
- `src/server/qualiopi/financements/dossier-pret-a-deposer-zip.ts:58` lit ensuite
  `documentPdfKey(piece.document)`, c'est-à-dire `documents/<année>/<type>/<numéro>.pdf` : le **PDF vierge**.
- L'exemplaire signé vit sous une **autre clé** : `exemplaireSignePdfKey()` = `…/<numéro>-signe.pdf`
  (`documents/signature/transmission-exemplaire.ts:92-104`, « voisine du PDF vierge, jamais la même »), et la
  clé est enregistrée dans `DocumentGenere.exemplaireSigneKey` (même fichier, l. 245).
- Puis `dossier-pret-a-deposer-zip.ts:71` écrit dans `LISEZMOI.txt` :
  `[JOINTE] Convention de formation signée — <nom>.pdf`, et le kit imprime « Jointe — n° ».

**Scénario.** Convention tripartite émise, signée par toutes les parties via le circuit de signature
(`statutSignature = signee`, exemplaire archivé en `…-signe.pdf`). L'organisme clique « Dossier prêt à
déposer ». Le ZIP contient `Convention … - AXI-DOC-2026-0xx.pdf` = le **PDF vierge, sans signature**, et le
LISEZMOI comme le kit affirment qu'une convention signée est jointe. L'entreprise dépose ce ZIP sur son espace
OPCO : la pièce maîtresse de la demande est non signée — motif classique de refus ou de demande de complément,
alors que tout le lot existe pour dire « ce qui y est vraiment ». Le test
`dossier-pret-a-deposer-zip.spec.ts:11` code en dur la clé vierge pour une pièce `signee` (l. 32) : il valide le défaut.

**Correction attendue (petite).** Sélectionner `exemplaireSigneKey` dans `SELECT_DOC`, et pour une pièce
`exigeSignature` lire cette clé (ou `exemplaireSignePdfKey(doc)`) ; si elle est nulle ou absente au stockage,
classer la pièce « manquante — exemplaire signé introuvable » plutôt que de joindre le vierge. Nommer le
fichier avec `suffixe: "signee"` (comme `exemplaire-signe.ts`). Un témoin : pièce `signee` → le lecteur
reçoit la clé `-signe.pdf`, jamais la clé vierge.

## Points vérifiés sans défaut

1. **Kit OPCO** (`templates/kit-opco.tsx`) — case remplie seulement si `presente` ; présence = pièce non
   annulée, la plus récente, et signée pour la convention. Lecture en échec ou stub → `pret = null` → ancienne
   liste, `cochee={false}` partout (`documents.ts` try/catch). Pièces post-formation jamais cochées. Encart lu
   dans `OPCO_FICHES` seulement, `non renseigné` sur portail / délai / date limite nuls, aucun délai propre
   d'Axion-IA ni promesse ; libellés de régime sobres (« selon l'accord », « à confirmer sur l'accord »).
2. **ZIP / action** — `requireHabilitation("deposer_demande_financeur")` est le premier appel de
   `genererDossierPretADeposerAction`, avant toute lecture ; le kit passe par `genererKitOpcoAction` (même droit,
   même verrou ADR 0060). Pas d'IDOR : toutes les lectures sont clées par le `sessionId` validé (relations
   `documents` et `devis` de CETTE session, kit relu par l'id que l'action vient d'émettre). Pas de traversée :
   noms construits par `asciiSur` (retire `/ \ : * ? " < > |` et non-ASCII), `LISEZMOI.txt` constant.
   Taille bornée : ≤ 5 PDF générés par l'organisme (`take: 50` en lecture). Journal : numéros de pièces
   seulement, aucune donnée personnelle.
3. **Saisie du dépôt / accord** — `enregistrerDepotDossier` refuse `clos` et écrit en `updateMany`
   conditionné au statut lu (`count === 0` → erreur) ; aucun changement de statut. `accordEcritLe` refusé
   hors `vers === "accord_recu"` avant toute lecture, et posé dans la même écriture conditionnée. Machine à
   états inchangée. Cibles de journal littérales (`"DossierFinancement"`, `"TrainingSession"`). Registre :
   `genererDossierPretADeposerAction` classé `verrou` et couvert par `ecritures-refusees-dossier-clos`.
4. **Alerte `depot_opco_a_faire`** — J-8 rien, J-7 `important`, lendemain de la limite `critique`, dépôt saisi
   → rien (filtre Prisma `none` + garde pure) ; comparaison par `dayKeyInParis` ; requête `take 500`, début
   entre J-365 et J+60 ; pas de faux positif : sans OPCO typé ou délai `null` → `continue`.
5. **Fenêtre app/worker** — aucune migration, aucune énumération, aucune forme de job. Si l'évaluateur tourne
   dans le worker, l'alerte peut paraître ~50 min avant le bouton ZIP côté app : sans effet sur les données.
   Toléré.

## Petits défauts (non bloquants)

- **Alerte : faux négatif sur l'OPCO en texte libre.** `regle-depot-opco-a-faire.ts:47` ne lit que
  `client.opco`, alors que la lecture du dossier (`dossier-pret-a-deposer-lecture.ts:73-74`) se replie sur
  `opcoIdentifie`. Un client à l'OPCO seulement en texte libre a un encart avec date limite mais jamais
  d'alerte. Direction sûre (pas de faux positif), à aligner.
- **Deux sources d'OPCO dans le même PDF.** L'en-tête du kit (`documents.ts`, `nomOpco`) lit
  `opcoIdentifie` ; l'encart lit `opco` d'abord. Un client typé `opco` sans `opcoIdentifie` reçoit « OPCO
  (à préciser) » en tête et « Comment déposer chez Atlas » plus bas.
- **Préférence de type stricte pour la convention.** `plusRecente` (`dossier-pret-a-deposer.ts:74-82`)
  s'arrête au premier type ayant une pièce vivante : une tripartite non signée masque une convention
  bipartite signée → « manquante ». Direction sûre, mais message trompeur.
- **`accordEcritLe` non contrôlé en `NaN`.** `facturation-hub.ts` vérifie `Number.isNaN` pour `depotFaitLe`,
  pas pour `accordEcritLe` (`2026-02-31` passe la regex) : l'erreur Prisma brute remonte à l'écran. Aucune
  borne non plus contre une date de dépôt future.
- **Message d'erreur brut renvoyé au client** (`documents.ts`, `catch` de l'action ZIP) : messages internes
  seulement aujourd'hui, mais préférer un libellé fixe.
- **Un kit numéroté par téléchargement** (limite déjà annoncée au rapport) : le registre se remplit de
  rectifications à chaque clic.

## Verdicts

- **EXACTITUDE : `refuse`** — `dossier-pret-a-deposer-zip.ts:58` joint le PDF vierge de la convention
  retenue parce que signée, et `:71` l'annonce « Convention de formation signée » : l'entreprise dépose une
  convention non signée en la croyant signée.
- **SÉCURITÉ : `accepte`**
