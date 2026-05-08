# ADR 0003 — Navigation mega-menus : révision CLAUDE.md v6 §9.2 (PROPOSITION)

- **Statut** : Accepté en bloc 2026-05-07 (Will valide Voie 2 — mega-menus avec garde-fous). Implémentation différée — Will finit le frontend en cours avant Sprint 15. Renommage en `axionia/docs/adr/0005-navigation-mega-menu.md` reporté au début Sprint 15.
- **Statut historique** : DRAFT — en attente validation Will (STOP & ASK explicite du prompt source)
- **Date** : 2026-05-07
- **Auteur** : Agent C (audit Header & Navigation 2026)
- **Contexte parent** : `_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md` v1.3
- **ADR liées** : `axionia/docs/adr/0001-stack-initial.md`, `axionia/docs/adr/0002-design-pivot-editorial-v3.md` (préserver doctrine éditoriale Editorial Premium v3), `axionia/docs/adr/0004-typography-baseline-upgrade-v3-1.md`
- **Note de numérotation** : ce fichier vit dans `_AUDIT/` car il n'est pas encore validé. Une fois accepté par Will, il sera renommé `axionia/docs/adr/0005-navigation-mega-menu.md` (les slots 0003 et 0004 sont déjà occupés dans `axionia/docs/adr/`).

---

## Contexte

### Citation littérale CLAUDE.md v6 §9.2

> ### 9.2 Pourquoi pas de dropdowns
>
> Volonté d'épure : **un clic = une page**. Les sous-pages des modules sont accessibles depuis la page parent (qui les présente toutes). Avantages :
>
> - Header plus léger visuellement
> - UX plus rapide (pas de menu à survoler)
> - Mobile-friendly natif (pas de menus à reproduire en accordéon)
> - SEO meilleur : les pages parents reçoivent du jus de lien depuis le header

(Source : `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` lignes 353-359, version v6 selon journal de bord lignes 826-839 et 866-890.)

### Citations connexes (cohérence doctrinale)

§9.1 — _« Header desktop : `[Logo monogramme] [Interventions entreprise] [Audit & optimisation] [Implémentation IA] [Cas concrets] [CTA Réserver · 490 €] [FR · EN]` »_ (ligne 340) — chaque item est un lien direct, jamais un trigger de menu.

Tableau §9.1 ligne 346 — _« 2. « Interventions entreprise » | Lien direct vers /interventions (pas de dropdown) »_.

§20 « Anti-patterns » (ligne 743, table récapitulative) — _« Header avec dropdowns lourds | Casse l'épure mobile | Liens directs vers pages parents »_.

§22 / Journal 06/05/2026 v4 (ligne 881) — _« Header sans dropdowns : un clic = une page parent (qui présente les sous-pages) »_.

§22 / Journal v4 ligne 908 — _« Header ÉPURÉ : Logo + Interventions entreprise + Audit & optimisation + Implémentation IA + Cas concrets + CTA + langue — PAS de dropdowns »_.

### Le « pourquoi » historique — analyse

La doctrine §9.2 ne masque pas son raisonnement : il est explicite et énuméré. Quatre justifications, dans cet ordre :

1. **Esthétique / signature** — _« Header plus léger visuellement »_. Cohérent avec §9 _« épuré, moderne, expérience utilisateur exceptionnelle »_ (ligne 335) et avec la doctrine Editorial Premium v3 (ADR 0002) qui privilégie la respiration éditoriale plutôt que la densité d'information SaaS B2C.
2. **Performance perçue / UX** — _« UX plus rapide (pas de menu à survoler) »_. Une décision pondérée : pas de hover-intent à calibrer, pas de delta-flag, pas de risque de fermeture intempestive.
3. **Mobile-first absolu** — _« Mobile-friendly natif (pas de menus à reproduire en accordéon) »_. Cette règle est doublement ancrée : §22 / v4 ligne 890 _« Mobile-first c'est non négociable »_, et le drawer mobile §9.4 (lignes 374-404) liste 9 entrées en plat (pas d'accordéon).
4. **SEO link-juice** — _« les pages parents reçoivent du jus de lien depuis le header »_. Décision d'architecture d'information : concentrer le PageRank interne sur 4 hubs (Interventions, Audit, Implémentation, Cas concrets) plutôt que de le diffuser sur 12-20 sous-pages exposées en mega-menu.

