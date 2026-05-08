# ADR 0009 — Hébergement Hetzner CX32 + Cloudflare Free

- **Statut** : Accepté
- **Date** : 2026-05-08
- **Auteur** : Will + Claude (Opus 4.7)
- **Référence** : ADR 0001 §83 (Hetzner ferme), `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` §0bis, mémoire `axionia_hosting_hetzner.md`

## Contexte

ADR 0001 stack-initial fixait Hetzner comme hébergeur (Vercel écarté, souveraineté UE OÜ estonienne) sans figer la taille de l'instance ni le CDN frontal. Lors de la création du prompt Web Vitals 2026 (2026-05-08), Will a explicitement demandé une décision chiffrée sur :

1. **Hetzner CX22 vs CX32** (taille VPS)
2. **Cloudflare Free vs Pro $20/mois vs Argo $5/mois** (frontend CDN/sécu)

Cet ADR grave la réponse pour que tous les audits, prompts et runbooks reposent sur la même base.

## Décision

### VPS — Hetzner Cloud **CX32** (4 vCPU x86 / 8 GB RAM / 80 GB NVMe / 20 TB / €6,49/mois HT)

CX22 (2 vCPU / 4 GB RAM, €3,79/mois HT) écarté car insuffisant pour absorber simultanément :

| Composant                            | RAM consommée |
| ------------------------------------ | ------------- |
| Coolify orchestrator                 | ~512 MB       |
| Caddy 2 reverse proxy                | ~50 MB        |
| Next 16 runtime (Node.js 22)         | ~1-2 GB       |
| PostgreSQL 16 container (Sprint 15+) | ~1-2 GB       |
| Redis container (Sprint 18+)         | ~256 MB       |
| BullMQ workers (Sprint 18+)          | ~512 MB       |
| Build SSG 4 342 pages (peak)         | ~3 GB         |
| **Runtime régulier**                 | **~3-4 GB**   |
| **Pendant build**                    | **~5-6 GB**   |

CX22 → swap pendant build, risque OOM. CX32 → marge confortable, pas de swap. Delta de €2,70/mois HT (~€32/an) négligeable face au risque opérationnel.

CAX21 ARM (équivalent specs, ~€5,49/mois HT) envisagé pour économiser ~€1/mois — non retenu, Will préfère x86 pour homogénéité avec stack Docker classique.

### Frontend CDN — **Cloudflare Free tier** ($0/mois)

CF Free contient déjà tout l'essentiel perf 2026 :

| Feature                   | Free                           | Pro $20/mois             | Verdict pour Axion-IA                 |
| ------------------------- | ------------------------------ | ------------------------ | ------------------------------------- |
| 103 Early Hints           | ✅ (gratuit depuis sept. 2022) | ✅                       | Free suffit                           |
| HTTP/3 (QUIC)             | ✅                             | ✅                       | Free suffit                           |
| Brotli                    | ✅                             | ✅                       | Free suffit                           |
| CDN illimité 200+ POPs    | ✅                             | ✅                       | Free suffit                           |
| DDoS illimité             | ✅                             | ✅                       | Free suffit                           |
| WAF basic                 | ✅ (~5 règles)                 | ✅ + Managed Rules OWASP | Sprint 16 si besoin                   |
| Cache Rules               | ✅ illimitées                  | ✅ illimitées            | Free suffit                           |
| Page Rules                | 3                              | 25                       | Cache Rules suffit                    |
| Web Analytics             | ✅                             | ✅                       | Free suffit                           |
| Polish (image edge optim) | ❌                             | ✅                       | Redondant avec Next sharp             |
| Mirage (mobile lazy)      | ❌                             | ✅                       | Redondant avec Next `<Image>`         |
| 100 % uptime SLA          | ❌                             | ✅                       | Marketing, sans valeur opérationnelle |

Les features payantes (Polish, Mirage, Managed Rules) sont **redondantes** avec la stack Next 16 + Caddy 2 + sharp ou pertinentes seulement Sprint 16+.

Add-ons Cloudflare différés :

- **Argo Smart Routing** ($5/mois + $0,10/GB) → reconsidérer V2 si audience internationale > 30 % (TTFB −30 %).
- **Workers Paid** ($5/mois pour 10M req) → reconsidérer si besoin compute edge (CSP nonce dynamique fin Sprint 16, A/B tests…).

### Hébergement DB & Cache

Containerisés sur le **même VPS CX32** via Coolify :

