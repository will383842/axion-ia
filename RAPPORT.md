# RAPPORT — INT-T61-A (contrôle croisé de l'IDCC)

Branche de travail : `opco/int-t61-a-idcc-controle`, créée depuis `origin/opco/int-t60-a-idcc-opco`
(INT-T60-A, PR 1297 pas encore fusionnée : cette branche s'empile dessus). Aucune PR ouverte, rien fusionné.

Tête : voir la fin de ce rapport.

## 1. Fichiers touchés (tous dans les `paths`)

| Fichier | Nature |
| --- | --- |
| `prisma/schema.prisma` | 2 énumérations, 2 modèles, 2 champs de relation sur `Client` (aucune colonne) |
| `prisma/migrations/20261004231500_idcc_controle/migration.sql` | migration ADDITIVE (horodatage réservé) |
| `src/server/qualiopi/financements/idcc-controle.ts` | règle de la part, neuf cas, preuve déclarative, écritures |
| `src/server/qualiopi/financements/__tests__/idcc-controle.spec.ts` | 51 tests |
| `src/server/qualiopi/config/financing.ts` | `SEUIL_CONCORDANCE_IDCC_OPCO_BPS = 9000`, sourcé et daté |

⚠️ **Écart de chemins à signaler à la coordination.** L'entrée `INT-T61-A` de `docs/tasks.json` porte
`"schema": false` et ne liste PAS `axionia/prisma/migrations/`. La consigne de cette séance, elle, liste
`prisma/migrations/` et réserve l'horodatage `20261004231500`. J'ai suivi la consigne : modifier
`schema.prisma` sans migration créerait une dérive schéma/base (Gate D). Si la coordination refuse le
dossier de migration, il faut mettre `tasks.json` à jour (`schema: true` + le chemin), pas retirer la migration.

## 2. Forme retenue

- `enum StatutIdcc { non_renseigne, probable, concordant, anomalie, confirme }` — fermé, forme d'A02.
- `enum PreuveIdccDeclarative { attestation_entreprise, declaration_opco, accord_prise_en_charge_opco }`.
  Le « … » de l'acceptance laissait la liste ouverte ; j'ai ajouté une seule valeur,
  `accord_prise_en_charge_opco` (l'accord de prise en charge de l'OPCO vaut déclaration de
  rattachement). **À valider par A02** ; la retirer avant fusion ne coûte rien. Le bulletin de paie
  n'y est pas et un test l'interdit (D-OPCO-6).
- `ClientIdccControle` (table `client_idcc_controles`, clé `client_id`, cascade) : `statut`, `idcc`
  CHAR(4) (l'IDCC sur lequel le statut a été établi), `preuve_type`, `preuve_auteur_id` (UUID,
  sans clé étrangère, comme `SessionDossierEvenement`), `preuve_le`, `maj_at`.
  **Table à part plutôt que colonnes sur `clients`** : aucune colonne n'est ajoutée à `clients`
  (règle PA-1/PA-2 rappelée dans le schéma), et le cliquet des écrivains de `Client`
  (`scripts/gates/cliquet-ecrivains.ts`) n'est pas concerné. Pas de ligne = `non_renseigne`.
- `ClientIdccControleJournal` (table `client_idcc_controle_journal`) : `id`, `client_id`, `de`,
  `vers`, `preuve_type`, `auteur_id`, `cree_at`. **Aucun contenu** : ni IDCC, ni OPCO, ni texte, ni fichier.
- CHECK (SQL brut, migration) :
  - `client_idcc_controles_idcc_check` : `idcc IS NULL OR idcc ~ '^[0-9]{4}$'` ;
  - `client_idcc_controles_preuve_entiere` : les trois champs de la preuve ensemble ou pas du tout ;
  - `client_idcc_controles_confirme_preuve` : `(statut = 'confirme') = (preuve_type IS NOT NULL AND idcc IS NOT NULL)` ;
  - `client_idcc_controle_journal_change` : `de IS DISTINCT FROM vers` ;
  - `client_idcc_controle_journal_confirme_preuve` : `vers = 'confirme'` ⇒ type de preuve + auteur.
- **Aucun champ de fichier, aucune route** : la preuve reçue passe par un schéma zod `.strict()`
  `{ type, idcc, auteurId }` ; la date est posée par le serveur. Toute clé de plus (`fichier`, `url`…)
  est refusée avant toute écriture.
- Point d'extension : `EntreeControleIdcc.idccSaisi` (brut, normalisé par `normaliserIdcc` de `naf-opco.ts`).
- « rgpd: technique — … » posé sur les deux modèles (garde `les-tables-du-dossier-client-suivent-la-personne`).

## 3. Règle de la part (A02, commentaire 5980505240) et SEUIL

`regleDeLaPart({ opcoSaisi, couples, seuilBps? })` → `IssuePart = "concordant" | "a_confirmer" | "inconnu"` :

- part = `siret_nombre` de l'OPCO saisi / somme des `siret_nombre` de l'IDCC, **même millésime**
  (si la table en mélangeait deux, seul le plus récent compte, rien n'est cumulé) ;
- « concordant » ⇔ `siretOpco × 10 000 ≥ seuil × total`, en **BigInt**, sans division ni flottant ;
- OPCO saisi absent de la table pour l'IDCC → « à confirmer », jamais « concordant » ; aucun OPCO
  saisi → « à confirmer » (rien à juger) ;
- IDCC absent de la table → « inconnu ».

**« à confirmer » et « inconnu » : issues de la fonction, PAS des valeurs d'enum.** L'acceptance fixe
l'enum à cinq valeurs MOT POUR MOT et dit de la règle qu'elle « vit dans INT-T61-A » avec ses trois
issues propres, dont « inconnu » « distinct des deux autres ». Les ajouter à l'enum aurait changé la
forme d'A02. Elles alimentent donc le statut : « à confirmer » → `probable` (cas 5), « inconnu » →
`anomalie` (cas 9) ; « concordant » de la part n'est qu'une des deux conditions du statut `concordant`.

SEUIL : `SEUIL_CONCORDANCE_IDCC_OPCO_BPS = 9000` dans `src/server/qualiopi/config/financing.ts`,
avec la source « arbitrage de la coordination du 2026-10-04, par délégation de Williams, fondé sur la
distribution SIRO de 2026-06 ; « à confirmer » ne bloque rien ». Un seuil hors [1, 10 000] ou non
entier est refusé (RangeError).

## 4. RM-08 — le champ `liste_idcc`

- **Réponse vivante : NON lue.** `curl https://recherche-entreprises.api.gouv.fr/search?q=356000000`
  → `CONNECT tunnel failed, response 403` (proxy de l'environnement) ; WebFetch → `EGRESS_BLOCKED`.
- **Aucune réponse enregistrée dans le dépôt** ne porte `liste_idcc` (recherche dans `src/`, `tests/`,
  `_PROSPECTION-BASE-ENTREPRISES/`, `docs/`, `_AUDIT/` : zéro occurrence ; les fixtures de
  `src/features/dossier-client/recherche-entreprises.ts` ne lisent que `siren`, `nom_complet`, `siege`).
- **Confirmé par la source officielle de l'API** : dépôt public
  `github.com/annuaire-entreprises-data-gouv-fr/search-api`, commit
  `9e85a6d6865070e85a0d1a70af2bac8b3e3778be` (2026-09-30), fichier `app/doc/open-api.yml` :
  - `results[].complements.liste_idcc` — « Liste des conventions collectives de l'unité légale
    (source : Ministère du travail) », `type: array`, `items: string` ;
  - `results[].siege.liste_idcc` et `results[].matching_etablissements[].liste_idcc` — même liste au
    niveau établissement, exemple `[ "0923" ]` ;
  - `app/service/formatters/complements.py` : `liste_idcc = get_field("liste_idcc_unite_legale")` ;
  - test e2e de l'API (`app/tests/e2e_tests/test_api.py`) : `search?id_convention_collective=1090`
    puis `assert "1090" in liste_idcc`.
- Le code lit **`complements.liste_idcc`** (unité légale), normalise sur 4 chiffres, écarte
  l'illisible, rend `null` si le champ est absent (l'API se tait ≠ l'API contredit).
- **Reste à faire hors environnement** : capturer une vraie réponse (`?q=356000000`) depuis un poste
  qui joint l'API, et l'ajouter en fixture. Les témoins actuels sont construits sur la forme de l'OpenAPI.

## 5. Les neuf cas et leurs résultats

⚠️ Le texte du cahier OPCO du 2026-10-02 (§10.1) n'est pas dans le dépôt de coordination
(`requirements.json` le cite « hors dépôt ») : je n'ai pas pu lire SA liste des neuf cas. La table
ci-dessous est ma construction sur les trois témoins imposés (IDCC saisi, `liste_idcc`, NAF) et la
règle de la part ; **elle doit être confrontée au §10.1 par A02 avant fusion.**

Données réelles : couples SIRO 2026-06 (`fixtures/siro-202606-couples-idcc-opco.txt`), échappements écartés.

| Cas | Entrée (témoin) | Statut |
| --- | --- | --- |
| 0 | preuve déclarative pour l'IDCC saisi (même sur une anomalie) | `confirme` |
| 1 | rien saisi, `liste_idcc` vide | `non_renseigne` |
| 2 | rien saisi, `liste_idcc = ["1596"]` | `probable` (1596 PROPOSÉ, jamais saisi) |
| 3 | rien saisi, `liste_idcc = ["1486","1596"]` | `non_renseigne` |
| 4 | 1596 + CONSTRUCTYS, publié | `concordant` (part 274 837 / 274 838) |
| 5 | 8822 + AKTO, publié | `probable` (part 7 781 bp < 9 000) |
| 6 | 1596 + CONSTRUCTYS, rien publié, NAF 4120A (CONSTRUCTYS, dans la table) | `probable` |
| 7 | 1596, rien publié, NAF 6201Z (ATLAS, hors table pour 1596) | `anomalie` |
| 8 | 1596 saisi, `liste_idcc = ["1486"]` | `anomalie` |
| 9 | 1234 saisi (absent de la table, même publié) ; ou saisie illisible | `anomalie` (part « inconnu ») |

Principe : `concordant` exige DEUX accords (l'API confirme l'IDCC, la table confirme l'OPCO) ; le NAF ne
fait jamais monter un statut, il ne signale une contradiction que quand l'API se tait ; une preuve pour un
AUTRE IDCC que celui saisi tombe (la saisie a changé) et ses champs sont effacés à l'enregistrement suivant.

Témoins imposés, tous verts : 1596 + CONSTRUCTYS → concordant ; 1596 + OPCO EP → à confirmer ;
part de 8 999 bp → à confirmer, 9 000 bp pile → concordant (et 9 000 bp au seuil 9 001 → à confirmer) ;
8822 : AKTO à confirmer (77,8 %), OCAPIAT à confirmer. En plus : grands comptes (2 700 000 001 /
3 000 000 001) sans erreur d'arrondi.

## 6. Tests et contrôles lancés

- `prisma validate` : schéma valide.
- `vitest run src/server/qualiopi/financements/__tests__/idcc-controle.spec.ts` : **51 tests, 51 verts**.
- Mutation : `>=` → `>` dans la comparaison au seuil → **1 test rouge** (« seuil pile → concordant »), rétabli.
- Voisins : `idcc-import.spec.ts` (31), `naf-opco.spec.ts` (39), `consommation-opco.spec.ts` (12),
  `le-pdf-vient-apres-le-create.spec.ts` (4), et les gardes `tests/unit/ci/` sur le schéma et le SQL brut
  (`les-tables-du-dossier-client-suivent-la-personne`, `tout-objet-sql-brut-est-dans-une-migration`,
  `un-objet-sql-brut-redefini-l-est-dans-la-meme-migration`, `tout-check-est-cable`,
  `seul-rgpd-erase-pose-le-drapeau-d-effacement`) : **10 fichiers, 163 tests, tous verts**.
- **Migration jouée sur un vrai PostgreSQL 16** (cluster jetable, table `clients` minimale) : passe ; les
  sept violations attendues sont refusées par le bon CHECK (confirme sans preuve, preuve partielle, preuve
  sur `probable`, IDCC à 3 chiffres, journal `de = vers`, journal vers `confirme` sans auteur, type
  `bulletin_de_paie` refusé par l'enum) ; les deux insertions valides passent ; la suppression du client
  vide les deux tables (cascade).
- SQL de la migration généré par `prisma migrate diff` (ancien → nouveau schéma), puis CHECK ajoutés à la main.
- `eslint` (3 fichiers TS) : propre. `prettier --write` : appliqué. `bash scripts/check-anti-hex.sh` :
  OK, 0 hex. `npx tsx scripts/check-use-client.ts` : OK.
- `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) : **0 erreur** (exit 0). Une première passe avait trouvé 1 erreur dans `idcc-controle.ts` (`exactOptionalPropertyTypes` sur `seuilBps`), corrigée avant le commit.
- Jamais `next build`. Commit poussé avec `--no-verify` (contrôles ci-dessus lancés à la main).

## 7. Hors `paths` : ce qui devrait bouger, NON touché

1. `src/server/actions/qualiopi/clients.ts` — création et mise à jour d'une fiche (l. 317, l. 560-643) :
   appeler `lireCouplesIdcc` + `controlerIdcc` puis `enregistrerControleIdcc` quand `idcc`, `opco` ou
   `nafCode` change ; exposer une action « confirmer l'IDCC » qui appelle `confirmerIdccParPreuve`
   (auteur = l'administrateur de session, jamais pris dans la saisie).
2. Le client de l'API, `src/features/dossier-client/recherche-entreprises.ts` : il ne lit aujourd'hui que
   `siren`/`nom`/`siege` ; il faudra une lecture par SIREN qui rende le résultat brut à
   `listeIdccDuResultat` (délai et cache existants à garder). Hors domaine Qualiopi d'après son en-tête :
   à arbitrer (A02).
3. L'écran Clients (`ClientBrancheForm` et la fiche) : afficher le statut, « probable » tant que ce n'est
   pas `confirme` (micro-copie de UX-P2-17 côté Partners).
4. `src/lib/rgpd-erase.ts` / export art. 15 : rien à faire si le motif « technique » est accepté (les
   tables ne portent rien sur une personne ; cascade à la suppression du client).
5. `docs/tasks.json` (dépôt de coordination) : `schema: true` et `axionia/prisma/migrations/` pour INT-T61-A (cf. § 1).
6. Consommateurs à venir : INT-T62-A (tableau des `anomalie`), INT-T67-A (refus tant que non `confirme`)
   lisent `client_idcc_controles` ; aucun n'existe encore.

## Tête

Branche `opco/int-t61-a-idcc-controle` : **`46037f8c6b2e40255c4bcb86fba74ec6db8b7cb1`** (un commit au-dessus de `origin/opco/int-t60-a-idcc-opco` = `f6e29ce4`).
