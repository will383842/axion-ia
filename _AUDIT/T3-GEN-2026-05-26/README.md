# T3 Generation — 2026-05-26

Pipeline LLM end-to-end pour rendre les villes T3 (20K-100K hab) indexables sur axion-ia.fr.

## Périmètre

- **415 villes** sélectionnées (T3 = pop 20K-100K)
- Toutes SANS copy TS hand-crafted (priorité TS si elle existe)
- Auto-approve seuil quality ≥ 70/100
- Resume support natif si crash

## Coût + durée estimés

- **Coût** : ~$60 ($0.15/ville, basé sur Saint-Denis baseline 2026-05-26)
- **Durée** : ~14h wall-clock (séquentiel 2 min/ville)
- **Process bg ID** : `by5fweieq`

## Suivi en live

```powershell
# Tail le log
Get-Content _AUDIT/T3-GEN-2026-05-26/run.log -Wait -Tail 20

# Compter les ✅ auto-approved jusqu'ici
(Get-Content _AUDIT/T3-GEN-2026-05-26/run.log | Select-String "✅").Count

# Compter les ❌ failures
(Get-Content _AUDIT/T3-GEN-2026-05-26/run.log | Select-String "❌").Count

# Coût cumulé
docker exec axion-ia-postgres psql -U axion_ia -d axion_ia_dev -c "SELECT COUNT(*) approved, SUM(total_cost_usd)::numeric(10,2) cost_usd FROM generated_ville_copies WHERE status='approved' AND reviewed_by LIKE 'auto:regen-complete%';"
```

## Si crash / interruption

```powershell
# Resume from dernière ville traitée
pnpm tsx scripts/regen-villes-complete.ts --tier=3 --resume-from=<dernier-slug>
```

Note : le script skip automatiquement les villes déjà `approved` en DB (résilient aux relances multiples).

## Procédure T4 (à lancer après validation T3)

```powershell
# ~1700 villes <20K hab, ~$255, ~60h wall-clock
pnpm tsx scripts/regen-villes-complete.ts --tier=4
```

Recommandé : découper T4 en chunks géographiques pour parallélisme/contrôle.

## Vérification qualité aléatoire (post-run)

```sql
-- 10 villes aléatoires score >= 70
SELECT ville_slug, quality_score, status, length(pitch_fr) pitch_len,
       jsonb_array_length(faq_geolocalisee_json) faq_count
FROM generated_ville_copies
WHERE status='approved' AND quality_score >= 70
ORDER BY random() LIMIT 10;

-- Failures à reviewer manuellement
SELECT ville_slug, quality_score, total_cost_usd, review_notes
FROM generated_ville_copies
WHERE status != 'approved' OR quality_score < 70
ORDER BY ville_slug;
```

## Architecture pipeline

```
Pour CHAQUE ville T3 :
  1. Skip si copy TS existe (n/a — aucun T3 hand-crafted)
  2. Skip si row GeneratedVilleCopy déjà 'approved' (resume)
  3. Generator A landing-ville-economic-data.ts → JSON VilleEconomicData
     ↓ (KB facts via kbRetrieve + Claude Sonnet, ~$0.05, 3 iter max)
  4. Generator B ville-hub-copy.ts (avec ecoOverride)
     ↓ (KB facts + Claude Sonnet, ~$0.10, 3 iter max)
  5. UPSERT generated_ville_copies + auto-approve si quality ≥ 70
```

## Anti-fabrication

- Claude Opus 4.7 (cutoff jan 2026) connaît Wikipedia FR
- Prompts répètent 4× « NE PAS inventer si tu n'es pas sûr »
- Sources marquées `claude-knowledge:wikipedia-pretraining` + date jour
- Quality gates rejet si :
  - Banned phrases (marketing-speak, faux partenariats, "Cabinet IA opérationnel")
  - Word counts hors cibles
  - Champs économiques insuffisants (< 3 grands groupes, < 4 secteurs NAF…)
