# R29 — Audit RGPD sous-processeurs (annuel)

- **Code** : R29
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine** (annuel) · 🔴 **P0** si divergence majeure declared ↔ actif
- **Impact si non traité** : page publique `/legal/donnees-personnelles` peut omettre un sous-processeur réellement actif → défaut transparence RGPD art. 13/14 → risque CNIL/AKI. Inversement, déclaré non utilisé = pollution + perte confiance.

## Trigger

- SOP `review-sop.md` calendrier T2 (1er mai) — focus audit RGPD sous-processeurs.
- Post-ajout/retrait provider IA ou infra (ad-hoc).
- Audit annuel sécurité / conformité.
- Avant cutover prod publique 100/jour (cf. checklist Sprint 24.1).

## Cible audit

Vérifier que **les 3 listes coïncident à l'année N** :

1. **Déclaré public** : `axionia/src/content/legal.ts` § Sous-processeurs (FR + EN)
2. **Actif en code** : `ProviderConfig` + env Coolify (Sentry/Plausible/Stripe/Zoho/CF)
3. **DPA signé** : `_AUDIT/DPA-REGISTER.md` (Sprint 24.1) + DPA archive `_AUDIT/dpa-signed/YYYY/`

Toute divergence = anomalie à traiter avant publication audit annuel.

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/providers` (vue Settings).
- Accès `axionia/src/content/legal.ts` (lecture publique).
- Accès `_AUDIT/DPA-REGISTER.md` (registre interne).
- Accès Coolify env vars (vue cURL ou UI).

## Étapes (annuel — T2 mai)

### 1. Liste declared publique (legal.ts)

```bash
grep -nE "OpenAI|Anthropic|Perplexity|Unsplash|Voyage|Hetzner|Cloudflare|Sentry|Stripe|Zoho|Plausible|Telegram" axionia/src/content/legal.ts | sort -u | head -30
```

Extraire la liste exhaustive des sous-processeurs nommés dans :

- §§ Sous-processeurs (FR)
- §§ Sub-processors (EN)
- §§ AI-assisted content (art. 50 AI Act)

### 2. Liste active en code

#### Providers IA

```sql
SELECT slug, enabled, "monthlyCapUsd", "lastUsedAt"
FROM "ProviderConfig"
WHERE enabled = true
ORDER BY slug;
```

#### Env Coolify (sous-processeurs infra)

```bash
curl -s "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  | jq '.[] | select(.key | test("(SENTRY|PLAUSIBLE|STRIPE|ZOHO|CLOUDFLARE|HETZNER|TELEGRAM|OPENAI|ANTHROPIC|PERPLEXITY|UNSPLASH|VOYAGE)")) | .key'
```

### 3. Liste DPA signés

```bash
grep -E "^\| 20[0-9]{2}-" _AUDIT/DPA-REGISTER.md | awk -F'|' '{ gsub(/^[ \t]+|[ \t]+$/, "", $3); print $3 }' | sort -u
```

### 4. Croiser les 3 listes — matrice de cohérence

| Sous-processeur | Déclaré legal.ts | Actif code/env | DPA signé < 12 mois | Cohérent ? |
| --------------- | ---------------- | -------------- | ------------------- | ---------- |
| OpenAI          | ?                | ?              | ?                   | ✅/❌      |
| Anthropic       | ?                | ?              | ?                   | ✅/❌      |
| Perplexity      | ?                | ?              | ?                   | ✅/❌      |
| Unsplash        | ?                | ?              | ?                   | ✅/❌      |
| Voyage AI       | ?                | ?              | ?                   | ✅/❌      |
| Hetzner         | ?                | ?              | ?                   | ✅/❌      |
| Cloudflare      | ?                | ?              | ?                   | ✅/❌      |
| Sentry          | ?                | ?              | ?                   | ✅/❌      |
| Stripe          | ?                | ?              | ?                   | ✅/❌      |
| Zoho Mail       | ?                | ?              | ?                   | ✅/❌      |

### 5. Traiter les anomalies

| Cas                                         | Action                                                               |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Actif code mais pas declared legal.ts       | **P0** — patch immédiat `legal.ts` + commit + push avant audit publi |
| Declared mais pas actif                     | Retirer de `legal.ts` (commit) **ou** activer le service si attendu  |
| Actif sans DPA signé                        | **P0** — désactiver provider (`enabled=false`) jusqu'à DPA via R28   |
| DPA expiré > 12 mois                        | Lancer R28 cycle de renouvellement                                   |
| Provider en DPA-only (Telegram ops interne) | Documenter dans `_AUDIT/RGPD-SOUS-PROCESSEURS-YYYY.md` justification |

### 6. Rédiger rapport annuel

Créer `_AUDIT/RGPD-SOUS-PROCESSEURS-2026.md` (template depuis ce runbook) :

```markdown
# Audit RGPD sous-processeurs Axion-IA OÜ — YYYY

