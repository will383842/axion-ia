# Axion-IA — Dossier juridique opérationnel

Centralise les documents juridiques signés requis pour opérer Axion-IA en
conformité **RGPD art. 28** (sous-traitants) et **CGV / CGU** clients.

> ⚠️ **Tous les PDFs de ce dossier sont gitignored** (cf. `.gitignore`).
> Le repo public ne doit pas exposer des documents signés. Stocke les
> backups dans un coffre-fort externe (Bitwarden / 1Password / Tresorit /
> drive personnel chiffré).

---

## Sous-traitants RGPD art. 28 — DPAs à signer

| Sous-traitant                         | Type de traitement                                     | Statut DPA                            | Fichier attendu                        |
| ------------------------------------- | ------------------------------------------------------ | ------------------------------------- | -------------------------------------- |
| **Hetzner Online GmbH**               | Hébergement serveur CPX32 (PostgreSQL, Redis, app web) | ⏳ À signer                           | `dpa-hetzner-signed-YYYY-MM-DD.pdf`    |
| **Cloudflare Inc.**                   | CDN, WAF, DNS, SSL terminaison                         | ⏳ À accepter dashboard               | `dpa-cloudflare-signed-YYYY-MM-DD.pdf` |
| **Stripe Payments Europe Ltd.**       | Traitement paiements (IBAN, identité dirigeant)        | 🔒 Après KYB                          | Activé automatiquement au KYB live     |
| **Zoho Corporation**                  | Boîte email `contact@axion-ia.com` (Zoho Mail Free EU) | ⏳ DPA à vérifier                     | `dpa-zoho-signed-YYYY-MM-DD.pdf`       |
| **Sentry / Functional Software Inc.** | Monitoring d'erreurs front + back                      | ⏳ DPA à vérifier                     | `dpa-sentry-signed-YYYY-MM-DD.pdf`     |
| **OpenStreetMap / Nominatim**         | Géocodage de villes (pas de PII directe)               | ✅ N/A (donnée publique)              | —                                      |
| **Plausible Analytics (self-hosted)** | Analytics web sans cookies                             | ✅ Self-hosted = pas de sous-traitant | —                                      |
| **DocuSeal (self-hosted)**            | Signature électronique contrats                        | ✅ Self-hosted = pas de sous-traitant | —                                      |

---

## Documents internes à constituer

| Document                                                        | Statut                                          | Fichier                                    |
| --------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| **CGV B2B** (à faire revoir par avocat avant 1er client > 5 k€) | ⏳ Brouillon en code (`src/content/legal-*.ts`) | `cgv-axionia-vN-YYYY-MM-DD.pdf`            |
| **CGU site**                                                    | ✅ Servi via `/fr/conditions-utilisation`       | —                                          |
| **Politique de confidentialité**                                | ✅ Servi via `/fr/confidentialite`              | —                                          |
| **Registre des activités de traitement RGPD** (art. 30)         | ⏳ À constituer                                 | `registre-traitement-rgpd-YYYY-MM-DD.xlsx` |
| **Politique de cookies**                                        | ✅ Servi via `/fr/cookies`                      | —                                          |
| **Mentions légales**                                            | ✅ Servi via `/fr/mentions-legales`             | —                                          |

---

## Pré-requis avant 1er encaissement

1. ✅ Création société (OÜ Estonie ou SASU France) — **EN ATTENTE**
2. ✅ Compte bancaire pro au nom société — bloqué par 1.
3. ✅ Compte Stripe KYB validé — bloqué par 1. + 2.
4. ✅ DPAs Hetzner + Cloudflare re-signés au nom société — bloqué par 1.
5. ✅ Revue CGV par avocat (recommandé > 5 k€/client) — peut être fait en parallèle

> Tant que (1) n'est pas fait, **encaisser proprement est impossible**.
> Mais tout le reste (signer DPAs en perso, configurer Stripe test mode,
> tester le flow visiteur) **est faisable sans société**.

---

## Procédure DPA Hetzner — version personne physique (en attendant société)

Cf. `DPA-CHECKLIST.md` pour la checklist détaillée.

PDF template Hetzner téléchargé : `hetzner-dpa-template-2026-05-14.pdf`
(gitignored — utilisé comme base pour signature).

---

## Procédure DPA Cloudflare — version personne physique

1. Connecte-toi sur `https://dash.cloudflare.com/`
2. Menu utilisateur (haut droite) → **Manage Account**
3. **Configurations** → onglet **Compliance**
4. Section **Data Processing Addendum (DPA)** → bouton **Accept DPA**
5. Télécharge le PDF généré → renomme `dpa-cloudflare-signed-YYYY-MM-DD.pdf`
6. Stocke dans ce dossier (gitignored)

---

## Procédure de rappel — auto-audit trimestriel

Tous les 3 mois, ouvre cette checklist et vérifie :

- [ ] Tous les DPAs sont signés et < 2 ans
- [ ] Liste des sous-traitants est à jour (toute nouvelle dépendance ajoutée à `src/content/subprocessors.ts` ?)
- [ ] Page `/fr/sous-processeurs` reflète la réalité
- [ ] Registre des traitements à jour (nouvelles features = nouveau traitement ?)
- [ ] CGV à jour (changements tarifs, périmètre, etc.)
- [ ] Backup PDFs juridiques fait sur coffre externe

---

## Contacts juridiques externes

| Besoin                                             | Contact recommandé                                      |
| -------------------------------------------------- | ------------------------------------------------------- |
| Avocat NTIC / RGPD                                 | À identifier (cabinet Paris ou Tallinn selon structure) |
| DPO externe (si CA > 1 M€ ou +50 salariés à terme) | À évaluer en phase 2                                    |
| Comptable société (OÜ Estonie)                     | Via e-Residency Marketplace (Companio / 1Office / Xolo) |
| Comptable société (FR SASU)                        | Indy / Tiime / Pennylane intégré                        |
