# ADR 0005 — Navigation mega-menus : révision CLAUDE.md v6 §9.2

- **Statut** : proposed
- **Date** : 2026-05-07
- **Auteur** : Agent C (audit Header & Navigation 2026) — formalisation Claude Opus 4.7
- **Validation Will** : 8 STOP & ASK validés en bloc 2026-05-07. Implémentation **différée** — Will finit le frontend en cours avant Sprint 15.
- **ADRs liées** : `0001-stack-initial.md`, `0002-design-pivot-editorial-v3.md` (préserver doctrine éditoriale Editorial Premium v3), `0004-typography-baseline-upgrade-v3-1.md`, `0006-pseo-villes.md` (mega-menus rendent les pages pSEO atterrissables).

---

## Contexte

`CLAUDE.md` v6 §9.2 acte une politique « pas de dropdowns » dans le header (un clic = une page parent). Cette doctrine n'anticipe pas la croissance de surface SEO :

- 64 routes templates HEAD (`fd91518`) déjà supérieures aux 5 items du header initial.
- Pages éditoriales NEW (Sprint 14.5-14.8) : `/comparaisons`, `/glossaire`, `/guide-ia`, `/methodologie`, `/presse`, `/recherche`, `/stack-ia`.
- pSEO villes/régions à venir (cf. ADR 0006) : ~2150 villes >5000 hab + 13-18 régions = volume non atterrissable depuis un header 5 items sans menu.

L'audit Header & Navigation 2026 (`_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md` + 9 fichiers `_AUDIT/AUDIT-HEADER-*`) a évalué 2 voies :

- **Voie 1** : conserver « pas de dropdowns », ajouter pages dans le footer + breadcrumbs riches.
- **Voie 2** : autoriser des **mega-menus avec garde-fous** (3 mega-menus max, structure éditoriale, contenu navigable au clavier, fermeture explicite, mobile = drawer accordéon).

## Décision

**Voie 2 — mega-menus avec garde-fous** (Will validé Q4 2026-05-07).

### Garde-fous

1. **3 mega-menus max** dans le header desktop : Interventions / Audit / Implémentation. `Cas concrets` reste lien direct (CTA secondaire).
2. **Trigger** : hover (desktop ≥ 1024 px) ou clic explicite. Pas d'apparition par survol accidentel.
3. **Structure éditoriale** : 2-4 colonnes (sous-modules + 1 colonne « ressources liées » → guide-ia, methodologie, comparaisons selon contexte).
4. **Mobile** (< 1024 px) : drawer accordéon, jamais de mega-menu inline.
5. **A11y** : focus trap, ESC ferme, navigation clavier complète, `aria-expanded` correct, ouverture annoncée (`aria-live`).
6. **Performance** : contenu pré-rendu côté serveur (pas de hydration coûteuse).
7. **Doctrine v3 préservée** : couleur figée terracotta sur header (commit `941a8e1`) maintenue.

### Implémentation différée

Sprint 14.9 a livré l'audit ; Sprint 15 backend (Prisma) démarre prioritairement. L'implémentation des mega-menus est planifiée **après Sprint 15** pour ne pas bloquer le chantier backend.

## Conséquences

### Positives

- 64+ pages atterrissables depuis le header (vs 5 items + footer).
- Préparation atterrissage pSEO villes (ADR 0006).
- Cohérence avec sites éditoriaux premium (Anthropic, Stripe Press) qui utilisent mega-menus discrets.

### Négatives / À surveiller

- Complexité a11y mobile (drawer accordéon vs mega-menu desktop).
- Risque de dérive vers menus chargés (mitigation : 3 menus max + 4 colonnes max).
- Tests E2E Playwright à étendre (focus trap + ESC + clavier).

## Source détaillée

Voir `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` pour la justification complète, citations littérales du CLAUDE.md v6 §9.2, et les 8 STOP & ASK validés.
