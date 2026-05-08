# pSEO Villes — Décision industrialisation 2026-05-08

> **Date décision** : 2026-05-08 (Will, fin de session parity V14)
> **Statut** : EN ATTENTE — démarrage conditionné à validation Paris pilote par Will
> **Référence stratégie** : `_AUDIT/pseo-strategy.md` (Agent D, 2026-05-07)
> **Référence ADR** : `docs/adr/0006-pseo-villes.md`

---

## 1. Décision Will (2026-05-08 soir)

### 1.1 Cible

- **Toutes les villes >5 000 habitants** de la France métropolitaine.
- Volume cible : **~2 150 villes** (cumul ≥5 000 hab, INSEE COG 2024).
- DROM **exclus** (cf. décision Will 2026-05-08 commit `c9966a7` + ADR 0006).

### 1.2 Ordre d'industrialisation

**Région par région, en série complète, sans interruption jusqu'à finalisation totale.**

Ordre figé :

| Rang | Région INSEE                              | Slug technique                 | Volume estimé villes ≥5K           | Statut                     |
| ---- | ----------------------------------------- | ------------------------------ | ---------------------------------- | -------------------------- |
| 1    | **Auvergne-Rhône-Alpes** ⭐ priorité Will | `auvergne-rhone-alpes`         | ~280 villes                        | **À LANCER EN PREMIER**    |
| 2    | Île-de-France                             | `ile-de-france`                | ~370 villes (hors Paris déjà fait) | en attente rang 1          |
| 3    | Hauts-de-France                           | `hauts-de-france`              | ~210 villes                        | en attente                 |
| 4    | Provence-Alpes-Côte-d'Azur                | `provence-alpes-cote-d-azur`   | ~180 villes                        | en attente                 |
| 5    | Occitanie                                 | `occitanie`                    | ~210 villes                        | en attente                 |
| 6    | Nouvelle-Aquitaine                        | `nouvelle-aquitaine`           | ~170 villes                        | en attente                 |
| 7    | Grand Est                                 | `grand-est`                    | ~190 villes                        | en attente                 |
| 8    | Pays de la Loire                          | `pays-de-la-loire`             | ~140 villes                        | en attente                 |
| 9    | Bretagne                                  | `bretagne`                     | ~110 villes                        | en attente                 |
| 10   | Normandie                                 | `normandie`                    | ~120 villes                        | en attente                 |
| 11   | Centre-Val de Loire                       | `centre-val-de-loire`          | ~95 villes                         | en attente                 |
| 12   | Bourgogne-Franche-Comté                   | `bourgogne-franche-comte`      | ~100 villes                        | en attente                 |
| 13   | Corse                                     | `corse` (noindex actuellement) | ~5 villes                          | flag à lever post-décision |

**Total : ~2 150 villes** (excluant Paris déjà pilote).

⚠️ Note slug : la « région Rhône-Alpes » a fusionné avec Auvergne en 2016 (loi NOTRe). Le slug INSEE actuel est `auvergne-rhone-alpes`. C'est cette région qui sera traitée en premier (= Lyon, Saint-Étienne, Grenoble, Annecy, Chambéry, Valence, Clermont-Ferrand, etc.).

### 1.3 Méthode de génération

**Claude Pro Max (Will, 200 €/mois) — PAS d'API LLM séparée.**

- Méthode : sessions Claude Code ou Claude.ai utilisant le quota Pro Max inclus.
- **Coût marginal : 0 €** (vs ~$50-200 estimés en API externe dans `pseo-strategy.md` §0).
- Modèle : Claude Opus 4.7 (1M context) — qualité maximale, doctrine cohérente.
- Délai estimé : **6-8 semaines** à 1-2h/jour de session active (vs 2-3 sem. en API parallèle).
- Trade-off accepté : plus long mais gratuit + qualité Opus garantie.

### 1.4 Gating

🛑 **NE PAS LANCER tant que Will n'a pas validé la page Paris pilote**.

Will doit :

1. Ouvrir `https://axion-ia.com/fr/implantations/ile-de-france/paris` (en local ou prod)
2. Valider :
   - Qualité éditoriale du copy (pitch, sections, FAQ géo)
   - Structure visuelle (hero schema, sections, JSON-LD)
   - Cohérence doctrine (anti-doorway, anti-fabrication, AEO citable)
3. Confirmer go ou demander ajustements

**Tant que cette validation n'est pas explicite, aucune ville n'est générée.**

---

## 2. Pipeline d'exécution (post-validation Paris)

### 2.1 Vague unique en série

Pas de phasage A/B/C comme proposé en `pseo-strategy.md` §3. Will tranche :

- **Une seule vague**, région par région complète.
- **Aucune interruption** entre régions — finalisation totale 2 150 villes.
- **Activation indexation** : par région complète (pas batch incrémental Google).

### 2.2 Quality gates par ville

Pour chaque ville générée, le copy doit respecter :