**Aucune justification a11y explicite n'est citée**, mais le ZERO dropdown élimine de facto plusieurs surfaces WCAG 2.2 sensibles : `aria-haspopup`, `aria-expanded`, focus trap, ESC-to-close, gestion `prefers-reduced-motion` sur ouvertures, intra-menu keyboard navigation.

**Aucune justification performance JS explicite n'est citée**, mais le ZERO dropdown maintient le Header en 100 % Server Component — alignement direct avec §8 / §16 budgets perf v5 (LCP < 1.8 s, INP < 80 ms, CLS < 0.05, JS first load < 80 KB, Lighthouse > 95) et avec la doctrine RSC/Islands cited ailleurs dans CLAUDE.md.

**Verdict** : §9.2 est une décision défendable et bien argumentée pour le périmètre **5 destinations principales** (4 modules + Cas concrets) dimensionné par v4 / v6.

---

## Pression de scale

Trois pressions convergent en post-Sprint 14 et rendent le périmètre v6 insuffisant :

### Pression 1 — Catalogue IA officielle (`/stack-ia` + sous-pages outils)

La page `/stack-ia` (FR) / `/ai-stack` (EN) a été livrée 2026-05-07 (mémoire `axionia_stack_ia_page.md`) avec 11 outils en 5 fonctions et un parti-pris « monogrammes pas logos ». Will prépare une refonte non committée (Working Tree +108/-81 sur `page.tsx`, prompt source ligne 492). Le format actuel = page hub unique. Si l'évolution prévoit une sous-page par outil (Claude, GPT, Mistral, Whisper, Replicate, Cursor, etc.), on passe de **1 destination** à **1 hub + ~11 enfants**, soit 12 nœuds dans un sous-arbre — trop pour rester invisible depuis le header sans dégrader la découvrabilité du catalogue.

### Pression 2 — 15 régions FR (programmatic SEO mid-tail)

15 pages régions en hub-spoke pur signifie : soit un hub `/implantations` qui liste les 15 régions, soit 15 entrées brutes au footer. **Aucune des deux options n'est exposable depuis un header 5-7 items.** L'approche `/implantations` hub est la voie naturelle compatible §9.2 (un clic → page parent → 15 cards régions).

### Pression 3 — ~3 500 villes FR > 5 000 hab (programmatic SEO long-tail)

C'est le facteur de bascule. À cette échelle :

- **Sitemap** : 3 500 URLs côté `/villes/{slug}` exigent un sitemap dédié (limite 50 000 URLs / fichier, mais sitemaps multiples conseillés > 1 000). `axionia/src/app/sitemap.ts` (`buildDynamic`) doit être étendu — c'est une décision architecturale, pas un détail.
- **Header** : exposer 3 500 entrées dans le header est exclu par construction (§9.2 ou pas).
- **Hub `/implantations`** : doit lister les régions ; les villes sont accessibles depuis chaque page régionale (3 niveaux : `/implantations` → `/implantations/{region}` → `/implantations/{region}/{ville}`).
- **Risque Google Helpful Content Update / doorway pages** : 3 500 templates clonés = pénalité quasi-certaine (interdit absolu §INTERDITS du prompt source). La différentiation éditoriale par ville devient le vrai chantier — pas la nav.

**Synthèse** : la pression 3 ne réclame **aucune** révision de §9.2 (les villes ne montent jamais dans le header de toute façon). La pression 1 (catalogue IA) en réclame une **possible** si on veut donner accès direct aux outils. La pression 2 (régions) en réclame une **optionnelle** — on peut très bien rester en hub-spoke.

L'enjeu réel, contre-intuitivement, est donc plus étroit que la formulation initiale du prompt : **« faut-il ajouter au plus 1-2 mega-menus pour le catalogue IA et l'arborescence implantations, sachant que les 3 500 villes ne sont pas concernées ? »**.

