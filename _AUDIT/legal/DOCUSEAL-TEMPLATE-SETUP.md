# DocuSeal — Configuration template signature B2B Axion-IA

Pré-requis côté UI DocuSeal pour que le code Axion-IA fonctionne correctement
(helper `createContractSubmission()` dans `src/lib/docuseal.ts`).

> 🎯 **Pattern garanti par le code** : le client signe en 1er, Axion-IA
> contre-signe en 2e. Tant que les 2 signatures ne sont pas collectées,
> `Booking.status` reste en `contract_payment_sent` (pas en `contract_signed`).

---

## 📐 Architecture template

Chaque template DocuSeal Axion-IA (contrat, devis, NDA, avenant) DOIT déclarer
**2 rôles canoniques** identifiés par leur libellé exact :

| Rôle DocuSeal | Constante TS             | Index ordre signature    |
| ------------- | ------------------------ | ------------------------ |
| `Client`      | `DOCUSEAL_ROLES.CLIENT`  | 1er (signataire initial) |
| `Axion-IA`    | `DOCUSEAL_ROLES.AXIONIA` | 2e (contre-signature)    |

Si tu nommes différemment côté UI (ex. "Customer", "Vendeur"), il faut
mettre à jour `DOCUSEAL_ROLES` dans `src/lib/docuseal.ts:264` en miroir.
**Recommandation : garder les libellés "Client" et "Axion-IA" par défaut.**

---

## 🛠 Procédure pas-à-pas (premier template Devis)

### 1. Connecter à DocuSeal admin

```
URL  : https://docuseal.axion-ia.com
Login: admin créé au premier boot
```

### 2. Préparer le PDF source

Le PDF de base peut être :

- **(a) PDF Tiptap exporté** : Will rédige le contrat dans `/admin/[prefix]/templates`
  (V1.5+), exporte en PDF
- **(b) PDF statique vierge** : un PDF avec les sections texte mais sans
  signature → DocuSeal place les champs signature dessus
- **(c) DocuSeal template-from-scratch** : éditeur HTML+CSS direct dans
  DocuSeal UI sans PDF préexistant

Pour V1 : option (b) est la plus simple. Crée un PDF "DEVIS-vierge.pdf"
avec les variables `{{quoteNumber}}`, `{{clientCompanyName}}`, etc.
en texte et glisse-les comme champs DocuSeal.

### 3. Créer le template DocuSeal

1. **Templates** (menu gauche) → **+ New Template**
2. **Upload PDF** (option b) ou **Start from scratch** (option c)
3. Donne un nom : `Devis Axion-IA V1` (cohérent avec ton naming)

### 4. Définir les **2 rôles**

Dans l'éditeur template, panneau de droite ou onglet **Roles** :

- **Role 1** : nom = `Client` (exact, casse exacte, sans espace)
- **Role 2** : nom = `Axion-IA` (exact, avec tiret)

### 5. Placer les champs

Pour chaque rôle, place les champs nécessaires sur le PDF :

#### Champs assignés au rôle `Client`

- **Signature** (obligatoire, format `Signature`)
- **Date** (format `Date`, default = `today`)
- Optionnel : Initials, Text fields pré-remplis

#### Champs assignés au rôle `Axion-IA`

- **Signature** (obligatoire, format `Signature`)
- **Date** (format `Date`, default = `today`)

#### Champs partagés (pré-remplis par le code)

Variables dynamiques passées via `fields` :

- `quoteNumber` (Text, pré-rempli avec `DEVIS-2026-NNNN`)
- `clientCompanyName` (Text)
- `clientContactName` (Text)
- `clientEmail` (Email)
- `interventionType` (Text)
- `amountHt` (Text format monnaie)
- `vatRate` (Text)
- `amountTtc` (Text)
- `validityDate` (Date)

> ⚠️ Les **champs Signature MUST être assignés à un rôle**. Sans assignment,
> DocuSeal ne sait pas qui doit signer où → submission rejetée à la création.

### 6. Activer l'ordre séquentiel

Dans **Settings** du template :

- ✅ **Submitters sign in order** (= "preserved" côté API)

Si non coché, le `submitters_order: "preserved"` envoyé par le code est ignoré
au profit des préférences template DocuSeal. La doctrine code doit donc être
miroir côté UI.

### 7. Récupérer l'ID

Une fois sauvegardé, l'URL est de la forme :

