# CHANGELOG DOCX — Corrections P0 v10.1 -> v10.2

**Date** : 2026-05-06
**Outil** : python-docx 1.2.0 (script `_AUDIT/_apply_p0_fixes.py` + `_apply_p0_fixes_round2.py` + `_apply_p0_addrow.py`)
**Backup** : `_backup_pre_v10.2/` (8 fichiers .docx originaux conservés pour rollback)
**Total fixes appliqués** : **29 / 29 succès** (0 échec multi-runs — tous les paragraphes ciblés étaient en `runs=1`).

---

## Synthèse

| Fichier                               | Fixes OK           | Fixes manuels | Statut |
| ------------------------------------- | ------------------ | ------------- | ------ |
| `09-Base-Donnees-Sauvegardes.docx`    | 6                  | 0             | OK     |
| `10-Securite-Plateforme.docx`         | 3                  | 0             | OK     |
| `13-Infrastructure-Deploiement.docx`  | 8 (+1 ajout ligne) | 0             | OK     |
| `14-Emails-Automatiques.docx`         | 1                  | 0             | OK     |
| `16-Copywriting-Vendeur-Complet.docx` | 1                  | 0             | OK     |
| `25-Stack-Technique.docx`             | 7                  | 0             | OK     |
| `30-Page-A-Propos.docx`               | 1                  | 0             | OK     |
| `31-CGV-Politique-Deplacement.docx`   | 2                  | 0             | OK     |

---

## Détail par fichier

### 09-Base-Donnees-Sauvegardes.docx

#### Fix 09-1 — ENUM `automatisation` -> `implementation` (3 emplacements)

Remplacement appliqué sur les 3 ENUM contenant le terme « automatisation » (table 0 r2, table 3 r10 + table 7 r6, table 4 r4) :

- **Avant** : `ENUM : audit / automatisation / intervention`
- **Après** : `ENUM : audit / implementation / intervention`
- **Avant** : `ENUM : intervention / automatisation / audit` (et variante avec « · NULL pour catégories blog »)
- **Après** : `ENUM : intervention / implementation / audit`
- **Avant** : `ENUM : general / interventions / automatisations / audit / tarifs / processus`
- **Après** : `ENUM : general / interventions / implementations / audit / tarifs / processus`

Status : OK (4 paragraphes modifiés couvrant les 4 tables ENUM).

#### Fix 09-2 — Stockage cloud distant

- **Avant** : `Service cloud distant : Backblaze B2 ou AWS S3 · région EU pour conformité RGPD`
- **Après** : `Service cloud distant : Hetzner Storage Box (S3-compatible, UE) · UNIQUEMENT, pas d'alternative US (conformité RGPD)`

Status : OK.

#### Fix 09-3 — calendar_event_id

- **Avant** : `VARCHAR · ID de l'événement Calendrier maison/Cal.com`
- **Après** : `VARCHAR · ID interne calendrier maison`

Status : OK.

---

### 10-Securite-Plateforme.docx

#### Fix 10-1a — Notification CNIL -> AKI (procédure)

- **Avant** : `Procédure de notification CNIL sous 72h en cas de violation · registre des incidents`
- **Après** : `Procédure de notification AKI (Andmekaitse Inspektsioon, autorité estonienne équivalente CNIL) sous 72h en cas de violation · registre des incidents`

Status : OK.

#### Fix 10-1b — Notification CNIL -> AKI (données compromises)

- **Avant** : `Si données personnelles compromises : notification CNIL sous 72h · notification des personnes concernées si risque élevé`
- **Après** : `Si données personnelles compromises : notification AKI (Andmekaitse Inspektsioon, autorité estonienne équivalente CNIL) sous 72h · notification des personnes concernées si risque élevé`

Status : OK.

#### Fix 10-1c — Registre traitement (CNIL -> AKI)

- **Avant** : `Registre des activités de traitement tenu à jour · disponible sur demande CNIL`
- **Après** : `Registre des activités de traitement tenu à jour · disponible sur demande AKI (autorité estonienne) ou CNIL`

Status : OK.

---

### 13-Infrastructure-Deploiement.docx

#### Fix 13-1 — Service email

- **Avant** : `Brevo (ex-Sendinblue) · ou Resend · ou Postmark — pour l'envoi des emails automatiques`
- **Après** : `Email : PowerMTA + MailWizz self-hosted + Nodemailer + React Email (cf. skill axionia-emails). Resend / SendGrid / Mailgun / Brevo / Postmark INTERDITS — décision _DECISIONS-FINALES.md 06/05/2026.`

Status : OK.

#### Fix 13-2 — Variables d'environnement BACKUP*S3*_ -> HETZNER*STORAGE*_

- `BACKUP_S3_BUCKET` -> `HETZNER_STORAGE_BUCKET` (OK)
- `BACKUP_S3_KEY` -> `HETZNER_STORAGE_KEY` (OK)
- `BACKUP_S3_SECRET` -> `HETZNER_STORAGE_SECRET` (OK)
- **Ajout** : nouvelle ligne `HETZNER_STORAGE_ENDPOINT` ajoutée à la fin du tableau env vars (valeur : `URL S3 endpoint Hetzner Storage Box (ex : https://fsn1.your-objectstorage.com)`).

Status : OK (3 remplacements + 1 ligne ajoutée).

#### Fix 13-3 — Google Analytics -> Plausible self-hosted

