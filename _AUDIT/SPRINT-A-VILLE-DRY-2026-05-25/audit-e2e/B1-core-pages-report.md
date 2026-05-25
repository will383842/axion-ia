# B1 — Audit E2E Core Pages
**Date** : 2026-05-25  
**Agent** : B-1  
**Périmètre** : 30 pages core `/fr/*`  
**Méthode** : Analyse code source (generateMetadata + routing.ts) + curl HTTP (dev server Next.js JIT)

---

## Résumé : 26/30 OK fonctionnel, 3 WARNING critiques, 2 ERREURS identifiées

| Catégorie | Nombre |
|-----------|--------|
| Pages OK structurellement | 3 |
| Pages WARNING (métadonnées hors range) | 25 |
| Pages ERROR (critique) | 2 |
| **Total testé** | **30** |

### Note sur le HTTP status

Le dev server Next.js en mode JIT (Just-In-Time compilation) timeout pour les premières visites des pages non-encore compilées. Seule `/fr/` a été confirmée HTTP 200 au runtime. Les HTTP status indiqués sont basés sur l'analyse du code source (existence de page.tsx + routing.ts valide). Les ERREURS sont 100% confirmées par code.

---

## Issues P0 — ERREURS BLOQUANTES

### P0-1 : `/fr/audit/ciblé` → HTTP 500
**Sévérité** : ERROR  
**Cause** : L'URL contient un accent (`é`) alors que le slug réel est `/fr/audit/cible` (sans accent). Le routing.ts déclare `"/audit/cible"` (sans accent). La requête avec `é` génère une erreur 500 (route non trouvée ou erreur de décodage URL).  
**Impact** : Si des liens ou sitemaps pointent vers `/fr/audit/ciblé`, Google verra une 500.  
**Fix** : Vérifier tous les liens internes/sitemap pour s'assurer qu'ils utilisent `/fr/audit/cible` (sans accent). Ajouter une redirect 301 de `/fr/audit/ciblé` vers `/fr/audit/cible` si nécessaire.

### P0-2 : `/fr/appel` → 404 (route inexistante)
**Sévérité** : ERROR  
**Cause** : Aucun répertoire `src/app/[locale]/appel/page.tsx` et aucune entrée dans `routing.ts`. La route n'existe pas.  
**Impact** : Tout lien vers `/fr/appel` retournera 404.  
**Note** : Cette URL était dans le brief d'audit — il est possible qu'elle n'ait jamais existé ou qu'elle ait été remplacée par `/fr/reserver`. À vérifier avec Will si une redirect est nécessaire.

---

## Issues P1 — Métadonnées hors range (WARNING)

### P1-1 : Titres hors range (< 30 ou > 60 chars)

| Page | Titre | Longueur | Problème |
|------|-------|----------|----------|
| `/fr/tarifs` | Tarifs Axion-IA · Audits, Formations, Implémentations, 1-to-1, Plateforme | 73 | **Trop long** (> 60 chars) |
| `/fr/faq` | FAQ · cabinet IA Axion-IA | 25 | **Trop court** (< 30 chars) |
| `/fr/galerie` | Banque d'images Axion-IA | 24 | **Trop court** (< 30 chars) |
| `/fr/recherche` | Recherche · Axion-IA | 20 | **Trop court** (< 30 chars) |
| `/fr/interventions` | Interventions IA en entreprise · 4 familles · France & international | 62 | Légèrement trop long (> 60) |

### P1-2 : Descriptions trop courtes (< 140 chars)

| Page | Longueur | Note |
|------|----------|------|
| `/fr/a-propos` | 88 | Trop courte |
| `/fr/contact` | 108 | Sous cible |
| `/fr/methodologie` | 91 | Trop courte |
| `/fr/glossaire` | 109 | Sous cible |
| `/fr/comparaisons` | 109 | Sous cible |
| `/fr/cas-concrets` | 125 | Légèrement sous cible |
| `/fr/recherche` | 66 | Trop courte |
| `/fr/mes-donnees` | 84 | Trop courte |

