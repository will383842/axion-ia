# 07 — Registre des risques, STOP & ASK Will, et Definition of Done

> Date : 2026-05-29.

---

## 1. Registre des risques

| ID | Risque | Cat. | Prob. | Impact | Mitigation |
|---|---|---|---|---|---|
| **R-CONC** | « ≥ 200 conversations simultanées » irréaliste sur un VPS unique CPX32 8 GB partagé (Postgres+Redis+Next+workers) | Perf/charge | Moyenne | Élevé | Cache sémantique + token-bucket + cheap-first ; mono-instance MVP + scale **vertical** ; container `chatbot` dédié si k6 le montre ; valider par tests de charge avant prod (REQ-059). **Pas d'autoscaling horizontal disponible** sur 1 VPS |
| **R-LAT** | « 1er token < 1,5 s » difficile avec classification+retrieval+rerank+génération en chaîne | Perf | Moyenne | Moyen | Cache sémantique (réponse immédiate), rerank optionnel/repli, modèle léger pour classification, prompt caching ; mesurer en continu |
| **R-COST** | Coût LLM dérape sous trafic (×3-5 prod, retries 429) | Coût | Moyenne | Moyen | cost-cap par tenant (existant), mode économie, budget tokens/réponse, cap retries |
| **R-CB-MEM** | Circuit breaker in-memory ⇒ état non partagé si multi-instance | Tech | Faible (MVP mono) | Moyen | Migrer l'état circuit breaker + token-bucket en **Redis** avant tout passage multi-instance |
| **R-WV** | Widget dégrade Web Vitals (LCP/INP/CLS, First Load JS) ⇒ gate LHCI/size-limit bloque PR | Perf/Web Vitals | Moyenne | Élevé | Île montée à l'idle, chunk async hors First Load, CLS 0 (position fixe), bucket size-limit dédié, `prefers-reduced-motion`. STOP&ASK + ADR si dégradation (AGENTS.md) |
| **R-INJ** | Injection de prompt / jailbreak / exfiltration (system prompt, données tenant, secrets) | Sécurité IA | Élevée | Élevé | prompt-guard + output-guard + cloisonnement contexte + modération ; tests dédiés (doc 08) |
| **R-HALL** | Hallucination de prix/prestation/délai | Qualité | Moyenne | Élevé | Réponse uniquement depuis chunks + seuil de confiance + citation + escalade ; éval ~50 Q/R couplée versioning |
| **R-RGPD** | Conversations = données personnelles non couvertes par purge/effacement | RGPD | Moyenne | Élevé | Étendre gdpr-export/erase + retention-purge à `chat_*` ; consentement explicite ; IP hashées ; **DPA** fournisseurs (Q-DPA) |
| **R-STUB** | Page widget SSG faisant un appel DB casse le build (`stub.invalid`) | Build | Faible | Moyen | API chatbot = routes dynamiques (pas SSG) ; si page SSG, early-exit stub |
| **R-VOY** | Dépendance à Voyage (clé/quota) ; stub embeddings actuel | Tech | Faible | Moyen | Câbler clé Voyage ; fallback OpenAI embeddings (code dedup existe) ; 200 M gratuits |
| **R-TENANT** | Fuite inter-tenant (retrieval/cache non filtrés) | Sécurité/multi-tenant | Faible (MVP 1 tenant) | Élevé | `tenant_id` injecté serveur + filtré partout + tests d'isolation ; cache clé par tenant |
| **R-DRIFT** | Migration chatbot crée un drift Prisma | Tech | Faible | Moyen | Migration additive isolée + migrations_fts manuelles documentées ; zéro drift actuel |
| **R-SCOPE** | Multi-tenant + autoscaling sur-spécifiés gonflent le MVP | Projet | Moyenne | Moyen | MVP single-tenant, scale vertical ; multi-tenant/CDN différés (STOP&ASK Q-TENANT) |

---

## 2. STOP & ASK — décisions à trancher par Will

> Ne pas deviner ces réponses : elles relèvent du business ou d'un arbitrage produit.

