# Registre des activités de traitement — Article 30 RGPD

**Responsable de traitement** : Axion-IA (société française — D7 canonique 2026-05-21)
**Adresse postale** : _[À compléter par Will — adresse siège social définitive ; reco WeWork Paris ou domiciliation cabinet ~300 €/mois HT — cf. décision business audit 2026-05-18 §A15]_
**Représentant légal** : William Jullin (Will)
**Contact** : `williamsjullin@gmail.com`
**Date du registre** : 2026-05-22
**Version** : 1.0 — Sprint Final P1-10
**Référence interne** : `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/RGPD-REGISTRE-ART30.md`

---

## 1. Identité du responsable de traitement

| Champ              | Valeur                                                           |
| ------------------ | ---------------------------------------------------------------- |
| Raison sociale     | Axion-IA                                                         |
| Forme juridique    | Société française (D7 canonique 2026-05-21 — abandon OÜ Estonie) |
| SIREN              | _[À compléter post-immatriculation]_                             |
| Adresse            | _[TODO Will — adresse postale FR définitive]_                    |
| Site web           | https://axion-ia.com                                             |
| Contact général    | `williamsjullin@gmail.com`                                       |
| Représentant légal | William Jullin                                                   |

## 2. DPO / contact RGPD

- **Contact RGPD opérationnel** : `williamsjullin@gmail.com`
- **Délégué à la Protection des Données (DPO)** : _[TODO follow-up — à défaut DPO interne (effectif < 250), évaluer DPO externe mutualisé post-launch si volume traitement > 5 000 personnes/an]_
- **Procédure d'exercice des droits** : pages `/fr/mes-donnees` (accès) + endpoint admin effacement (cf. P2 P0-2 acquis Sprint Correctif 2026-05-22)

## 3. Finalités du traitement

Axion-IA opère deux finalités principales :

1. **Génération automatisée de contenu IA pour SEO/AEO/GEO** — publication d'articles, guides, pages pSEO villes, cas concrets sur le site Axion-IA. Aucune PII publiée (contenu éditorial non-personnel).
2. **Relation client cabinet conseil IA** — collecte prospects via formulaire contact, gestion réservations (booking), newsletter, suivi des interactions commerciales.

Base légale (art. 6 RGPD) :

- **Consentement explicite** (art. 6.1.a) — newsletter, cookies analytics non-essentiels
- **Exécution contractuelle / mesures précontractuelles** (art. 6.1.b) — bookings, formulaire contact (demande de devis/intervention)
- **Intérêt légitime** (art. 6.1.f) — logs techniques (sécurité, fraude), IP hashée pour rate-limit

## 4. Catégories de personnes concernées

- **Prospects** ayant complété le formulaire contact
- **Abonnés** à la newsletter Axion-IA
- **Clients en cours de réservation** (booking V1 — interventions coaching, audit, implémentation, 1-to-1, web&digital IA)
- **Visiteurs anonymes** du site (IP hashée SHA-256, user agent, paths)

Aucun mineur ciblé. Public B2B exclusivement (dirigeants, RH, équipes formation, décideurs IT).

## 5. Catégories de données personnelles traitées

| Source                            | Données collectées                                                                                    | Sensibilité                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Formulaire contact (`Submission`) | Nom, email, téléphone (optionnel), message, IP **SHA-256 hashée** via `IP_HASH_SALT`                  | Standard — pas de catégorie particulière art. 9                       |
| Newsletter                        | Email, token unsubscribe (signature HMAC), date opt-in, IP SHA-256 hashée                             | Standard                                                              |
| Booking (`Booking`)               | Nom, email, téléphone, créneau, mode (présentiel/distanciel/hybride), notes libres, IP SHA-256 hashée | Standard — PII at-rest AES-256-GCM via `pii-crypto.ts` (cf. ADR 0025) |
| Réservation d'appel (`CalendlyEvent`) | Nom, email, téléphone, créneau et fuseau, lieu (n° appelé), réponses libres au formulaire Calendly, liens d'annulation/report, UTM et referrer, IP **SHA-256 hashée** (`_ipHash` dans la charge brute) | Standard — pas de catégorie particulière art. 9 |
| Logs serveur / analytics          | IP **SHA-256 hashée**, user agent, paths visités, referrer                                            | Pseudonymisé                                                          |
| Cookies                           | `axion_consent` (consentement), session admin Argon2id, anti-CSRF                                     | Aucune PII directe                                                    |

**Données NON collectées** : santé, opinions, données biométriques, géolocalisation précise (cookie CMP refuse géoloc par défaut).

