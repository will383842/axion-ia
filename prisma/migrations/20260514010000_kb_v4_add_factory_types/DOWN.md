# DOWN — kb_v4_add_factory_types (2026-05-14)

Partie du bundle cohérent KB V4 (8 migrations 2026-05-13 → 2026-05-14).
Ajoute les types factory (`KnowledgeEntryFactoryType`) pour distinguer
content-gen sources.

## Doctrine projet

**R22-first** OBLIGATOIRE. Voir `20260513221900_kb_01_init_schema/DOWN.md`
pour la procédure complète bundle KB V4.

## Risque

🟡 **Moyen** — enum value drop nécessite migrer les rows utilisant ces
factory types. Voir pattern enum-drop dans `20260512100000` DOWN.md.

## Note

Si rollback global KB V4 requis → suivre order de rollback documenté dans
`20260513221900_kb_01_init_schema/DOWN.md` § Order de rollback.