---

## Voies envisagées

### Voie 1 — Maintien strict §9.2

**Description**
Header actuel **inchangé** : Logo + Interventions + Audit & optimisation + Implémentation + Cas concrets + CTA + FR/EN. Toutes les nouvelles surfaces deviennent des hubs accessibles **uniquement via clic explicite** :

- `/stack-ia` (existant) reste page-monolithe ; si découvrabilité par outil nécessaire, la page hub elle-même fournit ancres + filtre côté client.
- `/implantations` = nouveau hub avec carte cliquable SVG France + grille 15 régions + lien profond vers villes.
- Catalogue IA et Implantations vivent dans le **footer** (Zone Ressources, alignée avec le déplacement Blog du header au footer §22/v4 ligne 913).

**Coûts**

- **UX** : 3 clics minimum pour atteindre une ville (`/` → `/implantations` → `/implantations/{region}` → ville). +1 clic vs Voie 2.
- **Découvrabilité catalogue IA** : un visiteur qui cherche « Claude » doit deviner que `/stack-ia` existe — pas d'amorce visuelle dans le header.
- **Profil B2B** : DSI/dirigeants sur desktop ont l'habitude des mega-menus (Anthropic, Vercel, Linear, Stripe). L'absence peut signaler « petit cabinet » plutôt que « cabinet IA premium ».

**Bénéfices**

- **Doctrine intacte**. Aucun ADR à valider, aucun mot à écrire dans CLAUDE.md.
- **Perf** : Header 100 % Server Component, JS first-load inchangé, INP intact.
- **A11y** : zéro nouvelle surface ARIA à tester, zéro régression possible WCAG 2.2 AA.
- **Mobile** : drawer plat conservé, pas d'accordéon imbriqué.
- **SEO link-juice** : concentré sur 4 hubs principaux comme prévu §9.2.

**Verdict**
Voie défendable, **sous-optimale pour le scénario PERFECTION 2026**. Privilégie la pureté doctrinale sur la fonction de découvrabilité. Compatible si Will accepte que le catalogue IA et les implantations vivent dans le footer + la sitemap programmatique.

---

### Voie 2 — Révision §9.2 (mega-menus avec garde-fous)

**Description**
ADR formel autorise les mega-menus pour exactement **deux** entrées du header, encadrées par garde-fous explicites :

- **« IA & Solutions »** (mega-menu n°1) — déclenche un panneau éditorial 3-4 colonnes : (a) « Modèles & assistants » (Claude, GPT, Mistral, Llama), (b) « Voix & multimodal » (Whisper, ElevenLabs), (c) « Code & agents » (Cursor, Replit, agents custom), (d) « Voir tout `/stack-ia` ».
- **« Implantations »** (mega-menu n°2) — panneau éditorial 2 colonnes : (a) carte SVG mini France cliquable, (b) liste des 15 régions en grid + lien « Toutes les villes ».
- Les autres entrées (Interventions, Audit, Implémentation, Cas concrets) **restent liens directs** (§9.2 maintenue pour ces 4-là).
- Header desktop devient : `[Logo] [Interventions] [Audit] [Implémentation] [IA & Solutions ▾] [Implantations ▾] [Cas concrets] [CTA] [FR/EN]` — soit 7 items + 2 triggers + CTA.

**Garde-fous obligatoires** (cf. section dédiée ci-dessous) :

- Max 2 mega-menus, max 2 niveaux de profondeur.
- Design éditorial cohérent ADR 0002 (terracotta `#c24a1b`, Fraunces italique pour eyebrows, ivoire `#faf8f3`).
- WCAG 2.2 AA strict.
- Mobile : pas de mega-menu, drawer accordéon plat avec ancres internes.
- Border-line client component minimaliste : seul le trigger + panneau hydratent, le reste du Header reste RSC.

**Coûts**

