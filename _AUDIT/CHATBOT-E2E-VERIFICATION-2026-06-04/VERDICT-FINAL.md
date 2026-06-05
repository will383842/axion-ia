# VERDICT FINAL — vérification E2E chatbot Axion-IA

> **MISE À JOUR 2026-06-05** (cf. `ADDENDUM-2026-06-05-OPENAI-MVP2.md`) : après fourniture des secrets, test réel des clés → **Voyage invalide (401), Anthropic 0 crédit, OpenAI OK**. Décisions Will appliquées : génération **OpenAI gpt-4o-mini**, embeddings **OpenAI 1024-dim** (595 chunks ré-embeddés), **tool-calling MVP2 câblé**. Le volet LLM est désormais **PROUVÉ EN RÉEL** (plus BLOQUÉ-SECRET sauf Telegram).
>
> **Nouveau verdict : 🟢 PROD-READY (validé en local, non poussé — décision Will).** Réserves restantes : Telegram absent (notif escalade/alertes coût), KB à ré-ingérer pour la copie « experts », activation canary prod = action Will. Coût LLM réel session : **< 0,02 USD**. Tests : **222 unit + 40 integration (dont RAG OpenAI réel + tool-calling) verts**.
>
> Le verdict 🟡 ci-dessous reflète l'état de la PREMIÈRE passe (sans secrets) ; il est conservé pour traçabilité.

---

## 🟡 PROD-READY sous réserve secrets LLM (PREMIÈRE PASSE — historique)

Le chatbot est **production-ready sur tout son chemin déterministe**, exécuté **réellement** contre une infra **réelle** (Postgres+pgvector, Redis), **sans aucun mock dans le runtime**. Les seules réserves sont les briques **LLM-dépendantes** (génération RAG narrative, embeddings/retrieval vectoriel, rerank) qui exigent `VOYAGE_API_KEY` + `ANTHROPIC_API_KEY` — **absentes** sur cette machine. C'est le cas nominal annoncé (§1.0) : un verdict `🟡 PROD-READY sous réserve secrets` est un **succès**, pas un échec. **Aucun mock n'a été substitué** à un secret manquant.

## Chiffres

| Statut | Nombre |
|--------|--------|
| ✅ PROD-READY PROUVÉ (exécution réelle) | 22 |
| 🟡 OK avec réserve (volet LLM/mesure live ⛔, ou tool-calling non câblé) | 16 |
| 🔴→FIXÉ→REVÉRIFIÉ | 3 (D-1, D-2, D-3) |
| ⛔ BLOQUÉ-SECRET/INFRA explicites | T-04 (Voyage), T-32 (k6) + volets LLM des 🟡 |

- **Tests** : 222 unit chatbot ✅ + 49 integration chatbot ✅ (contre DB+Redis réels) — **271 verts**, 0 échec dans le périmètre.
- **Budget LLM consommé : 0,00 USD** (≤ 2 USD respecté ; aucun appel facturable car clés absentes).
- **7 commits** atomiques sur `feat/chatbot-core`, **0 push** (Will pousse).

## Défauts trouvés & corrigés (par exécution réelle, pas par lecture)

1. **D-1** — sans clé Voyage, le retrieval polluait ses résultats avec un **vecteur-requête factice** (charabia → 8 voisins aberrants). → repli FTS-seul propre. *(`b0270cf1`)*
2. **D-2** — un **raffinement de slot** multi-tours (« plutôt en présentiel ») était traité comme un **decline** → perte du fil. → re-recherche si nouveau critère. *(`a2fb0d24`)*
3. **D-3** — le **cache sémantique** pouvait servir un **faux-hit** sur vecteur stub. → cache no-op sans vrai provider. *(`607814ef`)*

## Ce qui est PROUVÉ en conditions réelles (sans LLM, 0 €)

- Schéma DB + **pgvector HNSW** + **FTS tsvector GIN** réels ; 595 chunks embeddés ; migrations appliquées.
- **Flux SSE** complet (`session→message→cards→rdv→escalate→done`) + **persistance** `chat_messages` (coût/modèle/latence).
- **Retrieval hybride** (FTS réel + isolation `tenant_id`).
- **Catalogue & offres** : prix **SSOT** exacts, urlFR ∈ routes connues, **output-guard zéro-hallucination** appliqué à chaque réponse.
- **Tools déterministes** : `rechercher_offres`, RDV (`/fr/appel`), **`capturer_lead` idempotent même sous concurrence réelle** (race → 1 Submission, source=chatbot, consentement RGPD).
- **Mode dégradé / circuit breaker** (Anthropic throw sans clé → repli RDV+escalade, jamais d'erreur brute).
- **Sécurité** : 8 attaques injection/exfiltration/jailbreak déviées (0 fuite), **XSS-safe** (nœud texte React), **PII** (hash IP), **isolation session**.
- **Console admin** : données réelles, RBAC, noindex, prompt versionné + rollback (effet runtime), réglages répercutés sur le bot, **RGPD export/erase** des `chat_*`.
- **Anti-abus** rate-limit 429 (Redis réel), **cost-guard** cap → mode éco (DB+Redis réels).
- **Plateforme** : `/api/chatbot/*` non cassé par le proxy/i18n, CSP `connect-src 'self'` (SSE OK), kill-switch 503, widget île idle `ssr:false` (size-limit ≤ 30 KB gz).

## Score d'éval

`⛔ BLOQUÉ-SECRET` — le harnais de scoring de `eval/dataset.ts` exige `ANTHROPIC_API_KEY` (et `VOYAGE_API_KEY` pour le retrieval). Dataset présent (INTENT_EVAL + GUARD_EVAL, unit verts). À étendre + exécuter à la fourniture des clés (P1).

## Web Vitals widget

Config présente (size-limit T-08 ≤ 30 KB gz HORS First Load ; `lighthouserc.json`). **Mesure non exécutée** (Lighthouse requiert un serveur live). Code conforme : `next/dynamic ssr:false` + `requestIdleCallback` (île idle, CLS 0 by design), XSS-safe.

## Ce qui reste côté Will

1. **Secrets** : `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY` (cœur LLM), `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (escalade/alertes).
2. **Décision MVP2** : câbler le **tool-calling LLM** (qualifier_prospect / chercher_ressource non invoqués en conversation aujourd'hui).
3. **Activation canary** : `CHATBOT_ENABLED` + `NEXT_PUBLIC_CHATBOT_ENABLED` + `NEXT_PUBLIC_CHATBOT_PAGES` en prod (non touché par cet audit).
4. **Vérifs live** : `pnpm build` complet, `pnpm lhci`, charge k6, E2E Playwright widget (reconnexion SSE).
5. **Hors chatbot** : 2 erreurs lint + 1 test integration pricing rouge **pré-existants** (équipe sites-web/booking).

---

*Le code fait foi. Toute ligne ✅ référence une commande réellement lancée et sa sortie (cf. `RAPPORT-E2E.md`). Aucune brique LLM-dépendante n'est marquée ✅. Infra réelle, zéro mock runtime, budget LLM 0 USD, aucun push.*