- **PostgreSQL 16** container (Sprint 15 active full schema 17 tables)
- **Redis** container (Sprint 18 BullMQ queues)

Postgres managé Hetzner (~€20-40/mois) écarté V1 — overkill, container suffit jusqu'à ~50 K visites/mois.

PgBouncer (connection pooling) à reconsidérer V2 si > 100 connexions concurrentes.

### Backups

- **Coolify backup auto** vers **Backblaze B2 free tier** (10 GB gratuit) — V1
- **Hetzner Storage Box** (€3/mois pour 1 TB) — à reconsidérer dès que volume > 10 GB

### Coût total V1-V2

| Composant                 | Coût/mois HT      |
| ------------------------- | ----------------- |
| Hetzner CX32              | €6,49             |
| Cloudflare Free           | €0                |
| Backblaze B2 (10 GB free) | €0                |
| **Total V1-V2**           | **€6,49/mois HT** |

Tout le reste (perf 2026, CDN, 103 Early Hints, HTTP/3, Brotli, image optim local, WAF basic, DDoS, RUM analytics) est gratuit.

## Conséquences

**Positives**

- Coût opérationnel ultra-prévisible (€6,49/mois HT, 0 coût variable jusqu'à 20 TB traffic).
- Souveraineté UE intégrale (Hetzner Allemagne + Cloudflare RGPD-compatible).
- Aucune dépendance à un hyperscaler (pas de lock-in Vercel/AWS).
- Stack 100 % OSS sur le VPS (Coolify + Caddy + Next + Postgres + Redis + sharp).
- CDN Cloudflare illimité absorbe les pics de trafic sans saturer l'origine.
- Toutes les features perf 2026 (103 Early Hints, HTTP/3, Brotli, CDN, image optim) restent gratuites.

**Négatives**

- Charge admin sys non-nulle (Coolify + Caddy + Postgres self-hosted vs Vercel managed).
  - Mitigation : Coolify abstrait l'essentiel, Caddy a une config simple, Postgres container standard.
- Build CPU-bound sur 4 vCPU shared CX32 (~4-8 min pour 4 342 pages SSG).
  - Mitigation : build off-peak ou en CI GitHub Actions (gratuit) avec push de l'artifact `output: "standalone"`.
- Si trafic explose au-delà de 50 K visites/mois ou 20 TB traffic : upgrade Hetzner CX42 (€13,10/mois HT) ou ajout Cloudflare Argo Smart Routing.
- Pas de SLA 99,99 % — Hetzner SLA est 99,9 % et Cloudflare Free n'a pas de SLA contractuel.
  - Mitigation : Health checks Coolify + alerting (Sprint 20 dashboard), uptime > 99,9 % observé en pratique sur Hetzner.

## Alternatives considérées

- **Hetzner CX22** (€3,79/mois HT, 2 vCPU / 4 GB) — écarté : insuffisant pour build + 3 containers + Coolify, swap garanti pendant build.
- **Hetzner CAX21 ARM** (€5,49/mois HT, 4 vCPU ARM / 8 GB) — écarté : Will préfère x86 pour homogénéité Docker. À reconsidérer V2 si on cherche ~10-15 % perf/€ supplémentaire.
- **Hetzner CCX dedicated** (€13-27/mois HT, 2-4 vCPU dedicated / 8-16 GB) — écarté V1 : overkill, à reconsidérer si saturation CPU shared sur CX32.
- **Cloudflare Pro $20/mois** — écarté V1 : 80 % redondant avec Next + Caddy + sharp. Reconsidérer Sprint 16 pour WAF Managed Rules OWASP.
- **Cloudflare Argo Smart Routing $5/mois + $0,10/GB** — reporté V2 si audience internationale > 30 %.
- **Vercel Hobby/Pro** — écarté définitivement ADR 0001 (souveraineté UE).
- **Postgres managé Hetzner** (~€20-40/mois) — écarté V1, container suffit.
- **AWS / GCP / Azure** — écartés (non-UE, lock-in, coût variable).

## Suivi

- Sprint 15 (DB activation) : container Postgres provisionné via Coolify, schema 17 tables.
- Sprint 16 (auth + sécu) : reconsidérer CF Pro pour WAF Managed Rules OWASP.
- Sprint 18 (queues) : container Redis + BullMQ workers.
- V2 (post-lancement) : monitoring traffic réel + saturation CX32, décision upgrade si besoin.

## Référence prompt audit

Cet ADR sert de baseline intouchable pour `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` §0bis. Tout patch perf doit fonctionner sur ce stack sans coût additionnel.
