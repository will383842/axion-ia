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
- `0f831ead` C3 propagation `/actualites` — barre progression + **TOC +
  ancres (gap audit comblé)** + ShareBar + TransparencyBlock. typecheck 0.
- (commit suivant) C3 propagation `/guides` — barre progression + ShareBar +
  TransparencyBlock (TOC/FAQ/Sources déjà présents). typecheck 0.

## Vérification E2E (2026-06-22)

- ✅ typecheck (toute la base), 6/6 tests parseFaqItems, anti-hex, use-client.
- ⚠️ Boot app local : **impossible de rendre visuellement** (pas de `.env`, pas
  de Postgres/Redis local). En mode stub, TOUTES les routes (home/audit/
  formations/blog) renvoient le même `500 ReferenceError: AdminSession is not
  defined` — artefact GLOBAL du mode-stub, **pas une régression**. La
  compilation passe (CSS + composants + page.tsx OK). Rendu visuel réel = à
  faire par Will sur prod/preview avec vraie DB.

## RESTE À FAIRE (Chantier 3 + suite) — ordre prévu

1. [~] **Sources/citations** : DÉJÀ FAIT par l'effort parallèle (uncommitted) →
   ne pas dupliquer.
2. [BLOQUÉ] **keyTakeaway + expertQuote** : ajouter à `GeneratorOutput`
   (types.ts) + émission générateurs (garde anti-hallucination STRICTE) +
   persistance `content-publish-worker.ts`. → DÉFÉRÉ : touche worker +
   v7-phase8 = fichiers du chantier parallèle non committé (décision Will :
   « continue le sûr, laisse leur code »). À reprendre quand leur travail est
   committé. ⚠️ expertQuote = DÉCISION Will (ne jamais fabriquer d'expert :
   soit banque d'experts curée, soit attribution à Manon, soit on n'émet pas).
3. [BLOQUÉ même raison] **Images intercalées** corps (prompt générateur).
4. [✅] **Propagation** : `/blog` (C1-2b) + `/actualites` (`0f831ead`) +
   `/guides` (`01dfe6ee`) FAITS. RESTE `/comparaisons` (gros : l'audit le dit
   très pauvre, FS statique → migrer vers pipeline OU ajouter answer-first +
   tableau comparatif + author + dateModified ; pas juste ajouter des blocs).
