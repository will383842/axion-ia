# Villes T4 (<20k hab) — Sprint manuel sur plusieurs jours

**Objectif** : générer manuellement (via Claude Code) les fichiers `src/content/villes/copy/<slug>.ts` pour les 1702 villes T4 (population < 20 000 habitants), sur le modèle des 25 villes T3 manuelles déjà livrées (commit `b64c0c3c`).

**Status** : voir `progress.json` (source de vérité, versionnée en git).

---

## 🚨 Risque doorway Google HCU 2024 — assumé par Will

Les 1702 villes T4 sont des communes < 20 000 habitants où Axion-IA n'intervient pas physiquement de manière crédible. Le risque que Google considère ces pages comme du "doorway content" (Helpful Content Update 2024) est **plus élevé** que pour T1/T2/T3.

**Mitigations en place pour réduire le risque** :

1. ✅ Contenu **unique par ville** (600+ chars uniques minimum) — pas de duplicate content
2. ✅ Références **économiques locales réelles** (INSEE secteurs, spécialités locales)
3. ✅ **Tous types d'activités** mentionnés (TPE artisans, commerces, agriculture, etc.)
4. ✅ **TPE/PME prioritaire** vs ETI (cohérent avec volume client réel)
5. ✅ **AI Act art. 50 disclosure** déjà sur toutes les pages hub (composant `AiContentDisclaimer`)
6. ✅ Soft-404 gate dans le code (pages low quality → noindex automatique)
7. ✅ Tier graduel d'indexation (cf. `seo-noindex-routes.ts`)

**Surveillance recommandée post-deploy** :

- GSC Coverage report toutes les semaines
- Si > 30% des T4 marquées "Crawled - currently not indexed" → réduire scope (rollback partiel)
- Si signaux négatifs sur les pages services principales (`/audit`, `/interventions`...) → STOP immédiat

---

## 📋 Procédure de reprise (entre sessions)

### À chaque nouvelle session

1. **Will ouvre Claude Code** dans le repo (peu importe où on en était)
2. **Will dit** : "Fais le prochain batch T4 de N villes" (ou "le suivant")
3. **Claude** :
   - Lit `_AUDIT/VILLES-T4-PROGRESS/progress.json` (status actuel)
   - Récupère les **N prochaines villes pending** (triées par population décroissante = les plus stratégiques d'abord)
   - Pour chaque ville : génère `src/content/villes/copy/<slug>.ts` avec contenu unique
   - Met à jour `progress.json` (status=done, doneAt, batch number)
   - Regen `_auto-generated-index.ts` (scan FS)
   - Regen `seo-noindex-routes.ts` whitelist
   - `pnpm typecheck`
   - Commit + push

### En cas de fermeture VS Code / crash

- Tout est en git (`progress.json` versionné). Au `git pull`, Will récupère l'état exact.
- Aucun fichier "en cours" — chaque batch est atomique (soit done, soit pas commencé).

---

## 🛠 Commandes utiles

```bash
# Status global (combien fait/restant)
pnpm tsx scripts/t4-status.ts

# Voir les 10 prochaines villes à faire
pnpm tsx scripts/t4-pick-next.ts 10

# Re-générer le tracking (si delta sur le filesystem)
pnpm tsx scripts/t4-sync-progress.ts
```

---

## 📐 Règles de génération (référence pour Claude Code)

Chaque fichier `copy/<slug>.ts` DOIT avoir :

### Structure obligatoire (cf. `src/content/villes/copy/types.ts`)

- `pitchFr` (35-60 mots, citable LLMs, mention TPE/PME)
- `pitchEn = pitchFr` (mirror, rule NO traduction EN)
- `directAnswerFr` (55-95 mots, "Axion-IA est un cabinet d'architectes IA seniors qui intervient à...", mention tous types d'activités)
- `directAnswerEn = directAnswerFr`
- `ecosystemFr` (40-70 mots, références économiques locales RÉELLES vérifiables)
- `ecosystemEn = ecosystemFr`
- `distancesFr` (15-35 mots, gare/aéroport/axes routiers réels)
- `distancesEn = distancesFr`
- `topSectorsNaf` (3-5 secteurs locaux RÉELS, varier par ville)
- `servicesContext` × 4 (audit/interventions/implementation/unAUn) × fr/en (mirror)
- `faqGeolocalisee` (5 Q/R uniques, exemples sectoriels concrets par ville)

### Wording rules (feedbacks Will 2026-05-27)

- ✅ **TPE/PME en premier** dans tous les wording, ETI en complément
- ✅ **Tous types d'activités** : BTP, industrie, commerce, agriculture, santé, ESS, tertiaire, tourisme
- ✅ **Audit Flash 490 € HT** mentionné comme accessible aux TPE/indépendants
- ✅ **EN = mirror FR** (NE JAMAIS traduire en anglais — rule Will 2026-05-22)
- ✅ **600+ chars uniques** par ville (anti-duplicate content)
- ❌ Pas de claims faux ("expertise locale", "équipe locale", "antenne à X")
- ❌ Pas de mention "implantation à X" (Axion-IA = cabinet national qui se DÉPLACE)
- ❌ Pas de "frais de déplacement inclus" (frais en sus du forfait journée)

### Stratégie unicité

Pour chaque ville, identifier au moins **3-5 références ULTRA-spécifiques** :

- Spécialité économique locale (ex: ostréiculture pour bassin Arcachon, viticulture pour Bergerac, métallurgie pour Saint-Dizier)
- Site industriel / institutionnel proche (ex: ArianeGroup, CEA, Renault Flins, hôpital régional)
- Patrimoine ou activité touristique notable
- Position géographique stratégique (banlieue de quelle métropole, axe routier)

Sources de vérification :

- Connaissance générale Claude Code des villes françaises
- Pas de fabrication de chiffres (population OK, mais pas de stats inventées)

---

## 📊 Historique des batches

Voir `_AUDIT/VILLES-T4-PROGRESS/log/` (1 fichier markdown par batch).

---

## ⚙️ Système de fichiers

```
_AUDIT/VILLES-T4-PROGRESS/
├── README.md           # Ce fichier (procédure)
├── progress.json       # Source of truth (status par ville)
└── log/
    ├── batch-001-YYYY-MM-DD.md   # Liste des villes du batch + commit SHA
    ├── batch-002-...
    └── ...

scripts/
├── t4-status.ts        # Affiche status global
├── t4-pick-next.ts     # Retourne N prochaines villes pending
├── t4-sync-progress.ts # Re-scan FS + sync progress.json (drift detection)
└── t4-mark-done.ts     # Marque N villes done (appelé après génération)

src/content/villes/copy/
├── <slug>.ts           # 1 fichier par ville T4 done
└── _auto-generated-index.ts  # Regenéré automatiquement
```
