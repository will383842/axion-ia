# ADR 0014 — DocuSeal self-hosted vs Yousign

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `agent-10-pre-booking-cadrage-devis-nda.md` §3, `03-ARCHITECTURE-CIBLE.md` §5.17, `STOP-AND-ASK.md` D36

---

## Contexte

Le module Booking V1 doit faire signer électroniquement :

- **Contrats client** (CGV + bon de commande, par booking confirmé).
- **NDA** pour les 7 secteurs sensibles (cf. ADR 0012 Q9).
- **Devis** parcours B (Sprint X.7), signature optionnelle valant acceptation commerciale.
- **Avenants** post-envoi (D62 — versioning contrat).

Deux options ont été comparées (`agent-10` §3) :

| Critère            | Yousign (SaaS FR)                                     | DocuSeal self-hosted (Docker)                          |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------ |
| Niveau eIDAS       | SES + AES + QES                                       | SES (V1 suffisant)                                     |
| Hébergement        | Cloud France                                          | Hetzner CPX32 (Nuremberg)                              |
| Coût mensuel       | 9–30 €/mois forfait OU 1,40 €/signature pay-as-you-go | **0 € (open-source MIT)**                              |
| API                | REST + webhook                                        | REST + webhook                                         |
| Templates          | Drag-drop UI Yousign                                  | Drag-drop UI DocuSeal (équivalent)                     |
| Audit trail        | OUI (PDF signé inclut horodatage qualifié)            | OUI (PDF signé inclut horodatage local + hash SHA-256) |
| RGPD               | DPA signé chez Yousign                                | Maître chez nous, pas de sous-traitant                 |
| eIDAS QES          | OUI (vidéo identité + cert qualifié)                  | NON V1 (hook V2+ via QTSP externe — cf. §5.17.4)       |
| Effort intégration | ~2 jours                                              | ~3-4 jours (Sprint X.3 incl. déploiement Docker)       |

V1 ne requiert pas eIDAS QES (signature qualifiée) : SES (Simple Electronic Signature) suffit pour tous les contrats commerciaux B2B, dès lors que l'audit trail est probant (RGPD eIDAS art. 25 §1).

## Décision

### DocuSeal self-hosted Docker retenu V1

#### Stack

- **DocuSeal v1.x** déployé en container Docker sur Hetzner CPX32 (même VPS qu'Axion-IA via Coolify).
- Sous-domaine : `docuseal.axion-ia.com` (proxy Caddy automatique via Coolify).
- DB DocuSeal : Postgres dédié (séparé de la DB AxionIA, container Coolify dédié).
- Storage : volume Docker mappé sur Hetzner Storage Box (`docuseal/` bucket).
- TLS : Let's Encrypt auto via Caddy.
- Auth admin : SSO email magic link DocuSeal (`AUTH_EMAIL_*` env vars DocuSeal).

#### Intégration AxionIA

- Variables `DOCUSEAL_BASE_URL`, `DOCUSEAL_API_KEY`, `DOCUSEAL_WEBHOOK_SECRET` dans `.env.example`.
- Endpoints utilisés (cf. §5.17.3) :
  - `POST /api/submissions` — créer une demande de signature (CGV + bon de commande)
  - `GET /api/submissions/:id` — état signature
  - `POST /api/templates` — uploader un template (CGV, NDA, devis)
  - Webhook `submission.completed` → AxionIA met à jour `ContractDocument.status = signed`
- Table AxionIA : `DocusealWebhookEvent` (idempotence webhook).
- Lib : client REST custom léger (~200 lignes TS, pas de package npm officiel V1).

#### Niveau de garantie eIDAS-SES

- Audit trail PDF inclut : horodatage UTC, IP signataire, user-agent, hash SHA-256 du PDF final, identité revendiquée (email + nom).
- Suffisant pour B2B France/UE pour les CGV / NDA / devis.

#### Migration V2+ vers QES (option)

- Si un client grand compte exige QES (signature qualifiée), AxionIA passe par un QTSP eIDAS externe (DocuSign EU, Universign, Certigna) en mode pass-through, sans changer le code AxionIA — uniquement le template DocuSeal pointe vers le QTSP. Voir §5.17.4.

## Conséquences

### Techniques

- 1 container Docker supplémentaire sur Hetzner CPX32 (estimé +200 MB RAM, +1 vCPU peak).
- 1 sous-domaine + 1 cert SSL Let's Encrypt (auto Caddy).
- 1 DB Postgres supplémentaire (~50 MB initial, croissance lente).
- Backup : DocuSeal DB inclus dans le backup Coolify global (snapshot quotidien Hetzner).
- 0 dépendance npm payante.

### Business

- **0 € fee par signature** vs Yousign 1,40 €/sig — économie ~500–1500 €/an sur volume V1 estimé.
- 100 % UE (Hetzner Nuremberg).
- Pas de fournisseur tiers à inscrire dans le registre sous-processeurs (DocuSeal = self-hosted = pas un sous-processeur).
- Risque : si DocuSeal v2 introduit une régression, AxionIA doit maintenir / patcher. Effort estimé < 1 j/an.

### Conformité

- DPA non requis (self-hosted).
- RGPD : données signataires (email, nom, IP) hébergées dans DB DocuSeal AxionIA-managed, exportables via `/api/gdpr-export` AxionIA (lien jointure par `Client.email`).
- Audit trail probant en B2B (eIDAS SES). Pour QES → V2+.

## Alternatives écartées

- **Yousign SaaS** : coût récurrent inutile V1, ajout d'un sous-processeur dans `legal.ts:44`, DPA papier à signer.
- **DocuSeal SaaS (docuseal.com Cloud)** : 19 USD/mois, sous-processeur étranger US, pas d'avantage vs self-hosted.
- **PandaDoc / DocuSign EU / Adobe Sign** : tarifs prohibitifs V1 (50–100 €/mois minimum).
- **PDF + signature manuscrite scannée** : faible probant, pas d'audit trail eIDAS, rejeté.
- **Signature OAuth via WebAuthn / passkey** : pas conforme eIDAS (manque audit trail probant pour tiers).

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-10-pre-booking-cadrage-devis-nda.md` §3 (comparatif), §4 (intégration)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.17 (DocuSeal stack + endpoints), §5.1.9 (DocusealWebhookEvent)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` D36
- ADR 0009 (hosting Hetzner CPX32 + Coolify)
