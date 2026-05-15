# R28 — Renouvellement DPA providers IA et infra

- **Code** : R28
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine** (annuel) · 🟡 **P1** si DPA expiré bloque traitement
- **Impact si non traité** : Axion-IA OÜ s'expose à un défaut de base juridique RGPD art. 28 (sous-traitant). Risque CNIL/AKI : suspension du traitement + amende. Risque opérationnel : provider peut résilier sans DPA renouvelé.

## Trigger

- SOP `review-sop.md` calendrier T1 (1er février) — focus rotations + DPA renewals.
- Email provider "DPA expiring in X days" (OpenAI / Anthropic envoient typiquement T-60).
- Audit annuel RGPD (cf. R29).
- Lancement nouveau provider (DPA initial avant câblage en code).

## Sous-processeurs concernés (V1+V2 content-gen)

Source de vérité : `axionia/src/content/legal.ts` (déclaration publique) + `ProviderConfig` table (providers actifs) + env Coolify (Sentry/Plausible/Stripe).

### Providers IA (5)

| Provider   | Type             | DPA URL                                       | Cycle   | Dernier signé      | Prochain      |
| ---------- | ---------------- | --------------------------------------------- | ------- | ------------------ | ------------- |
| OpenAI     | GPT-4o text      | https://openai.com/policies/eu-dpa            | 12 mois | _à compléter Will_ | _à compléter_ |
| Anthropic  | Claude text      | https://www.anthropic.com/legal/dpa           | 12 mois | _à compléter_      | _à compléter_ |
| Perplexity | Sonar fact-check | support@perplexity.ai (DPA enterprise)        | 12 mois | _à compléter_      | _à compléter_ |
| Unsplash   | Photos           | https://unsplash.com/license + DPA on request | 24 mois | _à compléter_      | _à compléter_ |
| Voyage AI  | Embeddings       | privacy@voyageai.com                          | 12 mois | _à compléter_      | _à compléter_ |

### Infra + observabilité (6)

| Sous-processeur              | Type                                        | DPA URL                                                        | Cycle                 | Dernier signé                   | Prochain                           |
| ---------------------------- | ------------------------------------------- | -------------------------------------------------------------- | --------------------- | ------------------------------- | ---------------------------------- |
| Hetzner Online GmbH          | Hosting EU (CPX42 + Storage Box)            | https://www.hetzner.com/AV/DPA_en.pdf                          | 24 mois ou auto-renew | _à compléter_                   | _à compléter_                      |
| Cloudflare Inc.              | Edge + WAF + DNS                            | https://www.cloudflare.com/cloudflare-customer-dpa/            | auto-renew            | online accepté 2026-05-09       | _vérifier annuel_                  |
| Sentry (Functional Software) | Observability EU                            | https://sentry.io/legal/dpa/                                   | 12 mois               | _à compléter_                   | _à compléter_                      |
| Stripe Payments Europe       | Booking payments                            | https://stripe.com/legal/dpa                                   | auto-renew            | _à compléter (post-booking-V1)_ | _à compléter_                      |
| Zoho Corporation             | Email transactionnel `contact@axion-ia.com` | https://www.zoho.com/dpa/dpa.html                              | 12 mois               | 2026-05-13 (migration)          | 2027-05-13                         |
| Telegram (Telegram FZ-LLC)   | Alertes ops internes                        | https://telegram.org/privacy (pas DPA formel — risque accepté) | —                     | n/a                             | n/a — usage ops interne uniquement |

> ⚠️ **Plausible self-hosted** : pas de sous-traitant tiers (hébergé chez Hetzner Axion-IA) → couvert par DPA Hetzner. Ne pas lister comme sous-processeur séparé.

## Prérequis

- Accès Will email pro pour signature électronique DPA.
- Accès `axionia/src/content/legal.ts` (modif déclaration publique si nouveau sous-processeur).
- Accès `_AUDIT/DPA-REGISTER.md` (registre interne — créé Sprint 24.1, cf. mémoire `axionia_session_2026-05-09_sprint_24_1`).

## Étapes (annuel — T1 février)

### 1. Lister DPA actifs

Ouvrir `_AUDIT/DPA-REGISTER.md`. Pour chaque ligne, vérifier date `Prochain renouvellement` :

```bash
grep -E "^\| (OpenAI|Anthropic|Perplexity|Unsplash|Voyage|Hetzner|Cloudflare|Sentry|Stripe|Zoho)" _AUDIT/DPA-REGISTER.md
```

DPA expiré ou < 60 jours avant expiration → §2.

### 2. Récupérer document DPA à jour

Provider IA :

