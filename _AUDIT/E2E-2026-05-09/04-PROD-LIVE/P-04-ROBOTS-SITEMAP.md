# P-04 — ROBOTS-SITEMAP

## `/robots.txt` analyse

### Section 1 — Cloudflare Managed Content (PREPEND)

```
# BEGIN Cloudflare Managed content
User-agent: *
Content-Signal: search=yes, ai-train=no
Allow: /

User-agent: Amazonbot      Disallow: /
User-agent: Applebot-Extended Disallow: /
User-agent: Bytespider      Disallow: /
User-agent: CCBot           Disallow: /
User-agent: ClaudeBot       Disallow: /    ⚠️
User-agent: Google-Extended Disallow: /    ⚠️
User-agent: GPTBot          Disallow: /    ⚠️
User-agent: meta-externalagent Disallow: /
# END Cloudflare Managed content
```

### Section 2 — Origin (Next.js `src/app/robots.ts`)

```
User-Agent: *
Allow: /
Disallow: /api/, /_next/, /design, /fr/design, /en/design, /components, /sections...

User-Agent: GPTBot        Allow: /  Disallow: /api/, /design...
User-Agent: OAI-SearchBot Allow: /  ...
User-Agent: ChatGPT-User  Allow: /  ...
User-Agent: ClaudeBot     Allow: /  ...
User-Agent: anthropic-ai  Allow: /  ...
User-Agent: Claude-Web    Allow: /  ...
```

### ⚠️ CONTRADICTION (P0 SEO/AEO/GEO)

Per **RFC 9309** (Robots Exclusion Protocol), les bots qui matchent **plusieurs** `User-agent:` doivent appliquer la **règle la plus spécifique**.
Pour ClaudeBot / GPTBot / anthropic-ai :

- CF prepend : `Disallow: /` (règle spécifique = bloque tout)
- Origin : `Allow: /` (règle spécifique = autorise)

**Selon la RFC, la règle "la plus spécifique" prime mais en cas d'égalité de spécificité c'est le longest-match path**. Ici `Disallow: /` et `Allow: /` ont la même longueur de path → **comportement indéfini** selon implémentation.

- Google semble préférer **Allow** en cas d'égalité (cf. Google Robots Tester).
- Anthropic / OpenAI implémentation : **inconnue**.

→ **Risque réel** : les bots AEO peuvent suivre la première règle rencontrée (CF prepend → Disallow). **AGT-04 + AGT-05 P0 confirmé** : investissement AEO/GEO (18 factories JSON-LD) **partiellement neutralisé**.

**Action** : désactiver le bloc "Cloudflare Managed Content" dans CF Dashboard → onglet Bots → Content-Signal / robots.txt managed.

## `/sitemap.xml` → 404

⚠️ **Cached 404 cf-cache-status: HIT** : Cloudflare cache l'erreur. Doctrine trade-off documenté code (`src/app/sitemap-index.xml/route.ts:1-20`). Les outils SEO externes (Search Console, Bing Webmasters, Yandex) attendent `/sitemap.xml` ou un lien explicite dans `robots.txt`. **Vérifier que robots.txt contient `Sitemap: …`**.

```
curl -s /robots.txt | grep -i "Sitemap:"
```

→ À confirmer (non vu dans extract Phase 0).

## `/sitemap-index.xml` → 200

11 sitemaps split référencés :

```
sitemap/pages.xml                        → 94 URLs
sitemap/blog.xml                         → 38 URLs
sitemap/help.xml                         → (non mesuré)
sitemap/cas-concrets.xml                 → (non mesuré)
sitemap/comparaisons.xml                 → (non mesuré)
sitemap/implementation.xml               → (non mesuré)
sitemap/implantations.xml                → 26 URLs (13 régions × 2 locales)
sitemap/services-villes-audit.xml        → 2 URLs (paris FR + EN — Paris pilote)
sitemap/services-villes-interventions.xml → (non mesuré, présume 2)
sitemap/services-villes-implementation.xml → (non mesuré, présume 2)
sitemap/villes-ile-de-france.xml         → 2 URLs (Paris pilote FR + EN)
```

⚠️ **Pas de sitemap pour les 12 autres régions** : `villes-auvergne-rhone-alpes.xml` → 404. **Volontaire** (anti-doorway HCU : villes sans copy = noindex follow donc absentes du sitemap). ✅

→ **Total estimable** : ~250-300 URLs indexables au sitemap actuellement. Cohérent doctrine **HCU 95/5** : seules les pages avec copy substantielle sont au sitemap. Les ~17 000 routes pSEO villes prerendered en SSG sont **noindex follow** → 0 dans sitemap.

`<lastmod>` : timestamp uniforme `2026-05-10T19:13:31.087Z` (dernier deploy). AGT-04 P1 confirmé : `lastmod = new Date()` à chaque hit dans `sitemap-index.xml/route.ts:30`.

## Synthèse

| Critère                                            | Status                                            |
| -------------------------------------------------- | ------------------------------------------------- |
| robots.txt accessible                              | ✅                                                |
| robots.txt admin masqué                            | ✅ (admin URL prefix non documenté dans robots)   |
| robots.txt sandbox masqué                          | ✅ (Disallow /design /components /sections FR+EN) |
| **CF Managed Content** prepend qui bloque AEO bots | 🚨 **P0 confirmé**                                |
| `/sitemap.xml` accessible                          | ⚠️ 404 (trade-off documenté)                      |
| `/sitemap-index.xml` accessible                    | ✅                                                |
| Sitemap split par section                          | ✅ (11 sous-sitemaps)                             |
| Sitemap respecte HCU 95/5 (pas de doorway)         | ✅                                                |
| `lastmod` réel                                     | ⚠️ uniforme deploy (P1)                           |
| Leak admin dans sitemap                            | ✅ (0 URL admin)                                  |
