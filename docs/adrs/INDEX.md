# Index centralisé des Architecture Decision Records (ADRs)

**Date d'index** : 2026-05-22
**Référence** : Sprint Final P1-11 — `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/`
**Source de vérité** : `docs/adr/` (28 ADRs filesystem, 0001 → 0028, continus)
**Statut global** : ✅ Aucun ADR référencé manquant en filesystem au 2026-05-22

---

## Note de localisation

Tous les ADRs canoniques résident dans `docs/adr/` (singulier — historique du repo). Ce fichier `docs/adrs/INDEX.md` est un **index centralisé** créé en Sprint Final P1-11 pour navigation rapide depuis le code, runbooks, audits, mémoire et CLAUDE.md. Il ne duplique pas les ADRs ; il les indexe.

**Convention** : tout nouvel ADR est créé dans `docs/adr/NNNN-slug.md` avec numéro continu, et son entrée est ajoutée ici.

---

## Inventaire 28 ADRs (0001 → 0028)

| #    | Slug                                     | Titre                                                               | Statut                                                                   | Date       | Fichier                                                                                                            |
| ---- | ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 0001 | `stack-initial`                          | Stack initiale & toolchain Sprint 0                                 | Accepted                                                                 | 2026-05-06 | [`docs/adr/0001-stack-initial.md`](../adr/0001-stack-initial.md)                                                   |
| 0002 | `design-pivot-editorial-v3`              | Pivot doctrine visuelle v3 « Editorial Premium Light »              | Accepted                                                                 | 2026-05-06 | [`docs/adr/0002-design-pivot-editorial-v3.md`](../adr/0002-design-pivot-editorial-v3.md)                           |
| 0003 | `lift-formation-ban`                     | Lift "formation" ban (vocabulaire commercial réintégré)             | Accepted (superseded by 0008)                                            | 2026-05-07 | [`docs/adr/0003-lift-formation-ban.md`](../adr/0003-lift-formation-ban.md)                                         |
| 0004 | `typography-baseline-upgrade-v3-1`       | Typography baseline upgrade (v3.1)                                  | Accepted                                                                 | 2026-05-07 | [`docs/adr/0004-typography-baseline-upgrade-v3-1.md`](../adr/0004-typography-baseline-upgrade-v3-1.md)             |
| 0005 | `navigation-mega-menu`                   | Navigation mega-menus : révision CLAUDE.md v6 §9.2                  | Accepted (impl. différée)                                                | 2026-05-07 | [`docs/adr/0005-navigation-mega-menu.md`](../adr/0005-navigation-mega-menu.md)                                     |
| 0006 | `pseo-villes`                            | pSEO villes & régions FR : engagement scale + pipeline éditorial    | Accepted                                                                 | 2026-05-07 | [`docs/adr/0006-pseo-villes.md`](../adr/0006-pseo-villes.md)                                                       |
| 0007 | `typography-hierarchy-v3-2`              | Typography hierarchy v3.2 (modular scale + hero cap)                | Accepted                                                                 | 2026-05-08 | [`docs/adr/0007-typography-hierarchy-v3-2.md`](../adr/0007-typography-hierarchy-v3-2.md)                           |
| 0008 | `vocabulary-intervention-coaching`       | Vocabulaire : « formation » → « intervention coaching »             | Accepted (supersedes 0003)                                               | 2026-05-08 | [`docs/adr/0008-vocabulary-intervention-coaching.md`](../adr/0008-vocabulary-intervention-coaching.md)             |
| 0009 | `hosting-hetzner-cpx32-cloudflare-free`  | Hébergement Hetzner CPX32 + Cloudflare Free                         | Accepted (CPX32 → CPX42 effectif depuis 2026-05-15, doc à mettre à jour) | 2026-05-08 | [`docs/adr/0009-hosting-hetzner-cpx32-cloudflare-free.md`](../adr/0009-hosting-hetzner-cpx32-cloudflare-free.md)   |
| 0010 | `telegram-pii-minimisation`              | Minimisation PII dans les notifications Telegram                    | Accepted                                                                 | 2026-05-09 | [`docs/adr/0010-telegram-pii-minimisation.md`](../adr/0010-telegram-pii-minimisation.md)                           |
| 0011 | `interventions-taxonomy-4-families`      | Refonte taxonomique /interventions en 4 familles                    | Accepted                                                                 | 2026-05-09 | [`docs/adr/0011-interventions-taxonomy-4-families.md`](../adr/0011-interventions-taxonomy-4-families.md)           |
| 0012 | `booking-v1-decisions-matrix-q1-q10`     | Matrice des 10 décisions Q1–Q10 Booking V1                          | Accepted                                                                 | 2026-05-10 | [`docs/adr/0012-booking-v1-decisions-matrix-q1-q10.md`](../adr/0012-booking-v1-decisions-matrix-q1-q10.md)         |
| 0013 | `stripe-checkout-hybride-manuel`         | Stripe Checkout V1 + mode hybride manuel                            | Accepted                                                                 | 2026-05-10 | [`docs/adr/0013-stripe-checkout-hybride-manuel.md`](../adr/0013-stripe-checkout-hybride-manuel.md)                 |
| 0014 | `docuseal-self-hosted-vs-yousign`        | DocuSeal self-hosted vs Yousign                                     | Accepted                                                                 | 2026-05-10 | [`docs/adr/0014-docuseal-self-hosted-vs-yousign.md`](../adr/0014-docuseal-self-hosted-vs-yousign.md)               |
| 0015 | `tva-agnostique-fr-ee`                   | Architecture TVA agnostique FR vs EE                                | Accepted (partiellement obsolète post-D7 société française)              | 2026-05-10 | [`docs/adr/0015-tva-agnostique-fr-ee.md`](../adr/0015-tva-agnostique-fr-ee.md)                                     |
| 0016 | `pricing-db-managed-pricingconfig`       | Pricing DB-managed via table `PricingConfig`                        | Accepted                                                                 | 2026-05-10 | [`docs/adr/0016-pricing-db-managed-pricingconfig.md`](../adr/0016-pricing-db-managed-pricingconfig.md)             |
| 0017 | `multi-options-simultanees-cap-3`        | Multi-options simultanées sur même slot — cap configurable défaut 3 | Accepted                                                                 | 2026-05-10 | [`docs/adr/0017-multi-options-simultanees-cap-3.md`](../adr/0017-multi-options-simultanees-cap-3.md)               |
| 0018 | `validation-2-clics-envoi-vs-calendrier` | Validation admin en 2 clics distincts (Envoi contrat vs Calendrier) | Accepted                                                                 | 2026-05-10 | [`docs/adr/0018-validation-2-clics-envoi-vs-calendrier.md`](../adr/0018-validation-2-clics-envoi-vs-calendrier.md) |
| 0019 | `modes-manuels-d64-togglables`           | Modes manuels D64 togglables (résilience opérationnelle)            | Accepted                                                                 | 2026-05-10 | [`docs/adr/0019-modes-manuels-d64-togglables.md`](../adr/0019-modes-manuels-d64-togglables.md)                     |
| 0020 | `migration-data-v0-vers-v1`              | Migration data V0 → V1 (script obligatoire Sprint X.4)              | Accepted                                                                 | 2026-05-11 | [`docs/adr/0020-migration-data-v0-vers-v1.md`](../adr/0020-migration-data-v0-vers-v1.md)                           |
| 0021 | `content-gen-v1-skeleton-vs-deep-impl`   | Content Generator V1 squelette vs implémentation profonde           | Accepted                                                                 | 2026-05-12 | [`docs/adr/0021-content-gen-v1-skeleton-vs-deep-impl.md`](../adr/0021-content-gen-v1-skeleton-vs-deep-impl.md)     |
| 0022 | `backup-strategy-scripts-only`           | Backup strategy : scripts custom (pas Coolify integrated)           | Accepted                                                                 | 2026-05-13 | [`docs/adr/0022-backup-strategy-scripts-only.md`](../adr/0022-backup-strategy-scripts-only.md)                     |
| 0023 | `content-gen-table-criticality`          | Criticité tables content-gen pour backups + restore                 | Accepted                                                                 | 2026-05-13 | [`docs/adr/0023-content-gen-table-criticality.md`](../adr/0023-content-gen-table-criticality.md)                   |
| 0024 | `ai-act-classification`                  | Classification AI Act EU 2024/1689 d'Axion-IA                       | Accepted                                                                 | 2026-05-14 | [`docs/adr/0024-ai-act-classification.md`](../adr/0024-ai-act-classification.md)                                   |
| 0025 | `pii-at-rest-encryption`                 | Chiffrement PII at-rest application-level (AES-256-GCM)             | Accepted                                                                 | 2026-05-15 | [`docs/adr/0025-pii-at-rest-encryption.md`](../adr/0025-pii-at-rest-encryption.md)                                 |
| 0026 | `build-externalisation-ghcr`             | Build Docker externalisé sur GitHub Actions + GHCR                  | Accepted                                                                 | 2026-05-16 | [`docs/adr/0026-build-externalisation-ghcr.md`](../adr/0026-build-externalisation-ghcr.md)                         |
| 0027 | `image-bank-architecture`                | Image Bank Architecture (V1)                                        | Accepted                                                                 | 2026-05-20 | [`docs/adr/0027-image-bank-architecture.md`](../adr/0027-image-bank-architecture.md)                               |
| 0028 | `admin-design-system-v1`                 | Design System admin v1 (Mai 2026)                                   | Accepted                                                                 | 2026-05-21 | [`docs/adr/0028-admin-design-system-v1.md`](../adr/0028-admin-design-system-v1.md)                                 |

