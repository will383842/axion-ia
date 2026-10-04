# RELECTURE A09 — Lot OPCO A7d (effectif INSEE, enveloppe annuelle consommée)

Branche relue : `opco/a7d-effectif-enveloppe` @ `65ec98fd` · rapport : `rapports/opco-a7d-effectif-enveloppe`.
Lentilles : **EXACTITUDE** (montant affiché au client sur un devis) et **SÉCURITÉ** (appel réseau sortant).
Aucun code de la PR n'a été modifié.

Mesuré : `pnpm vitest run src/server/qualiopi/crm/ src/server/qualiopi/financements/ src/server/actions/qualiopi/`
→ **129 fichiers, 1 852 tests verts** (dont `effectif-insee.spec.ts` 19/19, `consommation-opco.spec.ts` 12/12).

## 1. Tranches INSEE, saisie, course
- Table `effectif-insee.ts:44-61` **conforme** à la nomenclature Sirene `trancheEffectifsUniteLegale` :
  NN, 00, 01→1, 02→3, 03→6, 11→10, 12→20, 21→50, 22→100, 31→200, 32→250, 41→500, 42→1000, 51→2000,
  52→5000, 53→10000. Les 16 codes et bornes basses sont exacts ; un code hors table n'écrit rien.
- Saisie jamais écrasée : garde `effectif === null || effectifSource === "insee"` ; effectif ancien
  sans source (`effectif` non nul, source `null`) → fermé au relevé. ✅
- `updateClientAction` pose bien `effectifSource: "saisie"` à toute saisie (`clients.ts:537`) : la
  garde de l'`updateMany` filtré (`effectif-insee.ts:~172`) protège donc une saisie posée pendant les 3 s. ✅

## 2. Appel réseau
- SIREN validé par `checkSirenFormat` **avant** la construction de l'URL, paramètre posé par
  `URLSearchParams` (encodé) : pas d'injection. Seul le SIREN part (identifiant public), `per_page=1`.
- Borné : `AbortController` à 3 s, le minuteur couvre aussi la lecture du corps (`clearTimeout` en
  `finally` après `json()`). Ne lève jamais. Réponse filtrée sur le même SIREN.
- Jamais au rendu ni au build : la fiche (`clients/[id]/page.tsx`) n'appelle ni `rechercherTrancheEffectif`
  ni l'action ; l'appel `rechercherSiren` au rendu (l. 334) est **antérieur** à la PR (`origin/main` l. 305).
  Rien au niveau module. Contrat `stub.invalid` respecté.
- Création : `releverEffectifInseeEtTracer(...).catch(() => null)` **après** la création ;
  aucune issue de l'annuaire ne peut faire échouer `createClientAction`. ✅
- Action et formulaire : `requireAdminWrite` avant tout, `clientId` validé en UUID. ✅

## 3. Consommation annuelle
- Statuts : accordé = `accord_recu|facture|paiement_recu|clos`, en cours = `envoye` ; `a_monter`,
  `refuse` exclus. L'énumération Prisma n'a pas d'autre valeur. ✅
- Pas de double compte : un dossier n'a qu'une `trainingSessionId` (relation 1-N), il est lu une fois
  quel que soit son statut (facturé puis clos = une ligne). ✅
- Année civile de Paris via `parisDateISO` ; centimes `Math.round` + `max(0)` ; `try/catch` → `null`. ✅

## 4. Estimation du devis
- Saisie du devis prioritaire, enveloppe `Math.max(0, base − consommé)`, consommation inconnue → base
  (= ancien `opcoEnveloppeAnnuelleCents ?? plafond`) : comportement antérieur intact. ✅
- « jusqu'à 0 € de reste à charge » / « à 100 % » absents du diff. ✅
- L'avertissement (`opcoEstimationAvertissement`) n'est affiché que dans la console (`devis/page.tsx`,
  `devis/[id]/page.tsx`) ; le PDF client (`templates/devis.tsx:357-361`) ne porte que les montants.
  Rien de faux n'est promis au client ; l'écart éventuel ne va que vers une **sous**-estimation. ✅

