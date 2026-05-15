# DPA Register — Axion-IA OÜ

**Responsable** : Will (gérant Axion-IA OÜ) · contact RGPD = `contact@axion-ia.com`
**Désignation DPO** : pas d'obligation formelle (RGPD art. 37 — Axion-IA OÜ
est gérant unique, < 250 employés, pas de profilage à grande échelle).
Will agit comme **DPO de fait** : toute demande RGPD passe par
`contact@axion-ia.com`.
**Tenue** : ce fichier sert de registre RGPD art. 30 (registre des activités
de traitement) côté sous-processeurs. Révision trimestrielle minimum.
**Statut juridique** : RGPD (UE) 2016/679, droit estonien (AKI compétent).

---

## 1. Synthèse — sous-processeurs déclarés

| #   | Sous-processeur            | Finalité                             | Localisation            | DPA    | Base légale transfert      | Statut          |
| --- | -------------------------- | ------------------------------------ | ----------------------- | ------ | -------------------------- | --------------- |
| 1   | Hetzner Online GmbH        | VPS + Storage Box backups offsite    | Allemagne (Frankfurt)   | papier | UE intra-zone              | 🟡 à signer     |
| 2   | Cloudflare, Inc.           | CDN + DDoS + Turnstile captcha       | États-Unis              | online | SCC + EU-US DPF            | 🟡 à accepter   |
| 3   | Telegram FZ-LLC            | Notifications admin (Bot API)        | Émirats Arabes Unis     | aucun  | Art. 49 + minimisation PII | ✅ ADR 0010     |
| 4   | Sentry (self-hosted)       | Crash reporting + traces             | Allemagne (VPS Hetzner) | NA     | UE intra-zone              | ✅ self-hosted  |
| 5   | Plausible (self-hosted)    | Analytics anonymes                   | Allemagne (VPS Hetzner) | NA     | UE intra-zone              | ✅ self-hosted  |
| 6   | Uptime Kuma (self-hosted)  | Monitoring uptime                    | Allemagne (VPS Hetzner) | NA     | UE intra-zone              | ✅ self-hosted  |
| 7   | OpenAI, LLC                | LLM contenus (GPT-4o) — content-gen  | États-Unis              | online | SCC + EU-US DPF + ZDR      | 🟡 à signer     |
| 8   | Anthropic PBC              | LLM contenus (Claude) — content-gen  | États-Unis              | online | SCC + EU-US DPF            | 🟡 à signer     |
| 9   | Perplexity AI, Inc.        | Recherche temps-réel — content-gen   | États-Unis              | online | SCC + EU-US DPF            | 🟡 à signer     |
| 10  | Unsplash Inc.              | Recherche images stock — content-gen | Canada                  | online | Décision d'adéquation UE   | 🟡 à signer     |
| 11  | Voyage AI, Inc.            | Embeddings KB (voyage-3-lite)        | États-Unis              | online | SCC + EU-US DPF            | 🟡 à signer     |
| 12  | Stripe Payments Europe Ltd | Paiements (Checkout + Radar)         | Irlande (UE) + USA      | online | SCC + EU-US DPF            | 🟡 à accepter   |
| 13  | OSM Foundation (Nominatim) | Géocodage villes saisies             | UK + UE                 | NA     | Décision d'adéquation UE   | ✅ usage public |
| 14  | DocuSeal (self-hosted)     | Signature électronique contrats      | Allemagne (VPS Hetzner) | NA     | UE intra-zone              | ✅ self-hosted  |

> ⚠️ **Backblaze N'EST PAS utilisé**. Le code utilise Hetzner Storage Box uniquement
> (`HETZNER_STORAGE_*` env vars). La mention Backblaze dans `src/content/legal.ts`
> Sprint 24/A1 doit être retirée — voir Action correctif §8 ci-dessous.

> 🆕 **Lignes 7-9 ajoutées 2026-05-14** (Pass B fix P0-3). Les 3 providers IA
> du content generator sont déclarés _avant activation prod_ — leurs clés API
> ne sont pas encore en Coolify env vars. Les DPA doivent être signés/acceptés
> avant que Will n'active `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
> `PERPLEXITY_API_KEY` en production.

