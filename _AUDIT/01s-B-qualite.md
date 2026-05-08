# Annexe B — Qualité intrinsèque des 18 skills `axionia-*`

**Date** : 06/05/2026 — soir, post-réécriture Webflow
**Mode** : audit READ-ONLY, scoring 0/1 sur 10 critères

---

## 1. Grille des 10 critères

| Critère | Définition                                                                                  |
| ------: | ------------------------------------------------------------------------------------------- |
|  **C1** | Frontmatter complet et valide (`name`, `description` ≤ 1024 caractères, pas de typo YAML)   |
|  **C2** | Description **actionable** (« quand charger », pas seulement « quoi »)                      |
|  **C3** | Règles **testables** (assertions vérifiables mécaniquement)                                 |
|  **C4** | Aucune ambiguïté (« si possible », « idéalement », « éventuellement »)                      |
|  **C5** | Exemples concrets ✅ et anti-exemples ❌ présents pour les règles non triviales             |
|  **C6** | Pas de duplication interne (même règle énoncée 2× dans le même fichier)                     |
|  **C7** | Pas de référence à un fichier/path qui n'existe plus                                        |
|  **C8** | Pas de citation périmée vs `_DECISIONS-FINALES.md` (06/05/2026 + Webflow soir)              |
|  **C9** | Style cohérent (FR, ton directif, listes plutôt que prose, ≤ 200 lignes utiles si possible) |
| **C10** | Pas de fuite secret/clé API/URL interne                                                     |

---

## 2. Tableau récap (score /10 + verdict)

| Skill                  | C1  | C2  | C3  | C4  | C5  | C6  | C7  | C8  | C9  | C10 |   Score   | Verdict    |
| ---------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-------: | ---------- |
| `axionia-core`         |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Référence  |
| `axionia-design`       |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Référence  |
| `axionia-anti-spa`     |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-mobile-first` |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  | **10/10** | Modèle     |
| `axionia-a11y`         |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-admin-ux`     |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  0  |  0  |  1  | **7/10**  | À corriger |
| `axionia-calendar`     |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-database`     |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-deployment`   |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-emails`       |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-forms`        |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-i18n`         |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-monitoring`   |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-performance`  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-rgpd`         |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  | **10/10** | Modèle     |
| `axionia-seo-aeo`      |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |
| `axionia-stack`        |  1  |  1  |  1  |  1  |  0  |  1  |  1  |  1  |  0  |  1  | **8/10**  | Bon        |
| `axionia-testing`      |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  1  |  0  |  1  | **9/10**  | Solide     |

**Score moyen global** : (9+9+9+10+9+7+9+9+9+9+9+9+9+9+10+9+8+9) / 18 = **9.0 / 10**

---

## 3. Détail des scores < 10

### 3.1 `axionia-admin-ux` — 7/10

#### C7 — Référence à un fichier/path qui n'existe plus

**Section 14, Layout admin** :

```tsx
// app/[locale]/(admin)/[admin-prefix]/layout.tsx
```

