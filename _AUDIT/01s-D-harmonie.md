# Annexe D — Harmonie & conventions des 18 skills `axionia-*`

**Date** : 06/05/2026 — soir, post-réécriture Webflow
**Mode** : audit READ-ONLY

---

## 1. Dimensions d'harmonie évaluées

|     Dim | Définition                                                                                                   |
| ------: | ------------------------------------------------------------------------------------------------------------ |
|  **D1** | Ton directif (impératif strict, jamais conditionnel mou)                                                     |
|  **D2** | Langue FR systématique (titres/prose)                                                                        |
|  **D3** | Personne grammaticale homogène (tu/vous/impersonnel)                                                         |
|  **D4** | Vocabulaire métier verrouillé (« intervention », « OÜ estonienne », « Implémentation IA », « Cas concrets ») |
|  **D5** | Citations fichiers projet (`docs/_DECISIONS-FINALES.md`, paths plutôt que numéros doc)                       |
|  **D6** | Structure SKILL.md cohérente (titre H1, contexte, règles, ✅/❌, anti-patterns, checklist)                   |
|  **D7** | Triggers ancrés dans la `description` (FR + EN keywords)                                                     |
|  **D8** | Aucun emoji décoratif (sauf marqueurs structurés ✅ ❌ ⚠️ 🔴 🟢)                                             |
|  **D9** | Cohérence Webflow (palette + Manrope + radius 4-8 + shadow 5 couches + translate(6px))                       |
| **D10** | Référence à `axionia-core` comme parent doctrinal                                                            |

---

## 2. Matrice d'harmonie (skill × dimensions)

Légende : `✓` = conforme · `~` = partiel · `✗` = non conforme · `–` = non applicable.

| Skill                  | D1  | D2  |           D3           | D4  | D5  |          D6          | D7  |      D8      |         D9          |      D10      |
| ---------------------- | :-: | :-: | :--------------------: | :-: | :-: | :------------------: | :-: | :----------: | :-----------------: | :-----------: |
| `axionia-core`         |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          ✓          |  – (parent)   |
| `axionia-design`       |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          ✓          |       ✓       |
| `axionia-anti-spa`     |  ✓  |  ✓  |   ✓ (tu sporadique)    |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          | ~ (implicite) |
| `axionia-mobile-first` |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          | ~ (implicite) |
| `axionia-a11y`         |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          | ~ (implicite) |
| `axionia-admin-ux`     |  ✓  |  ✓  |    ✓ (impersonnel)     |  ~  |  ✓  |          ✓           |  ✓  | ✗ (drapeaux) | ✗ (McKinsey périmé) |       ~       |
| `axionia-calendar`     |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ~       |
| `axionia-database`     |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ~       |
| `axionia-deployment`   |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ✓       |
| `axionia-emails`       |  ✓  |  ✓  | ~ (mix tu/impersonnel) |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ✓       |
| `axionia-forms`        |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ✓       |
| `axionia-i18n`         |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ✓       |
| `axionia-monitoring`   |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ~       |
| `axionia-performance`  |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ✓       |
| `axionia-rgpd`         |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          | ~ (implicite) |
| `axionia-seo-aeo`      |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ~       |
| `axionia-stack`        |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  | ~ (pas de checklist) |  ✓  |      ✓       |          –          |       ✓       |
| `axionia-testing`      |  ✓  |  ✓  |    ✓ (impersonnel)     |  ✓  |  ✓  |          ✓           |  ✓  |      ✓       |          –          |       ~       |

**Score harmonie global** :

- D1 ton directif : 18 / 18 ✓
- D2 FR systématique : 18 / 18 ✓
- D3 personne grammaticale : 17 / 18 (~ sur `axionia-emails`)
- D4 vocabulaire verrouillé : 17 / 18 (~ sur `axionia-admin-ux`)
- D5 citations fichiers : 18 / 18 ✓
- D6 structure SKILL.md : 17 / 18 (~ sur `axionia-stack`)
- D7 triggers ancrés : 18 / 18 ✓
- D8 zéro emoji décoratif : 17 / 18 (✗ sur `axionia-admin-ux`)
- D9 cohérence Webflow : `axionia-design` ✓ référence, `axionia-core` ✓, `axionia-admin-ux` ✗ (citation périmée). N/A pour les 15 autres car ils ne touchent pas au visuel.
- D10 référence à `axionia-core` : 8 / 17 explicites + 9 implicites ; à standardiser

---

## 3. Liste des écarts détectés

### 3.1 Écarts P0 (à corriger avant livraison Phase 1.S)

#### E1 — `axionia-admin-ux` cite McKinsey + « charte reportée » (D9)

**Citation actuelle** :

> « Style | B2B premium **McKinsey**, sobriété 80% blanc »
> « Couleurs | **Charte reportée**, neutres + 1 accent »

