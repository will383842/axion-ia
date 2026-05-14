# What to do now — Will

**Verdict audit** : 🟡 NEAR-GO **173/200** (cible GO ≥ 180). Écart **7 pts**, fixable en **~6-7 h Sprint S0**.

## Prochaine étape concrète (ordre exact)

### 1. Sprint S0 — Day 0 (matin, ~3-4 h dev)

**Fix les 2 bugs SEO pré-existants** ([[axionia_bugs_seo_preexistants_2026-05-09]]) :

- `/sitemap.xml` retourne 404 → vérifier `app/sitemap.xml/route.ts`, créer si absent, MIME `application/xml`.
- `og:image` pointe `localhost:3000` → forcer `NEXT_PUBLIC_SITE_URL` prod dans `buildOgImage()`.

Test : `curl -I https://axion-ia.com/sitemap.xml` et preview Facebook debugger.

### 2. Q13 Manon (Will, ~15 min, à n'importe quel moment)

Édite `_AUDIT/seeds-templates/manon-profile.md` :
- Choisis option visuelle (recommandé : Unsplash workspace neutre)
- Valide / édite la bio rédigée

### 3. P1 cosmétiques (~2 h dev, peut être groupé avec étape 1)

- Renommer commit #22 dans `_AUDIT/SPRINT-1-DAY-BY-DAY.md:230` (retirer `gpt-image-1`)
- Ajouter `quality_improving` à l'enum `ContentGenJobStatus` § 5.1
- Harmoniser SKILL.md v1.7 partout
- Réordonner section § 24 avant § 25-29 dans master prompt
- Documenter 4 clés API dans `CONTENT-GEN-V1-AUTOPILOT-LOG.md`

### 4. Re-vérification ciblée

Relance **uniquement** AGT-VC1 + VC4 + VC6 :
```
Re-vérifie _AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/ après Sprint S0 — focus VC1, VC4, VC6.
```

Cible : **≥ 180/200** → 🟢 GO PROD-READY.

### 5. Sprint 1 autopilote (~7 jours, 30 commits)

```
Skill : axionia-content-generator (mode AUTOPILOTE)
[Lis SKILL.md auto-pilot.md master prompt et déclenche Sprint 1 Day 1.]
```

---

**Note** : commits locaux OK pendant Sprint S0, **aucun push** sans ton feu vert (consigne 2026-05-14 enregistrée).
