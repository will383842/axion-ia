# PLAN — Assainir, puis instrumenter la chaîne de contenu

**Date** : 2026-07-21 · **Source** : `_AUDIT/AUDIT-BOUCLE-QUALITE-CONTENU-E2E-2026-07-21.md`
**Statut** : en attente d'arbitrage Will. **Aucun lot ne démarre sans GO explicite.**

---

## Principe directeur

La demande initiale était « construire une boucle de mesure de la qualité des pages ». L'audit invalide cet ordre de priorité.

Avec **22 clics Google** sur l'ensemble du site et **49 % du corpus porteur d'un défaut factuel**, instrumenter finement une production défectueuse reviendrait à installer un tableau de bord sur un moteur qui fuit. L'ordre correct est :

> **arrêter l'hémorragie → purger le passif → réparer les instruments → réarmer les garde-fous → relancer → et seulement ensuite, mesurer.**

La panne de crédit OpenAI, loin d'être une urgence à corriger, est une **fenêtre de tir** : elle a arrêté la production sans intervention. Elle doit être utilisée, pas refermée.

**Contrainte respectée dans tout le plan** : aucun abonnement payant, aucun JS client ajouté, aucun budget Web Vitals dégradé.

---

## Ordonnancement

| Lot | Objet | Effort | Dépendance | Coût |
|---|---|---|---|---|
| **0** | Geler la production | 15 min | — | 0 |
| **1** | Purger le passif factuel | 4-6 h | 0 | 0 |
| **2** | Corriger l'indexation | 2-3 h | 1 | 0 |
| **3** | Réparer les instruments | 3-4 h | — (parallélisable) | 0 |
| **4** | Réparer l'analytics | 1 h | 3 | 0 |
| **5** | Entité & AEO | 2 h | — | 0 |
| **6** | Garde-fous avant relance | 1-2 j | 1 | 0 |
| **7** | Relance encadrée | — | 6 | crédit OpenAI |
| **8** | Mesure et boucle d'apprentissage | 3-5 j | 7 + 4 | ~0 |

**Les lots 0 à 6 ne coûtent rien d'autre que du temps.** Le crédit OpenAI n'est nécessaire qu'au lot 7.

---

## LOT 0 — Geler la production

**Objectif mesurable** : aucun job de génération ne peut démarrer, même si le crédit OpenAI est rechargé par inadvertance.

- Activer le kill-switch existant (`ContentGenConfig`, clé `kill_switch`) — le mécanisme est déjà en place et respecté par `content-tier-lifecycle-worker.ts:149-158`.
- **Ne pas recharger le crédit OpenAI** avant le lot 7.
- Vérifier que l'orchestrateur (`*/15 * * * *`) cesse d'enfiler des jobs.

**Vérification prod** : `SELECT count(*) FROM content_gen_jobs WHERE "createdAt" > now() - interval '1 hour'` → 0.
**Rollback** : désactiver le flag.
**Risque** : nul.

---

## LOT 1 — Purger le passif factuel

**Objectif mesurable** : 0 article publié portant un défaut dur détectable par regex ; 0 statistique attribuée à une institution qui ne l'a pas publiée.

### Périmètre exact (comptes vérifiés en base)

| Défaut | Articles | Traitement |
|---|---:|---|
| Token `{{price:...}}` non résolu | 50 | Résoudre via le registre, ou « Sur devis ». **Jamais un prix inventé.** ⚠️ Vérifier **aussi le JSON-LD** : la fuite y est distincte de celle du HTML visible |
| Statistique « 31 % » mal attribuée | 35 | **Suppression pure de la phrase.** Ne pas remplacer par un autre chiffre non sourcé. Conserver les usages réellement sourcés (Syntec Numérique) |
| `alt="text"` | 15 | Générer un alt descriptif |
| Tokens `[lien]` / `[AFNOR]` / `[UNESCO]` | 10 | Suppression |
| « Session 12+ » | 3 | Suppression de la phrase entière |
| Études de cas fabriquées | ≥ 4 | Suppression, ou remplacement par un cas réel documenté |
| « DORA, prévu pour 2025 » | à recompter | Correction (applicable depuis le 17/01/2025) |
| Stat ICF « 5,7× » sur le coaching IA | 1+ | Suppression |
| Bloc « Sources » décoratif (France Compétences / AFNOR / Cnam / UNESCO) | ~68 | Retirer quand aucune des sources n'est citée dans le corps. **Ne rien mettre vaut mieux qu'une source fausse** |