- **A11y** : 2 surfaces nouvelles à instrumenter (`aria-haspopup="menu"`, `aria-expanded`, focus trap intra-menu, ESC, hover-intent ~150 ms, escape outside-click). Risque WCAG si bâclé.
- **Perf JS** : ajout estimé +6-10 KB gzip pour le composant mega (variant Radix UI Menu adapté ou home-made minimal). Reste sous le budget §16 si bien isolé en client component.
- **Mobile** : duplication du contenu mega → drawer accordéon (pas de mega sur mobile). Ajoute deux sections au drawer §9.4 — gérables.
- **Doctrine** : §9.2 doit être réécrite (cf. Plan de migration). Coût rédactionnel + traçabilité ADR.
- **Risque éditorial** : un mega-menu mal designé ressemble à un site SaaS B2C — exactement la tension qu'ADR 0002 a corrigée. Discipline visuelle forte requise.

**Bénéfices**

- **Découvrabilité** : 1 clic pour atteindre Claude, GPT, Mistral depuis n'importe quelle page → impact direct sur AEO/GEO (citation par Perplexity/ChatGPT d'Axion-IA quand requête « cabinet IA Mistral » par ex).
- **UX desktop** : aligne Axion-IA sur les références B2B premium (Anthropic, Vercel, Linear, Stripe). Signal de maturité du cabinet.
- **Profil PERFECTION 2026** : seul scénario qui permet d'exposer simultanément le catalogue + les implantations sans surcharger le footer.
- **Architecture future-proof** : si ajout d'une 12ème ou 15ème surface (ex: « Recherche IA », « Cas concrets sectoriels »), un mega-menu peut absorber ; un header plat ne le peut pas.

**Verdict**
Voie naturelle pour **PERFECTION 2026**. Coût a11y/perf maîtrisable avec discipline. C'est celle proposée comme décision principale ci-dessous.

---

### Voie 3 — Hybride (mega-menus minimalistes)

**Description**
Compromis entre Voie 1 et Voie 2 :

- **« IA & Solutions »** trigger ouvre un panneau **réduit** : 5 liens max en colonne unique (« Modèles », « Voix », « Code & agents », « Voir tout `/stack-ia` ») — pas de preview cards, pas d'icônes outils, pas d'eyebrow éditorial.
- **« Implantations »** : pas de mega-menu, lien direct vers `/implantations` (qui contient la carte cliquable et les 15 régions).
- Style « simple list dropdown », pas « editorial mega ».

**Compromis**