| Critère                            | Seuil minimal       | Source                               |
| ---------------------------------- | ------------------- | ------------------------------------ |
| Mots copy unique                   | ≥ 300 mots          | Anti-doorway HCU 2024                |
| Cosine similarity vs autres villes | < 85 %              | Anti-clone (`pseo-strategy.md` §3.3) |
| FAQ géo unique                     | ≥ 5 questions       | AEO citation                         |
| LocalBusiness JSON-LD              | présent             | Google Maps + AI Overviews local     |
| Distance Paris/métropole           | calculée Haversine  | `lib/geo.ts`                         |
| Cas concrets proches               | référence existante | `getNearbyCases`                     |
| Secteurs économiques locaux        | ≥ 2 mentionnés      | INSEE Sirene                         |

### 2.3 Activation sitemap

Le sitemap est déjà préparé (commit `2cde099`) : split par région avec chunking auto à 1 000 URLs/file. À chaque ville activée :

1. Le copy est ajouté dans `src/content/villes/copy/<slug>.ts`
2. Le `COPY_BY_SLUG` registry dans `villes/index.ts` est étendu
3. `getIndexableVilles()` retourne automatiquement la ville
4. `generateSitemaps()` recalcule les chunks villes-`<region>(-N)`
5. Au prochain build, la ville est dans le sitemap

**Aucun code à modifier hors `copy/<slug>.ts`** — l'infrastructure absorbe le scale.

### 2.4 Activation par région entière (anti-flood Google)

Pour ne pas envoyer 2 150 nouvelles URLs à Google d'un coup (signal site farm garanti), l'activation se fait **région par région** :

| Étape | Action                                                         | Volume    | Délai après précédent                          |
| ----- | -------------------------------------------------------------- | --------- | ---------------------------------------------- |
| 1     | Générer + commit + push toutes les villes Auvergne-Rhône-Alpes | +280 URLs | J0                                             |
| 2     | Idem Île-de-France                                             | +370 URLs | J+7 (laisse Google crawler le batch précédent) |
| 3     | Idem Hauts-de-France                                           | +210 URLs | J+14                                           |
| ...   | ...                                                            | ...       | rythme 1 région par semaine ou 2               |
| 13    | Corse (déflag noindex)                                         | +5 URLs   | J+~12 semaines                                 |

Total déploiement : **~12 semaines** d'activation incrémentale post-génération.

---

## 3. Volume travail estimé

| Tâche                                       | Effort par ville     | Volume total          |
| ------------------------------------------- | -------------------- | --------------------- |
| Lire data INSEE + voisinage                 | 2 min                | ~70 h                 |
| Générer copy + FAQ géo + JSON-LD via Claude | 5-10 min             | ~180-360 h            |
| Quality gate + relecture rapide             | 2 min                | ~70 h                 |
| Commit + monitoring                         | 1 min                | ~36 h                 |
| **Total estimé**                            | **~10-15 min/ville** | **~360-540 h cumulé** |

**Réparti** : 6-8 semaines à 1-2h/jour ouvré = ~80-120h actives → certaines villes seront générées en mode batch automatisé via Claude Code (sessions 50-80 villes).

---

## 4. Risques identifiés

| Risque                                                       | Mitigation                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Claude Pro Max rate-limit (~messages/5h)                     | Sessions séquentielles, pas parallèles. Si bloqué, attendre fenêtre suivante.           |
| Duplication entre villes proches (ex : Lyon vs Villeurbanne) | Quality gate cosine similarity à activer dès vague 1                                    |
| Google détecte 2 150 URLs publiées trop vite                 | Activation région par région avec délai 7-14 jours entre chaque                         |
| Data INSEE incomplète sur petites villes (5K-10K hab)        | Fallback sur data régionale + secteurs département                                      |
| Régression qualité par fatigue / temps long                  | Will valide chaque batch région avant push (gate humain)                                |
| Conflits Will-Claude sur fichiers en parallèle               | Mémoire `axionia_collab_pattern` — Will commit pSEO en parallèle, je touche QUE `copy/` |

---

## 5. Référence dépendances code

L'infrastructure attend déjà cette industrialisation. Composants prêts :

- `src/content/villes/copy/types.ts` — interface `VilleCopy` + `VilleFaq`
- `src/content/villes/copy/paris.ts` — **template gold standard à imiter**
- `src/content/villes/index.ts` — registry `COPY_BY_SLUG` à étendre par ajout
- `src/content/villes/data/<region>.ts` — data INSEE déjà importée pour 2 157 villes
- `src/app/[locale]/implantations/[region]/[ville]/page.tsx` — template page (anti-doorway via `!ville.copy → noindex`)
- `src/app/sitemap.ts` — chunking auto déjà câblé (commit `2cde099`)
- `src/components/sections/VilleHeroSchema.tsx` — schema visuel hero

**Aucun travail backend / infra requis.** Toute l'industrialisation se passe dans `src/content/villes/copy/`.

---

## 6. Phrase canonique pour redémarrer (post-validation Paris)

> « OK Paris validée. Lance l'industrialisation pSEO villes >5 000 hab selon `_AUDIT/PSEO-VILLES-INDUSTRIALISATION-DECISION.md`. Commence par Auvergne-Rhône-Alpes (~280 villes) en sessions séquentielles via Claude Pro Max. »

---

_Document figé 2026-05-08. À mettre à jour seulement après validation Paris pilote par Will._