**Standardisation à appliquer** :

> « Style | B2B premium **Webflow-inspired** (cf. `axionia-design`) — admin desktop-first |
> « Couleurs | Webflow Blue + neutres, contrastes élevés pour densité admin »

#### E2 — `axionia-admin-ux` emojis drapeaux (D8)

**Citation actuelle** (composant `ContentLocaleToggle`) :

> `<TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>`
> `<TabsTrigger value="en">🇬🇧 English</TabsTrigger>`

**Standardisation à appliquer** :

> `<TabsTrigger value="fr">FR · Français</TabsTrigger>`
> `<TabsTrigger value="en">EN · English</TabsTrigger>`

(cf. règle « Aucun emoji décoratif » de `axionia-core` et `axionia-design`)

### 3.2 Écarts P1 (à corriger Phase 1.S si possible)

#### E3 — `axionia-emails` mix tu / impersonnel (D3)

Plusieurs occurrences de « tu connais déjà (SOS-Expat) », « tu maîtrises déjà » au lieu de la formulation impersonnelle adoptée par les 17 autres skills (« déjà maîtrisé via SOS-Expat »).

**Localisation** : sections « PowerMTA » et « MailWizz » du SKILL.md.

#### E4 — `axionia-stack` manque checklist finale (D6)

Tous les autres skills `axionia-*` se terminent par une « Checklist avant merge » ou « Checklist [thème] ». `axionia-stack` se termine par un tableau « Performance budgets » sans checklist actionable. À ajouter pour cohérence structurelle.

#### E5 — Référence à `axionia-core` non systématique (D10)

8 skills sur 17 référencent explicitement `axionia-core` ; 9 le font implicitement (mention de « projet Axion-IA », « société estonienne », « formation banni »). À standardiser : chaque SKILL.md devrait commencer par une ligne du type :

> « > Doctrine parente : `axionia-core` (à charger systématiquement avant). »

### 3.3 Écarts P2 (polish post-Phase 1.S)

#### E6 — Longueur des skills très variable

De 162 lignes (`axionia-mobile-first`) à 607 (`axionia-seo-aeo`). Pour les skills > 400 lignes, externaliser les longs snippets de configuration dans `docs/skills/` afin de ramener tous les SKILL.md sous 400 lignes utiles.

#### E7 — Format de description varie (présence/absence quotes YAML)

- 14 skills `axionia-*` : description sans quotes
- 0 skills `axionia-*` : description entre quotes
- (Pour comparaison, certains skills externes utilisent `description: "..."` ou format YAML multi-ligne `description: >`)

À standardiser sur une seule convention. Pas de quotes (style actuel) reste recommandé tant qu'aucune description n'inclut de caractère YAML problématique (`:`, `#`, `&`).

---

## 4. Recommandation : skill « modèle »

Le **skill modèle** à imposer comme référence pour aligner les autres est une combinaison de :

- **`axionia-core`** (212 lignes) — pour la **structure doctrinale** et la liste des skills enfants ;
- **`axionia-design`** (465 lignes) — pour la **densité technique avec ✅/❌ explicites** et la cohérence Webflow ;
- **`axionia-mobile-first`** (162 lignes) — pour la **concision** ;
- **`axionia-rgpd`** (218 lignes) — pour le **ton directif strict** sur des sujets juridiques (anti-patterns clairs).

→ **Skill modèle officiel** : **`axionia-core` (doctrine) + `axionia-design` (densité technique)**, comme imposé par leur réécriture du 06/05/2026 soir.

Tous les autres skills doivent vérifier qu'ils :

1. **Démarrent par un H1** « # Axion-IA — [domaine] »
2. Référencent `axionia-core` explicitement dès l'introduction
3. Listent leurs **règles non négociables** en numéroté ou tableau
4. Fournissent **au moins 3 exemples ✅ et 3 anti-exemples ❌**
5. Listent des **anti-patterns** dans une section dédiée
6. **Concluent par une checklist** « avant merge » ou « avant publication »
7. Utilisent **zéro emoji décoratif** (sauf marqueurs structurels ✅ ❌ ⚠️ 🔴 🟢 🎯 🎨)
8. Restent **sous 400 lignes** (cible : 200-300)

---

## 5. Glossaire commun à imposer (10 termes)

À uniformiser dans tous les SKILL.md `axionia-*` (et plus largement dans copy projet) :

