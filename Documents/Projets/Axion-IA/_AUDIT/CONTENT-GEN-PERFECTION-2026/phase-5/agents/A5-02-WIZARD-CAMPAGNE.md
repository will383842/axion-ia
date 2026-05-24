# A5-02 — Wizard Campagne — Score 28/120

## Fichiers inspectés

- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/new/_v2/CoverageNewV2.tsx` (294 lignes)
- `src/server/actions/content-gen/coverage.ts` (546 lignes)
- `prisma/schema.prisma` lignes 2824-2894 (modèles `CoverageDistributionProfile`, `AudienceMixProfile`, `CoverageCampaign`)

## État actuel

### Architecture du formulaire

`CoverageNewV2` est un **Server Component async** (pas de `'use client'`). Il s'agit d'un formulaire HTML natif `<form action={create}>` rendu en une seule page dans une `AdminCard`. Aucun stepper, aucune étape, aucune navigation avant/arrière.

Champs présents :
1. `name` (text, `required`, `minLength={3}`)
2. `scope` (select enum : ville/departement/region/multi, `required`, default "region")
3. `serviceSector` (select optionnel parmi `SERVICE_SECTORS`)
4. `totalTargetCount` (number, `required`, `min="1"`, `max="10000"`, default 100)
5. `anchorVilleSlugs` (text CSV, optionnel)
6. `anchorDepartementCodes` (text CSV, optionnel)
7. `anchorRegionSlugs` (text CSV, optionnel)
8. `typeDistribution` (textarea JSON brut, `required`, pré-rempli 5 types totalisant 100)
9. `audienceMix` (textarea JSON brut, `required`, pré-rempli 5 segments totalisant 100)
10. `estimatedCostUsd` (number optionnel, `min="0"`)
11. `estimatedDurationMinutes` (number optionnel, `min="0"`)
12. `launchNow` (checkbox)

**Boutons** : "Enregistrer" (submit create) + "Dry-run (estimer)" (submit dryRun).

### Validation côté serveur (coverage.ts)

- `name.length < 3` → throw `name_too_short`
- `totalTargetCount` hors [1-10000] → throw `target_count_range`
- Si `serviceSector` défini : types interdits `landing_ville` + `blog_from_rss` → throw
- `typeDistribution` somme doit être 100 (±0.5) → throw `type_distribution_must_sum_100`
- `audienceMix` somme doit être 100 (±0.5) → throw `audience_mix_must_sum_100`

La validation est **exclusivement côté serveur** via Server Action — aucun feedback inline client-side.

### Presets / CampaignTemplate

**`CampaignTemplate` est absent du schéma Prisma.** Aucune occurrence dans `schema.prisma`. Aucun preset dans le code source (grep sur "PME audits", "Interventions weekly", "TPE burst", "ETI pilier", "Cities Paris", "RSS daily" : 0 résultat).

Les profils proches qui existent :
- `CoverageDistributionProfile` (slug, distribution JSON, isDefault, serviceSector) — chargés et listés dans le formulaire (labels uniquement, non sélectionnables pour pré-remplissage)
- `AudienceMixProfile` (slug, mix JSON, isDefault) — idem

Ces profils sont affichés en lecture seule dans les labels des textareas (`Profils existants : {slugs}`), sans mécanisme pour les charger dans le formulaire.

## Gaps identifiés

### P0 (bloquant)

**P0-1 : Absence totale de wizard multi-étapes**
Le formulaire est une page unique sans stepper, sans navigation étape par étape. Les 4 étapes attendues (vertical+cible / types contenu / villes / schedule) sont mélangées sans séparation visuelle ni logique.

**P0-2 : CampaignTemplate absent — zéro preset**
Le modèle `CampaignTemplate` n'existe pas dans le schéma Prisma. Les 6 presets attendus ("PME audits", "Interventions weekly", etc.) sont inexistants. L'admin doit remplir manuellement tout le JSON `typeDistribution` et `audienceMix` à chaque création — UX critique pour adoption.

**P0-3 : Distribution types et audiences = JSON brut dans textarea**
L'opérateur doit saisir un JSON valide à la main. Aucune UI checkboxes/sliders avec somme dynamique. Une erreur JSON invalide (virgule oubliée, clé mal typée) n'est détectée qu'au submit côté serveur, sans indication du champ fautif.

**P0-4 : Validation uniquement côté serveur, aucun feedback inline**
En cas d'erreur (somme ≠ 100, JSON invalide), le formulaire recharge la page depuis zéro sans message d'erreur affiché (les Server Actions throwent une exception non catchée dans le JSX — l'utilisateur voit une page d'erreur Next.js ou rien). Aucun `useActionState` ni gestion des erreurs retour form.

### P1 (important)

**P1-1 : Les profils `CoverageDistributionProfile` et `AudienceMixProfile` ne sont pas sélectionnables**
Ils sont chargés depuis la DB et listés dans les labels, mais aucun bouton/select ne permet de charger un profil pour pré-remplir le textarea JSON. L'admin voit "Profils existants : mix-premium-2026" mais ne peut pas les utiliser.

**P1-2 : Villes en CSV texte libre**
Le champ `anchorVilleSlugs` est un input texte libre (CSV de slugs). Aucune liste déroulante, aucune autocomplétion sur les 39+ villes existantes dans la DB. Risque fort de typo/slug incorrect sans feedback.

**P1-3 : Absence de schedule (volume/jour, dates, récurrence)**
Il n'y a aucun champ de planification temporelle : pas de `startDate`, pas de `endDate`, pas de `dailyLimit`, pas de `recurrence`. La campagne se lance immédiatement (checkbox "launchNow") ou reste draft — sans pilotage du rythme.

**P1-4 : Champ `searchIntentMix` absent du formulaire**
Le modèle `CoverageCampaign` possède `searchIntentMix Json?` et la Server Action `createCampaign` l'accepte, mais aucun champ dans le formulaire ne permet de le renseigner.

**P1-5 : Pas de confirmation avant lancement**
La checkbox "Lancer immédiatement" + "Enregistrer" lance la campagne sans étape de confirmation/récapitulatif. Pour une campagne de 10 000 contenus, c'est une action irréversible déclenchée sans friction.

### P2 (nice-to-have)

**P2-1 : Dry-run non persisté dans le formulaire**
Le dry-run encode le résultat en base64url dans l'URL (`?dryRun=...`) — résultat perdu si l'utilisateur rafraîchit ou modifie le formulaire.

**P2-2 : Pas de prévisualisation du mix calculé**
Aucun affichage "au vu de votre distribution, voici les X blog_from_title, Y comparison..." avant soumission.

**P2-3 : Libellés scope techniques**
Les valeurs "ville/departement/region/multi" sont affichées brutes sans label humain ("Ville", "Département", "Région", "Multi-zones").

**P2-4 : Absence d'aide contextuelle**
Aucun tooltip, aucun lien vers documentation interne pour expliquer les types de contenu, les audiences, ou les scopes.

## Scoring détaillé

| Critère | Max | Score | Justification |
|---|---|---|---|
| C1 Wizard multi-étapes | 35 | 10 | Formulaire une seule page sans stepper ni navigation. Multi-sections implicites (grid CSS) mais pas de découpage logique étape. Score minimum "formulaire simple une page". |
| C2 6 presets CampaignTemplate | 35 | 0 | `CampaignTemplate` absent du schéma Prisma. Zéro preset (0/6). `CoverageDistributionProfile` existe en DB mais non utilisable pour pré-remplissage. |
| C3 Time-to-launch | 25 | 8 | Champs obligatoires : name + scope + totalTargetCount + typeDistribution JSON + audienceMix JSON + checkbox launchNow + submit = minimum 6-7 interactions (dont saisie JSON complexe). Sans preset, la saisie JSON complète dépasse largement 7 clics/actions. |
| C4 Validation inline | 25 | 10 | Attributs HTML5 présents sur champs simples (`required`, `minLength`, `min`, `max`) = 8 pts base. Léger bonus pour textarea `required` et défauts JSON pré-remplis corrects (somme = 100 vérifiée en dur). Mais : zéro validation inline côté client, zéro message d'erreur retourné au formulaire, zéro vérification dynamique somme = 100 côté client. |
| **TOTAL** | **120** | **28** | |

## Recommandations P0 urgentes

### R1 — Créer le modèle `CampaignTemplate` + 6 seeds (effort : 2-3h)

Ajouter dans `prisma/schema.prisma` :
```prisma
model CampaignTemplate {
  id                String         @id @default(cuid())
  slug              String         @unique
  name              String
  description       String?
  scope             CoverageScope
  serviceSector     ServiceSector?
  totalTargetCount  Int
  typeDistribution  Json
  audienceMix       Json
  isActive          Boolean        @default(true)
  createdAt         DateTime       @default(now())
  @@map("campaign_templates")
}
```
Seeds : "PME audits" / "Interventions weekly" / "TPE burst" / "ETI pilier" / "Cities Paris" / "RSS daily" avec valeurs issues des profils `CoverageDistributionProfile` existants.

### R2 — Convertir `CoverageNewV2` en wizard client 4 étapes (effort : 6-8h)

Remplacer le Server Component par un `'use client'` multi-step avec :
- Stepper visuel 4 étapes (composant `AdminStepper` à créer)
- Étape 1 : Vertical (serviceSector select) + cible (scope + audienceMix via checkboxes %)
- Étape 2 : Types contenu (checkboxes avec sliders %, compteur somme live)
- Étape 3 : Villes (multiselect avec autocomplétion sur slugs DB)
- Étape 4 : Récapitulatif + schedule + bouton "Lancer" avec confirmation modale

### R3 — Connecter les presets à l'étape 1 (effort : 1-2h après R1)

Carte preset cliquable en haut du wizard. 1 clic sur preset → pré-remplit toutes les étapes → 2 clics total (preset + confirm). Atteint C3 = 25 pts.

### R4 — Validation inline côté client (effort : 2-3h)

- `useActionState` ou `react-hook-form` pour capturer les erreurs serveur et les afficher inline
- Compteur dynamique "somme = 100" côté client sur distribution types + audienceMix
- Blocage navigation étape suivante si somme ≠ 100

---

*Audit AUDIT-ONLY — zéro modification fichier source. Date : 2026-05-21.*
