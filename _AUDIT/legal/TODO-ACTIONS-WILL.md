# 📋 TODO Will — Actions restantes Axion-IA prod

> Checklist personnelle Will. Coche au fur et à mesure.
> Dès qu'une action est faite, dis-le à Claude en session — il set les
> env vars Coolify en parallèle.

---

## ✅ Déjà fait par Claude (session 2026-05-14)

- [x] Code admin V1 complet (Dashboard, Réservations, Factures, Paiements, Calendrier heatmap)
- [x] Numérotation factures atomique `AXION-2026-NNNN`
- [x] Saisie paiement manuel + avoirs
- [x] Bug SEO `/sitemap.xml` 404 fixé (redirect 301)
- [x] Bug `og:image=localhost` fixé (fallback SITE_URL prod)
- [x] Pattern signature DocuSeal séquentielle client → Axion-IA
- [x] Tests E2E smoke admin routes
- [x] PDF Hetzner DPA téléchargé prêt à signer (`hetzner-dpa-template-2026-05-14.pdf`)
- [x] Env vars Coolify : `DOCUSEAL_URL`, `STRIPE_API_VERSION`, `STRIPE_LIVE_MODE`
- [x] Fix migrate deploy fallback npx (commit `140e5db`)

---

## 🟧 Cloudflare DPA — ⏱ 2 min

- [ ] **Login** : `https://dash.cloudflare.com/`
- [ ] Avatar haut droite → **Manage Account**
- [ ] **Configurations** → onglet **Compliance**
- [ ] Section **Data Processing Addendum (DPA)** → bouton **Accept DPA**
- [ ] **Download PDF** → renomme `dpa-cloudflare-signed-YYYY-MM-DD.pdf`
- [ ] Stocke dans `_AUDIT/legal/` (gitignored auto)

---

## 🟨 Hetzner DPA — ⏱ 20 min + 5 jours attente

### Étape 1 : Récup infos compte (5 min)

- [ ] Console : `https://console.hetzner.cloud/`
- [ ] Note ton **numéro client** : `K-_____________`
- [ ] Note la **date 1re facture** (Billing → Invoices) : `____ / ____ / 2026`

### Étape 2 : Remplir PDF (10 min)

PDF déjà téléchargé : `_AUDIT/legal/hetzner-dpa-template-2026-05-14.pdf`

Ouvre dans **Adobe Acrobat Reader → Remplir et signer**.

Remplis section **Customer** :

- [ ] Nom complet : `William <ton nom>` (personne physique, pas société)
- [ ] Adresse postale complète
- [ ] Email Hetzner (du compte)
- [ ] Numéro client : `K-XXXXXXX` (depuis étape 1)
- [ ] Date contrat : date 1re facture (depuis étape 1)

### Étape 3 : Signer (3 min)

- [ ] Adobe Acrobat → **Remplir et signer** → **Signer vous-même**
- [ ] Sauvegarde sous `_AUDIT/legal/dpa-hetzner-signed-YYYY-MM-DD.pdf`

### Étape 4 : Envoyer (2 min)

- [ ] Email à `support@hetzner.com`
- [ ] **Sujet** : `DPA signed - Account K-XXXXXXX`
- [ ] **Corps** :

  ```
  Hello Hetzner Team,

  Please find attached the signed Data Processing Agreement (DPA)
  for my account K-XXXXXXX.

  Could you please counter-sign and return the fully executed
  document to me at this email address?

  Thank you,
  William
  ```

- [ ] **Pièce jointe** : ton PDF signé

### Étape 5 : Attendre contre-signature (3-7 jours)

- [ ] Hetzner renvoie le PDF complet par email
- [ ] Renomme : `dpa-hetzner-countersigned-YYYY-MM-DD.pdf`
- [ ] Stocke dans `_AUDIT/legal/`
- [ ] Backup hors-repo (Bitwarden / drive chiffré)

---

## 🟦 DocuSeal — ⏱ 20 min

```
URL : https://docuseal.axion-ia.com
Login : admin créé au premier boot
```

### Étape 1 : API key (2 min)

- [ ] Login DocuSeal
- [ ] **Settings → API** (menu utilisateur)
- [ ] Copie le token **X-Auth-Token**
- [ ] Donne-le à Claude → il set `DOCUSEAL_API_KEY` via Coolify

### Étape 2 : Template « Devis Axion-IA V1 » (9 min)

- [ ] **Templates → + New Template**
- [ ] Upload un PDF vierge de devis OU **Start from scratch**
- [ ] Nom : `Devis Axion-IA V1`
- [ ] **Roles** → crée 2 rôles **exactement** :
  - `Client`
  - `Axion-IA`
- [ ] Place les champs sur le PDF :
  - Pour rôle **Client** : Signature + Date
  - Pour rôle **Axion-IA** : Signature + Date
  - Champs partagés texte (pré-remplis par le code) :
    - `quoteNumber`, `clientCompanyName`, `clientContactName`, `clientEmail`
    - `interventionType`, `amountHt`, `vatRate`, `amountTtc`, `validityDate`
