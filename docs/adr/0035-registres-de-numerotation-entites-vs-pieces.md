# ADR 0035 — Deux registres de numérotation : entités métier et pièces émises

- **Statut** : accepté
- **Date** : 2026-07-26
- **Constats** : V19 (collision d'espace de noms), V20 (`count()+1` au lieu de `max(seq)+1`)
- **Remplace** : le contournement documenté dans `facturation-service.ts` (« #7 »), qui renvoyait l'unification à « un chantier à part »

## Contexte

Deux registres distincts coexistent dans le système et puisaient dans le **même vocabulaire de préfixes** :

1. le registre des **entités métier** — une table, un compteur : `formations.numero`, `training_sessions.numero`, `devis.numero`, `factures_formation.numero`, `clients.numero`, `reclamations.numero`, `audit_missions.numero` ;
2. le registre des **pièces émises** — `documents_generes.numero`, alloué par `generateDocument()` via `DOC_TYPE_TO_NUMBERING`.

Cette table de correspondance projetait 12 types de documents sur la série « formation » et 6 sur « session ». L'unicité de `numero` étant déclarée **table par table**, Postgres ne peut pas exprimer une unicité inter-tables : rien, ni au niveau code ni au niveau base, n'empêchait deux registres d'émettre la même chaîne.

### Ce qui a été constaté en production (SELECT du 2026-07-26)

Sept numéros portent chacun **deux pièces sans rapport** :

- `AXI-FORM-2026-001` — formation « IA Express » / document `livret_accueil`
- `AXI-FORM-2026-002` — formation « L'Art du Prompt (Niveau 2) » / document `livret_accueil`
- `AXI-FORM-2026-003` — formation « IA & Sécurité » / document `cv_formateur`
- `AXI-SESS-2026-001` — session de formation / document `emargement`
- `AXI-SESS-2026-002` — session de formation / document `satisfaction`
- `AXI-DEV-2026-001` — devis / PDF de devis
- `AXI-DEV-2026-002` — devis / PDF de devis

À la demande d'audit « produisez la pièce `AXI-FORM-2026-001` », le système renvoie deux objets. Un registre dont la clé n'est pas discriminante est une non-conformité de traçabilité à lui seul.

## Décision

### 1. Les deux registres ont des espaces de noms disjoints

Le registre des pièces émises reçoit sa **propre série** `AXI-DOC-YYYY-NNN`. Seules trois séries documentaires conservent un préfixe propre — `AXI-ATT` (attestation, attestation partielle) et `AXI-CERT` (certificat de réalisation) — parce que leur numéro est **imprimé sur la pièce remise au tiers** et vérifié par QR, et que `documents_generes` en est l'unique propriétaire.

Les 22 autres types passent à `AXI-DOC`. En particulier `facture`, `devis` et `avoir` : le PDF imprime déjà le numéro **comptable** de l'entité ; leur numéro `DocumentGenere` n'est qu'une cote de classement interne. Le faire ressembler à un numéro de facture était précisément le piège — une pièce classée `AXI-FACT-…` introuvable dans les livres, c'est un refus au contrôle.

La disjonction est déclarée dans `numbering/formats.ts` (`ENTITY_REGISTER_TYPES` / `DOCUMENT_REGISTER_TYPES`), **vérifiée par test**, et le mappage `DOC_TYPE_TO_NUMBERING` est **typé** sur `DOCUMENT_REGISTER_TYPES` : un remappage vers une série métier ne compile plus.

### 2. Un numéro s'alloue par borne haute, jamais par cardinalité

`count(*) + 1` est remplacé par `MAX(séquence) + 1` sur les 18 sites d'allocation (`numbering/allocate.ts`). Motifs, par ordre de gravité :

- un numéro déjà émis ne doit **jamais** être réattribué (CGI, art. 242 nonies A ann. II) ; un `count()` recule dès qu'une pièce disparaît de la série ;
- `withNumberRetry` rejouait une closure **déterministe** : cinq tentatives produisaient le même numéro, l'opération échouait durement, et la création restait bloquée tant que l'état n'avait pas changé ;
- l'allocateur de `actions/qualiopi/financements.ts` comptait toutes les lignes de `factures_formation` par `createdAt`, avoirs `AXI-AVO-*` et brouillons `BROUILLON-<uuid>` compris : il sautait un numéro de la série légale à chaque avoir.

### 3. Aucune renumérotation, aucune migration de données

Les numéros déjà émis ne bougent pas. Les compteurs étant filtrés par préfixe, la nouvelle série documentaire démarre naturellement à `AXI-DOC-2026-001`. Aucune clé R2 n'est orpheline : les sept sites qui reconstruisent une clé lisent `doc.numero` depuis la ligne, aucun ne recalcule le numéro.

### 4. Ancienne numérotation du registre documentaire

Jusqu'au 2026-07-26, le registre documentaire empruntait les préfixes du registre des entités. Relèvent de cette **ancienne numérotation**, et d'elle seule, les 9 lignes de `documents_generes` :

`AXI-FORM-2026-001`, `-002`, `-003` · `AXI-SESS-2026-001`, `-002`, `-003` · `AXI-DEV-2026-001`, `-002` · `AXI-CERT-2026-001`

À partir du 2026-07-26, le registre documentaire utilise `AXI-DOC-YYYY-NNN`, `AXI-ATT-YYYY-NNN` et `AXI-CERT-YYYY-NNN`. Une discontinuité de série est en elle-même un point d'audit : ce paragraphe est la pièce qui l'explique.

### 5. Ce que la présente décision ne ferme PAS — une 8e collision est certaine

Il faut le dire ici plutôt que le découvrir en audit. `documents_generes` porte déjà `AXI-SESS-2026-003` (document `positionnement`), alors que `training_sessions` s'arrête à `AXI-SESS-2026-002`. La **prochaine session créée** recevra donc `AXI-SESS-2026-003` et entrera en collision avec cette pièce : le compteur des sessions lit la table des sessions, et rien dans le code ne peut voir un numéro logé dans un autre registre.

Autrement dit, cet ADR supprime la **cause** de la collision pour toutes les pièces à venir, mais il ne guérit pas l'état hérité, et cet état produira une collision de plus avant de s'éteindre. Le cas ne se pose ni pour `AXI-FORM` (formations jusqu'à `-057`, documents à `-003`) ni pour `AXI-DEV` (devis à `-002`, documents à `-002`, et le registre documentaire n'émet plus de `AXI-DEV`).

Seule la branche (A) ci-dessous ferme réellement le constat.

## Décision PENDANTE — sort des 9 tirages antérieurs

Les 9 lignes de `documents_generes` ont toutes `envoye_at IS NULL` et `qr_token IS NULL` (vérifié), aucune n'est référencée par `enrollments.attestation_document_id`, `factures_formation` est vide (0 ligne), et elles datent du 2026-07-08 au 2026-07-26 — la fenêtre des sessions d'audit. **Rien n'établit qu'une seule pièce ait été remise à un tiers.**

Deux branches, à trancher par Will :

- **(A) purge — recommandée.** Si aucune n'a été transmise, supprimer les 9 lignes et leurs objets R2. Les deux registres repartent propres, les 7 collisions disparaissent, la 8e (section 5) n'a pas lieu, et le constat est **clos** au lieu d'être « documenté ». La section 4 et la section 5 deviennent caduques ; le reste de l'ADR reste valable.
- **(B) conservation.** Sinon, les 9 lignes restent en base à titre d'archive, la section 4 fait foi devant l'auditeur, et la collision annoncée en section 5 devra être expliquée le jour où elle se produira.

Ne pas trancher à sa place : un registre de pièces **réellement émises** est immuable, mais l'immuabilité de tirages de test internes n'est pas démontrée.

## Conséquences

- Les documents générés à partir du déploiement portent `AXI-DOC-YYYY-NNN` là où ils portaient `AXI-FORM-…` / `AXI-SESS-…`. Un dossier de session archivé à cheval sur la bascule mêlera les deux formats — d'où la section 4.
- La reprise sur `P2002` devient utile au lieu d'être un placebo. Le commentaire « l'unicité `@unique` est le garde-fou final », répété dans six modules, décrivait une garantie inexistante : un index unique protège de la collision concurrente, il est aveugle à la réattribution d'un numéro libéré.
- La suppression d'une pièce ne verrouille plus la création. Elle reste déconseillée : elle creuse un trou dans une série légale, et `onDelete: Restrict` la bloque de toute façon sur `Formation`.
- La série `client` (`AXI-CLI-NNN`, **sans** millésime) est assumée telle quelle : deux numéros sont déjà émis sous ce format. `formatDocumentNumber` refuse désormais d'en fabriquer une variante millésimée, et le validateur officiel accepte enfin la forme réelle.

## Ce qui reste ouvert

Une table `numero_registre(numero UNIQUE, serie, entite_id)`, alimentée dans la même transaction par **tous** les allocateurs. C'est la seule construction qui fermerait à la fois la course concurrente et l'unicité inter-tables. Le présent ADR supprime la cause de la collision ; ce registre la rendrait **impossible**.
