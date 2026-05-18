# 03 — STOP & ASK WILL — Décisions ouvertes

> 18 questions structurées en 6 catégories. Réponse Will requise avant Sprint S+3 EXECUTION.
> Légende : 🔴 bloquant Sprint S+3 / 🟠 important / 🟡 nice-to-have.

---

## A. Décisions BUSINESS (5 questions)

### A1. 🔴 Type 10 par-fonction — On garde ou on supprime ?

**Constat** : zéro fichier, zéro route, zéro data, zéro generator. Le prompt l'annonce comme un type à 8 catégories (RH/ventes/marketing/support/compta/juridique/IT/ops) × 4 verticales = 32 pages potentielles.
**Options** :

- **(A) Supprimer du roadmap** : retirer la mention dans les prompts + docs. Recentrer sur villes.
- **(B) Implémenter V1 minimaliste** : 8 pages `/implementation/par-fonction/[slug]` uniquement (la verticale prioritaire), data file hardcodée, JSON-LD Service. Effort ~16h dev.
- **(C) Implémenter V1 complet 32 pages** : 4 verticales × 8 fonctions, Prisma `Function` model dédié. Effort ~40h dev + ~20h copy.
  **Reco** : (A) ou (B). Le ROI pSEO d'une 32-pages-grid sans copy gold standard sera faible.

### A2. 🔴 Top 50 villes Tier-1 — Budget copy humain ?

**Constat** : 1 ville sur 2157 a un copy gold standard (Paris). Cible canonique 50 × 4 verticales = 200 pages gold (FR) + 200 EN si EN ré-ouvert = 400 pages.
**Options chiffrées** :

- **(A) LLM-only Manon** : 50 villes × 4 verticales × ~3 € coût LLM = ~600 € + ~10h relecture Will. **Total ~1 200 €.**
- **(B) Hybride LLM + relecture experte** : ~50 villes × 4 verticales × 30 min relecture interventionniste = 100h × 50 € = ~5 000 €. **Total ~5 600 €.**
- **(C) Humain pur copywriter** : ~50 villes × 4 verticales × 2h = 400h × 50 € = ~20 000 €. **Total ~20 000 €.**
  **Reco** : (B). LLM seul produira du contenu génératif distinctif insuffisant pour 50 villes premium. Le ROI SEO long-terme amortit largement le surcoût.

### A3. 🟠 Sprint S+3 EXECUTION — Périmètre prioritaire ?

**Options** :

- **(A) Stabilisation infra P0+P1** : fix snapshot, /settings/providers sécurité, hub ville mentionedCities, Sentry release, Yandex client. Effort ~24h. Pas de nouveau contenu.
- **(B) Contenus manquants** : /guides hub, /stack-ia/[tool], /presse/[slug], /glossaire/[slug]. Effort ~24h. Pas de sécurité.
- **(C) Mixte 50/50** : 12h infra + 12h contenus. **RECOMMANDÉ** — équilibre risque/visibilité.
- **(D) Sprint long 80h** : tout faire.

### A4. 🟠 Cible d'industrialisation 12 mois ?

**Question** : à fin 2027-05-18 (12 mois), Will vise quel ordre de grandeur ?

- **(A) 200 articles blog + 50 villes Tier-1 + 30 KB entries** = profile "qualité-niche"
- **(B) 1 000 articles blog + 200 villes Tier-1 + 500 KB entries** = profile "scaling-pseo"
- **(C) 5 000 articles + 500 villes Tier-1 + 2 000 KB entries** = profile "domination-marché"
  **Impact effort** : (A) ~6 mois Manon part-time, (B) ~12 mois Manon full-time, (C) ~24 mois équipe 2-3 personnes + LLM heavy budget.

### A5. 🟡 Couverture EN ?

**Constat** : EN désactivé depuis 2026-05-16 via 301 → FR (bug next-intl v4.11 + Next 16.2). Tous les types sont actuellement FR-only en pratique.
**Question** : continuer à investir en EN ou freeze indéfiniment ?

- **(A) Re-activer EN dès fix next-intl** (= continuer à payer translations)
- **(B) Freeze EN long-terme** (= retirer mappings, simplifier code, ~4-6h cleanup)
- **(C) Statu quo** (= laisser dormir, re-activer si besoin business)