5. [ ] **Câbler ArticlePrevNext** (loader prev/next séquentiel par catégorie) +
   **ArticlePeopleAlsoAsk** (source questions liées) — `blog/loader.ts` est SÛR
   (non modifié par l'effort parallèle), mais demande de concevoir les requêtes.
6. [ ] Effet secondaire : worker QA-extract `faqList` saute aussi les guides
   (même cause objet-vs-tableau, worker:~736) → BLOQUÉ (fichier worker parallèle).
7. [ ] P0 pipeline optionnels : Zod sur 8 générateurs ; garde resolver
   anti-stub + vérif SQL prod `content_templates` → BLOQUÉ (worker/generators).

## État session 2026-06-22 (fin de passe)

7 commits sur `feat/blog-templates-refonte` (NON poussés). Tout le travail SÛR
de refonte frontend est fait (socle typo + blocs + propagation blog/actualites/
guides). Le reste est soit BLOQUÉ par le chantier citations parallèle non
committé (worker/generators), soit du design loader (PrevNext/PAA) / rewrite
(/comparaisons). Reprendre par : (a) faire committer le chantier citations,
puis keyTakeaway/expertQuote ; (b) OU câbler PrevNext/PAA (sûr).

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

## MISE À JOUR FINALE (2026-06-22, suite session)

Décisions Will : experts INTERNES (Manon + Williams seulement, extensible) ;
committer le chantier citations parallèle pour débloquer. Faits depuis :
- `01f76332` — committé le chantier citations parallèle (persist-citations + worker
  + v7-phase8 + log) après inspection (zéro citation inventée, best-effort) → débloque.
- `0363b9e4` — fondation `expert-bank.ts` (Manon + Williams, anti-fabrication :
  nom/titre fixés, LLM rédige le texte) + `GeneratorOutput` keyTakeaway/expertQuote
  + persistance worker + `blog-article` émet.
- `11f101ca` — fleet : émission keyTakeaway/expertTake sur les 8 autres générateurs
  (guide-pilier, comparison, blog-from-*, qa, faq, barometer, v7-phase8) ; typecheck 0.
- `4eefa100` — PrevNext + PeopleAlsoAsk câblés sur /blog (loadAdjacentArticles +
  loadPeopleAlsoAsk dans le loader ; PAA = vraies questions d'autres FAQ).
- `ba816140` — /comparaisons réécrit (modèle enrichi via fleet 3 agents, fidèle
  au body, zéro chiffre inventé) : answer-first + tableau comparatif + verdicts
  spécifiques + FAQPage + JSON-LD enrichi (auteur Manon, dateModified, Speakable).

- `2d348f90` — **images Unsplash intercalées dans le corps** (l'item qui restait).
  `injectBodyImages` : 1-2 photos Unsplash contextuelles (requête dérivée des
  titres H2), `<figure>` avant les sections (jamais la 1re, hero prioritaire),
  attribution CGU §6 (figcaption), trigger download via provider, loading=lazy +
  width/height (CLS 0), stylées par `.prose-axionia`. Câblé au worker hors
  transaction, APRÈS la détection citations (liens attribution non comptés).
  Best-effort (pas de clé/rate-limit/erreur → corps inchangé). 8 tests verts.
  Doctrine « Unsplash uniquement » (Will). Active dès qu'`UNSPLASH_ACCESS_KEY`
  est posée + provider activé en DB.

**État : 100 % des items demandés FAITS (images incluses).** 15 commits sur
`feat/blog-templates-refonte`, NON poussés, typecheck 0 partout, tests verts.

⚠️ 3 efforts PARALLÈLES ont coexisté dans le working tree (citations [committé par
moi sur décision Will] ; copie home/Footer/messages [PAS touché, laissé] ;
backfill-article-citations.ts untracked [laissé]). Mes commits = `git add` ciblé,
jamais embarqué le travail des autres.

## VÉRIFICATION GEO/AEO + QUICK WINS (2026-06-22, 2e passe)

Vérif profonde 6 agents adversariaux. Scores AVANT quick wins : GEO citation 5,5 ·
schema 7 · méta/H1/keyword 7,5 · liens/RAG 7,5 · infra 8 · sections 5,5. Pas
« parfait » : socle solide, 2 dimensions faibles (citation IA + sections produites).

Quick wins livrés (commits `39033bfa`→`0bc09779`) :
- `39033bfa` — meta robots fines (googleBot max-snippet:-1/max-image-preview:large,
  centralisé seo.ts+layout → ~17k pages) + **robots.txt bloque le TRAINING**
  (GPTBot/ClaudeBot/anthropic-ai/Google-Extended/Applebot-Extended) et garde la
  CITATION (OAI-SearchBot/Claude-Web/+Claude-SearchBot/PerplexityBot/Bingbot).
  Décision Will : bloquer training / garder citation (UA distincts → 0 perte).
- `4bb24ea3` — ArticleSources rel via trust-tier (autorité dofollow) + nœud Person
  sur l'avis d'expert (@id /equipe/<slug>#person + worksFor Org) = désambiguïsation.
- `0c0dc458` — fleet 9 générateurs : **réponse 40-60 mots sous chaque H2** (`<p
  data-aeo="answer">`, levier citation IA #1) + stats sourcées inline imposées +
  définitions `<dfn>` + callouts `<aside class="callout">`. Effet à la prochaine génération.
- `34b8d6b6` — Speakable opt-in sur services/villes/tarifs (recentré sur le
  contenu-réponse) + sélecteur `[data-aeo="answer"]` (réponses par H2).
- `0bc09779` — keyword-in-H1 hard-gate étendu aux 12 types Phase-8 (avant : soft-score).

**Clés données par Will (à poser en Coolify, PAS dans le repo)** : `UNSPLASH_ACCESS_KEY`
(images corps) + `VOYAGE_API_KEY` (RAG vectoriel), scope web+worker.

**RESTE (honnête, non fait)** :
- Double signature « Vérifié par X » → NON fait volontairement : auto-tamponner un
  humain sur du contenu généré non relu = fausse allégation E-E-A-T. Capability à
  brancher sur un VRAI process de relecture (décision Will).
- ImageObject sur images de corps · validation schema CI (stub) · content-refresh-worker
  7-14j (stub) · newsletter/Trustpilot · /equipe/williams (photo/bio réelles requises) ·
  liens internes profonds article→article (catalogue statique) · gate longueur+keyword
  metaTitle runtime · peupler la KB publique.

## Reste Will (hors code)

- Revue visuelle sur prod/preview, puis `git push` → PR → merge.
- (Rien n'est poussé ; aucune migration ajoutée à ce stade.)
