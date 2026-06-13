# Documents interventions — Runbook de mise en route

Bibliothèque admin de documents pédagogiques par prestation (formation / 1-to-1 /
audit). Branche : `feat/documents-interventions`.

---

## 1. Prérequis infra (accès Will — Cloudflare / Coolify)

### 1.1 Variables d'environnement (Coolify → Application → Env, scope RUN)

| Variable | Rôle |
| --- | --- |
| `R2_ACCOUNT_ID` | Compte Cloudflare (endpoint R2) |
| `R2_ACCESS_KEY_ID` | Clé d'accès S3 |
| `R2_SECRET_ACCESS_KEY` | Secret S3 |
| `R2_BUCKET_NAME` | Nom du bucket |
| `R2_PUBLIC_BASE_URL` | (optionnel) |

> **Sans ces variables :** la bibliothèque s'affiche et navigue normalement, mais
> le dépôt de fichier renvoie « Stockage R2 non configuré » et les e-mails partent
> **sans** lien de téléchargement (comportement fail-soft, rien ne casse).

### 1.2 CORS du bucket R2 — INDISPENSABLE pour l'upload

L'upload se fait en **PUT direct navigateur → R2** (presigned). Le bucket doit
autoriser le CORS PUT depuis l'origine de la console admin.

Cloudflare → R2 → *bucket* → Settings → **CORS Policy** :

```json
[
  {
    "AllowedOrigins": ["https://axion-ia.com", "https://www.axion-ia.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Adapter `AllowedOrigins` à l'origine réelle servant la console admin. Sans ce
> CORS, le `fetch(PUT)` du navigateur est bloqué et le dépôt échoue.

---

## 2. Déploiement

1. **Merger la PR** `feat/documents-interventions` → `main` (la CI Gate A valide avant).
2. Le pipeline GitHub Actions build + push l'image GHCR ; Coolify pull + restart.
3. **La migration `20260613120000_intervention_documents` est appliquée
   AUTOMATIQUEMENT** par l'entrypoint du conteneur (`prisma migrate deploy`).
   → Aucune action manuelle de migration. Migration purement additive (3 tables +
   6 enums), aucune donnée existante touchée.

---

## 3. Vérification post-déploiement

1. Console admin → la sidebar affiche le groupe **« Documents interventions »**.
2. Onglet → **Formations** → ouvrir *IA Express* → les 4 rayons + slots s'affichent.
3. Déposer un `.docx` sur un slot → **Publier** (note « Quoi de neuf ») → la version
   courante apparaît avec liens **Source / PDF** + l'historique.
4. **Annuaire équipe** → *Importer les formateurs (fiches Qualiopi)* → les formateurs
   actifs apparaissent ; ajouter un commercial à la main.
5. Publier une nouvelle version → un e-mail part aux destinataires concernés, avec
   les boutons de téléchargement (liens signés 14 j).

---

## 4. Notes & limites connues

- **Upload gros fichiers** : transit direct navigateur → R2, pas de limite serveur.
- **RBAC** : dépôt = rôle editor+ ; publication = admin+.
- **Agrégation Qualiopi** : attestation/émargement sont générés *par session* par le
  Formation Engine → la bibliothèque renvoie vers Qualiopi → Sessions (pas d'upload).
- **Bug d'environnement LOCAL (pré-existant, hors feature)** : `@adobe/css-tools`
  mal résolu casse le *setup global* Vitest **en local** → réparer via `pnpm install`.
  Le **CI n'est pas touché** (install propre).
- **Reste optionnel** : créer le contenu des kits (16 autres formations, audits,
  1-to-1) au fil de l'eau ; espace ressources à token pour consultation permanente (P3).
