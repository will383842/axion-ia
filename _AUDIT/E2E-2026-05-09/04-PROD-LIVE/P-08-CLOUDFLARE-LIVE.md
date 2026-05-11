# P-08 — CLOUDFLARE LIVE (lecture API)

**Source** : `.secrets/api-tokens.env` (présent, gitignored). AGT-12 INFRA-CICD a déjà exécuté les appels API en lecture seule durant son audit.

## Snapshot AGT-12 (consolidé)

| Setting                                 | Valeur live                                                   | Doctrine                             |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| SSL/TLS mode                            | Full strict                                                   | ✅                                   |
| TLS 1.3                                 | ON                                                            | ✅                                   |
| 0-RTT                                   | ON                                                            | ✅                                   |
| HTTP/3                                  | ON                                                            | ✅                                   |
| Brotli                                  | ON (auto)                                                     | ✅                                   |
| HSTS                                    | `max_age=31536000`, `preload=true`, `include_subdomains=true` | ✅ (drift code 2 ans documenté P1)   |
| Bot Fight Mode                          | ON                                                            | ✅                                   |
| Security Level                          | medium (UI auto post-Phase 5)                                 | ✅                                   |
| AI Scrapers                             | OFF (toggle dashboard)                                        | ✅ (doctrine)                        |
| Cache Rules count                       | **6** (doctrine annonçait 5)                                  | ⚠️ drift mineur AGT-12 P1            |
| WAF rules                               | (non détaillé, à confirmer)                                   | —                                    |
| DNSSEC                                  | **pending** (DS record pas chez Namecheap)                    | ⚠️ flag Phase 5                      |
| Cloudflare Managed Content `robots.txt` | **ON** (bloque AEO bots en prepend)                           | 🚨 **P0 contradiction doctrine AEO** |

## Cache Rules détail (AGT-12)

1. API never cache (`/api/**`)
2. Sitemaps 1h (`*.xml`)
3. **Robots 7d (`/robots.txt`)** ← non doctriné, drift mineur
4. Static 1y (`/_next/static/**`)
5. HTML SSG 1d
6. Admin bypass (`/<admin-prefix>/**` ou via dedicated)

## Contradictions critiques

🚨 **P0** — Cloudflare Managed Content active **réécrit `robots.txt`** en tête avec :

```
User-Agent: ClaudeBot/GPTBot/anthropic-ai/Google-Extended/Applebot-Extended/Amazonbot/Bytespider/CCBot/meta-externalagent
Disallow: /
```

Ceci **bloque les bots AEO/GEO** en contradiction avec :

- L'investissement code AEO (18 factories JSON-LD, llms.txt, llms-full.txt).
- L'origin `src/app/robots.ts` qui Allow explicitement GPTBot/ClaudeBot/anthropic-ai/OAI-SearchBot.
- La doctrine § 0.1 ne mentionne pas explicitement la position AEO mais l'investissement code Sprint 14.x prouve l'intent.

→ **Action 24-48 h** : désactiver "Cloudflare Managed Content" dans CF Dashboard → Security → Bots → robots.txt managed.

## DNSSEC

`status: pending` (mémoire `axionia_session_2026-05-09_cloudflare_phase5`). DS record à ajouter chez Namecheap (registrar). Action ~5 min Will.

## Action items Phase 5

1. **DNSSEC** activation (P2, action Will).
2. **CF Managed Content** désactivation (P0 si confirmé Pass B).
3. **Cache Rules count** : aligner doctrine sur 6 (mineur, doc-side).
4. **HSTS** : décider 1 an (CF actuel) vs 2 ans (code) + propagation.

## Lecture API détails AGT-12

Voir `02-AGENTS/AGT-12-INFRA-CICD.md` § Cloudflare live (token CF lu depuis `.secrets/api-tokens.env`). Aucune écriture API effectuée. Conformité audit-only respectée.