- [ ] **Settings → ✅ Submitters sign in order**
- [ ] Sauvegarde
- [ ] Note l'ID dans l'URL `/templates/N` : `____`
- [ ] Donne-le à Claude → il set `DOCUSEAL_QUOTE_TEMPLATE_ID` via Coolify

### Étape 3 : Template « Contrat Axion-IA V1 » (9 min)

- [ ] Idem que devis, avec ton PDF contrat type
- [ ] 2 rôles `Client` + `Axion-IA`
- [ ] **✅ Submitters sign in order**
- [ ] Note l'ID : `____`
- [ ] Donne-le à Claude → il set `DOCUSEAL_CONTRACT_TEMPLATE_ID` via Coolify

📄 Procédure détaillée : `_AUDIT/legal/DOCUSEAL-TEMPLATE-SETUP.md`

---

## 🔴 BLOQUÉ par création société (à faire plus tard)

> Ces actions sont **conditionnelles** à la création de la société
> (OÜ Estonie ou SASU France).
> Tant que tu n'as pas créé d'entité juridique, **rien à faire ici**.

### Création société

- [ ] Choisir structure : OÜ Estonie e-Residency OU SASU France
- [ ] Procédure création (selon choix) :
  - **OÜ Estonie** : e-Residency Marketplace (Companio/1Office/Xolo), ~3 semaines
  - **SASU France** : Legalstart/Indy/Captain Contrat, ~10 jours

### Post-création société

- [ ] Ouvrir compte bancaire pro au nom société (Qonto/Revolut Business/banque trad.)
- [ ] **Stripe KYB** :
  - Crée compte Stripe au nom société
  - Upload K-bis (FR) ou registrikood (EE) + RIB pro + pièce ID dirigeant
  - Attendre validation Stripe (1-5 jours)
  - Copie `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET`
  - Donne-les à Claude → il les set dans Coolify
- [ ] **Webhook Stripe** :
  - Dashboard Stripe → Developers → Webhooks → Add endpoint
  - URL : `https://axion-ia.com/api/stripe/webhook`
  - Events : `checkout.session.completed`, `payment_intent.payment_failed`,
    `charge.refunded`, `charge.dispute.created`, `review.opened`
- [ ] **Re-facturation au nom société** :
  - Hetzner : Cloud Console → Billing → Billing Address → nom + adresse + n° TVA
  - Cloudflare : Manage Account → Members & Billing → Billing → idem
  - Namecheap (domaine) : Account → Profile → adresse contact
- [ ] **Re-signer DPAs au nom société** :
  - Hetzner : nouveau PDF signé → email `support@hetzner.com` avec mention "transfer to company"
  - Cloudflare : re-clic Accept DPA après changement billing
- [ ] **Update Axion-IA admin** :
  - Login `/admin/[prefix]/settings`
  - `SiteSetting.fiscal_regime` → `EE_OU` ou `FR_SARL` selon choix
  - Toutes les futures factures pickup automatiquement le bon legalSnapshot
- [ ] **Comptable** :
  - OÜ Estonie : Companio / 1Office / Xolo (intégré e-Residency)
  - SASU France : Indy / Tiime / Pennylane (intégrations bancaires auto)
- [ ] **Revue CGV par avocat** (recommandé avant 1er client > 5 k€)
  - Cabinet NTIC / RGPD à identifier
  - Brouillon code : `src/content/legal-*.ts`

---

## 🟢 DOMAINES OPTIONNELS / V1.5+

- [ ] **Zoho Mail DPA** — Vérifier si Zoho Free EU expose DPA dashboard
- [ ] **Sentry DPA** — Vérifier `https://sentry.io/legal/dpa/` (peut nécessiter compte business)
- [ ] **Registre activités traitement RGPD art. 30** — Constituer Excel/Notion
- [ ] **DMARC enforcement** : `p=none` → `p=quarantine` → `p=reject` (avant email marketing)
- [ ] **DNSSEC Cloudflare** — Reporté ~16 mai (session dédiée)

---

## 📌 ORDRE RECOMMANDÉ (priorité)

1. **🟧 Cloudflare DPA** (2 min, gratuit, no-brainer) → fais-le maintenant si tu veux
2. **🟨 Hetzner DPA** (20 min + 5j attente) → lance le process, attente se fait toute seule
3. **🟦 DocuSeal API key + 2 templates** (20 min) → fais quand tu veux tester le flow contrat
4. **🏢 Création société** (3 semaines OÜ / 10 jours SASU) → décision business, à ton rythme
5. **💳 Stripe KYB** → après création société uniquement
6. **🔁 Re-signature DPAs au nom société** → après création société uniquement

---

## 🔁 Quand tu reprends (prochaine session Claude)

Dis-moi :

- « Cloudflare DPA fait » → je coche dans le README
- « Hetzner DPA envoyé » → je coche
- « DocuSeal API key = ABC123 » → je set Coolify
- « Template devis ID = 42 » → je set Coolify
- « Société créée, voici STRIPE*SECRET_KEY=sk_live*... » → je set Coolify

Tout est tracé. Ne perds aucun document signé — backup obligatoire hors git.

---

**Dernière mise à jour** : 2026-05-14 (session autopilot Claude)
**Total temps actif Will** : ~45 min hors création société
**Total attente externe** : 5-7 jours (Hetzner contre-signature)