> 🆕 **Lignes 10-14 ajoutées 2026-05-15** (Audit B5 fix P0-2/P0-3/P0-5).
> Cinq sous-processeurs supplémentaires ajoutés au registre RGPD art. 30 :
>
> - **Unsplash** (content-gen actif, DPA non signé → bloquant cutover).
> - **Voyage AI** (V1 = stub déterministe ; activation Sprint KB-13 lorsque
>   `VOYAGE_API_KEY` est ajoutée à Coolify env — DPA à signer avant).
> - **Stripe / OSM / DocuSeal** : déjà déclarés dans `src/content/subprocessors.ts`
>   (page publique `/sous-processeurs`) mais oubliés du registre interne art. 30.
>   La SSOT publique unique est désormais `src/content/subprocessors.ts` ; ce
>   registre interne lui correspond ligne à ligne (RGPD art. 30 + 28).

---

## 2. Hetzner Online GmbH (priorité 1 — bloquant cutover)

| Champ                     | Valeur                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Nom légal**             | Hetzner Online GmbH                                                                         |
| **Adresse**               | Industriestr. 25, 91710 Gunzenhausen, Allemagne                                             |
| **Finalité**              | Hébergement VPS CPX32 + Storage Box BX11 (backups offsite chiffrés AES-256)                 |
| **Données traitées**      | Toutes les données applicatives (DB Postgres, Redis, fichiers uploads, backups DB chiffrés) |
| **Localisation physique** | Datacenter Frankfurt (UE)                                                                   |
| **Garanties**             | ISO 27001, ISO 9001, BSI C5, EU-DSGVO compliant                                             |
| **DPA**                   | À signer (papier ou électronique)                                                           |
| **Lien template**         | https://docs.hetzner.com/de/dsgvo/ (FR/DE/EN)                                               |
| **Procédure**             | Connexion Hetzner Robot → Compliance → DSGVO/GDPR → Sign Auftragsverarbeitungsvertrag       |
| **Durée conservation**    | Liée au contrat (résiliation = 30 j de purge auto)                                          |
| **Statut**                | 🟡 **À SIGNER** par Will avant cutover                                                      |
| **Date signature**        | _(à compléter)_                                                                             |
| **Référence interne**     | _(à compléter — n° ticket Hetzner)_                                                         |

---

## 3. Cloudflare, Inc.

| Champ                     | Valeur                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Nom légal**             | Cloudflare, Inc.                                                              |
| **Adresse**               | 101 Townsend St, San Francisco, CA 94107, USA                                 |
| **Finalité**              | CDN + protection DDoS + Turnstile (captcha anti-spam formulaires)             |
| **Données traitées**      | IP visiteur, User-Agent, requêtes HTTP (logs CDN)                             |
| **Localisation physique** | Edge mondial — données peuvent être routées via des POPs hors UE              |
| **Garanties**             | DPA + clauses contractuelles types (SCC) + EU-US Data Privacy Framework (DPF) |
| **DPA**                   | Online — auto-acceptable depuis dashboard CF                                  |
| **Lien**                  | https://www.cloudflare.com/cloudflare-customer-dpa/                           |
| **Procédure**             | Dashboard Cloudflare → Manage Account → Configurations → Privacy → Sign DPA   |
| **Durée conservation**    | Logs CDN : 30 j max                                                           |
| **Statut**                | 🟡 **À ACCEPTER** par Will avant cutover                                      |
| **Date signature**        | _(à compléter)_                                                               |

---

## 4. Telegram FZ-LLC

