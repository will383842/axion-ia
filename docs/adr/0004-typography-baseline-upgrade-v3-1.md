# ADR 0004 — Typography baseline upgrade (v3.1)

- **Statut** : Accepté
- **Date** : 2026-05-07
- **Auteur** : Will + Claude (Opus 4.7)
- **Référence** : delta v3.1 de l'ADR 0002 « Design pivot Editorial Premium v3 ». N'invalide pas la doctrine v3, la **précise** sur le baseline corps.
- **Audit source** : `_AUDIT/AUDIT-TYPOGRAPHY-2026.md` + `_AUDIT/typography-deltas.json` (2026-05-07).

---

## Contexte

L'ADR 0002 (Editorial Premium v3) a fixé la doctrine typographique : Manrope corps + Fraunces serif italique terracotta + Inconsolata mono, avec un type scale documenté dans `Design.md` chapitre 3.2 où `--text-body: 1 rem (16 px)` et `--text-caption: 0.875 rem (14 px)`.

Trois faits constatés le 2026-05-07 ont rendu cette définition insuffisante :

1. **Ressenti utilisateur** : Will a signalé que « tout est écrit en tout petit sauf le hero » sur l'ensemble des pages. Le ratio hero/body actuel est de **7.0×** (display 112 px / body 16 px), contre une médiane benchmark 2026 de **4.4×**.
2. **Benchmark 2026 (audit AGT-BENCH, 6 sites)** : Anthropic 18 px, Stripe Press 19 px, OpenAI 17-18 px, Vercel 16 px, Mistral 16-17 px, Linear 15 px. **Médiane = 17 px**. AxionIA à 16 px se situe en bas de fourchette, sous sa propre référence doctrinale (Anthropic, citée Design.md §1).
3. **Manrope x-height = 0.515**, soit **5.7 % inférieure à Inter (0.546)** et 3.7 % inférieure à Söhne (0.535). À taille égale, Manrope paraît visuellement plus petit. Le baseline 16 px Tailwind défaut, **non overridé dans `@theme`**, ne compense pas ce défaut physique de la fonte.

Conséquence : l'audit AGT-TOKENS a montré que **les 10 tokens custom `--text-*` sont DEAD CODE** (0 usage) et que 13/13 classes Tailwind utilisaient les defaults bruts. Le système typographique défini dans la doctrine **n'était pas appliqué dans le code**.

## Décision

Adopter le **scénario B « Premium »** de l'audit (vs A mesuré 17/15 et C généreux 19/16) :

| Token             | v3 (avant)               | v3.1 (après)   | Note                                 |
| ----------------- | ------------------------ | -------------- | ------------------------------------ |
| `--text-base`     | (default 16 px Tailwind) | **18 px**      | Override Tailwind, LH 1.7            |
| `--text-sm`       | (default 14 px Tailwind) | **15 px**      | Override Tailwind, LH 1.55           |
| `--text-body`     | 16 px                    | **18 px**      | Sync avec text-base                  |
| `--text-caption`  | 14 px                    | **15 px**      | Sync avec text-sm                    |
| `--text-lead`     | 22 px                    | **23 px**      | Ratio body/lead = 1.28 ≈ Major Third |
| `--text-display`  | 112 px max               | **112 px max** | Inchangé (clamp 3rem→7rem)           |
| `--text-section`  | 64 px                    | **64 px**      | Inchangé                             |
| `--text-sub`      | 36 px                    | **36 px**      | Inchangé                             |
| `--text-feature`  | 24 px                    | **24 px**      | Inchangé                             |
| `--text-label-up` | 13 px                    | **13 px**      | Inchangé (eyebrow uppercase)         |
| `--text-badge-up` | 12 px                    | **12 px**      | Inchangé                             |
| `--text-micro-up` | 10 px                    | **10 px**      | Inchangé                             |

Choix du scénario B (vs A) : la doctrine v3 cite explicitement Anthropic comme référence (Design.md §1, ADR 0002 §Direction). Anthropic = 18 px. Le scénario A (17 px) rejoint la médiane mais reste sous Anthropic. Le scénario B aligne le code sur ce que dit la doctrine.

