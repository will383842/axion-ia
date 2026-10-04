# RELECTURE — PR #1279, lot OPCO A6 « dossier prêt à déposer » — 2e tour

Relecteur A09, lentille **EXACTITUDE**. Tête relue : `opco/a6-dossier-pret-a-deposer` @ `40c45937`
(4 commits de correction après `c87ddf3a` : `cf880623`, `3e15415a`, `48a90423`, `40c45937`).
Avis du tour 1 : `origin/relectures/opco-a6:RELECTURE.md`. Aucun code de la PR n'a été modifié.

Vérifications lancées sur la tête :
- `pnpm vitest run src/server/qualiopi/financements/dossier-pret-a-deposer src/server/actions/qualiopi/ src/server/qualiopi/alertes/ src/server/qualiopi/documents/ src/server/qualiopi/financements/opco-referentiel`
  → **165 fichiers, 2 682 tests verts** (1 todo).
- `tsc --noEmit -p .` → code de sortie 0 (aucune erreur, le nouveau champ obligatoire `exigeSignature` /
  `exemplaireSigneKey` n'a pas d'autre constructeur oublié).
- Ni la suite complète ni `next build`.

## (1) Défaut bloquant du tour 1 — LEVÉ

- `dossier-pret-a-deposer-lecture.ts` : `SELECT_DOC` sélectionne `exemplaireSigneKey`.
- `dossier-pret-a-deposer.ts` (`etatPiecesDemande`) : convention signée mais `exemplaireSigneKey === null`
  → pièce **manquante**, motif « signée (n°), exemplaire signé introuvable ».
- `confirmerExemplairesSignes` : la clé est **constatée au stockage** (`existsInR2`, erreur → `false`, R2 non
  configuré → `false`) ; absente → `presente: false`, `document: null`. Elle est appliquée dans
  `chargerDossierPretADeposer`, qui alimente **à la fois** le kit (`genererKitOpcoAction`, `pret.pieces`)
  et le ZIP : le kit ne peut plus imprimer « Jointe » pour un exemplaire absent.
- `dossier-pret-a-deposer-zip.ts:63-65` : pour `exigeSignature`, la clé lue est
  `piece.document.exemplaireSigneKey`, **jamais** `documentPdfKey` ; clé nulle → aucune lecture ; lecture
  nulle (`getObjectBufferR2` est fail-soft) → `[MANQUANTE] … exemplaire signé introuvable au stockage`,
  pas de repli sur la vierge. Fichier nommé avec `suffixe: "signee"`.
- Témoins : `dossier-pret-a-deposer-zip.spec.ts` — le lecteur reçoit `…-signe.pdf` et jamais la clé vierge ;
  exemplaire absent au stockage → convention manquante, aucun fichier `AXI-DOC-1` dans le ZIP ;
  `exemplaireSigneKey` nul → une seule lecture (le kit). `kit-opco-verifie.spec.tsx` : convention signée sans
  exemplaire → jamais « Jointe — AXI-DOC-1 ». L'ancien témoin qui codait la clé vierge est corrigé.

## (2) Petits défauts du tour 1

| Point | État |
| --- | --- |
| Résolution unique de l'OPCO client | **Levé.** `opcoDuClient` / `nomOpcoDuClient` (`opco-referentiel.ts`) : typé d'abord, texte libre connu ensuite. Utilisé par la lecture du dossier, l'alerte `depot_opco_a_faire` (qui sélectionne désormais `opcoIdentifie`) et l'en-tête du kit (qui sélectionne désormais `opco`). Plus de « OPCO (à préciser) » en tête et « Atlas » dans l'encart. |
| Convention signée la plus récente, tous types | **Levé.** `vivantes()` trie toutes les pièces en vigueur des types admis par date décroissante, la préférence de type ne départage qu'à date égale ; `find(signee)` retient donc la signée la plus récente. Une tripartite non signée ne masque plus une bipartite signée. Sans effet sur les autres pièces (un seul type chacune). |
| `accordEcritLe` invalide | **Levé.** `jourSaisiVersDate` exige l'aller-retour ISO exact (le 31 février ne glisse plus au 3 mars) ; `null` → « Date de l'accord écrit invalide. », avant toute écriture. Même garde pour `depotFaitLe`. |
| Dépôt daté du futur | **Levé.** Comparaison `input.depotFaitLe > dayKeyInParis(new Date())` (deux chaînes `AAAA-MM-JJ`, ordre lexical = ordre chronologique) ; le jour même est accepté. Témoins présents. |
| Libellé fixe en cas d'échec du ZIP | **Levé.** `catch` → `console.error` côté serveur, « Impossible de préparer le dossier prêt à déposer. » à l'écran. |

Non traité, et non demandé : un kit numéroté par téléchargement (limite déjà annoncée).

## (3) Régressions — aucune démontrée

Observations sans effet bloquant :
- **Fenêtre HEAD → GET.** Le kit constate l'exemplaire par `existsInR2`, puis le ZIP le relit par
  `getObjectBufferR2` quelques instants plus tard. Un objet supprimé entre les deux ferait dire « Jointe » au
  kit et « MANQUANTE » au LISEZMOI. Il faut une suppression R2 dans la même seconde : théorique.
- **Coût.** Chaque affichage du panneau « Dépôt de la demande » fait au plus un `HEAD` R2 (convention seule).
  Négligeable.
- Fenêtre app/worker : toujours aucune migration, énumération ni forme de job ; l'alerte lit un champ
  supplémentaire déjà existant (`opcoIdentifie`). Toléré.

## Verdict

**EXACTITUDE : `accepte`** — le ZIP joint l'exemplaire signé (`exemplaireSigneKey`) ou déclare la convention
manquante, le kit et le LISEZMOI disent la même chose, et les cinq petits défauts relevés au tour 1 sont corrigés
et couverts par des témoins.