| Terme banni                                              | Terme imposé                                          | Justification                     |
| -------------------------------------------------------- | ----------------------------------------------------- | --------------------------------- |
| « formation »                                            | **« intervention »**                                  | Décision Will + RGPD + SEO        |
| « formateur »                                            | **« intervenant »**                                   | Idem                              |
| « former »                                               | **« accompagner »** ou « faire monter en compétence » | Idem                              |
| « cas clients »                                          | **« cas concrets »**                                  | Plus engageant (CLAUDE.md §4)     |
| « Mise en place »                                        | **« Implémentation IA »**                             | Module 3 renommé                  |
| « SARL » / « SAS » / « SIREN » / « SIRET »               | **« OÜ estonienne »** + « **registrikood** »          | Société estonienne                |
| « TVA française »                                        | **« TVA EE »**                                        | Idem                              |
| « CNIL »                                                 | **« AKI »** (Andmekaitse Inspektsioon)                | Autorité estonienne               |
| « McKinsey / Roland Berger » (référence visuelle)        | **« Webflow-inspired »**                              | Décision 06/05 soir               |
| « Calendly »                                             | **« calendrier maison »**                             | Calendly abandonné                |
| « Resend / SendGrid / Mailgun / Brevo » (services email) | **« PowerMTA + MailWizz »**                           | Stack maison                      |
| « Vercel » (en tant qu'hébergeur)                        | **« Hetzner Frankfurt »**                             | UE + cohérence société estonienne |

→ Note : `@vercel/og` (package npm) et `motion` (ex-Framer Motion) restent autorisés (libs OSS, pas l'hébergeur Vercel) — distinction explicite dans `axionia-core` § Skills GÉNÉRIQUES.

---

## 6. Conventions de citation des fichiers projet

### 6.1 Convention adoptée (cohérente sur 17/18 skills)

Citer les fichiers par **path relatif au repo** :

- ✓ `docs/_DECISIONS-FINALES.md`
- ✓ `Design.md` (racine)
- ✓ `docs/adr/0001-design-direction-webflow.md`
- ✓ `axionia-package/CLAUDE.md`
- ✓ `prisma/schema.prisma`
- ✓ `app/[locale]/(public)/...`

### 6.2 Convention à éviter (présente partiellement)

Référencer un **numéro de doc** sans path :

- ✗ « doc 18 » / « doc 24 » / « doc 27 » (CLAUDE.md mentionne ces numéros pour rétrocompatibilité, mais ils peuvent bouger)
- ✗ « § X.Y » sans rappel du fichier

→ Préférer toujours le path. Les numéros de docs n'apparaissent QUE dans `CLAUDE.md` (légitime, table récap §22) et dans 1-2 skills sous forme de référence croisée brève (« cf. doc 24 ») — à supprimer de ces 1-2 skills au profit du path.

---

## 7. Synthèse — checklist d'alignement à appliquer

Pour amener tous les `axionia-*` au niveau du modèle `core + design` :

- [ ] **P0** : `axionia-admin-ux` → remplacer « McKinsey, sobriété 80% blanc » et « Charte reportée » par référence Webflow + `axionia-design`
- [ ] **P0** : `axionia-admin-ux` → retirer les emojis drapeaux 🇫🇷 🇬🇧 dans le snippet `ContentLocaleToggle`
- [ ] **P1** : `axionia-emails` → uniformiser le ton vers impersonnel (« tu connais déjà » → « déjà maîtrisé »)
- [ ] **P1** : `axionia-stack` → ajouter section « Anti-patterns » + « Checklist avant merge »
- [ ] **P1** : tous les skills sauf `axionia-core` → ajouter en tête une ligne « > Doctrine parente : `axionia-core` (à charger systématiquement avant) »
- [ ] **P2** : externaliser les snippets > 50 lignes des skills > 400 lignes vers `docs/skills/`
- [ ] **P2** : décider d'une convention unique pour le frontmatter `description` (sans quotes — actuel)
- [ ] **P2** : ajouter `allowed-tools:` selon la nature du skill (ex. `axionia-anti-spa` → `Read, Edit, Grep`)
- [ ] **P2** : retirer toute référence « doc N » au profit de path relatifs

---

## 8. Conclusion

L'harmonie globale du pack `axionia-*` est **forte** (17/18 alignés sur les dimensions critiques) grâce à la réécriture coordonnée du 06/05/2026 soir (`axionia-core` + `axionia-design` + `_DECISIONS-FINALES.md` + ADR 0001).

**Une seule divergence majeure** subsiste : `axionia-admin-ux` n'a pas été mis à jour pour le pivot Webflow et conserve la mention McKinsey + « charte reportée » + emojis drapeaux. Ces deux corrections (P0) suffisent à amener tout le pack à un niveau d'harmonie supérieur à 95 %.

Les 5 améliorations P1 + P2 sont **utiles mais non bloquantes** pour la livraison Phase 1.S. Elles peuvent être traitées dans une passe de cohérence dédiée, possiblement via le skill `claude-md-improver` invoqué périodiquement.