## 6. Destinataires des données

### Sous-traitants (art. 28 RGPD)

| Sous-traitant                                | Rôle                                  | Localisation         | Données transmises                                                           |
| -------------------------------------------- | ------------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| **Anthropic** (Claude Sonnet 4.6 + Opus 4.7) | Génération contenu + audits           | États-Unis           | Prompts éditoriaux (aucune PII — gate `pii-safe` filtre)                     |
| **OpenAI** (text-embedding-3-large)          | Embeddings RAG knowledge base         | États-Unis           | Vectors content-only (pas de PII source)                                     |
| **Perplexity**                               | Fact-check sources LLM                | États-Unis           | Requêtes factuelles (anonymes)                                               |
| **Voyage AI**                                | RAG sémantique (optionnel)            | États-Unis           | Vectors content-only                                                         |
| **Hetzner Cloud** (CPX42)                    | Hébergement VPS + DB Postgres + Redis | Allemagne (UE)       | TOUTES les données applicatives                                              |
| **Cloudflare** (Free tier)                   | CDN + DDoS + WAF basic                | Mondial (PoPs UE/US) | Trafic HTTPS, logs CF (IP réelles côté CF — TTL 24h, hors stockage Axion-IA) |
| **Sentry**                                   | Observability erreurs                 | États-Unis           | Stack traces, contexte erreur (PII redacted via `pii-redaction.ts`)          |
| **GitHub** (Actions + GHCR)                  | CI/CD + image registry                | États-Unis           | Code source, artifacts build                                                 |
| **Google Search Console + Bing WMT**         | SEO ops (read-only)                   | Mondial              | URLs publiques uniquement, aucune PII                                        |
| **Calendly LLC**                             | Prise de rendez-vous `/appel`         | États-Unis (Atlanta) | Nom, email, téléphone, créneau, réponses au formulaire de réservation        |

### Destinataires internes

- Will Jullin (responsable de traitement)
- Personnes habilitées : aucune autre actuellement (effectif 1 personne — D7 société française)

## 7. Transferts hors UE

Transferts hors UE : Anthropic + OpenAI + Perplexity + Voyage AI + Sentry + GitHub + Cloudflare (PoPs US) + Google + Bing + **Calendly**.