- OpenAI : https://platform.openai.com/account/data-processing-addendum (auto-signature compte enterprise) ou ticket support si Team plan.
- Anthropic : https://www.anthropic.com/legal/dpa → click-through agreement.
- Perplexity : email `support@perplexity.ai` pour DPA enterprise.
- Unsplash : email `legal@unsplash.com` si > 1000 hits/mois.
- Voyage AI : `privacy@voyageai.com`.

Infra :

- Hetzner : https://www.hetzner.com/AV/DPA_en.pdf — signature via portal Hetzner Cloud Console → Support → DPA.
- Cloudflare : https://dash.cloudflare.com/?account → Manage Account → Configurations → DPA (accept).
- Sentry : Sentry Org Settings → Legal → DPA download + countersign.
- Stripe : Dashboard → Settings → Compliance → DPA.
- Zoho : déjà signé 2026-05-13 (migration Namecheap → Zoho Mail Free EU), auto-renew.

### 3. Signature

Pour DPA papier (Hetzner historiquement) : impression + signature manuscrite + scan + retour email contractuel ou upload portal.

Pour DPA click-through : login compte + accept.

### 4. Archiver

```bash
mkdir -p _AUDIT/dpa-signed/2026/
mv ~/Downloads/openai-dpa-signed-2026.pdf _AUDIT/dpa-signed/2026/
# Idem pour chaque provider
```

⚠️ **Ne PAS committer les PDF signés** (info contractuelle + signature personnelle). Garder dans dossier gitignored ou Storage Box Hetzner chiffré.

Ajouter ligne au registre `_AUDIT/DPA-REGISTER.md` :

```markdown
| 2026-02-01 | OpenAI | DPA v3.2 | 2027-02-01 | Will | \_AUDIT/dpa-signed/2026/openai-dpa-signed.pdf |
```

### 5. Mettre à jour `legal.ts` si liste évolue

Si nouveau sous-processeur ou un retiré :

```bash
# Édition list § sous-processeurs publique
# axionia/src/content/legal.ts §§ Sous-processeurs
git -C axionia add src/content/legal.ts
git -C axionia commit -m "chore(legal): update sub-processor list (R28 annual review)"
git -C axionia push origin main
```

Auto-deploy Coolify met à jour la page `/fr/legal/donnees-personnelles` (+ `/en/legal/personal-data`).

### 6. Notifier DPO interne + Telegram

Will = DPO de facto. Pour traçabilité :

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [DPA] T1 2026 review OK. 10 DPA renouvelés. Prochain audit annuel : 2027-02-01."
```

## Vérifications post-fix

- [ ] Tous les sous-processeurs déclarés `legal.ts` ont un DPA actif < 12 mois (sauf Hetzner/Cloudflare auto-renew 24 mois).
- [ ] `_AUDIT/DPA-REGISTER.md` à jour avec dates signature + prochain renouvellement.
- [ ] Aucun provider actif `ProviderConfig.enabled=true` sans DPA déclaré.
- [ ] Page publique `/fr/legal/donnees-personnelles` cohérente avec providers actifs.
- [ ] PDFs signés archivés `_AUDIT/dpa-signed/YYYY/` (gitignored).

## Rollback

- DPA expiré et nouveau impossible à obtenir → **désactiver le provider** dans `ProviderConfig.enabled = false` (kill switch granulaire) jusqu'à résolution.
- Si liste publique modifiée à tort → revert commit + republish.

## Escalation

| Niveau | Contact             | Quand                                                     |
| ------ | ------------------- | --------------------------------------------------------- |
| L1     | Will (DPO de facto) | toujours (signature contractuelle)                        |
| L2     | Avocat externe RGPD | si DPA provider refuse clauses standards UE-EU SCC        |
| L3     | CNIL FR / AKI EE    | si litige sous-traitant ne signe pas / clauses contraires |

## Cycle préventif

- **T1 février** (1er du trimestre) : audit annuel complet via SOP `review-sop.md`.
- **Triggers ad-hoc** : nouveau provider câblé code → DPA AVANT activation `ProviderConfig.enabled=true`.

## Liens

- `axionia/src/content/legal.ts` — source de vérité publique
- `_AUDIT/DPA-REGISTER.md` — registre interne signatures (Sprint 24.1)
- ADR 0010 — PII minimisation (cadre traitement données)
- R29 — Audit RGPD sous-processeurs (verif annuelle cross-check declared vs active)
- `review-sop.md` T1 — calendrier review trimestriel
- Mémoire `axionia_session_2026-05-09_sprint_24_1` — DPA-REGISTER + CHECKLIST-CUTOVER livrés
- Mémoire `axionia_session_2026-05-13_seo_email_stack` — Zoho Mail EU migration
- RGPD art. 28 (sous-traitants) + RGPD art. 32 (sécurité)
- EU AI Act 2024/1689 art. 50 (transparence IA — déjà couvert `legal.ts`)
