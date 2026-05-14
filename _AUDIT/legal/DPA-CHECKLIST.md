# DPA Checklist — Action items Will

> Coche ✅ au fur et à mesure. Garde ce fichier sous la main, c'est le
> tracker unique des étapes restantes.

---

## 🟦 Hetzner DPA — version personne physique

**Pré-requis** : aucun. Tu signes en ton nom propre.

### Préparation

- [ ] **Récupère ton numéro de client Hetzner**
  - Va sur `https://console.hetzner.cloud/`
  - Menu utilisateur (icône en haut à droite) → ton nom complet
  - Ton n° client = format `K-XXXXXXX` (visible aussi sur factures)
  - Note-le : `K-_____________`

- [ ] **Récupère la date d'ouverture du compte**
  - `https://console.hetzner.cloud/` → **Billing** → **Invoices**
  - Date de la 1re facture = date de référence
  - Note-la : `____ / ____ / 2026`

- [ ] **Le PDF est déjà téléchargé** dans `_AUDIT/legal/hetzner-dpa-template-2026-05-14.pdf`
      (Téléchargé par Claude le 14 mai 2026 depuis `https://www.hetzner.com/AV/DPA_en.pdf`)

### Remplissage

Ouvre le PDF avec **Adobe Acrobat Reader** (gratuit) ou n'importe quel
éditeur PDF qui supporte "Fill & Sign".

- [ ] **Champ « Customer » (toi)** :
  - Nom complet : `William <ton nom de famille>`
  - Adresse : ton adresse postale complète
  - Email : ton email Hetzner (celui du compte)
  - Numéro de client : `K-XXXXXXX` (récupéré ci-dessus)
  - Date du contrat : date 1re facture

- [ ] **Vérifie les annexes** (Annex 1, 2, 3)
  - Annex 1 : décrit le traitement → pré-rempli côté Hetzner, rien à modifier
  - Annex 2 : sous-traitants ultérieurs (sub-processors) → liste pré-remplie
  - Annex 3 : mesures techniques et organisationnelles → pré-rempli

### Signature

Choix entre 2 options :

**Option A — Signature manuscrite scannée** :

- [ ] Imprime le PDF
- [ ] Signe + date + écris ton nom sous la signature
- [ ] Scanne (ou photo nette) → re-PDF via outil (Adobe scan, CamScanner, etc.)
- [ ] Vérifie que la signature est lisible

**Option B — Signature électronique** (plus rapide) :

- [ ] Ouvre le PDF dans Adobe Acrobat Reader
- [ ] Outil **« Remplir et signer »** → **« Signer vous-même »**
- [ ] Ajoute une signature (dessine, image, ou saisie texte)
- [ ] Sauvegarde le PDF signé

### Envoi à Hetzner

- [ ] **Email à `support@hetzner.com`** :
  - **Sujet** : `DPA signed - Account K-XXXXXXX` (remplace par ton n°)
  - **Corps** :

    ```
    Hello Hetzner Team,

    Please find attached the signed Data Processing Agreement (DPA)
    for my account K-XXXXXXX.

    Could you please counter-sign and return the fully executed
    document to me at this email address?

    Thank you,
    William <Ton Nom>
    ```

  - **Pièce jointe** : ton PDF signé

- [ ] **Renomme le PDF envoyé** : `dpa-hetzner-sent-YYYY-MM-DD.pdf`
      Stocke dans `_AUDIT/legal/` (gitignored)

### Réception contre-signée

- [ ] Hetzner contre-signe sous **3-7 jours ouvrés**
- [ ] Tu reçois le PDF complet par email
- [ ] **Renomme et stocke** : `_AUDIT/legal/dpa-hetzner-signed-YYYY-MM-DD.pdf`
- [ ] Pense à backup hors-repo (Bitwarden / drive perso chiffré)

---

## 🟧 Cloudflare DPA — version personne physique

**Pré-requis** : aucun. Tu cliques `Accept` dans le dashboard.

### Acceptation via dashboard

- [ ] Connecte-toi sur `https://dash.cloudflare.com/`
- [ ] Menu utilisateur (avatar haut droite) → **Manage Account**
- [ ] **Configurations** (sidebar gauche) → onglet **Compliance**
- [ ] Section **Data Processing Addendum (DPA)** → bouton **Accept DPA**
- [ ] Confirme l'acceptation (modal de confirmation)

### Téléchargement

- [ ] Après acceptation, un bouton **Download** apparaît
- [ ] Télécharge le PDF du DPA accepté
- [ ] **Renomme** : `dpa-cloudflare-signed-YYYY-MM-DD.pdf`
- [ ] Stocke dans `_AUDIT/legal/`

---

## 🟨 Documents complémentaires (V1.5+)

À traiter quand tu auras le temps, pas bloquant V1 :

- [ ] **Zoho Mail Free EU DPA** → vérifier accessibilité via dashboard Zoho (`https://accounts.zoho.eu/`)
- [ ] **Sentry DPA** → cf. `https://sentry.io/legal/dpa/` (peut nécessiter compte business)

---

## ⏱ Délai global réaliste

| Action                      | Toi (actif) | Attente externe  |
| --------------------------- | ----------- | ---------------- |
| Cloudflare DPA (clic)       | 2 min       | 0                |
| Hetzner DPA (signe + email) | 20 min      | 3-7 jours ouvrés |

→ **DPAs en main complets dans ~1 semaine.**

---

## 🚨 Important après création société

Une fois la OÜ Estonie ou SASU France créée et immatriculée :

1. **Modifier la facturation Hetzner** : `Cloud Console → Billing → Billing Address` → mettre nom + adresse société + n° TVA intra
2. **Re-signer Hetzner DPA** au nom de la société (email Hetzner avec le DPA déjà signé en perso + demande de transfert)
3. **Modifier la facturation Cloudflare** : `Dashboard → Manage Account → Members & Billing → Billing` → adresse société
4. **Re-cliquer Accept DPA Cloudflare** au nom de la société (le DPA est lié au compte, donc seul le billing change)
5. **Update `SiteSetting.fiscal_regime`** dans l'admin Axion-IA → `EE_OU` ou `FR_SARL` selon ton choix → toutes les futures factures émises pickup automatiquement le bon `legalSnapshot`