---

## Statut "Référencé mais manquant"

**Aucun** ADR référencé dans `AGENTS.md` / `CLAUDE.md` / `src/**` / `_AUDIT/**` / mémoire `MEMORY.md` n'est manquant en filesystem au 2026-05-22.

Les vérifications croisées ont porté sur :

- ADR 0009 → ✅ présent `docs/adr/0009-hosting-hetzner-cpx32-cloudflare-free.md`
- ADR 0026 → ✅ présent `docs/adr/0026-build-externalisation-ghcr.md` (référencé en bloc dans `AGENTS.md` §Build externalisé GitHub Actions)
- ADR 0010 (Telegram PII) → ✅ présent
- ADRs 0001-0028 → ✅ tous présents et continus

**Note importante** : les ADRs « proposition » du dossier `_AUDIT/` (ex. `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md`, `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`, `_AUDIT/KNOWLEDGE-BASE-2026/ADR-DRAFT.md`) sont des **drafts pré-acceptation**, déjà ratifiés et déplacés en `docs/adr/` sous numérotation finale (ADR 0005 et ADR 0006 respectivement). Ils ne doivent pas être considérés comme « manquants » mais comme des artefacts d'audit historiques.

**Proposition ADR 0010 alternative** (« React Compiler 19 » dans `_AUDIT/agent-3-inp-compiler-viewtransitions.md`) : non écrit car numérotation déjà utilisée par Telegram PII minimisation. Si activé en Vague V4 Web Vitals 2026, prendra le numéro libre suivant (0029+).