### Méthode
1. Écrire un script de détection **read-only** produisant l'inventaire exact article par article.
2. Soumettre le diff à Will **avant toute écriture**.
3. Appliquer par lots, avec sauvegarde préalable des `body` / `body_text` concernés.
4. Ré-exécuter la détection : doit renvoyer 0.

### Garde-fou à créer dans le même lot
Le contrôle CI existant **ne scanne que les fichiers statiques, jamais la base** — c'est pourquoi le token de prix corrigé le 2026-07-20 est réapparu sur 50 articles. Ajouter un contrôle qui interroge la **DB**.

**Vérification prod** : les 5 requêtes de comptage du §5.1 de l'audit renvoient 0.
**Rollback** : restauration depuis la sauvegarde des colonnes.
**Risque** : modification de contenu publié — d'où la revue de diff obligatoire.

---

## LOT 2 — Corriger l'indexation

**Objectif mesurable** : 0 page indexable sans valeur locale vérifiable ; 0 signal contradictoire envoyé au crawler.

| Action | Volume | Détail |
|---|---:|---|
| Basculer en `tier_2_noindex_follow` les articles géociblés sans ancrage local | 53 | Le mécanisme existe et fonctionne (`indexationTier`). **Désindexer, pas supprimer** — décider ensuite |
| Trancher le sort des pages `<service>/par-ville/<ville>` | 674 | Aujourd'hui `index, follow`, hors sitemap, hors cap. **Décision produit requise** (voir §Arbitrages) |
| Retirer les 357 pages `noindex` du sitemap images T3-T4 | 357 | Signal contradictoire |
| Réintégrer ou supprimer `sitemap-knowledge.xml` | 520 entrées | Route orpheline et vide |
| Corriger les 38 routes 404 marquées indexables | 38 | `site_routes` |
| Réparer la détection `orphan_page` | — | Compte aujourd'hui les liens **sortants** (header inclus) → inopérante. Nécessite un graphe de liens entrants |

**Vérification prod** : `SELECT count(*) FROM articles WHERE indexation_tier = 'tier_1_indexable' AND <sans ancrage local>` → 0.
**Rollback** : le tier est un champ, retour immédiat.
**Risque** : désindexer trop large. Mitigation : critère explicite (voir « règle des trois faits », lot 6).

---

## LOT 3 — Réparer les instruments (coût nul, gain immédiat)

**Objectif mesurable** : plus aucun worker ne « réussit » en ne faisant rien ; toute erreur worker remonte.