## 1. Périmètre

- legal.ts version : <commit-hash>
- ProviderConfig snapshot : <date>
- DPA-REGISTER snapshot : <date>

## 2. Matrice cohérence

[tableau §4 complété]

## 3. Anomalies détectées + actions

[liste]

## 4. Conclusion + verdict

- ✅ Cohérent (X/X providers)
- ⚠️ Divergences mineures résolues (Y patches commits)
- ❌ Bloqueur prod (si applicable)

## 5. Métadonnées

- Auditeur : Will (DPO) ou délégué
- Date : YYYY-MM-DD
- Prochain audit : YYYY+1-MM-DD
```

### 7. Publication / archive

```bash
git add _AUDIT/RGPD-SOUS-PROCESSEURS-2026.md
git commit -m "docs(rgpd): audit annuel sous-processeurs 2026 — X anomalies résolues"
git push origin main
```

### 8. Notifier Telegram + DPO

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [RGPD] Audit annuel sous-processeurs 2026 OK. Cohérence 10/10. Prochain : 2027-05-01."
```

## Vérifications post-fix

- [ ] `legal.ts` FR + EN ↔ ProviderConfig + env Coolify : 100 % coïncident.
- [ ] Tous providers actifs ont DPA < 12 mois (cf. R28 registre).
- [ ] Page publique `/fr/legal/donnees-personnelles` cohérente prod live (curl test).
- [ ] Rapport annuel commité + pushé `_AUDIT/RGPD-SOUS-PROCESSEURS-YYYY.md`.

## Rollback

- Aucun rollback nécessaire (audit, pas modification système).
- Si patch `legal.ts` regretté → revert commit + republish.

## Escalation

| Niveau | Contact             | Quand                                                        |
| ------ | ------------------- | ------------------------------------------------------------ |
| L1     | Will (DPO de facto) | toujours pour validation finale audit                        |
| L2     | Avocat externe RGPD | si interprétation art. 28 ambiguë                            |
| L3     | CNIL FR / AKI EE    | déclaration spontanée si divergence majeure post-publication |

## Cycle préventif

- **T2 mai** (1er du trimestre) — audit annuel SOP.
- **Triggers ad-hoc** :
  - Nouveau provider câblé (à la PR qui ajoute `ProviderConfig` row).
  - Provider retiré code → vérifier retrait `legal.ts` en même temps.
  - Mise à jour majeure RGPD/AI Act (suivi via veille juridique Will).

## Note compliance EU AI Act 2024/1689

Art. 50 (transparence IA) déjà couvert dans `legal.ts` :

- Disclosure "IA-assistée" sur contenus signés Manon.
- Fiche transparence `/equipe/manon`.
- Helper `pii-safe` + hard gate KB pour prompts (cf. ADR 0010).

Vérifier annuel que ces 3 mécanismes sont toujours actifs (test live).

## Liens

- `axionia/src/content/legal.ts` — source publique
- `_AUDIT/DPA-REGISTER.md` — registre signatures (Sprint 24.1)
- `_AUDIT/CHECKLIST-CUTOVER.md` — 28 cases / 9 phases (Sprint 24.1)
- R28 — DPA renouvellement (cycle T1)
- ADR 0010 — Telegram PII minimisation
- Mémoire `axionia_session_2026-05-09_sprint_24_1` — PII redaction + cutover
- Mémoire `axionia_session_2026-05-13_seo_email_stack` — Zoho Mail migration
- RGPD art. 28 (sous-traitants) · art. 13/14 (transparence) · art. 30 (registre activités)
- EU AI Act 2024/1689 art. 50 (transparence IA)
