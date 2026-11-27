# feat(equipe): schéma, migration additive et constantes des fiches collaborateurs (D1)

## Quoi

- Quatre modèles Prisma **neufs**, ajoutés en fin de `prisma/schema.prisma` : `TeamMember`, `TeamQuestionnaireInvite`, `TeamQuestionnaireSubmission`, `TeamMemberEvent`.
- Migration additive `20261127130000_team_members` et son `down.sql` (qui s'arrête si une table n'est pas vide).
- Constantes TypeScript dans `src/lib/equipe/donnees/` : catégories, statuts, trois consentements versionnés (publication, photo, LinkedIn), questionnaires v1 avec schémas Zod, et `evaluerIndexabilite` (règle d'indexation calculée, pas stockée).
- Déclarations d'exclusion RGPD pour les trois tables qui portent des données de la personne (`rgpd-dossier-client.ts`, `rgpd-erase.ts`), exigées par la garde du schéma.
- Aucune modification de table existante, aucun enum Postgres, aucune donnée insérée, aucun job BullMQ. Aucun écran ni aucune route ne lit encore ces tables.

## Pourquoi

Poser le socle de données des pages collaborateurs. Le schéma permet l'**effacement réel** d'une personne : supprimer sa fiche supprime en chaîne ses invitations et ses réponses ; le journal garde seulement une ligne sans lien ni donnée personnelle (« demande reçue et traitée le… »).

## Points d'attention

- Pas de clé `Restrict` : rien ne bloque la suppression d'une fiche.
- `TeamMember.slug` est unique en base. L'unicité contre `previousSlugs`, les slugs de profils existants et les slugs réservés reste vérifiée par l'application, en transaction (à écrire dans le lot qui crée les fiches). Prévoir de normaliser le slug en minuscules à l'écriture.
- Index GIN sur `previous_slugs`, index sur les empreintes d'e-mail (garde existante).
- Les textes des trois consentements sont une première version à relire avant tout usage ; aucun écran ne les affiche encore.
- Le futur lot d'effacement devra aussi traiter : fichiers photo (fiche et réponses), variantes publiques et caches, invitations sans fiche (par empreinte d'e-mail), fiche liée à un apporteur effacé, décision sur la preuve dans `ConsentEvent`, et un écrivain unique et validé pour `TeamMemberEvent`.
- La liste de migrations de `tests/unit/ci/contacts-guide-reseau-origine-optionnelle.spec.ts` reçoit une ligne ; conflit possible et trivial avec les PR qui ajoutent aussi une migration.

## Mise en ligne

- Migration **additive** : quatre `CREATE TABLE`, des index et des clés étrangères entre ces seules tables.
- **Compatible avec l'ancien et le nouveau conteneur** : l'ancienne application ignore ces tables ; la nouvelle ne les lit pas encore.
- **Worker non concerné** : il ne lit ni n'écrit ces tables, aucune forme de tâche ni valeur d'énumération n'est ajoutée.
- L'entrypoint de l'application migre avant de servir. Après mise en ligne, vérifier la présence des tables (`prisma migrate status`), car la migration est lancée en best-effort.
- Retour arrière : `down.sql` seulement tant que les tables sont vides ; sinon revert du code, tables laissées.

## Comment vérifier

- `pnpm prisma validate` et `pnpm prisma generate`
- `pnpm tsc --noEmit`, `pnpm lint`, `pnpm format:check`
- `pnpm vitest run src/lib/equipe tests/unit/ci/team-members-migration-additive.spec.ts tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts tests/unit/ci/contacts-guide-reseau-origine-optionnelle.spec.ts tests/unit/ci/toute-empreinte-email-porte-son-index.spec.ts`
- Migration → `down.sql` → migration rejouées sur un Postgres jetable (PGlite, Postgres compilé en WebAssembly) : tables créées, `down.sql` refusé avec une ligne présente, suppression d'une fiche en cascade sur invitations et réponses, journal conservé avec `member_id` à NULL, `down.sql` accepté une fois vide, migration rejouée. Le SQL livré est identique à `prisma migrate diff` depuis le schéma de `main`. Non fait : un `pg_dump` de la production (pas d'accès).

## Relectures

- Opus, lentille données et migration : BON (défauts mineurs corrigés : version de questionnaire héritée de l'objet, vraie photo sans variante publique).
- Opus, auditeur sécurité et données : À CORRIGER au premier tour ; corrigé ici : LinkedIn strict et conditionné à l'accord, prénom d'un seul mot, lieu sans adresse, caractères de direction du texte refusés, consigne d'empreintes (HMAC) dans le schéma, déclarations d'effacement complétées. Restent pour les lots suivants (listés ci-dessus) : écrivain unique du journal, test interdisant les écritures tant que l'effacement n'est pas livré, assainissement Markdown de `bioMd` au rendu.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGdGtv3VwYAA3Wn61C9

VERDICT OPUS : BON
