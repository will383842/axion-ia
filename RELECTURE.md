# Relecture A09 — Lot OPCO A7a « un seul OPCO par client »

Branche relue : `opco/a7a-un-seul-opco` @ `0a214a2c9696c361f59028b166aaa159bbae7889` (diff contre `origin/main`), rapport `rapports/opco-a7a-un-seul-opco:RAPPORT.md`.
Lentilles : **EXACTITUDE** et **SÉCURITÉ (argent : destinataire des factures, payeurs, relances)**. Aucun code de la PR modifié.

Tests lancés (prisma généré sur stub) :
`pnpm vitest run src/server/qualiopi/financements/ src/server/actions/qualiopi/ tests/unit/ci/un-seul-opco-par-client.spec.ts`
→ **111 fichiers, 1 677 tests, tous verts.**

## (1) Même résultat qu'avant quand seul `opcoIdentifie` est renseigné ; bon résultat quand seul `opco` l'est

Vérifié lecteur par lecteur, avec la règle `opcoDuClient` / `nomOpcoDuClient` / `referenceOpcoDuClient` (`opco-referentiel.ts:70-94`) :

| Lecteur | Seul `opcoIdentifie` (slug reconnu / texte libre) | Seul `opco` |
| --- | --- | --- |
| Facture subrogée de session — `destinataire-facture.ts:90` | « Atlas » / texte tel quel : identique | « Atlas » (avant : « OPCO (à préciser) ») |
| Facture inter — `factures-inter.ts:179-182` | payeur d'abord puis client de session, identique ; seul écart : aucun OPCO → « OPCO (à préciser) » au lieu de « OPCO » (annoncé au rapport) | correct |
| Payeur OPCO du dossier — `dossier-payeurs.ts:143-148` | clé `opco:<slug>` et nom identiques (deux entreprises du même OPCO restent UN débiteur) | clé `opco:<id typé>` |
| Financeur à la création du dossier — `dossier-financement.ts:493-494` | identique | posé (avant : absent) |
| Relance — `relance-destinataire.ts:108` | identique (ordre : dossier → client → `destinataireNom` figé inchangé) | correct |
| Convention tripartite — `producteurs.ts:431` | identique | correct |
| Estimation devis — `devis.ts:197` | slug reconnu : identique ; texte libre non reconnu : avant passé à `resolveBaremeOpco`, qui ne trouvait rien → repli « réglage par défaut » ; après, pas d'OPCO → même repli. **Même chiffre.** | correct |
| `aucun_bareme_opco` — `evaluateur.ts:3177` | identique (texte libre lève toujours l'alerte) | lève désormais l'alerte |
| Régime, état des fonds, `delai_facturation_opco` | identique pour un slug reconnu | correct |

Aucun `select` ne prend `opcoIdentifie` sans `opco` (contrôlé par grep sur tout `src/`) : aucune lecture ne reçoit un objet tronqué.

**Accepté.** Seul écart non annoncé (petit, cf. § petits défauts) : un `opcoIdentifie` entouré d'espaces.

## (2) Les deux champs renseignés et divergents : l'OPCO typé prime

- **Facture déjà émise : le destinataire NE change PAS.** `destinataireNom` est figé en base à l'émission (`facture-formation-emission.ts:528`, `facturation-service.ts:207`, `factures-inter.ts:262`) ; aucune relecture ultérieure ne le réécrit.
- **Dossier déjà déposé : inchangé.** `financeurNom` n'est posé qu'à la création (`dossier-financement.ts:493`) et la relance le préfère à tout (`relance-destinataire.ts:100-101`).
- **Convention tripartite** : seule une pièce NOUVELLEMENT produite prend le nouvel OPCO ; les versions archivées ne bougent pas.
- **Relance d'une facture SANS dossier : le libellé peut changer.** `nomFinanceur` lit l'OPCO *actuel* du client avant le `destinataireNom` figé (`relance-destinataire.ts:108` puis `:113`). Si l'admin pose un OPCO typé différent du texte inféré, une facture émise « à Atlas » sera relancée avec « Facture libellée à Akto » dans la précision et dans le message d'empêchement. **Pas de mauvais débiteur automatique** : l'e-mail ne vient QUE du dossier (`:146-150`), jamais du client ni de l'OPCO — sans dossier il est `null` et l'admin doit saisir l'adresse. L'ordre « client d'abord » préexiste à la PR (il valait déjà quand `opcoIdentifie` était corrigé) ; la PR élargit seulement les cas où il diverge. → **Petit défaut n° 1**, non bloquant.

**Accepté**, avec la réserve ci-dessus.

## (3) Migration `20261004130000_opco_client_repris_de_opco_identifie`

- Un seul `UPDATE "clients" SET "opco" = "opco_identifie"::"Opco" WHERE "opco" IS NULL AND "opco_identifie" IN (…11…)`.
- Noms vérifiés contre `schema.prisma` : table `clients` (`@@map`), colonnes `opco` (`:5008`) et `opco_identifie` (`:5001`), enum `Opco` (`:8646-8658`) — les 11 littéraux sont **exactement** les 11 valeurs de l'enum ; le cast ne peut donc pas échouer (le `IN` filtre avant le cast).
- Idempotente (second passage : 0 ligne), ne touche que `opco` NULL, aucun autre champ, aucun DDL.
- Horodatage postérieur à la dernière migration de `main` (`20261004110000_etat_fonds_opco`).

**Accepté.** Note : l'`UPDATE` SQL ne passe pas par `emettreFaitClient` (pas de fait Partners) ni par `updated_at` — sans effet tant que Partners ne porte pas `opco` (manque 6 du rapport).

## (4) L'inférence n'écrase jamais une saisie

- Création (`clients.ts:286-287`) : le schéma de création n'accepte pas `opco` ; l'OPCO typé n'est posé que si `opcoIdentifie` n'a PAS été saisi et que l'inférence rend un des 11.
- Édition (`clients.ts:471-473`, `:531-532`) : posé seulement si `fields.opco === undefined` ET `actuel.opco == null` ET l'inférence a tourné. Une saisie dans la même charge (y compris `opco: null`, effacement explicite) court-circuite l'inférence. Texte saisi → pas d'inférence.
- Fenêtre TOCTOU étroite : `actuel` est lu hors de la transaction (`:456`) ; une saisie de l'OPCO typé par un autre onglet entre la lecture et l'`update` serait écrasée. Préexistant pour `opcoIdentifie`. → **Petit défaut n° 2**.

**Accepté.**

## (5) Garde d'architecture `tests/unit/ci/un-seul-opco-par-client.spec.ts`

Juste sur ce qu'elle annonce (accès `.opcoIdentifie`, `?.` compris, commentaires exclus, liste fermée, test de place morte). Faux négatifs connus, aucun ne masque un lecteur fautif aujourd'hui :
- **déstructuration** (`{ opcoIdentifie }`) et accès `["opcoIdentifie"]` invisibles — c'est le cas de `ClientBrancheForm.tsx:54,67`, légitime (formulaire d'édition) ;
- **sens inverse non gardé** : une brique qui lirait `client.opco` seul (l'aveuglement que le lot ferme, côté anciennes fiches) ne serait pas détectée. Grep actuel : seuls `opco-referentiel.ts:71` et `opco-suggestion.ts:46` le font, légitimement. → **Petit défaut n° 3**.

**Acceptée** comme garde de non-régression ; à durcir.

## (6) Fenêtre app/worker

Aucune colonne, valeur d'enum ni forme de job. Le worker (`qualiopi-formation-crons-worker.ts:~1330`) sélectionne les deux champs et passe par la règle unique : pendant l'heure de dissociation, ancien worker (lit `opcoIdentifie`) et nouveau (lit les deux) donnent le même nom tant que les champs ne divergent pas, ce qui est le cas de toute fiche migrée. La migration est jouée par l'entrypoint de l'**app** : avant elle, le nouveau worker retombe sur `opcoIdentifie` — même résultat. **Toléré.**

## Petits défauts (non bloquants)

1. **Relance sans dossier** — `relance-destinataire.ts:108` : préférer le `destinataireNom` figé de la facture quand il nomme déjà un OPCO (≠ « OPCO (à préciser) »), et ne lire le client qu'en repli. Ainsi une relance redit toujours le destinataire imprimé sur la facture.
2. **TOCTOU de l'inférence** — `clients.ts:456` : relire `opco` dans la transaction, ou écrire `opco` par `updateMany({ where: { id, opco: null } })`.
3. **Garde à sens unique** — ajouter un motif pour `\.opco\b` lu seul sur un objet client hors `opco-referentiel.ts` / `opco-suggestion.ts`, et le motif de déstructuration.
4. **Espaces autour d'un slug** — `opcoDuClient` ne `trim()` pas : un `opcoIdentifie` « ` atlas ` » donnait « Atlas » à la relance et au payeur (ils trimaient), il donne désormais « atlas ». Les schémas Zod n'empêchent pas les espaces (`min(1)` seulement), donc possible sur une saisie. Corriger par `isOpcoId(client?.opcoIdentifie?.trim())` dans `opcoDuClient`. La migration, elle, ne recopie pas ces lignes (correct, mais elles resteront hors règle typée).
5. Limite déjà annoncée par le rapport, à garder visible : sans colonne d'origine, un OPCO typé posé par l'inférence se fige ; un changement d'IDCC ré-infère le texte mais pas le typé, qui prime — source de divergence future (cf. § 2).

## Verdicts

- **EXACTITUDE : `accepte`**
- **SÉCURITÉ (argent) : `accepte`** — aucune facture émise ni dossier déposé ne change de destinataire ; réserve sur le libellé des relances sans dossier (petit défaut n° 1), sans effet sur l'adresse d'envoi.

---
_Relecture A09 générée par [Claude Code](https://claude.ai/code)_