Le segment `[admin-prefix]` est un placeholder cosmétique : la convention Next.js App Router exige un nom de dossier littéral (l'URL secrète vient d'`ADMIN_URL_PREFIX` à l'exécution via rewrite/middleware). Le snippet laisse penser qu'on peut nommer un dossier `[admin-prefix]` avec brackets, ce qui est techniquement valide en Next.js mais induira une route catch-all parasite. À aligner sur la pratique réelle (groupe `(admin)` + middleware route reroute).

#### C8 — Citation périmée vs `_DECISIONS-FINALES.md` (Webflow 06/05 soir)

**Section « Différences fondamentales »** (ligne ~18) :

> « Style | B2B premium **McKinsey, sobriété 80% blanc** | Dense, fonctionnel… »

**Et ligne ~20** :

> « Couleurs | Charte reportée, neutres + 1 accent | Idem mais plus de contrastes »

Ces deux mentions sont **périmées** depuis la décision Webflow (06/05/2026 soir) actée dans `_DECISIONS-FINALES.md` et `axionia-core` :

- La référence McKinsey/Roland Berger doit être remplacée par « Webflow-inspired ».
- « Charte reportée » est obsolète : la charte est désormais figée (Webflow Blue + 6 secondaires).

#### C9 — Style cohérent / ≤ 200 lignes

- 272 lignes (au-dessus de la cible 200) — admissible compte tenu de la richesse du sujet (sidebar, RBAC, Tiptap, 2FA), mais le matrice de permissions pourrait être déplacée dans un sous-fichier ou un tableau plus serré.
- Note : utilisation d'emojis FR `🇫🇷` `🇬🇧` dans le code Tiptap (ligne ~150) — décoratif sur drapeaux, à remplacer par texte « FR » / « EN » pour cohérence avec « pas d'emoji décoratif » imposé par le glossaire harmonie (cf. annexe D).

### 3.2 `axionia-stack` — 8/10

#### C5 — Exemples concrets ✅/❌ pour règles non triviales

Le skill liste les choix techniques (« Next.js 15 », « Tailwind v4 ») mais offre **peu d'anti-exemples ❌** explicites au format des autres skills. Les anti-patterns sont implicites (« Vercel interdit ») mais non illustrés par des snippets ❌/✅ comme dans `axionia-anti-spa` ou `axionia-design`. Ajouter une section « Anti-patterns » (5-8 cas) renforcerait la testabilité.

#### C9 — Style cohérent

- 251 lignes (légèrement au-dessus de 200).
- Structure majoritairement tabulaire (très bonne lisibilité), mais manque la section « Checklist avant merge » présente dans 16 autres skills `axionia-*` — la finir améliorerait la cohérence avec le reste du pack.

### 3.3 Autres skills à 9/10 — défaut C9 commun

Tous les autres skills à 9/10 perdent leur point sur **C9 (style cohérent ≤ 200 lignes utiles)** :

| Skill                 | Lignes | Cible 200 | Dépassement |
| --------------------- | -----: | --------: | ----------: |
| `axionia-anti-spa`    |    374 |       200 |       +87 % |
| `axionia-a11y`        |    210 |       200 |        +5 % |
| `axionia-calendar`    |    311 |       200 |       +56 % |
| `axionia-core`        |    212 |       200 |        +6 % |
| `axionia-database`    |    490 |       200 |      +145 % |
| `axionia-deployment`  |    526 |       200 |      +163 % |
| `axionia-design`      |    465 |       200 |      +133 % |
| `axionia-emails`      |    447 |       200 |      +124 % |
| `axionia-forms`       |    341 |       200 |       +71 % |
| `axionia-i18n`        |    306 |       200 |       +53 % |
| `axionia-monitoring`  |    304 |       200 |       +52 % |
| `axionia-performance` |    233 |       200 |       +17 % |
| `axionia-seo-aeo`     |    607 |       200 |      +204 % |
| `axionia-testing`     |    316 |       200 |       +58 % |

Ces dépassements sont **largement justifiés** par la densité technique (snippets Prisma, configs Caddyfile, exemples Tiptap, etc.). Le critère C9 ≤ 200 reste cependant une cible théorique : ne pas pénaliser fortement, mais documenter le constat dans le plan de correction (P2 polish).

### 3.4 Skills à 10/10

`axionia-mobile-first` (162 lignes) et `axionia-rgpd` (218 lignes — légèrement au-dessus mais densité justifiée par le tableau de traitements + sous-traitants) sont **les modèles d'équilibre** du pack : courts, denses, exemples ✅/❌ partout, checklist finale, ton directif strict.

---

## 4. Plan de correction priorisé

### P0 — Critique (à corriger avant livraison Phase 1.S)

1. **`axionia-admin-ux` § « Différences fondamentales »** : retirer les mentions « McKinsey, sobriété 80% blanc » et « Charte reportée » → remplacer par « **Webflow-inspired** (palette Webflow Blue + 6 secondaires disciplined, voir `axionia-design`) ». Garder la distinction admin desktop-first / vitrine mobile-first (légitime).
2. **`axionia-admin-ux` § Tiptap** : remplacer les emojis drapeaux `🇫🇷` `🇬🇧` par les codes textuels « FR · EN » dans le composant `ContentLocaleToggle` pour cohérence avec la doctrine « pas d'emoji décoratif » imposée à l'admin.

### P1 — Améliorations (souhaitables Phase 1.S)

3. **`axionia-stack`** : ajouter une section « Anti-patterns » (5-8 puces ✅/❌) et une « Checklist avant merge » comme dans les 16 autres skills, pour homogénéité.
4. **`axionia-admin-ux` § Layout admin** : préciser dans le snippet `// app/[locale]/(admin)/[admin-prefix]/layout.tsx` que `[admin-prefix]` n'est PAS un dossier dynamique Next.js, mais une **valeur runtime** (cf. `ADMIN_URL_PREFIX` env). Soit utiliser `(admin)` group route + middleware, soit renommer le placeholder pour lever l'ambiguïté.
5. **`axionia-i18n`** et **`axionia-forms`** : la phrase « Resend / SendGrid / Mailgun / Brevo formellement interdits — voir le skill `axionia-emails` » apparaît dans les deux ; envisager une centralisation dans `axionia-core` (déjà fait — donc retirer la duplication et renvoyer simplement à `axionia-core` pour réduire la charge cognitive et les risques de divergence).
6. **`axionia-design` § « Cohérence avec autres skills »** mentionne `axionia-mobile-first` mais pas `axionia-performance` — ajouter pour cohérence (`shadow-card` 5-couches a un coût compositing, bonne occasion de croiser le sujet perf).

### P2 — Polish (post-Phase 1.S)

7. Poursuivre la **réduction des longueurs** sur `axionia-seo-aeo` (607 lignes) et `axionia-deployment` (526 lignes) : externaliser certains snippets longs (Caddyfile complet, config PowerMTA full) dans `docs/` plutôt qu'inline dans le SKILL.md, pour ramener < 400 lignes.
8. **Frontmatter unifié** : ajouter `allowed-tools:` sur les skills très ciblés (ex. `axionia-database` pourrait limiter à `Read, Edit, Bash`, `axionia-anti-spa` à `Read, Edit, Grep`). Ce serait à débattre avec Will : aujourd'hui aucun des 18 ne contraint les outils, ce qui laisse Claude libre — c'est un choix défendable mais non documenté.
9. **Test de longueur description** automatisé : aucune description des 18 skills ne dépasse 1024 caractères (vérifié manuellement, max ~510 char sur `axionia-monitoring` et `axionia-emails`). Ajouter un linter CI sur frontmatter pour blinder ce point dans le futur.
10. **`axionia-rgpd`** § « Sous-traitants » : l'adresse de l'AKI (« Tatari 39, 10134 Tallinn ») mérite vérification (le skill mentionne « adresse à vérifier » — bonne pratique mais à clore avant livraison).

---

## 5. Fuites secrets / clés API / URLs internes (C10)

Audit complet des 18 SKILL.md :

- ✅ Aucune clé API, token, mot de passe en clair
- ✅ Aucune URL d'admin interne en clair (l'URL admin passe partout via `[ADMIN_URL_PREFIX]` placeholder)
- ✅ Tous les domaines techniques utilisent les variantes publiques (`mailwizz.axion-ia.com`, `mail.axion-ia.com`, `plausible.axion-ia.com`) — ce sont des sous-domaines publics légitimes documentés
- ⚠️ `axionia-deployment` § Caddyfile mentionne `<bcrypt_hash>` en placeholder — c'est explicitement un placeholder, pas une fuite
- ⚠️ `axionia-emails` § DKIM laisse une commande de génération de clé privée (`/etc/pmta/dkim/axionia.pem`) — attendu (procédure documentée), pas de clé exposée

