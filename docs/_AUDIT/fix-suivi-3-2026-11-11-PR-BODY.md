## Résumé
- Cache sémantique : `invalidateStaleCache` compare à la version non décalée et purge aussi la plage décalée par `DECALAGE_VERSION_KB_UNIFIEE` (interrupteur éteint ou allumé). Requête paramétrée, 2 tests.
- Docs : section « Etat au 11/11/2026 » dans `INTEGRATION-PACK-JOURNEE-IA.md`.
- `CONTENT_FIDELITY_CHECK` : non touché (routine X-6a).

Dépend de #1947 (non fusionnée) : à rebaser après sa fusion. Vérifications : `docs/_AUDIT/fix-suivi-3-2026-11-11-VERIFS.md`.