---

## B. Décisions SÉCURITÉ (3 questions)

### B1. 🔴 P0 /settings/providers sécurité — Fix immédiat ?

**Constat** : `updateProvider` + `resetProviderSpend` écrivent direct `prisma.providerConfig.update` sans rate-limit ni audit log SOC2. C'est un chokepoint financier nu (caps mensuels, clés API, monthly spend reset).
**Question** : OK pour fix immédiat 1h dev en Sprint S+3 first action ? (PR séparée, isolée.)

### B2. 🟠 Coverage volume DB pour purge tuning ?

**Constat** : retention-purge-worker purge GenerationLog (12 mois), CostLedger (24 mois), WebVitalSample (6 mois). **UNKNOWN** : volume actuel.
**4 SQL à lancer prod par Will** (5 min) :

```sql
SELECT count(*) FROM generation_logs;
SELECT count(*) FROM content_gen_audit_log;
SELECT count(*) FROM cost_ledger;
SELECT count(*) FROM web_vital_samples;
```

**Pourquoi** : si volumes très bas (< 1k rows), la rétention 12 mois est probablement trop courte (lose context historique). Si volumes très hauts (> 1M rows), réduire la rétention.

### B3. 🟡 SENTRY_RELEASE export CI — OK pour patch ?

**Constat** : `NEXT_PUBLIC_SENTRY_RELEASE` n'est jamais exporté par GH Actions → impossible d'attribuer une régression à un commit/release dans Sentry.
**Patch** : ajouter au workflow `deploy-coolify.yml` la ligne `env: NEXT_PUBLIC_SENTRY_RELEASE: ${{ github.sha }}`. Effort 30 min.
**Question** : OK pour patcher en Sprint S+3 ? (Pas de risque, gain immédiat observabilité.)

---

## C. Décisions OPS / INDEXATION (4 questions)

### C1. 🟠 Sitemap soumis à GSC, Bing WMT, Yandex WMT ?

**UNKNOWN — fact-check humain Will requis**. 3 vérifications consoles :

1. Google Search Console → Sitemaps → `https://axion-ia.com/sitemap-index.xml` listé ?
2. Bing Webmaster Tools → Sitemaps → idem ?
3. Yandex Webmaster → Sitemaps → idem ? (compte ouvert ?)

### C2. 🟠 Bing Webmaster + Yandex Webmaster — Comptes ouverts ?

**Constat** : robots.txt allow YandexBot (P1-3 commit `a9d3168`) mais aucun client `yandex-wmt-client.ts` n'existe (vs `bing-wmt-client.ts` qui existe).
**Options** :

- (A) Ouvrir comptes Bing + Yandex + créer client `yandex-wmt-client.ts` (P1-7 effort ~6h)
- (B) Laisser YandexBot crawler via IndexNow Yandex (déjà câblé worker) + ne rien faire côté API direct
- (C) Tout désactiver Yandex (retirer robots.txt allow)

### C3. 🟠 Rotation INDEXNOW_KEY ?

**Constat** : clé publique `public/3a5c32d22b04f1430690cc33eaec6be9.txt` exposée depuis genèse projet. Rotation = créer nouvelle clé + servir ancienne 30j + supprimer ancienne.
**Question** : rotation jamais faite. Politique : tous les 12 mois ? Jamais ?

### C4. 🟡 Coolify deploy débloqué pour cycles content-gen scale ?

**Constat (mémoire 2026-05-18)** : 12+ runs deploy en streak. Cause OOM SSG villes débloquée via env `BUILD_SSG_VILLES_INDEXABLE_ONLY=true`. **Vérifier confirmation pousse OK** depuis dernier audit.

---

## D. Décisions TESTS (3 questions)

### D1. 🔴 Fix snapshot admin-nav 36→37 immédiat ?

**Constat** : `src/lib/admin-nav.test.ts:7` attend `expect(items.length).toBe(36)` mais reçoit 37 depuis ajout Sprint S+2 un-a-un. **Bloque tous PRs CI.**
**Fix** : 30 secondes (1 chiffre à changer). Mais c'est une modification de code → hors mode AUDIT-ONLY.
**Question Will** : OK pour ouvrir une mini-PR fix immédiat hors Sprint S+3 ? Ou attendre Sprint S+3 ?