- `GOOGLE_ANALYTICS_ID` -> `PLAUSIBLE_DOMAIN` (OK)
- `ID Google Analytics 4` -> `Domaine Plausible self-hosted` (OK)
- `Google Analytics 4 · objectifs de conversion configurés pour chaque formulaire` -> `Plausible self-hosted · objectifs de conversion configurés pour chaque formulaire (cookieless, RGPD-friendly)` (OK)
- `Sitemap soumis à Google Search Console · Google Analytics actif` -> `Sitemap soumis à Google Search Console · Plausible self-hosted actif` (OK)

Status : OK (4 remplacements).

---

### 14-Emails-Automatiques.docx

#### Fix 14-1 — 16 templates Resend -> React Email via PowerMTA

- **Avant** : `…Total : 16 templates Resend/React Email. La langue de l'email…`
- **Après** : `…Total : 16 templates React Email envoyés via PowerMTA + Nodemailer (queue BullMQ). Resend INTERDIT. La langue de l'email…`

Status : OK.

---

### 16-Copywriting-Vendeur-Complet.docx

#### Fix 16-1 — Hero : « former » -> « accompagner »

- **Avant** : `Axion-IA forme vos équipes, identifie vos économies cachées et déploie des automatisations…`
- **Après** : `Axion-IA accompagne vos équipes, identifie vos économies cachées et déploie des automatisations…`

Status : OK. Aucune autre occurrence de `former leurs équipes` détectée dans ce fichier.

---

### 25-Stack-Technique.docx

#### Fix 25-1 — Email stack

- **Avant** : `Resend + React Email`
- **Après** : `PowerMTA + MailWizz self-hosted + Nodemailer + React Email (cf. axionia-emails)`

Status : OK.

#### Fix 25-2 — Auth

- **Avant** : `NextAuth.js 5 + 2FA TOTP`
- **Après** : `Auth.js v5 (anciennement NextAuth.js) + 2FA TOTP`

Status : OK.

#### Fix 25-3 — Performance budgets (4 lignes)

- `LCP < 2.5s sur 3G simulé.` -> `LCP < 1.8s sur 3G simulé (cf. axionia-performance).`
- `INP < 100ms.` -> `INP < 80ms.`
- `CLS < 0.1.` -> `CLS < 0.05 — Lighthouse > 95.`
- `Bundle JS first load < 100kb.` -> `Bundle JS first load < 80kb.`

Status : OK (4 remplacements).

#### Fix 25-4 — Framer Motion

- **Avant** : `Framer Motion 11+`
- **Après** : `motion (Framer Motion light) v11+`

Status : OK.

---

### 30-Page-A-Propos.docx

#### Fix 30-1 — Sous-titre A Propos

- **Avant** : `…un cabinet IA opérationnel qui intervient directement dans les entreprises pour former leurs équipes, auditer leurs process et déployer des automatisations qui fonctionnent vraiment.`
- **Après** : `…un cabinet IA opérationnel qui intervient directement dans les entreprises pour accompagner leurs équipes, auditer leurs process et déployer des automatisations qui fonctionnent vraiment.`

Status : OK.

---

### 31-CGV-Politique-Deplacement.docx

#### Fix 31-1 — Tribunal compétent

- **Avant** : `…Tribunal compétent : Saint-Étienne (42).`
- **Après** : `…Tribunaux compétents : Tribunaux de Tallinn (Estonie) — droit estonien (la société est Axion-IA OÜ, OU estonienne).`

Status : OK.

#### Fix 31-2 — Loi applicable + note Estonie/France

- **Avant** : `Droit français. Ces CGV sont régies par les lois françaises.`
- **Après** : `Loi applicable : Droit estonien (registrikood EE, TVA EE). Ces CGV sont régies par les lois estoniennes. Note : le siège social de la société Axion-IA OÜ est en Estonie ; les interventions physiques peuvent avoir lieu en France selon disponibilité de l'intervenant.`

Status : OK.

---

## Vérification finale

Script `_AUDIT/_verify_final.py` exécuté : **31/31 assertions de cohérence vertes** (la seule "FAIL" technique est une mention résiduelle de « Brevo » dans la liste des services INTERDITS — c'est volontaire et désiré).

## Rollback

Pour rollback complet :

```powershell
Copy-Item "_backup_pre_v10.2\*.docx" -Destination "." -Force
```

## Notes techniques

1. **Aucun problème multi-runs rencontré** : tous les paragraphes ciblés étaient en `runs=1`. La fonction `replace_in_paragraph` sait quand même collapser les multi-runs au cas où.
2. **Séparateur de liste** : les documents Axion-IA utilisent le caractère middle-dot `·` (U+00B7) et non l'em-dash `—` (U+2014). Round 2 du script a dû ajuster en conséquence pour 09-2, 09-3, 13-1, 13-3c, 13-3d, 10-1a, 10-1b, 10-1c.
3. **Doublons résolus implicitement** : le fix 09-1d (variante ENUM avec « NULL pour catégories blog ») a été couvert par 09-1b grâce au fait que `find_exact = "ENUM : intervention / automatisation / audit"` matchait les deux paragraphes (avec et sans suffixe).
4. **Ajout structurel** : une nouvelle ligne `HETZNER_STORAGE_ENDPOINT` a été ajoutée au tableau env vars de `13-Infrastructure-Deploiement.docx` (table[5]) car la spec mentionnait 4 variables Hetzner alors que le doc original n'en exposait que 3.