- **A11y** : 1 surface (au lieu de 2) — `aria-haspopup="menu"` + focus trap minimal. Plus simple à tester et auditer.
- **Perf** : surcoût JS minimal (~3-4 KB gzip).
- **Découvrabilité IA** : OK pour les fonctions ; sub-optimale pour les outils nominaux (Claude, GPT — accessibles seulement via `/stack-ia`).
- **Découvrabilité régions** : retombe sur Voie 1 (3 clics jusqu'à une ville).
- **Doctrine** : §9.2 doit quand même être révisée (un dropdown reste un dropdown, même minimaliste). Coût rédactionnel ADR identique à Voie 2.
- **Esthétique** : moins risqué qu'un mega « editorial » ; plus terne aussi. Risque de tomber dans le « petit menu de startup », pas la signature « cabinet premium ».

**Verdict**
Voie pragmatique, **mais elle paie le coût ADR de la Voie 2 sans en récolter le bénéfice maximal**. Si on révise §9.2, autant le faire pour de bon. À retenir uniquement comme **plan B** si Will refuse les mega-menus full-éditoriaux et ne veut pas non plus rester strict §9.2.

---

## Décision proposée — Voie 2 (révision §9.2 avec garde-fous)

**Trois raisons concrètes** :

1. **C'est la seule voie compatible avec le brief PERFECTION 2026 du prompt source.** Le prompt cite explicitement le scénario PERFECTION 2026 ligne 442 — _« mega-menus complets (Voie 2 avec ADR), ⌘K avancé (Pagefind/Meilisearch), pSEO 3500 villes templates différenciées, schema partout »_. Voie 1 et Voie 3 dégradent la PERFECTION en STANDARD ou MIN par construction. Refuser Voie 2 = refuser le brief.

2. **Le coût a11y/perf est maîtrisable et chiffrable, le coût UX du refus est diffus et permanent.** Les garde-fous WCAG 2.2 AA sont écrits, testables (axe-core CI, Playwright keyboard tests), et localisés à 2 composants client. Inversement, garder §9.2 strict force l'enfouissement permanent du catalogue IA dans `/stack-ia` ou le footer — déficit de découvrabilité chronique, non corrigible sans nouvelle ADR plus tard. Mieux vaut payer le coût a11y une fois bien que de payer le coût UX en continu.

3. **Le ratio bénéfice doctrine / bénéfice business est défavorable au statu quo.** §9.2 est défendue avec 4 arguments : esthétique (préservée par garde-fou design ADR 0002), UX rapide (préservée par hover-intent + RSC pour le reste), mobile (préservée — pas de mega sur mobile), SEO link-juice (préservée — les hubs `/stack-ia` et `/implantations` reçoivent toujours le lien header). **Aucun des 4 arguments §9.2 n'est invalidé par Voie 2 correctement implémentée.** §9.2 a été écrite pour 5 destinations ; elle n'a pas anticipé le catalogue IA + les implantations. La réviser n'est pas la trahir, c'est la prolonger.

---

## Garde-fous a11y / perf si Voie 2 retenue (ou Voie 3)

### A11y — WCAG 2.2 AA strict

- Trigger button : `aria-haspopup="menu"` + `aria-expanded={open}` + `aria-controls={panelId}`. Texte visible accompagné d'un chevron rotatif (rotation gérée via CSS, pas JS).
- Panneau : `role="menu"` (ou `role="region"` + `aria-label` si contenu mixte non-menu pur), focus initial sur premier item au open par clavier (pas au open par hover/click souris).
- **Focus trap** intra-menu : Tab/Shift+Tab cyclent dans le panneau, ESC ferme et retourne focus sur le trigger.
- **Outside-click** ferme. **Outside-focus** ferme aussi (`focusout` non capturé).
- **Keyboard nav** : flèches ↓/↑ entre items, Enter/Space active le lien.
- **Hover-intent** ~150 ms (Apple HIG / Linear) — empêche l'ouverture intempestive sur survol traversant. Implémentation `setTimeout` cleanup au mouseleave.
- **`prefers-reduced-motion: reduce`** : transitions opacity/transform passent à `transition: none`. Pas de skeleton, pas de fade.
- **Contraste** : tous les liens dans le panneau passent AA (4.5:1) sur fond ivoire `#faf8f3` ; eyebrows uppercase passent AA (3:1) si ≥ 18 px / 14 px gras.
- **Touch targets** : ≥ 44×44 px par item (mais hors-scope mobile car pas de mega sur mobile — voir ci-dessous).
- **Tests** : Playwright `aria-snapshot` + axe-core CI sur les deux variantes (open/closed).

### Mobile — pas de mega-menu

Le drawer §9.4 (ligne 390-404) accueille les nouvelles surfaces **en plat** :

- Section « IA & Solutions » avec sous-items inline (pas d'accordéon imbriqué) — ou un accordéon **non-imbriqué** (1 niveau seulement) si la liste dépasse 6-7 items.
- Section « Implantations » → un seul lien `Implantations` qui mène au hub `/implantations`. Pas de liste de régions dans le drawer (économie de hauteur).
- Justification : §9.2 _« Mobile-friendly natif (pas de menus à reproduire en accordéon) »_ — on **respecte cet argument** sur mobile en ne reproduisant pas les mega-menus.

### Perf — chirurgie client component

- **Border-line client component** : seul `<HeaderMenuTrigger>` + `<HeaderMenuPanel>` sont `"use client"`. Le `<Header>` racine, le `<Logo>`, le `<NavLink>` direct, le `<CTAButton>` (si stable) restent **Server Component**.
- **Code-splitting** : le `<HeaderMenuPanel>` est dynamiquement importé (`next/dynamic` avec `loading: () => null` pour éviter CLS) — il n'entre dans le bundle que si l'utilisateur survole/focus le trigger.
- **Pas de Radix UI complet** si le poids dépasse 8 KB gzip pour le seul Menu — préférer une implémentation home-made minimale ou `@radix-ui/react-dropdown-menu` ciblé (~5 KB).
- **Budget §16** : `JS first-load < 80 KB`. Mesure obligatoire post-Sprint avec `next build --analyze`. Hard fail CI si dépassement.
- **LCP** : pas d'impact direct (le panneau n'est pas sur le critical path). Vérifier que le trigger lui-même n'introduit pas de hydration delay > 50 ms — sinon revenir en server-rendered + progressive enhancement.
- **CLS** : panneau en `position: absolute` + `transform`, jamais en flow document. CLS contribution = 0.

### Esthétique — alignement ADR 0002

- Fond panneau : `--color-bg` (`#faf8f3` ivoire) ou `--color-paper` (`#ffffff` blanc pur si on veut contraster avec terracotta du header). À tester visuellement.
- Eyebrow colonnes : `text-label-up` (13 px tracking 0.16em) en `--color-fg-muted`.
- Liens : `text-base` (18 px post-ADR 0004) en `--color-fg`. Hover → `--color-terracotta`.
- Cards/preview : si retenues (Voie 2 maximale), `--radius-xl` (20 px), shadow ton-chaud signature 5-couches.
- Pas d'icônes outils si non standardisés (cf. mémoire `axionia_stack_ia_page.md` — « monogrammes pas logos »). Reproduire ce parti-pris dans le mega.
- **Halo** : `.bg-halo-warm` autorisé en arrière-plan du panneau si discrétion (≤ 30 % opacity).

### Contraintes intouchables (rappel)

- Fond `bg-terracotta` du header : **interdit de toucher**, même en Voie 2.
- Logo (badge ivoire + Axion-IA serif italique) : **interdit de toucher**.
- WCAG 2.2 AA : non-négociable.

---

## Conséquences

### Positives

- Catalogue IA et arborescence Implantations exposés en 1 clic depuis le header → impact AEO/GEO direct (Perplexity / ChatGPT plus enclins à citer une page accessible en 1 clic depuis racine).
- Axion-IA aligne son DOM-info-architecture sur les références B2B premium 2026 (Anthropic, Vercel, Linear, Stripe) — signal de maturité « cabinet IA opérationnel » (cf. mémoire `axionia_naming_cabinet.md`).
- Doctrine §9.2 réécrite proprement plutôt que contournée — traçabilité ADR (pratique stipulée mémoire `axionia_audit_pattern.md` : empiler des prompts/ADR plutôt que patcher).
- Architecture future-proof pour ajout d'une 3ème pression de scale (recherche IA, secteurs, partenariats) : un mega-menu peut absorber.

### Négatives / À surveiller

- **Risque dérive éditoriale** : si la discipline ADR 0002 (terracotta + Fraunces + ivoire) n'est pas tenue, le mega-menu pousse Axion-IA vers le SaaS B2C — exactement la tension qu'ADR 0002 a corrigée. Garde-fous esthétiques **non négociables**.
- **Surcoût a11y QA** : 2 nouveaux composants client → +30-45 min de revue WCAG par PR touchant le Header. Ajouter checklist explicite dans le template de PR.
- **Surcoût Playwright** : 4-6 nouveaux tests (open trigger, close ESC, focus trap, keyboard arrows, prefers-reduced-motion, mobile drawer accordéon).
- **Surveillance INP** : hover-intent + outside-click listener ajoutent 2 listeners globaux au document. Mesurer INP P75 post-déploiement (cible ≤ 80 ms cf. §8 v5).
- **Risque drift §9.2** : si Voie 2 acceptée puis si pression future réclame un 3ème mega-menu, refuser sans nouvelle ADR. Le texte §9.2-bis (cf. Plan de migration) doit cap à 2.

### Sprints / audits impactés

- **Sprint 14.x ou Sprint 15** : implémentation des 2 mega-menus + drawer mobile mis à jour + tests Playwright + axe-core gate.
- **Mémoire `axionia_progress.md`** : à mettre à jour après merge.
- **`_AUDIT/PROMPT-FRONTEND-AUDIT-V14-2026.md`** chapitre Doctrine — ajouter référence à cette ADR (la doctrine HEAD inclura les mega-menus).
- **`_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md`** v1.3 — ce prompt devient validé en aval ; pas de réécriture.
- **`Wireframes-Briefs-Axion-IA/02-Page-Accueil.md` et fichiers wireframes header** — à mettre à jour en cohérence si présents.
- **`axionia/Design.md`** chapitre Header — section à ajouter sur les mega-menus.

---

## Alternatives rejetées

1. **Maintien strict §9.2 (Voie 1)** — rejetée parce qu'incompatible avec le brief PERFECTION 2026 du prompt source ligne 442. Voie acceptable seulement si Will révise le brief vers STANDARD ou MIN.
2. **Hybride mega minimaliste (Voie 3)** — rejetée parce qu'elle paie le coût ADR de la Voie 2 sans le bénéfice maximal. Plan B uniquement si Will refuse l'éditorial mega.
3. **Mega-menu unique « Tout » avec 4-5 colonnes condensées** — rejetée : recrée un sitemap-header (anti-pattern §22 ligne 743 _« Header avec dropdowns lourds | Casse l'épure mobile »_), exactement ce que §9.2 a voulu éviter.
4. **Sticky sidebar de navigation persistante (à la Stripe Docs)** — rejetée : casse la doctrine éditoriale (Hero pleine largeur, respiration ADR 0002), incompatible mobile-first, déplace le problème sans le résoudre.
5. **Dropdowns simples (un par lien, sans mega editorial)** — rejetée : cumule les inconvénients (a11y obligatoire, doctrine cassée) sans le bénéfice catalogue (pas assez d'espace pour exposer 11 outils + carte régions).

---

## Plan de migration §9.2 → §9.2-bis (si Voie 2 retenue)

### Texte proposé pour CLAUDE.md v6 / v7 §9.2-bis

```markdown
### 9.2 Dropdowns et mega-menus — règle de surface

**Principe par défaut** : un clic = une page. Les liens directs depuis le header
(Interventions, Audit & optimisation, Implémentation IA, Cas concrets) restent
sans dropdown — un clic mène à la page parent qui présente les sous-pages.

**Exception encadrée** : exactement DEUX entrées du header peuvent ouvrir un
mega-menu éditorial, et seulement celles-ci :

1. « IA & Solutions » → catalogue Stack IA (ouvre `/stack-ia` + sous-pages outils)
2. « Implantations » → arborescence régions/villes (ouvre `/implantations` + régions)

Ces deux mega-menus suivent les garde-fous de l'ADR `0005-navigation-mega-menu.md`
(ex `_AUDIT/adr-0003-...PROPOSITION.md`) :

- **Max 2 mega-menus** dans tout le header. Toute proposition d'un 3ème exige
  une nouvelle ADR explicite (pas de patch silencieux).
- **Max 2 niveaux** de profondeur dans le panneau (eyebrow + liens, pas de
  sous-sous-menu).
- **Design éditorial ADR 0002** : ivoire `#faf8f3` ou paper `#ffffff`, terracotta
  pour hover, Fraunces italique pour eyebrows, pas d'icônes outils non
  standardisés.
- **WCAG 2.2 AA strict** : aria-haspopup, aria-expanded, focus trap, ESC,
  outside-click, keyboard nav (flèches), hover-intent ~150 ms, respect
  prefers-reduced-motion.
- **Pas de mega sur mobile** : le drawer §9.4 reste plat (accordéon 1 niveau
  max). L'argument « Mobile-friendly natif » de la version v6 est préservé.
- **Border-line client component** : seul le trigger + panneau hydratent ; le
  reste du Header reste Server Component. Budget JS first-load < 80 KB
  inchangé (§16).

**Avantages préservés** (vs version v6) :

- Header visuellement épuré : 7 items + CTA + langue (vs 5 + CTA + langue), reste
  largement sous le seuil de surcharge.
- Mobile inchangé.
- SEO link-juice : les hubs `/stack-ia` et `/implantations` reçoivent toujours
  le lien depuis le header.

**Avantages ajoutés** :

- Catalogue IA et arborescence Implantations en 1 clic (vs 2-3) → impact AEO/GEO.
- Profil cabinet B2B premium aligné sur Anthropic/Vercel/Linear/Stripe.

**Anti-pattern §20 mis à jour** : « Header avec dropdowns lourds » devient
« Header avec ≥ 3 mega-menus » — la limite stricte est 2.
```

### Processus de réécriture (séquentiel)

1. **Validation Will** sur cette ADR PROPOSITION (STOP & ASK).
2. **Si OK** : renommage `_AUDIT/adr-0003-...PROPOSITION.md` → `axionia/docs/adr/0005-navigation-mega-menu.md` (slots 0003 et 0004 occupés). Mise à jour statut `accepted`.
3. **Édition CLAUDE.md** §9.2 → §9.2-bis avec le texte ci-dessus. Bump version v6 → v7.
4. **Édition §9.1 tableau** ligne 346 : _« Lien direct vers /interventions (pas de dropdown) »_ reste valable pour Interventions/Audit/Implémentation/Cas concrets. Ajouter 2 lignes pour les mega-menus.
5. **Édition §20 anti-patterns** ligne 743 : _« Header avec ≥ 3 mega-menus »_ (au lieu de _« dropdowns lourds »_ sans seuil chiffré).
6. **Édition §22/v4 ligne 908** : reformuler _« PAS de dropdowns »_ → _« 2 mega-menus encadrés (cf. ADR 0005) + 5 liens directs »_.
7. **Sprint 15 ou 14.x** : implémentation. Tests Playwright + axe-core gate ajoutés au CI.
8. **Mémoire `axionia_progress.md`** : entrée datée pour traçabilité.

### Garde de réversibilité

Si après mise en prod l'INP P75 dépasse 80 ms, ou si l'audit a11y axe-core échoue, ou si le verdict visuel post-déploiement signale un drift SaaS B2C : **rollback** = revert du commit feat header + édition CLAUDE.md à §9.2 v6. Pas de migration de données. Pas de coût utilisateur (mémoire courte, pas de conditionnement). Garder l'ADR 0005 active en `superseded` pour traçabilité.

---

## Liens

- **Doctrine source** : `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` §9.1 / §9.2 / §9.4 / §20 / §22 (lignes 333-409, 743, 881, 908).
- **Prompt parent** : `_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md` v1.3 (Méthodologie §Agent C ligne 400-409, scénario PERFECTION 2026 ligne 442, INTERDITS ligne 448-454).
- **ADR liées** : `axionia/docs/adr/0001-stack-initial.md`, `axionia/docs/adr/0002-design-pivot-editorial-v3.md`, `axionia/docs/adr/0003-lift-formation-ban.md`, `axionia/docs/adr/0004-typography-baseline-upgrade-v3-1.md`.
- **Mémoires Will** : `axionia_audit_pattern.md` (empiler ADR), `axionia_design_pivot.md` (terracotta + serif italique fait foi), `axionia_stack_ia_page.md` (monogrammes pas logos), `axionia_naming_cabinet.md` (« cabinet IA opérationnel »), `axionia_perf_audit_2026-05-07.md` (lenteur clics — surveiller INP).
- **Audits parents (cross-refs)** : `_AUDIT/AUDIT-FRONTEND-V14-2026-B.md` (navigation/header observations Sprint 14).

---

> **Action attendue de Will** : valider Voie 2 (recommandée) OU Voie 1 / Voie 3 OU demander une 4ème voie. Tant que cette ADR est en `DRAFT`, **CLAUDE.md §9.2 reste intouchée** — c'est un STOP & ASK explicite, pas une demande implicite de patch.
