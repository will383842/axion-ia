# A6-12 — RECOMMANDATION FINALE

## Verdict global : 3715/5000 — 🟡 SPRINT CORRECTIF (CONDITIONNEL)

## Top 3 forces actuelles

1. **Architecture technique robuste** (D-Archi ~796/1000) : BullMQ workers stables, lockDuration 120s, Redis INCR atomique, pgvector IVFFlat 3072 dim, promptHash réel (9 generators), saga post-publish — base solide pour scale immédiat sans risque de double publication
2. **Fondations SEO/AEO/GEO posées** (D-Visi ~775/1000) : JSON-LD aiGenerated:true, AiContentDisclaimer sur 100% pages (39 /implantations + blog + guides), AuthorByline E-E-A-T, TOC ArticleTOC, speakable, search_term_string, S+7 glossaryContext + internalLinks — articles publiables et indexables dès aujourd'hui
3. **Qualité éditoriale unifiée** (D-Qual ~748/1000) : brand-voice.ts SSOT, persona Manon 9/9 generators (blog-article wired Sprint A), seuil REJECT 6.0/60, LLM-judge multi-dimensions, factcheck_claims gate <50, H1 gate 8/8 generators — 0 contenu thin publié

## Top 3 gaps à fermer

1. **D-Ops console admin** (593/1000 → cible 900) : CampaignTemplate presets non implémentés en DB (effort 10h Claude), Dashboard pas temps réel SSE (6h), Feedback ArticleFeedback model absent (6h) — gap 307 pts, items les plus rentables en ROI
2. **D-Visi Featured Snippets** (775/1000 → cible 900) : comparison.ts = stub sans prompt tableau, GBP bloqué sans adresse FR, backlinks = 0 action faite — gap 125 pts, effort Will externe requis (adresse 30€/mois + 1 pitch presse/trimestre)
3. **D-Qual KB sectorielle** (748/1000 → cible 900) : 4 verticales restantes sans KB (interventions_formations = plus grosse priorité), prompts partials absents — gap 152 pts, 16h Claude + 2h Will

## Chemin recommandé (3 sprints follow-up)

Sprint A-suite (J0-J30) — "Ops + KB" :

- Items : KB interventions_formations (16h) + CampaignTemplate DB (10h) + Dashboard SSE (6h) + saga P0-10 (3h) + quick wins D-Ops (6h)
- Effort Claude : ~45h autopilot | Effort Will : ~2h (GSC service account JSON)
- Coût : ~$50 dev + $270 génération (2700 articles ×$0.10)
- **Gain pts attendu : +120-150 pts → ~3835-3865/5000**

Sprint B (J31-J60) — "Featured Snippets + Dashboard avancé" :

- Items : comparison.ts Featured Snippets (4h) + Feedback model (6h) + Heatmap (8h) + Logs viewer (5h) + prompts partials (8h)
- Effort Claude : ~35h | Effort Will : ~1h (souscription adresse FR Sedomicilier)
- Coût : ~$40 dev + $900 génération
- **Gain pts attendu : +100-130 pts → ~3935-3995/5000**

Sprint C (J61-J90) — "Compliance check + Scale + GBP" :

- Items : Vérif AI Act J+72 (2h) + GBP après adresse (Will) + Backlinks 1ère action (Will) + Mobile hamburger (1h) + Onboarding (2h)
- Effort Claude : ~10h | Effort Will : ~5h
- Coût : ~$20 dev + $900 génération
- **Gain pts attendu : +80-120 pts → ~4015-4115/5000**

**Atteinte GO ≥ 4500/5000 estimée : J+250 (fin 2026)**

## Décision à prendre Will MAINTENANT

[A] Lancer Sprint A-suite immédiatement (autopilot Claude ~45h) → KB + Ops → +150 pts
[B] Pause 2 semaines observation prod avant follow-up (GSC data)
[C] Accepter score 3715 CONDITIONNEL et passer en exploitation continue (30/j)
[D] Trancher d'abord les 14 décisions D8-D21 puis lancer sprint
[E] Push d'abord commit 023266f9 sur origin/main (git push) puis Sprint A-suite

**Note : commit 023266f9 (Sprint A local) n'est pas encore poussé sur origin/main. Push recommandé avant tout autre sprint.**