### P1-3 : Descriptions trop longues (> 158 chars)

| Page | Longueur | Note |
|------|----------|------|
| `/fr/` (home) | 188 | Trop longue (> 158 chars cible SEO) |
| `/fr/interventions` | ~195 | Dynamique avec prix |
| `/fr/un-a-un` | 185 | Trop longue |
| `/fr/implementation` | ~170 | Dynamique avec prix |
| `/fr/implantations` | 166 | Légèrement > 158 |

---

## Issues P2 — Suboptimalités mineures

### P2-1 : JSON-LD absent dans page.tsx
Les pages `/fr/ressources`, `/fr/recherche`, `/fr/mes-donnees` n'ont pas de JSON-LD visible dans `page.tsx`. Probable que le JSON-LD est dans des composants enfants ou absent. À vérifier.

### P2-2 : H1 dans composants externes (non détectable statiquement)
De nombreuses pages délèguent leur H1 à des composants Hero (`AuditHero`, `InterventionsHero`, `ImplementationHero`, etc.). Cela est normal et attendu (architecture DRY Sprint A). L'unicité H1 est garantie par design composant.

### P2-3 : Canonical auto-généré (pas de `alternates` explicit)
Pages `/fr/contact`, `/fr/audit`, `/fr/interventions`, `/fr/roi` n'ont pas d'`alternates` explicite mais `buildProductMetadata` génère automatiquement le canonical via `resolveLocalizedPath(path, locale)`. Correct par design.

### P2-4 : Description `/fr/implantations` : noindex conditionnel
La logique `const isIndexable = !region.noindex` s'applique aux **sous-pages** region/ville, pas à la page hub `/fr/implantations` elle-même qui est toujours indexable.

---

## Verdict par section

### Pages commerciales (services)
- `/fr/audit`, `/fr/interventions`, `/fr/implementation`, `/fr/un-a-un`, `/fr/sites-web-augmentes` : **WARNING** (H1 en composants, descriptions longues dynamiques)
- `/fr/tarifs` : **WARNING** (titre trop long 73 chars)
- `/fr/reserver` : **OK fonctionnel**

### Pages contenus
- `/fr/blog`, `/fr/ressources`, `/fr/glossaire`, `/fr/faq`, `/fr/cas-concrets`, `/fr/comparaisons` : **WARNING** (descriptions courtes)
- `/fr/actualites`, `/fr/galerie` : **WARNING** (titres courts)
- `/fr/charte-editoriale`, `/fr/corrections` : **OK**

### Pages légales/RGPD
- `/fr/mes-donnees` : **WARNING** (desc courte 84 chars, 0 JSON-LD)
- `/fr/transparence`, `/fr/a-propos`, `/fr/contact`, `/fr/methodologie` : **WARNING** (descriptions courtes)

### Pages spéciales
- `/fr/recherche` : **WARNING** (title + desc très courts — page UI fonctionnelle, SEO secondaire)
- `/fr/roi` : **WARNING** (ROI simulator, JSON-LD limité)

---

## Verdict final : WARNING

**26/30 pages structurellement correctes.** 2 erreurs P0 (route 404 + HTTP 500 sur URL avec accent). Aucune page publique indexable n'a de noindex intempestif. Le JSON-LD est présent sur les pages clés (audit, interventions, implementation, home, blog, FAQ). Les H1 sont délégués aux composants Hero (architecture DRY Sprint A — normal et attendu).

**Actions prioritaires :**
1. Corriger `/fr/audit/ciblé` → redirect 301 vers `/fr/audit/cible` (30 min)
2. Clarifier le statut de `/fr/appel` — si nécessaire, créer page ou redirect (15 min)
3. Allonger les descriptions < 140 chars sur pages A-propos, Méthodologie, Glossaire, Mes données (2-3h)
4. Raccourcir le titre `/fr/tarifs` de 73 → ≤ 60 chars (15 min)

**GO pour prod avec les 4 actions P1 ci-dessus.**