⚠️ **Calendly est le seul de cette liste à recevoir des données DIRECTEMENT identifiantes** (nom, email, téléphone d'un prospect), là où les autres transferts sont pseudonymisés ou sans PII. Son DPA a été **accepté le 2026-08-28** (cf. `_AUDIT/DPA-REGISTER.md` ligne 16 et `src/content/subprocessors.ts`), avec clauses contractuelles types. Ajouté à ce registre le 2026-08-31 : la chaîne Calendly a atterri le 2026-05-26, soit quatre jours après la rédaction de ce document, qui n'avait jamais été rouvert depuis.

**Garanties art. 46 RGPD** :

- **Clauses Contractuelles Types (SCC) Commission UE 2021/914** — à signer avec chaque sous-traitant US (TODO Will P2 — déjà identifié dans runbook `R28-dpa-renewal.md`)
- **Data Processing Agreements (DPA)** :
  - Anthropic : DPA standard disponible ([anthropic.com/legal/dpa](https://www.anthropic.com/legal/dpa)) — **à signer**
  - OpenAI : DPA standard ([openai.com/policies/data-processing-addendum](https://openai.com/policies/data-processing-addendum)) — **à signer**
  - Cloudflare : DPA inclus ToS Enterprise/Free
  - Sentry : DPA disponible — **à signer**
  - GitHub : DPA Microsoft EU Standard Contractual Clauses
- **Conformité Data Privacy Framework (DPF) US** — à privilégier pour les sous-traitants US certifiés (Cloudflare et GitHub sont certifiés DPF ; Anthropic / OpenAI / Sentry vérifier statut)
- **Pseudonymisation systématique avant transfert** — `pii-safe` helper filtre tout token PII des prompts LLM ; embeddings n'incluent jamais de PII source

## 8. Durées de conservation

| Catégorie                                                                      | Durée                                                                                                      | Justification                                                                        |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Submission` (formulaire contact)                                              | 36 mois post-dernière interaction                                                                          | Cadre relation commerciale B2B (CNIL recommandation 36 mois)                         |
| `Booking` (réservation intervention)                                           | 36 mois post-dernière interaction + 10 ans pour pièces comptables associées (factures)                     | Obligation comptable art. L123-22 Code de commerce                                   |
| Newsletter (`Subscriber`)                                                      | Jusqu'à désinscription (unsubscribe token HMAC) + 13 mois après désinscription pour preuve de consentement | RGPD Lignes directrices CEPD consentement                                            |
| `CalendlyEvent` (réservation d'appel)                                          | ⛔ **NON DÉCIDÉE — décision Will requise**                                                                  | Voir l'encadré sous ce tableau                                                       |
| Logs applicatifs (IP SHA-256, user agent, paths)                               | **28 jours rolling**                                                                                       | Sécurité opérationnelle (art. 6.1.f intérêt légitime — détection fraude, rate-limit) |
| `Article` publié + contenus éditoriaux                                         | Indéfini                                                                                                   | Contenu non-PII, archives éditoriales                                                |
| `GenerationProvenance` (AI Act art. 50 — promptHash, modelVersion, timestamps) | **6 ans**                                                                                                  | Obligation AI Act art. 19 + 50 (registre traitements IA) — cf. ADR 0024              |
| Cookies CMP `axion_consent`                                                    | 13 mois                                                                                                    | Recommandation CNIL Lignes directrices cookies                                       |
| Sessions admin (Argon2id)                                                      | 7 jours sliding                                                                                            | Sécurité opérationnelle                                                              |
| Backups DB chiffrés (cf. ADR 0022)                                             | 7 j local / 30 j distant Storage Box                                                                       | Continuité service + DRP                                                             |

> ### ⛔ Décision requise — conservation des réservations d'appel
>
> **Constat, mesuré le 2026-08-31.** `retention-purge-worker.ts` traite 24 modèles ;
> `calendlyEvent` n'en fait pas partie (`grep -ci calendly` → 0). Nom, email,
> téléphone et réponses libres des prospects sont donc conservés **sans limite**,
> la plus ancienne ligne datant du 2026-07-01.
>
> **Ce qui rend la décision urgente** : `src/content/legal.ts:680` **annonce déjà
> publiquement** « Demandes commerciales : 3 ans ». Une durée publiée dans la
> notice art. 13 qu'aucun mécanisme n'applique n'est plus une décision en
> attente, c'est un écart entre ce qu'on dit aux personnes et ce qu'on fait.
>
> **Les deux issues possibles**, l'une ou l'autre à trancher par Will :
>
> 1. **Aligner le code sur la notice** — ajouter `calendlyEvent` au worker de
>    purge avec 36 mois post-dernière interaction, comme `Submission`. C'est
>    l'option cohérente avec ce qui est déjà publié.
> 2. **Aligner la notice sur une autre durée** décidée explicitement — auquel cas
>    modifier `legal.ts` ET ce registre, et documenter la justification ici.
>
> ⚠️ Ne pas confondre avec la décision « prospection : conservation sans limite »
> ni avec « rétention 5 ans : garder sans purger », qui portent sur d'autres
> traitements. Aucune décision datée ne couvre `CalendlyEvent` à ce jour.

Procédure d'effacement automatisée : workers `gdpr-purge-worker.ts` (à implémenter ou vérifié déjà présent dans `src/server/queue/workers/`) — cron daily 03:00 UTC.

⚠️ **Restent absents de ce registre** (relevés le 2026-08-31, non traités dans ce
lot faute d'avoir vérifié le détail des données transmises) : **ZeptoMail**
(relais de tous les envois — donc destinataire de l'adresse e-mail de chaque
personne) et **Google Agenda** (les rendez-vous Calendly y sont écrits, avec nom
et numéro de téléphone dans la description). Ce dernier fait l'objet d'un écart
art. 28 **assumé et daté** par Will jusqu'en janvier 2027 — l'inscrire au
registre est la contrepartie de cet arbitrage, pas sa remise en cause.

## 9. Mesures techniques et organisationnelles de sécurité

### Authentification & accès

- **Argon2id** pour les mots de passe admin (paramètres OWASP 2024 : 19 MiB / 2 iter / 1 thread)
- **2FA TOTP** obligatoire admin (Sprint 16+)
- **Session cookies** `HttpOnly` + `Secure` + `SameSite=Strict` + 7j sliding
- **Anti-CSRF** double-submit cookie + HMAC token

### Chiffrement

- **TLS 1.3** obligatoire (HSTS preload `max-age=63072000; includeSubDomains; preload`)
- **PII at-rest AES-256-GCM** via `src/lib/pii-crypto.ts` (cf. ADR 0025) — wraps 6 sites `Submission.create`
- **Backups chiffrés AES-256** (Storage Box Hetzner + cron daily 03:00 UTC)
- **IP visiteurs hashées SHA-256** via salt `IP_HASH_SALT` (jamais stockées en clair)

### Surface d'attaque

- **CSP per-request nonce** (zero `unsafe-inline`, hash-based pour scripts inline restants)
- **HTTPS + HSTS preload** déjà soumis Chrome HSTS preload list
- **Cloudflare WAF basic** + DDoS illimité (CF Free)
- **Rate-limit** per-IP + per-endpoint via Redis tokens bucket
- **Gitleaks** scan pre-commit + GH Actions CI (rotation salts si leak détecté)

### Gouvernance & audit

- **Audit logs** (`AdminAuditLog`) — toute action admin loggée (acteur, action, target, IP, timestamp)
- **Sentry** observability avec PII redacted (helper `pii-redaction.ts`, 14 sites Telegram patchés ADR 0010)
- **AI Act art. 50** — disclosure `AiContentDisclaimer` + JSON-LD `aiGenerated:true` + `GenerationProvenance` 6 ans (cf. ADR 0024)
- **Backups testés** — restore test runbook `R23-backup-restore-test.md` planifié mensuel

## 10. Droits des personnes concernées

| Droit                            | Article | Modalité d'exercice                                                                                                                         |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Accès                            | 15      | Endpoint `/fr/mes-donnees` (export JSON personnalisé) + email DPO `williamsjullin@gmail.com`                                                |
| Rectification                    | 16      | Email DPO + modification manuelle admin                                                                                                     |
| Effacement (« droit à l'oubli ») | 17      | Endpoint admin effacement RGPD (acquis P2 P0-2 Sprint Correctif 2026-05-22) + email DPO ; cascade automatique Submission/Booking/Subscriber |
| Limitation                       | 18      | Email DPO — flag `isLimited` sur entités concernées (à implémenter si demande)                                                              |
| Portabilité                      | 20      | Endpoint `/fr/mes-donnees` (export JSON portable)                                                                                           |
| Opposition                       | 21      | Unsubscribe token HMAC newsletter (lien dans chaque email) + email DPO                                                                      |
| Réclamation CNIL                 | 77      | Coordonnées CNIL fournies dans page `/fr/mentions-legales` + `/fr/politique-confidentialite`                                                |

**Délai de réponse** : 1 mois (extensible à 3 mois si demande complexe — art. 12.3 RGPD).

## 11. Notification des violations de données

**Procédure** :

1. **Détection** — alerting Sentry + logs sécurité (intégration `R17-sentry-capture-failed.md` + runbook `R29-rgpd-subprocessor-audit.md`)
2. **Évaluation** — gravité, nombre de personnes, données exposées (sous 24h)
3. **Notification CNIL** — si risque pour les droits/libertés → **72h max** via formulaire en ligne https://notifications.cnil.fr/notifications/index
4. **Notification personnes concernées** — si risque élevé (PII exposée, données sensibles) — sans délai indu, par email
5. **Documentation** — registre interne des violations (`docs/rgpd/breach-register.md` — à initialiser P2)
6. **Post-mortem** — runbook dédié, ADR si décision structurelle requise

**Personne responsable du déclenchement** : Will Jullin (responsable de traitement). Délégation possible à DPO externe une fois nommé.

---

## TODOs à finaliser avant audit CNIL

1. **[Will P0]** Compléter adresse postale FR définitive (siège social — section §1 + mentions légales site)
2. **[Will P0]** Confirmer immatriculation société française (SIREN) post-D7 canonique
3. **[Will P1]** Décider DPO externe vs DPO interne (note follow-up section §2)
4. **[Will P1]** Signer DPA avec Anthropic, OpenAI, Sentry (SCC Commission UE 2021/914) — runbook `R28-dpa-renewal.md`
5. **[Will P1]** Vérifier certification DPF US des sous-traitants (Cloudflare/GitHub OK ; Anthropic/OpenAI/Sentry à vérifier)
6. **[Will P2]** Initialiser `docs/rgpd/breach-register.md` (template registre violations)
7. **[Will P2]** Planifier test de restore mensuel (runbook `R23-backup-restore-test.md`)
8. **[Will P2]** Implémenter worker `gdpr-purge-worker.ts` si pas encore présent (cron daily — purge submissions/bookings > 36 mois, logs > 28 j)

---

**Daté** : 2026-05-22
**Signature** : Will Jullin (responsable de traitement)
**Signature DPO** : _[À compléter — TODO follow-up section §2]_

_Document destiné à être présenté en cas d'audit CNIL. À mettre à jour à chaque changement matériel de traitement (nouveau sous-traitant, nouvelle finalité, modification durée conservation, etc.). Revue annuelle obligatoire._
