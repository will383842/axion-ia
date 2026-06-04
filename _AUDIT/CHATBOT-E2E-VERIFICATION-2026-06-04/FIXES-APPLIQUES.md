# FIXES APPLIQUÉS — chatbot (branche feat/chatbot-core, NON poussée)

7 commits atomiques, baseline `eb161f18` → HEAD `607814ef`. Aucun `git push` (Will pousse). Chaque commit passe le pre-commit (typecheck + anti-siren/hex/use-client).

| sha | type | objet |
|-----|------|-------|
| `ba4c7818` | test | harnais integration driver SSE + chargement env vitest |
| `b0270cf1` | **fix D-1** | repli FTS-seul quand embedding stub (anti pollution vecteur) |
| `a2fb0d24` | **fix D-2** | un raffinement de slot ne déclenche pas un decline de liens |
| `7e504815` | test | integration robustesse + admin runtime + RGPD + capture |
| `593c9fb0` | test | corpus sécurité prompt-guard + output-guard + XSS |
| `ad4b6ef3` | test | cost-guard T-30 sur DB+Redis réels |
| `607814ef` | **fix D-3** | cache sémantique désactivé si embedding stub (anti faux-hit) |

---

## D-1 — Pollution stub-vecteur du retrieval (🔴→✅) — `b0270cf1`

**Fichier** : `src/server/chatbot/retrieval/hybrid-search.ts`.

**Symptôme (reproduit)** : sans `VOYAGE_API_KEY`, `generateEmbedding()` (lib partagée) renvoie un vecteur **STUB** (hash sha-256) au lieu de throw. `hybridSearch` ne faisait son repli FTS que sur throw → il lançait `vectorSearch` avec un vecteur-requête factice contre les vrais embeddings des 595 chunks.
- **Avant** : requête charabia `"zzqq xkcd wpfm vbnt …"` → **8 résultats** (voisins aberrants du stub) mélangés via RRF avec FTS.
- **Après** : **0 résultat** (FTS ne matche rien, vecteur sauté).

**Correctif** : détection du stub via `embed.modelVersion.endsWith("-stub")` (signal déjà émis par `embeddings.ts:65`) → bascule FTS-seul, conforme à l'intention documentée « repli FTS seul si embeddings indisponibles ». **Prod inchangée** (clé présente → vrai Voyage).

**Non-régression** : `hybrid-search.test.ts` (4 unit) verts ; `retrieval.test.ts` (3 integration) verts.

---

## D-2 — Raffinement de slot traité comme decline (🔴→✅) — `a2fb0d24`

**Fichier** : `src/server/chatbot/orchestrator.ts`.

**Symptôme (reproduit)** : `detectLinkSignal` (`link-flow.ts:43`) classe tout message commençant par « plutôt/plutot » comme **decline**. En état `linkState=proposed`, le tour S12 « **plutôt** en présentiel » (raffinement de critère) était traité comme un « non » → reset de recherche, réponse « Pas de souci. Dites-moi ce que vous cherchez » et perte du fil.

**Correctif** : `const refinesSearch = Object.keys(extractSlots(message).slots).length > 0;` — si le message apporte un nouveau critère, c'est un raffinement (re-recherche), pas une réponse oui/non. Appliqué aux branches confirm ET decline de l'état `proposed`. La confirmation pure (« oui », « envoie ») reste intacte.

**Avant** : tour 2 → message de decline. **Après** : tour 2 → re-recherche offres formation (présentiel appliqué). Vérifié dans `CONVERSATIONS-REELLES.md` §S12.

**Non-régression** : `orchestrator.test.ts` + `link-flow.test.ts` (23 unit) verts.

---

## D-3 — Faux-hit possible du cache sur embedding stub (🔴→✅) — `607814ef`

**Fichier** : `src/server/chatbot/semantic-cache/cache.ts`.

**Symptôme (analyse)** : parallèle à D-1 — `embedToLiteral` utilisait le vecteur stub sans clé. Un vecteur-stub n'a aucune sémantique ; deux questions différentes pourraient (faible probabilité, non nulle) dépasser le seuil de similarité et **servir une mauvaise réponse cachée** (risque de correction sortie/hallucination indirecte).

**Correctif** : `if (embed.modelVersion?.endsWith("-stub")) return null;` → cache no-op sans vrai provider (toujours miss). Cohérent avec D-1. **Prod inchangée**. `?.` toléré par le mock de test (sans `modelVersion`).

**Non-régression** : `cache.test.ts` (7 unit) verts.

---

## Note — pas de fix hors périmètre

Les 2 erreurs lint pré-existantes (`scripts/curate-sites-web-unsplash.mjs`, `SitesWebCtaBlock.tsx`) et le test integration pré-existant rouge (`server-actions.test.ts`, pricing booking) sont **HORS périmètre chatbot** (§0.5) → **non corrigés**, documentés dans `RESTE-A-FAIRE.md`.