### D2. 🔴 Ajouter Playwright E2E /un-a-un ?

**Constat** : 4e verticale `un-a-un` Sprint S+2 livrée 2026-05-18 sans filet E2E. Routes `/un-a-un/page.tsx` et `/un-a-un/par-ville/paris/page.tsx` non couvertes.
**Effort** : 1h ajout 2 specs (copier pattern des 3 autres verticales).
**Reco** : OUI, P0.

### D3. 🟡 Ajouter `/un-a-un` + `/un-a-un/par-ville/paris` à LHCI ?

**Constat** : `lighthouserc.json` couvre 18 URLs mais omet la 4e verticale.
**Effort** : 5 min (ajouter 2 lignes).
**Reco** : OUI, P1.

---

## E. Décisions ROADMAP CONTENT (3 questions)

### E1. 🟠 Hub `/guides` — Créer pour amorcer factory ?

**Constat** : `guide-pilier.ts` generator existe et produit du contenu propre (pipeline 2-step outline+sections), mais **/guides/page.tsx n'existe pas** → les guides factory restent orphelins.
**Options** :

- (A) Créer `/guides` hub + sub-sitemap `guides` + JSON-LD ItemList. Effort ~6h.
- (B) Re-router guides vers `/blog/guide-X-y-z` (= traiter comme variant blog). Effort ~2h refactor.
- (C) Désactiver `guide-pilier.ts` generator (= retirer du roadmap). Effort 30 min.

### E2. 🟠 Cas concrets — Migration Prisma Sprint 15 ?

**Constat** : `src/content/case-studies.ts:1` commentaire « Replaced by Prisma in Sprint 15 » mais migration jamais faite. 5 fixtures TS hardcodées.
**Options** :

- (A) Migration Prisma immédiate (P2-5, 12h) + reader unifié comme glossaire
- (B) Statu quo : compléter fixtures TS (champ `geo:` à ajouter au moins)
- (C) Décision différée à 6+ mois (le volume actuel — 5 cas — ne justifie pas migration)

### E3. 🟡 Centre d'aide — Unification reader DB ?

**Constat** : Admin écrit en DB (HelpArticle table), public lit hardcode (`HELP_ARTICLES` dans `src/content/transversal.ts`). **Bug silencieux : Will peut créer 100 articles admin sans qu'aucun apparaisse en prod.**
**Effort fix** : ~6-20h selon ambition (P0-5 reader unifié comme glossaire pattern).
**Reco** : OUI, P0 productivité interne.

---

## F. Méta — Cadence audits

### F1. 🟡 Fréquence audits content-gen ?

**Constat** : 3 audits content-gen en 4 jours (2026-05-15 / 16 / 18). Coûteux en temps Will.
**Options** :

- (A) Audit mensuel rolling (1 audit / mois sur thématique tournante)
- (B) Audit trimestriel deep (1 audit /1200 par trimestre)
- (C) Audit déclenché sur événement (livraison Sprint majeur)
  **Reco** : (B) ou (C). (A) génère trop de bruit.

---

## Récapitulatif — Top 5 décisions Will à prendre AVANT Sprint S+3

| #   | Question                                          | Catégorie | Sévérité | Effort réponse       |
| --- | ------------------------------------------------- | --------- | -------- | -------------------- |
| 1   | Type 10 par-fonction garder/supprimer (A/B/C)     | A1        | 🔴       | 5 min                |
| 2   | Top 50 villes Tier-1 budget copy (A/B/C)          | A2        | 🔴       | 30 min business case |
| 3   | Sprint S+3 périmètre (A/B/C/D)                    | A3        | 🟠       | 15 min               |
| 4   | Fix snapshot admin-nav immédiat oui/non           | D1        | 🔴       | 1 min                |
| 5   | /settings/providers sécurité fix immédiat oui/non | B1        | 🔴       | 1 min                |

---

**Fin 03-STOP-AND-ASK-WILL.md.**