| Champ                     | Valeur                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | Telegram FZ-LLC                                                                                                                                 |
| **Adresse**               | 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ (UK) — opérations FZ-LLC Dubai                                                            |
| **Finalité**              | Notifications admin via Bot API (~14 messages/jour côté ops)                                                                                    |
| **Données traitées**      | **PII minimisée** (cf. ADR 0010) : email partiel `j****@acme.com`, initiales `J. D.`, téléphone partiel, sociétés en clair, dates/prix/IDs UUID |
| **Localisation physique** | Émirats Arabes Unis (EAU) — pays sans décision d'adéquation                                                                                     |
| **Garanties**             | Aucun DPA standard. **Base légale = RGPD art. 49.1.a (consentement explicite admin)** + minimisation PII (ADR 0010).                            |
| **DPA**                   | NA — pas de DPA standard pour Telegram Bot API                                                                                                  |
| **Procédure mitigation**  | ADR 0010 acté + helper `src/lib/pii-redaction.ts` + 14 sites patchés                                                                            |
| **Statut**                | ✅ **CONFORME** post-Sprint-24.1 (minimisation appliquée)                                                                                       |
| **Révision**              | Si volume > 100 msg/jour ou multi-utilisateur ops → migrer Mattermost UE (option B ADR 0010)                                                    |

---

## 5. OpenAI, LLC (content-gen — priorité 2 avant cutover RUN)

