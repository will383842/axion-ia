# Pages manquantes & URLs orphelines — Backlog

> Généré le 2026-05-20. Mis à jour à chaque sprint.
> Source : audit des `urlCible` dans `src/content/keywords/` vs routes dans `src/app/[locale]/`.

---

## ✅ LIVRÉES (cette session)

| URL                                    | Fichier                                                  | Date       |
| -------------------------------------- | -------------------------------------------------------- | ---------- |
| `/fr/codage-developpement/`            | `app/[locale]/codage-developpement/page.tsx`             | 2026-05-20 |
| `/fr/codage-developpement/web-digital` | `app/[locale]/codage-developpement/web-digital/page.tsx` | 2026-05-20 |

---

## 🔴 PRIORITÉ HAUTE — à faire en prochain sprint

### Module codage-developpement (G3 seeds)

| URL cible                      | Keywords source                            | Notes            |
| ------------------------------ | ------------------------------------------ | ---------------- |
| `/fr/codage-developpement/pme` | `g3-implementation-codage.ts` KW_CODAGE_G3 | Page service PME |
| `/fr/codage-developpement/eti` | `g3-implementation-codage.ts` KW_CODAGE_G3 | Page service ETI |

### Module implémentation (G3 seeds existants)

| URL cible                    | Keywords source                                    | Notes                    |
| ---------------------------- | -------------------------------------------------- | ------------------------ |
| `/fr/implementation/pme`     | `g3-implementation-codage.ts` KW_IMPLEMENTATION_G3 | Page hub PME             |
| `/fr/implementation/eti`     | `g3-implementation-codage.ts` KW_IMPLEMENTATION_G3 | Page hub ETI             |
| `/fr/implementation/startup` | `g3-implementation-codage.ts` KW_IMPLEMENTATION_G3 | Page hub Startup/Scaleup |

---

## 🟠 PRIORITÉ MOYENNE — Sprint secteurs (session dédiée ~3-4h)

### Pages secteurs G7A — Tertiaire (7 pages)

Route à créer : `app/[locale]/secteurs/[slug]/page.tsx` (dynamique)

| Slug                   | Label                    | Seeds source                          |
| ---------------------- | ------------------------ | ------------------------------------- |
| `banque-finance`       | Banque & Finance         | `g7a-secteurs-tertiaire.ts` × 8 seeds |
| `assurance`            | Assurance & Mutuelles    | `g7a-secteurs-tertiaire.ts` × 8 seeds |
| `immobilier-pro`       | Immobilier professionnel | `g7a-secteurs-tertiaire.ts` × 8 seeds |
| `cybersecurite`        | Cybersécurité            | `g7a-secteurs-tertiaire.ts` × 8 seeds |
| `communication-medias` | Communication & Médias   | `g7a-secteurs-tertiaire.ts` × 8 seeds |
| `energie-cleantech`    | Énergie & Cleantech      | `g7a-secteurs-tertiaire.ts` × 8 seeds |
| `maritime-portuaire`   | Maritime & Portuaire     | `g7a-secteurs-tertiaire.ts` × 8 seeds |

### Pages secteurs G7B — Industrie (à compléter)

| Slug                       | Label                    | Seeds source                |
| -------------------------- | ------------------------ | --------------------------- |
| `industrie-manufacturiere` | Industrie manufacturière | `g7b-secteurs-industrie.ts` |
| `construction-btp`         | Construction & BTP       | `g7b-secteurs-industrie.ts` |
| `chimie-pharma`            | Chimie & pharmacie       | `g7b-secteurs-industrie.ts` |
| `automobile-mobilite`      | Automobile & mobilité    | `g7b-secteurs-industrie.ts` |
| `sante-biotech`            | Santé & biotech          | `g7b-secteurs-industrie.ts` |
| `agroalimentaire-igp`      | Agroalimentaire          | `g7b-secteurs-industrie.ts` |
| _(autres slugs g7b)_       | —                        | `g7b-secteurs-industrie.ts` |

### Pages secteurs G7C — Conso/Culture (à compléter)

| Slug          | Label | Seeds source                    |
| ------------- | ----- | ------------------------------- |
| _(slugs g7c)_ | —     | `g7c-secteurs-conso-culture.ts` |

---

## 🟡 PRIORITÉ BASSE — Générées automatiquement

### Articles blog (G3B + G3 + G4 + G7)

Ces articles seront **générés automatiquement par le content engine** (`blog-from-keywords.ts`).
Ne pas créer manuellement.

| URL exemple                                       | Source seed | Statut         |
| ------------------------------------------------- | ----------- | -------------- |
| `/fr/blog/integrer-ia-application-nextjs-laravel` | G3B         | Content engine |
| `/fr/blog/recherche-ia-site-ecommerce`            | G3B         | Content engine |
| `/fr/blog/augmenter-conversions-ecommerce-ia`     | G3B         | Content engine |
| `/fr/blog/comment-implementer-ia-entreprise`      | G3          | Content engine |
| `/fr/blog/budget-implementation-ia-pme`           | G3          | Content engine |
| _(+50 autres)_                                    | G3/G4/G7    | Content engine |

### Pages FAQ AEO

La route `/fr/faq/[slug]` **existe déjà** en dynamique.
Le contenu sera alimenté par le content engine depuis les seeds `intent: "aeo"`.

| URL exemple                           | Source seed |
| ------------------------------------- | ----------- |
| `/fr/faq/comment-ajouter-ia-site-web` | G3B         |
| `/fr/faq/ia-relation-client-banque`   | G7A         |
| `/fr/faq/risques-ia-banque`           | G7A         |
| _(+30 autres)_                        | G4/G7       |

---

## 📋 CHECKLIST POUR LE SPRINT SECTEURS

Avant de démarrer le sprint secteurs :

- [ ] Lire `src/content/knowledge/sector-tags.ts` pour la liste complète des slugs
- [ ] Créer `app/[locale]/secteurs/[slug]/page.tsx` (route dynamique unique)
- [ ] Créer `src/content/secteurs.ts` (contenu par secteur)
- [ ] Ajouter `/secteurs/[slug]` dans `routing.ts`
- [ ] Ajouter lien "Secteurs" dans le nav ou footer
- [ ] Ajouter `generateStaticParams` avec les slugs définis

---

_Fichier maintenu manuellement. Mettre à jour à chaque sprint._
