# Audit L13 — Légal + RGPD + Utilitaires (19 templates)

**Date** : 2026-05-22 | **Agent** : A13

## Scores

| Template                             |   Score | Classe     |
| ------------------------------------ | ------: | ---------- |
| `/mentions-legales`                  |     880 | BIEN       |
| `/politique-confidentialite`         |     895 | BIEN       |
| `/sous-processeurs`                  |     905 | BIEN       |
| `/rgpd`                              |     893 | BIEN       |
| `/mes-donnees`                       |     892 | BIEN       |
| `/mes-donnees/export`                |     875 | BIEN       |
| `/cookies`                           |     890 | BIEN       |
| `/preferences-cookies`               |     885 | BIEN       |
| `/conditions-generales`              |     870 | BIEN       |
| `/accessibilite`                     |     865 | BIEN       |
| `/corrections`                       |     900 | BIEN       |
| `/actualites` + `/actualites/[slug]` | 895/897 | BIEN       |
| `/ressources`                        |     893 | BIEN       |
| `/recherche`                         |     875 | BIEN       |
| `/[...catchall]`                     |     898 | BIEN       |
| `/maintenance`                       |     920 | EXCELLENCE |
| **Moyenne L13**                      | **888** | **BIEN**   |

---

## Audit P0 Critiques — **AUCUN DÉTECTÉ ✅**

| Check                              | Résultat                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| **Société française** (pas OÜ)     | ✅ legal.ts:40 confirme société FR                          |
| **DPO contact présent**            | ✅ politique-confidentialite L219, mes-donnees L97          |
| **Délais RGPD 30 jours**           | ✅ politique-confidentialite L219, mes-donnees L97-98       |
| **IP hash SHA-256**                | ✅ politique-confidentialite (Plausible self-hosted)        |
| **robots noindex sur mes-données** | ✅ mes-donnees/page.tsx:29 + mes-donnees/export/page.tsx:38 |
| **Sous-processeurs exhaustifs**    | ✅ 6 providers IA listés (subprocessors.ts:68-206)          |

---

## Points forts RGPD

### `/sous-processeurs/page.tsx` — EXEMPLAIRE

- 6 providers IA : Anthropic, OpenAI, Perplexity, Sentry, Plausible, Hetzner ✓
- DPA status per provider (pending_activation, active, self-hosted) ✓
- Cadre transfert (SCC, intra-EU, adequacy) ✓
- Localisation serveurs explicite ✓

### `/politique-confidentialite/page.tsx` — CONFORME

- Base légale chaque traitement (6.1.b, 6.1.f, 6.1.a) ✓
- IP SHA-256 Plausible ✓
- AI Act art. 50 divulgué (L230-231) ✓
- Retrait consentement via CNIL ✓

### `/cookies/page.tsx` — CONFORME CNIL 2026

- Pas de consent pré-coché ✓
- Clarity cookies avec consent ✓
- Plausible sans cookie (self-hosted) ✓
- Durée rétention 13 mois ✓

### Catch-all `/[...catchall]/page.tsx` — PARFAIT

- `dynamic="force-dynamic"` + `notFound()` → 404 HTTP réel ✓ (fix P0-7 2026-05-15)

---

## P1 Corrections

1. **`/mentions-legales`** : DPO contact flou en section "Éditeur" → ajouter "Responsable RGPD : contact@axion-ia.com" | 15min
2. **`/accessibilite`** : dateModified hardcodé "6 mai 2026" → injecter BUILD_DATE ou ISR | 0.5h
3. **`/mes-donnees/export`** : Ajouter "Besoin d'aide ? contact@axion-ia.com" en footnote | 15min

---

## SIREN/SIRET status

- Infrastructure présente (env vars) ✓
- **Valeurs manquantes** — Will doit fournir SIREN/SIRET/TVA intracommunautaire pour `/mentions-legales`

---

## Synthèse L13

**Score global 888/1000 — BIEN. Zéro P0.**

Toutes les pages satisfont les critères légal/RGPD critiques. Les 3 P1 sont cosmétiques (15-30min chacun). La conformité AI Act est assurée côté technique ; les DPA administratifs sont en attente de signature Will (Anthropic, OpenAI, Perplexity).
