# 01 — EXEC SUMMARY WILL — Audit content-gen 2026-05-18 (≤ 2 pages)

> Lecture 5 minutes. Pour comprendre l'état réel de toute la chaîne content-gen.
> Tu n'as rien à lire d'autre si tu veux juste l'essentiel.

---

## 🎯 En une phrase

**Ta plomberie technique est solide (workers, sécurité, monitoring, indexation = 73/100), mais tes contenus sont encore massivement à l'état d'ébauche (62/100).** Le sprint correctif suivant (S+3) doit choisir entre stabiliser ce qui existe et industrialiser la production. La meilleure option est de faire les deux à 50/50 (~24h dev).

## 📊 Verdict chiffré

- **Score global** : **746 / 1200** pour les 12 types de contenu = **62 %** → 🟡 SPRINT CORRECTIF
- **Score infrastructure** : **513 / 700** = **73 %** → 🟡 SOLIDE AVEC GAPS
- **Anti-régression CI** : typecheck ✅ — vitest 1083/1086 (1 snapshot rouge `admin-nav` à fixer 30 sec)

## ✅ Ce qui marche bien (à garder tel quel)

1. **Pipeline publish** robuste (`content-publish-worker`) — DB + IndexNow + revalidate cohérents
2. **Quality gates** 9 étapes (banned phrases, plagiarism, readability, intent, SEO, soft-404, fingerprint, embedding, fact-check)
3. **Soft-404 gate** P1-5 livré matin testé (10 tests verts)
4. **Dedup topic-fingerprint** P1-6 livré matin testé (13 tests verts)
5. **Audit log SOC2** P1-9 livré + câblé writeContentGenConfig
6. **Indexation discovery** complète : robots.txt + 15-17 sitemaps + llms.txt + ai.txt + security.txt + IndexNow + GSC API + Bing WMT
7. **Workers BullMQ** retry policies + kill-switch sur 14/16 workers + Telegram alerts câblés
8. **Sentry + WebVitalSample p75 CrUX** opérationnels
9. **Cost ledger** atomique avec caps mensuels par provider
10. **4e verticale `un-a-un`** Sprint S+2 livrée 2026-05-18 (4 routes + Footer + mega-menu)

## ⚠️ Ce qui manque (gaps majeurs)

### 5 problèmes P0 (bloquants ou prioritaires)

1. **`/settings/providers`** sécurité nue : `updateProvider` + `resetProviderSpend` écrivent direct DB sans rate-limit ni audit log → chokepoint financier (clés API, caps). **Fix 1h.**
2. **Snapshot test `admin-nav`** rouge baseline CI (36→37 attendu). **Fix 30 secondes.**
3. **Type "par-fonction" 100 % inexistant** : 0 route, 0 data, 0 generator sur les 32 pages annoncées. **Décision business : garder ou supprimer.**
4. **`/guides/page.tsx` inexistant** : ton generator `guide-pilier` produit du contenu pour personne. **4h pour créer le hub.**
5. **Centre d'aide bug silencieux** : tu peux créer 100 articles admin, aucun n'apparaîtra en prod (admin écrit DB, public lit hardcode). **6h pour réparer.**

### 1 chiffre brutal sur les villes

**Tu as 1 ville Tier-1 (Paris) sur 2 157 villes data chargées (≥ 5 000 hab) = 0.05 % de couverture.** Les autres 2 156 sortent en stub noindex (anti-doorway HCU correct, mais SEO local quasi-nul). Pour atteindre la cible canonique de 50 villes Tier-1 × 4 verticales = 200 pages gold, il faut investir :

- ~1 200 € si LLM-only Manon
- ~5 600 € si hybride LLM + relecture experte (RECOMMANDÉ)
- ~20 000 € si humain pur

## 🔧 Ce qu'il faut faire ensuite

### Sprint S+3 — Recommandation : mixte 50/50 (~24h dev)

**Partie infra (12h)** :

- Fix snapshot admin-nav (30 sec)
- Sécuriser /settings/providers (1h)
- Câbler `getBlogArticlesByVille()` sur hub ville (30 min) → articles content-gen ENFIN visibles dans pSEO villes
- Patcher coverage.ts bypass rate-limit (15 min)
- Exporter SENTRY_RELEASE CI (30 min)
- Câbler 2 helpers Telegram dormants cost-cap + provider-down (1h)
- Patcher Sentry capture dans 4 workers critiques (4h)
- Tests Playwright `/un-a-un` (1h) + LHCI `/un-a-un` (5 min)
- Yandex Webmaster client (4h)

**Partie contenus (12h)** :

- Hub `/guides` scaffold + sub-sitemap (4h)
- `/glossaire/[slug]` scaffold + ajouter 20 termes prioritaires (4h)
- `/presse/[slug]` scaffold (2h) + brancher 3 communiqués
- Centre d'aide reader unifié pattern glossaire (2h)

### Sprint S+4 (suivant)

- `/stack-ia/[tool]` × 11 outils (8h)
- Si validation Will : 1ère ville Tier-1 hors Paris (Marseille) × 4 verticales = ~8h LLM + relecture

## 🛑 Décisions Will requises AVANT Sprint S+3 (5 questions, 1 heure max)

1. **Type 10 par-fonction** : (A) supprimer / (B) V1 8 pages / (C) V1 complet 32 pages ?
2. **Budget Top 50 villes Tier-1** : (A) LLM 1 200 € / (B) hybride 5 600 € / (C) humain 20 000 € ?
3. **Périmètre Sprint S+3** : (A) infra-only / (B) contenu-only / **(C) mixte 50/50 RECOMMANDÉ** / (D) gros sprint 80h ?
4. **Fix snapshot admin-nav** mini-PR immédiate hors S+3 : oui/non ?
5. **/settings/providers sécurité** fix immédiat S+3 first action : oui/non ?

Cf. `03-STOP-AND-ASK-WILL.md` pour les 13 autres questions (P1/P2 + roadmap).

## 📚 Pour aller plus loin (si tu veux creuser)

- `02-VERDICT-GLOBAL.md` — tableau de scores par type et par cross-cutting + 34 actions priorisées
- `05-VILLES-DEPARTEMENTS-REGIONS.md` — Top 50 villes + 95 dépts + 13 régions + chiffres exacts
- `06-CROISEMENTS-CROSS-CHECKS.md` — 12 contrôles cross-fonctionnels factuels
- `04-FLOW-MASTER-MERMAID.md` — diagrammes flow par type
- `99-ROADMAP-COMPLETION.md` — roadmap 6 mois chiffrée

## 💡 Un dernier point qui n'est pas dans le scope mais que tu dois savoir

Pendant que cet audit tournait (durée ~50 min), un commit `c33a831 fix(admin): handle Server Action POST in authorized callback` a été créé sur main par le compte "Manon" (session Claude Code parallèle). Ce commit modifie `src/auth.config.ts` — hors scope content-gen — donc sans impact sur cet audit. Le HEAD au moment du lancement audit était bien `9c1adaa` comme attendu. Cet écart est noté dans `00-MANIFEST.md`.

---

**Audit content-gen deep V2.0 terminé.** 25 fichiers livrés dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/`. Zéro modification de code, zéro commit, zéro push.

À toi de trancher les 5 décisions ci-dessus, puis je peux générer le prompt Sprint S+3 EXECUTION.

---

**Fin 01-EXEC-SUMMARY-WILL.md (≤ 2 pages).**