```
https://docuseal.axion-ia.com/templates/42
                                       ^^
                                       ID du template
```

→ Reporter cet ID dans Coolify env vars :

- `DOCUSEAL_QUOTE_TEMPLATE_ID=42` (pour le template devis)
- `DOCUSEAL_CONTRACT_TEMPLATE_ID=43` (pour le template contrat — créer pareillement)

---

## 🧪 Vérification end-to-end

Après création template + setting env var, test rapide via la console
admin Axion-IA (Sprint X.3 quand il sera livré) :

1. Ouvre `/admin/[prefix]/reservations/[bookingId]`
2. Clique **Envoyer contrat + acompte** (action `sendContractAndDepositRequestAction`)
3. Vérifications attendues :
   - DocuSeal crée la submission avec **2 submitters** dans le bon ordre
   - Le CLIENT reçoit l'email signature (1er)
   - Axion-IA NE reçoit RIEN tant que le client n'a pas signé
   - Une fois le client signataire → email envoyé à `AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL`
   - Une fois Axion-IA signataire → webhook `form.completed` → Booking transite

---

## ⚙️ Env vars Coolify à set

| Clé                                    | Valeur                                                 | Optionnel ?                        |
| -------------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| `DOCUSEAL_URL`                         | `https://docuseal.axion-ia.com`                        | ✅ déjà set                        |
| `DOCUSEAL_API_KEY`                     | Token X-Auth-Token depuis DocuSeal UI → Settings → API | ❌ REQUIS                          |
| `DOCUSEAL_WEBHOOK_SECRET`              | Secret HMAC depuis DocuSeal UI → Settings → Webhooks   | ✅ déjà set                        |
| `DOCUSEAL_QUOTE_TEMPLATE_ID`           | ID numérique du template devis                         | ❌ REQUIS                          |
| `DOCUSEAL_CONTRACT_TEMPLATE_ID`        | ID numérique du template contrat                       | ❌ REQUIS V1                       |
| `AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL` | Email Will (ex. `will@axion-ia.com`)                   | ⚠️ Fallback `contact@axion-ia.com` |
| `AXIONIA_CONTRACT_COUNTERSIGNER_NAME`  | Nom contre-signataire (ex. `William`)                  | ⚠️ Fallback `Axion-IA`             |

---

## 🔁 Workflow récap visuel

```
[Will admin clic 1]                          [Webhook DocuSeal]
        │                                              │
        ▼                                              ▼
┌───────────────────┐  envoi email   ┌──────────────────────────┐
│ sendContract...   │ ─────────────► │   submission.created     │
│ Action()          │                │   submitters_order:      │
└───────────────────┘                │     preserved            │
                                     │   submitters: [          │
                                     │     {Client, 1er} ←──── DocuSeal envoie ici en 1er
                                     │     {Axion-IA, 2e}      │
                                     │   ]                      │
                                     └──────────────────────────┘
                                                │
                                                ▼ (client signe)
                                     ┌──────────────────────────┐
                                     │   form.completed (client)│
                                     │   → DocuSeal envoie       │
                                     │     l'email à Axion-IA    │
                                     └──────────────────────────┘
                                                │
                                                ▼ (Axion-IA signe)
                                     ┌──────────────────────────┐
                                     │   submission.completed   │
                                     │   → webhook              │
                                     │   → Booking.status       │
                                     │     transite à           │
                                     │     contract_signed      │
                                     └──────────────────────────┘
```

---

## 🚨 Cas dégradés à gérer

| Situation                        | Comportement attendu                              | Action admin                               |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| Client refuse / abandonne        | `form.declined` ou expiration                     | `markQuoteDeclinedAction`                  |
| Axion-IA refuse de contre-signer | Pas natif DocuSeal — Will doit annuler submission | `cancelAndReissueContractAction` (D62)     |
| Client signe mais Will oublie    | Status `pending` éternel                          | Cron `contract-pending-reminder` (X.12)    |
| Email Axion-IA invalide          | DocuSeal renvoie 422 à la création                | Code retourne `DocusealApiError` → fix env |
| Contrat > 50 pages               | Pas de limite DocuSeal hard                       | OK                                         |

---

**Quand tu auras créé le template devis dans DocuSeal UI, donne-moi l'ID
(`/templates/N` dans l'URL) → je set `DOCUSEAL_QUOTE_TEMPLATE_ID=N` via API
Coolify.**

Idem pour le template contrat quand tu le créeras.