| # | Question | Options | Reco par défaut |
|---|---|---|---|
| **Q-STACK** | Confirmer le module monorepo (pas de repo séparé malgré v3.0 §5) ? | a) Module monorepo (ADR-CB-01) · b) Service Node dédié dès le MVP · c) Repo séparé | **a** |
| **Q-TENANT** | MVP single-tenant (Axion-IA) puis multi-tenant plus tard, ou multi-tenant d'emblée (Ulixai imminent) ? | a) Single-tenant MVP · b) Multi-tenant d'emblée | **a** |
| **Q-WIDGET** | Widget île React (MVP) ou bundle standalone CDN d'emblée ? | a) Île React (ADR-CB-08) · b) Bundle CDN | **a** (b si Ulixai imminent) |
| **Q-LLM** | Palier qualité/coût de génération ? | a) Cheap-first Gemini (~60 $) · b) Mix Gemini+Haiku (~120-185 $) · c) Haiku/Sonnet qualité | ✅ **RÉSOLU 2026-05-29 : SANS Gemini** — Haiku (volume) + Sonnet (complexe), cap ~150 $/mois |
| **Q-EMB** | Confirmer Voyage managé (clé à fournir) vs OpenAI embeddings vs auto-héb. ? | a) Voyage (ADR-CB-04) · b) OpenAI 1536 · c) auto-héb. | **a** |
| **Q-RDV** | `proposer_rdv` pointe Calendly existant (pas cal.com) ? | a) Calendly · b) introduire cal.com | **a** |
| **Q-CRM** | Leads dans `Submission` interne (pas de CRM externe) ? | a) Submission interne · b) brancher un CRM externe plus tard | **a** |
| **Q-ANALYTICS** | Funnel chatbot sur Plausible (existant), ou ajouter GA4/GTM ? | a) Plausible · b) +GA4/GTM | **a** |
| **Q-DPA** | Signer/vérifier les **DPA + option non-rétention** avec Anthropic/OpenAI/Voyage avant prod (Gemini retiré — non utilisé) | (action juridique) | À faire avant MVP 3 |
| **Q-CONCUR** | Budget pour tenir 200 simultanés : accepter scale vertical (CPX → plus gros) et/ou container dédié si k6 l'exige ? | a) Scale vertical OK · b) plafonner la cible (ex. 50 simult.) · c) statu quo + cache agressif | **a/c** |
| **Q-SEUILS** | Valeurs de départ : seuil confiance RAG, seuil cache sémantique, curseur conversion | (réglages tenant) | seuils prudents, ajustés à l'éval |
| **Q-MVP1** | Périmètre exact MVP 1 (socle RAG sans tools vs avec escalade) ? | a) Socle pur · b) +escalade | **a** |

---

## 3. Definition of Done (adaptée du §30 v3.0)

- [ ] ≥ 95 % de réponses correctes sur l'éval ~50 Q/R ; **0 invention** en revue.
- [ ] Les 5 tools fonctionnent et sont appelés à bon escient ; **`capturer_lead` idempotent** (pas de doublon `Submission`).
- [ ] Escalade → email équipe + Telegram + `ChatEscalation` créée ; lead visible dans l'admin (`Submission`) ; **RDV Calendly** de bout en bout.
- [ ] Widget : streame token-par-token, gère les erreurs sans perte de saisie, responsive (plein écran mobile/bulle desktop), **hors First Load JS**, **CLS = 0**, WCAG AA, mention « vous dialoguez avec une IA ».
- [ ] **Web Vitals** : gates LHCI + size-limit verts avec widget actif.
- [ ] **Consentement RGPD** avant capture ; export/effacement/purge opérationnels sur `chat_*` ; IP hashées ; UE ; **DPA** en place.
- [ ] **Sécurité IA** : anti-injection/jailbreak/exfiltration testés ; isolation tenant vérifiée.
- [ ] Mode dégradé validé (jamais d'erreur brute) ; circuit breakers actifs.
- [ ] **Cache sémantique** opérationnel + invalidé à la mise à jour du knowledge.
- [ ] **Tests de charge k6** : cible de concurrence retenue (Q-CONCUR) tenue ; taux 429 maîtrisé.
- [ ] Service **stateless** (état DB+Redis) ; token-bucket + backpressure en place.
- [ ] Anti-abus (Turnstile + rate-limit) actif.
- [ ] Sentry (request-id) + Plausible funnel + métriques DB ; backups quotidiens + restauration testée.
- [ ] Rollback knowledge & prompt fonctionnels ; éval couplée au versioning.
- [ ] **Garde-fous de coût** : cost-cap tenant + alertes 80/100 % + mode économie.
- [ ] **Console** complète (tenants, knowledge, conversations, leads, escalades, prompt, cache, éval, métriques, coûts, réglages).
- [ ] **Feature flag + kill-switch** vérifiés (activation/désactivation par tenant/page sans redeploy code).
- [ ] Latence : 1er token < 1,5 s / réponse < 6 s, y compris sous charge (mesuré).

*Fin du registre des risques et questions.*
