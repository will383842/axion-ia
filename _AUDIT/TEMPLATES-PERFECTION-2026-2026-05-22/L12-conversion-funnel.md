# Audit L12 — Conversion Funnel (10 templates)

**Date** : 2026-05-22 | **Agent** : A12

## Scores

| Template                               |   Score | Classe     |
| -------------------------------------- | ------: | ---------- |
| `/reserver/page.tsx`                   |     765 | CORRIGER   |
| `/demande-devis/page.tsx`              |     700 | CORRIGER   |
| `/demande-devis/confirmation/page.tsx` |     850 | BIEN       |
| `/contact/page.tsx`                    |     880 | BIEN       |
| `/confirmation/page.tsx`               |     840 | BIEN       |
| `/confirmation/newsletter/page.tsx`    |     900 | EXCELLENCE |
| `/desabonnement/page.tsx`              |     910 | EXCELLENCE |
| `/booking/[token]/cancel/page.tsx`     |     820 | POLISH     |
| `/booking/[token]/reschedule/page.tsx` |     800 | CORRIGER   |
| `/mes-ressources/page.tsx`             |     750 | CORRIGER   |
| **Moyenne L12**                        | **820** | **POLISH** |

---

## `/reserver/page.tsx` — Calendrier booking

**Score : 765/1000**

| Dim           | Score | Justification                                                                                       | path:line                     |
| ------------- | ----: | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| D1 SEO        |    75 | Title 65c (> 60c limite) ❌                                                                         | page.tsx:391-400              |
| D2 AEO        |    50 | **ReservationAction JSON-LD ABSENT** ❌                                                             | absent                        |
| D4 Web Vitals |    85 | **EXCEPTION INP 150ms** ✓, BookingCalendarLazy `next/dynamic ssr:false` ✓, min-height 800px CLS=0 ✓ | BookingCalendarLazy.tsx:21-38 |
| D7 AI Act     |    85 | RGPD consent non pré-coché ✓                                                                        | forms.ts:170-172              |

### P0

1. **Title 65c > 60c** — fix : "Réserver intervention · calendrier · Axion-IA" (54c) | 5min
2. **ReservationAction JSON-LD manquant** — 0 signal AEO pour LLMs | 1h

---

## `/demande-devis/page.tsx` — Formulaire qualifié

**Score : 700/1000**

| Dim           | Score | Justification                                             |
| ------------- | ----: | --------------------------------------------------------- |
| D2 AEO        |    40 | **Order/Quote JSON-LD ABSENT**                            |
| D7 AI Act     |    90 | 2 consentements explicites (consentTerms + consentGdpr) ✓ |
| D8 Conversion |    75 | 10 champs (justifié 4 sections) mais > 4 recommandés      |

### P0

1. **Title 62c > 60c** | 5min
2. **Order JSON-LD manquant** | 0.5h

---

## `/contact/page.tsx` — EXEMPLAIRE

**Score : 880/1000**

| Dim           | Score | Justification                                                                   | path:line               |
| ------------- | ----: | ------------------------------------------------------------------------------- | ----------------------- |
| D2 AEO        |    90 | **ContactPage JSON-LD + mainEntity:ContactPoint** ✓ — email, telephone, hours ✓ | page.tsx:134-157        |
| D6 A11y       |    90 | Labels htmlFor ✓, aria-invalid ✓, role=alert ✓                                  | ContactForm.tsx:101-157 |
| D7 AI Act     |    90 | Consent ✓, hébergement DE mentionné ✓                                           | ContactForm.tsx:141-157 |
| D8 Conversion |    95 | **4 champs exacts** ✓, 3 sections entry points ✓, 4 trust pills ✓               | page.tsx:322-355        |

---

## RFC 8058 — `/confirmation/newsletter` + `/desabonnement` — EXEMPLAIRES

| Template                   | Score | Force principale                                                           |
| -------------------------- | ----: | -------------------------------------------------------------------------- |
| `/confirmation/newsletter` |   900 | RFC 8058 double opt-in ✓, token server-side ✓, idempotent ✓                |
| `/desabonnement`           |   910 | RFC 8058 one-click ✓, art. 7 RGPD ✓, defensive UX (result before action) ✓ |

---

## `/mes-ressources/page.tsx` — CORRIGER

**Score : 750/1000**

### P0

1. **No CTA** — page list-only sans funnel exit | MEDIUM
2. **CollectionPage JSON-LD manquant** | 0.5h

---

## Synthèse L12

### Top P0 (par impact)

1. **ReservationAction JSON-LD absent** `/reserver` — AEO signal zéro | 1h | NEW
2. **Order/Quote JSON-LD absent** (demande-devis, confirmation, mes-ressources) | 1.5h | NEW
3. **Titles > 60c** (reserver 65c, demande-devis 62c) | 10min | NEW
4. **Confirmations sans Order schema** (confirmation polymorphe) | 1h | NEW
5. **Mes-ressources sans CTA** | MEDIUM

### Forces transversales L12

- RFC 8058 exemplaire (newsletter + désabo) — RGPD gold standard
- Calendrier CLS=0 garanti via min-height reservée
- 4 trust pills /contact (48h, no spam, RGPD, documented)
- RGPD consent sur tous les formulaires (2 checkboxes required)

**Effort total** : ~6h P0
