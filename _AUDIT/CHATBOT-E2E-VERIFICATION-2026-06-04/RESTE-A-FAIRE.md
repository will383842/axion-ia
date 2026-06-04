# RESTE À FAIRE — chatbot Axion-IA

## 🔑 P0 — SECRETS à fournir par Will (débloquent le volet LLM)

Sans ces clés, le chemin **déterministe** (offres/RDV/lead/recadrage/injection/prix SSOT) est **100 % prouvé**, mais la **génération RAG narrative** et le **retrieval vectoriel sémantique** restent `⛔ BLOQUÉ-SECRET`.

| Secret | Débloque | Comment relancer après ajout |
|--------|----------|------------------------------|
| `VOYAGE_API_KEY` | embeddings réels (T-04), retrieval vectoriel (T-06 volet vectoriel), rerank (T-10), cache sémantique hit (T-26) | mettre la clé dans `.env`, puis `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/retrieval.test.ts` (le charabia matchera alors via vecteurs réels) |
| `ANTHROPIC_API_KEY` | génération streamée (T-07), classifieur LLM optionnel (T-18), résumé long (T-31), éval scoring (T-24), conversations RAG narratives (S1/S4/S15/S16/S20) | clé dans `.env`, puis rejouer `conversations.test.ts` + lancer l'éval `eval/dataset.ts` ; **surveiller le budget ≤ 2 USD** |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | notif escalade réelle (T-14) + alertes coût 80/100 % (T-30) | clés dans `.env`, déclencher une escalade → vérifier réception Telegram |
| SMTP (déjà Mailhog en dev) | email escalade worker (T-14) | Mailhog UI http://localhost:8025 en dev |

> **Procédure de relance LLM (Phase 6 complète)** : `.env` avec les 2 clés → `pnpm exec vitest run --config vitest.integration.config.ts` → jouer les scénarios `llm:true` ; compter le coût réel via `chat_messages.cout_estime`.

## 🟠 P1 — Gaps fonctionnels (code présent, non câblé runtime)

1. **Tool-calling LLM non câblé** : `tools/registry.ts` (`ToolRegistry`/`chatbotTools`) n'est importé QUE par son test. `qualifier_prospect` (T-13) et `chercher_ressource` (T-13/15) sont implémentés + unit-testés mais **jamais invoqués en conversation** (pas de boucle function-calling dans `generate-stream.ts`). Conséquence : `prospect_profile` n'est jamais rempli par le bot, et aucune ressource (Article/CaseStudy) n'est proposée en conversation. → **Décision Will** : câbler le tool-calling Anthropic (nécessite `ANTHROPIC_API_KEY` pour valider) OU acter que MVP2 reste partiel. `proposer_rdv` (T-15) : l'orchestrateur utilise une constante `/fr/appel` équivalente (OK fonctionnellement).
2. **Dataset d'éval (T-24) à étendre** : `eval/dataset.ts` couvre INTENT_EVAL + GUARD_EVAL (~17-20 items). Viser une couverture des 20 scénarios Phase 6 + pièges (financement, prix SSOT, injection, hors-scope). Scoring réel = `ANTHROPIC_API_KEY`.
3. **Aucun Article/CaseStudy publié en DB dev** → `chercher_ressource` renvoie null (correct, n'invente pas). Pour prouver un hit positif : seeder un article publié FR.

## 🟡 P2 — Améliorations qualité conversationnelle (déterministe, optionnel)

1. **Intent « financement » (S4)** : « finançable OPCO/CPF ? » est actuellement routé vers les offres formation (vertical=formation) sans **disclaimer honnête**. Le bot ne **promet** aucun financement (conforme §0.7), mais ne dit pas explicitement « nous ne gérons pas le financement ». → ajouter un handler déterministe « financement » avec réponse no-promise (wording à valider par Will).
2. **Couverture catalogue audit par effectif (S3/T-36)** : « audit pour 1200 salariés » tombe en repli vers l'offre audit TPE (`/fr/audit/tpe-1-jour`, 1190 € SSOT — pas une hallucination). Vérifier que `offers-catalog.ts` couvre les tranches ETI/grande-entreprise pour l'audit (donnée pricing = décision Will).

## 🧪 Vérifications NON exécutées (coût/infra, hors budget de cette passe)

| Item | Raison | Action |
|------|--------|--------|
| `pnpm build` complet (stub-aware) | ~25 min, 17 629 routes SSG | build-safety établie statiquement (route force-dynamic, widget ssr:false, prisma/redis stub-aware, typecheck vert). Lancer un build complet en CI/local dédié pour confirmer. |
| `pnpm lhci` (Web Vitals widget) | serveur live requis | size-limit ≤ 30 KB gz configuré ; lancer Lighthouse sur une page portant le widget en prod/preview. |
| `k6` charge (T-32) | binaire k6 absent | `scripts/load-test-chatbot.k6.js` prêt ; installer k6 et lancer. |
| Reconnexion SSE mid-stream (widget client) | requiert navigateur Playwright + serveur | `tests/e2e/chatbot.spec.ts` existe (skip si flags off) ; lancer avec `E2E_BASE_URL` + flags. |

## ⚠️ Hors périmètre chatbot (PRÉ-EXISTANT, NON corrigé — §0.5)

- **Lint baseline rouge** : `scripts/curate-sites-web-unsplash.mjs` (UTM unused), `src/components/services/sites-web/SitesWebCtaBlock.tsx` (entité non échappée). 2 erreurs hors chatbot.
- **Test integration rouge pré-existant** : `tests/integration/server-actions.test.ts > getInterventionPriceCents derives correct pricing` — assertion stale (`expected 245000 to be 49000`, dérive vs `pricing.ts`). Hors périmètre. Ce test ne tournait pas avant (la config integration n'avait pas d'env) ; ma config corrigée l'exécute désormais et révèle ce rouge pré-existant. À traiter par l'équipe pricing/booking.

## ✋ Décisions Will (activation prod — hors autopilot)

- Activer le canary : `CHATBOT_ENABLED=true` (route) + `NEXT_PUBLIC_CHATBOT_ENABLED=true` (widget) + `NEXT_PUBLIC_CHATBOT_PAGES` (scope pages). **Non touché en prod** par cet audit.
- Fournir les secrets LLM/Telegram en prod (Coolify env, scope RUN).
- Décider du câblage tool-calling MVP2 (P1.1).
