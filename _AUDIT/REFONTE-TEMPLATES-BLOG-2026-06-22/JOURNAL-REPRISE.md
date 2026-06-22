# Journal de reprise — Refonte templates blog (2026-06-22)

> Fichier de sauvegarde continue (demandé par Will) : pour reprendre EXACTEMENT
> où on en est si la session ferme. Mis à jour après chaque étape.
> **LIRE EN PREMIER si reprise.**

## Contexte / demande Will

1. Audit profond des templates de génération de contenus + comptage exact.
2. Verdict « perfection » vs best practices juin 2026.
3. GROSSE refonte frontend/design des contenus blog (« blocs de texte, aucune
   mise en page, proportion texte/images catastrophique »), en harmonie avec
   home/interventions/1-to-1/audit. Équipe ~50 agents.
4. Vérification end-to-end puis continuer TOUS les chantiers restants.
5. Sauvegarder la progression au fur et à mesure (CE fichier).

## Résultat audit (27 agents + vérif adversariale)

- **52 templates distincts in-scope** = 9 presets ContentTemplate DB (STUBS) +
  21 générateurs registry + 6 générateurs ville CLI + 6 keyword-templates géo +
  6 pages de rendu + 4 profils qualité. (21 ContentType générables, 27
  générateurs au total.) Hors-scope : 8 presets campagne, 42 emails, 22 PDF.
- **Pas à la perfection.** Scores : rendu 7,5/10 · prompts 7 · qualité 7 ·
  générateurs 5,5 · **presets DB 3,5 (insuffisant)**.
- 4 P0 confirmés : presets console = leurres (champs jamais lus + stubs
  dégradants) ; blog_article moins contrôlé que types Phase-8 ; `JSON.parse as T`
  sans Zod (8 générateurs) ; couverture 8/21.
- **Cause racine design** : `.prose-axionia` JAMAIS définie + `@tailwindcss/
  typography` non installé → corps d'article quasi non stylé.

Rapports : `_AUDIT/AUDIT-TEMPLATES-CONTENT-GEN-2026-06-21/`. Checklist cible
fournie par Will = mémoire `template-parfait-juin-2026-checklist`.

## Branche & commits

`feat/blog-templates-refonte` (off main, EN PLACE, pas worktree). **RIEN POUSSÉ.**
Tous gates pre-commit verts (prettier, anti-hex, use-client, typecheck).

- `7fb26e22` C1 — socle typo `.prose-axionia` (globals.css, 100 % CSS / 0 JS)
- `57af33be` C2a — callouts `aside.callout` (info/note/warning/danger) +
  glossaire `dfn`/`.glossary-term` + `mark` + largeur lecture 42rem +
  whitelist sanitizer (span/mark/dfn/abbr)
- `a7ce9800` C2b — fleet 4 blocs vérifiés (ArticleShareBar + CopyLinkButton
  client, ArticleTransparencyBlock, ArticlePeopleAlsoAsk, ArticlePrevNext) ;
  intégrés /blog : ShareBar + Transparency + barre progression CSS scroll-driven.
  **PAA + PrevNext créés mais PAS câblés** (attendent données loader).
- `cb7abfe1` C3(début) — fix FAQPage `/guides` (`parseFaqItems` déballe `.faq`
  quand faqJson est un objet) + test `faq-items.test.ts` (6/6 verts).
- `cc698a17` — test parseFaqItems + ce journal de reprise.
- (commit suivant) C3 propagation `/actualites` — barre progression + **TOC +
  ancres (gap audit comblé)** + ShareBar + TransparencyBlock. typecheck 0.

## Vérification E2E (2026-06-22)

- ✅ typecheck (toute la base), 6/6 tests parseFaqItems, anti-hex, use-client.
- ⚠️ Boot app local : **impossible de rendre visuellement** (pas de `.env`, pas
  de Postgres/Redis local). En mode stub, TOUTES les routes (home/audit/
  formations/blog) renvoient le même `500 ReferenceError: AdminSession is not
  defined` — artefact GLOBAL du mode-stub, **pas une régression**. La
  compilation passe (CSS + composants + page.tsx OK). Rendu visuel réel = à
  faire par Will sur prod/preview avec vraie DB.

## RESTE À FAIRE (Chantier 3 + suite) — ordre prévu

1. [ ] **Données dormantes** : ajouter `keyTakeaway?` + `expertQuote?{name,
   title,text}` à `GeneratorOutput` (types.ts) ; faire émettre par les
   générateurs (prompt + parse, garde anti-hallucination STRICTE sur l'expert) ;
   persister dans `content-publish-worker.ts` (article.create). `citations`
   existe déjà dans output → créer les rows `ContentCitation` (jamais fait).
2. [ ] **Images intercalées** dans le corps (prompt générateur → `<figure>`),
   clé pour la proportion texte/images.
3. [ ] **Câbler ArticlePrevNext** (loader prev/next séquentiel par catégorie) +
   **ArticlePeopleAlsoAsk** (source questions liées distincte de
   SuggestedContent).
4. [ ] **Propager** prose + blocs à `/guides`, `/actualites`, `/comparaisons`.
5. [ ] Effet secondaire : worker QA-extract `faqList` saute aussi les guides
   (même cause objet-vs-tableau, worker:~736).
6. [ ] P0 pipeline optionnels : Zod sur 8 générateurs ; garde resolver
   anti-stub + vérif SQL prod `content_templates`.

## ⚠️ CONCURRENCE DÉTECTÉE (2026-06-22)

Un effort PARALLÈLE « Option 1 citations » (mémoire `citations-option1-chantier`)
travaille sur la MÊME branche `feat/blog-templates-refonte` et a laissé des
changements **NON COMMITTÉS** dans le working tree :
- untracked : `src/server/content-gen/links/persist-citations.ts` (+ `.test.ts`)
- modifiés non-committés : `content-publish-worker.ts` (+20), `v7-phase8-shared.ts`
  (+4), `generation-log.ts` (+1) ; rapport `_AUDIT/CITATIONS-OPTION1-2026-06-22/`.
- → la persistance `ContentCitation` (item « sources » de mon Chantier 3) est
  DÉJÀ faite par cet effort. NE PAS dupliquer.
- → mes commits utilisent `git add` CIBLÉ → je n'ai PAS embarqué leur travail.
- → keyTakeaway/expertQuote touchent les MÊMES fichiers (worker + v7-phase8) →
  DÉFÉRÉ tant que leur travail n'est pas committé (sinon collision/entanglement).
- Items SÛRS (fichiers non en conflit) que je peux continuer : propagation prose
  + blocs à /guides, /actualites (TOC manquante), /comparaisons ; câblage
  PrevNext/PAA (loader.ts NON modifié par l'autre effort).

## Reste Will (hors code)

- Revue visuelle sur prod/preview, puis `git push` → PR → merge.
- (Rien n'est poussé ; aucune migration ajoutée à ce stade.)