Choix du scénario B (vs C) : Stripe Press (19 px) est un site **livre relié**, pas un site cabinet IA B2B. Aller à 19 px implique une refonte typo majeure (15-25 patches page-level) avec risque layout élevé sur RoiSimulator, BookingFlow, navigation. Hors-doctrine v3 actuelle.

## Patches page-level appliqués (en complément du token)

Inclus dans le même commit (Sprint 14.7) :

1. **`text-sm leading-relaxed` → `text-base leading-relaxed`** sur paragraphes descriptifs de cards (8 occurrences) :
   - `src/app/[locale]/audit/page.tsx:943, 1034, 1190` (et 675 via card pattern dupliqué).
   - `src/app/[locale]/interventions/page.tsx:675`.
   - `src/app/[locale]/interventions/essentielle/page.tsx:128`.
   - `src/app/[locale]/implementation/page.tsx:788` (pricing tier desc).
   - `src/app/[locale]/mes-donnees/page.tsx:87` (RGPD body).
   - `src/app/[locale]/glossaire/page.tsx:150` (définitions).
2. **H3 cards `text-lg` → `text-xl`** (3 occurrences) sur audit/interventions/implementation cards listing pour ratio H3/body ≥ 1.11 (vs 1.0 sans patch).
3. **`text-[14.5px]` → `text-base`** (2 occurrences) sur listes outcomes audit/interventions (`outcomes` items).
4. **`max-w-3xl` → `max-w-2xl`** sur paragraphes éditoriaux longs `/a-propos` Valeurs (line-length 85ch → 75ch).
5. **`max-w-3xl` → `max-w-2xl`** sur disclaimer audit/page.tsx:943.

## Conséquences

### Positives

- **Lisibilité** : +12.5 % sur body, +7.1 % sur sm. Compense le défaut x-height Manrope.
- **Cohérence doctrine ↔ code** : la doctrine v3.1 est maintenant **appliquée** (override `@theme` plutôt que défini-mais-non-utilisé).
- **Mesure de ligne** : `max-w-2xl` + body 18 px = **75 ch** (✓ pile dans fourchette 60-75 cible).
- **Ratio hero/body** : 7.0× → 6.2× (rejoint le haut de fourchette des benchmarks premium).

### À surveiller (Sprint 14.8 polish ou plus tard)

- **Hiérarchie H3/body** : avec body 18 px, H3 (text-xl = 20 px) donne ratio 1.11. Cible doctrine 2026 ≥ 1.5. Migration partielle vers `text-2xl` à évaluer si verdict visuel insuffisant après preview.
- **201 `text-[arbitrary]`** (ex `text-[11px]`, `text-[12px]`, `text-[15px]`) court-circuitent encore l'échelle modulaire. Pass de remplacement à programmer en sprint dédié.
- **Tokens custom `--text-display`, `--text-section`, etc.** restent définis dans `@theme` sans usage explicite dans le code (Tailwind v4 génère bien `text-display`, `text-section`… mais le code utilise `display-editorial` (classe utility custom) et headings via `text-3xl`/`text-4xl` Tailwind). Migration code vers ces tokens custom non-bloquante.
- **RoiSimulator, BookingFlow, FAQ** : revoir le layout dense après bump pour s'assurer qu'aucun container n'overflow.

### Rollback

- Revert ce commit suffit. Pas de migration de données ni d'index lié.
- Préserver toutefois la mise à jour `Design.md` 3.2 si le rollback ne va pas jusqu'au baseline 16 px (option : conserver scénario A 17/15 plus mesuré).

## Liens

- Audit : `_AUDIT/AUDIT-TYPOGRAPHY-2026.md`
- JSON deltas : `_AUDIT/typography-deltas.json`
- Prompt source : `_AUDIT/PROMPT-TYPOGRAPHY-2026.md`
- ADR parent : `0002-design-pivot-editorial-v3.md`
- Doctrine : `axionia/Design.md` chapitre 3 (mise à jour 2026-05-07)
