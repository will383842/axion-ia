# 18 — CRO CONVERSION 2026

> Audit conversion paths : funnels, form UX, trust signals, calendar booking, email capture.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. CTA hierarchy & visibility

1.1 CTA primaire above-fold partout
1.2 CTA hierarchy claire (terracotta primary > outline secondary > ghost tertiary)
1.3 Sticky CTA scroll mobile (sur pages longues)
1.4 CTA labels actionnables (« Réserver · 490 € » vs « En savoir plus »)
1.5 CTA destinations cohérentes (audit → /audit, intervention → /reserver)
1.6 CTA tracking (data-cta-tracking déjà ✅ partiel)
1.7 CTA spacing aéré (touch target ≥ 44px)
1.8 CTA contrast OK (WCAG AA)
1.9 CTA loading state (form submit)
1.10 CTA disabled state design

### 2. Form UX

2.1 Form fields minimisés (only essentials)
2.2 Multi-step si > 6 fields (progress visible)
2.3 Inline validation (real-time feedback)
2.4 Erreurs claires + actionnables
2.5 Autocomplete attributes (`email`, `tel`, `name`)
2.6 inputmode adapté mobile
2.7 Save form state (LocalStorage si form long)
2.8 Confirmation page après submit
2.9 Email confirmation envoyé (Sprint 19)
2.10 Form abandonment recovery (analytics)

### 3. Trust signals

3.1 Logos clients above-fold home (quand dispos)
3.2 Témoignages clients pages services (quand dispos)
3.3 Cas concrets visibles (page dédiée + lien)
3.4 Certifications / labels (si applicable)
3.5 Photos équipe / fondateur (Person schema)
3.6 Social proof numbers (X clients, X interventions, etc.)
3.7 Garanties (« Satisfait ou remboursé », si applicable)
3.8 Process transparent (timeline étapes)
3.9 Pricing transparent (pas de « sur devis » caché)
3.10 Press mentions / podcasts (si applicable, page presse)

### 4. Calendar booking flow

4.1 Calendrier mobile-friendly
4.2 Disponibilités claires (slots libres vs occupés)
4.3 Min 7 jours visibles
4.4 Sélection slot intuitive
4.5 Form pré-rempli si utilisateur connu
4.6 Acompte 50 % expliqué clairement
4.7 Conditions politique déplacement liées
4.8 Confirmation immediate (UI + email)
4.9 Rappel automatique J-1 (Sprint 19)
4.10 Annulation / modification possible (post-MVP ?)

### 5. Email capture & funnel

5.1 Newsletter capture présente (footer ou modal)
5.2 Lead magnet (audit Flash 490 € comme top-funnel)
5.3 Funnel stages identifiés (visiteur → lead → audit → client)
5.4 Conversion tracking par stage (analytics)
5.5 Goals Search Console / Plausible configurés
5.6 A/B testing readiness (feature flags Sprint…)
5.7 Exit intent (si pertinent, B2B premium pas forcément)
5.8 Heatmaps (Microsoft Clarity free)
5.9 Session recordings (Clarity free)
5.10 Funnel report mensuel pour Will

## Méthode

- Phase A : Audit chaque page : où est la conversion ?
- Phase A bis : Analytics actuels (si disponibles)
- Phase B : Diagnostic /50
- Phase C : Plan
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant changement form (impact conversions)
2. Avant changement pricing display
3. Avant ajout outil tiers (Clarity, Plausible)
4. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ Form 15 fields sur première étape (abandon garanti)
- ❌ CTA primaire pas above-fold (perdu sur mobile)
- ❌ Trust signals fake (logos fictifs, testimonials inventés — interdit légalement)
- ❌ Pricing caché derrière « Sur devis » (suspicion B2B premium)
- ❌ Exit intent agressif sur B2B premium (mauvaise UX)
- ❌ A/B testing sans traffic suffisant (résultats non significatifs < 1000 sessions/variant)
- ❌ Funnel sans tracking (impossible d'optimiser)
- ❌ Dark patterns (urgency fake, scarcity fake)
- ❌ Confirmation post-submit sans feedback (utilisateur anxieux)
- ❌ Email confirmation lent (> 1 min = utilisateur perdu)

## Cible

> CTA partout, form UX optimal, trust signals présents, calendar booking fluide, funnel mesurable.

## Livrables

```
audit-18-cro-SYNTHESE.md
audit-18-cro-DIAGNOSTIC.md
audit-18-cro-FUNNEL-MAP.md
audit-18-cro-PLAN.md
```