| Champ                     | Valeur                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | OpenAI, LLC                                                                                                                                                               |
| **Adresse**               | 3180 18th Street, San Francisco, CA 94110, USA                                                                                                                            |
| **Finalité**              | Génération de contenu éditorial (GPT-4o + gpt-4o-mini) — landing villes, blog, comparatifs, FAQ                                                                           |
| **Données traitées**      | Prompts éditoriaux (slug ville, audience size INSEE, organisation type, search intent). **Aucune PII client** (pas d'email/nom/téléphone dans les prompts).               |
| **Localisation physique** | États-Unis (option EU data residency activable sur compte Enterprise)                                                                                                     |
| **Garanties**             | DPA standard + SCC (annexe IV) + EU-US Data Privacy Framework (OpenAI inscrit DPF list)                                                                                   |
| **DPA**                   | Online — `https://openai.com/policies/data-processing-addendum`                                                                                                           |
| **Procédure**             | Platform OpenAI → Settings → Data Controls → Sign DPA. Activer **Zero Data Retention (ZDR)** si éligible (org Tier 4+).                                                   |
| **Durée conservation**    | API standard : 30 j abuse monitoring (puis purge). ZDR : 0 j.                                                                                                             |
| **Statut**                | 🟡 **À SIGNER** par Will avant activation `OPENAI_API_KEY` en prod                                                                                                        |
| **Date signature**        | _(à compléter)_                                                                                                                                                           |
| **Référence interne**     | _(à compléter — ID compte OpenAI)_                                                                                                                                        |
| **Risk note**             | Si demain les prompts incluent du contenu client (logs Sentry réinjectés, snippets feedback) → re-évaluer base légale + minimisation. V1 = prompts éditoriaux uniquement. |

---

## 6. Anthropic PBC (content-gen — priorité 2 avant cutover RUN)

| Champ                     | Valeur                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Nom légal**             | Anthropic PBC                                                                                         |
| **Adresse**               | 548 Market St, PMB 90375, San Francisco, CA 94104, USA                                                |
| **Finalité**              | Génération de contenu éditorial (Claude Sonnet/Opus/Haiku) — fallback OpenAI + multi-modèles V2       |
| **Données traitées**      | Idem OpenAI : prompts éditoriaux uniquement, pas de PII client                                        |
| **Localisation physique** | États-Unis (option AWS Bedrock EU activable via account-switch Bedrock)                               |
| **Garanties**             | Commercial DPA + SCC + EU-US Data Privacy Framework (Anthropic inscrit DPF list)                      |
| **DPA**                   | Online — `https://www.anthropic.com/legal/commercial-terms` → "Data Processing Addendum"              |
| **Procédure**             | Console Anthropic → Settings → Privacy → Sign DPA. Bedrock EU : changer endpoint vers `eu-central-1`. |
| **Durée conservation**    | API standard : 30 j abuse monitoring (commercial), opt-out training par défaut.                       |
| **Statut**                | 🟡 **À SIGNER** par Will avant activation `ANTHROPIC_API_KEY` en prod                                 |
| **Date signature**        | _(à compléter)_                                                                                       |
| **Référence interne**     | _(à compléter — ID compte Anthropic)_                                                                 |

---

## 7. Perplexity AI, Inc. (content-gen — priorité 2 avant cutover RUN)

| Champ                     | Valeur                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | Perplexity AI, Inc.                                                                                                                     |
| **Adresse**               | 575 Market St, Floor 35, San Francisco, CA 94105, USA                                                                                   |
| **Finalité**              | Recherche temps-réel + citations sources (Sonar API) — enrichissement RSS, fact-checking V2                                             |
| **Données traitées**      | Requêtes éditoriales (slug, thématique). Réponses incluent URLs sources citées (CreativeWork JSON-LD). Pas de PII.                      |
| **Localisation physique** | États-Unis (pas d'option EU à date 2026-05)                                                                                             |
| **Garanties**             | DPA standard + SCC + EU-US Data Privacy Framework (Perplexity inscrit DPF list 2024)                                                    |
| **DPA**                   | Online — `https://www.perplexity.ai/hub/legal/dpa`                                                                                      |
| **Procédure**             | Account Perplexity API → Compliance → Sign DPA + accept SCC.                                                                            |
| **Durée conservation**    | API standard : 30 j (logs requêtes).                                                                                                    |
| **Statut**                | 🟡 **À SIGNER** par Will avant activation `PERPLEXITY_API_KEY` en prod                                                                  |
| **Date signature**        | _(à compléter)_                                                                                                                         |
| **Référence interne**     | _(à compléter — ID compte Perplexity)_                                                                                                  |
| **Note**                  | Si Perplexity n'offre pas EU data residency à l'horizon V2 et que les coûts ne le justifient pas, fallback OpenAI/Anthropic uniquement. |

---

## 7bis. Unsplash Inc. (content-gen — priorité 2 avant cutover RUN)

| Champ                     | Valeur                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | Unsplash Inc.                                                                                                           |
| **Adresse**               | 400 Atlantic Avenue, Suite 200, Montréal, QC H2Y 1H1, Canada                                                            |
| **Finalité**              | Recherche d'images stock libres de droits (attribution photographe) pour illustrations Articles content-gen             |
| **Données traitées**      | Mots-clés de recherche image (FR/EN) — **aucune donnée visiteur**                                                       |
| **Localisation physique** | Canada + USA (CDN global)                                                                                               |
| **Garanties**             | DPA standard + Décision d'adéquation UE-Canada (2001) couvrant le traitement principal                                  |
| **DPA**                   | Online — à signer depuis le dashboard Unsplash for Business / API                                                       |
| **Lien**                  | https://unsplash.com/privacy                                                                                            |
| **Procédure**             | Demander DPA via `https://unsplash.com/data-request` (contact `privacy@unsplash.com`)                                   |
| **Durée conservation**    | Logs API : 90 j                                                                                                         |
| **Statut**                | 🟡 **À SIGNER** par Will avant cutover RUN (avant que `UNSPLASH_ACCESS_KEY` ne soit ajouté en Coolify prod)             |
| **Date signature**        | _(à compléter)_                                                                                                         |
| **Référence interne**     | _(à compléter — ID compte Unsplash)_                                                                                    |
| **Risk note**             | Risque RGPD très faible (aucune PII visiteur transmise). DPA principalement formel pour conformité art. 28 du registre. |

---

## 7ter. Voyage AI, Inc. (content-gen — embeddings KB, activation différée)

| Champ                     | Valeur                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | Voyage AI, Inc.                                                                                                                                                                                     |
| **Adresse**               | Palo Alto, CA, États-Unis                                                                                                                                                                           |
| **Finalité**              | Embeddings vectoriels (`voyage-3-lite`, 1024 dim) pour la base de connaissances éditoriale (recherche hybride dedup factory)                                                                        |
| **Données traitées**      | Texte éditorial **public uniquement** (hard gate code `EmbeddingConfidentialityRefusal` : entrées `confidential`/`secret` refusées)                                                                 |
| **Localisation physique** | États-Unis                                                                                                                                                                                          |
| **Garanties**             | DPA standard + SCC + EU-US Data Privacy Framework                                                                                                                                                   |
| **DPA**                   | Online — Voyage Console > Settings > Compliance                                                                                                                                                     |
| **Lien**                  | https://www.voyageai.com/privacy                                                                                                                                                                    |
| **Procédure**             | Console Voyage AI → Account → Sign DPA. Activer ZDR si proposé en option Enterprise.                                                                                                                |
| **Durée conservation**    | Embeddings : ne sont pas conservés par Voyage (computed-and-returned). Logs API : 30-60 j.                                                                                                          |
| **Statut**                | 🟡 **À SIGNER** par Will avant que `VOYAGE_API_KEY` ne soit ajouté en Coolify env (V1 = stub déterministe SHA-256, aucun appel sortant aujourd'hui — cf. `src/lib/knowledge/embeddings.ts` L21-55). |
| **Date signature**        | _(à compléter)_                                                                                                                                                                                     |
| **Référence interne**     | _(à compléter — ID compte Voyage AI)_                                                                                                                                                               |
| **Risk note**             | Risque RGPD nul tant que la clé n'est pas en Coolify env. **Bloquant cutover Sprint KB-13** (activation embeddings live).                                                                           |

---

## 7quater. Stripe Payments Europe Ltd

| Champ                     | Valeur                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Nom légal**             | Stripe Payments Europe Ltd                                                                                         |
| **Adresse**               | 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irlande (UE)                                                 |
| **Finalité**              | Traitement des paiements (Checkout, webhooks), Stripe Radar anti-fraude, gestion des remboursements                |
| **Données traitées**      | Email, nom, montants facturés/payés, n° de facture, métadonnées booking. **Aucun numéro de carte** (Stripe-hosted) |
| **Localisation physique** | UE (Dublin, Frankfurt) avec réplication USA pour Radar                                                             |
| **Garanties**             | DPA standard + SCC + EU-US Data Privacy Framework (Stripe US inscrit DPF list)                                     |
| **DPA**                   | Online — Stripe Dashboard > Settings > Privacy & Compliance                                                        |
| **Lien**                  | https://stripe.com/legal/dpa                                                                                       |
| **Procédure**             | Dashboard Stripe → Settings → Privacy → Accept Data Processing Agreement                                           |
| **Statut**                | 🟡 **À ACCEPTER** depuis Stripe Dashboard (déclaratif côté Will)                                                   |
| **Date signature**        | _(à compléter)_                                                                                                    |

---

## 7quinquies. OpenStreetMap Foundation (Nominatim)

| Champ                     | Valeur                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | OpenStreetMap Foundation                                                                                 |
| **Adresse**               | St John's Innovation Centre, Cowley Road, Cambridge, CB4 0WS, Royaume-Uni                                |
| **Finalité**              | Géocodage des villes saisies par les visiteurs (calcul buffer trajet Booking) — usage **public anonyme** |
| **Données traitées**      | Nom de ville en clair + code pays. **Aucune IP visiteur transmise** (proxy serveur).                     |
| **Localisation physique** | UE + Royaume-Uni                                                                                         |
| **Garanties**             | Royaume-Uni : décision d'adéquation UE-UK active. Politique de confidentialité OSM Foundation publique.  |
| **DPA**                   | NA — usage de l'API publique gratuite, pas de contrat commercial                                         |
| **Lien**                  | https://wiki.osmfoundation.org/wiki/Privacy_Policy                                                       |
| **Procédure mitigation**  | Cache local 30 j côté Axion-IA pour réduire les appels. Respect quota OSM (1 req/s).                     |
| **Statut**                | ✅ **CONFORME** (usage public anonyme + décision adéquation)                                             |

---

## 7sexies. DocuSeal Community (self-hosted)

| Champ                     | Valeur                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Nom légal**             | Auto-hébergement (open-source DocuSeal Community Edition)                                                |
| **Adresse**               | Hébergement Hetzner Frankfurt (VPS dédié Axion-IA OÜ)                                                    |
| **Finalité**              | Signature électronique des contrats et devis (Sprint X.3+)                                               |
| **Données traitées**      | Nom et email des signataires, contenu signé du contrat, horodatage cryptographique, hash PDF             |
| **Localisation physique** | Allemagne (UE) — auto-hébergé                                                                            |
| **Garanties**             | Pas de tiers extérieur (Axion-IA OÜ seul responsable). Backups chiffrés AES-256 sur Hetzner Storage Box. |
| **DPA**                   | NA — pas de sous-traitant externe                                                                        |
| **Lien**                  | https://www.docuseal.com                                                                                 |
| **Statut**                | ✅ **CONFORME** (self-hosted UE)                                                                         |

---

## 8. Action correctif Backblaze (clarification legal.ts)

`src/content/legal.ts` Sprint 24/A1 mentionne Backblaze comme sous-processeur.
**C'est une erreur** : le code n'utilise que Hetzner Storage Box pour les
backups offsite. Backblaze était mentionné dans des audits anciens.

**Action** : retirer la mention Backblaze de la section "Sous-processeurs"
FR + EN. Voir patch Sprint 24.1.

---

## 9. Procédure d'ajout d'un nouveau sous-processeur

1. **Avant ajout** :
   - Vérifier localisation (UE = automatique, hors UE = base légale requise).
   - Identifier finalité + minimisation PII applicable.
2. **Documentation** :
   - Ajouter ligne dans la table §1 ci-dessus.
   - Ajouter section dédiée (template §2/§3/§4).
   - Mettre à jour `src/content/legal.ts` (FR + EN).
3. **Signature** :
   - DPA online → screenshot daté + référence interne ticket.
   - DPA papier → scan PDF stocké chiffré (Storage Box `/legal/dpa/`).
4. **Communication** :
   - Si ajout post-cutover : notification utilisateurs newsletter + bandeau
     site (RGPD art. 13.3 — modification finalité/destinataires).
5. **Audit** :
   - Mise à jour de ce registre.
   - Activity log `prisma.activityLog` action `dpa.signed` ou `dpa.accepted`.

---

## 10. Procédure de droits RGPD utilisateur

Cf. `src/app/[locale]/mes-donnees/page.tsx` (page exposée) +
`/api/gdpr-export` (Sprint 24/D2) + Server Actions admin
`eraseSubmissionAction` / `eraseSubscriberAction` (Sprint 24/D1).

**Réponses standard** : 4 templates emails RGPD prêts dans
`docs/dpo-templates/` (Sprint 24.1).

---

## 11. Historique

| Date       | Événement                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-09 | Création du registre (Sprint 24.1). 4 lignes à signer/accepter avant cutover.                                                                            |
| 2026-05-09 | ADR 0010 acté (minimisation PII Telegram Option A).                                                                                                      |
| 2026-05-14 | Pass B fix P0-3 : ajout OpenAI / Anthropic / Perplexity (3 sous-processeurs IA content-gen).                                                             |
| 2026-05-15 | Audit B5 fix P0-2/P0-3/P0-5 : ajout Unsplash / Voyage AI / Stripe / OSM / DocuSeal (5 lignes). SSOT publique unifiée sur `src/content/subprocessors.ts`. |
| _(date)_   | DPA Hetzner signé (Will). Référence : **\*\*\*\***\_**\*\*\*\***                                                                                         |
| _(date)_   | DPA Cloudflare accepté (Will).                                                                                                                           |
| _(date)_   | DPA OpenAI signé + ZDR activé (Will). ID compte : **\*\*\*\***\_**\*\*\*\***                                                                             |
| _(date)_   | DPA Anthropic signé (Will). ID compte : **\*\*\*\***\_**\*\*\*\***                                                                                       |
| _(date)_   | DPA Perplexity signé (Will). ID compte : **\*\*\*\***\_**\*\*\*\***                                                                                      |
| _(date)_   | DPA Unsplash signé (Will). ID compte : **\*\*\*\***\_**\*\*\*\***                                                                                        |
| _(date)_   | DPA Voyage AI signé (Will) — avant ajout `VOYAGE_API_KEY` à Coolify env.                                                                                 |
| _(date)_   | DPA Stripe accepté (Will) — Stripe Dashboard.                                                                                                            |
| _(date)_   | Audit AKI annuel (rappel : prévoir Q4 2026).                                                                                                             |
| _(date)_   | Renouvellement annuel DPA (rappel : revue trimestrielle minimum, signature ré-évaluée 1× /an).                                                           |
