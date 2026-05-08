# 17 — CONTENT QUALITY FR + EN 2026

> Audit qualité éditoriale : spell, grammar, tone, copy consistency, pricing, FR ↔ EN.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. Spell + grammar

1.1 Spell check FR clean (LanguageTool free OSS API)
1.2 Spell check EN clean (LanguageTool ou Grammarly free)
1.3 Typos : 0 dans les pages indexables
1.4 Punctuation française correcte (espaces insécables avant `:` `;` `?` `!`)
1.5 Apostrophes typographiques (`’`) vs ASCII (`'`)
1.6 Guillemets typographiques (« » FR / "" EN)
1.7 Tirets em/en utilisés correctement (— vs - vs −)
1.8 Capitalisation cohérente (Title Case EN, sentence case FR)
1.9 Accents corrects (à, é, è, ê, ç…)
1.10 0 anglicisme inutile FR (ou validé glossaire)

### 2. Tone & voix de marque

2.1 « cabinet IA opérationnel » FR / « operational AI consultancy » EN partout
2.2 Jamais « agence/studio/atelier » pour Axion-IA
2.3 Tone premium B2B (formel, expert, accessible)
2.4 Pas de jargon AI gratuit (« transformer-based », « LLM agentique », expliquer)
2.5 Ton consistant homepage / services / blog
2.6 Voix active > voix passive
2.7 Phrases courtes (15-20 mots median)
2.8 Pas de superlatifs vides (« le meilleur », « révolutionnaire »)
2.9 Bénéfices client > features tech
2.10 CTA explicites (« Demander un audit Flash 490 € » vs « En savoir plus »)

### 3. Pricing consistency

3.1 0 prix hardcodé (tout dans `data/pricing.ts`)
3.2 Format prix cohérent (`490 €` FR / `€490` EN ?)
3.3 Audit Flash 490 € même valeur partout
3.4 Audit Stratégique 12 000 € même partout
3.5 Intervention Essentielle 490 € partout
3.6 Tarifs cross-pages (CTA, FAQ, pricing page, schemas)
3.7 Tarifs JSON-LD `priceRange` cohérent
3.8 Tarifs OG image / preview
3.9 Tarifs metadata description
3.10 Tarifs i18n cohérent

### 4. Copy patterns récurrents

4.1 H1 par page : unique + descriptif
4.2 Meta description : unique + < 160 caractères
4.3 OG title : optimisé social
4.4 OG description : optimisé social
4.5 Twitter Card title/description
4.6 CTA primaire/secondaire cohérent par template
4.7 FAQ Q&A : Q < 100 chars, A 50-300 chars
4.8 Breadcrumb labels lisibles
4.9 Empty state copy pertinent
4.10 Error page copy utile (404, 500)

### 5. Editorial calendar (blog Sprint 14.6+)

5.1 Calendrier éditorial documenté
5.2 Tags / catégories bien structurés
5.3 Auteur byline (Person schema)
5.4 Date publication + date modification visibles
5.5 Reading time estimé
5.6 Article schema JSON-LD
5.7 Internal linking blog → service
5.8 Related articles
5.9 Newsletter capture sur articles
5.10 Comments / feedback (si applicable, sinon retiré)

## Méthode

- Phase A : Extract toutes les strings FR + EN, run LanguageTool
- Phase A bis : grep prix hardcodés, brand naming
- Phase A ter : sample 20 pages FR + 20 EN audit manuel ton
- Phase B : Diagnostic /50
- Phase C : Plan corrections
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant changement copy massif (impact SEO + brand)
2. Avant changement tarif (impact business)
3. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ Tone marketing creux (« le meilleur », « révolutionnaire » sans preuve)
- ❌ Jargon AI gratuit (« transformer-based », « LLM agentique » sans définir)
- ❌ Anglicismes inutiles FR (« meeting » vs « réunion »)
- ❌ Pricing différents entre pages (signal incohérence)
- ❌ Apostrophes ASCII (`'` vs `’` typographique)
- ❌ Phrases > 30 mots (illisibles, perdent le lecteur)
- ❌ CTA vague (« En savoir plus » vs « Réserver Flash 490 € »)
- ❌ Voix passive systématique (anti-conversion)
- ❌ FAQ Q trop longues (> 100 chars = featured snippet impossible)

## Cible

> 0 typo, ton premium consistant, pricing cohérent, tous patterns copy uniformes.

## Livrables

```
audit-17-content-SYNTHESE.md
audit-17-content-DIAGNOSTIC.md
audit-17-content-TYPOS.md  (LanguageTool report)
audit-17-content-PRICING-AUDIT.md
audit-17-content-TONE-AUDIT.md
audit-17-content-PLAN.md
```