1. **Aligner les env du conteneur WORKER sur le WEB** — `OPENAI_EMBEDDINGS_ENABLED`, `EXTERNAL_LINKS_MONITOR_ENABLED`, `PERPLEXITY_API_KEY`. Coolify → scope RUN → **Redeploy** (pas Restart).
2. **Réparer `captureWorkerError`** (`Sentry.captureException is not a function`) — sans cela, tout le reste reste invisible.
3. **Faire échouer bruyamment les no-op** : un worker qui sort sur flag absent doit le signaler, pas retourner `completed` avec des compteurs mensongers (`totalArticlesWithoutEmbedding: 0` alors qu'il y en a 173).
4. **Corriger `providers/openai.ts:63-64`** : distinguer `insufficient_quota` (non-retryable, alerte immédiate) de `rate_limit_exceeded` (retryable), et **conserver `err.message`**. ⚠️ Sans fallback Anthropic (décision Will), OpenAI est un point de défaillance unique : cette alerte devient obligatoire, pas optionnelle.
5. **Ajouter les 14 env manquantes à `.env.example`** — dont les 4 `GSC_OAUTH_*`, seules variables qui alimentent réellement la mesure SEO et aujourd'hui documentées nulle part.
6. Corriger `content-similarity-monitor` (30 échecs, `headers` hors scope) et le rapport hebdo (SMTP `ECONNREFUSED :2525`).
7. Purger les 3 repeat keys Redis orphelines (`prospection-*`, planifiées dans le passé).

**Vérification prod** : `SELECT count(*) FROM articles WHERE embedding IS NOT NULL` > 0 après un cycle nocturne ; une erreur worker provoquée apparaît dans Sentry.
**Rollback** : retirer les env.
**Risque** : faible. Le lancement du backfill d'embeddings a un coût token — voir §Arbitrages.

---

## LOT 4 — Réparer l'analytics (deux bugs, ~1 h)

**Objectif mesurable** : `SELECT count() FROM events_v2 WHERE timestamp > now() - INTERVAL 1 DAY` > 0.

1. Ajouter `ARG` + `ENV NEXT_PUBLIC_PLAUSIBLE_DOMAIN` et `NEXT_PUBLIC_PLAUSIBLE_API_URL` au `Dockerfile` (~l.57-69) **et** les passer en build-args dans `.github/workflows/deploy-coolify.yml`. Ces variables sont inlinées au build : les poser au runtime ne sert à rien.
2. Corriger l'URL du script (`Plausible.tsx:37`) : retirer les extensions **`404.`** et **`.web-vitals`**, qui n'existent pas dans `plausible/community-edition:v3.0.1`.
3. Émettre `source: "direct"` et `page: location.pathname` dans `trackRefererSource` (`tracking.ts:161-162`) — aujourd'hui les `direct` sont jetés, or c'est là que tombe une grande part du trafic LLM (apps natives, `no-referrer`).
4. Étendre `REFERER_PATTERNS` : Copilot M365 (`m365.cloud.microsoft`, `copilot.cloud.microsoft`), Grok, DeepSeek, You, Poe, Kagi.

⚠️ **Les deux bugs sont indépendants — corriger un seul ne suffit pas.**
⚠️ Mettre à jour `docs/runbooks/R18-plausible-events-missing.md` : aucune des trois causes qu'il liste n'était la bonne.

**Vérification prod** : `curl -s https://axion-ia.com/fr | grep -c plausible` > 0, puis événements en ClickHouse sous 24 h.
**Effet Web Vitals** : le script Plausible fait ~1 KB gz, `afterInteractive`. Neutre.

---

## LOT 5 — Entité & AEO (meilleur ratio effort/gain du site)

**Objectif mesurable** : une seule entité `Organization` réconciliée, avec des `sameAs` de registres officiels.

1. Ajouter `"@id": "https://axion-ia.com/#organization"` au nœud `ProfessionalService` — aujourd'hui le nœud le plus visible est le plus pauvre et rien ne le relie à l'entité complète.
2. Harmoniser `ProfessionalService.url` avec le canonical (avec/sans slash final).
3. Enrichir `sameAs` : Google Business Profile, Wikidata, registre public des OF / NDA DREETS, EDOF, SIREN (societe.com / Pappers). **Pour un LLM qui vérifie l'existence légale d'un organisme de formation, ce sont exactement les nœuds attendus.**
4. Compléter `Organization` : `telephone`, `email`, `identifier` (SIREN), `vatID`.
5. Élaguer les **2 157 nœuds `City`** de `/fr/formations/entreprise` — risque de troncature silencieuse qui ferait perdre les `Course`/`Offer`.
6. Retirer `Disallow: /_next/` de robots.txt (ou ajouter `Allow: /_next/static/`) — bloque CSS et JS, risque de rendu documenté par Google.
7. Aligner `ai.txt` sur `robots.txt` (manquent `anthropic-ai`, `ChatGPT-User`, `Perplexity-User`, `Mistral-User`) et documenter `Applebot`.

**⚠️ Ne PAS débloquer `Google-Extended`.** L'audit a infirmé la prémisse : Google documente explicitement que ce token n'affecte ni l'inclusion ni le classement dans Search, et les AI Overviews sont servies depuis l'index Googlebot. Le coût du blocage est proche de zéro. **La note projet qui présentait ce déblocage comme un « fix à 2 lignes » est erronée et doit être corrigée.**

**Arbitrage requis** : `ai-policy.json` déclare `"license": "CC-BY-4.0"`, qui **autorise l'entraînement** — en contradiction frontale avec `"training": { "allowed": false }`.

---

## LOT 6 — Garde-fous avant toute relance

**Objectif mesurable** : aucun article ne peut être publié s'il porte un défaut dur ou une affirmation chiffrée non sourcée.

### Trois règles bloquantes (pas un score sur 100)

1. **Toute affirmation chiffrée doit porter une URL vers la source primaire.** Pas de « selon la DARES » sans lien vers l'étude. Absence de lien ⇒ suppression de la phrase, pas rejet de l'article.
2. **Aucun cas client, même anonymisé, ne passe sans validation humaine explicite.**
3. **Une page ville sans au moins trois faits vérifiables sur cette ville naît en `noindex`.** Critère non arbitraire : c'est ce qui sépare `/formations/par-ville/lyon` (Vallée de la Chimie, H7, Villeurbanne) de `audit-ia-grigny` (rien).

### Détection mécanique en amont de la publication
Les défauts recensés au lot 1 sont **triviaux par regex**. Ils doivent bloquer la publication, pas être découverts trois semaines après.

### Repenser le rôle du score
`qualityScore` est **positivement corrélé aux défauts**. Il ne doit plus autoriser une publication. Le déplacer d'un rôle de **portier** vers un rôle d'**indicateur**.

### Réduire le gaspillage de génération
59 % du budget part dans des articles rédigés en entier puis rejetés. Pistes à évaluer, par ordre d'impact présumé :
- **Vérifier la couverture existante au moment de choisir le sujet** — si une part importante des rejets est du doublon, le fautif est la file de sujets, pas le générateur. `keywords` est figé depuis le 2026-06-16 (1 835 lignes, jamais réalimentées).
- Déplacer dedup et benefit-gate sur le **brief/outline**, avant de payer la rédaction du corps.
- Génération en deux temps : outline avec un modèle bon marché → screening → corps avec le modèle fort.
- Recycler par pivot d'angle plutôt que jeter.
- ❌ Ne pas toucher `judge_thresholds` (`hasP1` court-circuite le seuil) ni `publishMin` : faux leviers connus.

---

## LOT 7 — Relance encadrée

**Objectif mesurable** : reprise à volume réduit, 0 défaut dur sur les nouvelles publications.

- Recharger le crédit OpenAI **uniquement à ce stade**.
- Reprendre à **volume fortement réduit** — l'audit éditorial recommande « un contenu de calibre humain par semaine plutôt que 140 ». Les deux meilleures pages du site (séminaire 1 j, secteur juridique) sont humaines.
- Surveiller sur 2 semaines : taux de défaut dur (cible 0), taux de publication, coût par article publié.

**Décision produit requise** : quel volume cible ? Voir §Arbitrages.

---

## LOT 8 — Mesure et boucle d'apprentissage (différé, assumé)

**Ce lot n'a de sens qu'une fois qu'il y a quelque chose à mesurer.** À 22 clics, une infrastructure de scoring par page serait prématurée.

Quand il se justifiera :

1. **Série temporelle SEO** — table `ArticlePerformanceSnapshot(routeId|articleId, date, clicks, impressions, ctr, position, indexed)`, alimentée quotidiennement pour **toutes les familles de pages**, pas seulement les articles. Sans elle, `content-refresh` et `tier-lifecycle` raisonnent sur un instantané sans mémoire. ⚠️ Tenir compte des limites du worker actuel : troncature top-25, fenêtre 28 j non synchronisée, 400 URLs/jour.
2. **Suivi d'indexation réel** — brancher `gscInspectUrl()` (codée, jamais appelée) sur un champ `gscIndexedAt`. Quota gratuit : 2 000 req/jour, 600/min. Prévoir une stratégie de couverture par priorité, pas un balayage exhaustif.
3. **Attribution business** — renseigner `Submission.referer` (le champ existe, il n'est jamais écrit), ajouter `landingUrl`, lire les cookies `_region` et `_phase` aujourd'hui écrits mais jamais lus.
4. **Score par page sur `SiteRoute`**, toutes familles confondues, avec un signal de succès propre à chaque famille (les pages transactionnelles ne se jugent pas au clic organique).
5. **Dedup sémantique a posteriori** sur le corpus publié — l'index HNSW existe et indexe le vide ; il suffira d'alimenter les embeddings (lot 3).
6. **Ressusciter `content-refresh`** — worker mort (aucun cron, aucun flag, ne mute rien, jamais exécuté une seule fois).

### Politique de retrait — à spécifier avant tout retrait
Supprimer une URL indexée est irréversible. À définir : quand **consolider** vs `noindex` vs **410** vs **301** et vers quelle cible ; délai d'observation minimal (une page de 3 semaines à 0 clic n'est pas morte) ; règle de non-régénération ; plafond de retraits par run ; effet sur sitemaps, IndexNow et maillage interne.

---

## Ce que ce plan choisit de NE PAS faire

| Écarté | Raison |
|---|---|
| Débloquer `Google-Extended` | Prémisse infirmée : coût du blocage ≈ 0 selon la doc Google. |
| Ajouter GA4 / Looker Studio | Plausible self-hosted existe et suffit ; GA4 ajouterait ~45 KB JS contre les budgets Web Vitals et une charge de consentement. |
| Souscrire Ahrefs / Semrush / SerpAPI / Originality.ai | Contrainte « zéro abonnement ». GSC API, PSI, Bing WMT, IndexNow couvrent le besoin gratuitement. |
| Construire la boucle de mesure en premier | 22 clics. Instrumenter avant d'assainir serait un tableau de bord sur un moteur qui fuit. |
| Toucher `judge_thresholds` / `publishMin` | Faux leviers documentés. |
| Supprimer les 53 articles sans ancrage local | Désindexer d'abord, décider ensuite. Le retrait est irréversible. |
| Rétablir un fallback Anthropic | Décision Will (2026-07-21). Conséquence assumée : OpenAI devient un SPOF, d'où l'alerte quota obligatoire au lot 3. |
| Restaurer `content_metrics` en l'état | La table ne porte aucune colonne clics/impressions/position. À redéfinir, pas à remplir. |

---

## Arbitrages requis de Will

1. **Volume cible après relance** — 20/jour, quelques-uns par semaine, ou un contenu humain hebdomadaire ?
2. **Sort des 674 pages `<service>/par-ville/<ville>`** — les capper comme les pages villes, les mettre en sitemap, ou les supprimer ?
3. **Backfill d'embeddings** — coût token du corpus complet (173 articles, faible) vs alternative locale (SimHash/MinHash, BM25 Postgres). Recommandation : lancer le backfill, le corpus est minuscule.
4. **Contradiction de licence** — `CC-BY-4.0` autorise l'entraînement et contredit la politique bots. Changer la licence, ou assumer ?
5. **Les 53 articles désindexés** — les conserver en `noindex, follow` ou les supprimer après observation ?
6. **Purge du passif** — GO pour appliquer le lot 1 après revue de diff ?

---

## Vérification — commandes de re-mesure à l'identique

```bash
curl -sI https://axion-ia.com | grep -i x-axion-build-sha
curl -s https://axion-ia.com/fr | grep -c plausible          # doit devenir > 0 après lot 4

cat <<'EOF' | ssh axion-prod 'bash -s'
Q(){ docker exec u7zlql3bpb1xy5t4kg6jnvpm psql -U axionia -d axionia -t -A -F'|' -c "$1"; }
# Trafic
Q "SELECT sum(gsc_clicks), sum(gsc_impressions) FROM site_routes;"
# Passif éditorial — doit tomber à 0 après lot 1
Q "SELECT count(*) FILTER (WHERE t.body LIKE '%{{price:%'),
          count(*) FILTER (WHERE t.body_text ~ '31\s?%'),
          count(*) FILTER (WHERE t.body LIKE '%alt=\"text\"%'),
          count(*) FILTER (WHERE t.body ~ '\[(lien|AFNOR|UNESCO)\]'),
          count(*) FILTER (WHERE t.body LIKE '%Session 12+%')
   FROM article_translations t JOIN articles a ON a.id=t.article_id WHERE a.status='published';"
# Instruments — doit devenir > 0 après lot 3
Q "SELECT count(*) FROM articles WHERE embedding IS NOT NULL;"
# Pipeline
Q "SELECT status, count(*), round(coalesce(sum(\"costUsd\"),0),2) FROM content_gen_jobs GROUP BY 1;"
docker exec plausible_events-vl41qwmhr6l26bmrjzet9h02 clickhouse-client -d plausible_events_db \
  -q "SELECT name, count() FROM events_v2 WHERE timestamp > now()-INTERVAL 7 DAY GROUP BY name FORMAT TSV"
EOF
```

---

## ADR à rédiger une fois les arbitrages tranchés

`docs/adr/00XX-boucle-qualite-contenu.md` — décisions structurantes : rôle du `qualityScore` (portier → indicateur), volume de production cible, politique de retrait, historisation vs écrasement, licence `ai-policy.json`, OpenAI en fournisseur unique.
