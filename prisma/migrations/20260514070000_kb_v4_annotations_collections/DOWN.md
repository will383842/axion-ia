# DOWN — kb_v4_annotations_collections (2026-05-14)

Dernière migration du bundle KB V4 — tables `KbAnnotation` + `KbCollection`
(annotations admin éditoriales + collections taxonomiques KB).

## Doctrine projet

**R22-first** OBLIGATOIRE. Voir `20260513221900_kb_01_init_schema/DOWN.md`.

## Risque

🟡 **Moyen** — annotations admin perdues (effort éditorial). Collections
taxonomiques perdues (mapping FAQ/Glossaire/Guides).

## Note

Si rollback global KB V4 → cette migration **première** à droppée (FK
dependencies vers les autres tables KB V4).
