# CHANGELOG — Corrections P0 Design.md & CLAUDE.md

> Date : 2026-05-06
> Scope : 2 corrections P0 critiques sur les fichiers de doctrine racine.
> Mode : Edits ciblés READ-ONLY sauf cibles + ce CHANGELOG.

---

## Fix 1 — `Design.md` racine — Avertissement police propriétaire Webflow

**Fichier** : `C:\Users\willi\Documents\Projets\Axion-IA\AxionIA_Dossier_FINAL_ABSOLU_v10.1\Design.md`

**Section** : `## 3. Typography Rules` (insertion après le titre, avant `### Font: WF Visual Sans Variable, fallback: Arial`)

### Justification

La police `WF Visual Sans Variable` mentionnée dans `Design.md` (lignes 5, 10, 47, 82) est **propriétaire de Webflow** et **non distribuable publiquement** pour des sites tiers. Aucun avertissement ne signalait ce verrou juridico-technique.

L'**ADR `docs/adr/0001-design-direction-webflow.md`** (acceptée 06/05/2026) et le journal CLAUDE.md v6 (entrée 06/05/2026 soir, ligne 817) actaient déjà :

> « WF Visual Sans Variable est propriétaire Webflow → substitué par Manrope (Google Fonts gratuite) »

… mais ce verrou n'était PAS reflété dans `Design.md` racine, qui restait la source de doctrine visuelle. Risque de régression : un futur agent ou développeur pouvait croire la police installable.

`CLAUDE.md` §7 (lignes 270-273) confirme également :

> « Police principale : Manrope (Google Fonts, variable, gratuite — substitut open-source de WF Visual Sans Variable propriétaire) »

### Diff — AVANT

```markdown
## 3. Typography Rules

### Font: `WF Visual Sans Variable`, fallback: `Arial`
```

### Diff — APRÈS

```markdown
## 3. Typography Rules

> ⚠️ **Note technique AxionIA** : `WF Visual Sans Variable` est une police **propriétaire de Webflow**, **non disponible publiquement** pour les sites tiers.
>
> **Substitut adopté pour AxionIA** : **Manrope** (Google Fonts, variable, gratuite, look proche). Voir `axionia-design/SKILL.md` § Typographie.
>
> Alternative payante (si licence achetée) : GT Walsheim Pro, Aeonik Pro, Söhne — auto-hostées via `next/font/local`.

### Font: `WF Visual Sans Variable`, fallback: `Arial`
```

**Ajout complémentaire** dans le tableau typographique pour cohérence : ligne « Substitut AxionIA » référençant Manrope, juste après la ligne `Code: Inconsolata`.

---

## Fix 2 — `CLAUDE.md` ligne 92 — Suppression du mot « training » (équivalent EN de « formation » banni)

**Fichier** : `C:\Users\willi\Documents\Projets\Axion-IA\AxionIA_Dossier_FINAL_ABSOLU_v10.1\CLAUDE.md`

**Ligne** : 92 (section `## 3. INTERNATIONALISATION (i18n)` → « Règles éditoriales » → traduction des modules)

### Justification

`CLAUDE.md` §2 « RÈGLES ABSOLUES DE LANGAGE » (lignes 45-53) bannit explicitement le mot « **formation** » :

> « Le mot "formation" est BANNI partout. Toujours utiliser :
>
> - "formation" → "intervention"
> - "formateur" → "intervenant"
>   [...]
>   Une intervention = concret, chez le client, résultat immédiat. AxionIA ne fait pas de formations. »

Le skill `axionia-core` §1 (règles non négociables) reprend ce ban absolu.

Or, **« training » est l'équivalent EN exact de « formation »** dans le registre B2B/L&D. Laisser passer « Corporate AI training sessions » dans la traduction officielle EN trahit le positionnement (« AxionIA ne fait pas de formations ») et créera un dissonance vendeur direct sur les pages /en/ du site, tout en cassant la cohérence du lint check prévu (CLAUDE.md §20 ligne 739 : « Mot "formation" utilisé → Lint check »).

### Diff — AVANT

```markdown
- « Interventions entreprise » ↔ « Corporate AI training sessions » (ou « Corporate interventions »)
```

### Diff — APRÈS

```markdown
- « Interventions entreprise » ↔ « Corporate AI sessions » (ou « Corporate interventions ») — ⚠️ **JAMAIS « training »** (équivalent EN de « formation », banni cf. `axionia-core` §1)
```

### Vérification transverse

Recherche `grep -i "training"` sur `CLAUDE.md` après correction → **1 seule occurrence** restante, qui est précisément la note explicite « JAMAIS training » (interdiction). Aucune autre mention résiduelle. ✅

---

## Récapitulatif

| Fix | Fichier     | Lignes touchées                                  | Type         |
| --- | ----------- | ------------------------------------------------ | ------------ |
| 1   | `Design.md` | +6 lignes (bloc avertissement) + 1 ligne tableau | Insertion    |
| 2   | `CLAUDE.md` | 1 ligne (ligne 92)                               | Remplacement |

**Fichiers modifiés** : 2 (Design.md, CLAUDE.md)
**Fichier créé** : 1 (ce CHANGELOG)
**Aucun autre fichier touché.**

---

## Références doctrinales

- `axionia-core` §1 — Règles non négociables (bannissement « formation »)
- `CLAUDE.md` §2 — Règles absolues de langage (lignes 45-53)
- `CLAUDE.md` §20 — Erreurs fréquentes (ligne 739 : lint check « formation »)
- `CLAUDE.md` §7 — Charte visuelle (lignes 270-273 : Manrope substitut Webflow)
- `docs/adr/0001-design-direction-webflow.md` — ADR direction visuelle Webflow-inspired (06/05/2026)
- `axionia-design/SKILL.md` § Typographie — Détails Manrope + Inconsolata