## 5. `asOf`
`dateDeReferenceDevis` (`crm/devis.ts:254`) : début prévu → validité → aujourd'hui. Conforme. ✅

## 6. `dateDebutSessionPrevue` — ❌ DÉFAUT DÉMONTRÉ
`src/server/actions/qualiopi/devis.ts:141` ne valide que la **forme** `^\d{4}-\d{2}-\d{2}$`. Ni date
calendaire, ni bornes. Mesuré sous Node (même `Intl` que `parisDateISO`) :

| Saisie | `new Date(…T12:00Z)` | Effet |
|---|---|---|
| `2026-13-01` | Invalid Date | `anneeParis(asOf)` (`devis.ts:229`) lève **`RangeError: Invalid time value`** hors de tout `try` → `createDevisAction` plante au lieu de rendre `{ error }` (cas courant : OPCO connu, pas d'enveloppe saisie) |
| `2026-02-31` | 3 mars 2026 | accepté en silence |
| `0001-01-01` | an 1 | `parisDateISO` rend `1-01-01` → `anneeParis` = **NaN** → consommation 0, barème hors vigueur |
| `9999-12-31` | accepté | barème et enveloppe de l'an 9999 |

Le formulaire (`<input type="date">`) protège l'écran, pas l'action serveur, qui est appelable
directement. La consigne demandait « format, bornes » : non tenu.
Correctif proposé (une ligne) : `z.string().date()` (zod ≥ 3.23) ou un `refine` qui relit
`AAAA-MM-JJ` en date UTC et exige l'égalité, plus une borne d'année (ex. aujourd'hui − 1 an ≤ date ≤
aujourd'hui + 3 ans), message français. Ajouter un témoin `2026-13-01` → `{ error }`.

## Petits défauts (non bloquants)
1. **Dossier `mixte` à financeur non-OPCO** (`consommation-opco.ts:82`) : `financeurNom = "France Travail"`
   → `suggererOpco` rend `null` → repli sur l'OPCO du client → le montant est compté à l'OPCO.
   Sur-compte (côté prudent), à documenter ou à exclure.
2. **Repli sur la validité (+30 j)** : un devis du 15/12 sans date de session lit le barème et la
   consommation de **N+1** (consommé 0, enveloppe pleine), alors que la session tombe souvent en N.
   Conforme à la consigne (5), mais c'est le seul cas où l'estimation penche vers le **trop**.
   Suggestion : rendre le champ « Début prévu » plus visible quand une consommation existe.
3. Libellé : « X € déjà pris en charge » inclut les demandes `envoye` ; le détail entre parenthèses
   corrige, mais « déjà engagé ou demandé » serait plus juste (console seulement).
4. `page.tsx:602` affiche le bouton INSEE pour un effectif ancien sans source ; le clic répond
   « saisi à la main » — cohérent avec la garde, mais le bouton ne peut alors rien faire.
5. Si `logQualiopiActivity` échoue après une écriture INSEE à la création, l'écriture reste sans trace
   (exception avalée par le `.catch`).
6. Sous le stub Prisma, `findMany` rend `[]` → consommation `{0,0}` et non `null` (inoffensif :
   aucun appel au build, et 0 déduit = comportement antérieur), contrairement à ce que dit l'en-tête.
7. La création d'un client avec SIREN prend jusqu'à 3 s de plus (assumé au rapport).

## Verdicts
- **EXACTITUDE : `refuse`** — `src/server/actions/qualiopi/devis.ts:141` (validation de forme seule)
  → `devis.ts:229` : `dateDebutSessionPrevue = "2026-13-01"` fait lever `RangeError` dans
  `createDevisAction` ; dates impossibles ou hors bornes acceptées (an 1 → année NaN). Le reste
  (table INSEE, garde de saisie, consommation, enveloppe ≥ 0, comportement antérieur) est juste.
- **SÉCURITÉ : `accepte`** — appel borné à 3 s, SIREN validé avant l'URL, aucune donnée personnelle,
  jamais au rendu ni au build, création du client jamais bloquée, actions gardées par `requireAdminWrite`.
