# Rapport — Lot OPCO A7a : un seul OPCO par client

Branche de code : `opco/a7a-un-seul-opco` (depuis `origin/main` à `7b7dd14a`, #1279).
Tête : `0a214a2c9696c361f59028b166aaa159bbae7889`. Aucune PR ouverte (à ouvrir par la session qui tient la file).

## Ce qui a été fait

Manque n° 1 de `CRITIQUE.md` : deux champs OPCO client (`opcoIdentifie` texte libre, `opco` typé vide sur les fiches réelles), lecteurs coupés en deux.

1. **Règle unique.** `opco-referentiel.ts` : `opcoDuClient` / `nomOpcoDuClient` (existants) + `referenceOpcoDuClient` (nouveau : identifiant reconnu, sinon texte libre tel quel, sinon `null` — sert de clé de regroupement et à savoir si un OPCO est renseigné même hors des 11).
2. **Lecteurs convertis** (chaque `select` Prisma prend désormais `opco` ET `opcoIdentifie`) :
   - `regime-paiement-session.ts`, `etat-fonds-opco-lecture.ts` (accepte `opcoIdentifie`, les deux pages appelantes passent la fiche entière), `alertes/regle-delai-facturation-opco.ts` ;
   - `actions/qualiopi/devis.ts` (estimation), `alertes/evaluateur.ts` (`aucun_bareme_opco`, volet session ; un texte libre non reconnu lève toujours l'alerte, comme avant) ;
   - `destinataire-facture.ts` (+ `CLIENT_FACTURABLE_SELECT`), `actions/qualiopi/factures-inter.ts`, `dossier-payeurs.ts`, `relance-destinataire.ts` (+ selects de `relance-contexte.ts`, `facturation-hub.ts` et du worker `qualiopi-formation-crons-worker.ts`), `dossier-financement.ts` (nom du financeur à la création), `documents/production/producteurs.ts` (convention tripartite) ;
   - affichage : `qualiopi/clients/[id]/page.tsx`, `qualiopi/clients/page.tsx`, `planning/[type]/[id]/page.tsx` (+ `features/admin-planning/detail.ts`, ajouté à la liste par grep).
   - Déjà conformes, non touchés : dossier prêt à déposer, alerte de dépôt, `documents.ts` (kit).
3. **Migration de données** `20261004130000_opco_client_repris_de_opco_identifie` : un seul `UPDATE "clients" SET "opco" = "opco_identifie"::"Opco" WHERE "opco" IS NULL AND "opco_identifie" IN (<11 slugs>)`. Slugs vérifiés identiques à l'enum `Opco` et à ce qu'émet `inferOpco` — pas de `CASE` nécessaire. Idempotente, aucun autre champ, aucun DROP.
4. **Inférence** (`actions/qualiopi/clients.ts`) : à la création, l'inférence pose aussi `opco` (jamais quand l'OPCO est saisi en texte). À l'édition, `opco` n'est posé que si l'inférence écrit `opcoIdentifie` dans la même charge, que `opco` est vide en base et absent de la charge. `porte-client.ts` : `DonneesFiche` accepte `opco`.
5. **Garde d'architecture** `tests/unit/ci/un-seul-opco-par-client.spec.ts` : aucune lecture `.opcoIdentifie` (commentaires exclus) hors liste fermée et commentée — `opco-referentiel.ts`, `opco-suggestion.ts`, `actions/qualiopi/clients.ts`, `naf-opco.ts` (préventive), `qualiopi/clients/page.tsx` (transmet la valeur éditée au formulaire de saisie). Les tests sont hors périmètre. Plus un test « pas de place morte » dans la liste. Le même fichier lit la migration.

## Fenêtre app/worker

Aucune colonne ni valeur d'énumération ajoutée ; aucune forme de job modifiée. L'ancien champ `opcoIdentifie` reste écrit et lu (par la règle unique) partout. Le worker sélectionne les deux champs : la règle donne le même résultat avant et après la migration de reprise.

## ROUGE → VERT

- ROUGE (commit `81f0ead3`, tests seuls) : **20 échecs / 294 succès** sur les 5 fichiers témoins — régime, état des fonds, alerte de facturation, estimation, `aucun_bareme_opco`, facture subrogée, relance, payeur, inférence typée, migration absente, 6 lecteurs directs hors liste.
- VERT : `pnpm vitest run src/server/qualiopi/ src/server/actions/qualiopi/ tests/unit/ci/ src/components/admin/qualiopi/__tests__/ src/lib/admin-nav.test.ts` + spec du worker + `src/features/admin-planning/` → **629 fichiers, 9 198 tests OK**, après correction d'un test existant qui figeait le `select` de l'alerte de facturation à `{ opco: true }` (attente portée à `{ opco: true, opcoIdentifie: true }`).
- `tsc --noEmit` : 0 erreur. `eslint` et `prettier --check` propres sur tous les fichiers touchés. `next build` non lancé (consigne).

## Limites

- **Pas d'origine « inféré / confirmé » sur `opco`** : une valeur typée posée par l'inférence est ensuite traitée comme une saisie. Si l'IDCC change plus tard, `opcoIdentifie` est ré-inféré mais `opco` garde l'ancien OPCO (et, l'OPCO typé primant, c'est lui qui est lu). « Remettre en inféré » ne vide pas non plus l'OPCO typé. Une colonne d'origine (suggestion de la critique) le résoudrait : lot à part.
- Textes libres non reconnus (« Atlas ? », « Akto / Atlas ») : non migrés, toujours lus tels quels comme nom ; la suggestion de la console reste le chemin.
- Fin de vie de `opcoIdentifie` non décidée (lecture seule puis retrait, en deux PR, cf. règle app/worker).
- `porte-client` : un client apporté par Partners n'arrive toujours qu'avec `opcoIdentifie` (manque 6) ; la règle unique le lit quand même.
- La facture inter-entreprises affiche désormais « OPCO (à préciser) » au lieu de « OPCO » quand aucun OPCO n'est connu (même libellé que la facture de session).
- Phrases « jusqu'à 0 € de reste à charge » / « à 100 % » : non touchées.

## Corps de PR proposé

> **feat(opco) : un seul OPCO par client — règle unique, reprise de données, inférence typée (chantier OPCO A7a)**
>
> Ferme le manque n° 1 de la critique de complétude : les briques récentes lisaient `Client.opco` (vide sur tous les clients existants), les anciennes `Client.opcoIdentifie`.
>
> - Toutes les lectures de l'OPCO d'un client passent par `opcoDuClient` / `nomOpcoDuClient` / `referenceOpcoDuClient` (typé d'abord, texte libre reconnu ensuite) : régime, état des fonds, alertes `delai_facturation_opco` et `aucun_bareme_opco`, estimation du devis, facture subrogée (session et inter), relances, payeurs, financeur du dossier, convention tripartite, fiches client, liste, planning.
> - Migration de données idempotente : `opco` ← `opco_identifie` quand il vaut l'un des 11 identifiants et que `opco` est vide.
> - L'inférence IDCC/NAF pose aussi l'OPCO typé quand il est vide ; une saisie n'est jamais écrasée.
> - Garde d'architecture : aucune nouvelle lecture directe de `.opcoIdentifie` hors d'une liste fermée.
>
> Fenêtre app/worker : aucun contrat modifié, l'ancien champ reste écrit et lu.
> Tests : témoins ROUGES puis VERTS ; gardes qualiopi et `tests/unit/ci` vertes (9 198 tests) ; `tsc` propre.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
>
> https://claude.ai/code/session_013h2xGzWLEztL6tKpEgWb9y

Sha de tête de `opco/a7a-un-seul-opco` : **0a214a2c9696c361f59028b166aaa159bbae7889**