---

## Conventions

### Numérotation

- Continue, sans trou. 4 chiffres (0001 → 9999).
- Pas de réutilisation : un ADR « superseded » garde son numéro et reçoit un statut `Superseded by NNNN`.

### Statuts canoniques

- `Proposed` — en discussion, pas encore implémenté
- `Accepted` — décision actée et implémentée (ou implémentation en cours immédiate)
- `Superseded by NNNN` — remplacé par un ADR ultérieur (référence obligatoire)
- `Deprecated` — décision abandonnée sans remplacement direct
- `Documented retrospectively` — décision actée hors processus ADR formel, documentée a posteriori (rare)

### Template minimum

Chaque ADR doit contenir :

1. Titre `# ADR NNNN — Titre court`
2. Métadonnées : Statut, Date, Auteur, Référence (lien commit / fichier code / mémoire)
3. **Contexte** (1 paragraphe — pourquoi cette décision est nécessaire)
4. **Décision** (1-3 paragraphes — quoi)
5. **Conséquences** (positives + négatives + mitigations)
6. **Alternatives considérées** (écartées avec justification)
7. **Suivi** (sprints/tâches qui découlent)

### Workflow

1. Identifier la décision structurelle (PR avec STOP & ASK Will requis)
2. Créer `docs/adr/NNNN-slug.md` (numéro = max(existant) + 1)
3. Ajouter ligne d'entrée dans ce `docs/adrs/INDEX.md`
4. Référencer ADR dans le code touché (commentaire 1 ligne pointant vers le fichier)
5. Mettre à jour `CHANGELOG.md` avec lien ADR
6. Mémoire si décision opérationnelle majeure (cf. fichier mémoire dédié)

---

## Recherche rapide par thématique

| Thème                                 | ADRs                                           |
| ------------------------------------- | ---------------------------------------------- |
| **Infrastructure & build**            | 0001, 0009, 0022, 0026                         |
| **Design system & doctrine visuelle** | 0001, 0002, 0004, 0007, 0028                   |
| **Navigation & taxonomie**            | 0005, 0011                                     |
| **Contenu éditorial & vocabulaire**   | 0003, 0008, 0021, 0023                         |
| **SEO / pSEO**                        | 0006                                           |
| **Booking V1 & paiement**             | 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0019 |
| **Data migration & lifecycle**        | 0020                                           |
| **RGPD / sécurité PII**               | 0010, 0025                                     |
| **AI Act**                            | 0024                                           |
| **Image bank**                        | 0027                                           |

---

## Maintenance

- **Revue trimestrielle obligatoire** — vérifier statut "Accepted" vs réalité prod (ADR 0009 CPX32 → CPX42 effectif, à corriger Sprint dédié)
- **Drift** : si décision codée diverge ADR, créer un ADR supersedant explicite ou patcher l'ADR original avec note de mise à jour datée
- **Validation index** : ce fichier doit être synchronisé à chaque commit qui touche `docs/adr/` (gate optionnel CI future)

---

_Index généré par Sprint Final P1-11 le 2026-05-22. Source de vérité : filesystem `docs/adr/`. En cas de divergence, le filesystem prime._
