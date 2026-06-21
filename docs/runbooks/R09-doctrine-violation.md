# R09 — Doctrine violation post-publication

- **Code** : R09
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique** (réputation + RGPD/légal)
- **Impact si non traité** : Axion-IA SAS exposée à confusion juridique (mention SIREN/RCS) ou rupture doctrine produit (mention "agence", "studio", "formation Qualiopi/OPCO"). Risque légal + risque cannibalisation positionnement "cabinet IA opérationnel".

## Trigger

- Audit manuel régulier (cf. SOP `review-sop.md`).
- User report contact (mail, formulaire).
- Scan rétroactif `pnpm anti-siren:check` ou `pnpm anti-hex:check` rouge sur prod.
- Cron similarity-monitor 04:30 détecte phrase BannedPhrase déclenchée post-publi (faille pipeline).

## Doctrine intouchable (cf. mémoires)

| Règle                                                                              | Cf. mémoire                       |
| ---------------------------------------------------------------------------------- | --------------------------------- |
| Naming = **Axion-IA** partout (jamais AxionIA double graphie)                      | `axionia_naming_brand_vs_project` |
| SAS française — immatriculation FR communiquée sur demande (n° non encore publiés) | `axionia_project`                 |
| Cabinet IA opérationnel — **jamais agence/studio/atelier**                         | `axionia_naming_cabinet`          |
| Doctrine **≥ 95 % AxionIA-centric**, ≤ 5 % data INSEE                              | `axionia_doctrine_code_ssot`      |
| Lift formation ban — **mention formation interdite** sauf interventions taxonomy   | ADR 0003                          |
| Palette terracotta #C45A3E + crème #FAF7F2 + ink #1F1B16 uniquement                | `axionia_design_pivot`            |

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/publications-status` + `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/banned-phrases`.
- Accès Postgres pour scan rétroactif.

## Étapes

### 1. Identifier le contenu incriminé

```sql
-- Recherche par pattern
SELECT id, slug, title, "indexationTier", "publishedAt"
FROM "Article"
WHERE body ILIKE '%SIREN%' OR body ILIKE '%SIRET%' OR body ILIKE '%RCS%'
   OR body ~* '\bagence\b' OR body ~* '\bstudio\b' OR body ~* '\batelier\b'
   OR body ILIKE '%Qualiopi%' OR body ILIKE '%OPCO%'
   OR title ILIKE '%AxionIA%' -- mauvaise graphie sans tiret
ORDER BY "publishedAt" DESC;
```

Liste les hits avec contexte (3 mots autour de la phrase) :

```sql
SELECT id, slug,
  substring(body FROM position('SIREN' IN body) - 30 FOR 80) AS context
FROM "Article"
WHERE body ILIKE '%SIREN%';
```

### 2. Dépublier les contenus violants

```sql
UPDATE "Article"
SET "indexationTier" = 'noindex_nofollow',
    "publishedAt" = NULL,
    "updatedAt" = NOW()
WHERE id = ANY(ARRAY['<id1>', '<id2>', ...]);
```

Ou via admin (kanban Sprint 3 F14).

### 3. Ajouter phrase(s) à BannedPhrase

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/banned-phrases
→ "+ Ajouter"
→ Phrase : "SIREN" (ou regex via champ avancé)
→ Severity : critical
→ Reason : "R09-doctrine-axionia-oue"
→ Sauvegarder
```

Effet : `doctrine-check.ts` rejette désormais à la pré-publi. Server Action : `createBannedPhraseAction`.

### 4. Re-générer (option) ou supprimer définitivement

#### Option A — Re-générer via admin

```
/fr/{ADMIN_URL_PREFIX}/content-gen/jobs/<job-id>
→ bouton "Rejouer du début"
```

Le nouveau job utilisera la BannedPhrase fraîche → contenu propre.

#### Option B — Marquer archived (si re-gen pas utile)

```sql
UPDATE "Article"
SET "indexationTier" = 'archived', body = '[ARCHIVED-R09]'
WHERE id = ANY(...);
```

⚠️ Garder l'enregistrement pour audit trail, ne PAS DELETE.

### 5. Update sitemap + IndexNow

Sitemap regen hebdo (dim 23:00) — pour purge immédiate :

```bash
docker exec axion-ia-app-prod node ./dist/scripts/sitemap-regen.js
docker exec axion-ia-app-prod node ./dist/scripts/indexnow-ping.js \
  --urls "https://axion-ia.com/fr/blog/<slug-1>,https://axion-ia.com/fr/blog/<slug-2>"
```

IndexNow notifie Bing/Google/Yandex que ces URLs sont retirées.

### 6. Demander désindexation Google Search Console

Manuel — `https://search.google.com/search-console` :

1. Choisir propriété `axion-ia.com`.
2. Menu "Suppressions" → "+ Nouvelle demande".
3. Saisir URL exacte → "URL temporairement supprimée" (6 mois bouclier).

### 7. Scan rétroactif complet (couvrir backlog)

```bash
docker exec axion-ia-app-prod pnpm anti-siren:check 2>&1 | tee /tmp/anti-siren-prod.log
docker exec axion-ia-app-prod pnpm anti-hex:check 2>&1 | tee /tmp/anti-hex-prod.log
```

Tout hit → repasser §1-§6 par batch.

## Vérifications post-fix

- [ ] Articles incriminés renvoient 404 ou archived.
- [ ] BannedPhrase ajoutée visible dans admin + test smoke :
  ```bash
  docker exec axion-ia-app-prod node -e "
    const { checkDoctrine } = require('./dist/server/content-gen/quality/doctrine-check');
    checkDoctrine({ body: 'Notre SIREN est 123456789' })
      .then(r => console.log(r));
    // Attendu : { passed: false, hits: [{ phrase: 'SIREN', severity: 'critical' }] }
  "
  ```
- [ ] Scan anti-siren + anti-hex rouge → vert.
- [ ] Sitemap ne contient plus URLs retirées.
- [ ] Google Search Console : suppression URL confirmée.

## Rollback

- BannedPhrase ajoutée à tort → DELETE (admin UI ou SQL).
- Article dépublié à tort → restore `indexationTier = 'tier_1_index'` + `publishedAt = NOW()` + revalidatePath.

## Escalation

| Niveau | Contact                             | Quand                                                                              |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------- |
| L1     | Will                                | toujours (impact réputation)                                                       |
| L2     | Avocat / DPO `contact@axion-ia.com` | si confusion juridique SIREN/RCS (immatriculation Axion-IA SAS non encore publiée) |

## Post-mortem recommandé

Si > 5 articles touchés ou récidive — `docs/post-mortems/2026-XX-XX-doctrine-violation.md` :

1. Timeline détection → dépublication
2. Root cause : prompt insuffisant ? BannedPhrase incomplète ? KB pollued ?
3. Actions prévention (test régression, audit hebdo, KB cleanup)

## Liens

- ADR 0003 — Lift formation ban (vocabulaire interdit)
- ADR 0010 — Telegram PII minimisation (pattern review-before-publish)
- Code : `src/server/content-gen/quality/doctrine-check.ts`
- Code : `scripts/anti-siren-check.ts` + `scripts/anti-hex-check.ts`
- Mémoires : `axionia_naming_cabinet`, `axionia_naming_brand_vs_project`, `axionia_doctrine_code_ssot`
- Master prompt § 9.7 — checklist anti-doctrine