**Conclusion C10** : 18/18 propres.

---

## 6. Citations périmées vs `_DECISIONS-FINALES.md` (C8) — vue détaillée

| Skill                       | Citation périmée                             | Localisation                | Sévérité |
| --------------------------- | -------------------------------------------- | --------------------------- | -------- |
| `axionia-admin-ux`          | « B2B premium McKinsey, sobriété 80% blanc » | § Différences fondamentales | **P0**   |
| `axionia-admin-ux`          | « Charte reportée »                          | § Couleurs                  | **P0**   |
| Tous les autres `axionia-*` | (aucune trouvée)                             | —                           | —        |

Les 16 autres skills `axionia-*` ont été mis à jour proprement :

- `axionia-core` § 3 : direction Webflow-inspired explicite avec `#146ef5` + ADR
- `axionia-design` : entièrement réécrit Webflow (465 lignes)
- `axionia-mobile-first`, `axionia-performance`, `axionia-monitoring` : budgets stricts cohérents (LCP < 1.8s, INP < 80ms, CLS < 0.05)
- `axionia-stack`, `axionia-deployment` : Auth.js v5 (pas NextAuth.js historique), PowerMTA + MailWizz (pas Resend), Hetzner (pas Vercel)
- `axionia-emails`, `axionia-forms`, `axionia-i18n` : rappels Resend/SendGrid interdits (cohérent avec décision)

**Conclusion C8** : 17/18 alignés. Seul `axionia-admin-ux` à mettre à jour (P0).

---

## 7. Synthèse opérationnelle

| Indicateur                  | Valeur                                         |
| --------------------------- | ---------------------------------------------- |
| Score moyen                 | **9.0 / 10**                                   |
| Nombre de skills < 8/10     | **1** (`axionia-admin-ux` à 7/10)              |
| Nombre de skills à 10/10    | **2** (`axionia-mobile-first`, `axionia-rgpd`) |
| Frontmatters valides        | **18 / 18**                                    |
| Descriptions actionables    | **18 / 18**                                    |
| Citations Webflow correctes | **17 / 18**                                    |
| Fuites secrets/clés         | **0**                                          |
| Anti-exemples ❌ présents   | **17 / 18** (manque `axionia-stack`)           |

→ Le pack est **livrable** moyennant les 2 corrections P0 sur `axionia-admin-ux` et les 4 améliorations P1 (recommandées avant Phase 1.X).
