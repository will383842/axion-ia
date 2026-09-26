# Registre des activités de traitement — Article 30 RGPD

**Responsable de traitement** : Axion-IA (société française)
**Adresse postale** : _[à compléter]_
**Représentant légal** : le représentant légal d'Axion-IA
**Contact** : `contact@axion-ia.com`
**Date du registre** : 2026-05-22
**Version** : 1.0 — Sprint Final P1-10
**Référence interne** : `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/RGPD-REGISTRE-ART30.md`

---

## 1. Identité du responsable de traitement

| Champ              | Valeur                                                           |
| ------------------ | ---------------------------------------------------------------- |
| Raison sociale     | Axion-IA                                                         |
| Forme juridique    | Société française                                                |
| SIREN              | _[À compléter post-immatriculation]_                             |
| Adresse            | _[à compléter]_                                                  |
| Site web           | https://axion-ia.com                                             |
| Contact général    | `contact@axion-ia.com`                                           |
| Représentant légal | Le représentant légal d'Axion-IA                                 |

## 2. Contact RGPD

- **Contact RGPD** : `contact@axion-ia.com`
- **Délégué à la protection des données** : aucun n'est désigné, la désignation n'étant pas obligatoire au regard de l'activité (même mention que la politique de confidentialité publiée)
- **Procédure d'exercice des droits** : pages `/fr/mes-donnees` (accès) + endpoint admin effacement (cf. P2 P0-2 acquis Sprint Correctif 2026-05-22)

## 3. Finalités du traitement

Axion-IA opère deux finalités principales :

1. **Génération automatisée de contenu IA pour SEO/AEO/GEO** — publication d'articles, guides, pages pSEO villes, cas concrets sur le site Axion-IA. Aucune PII publiée (contenu éditorial non-personnel).
2. **Relation client cabinet conseil IA** — collecte prospects via formulaire contact, gestion réservations (booking), newsletter, suivi des interactions commerciales.

Base légale (art. 6 RGPD) :

- **Consentement explicite** (art. 6.1.a) — lettre d'information adressée à une adresse **personnelle** (case cochée), cookies analytics non-essentiels
- **Exécution contractuelle / mesures précontractuelles** (art. 6.1.b) — bookings, formulaire contact (demande de devis/intervention), envoi du guide IA demandé
- **Intérêt légitime** (art. 6.1.f) — logs techniques (sécurité, fraude), IP hashée pour rate-limit, lettre d'information adressée à une adresse **professionnelle**, suivi de la relation dans le CRM Pro interne

> Lot L6 (2026-09-25) : le guide IA, la lettre et leur flux vers le CRM Pro sont décrits en détail au **§ 8 bis**, qui prime sur les lignes résumées de ce registre pour ces trois traitements.

## 4. Catégories de personnes concernées

- **Prospects** ayant complété le formulaire contact
- **Abonnés** à la lettre d'information Axion-IA
- **Demandeurs du guide IA entreprise** (qu'ils soient abonnés à la lettre ou non)
- **Clients en cours de réservation** (booking V1 — interventions coaching, audit, implémentation, 1-to-1, web&digital IA)
- **Visiteurs anonymes** du site (IP hashée SHA-256, user agent, paths)

Aucun mineur ciblé. Public principalement professionnel ; une adresse personnelle peut demander le guide, la lettre ne lui est adressée qu'avec son consentement.

## 5. Catégories de données personnelles traitées

| Source                            | Données collectées                                                                                    | Sensibilité                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Formulaire contact (`Submission`) | Nom, email, téléphone (optionnel), message, IP **SHA-256 hashée** via `IP_HASH_SALT`                  | Standard — pas de catégorie particulière art. 9                       |
| Lettre d'information (`newsletter_subscribers`) | Adresse e-mail, langue, statut, provenance (page de collecte), dates d'inscription / de confirmation / de désinscription / de rebond définitif, référence et version du texte présenté, jetons aléatoires de confirmation et de désinscription, IP **hachée** (SHA-256 salé — l'IP en clair est supprimée, lot L6), champs d'engagement prévus pour l'outil d'envoi (vides tant qu'aucune lettre ne part) | Standard — détail § 8 bis |
| Guide IA (`guide_requests`)       | Adresse e-mail, empreinte HMAC de l'adresse, provenance, langue, version de la mention, jeton aléatoire du lien personnel, dates de demande / de dernière demande par le formulaire / d'envoi / de premier affichage / de premier clic | Standard — détail § 8 bis |
| Registre de preuve (`consent_events`) | Empreinte HMAC de l'adresse (jamais l'adresse), point de collecte, version du texte, action (`optin` / `information` / `optout` / `fin`), date, IP **hachée**, agent navigateur **haché** (préfixe `h:`, même sel que l'IP ; valeurs anciennes hachées par la purge quotidienne) | Standard — détail § 8 bis |
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
| **Zoho Corporation (ZeptoMail)**             | Relais SMTP **transactionnel** (dont l'e-mail « Votre guide ») | Union européenne (région UE) | Adresse du destinataire et corps complet du message. **Aucune lettre d'information ne part par ZeptoMail** |
| **Telegram FZ-LLC**                          | Alertes internes à l'équipe (Bot API)  | Émirats arabes unis (hors UE) | Pour le guide et la lettre : adresse **masquée** uniquement. Pour les autres alertes : voir `src/content/subprocessors.ts`. Cadre de transfert déclaré : clauses contractuelles types ; aucun DPA signé (`subprocessors.ts`) |
| **Google (Google Agenda)**                   | Agenda interne : rendez-vous réservés par Calendly | Hors UE (Google LLC) | Nom, numéro de téléphone et créneau du rendez-vous, dans la description de l'événement |

### Destinataires internes

- Le dirigeant, pour le compte du responsable de traitement (la société)
- Personnes habilitées : aucune autre actuellement (effectif 1 personne)
- **Axion CRM Pro** — logiciel interne de gestion de la relation client (même responsable de traitement, pas un tiers) : reçoit les événements de la lettre et du guide décrits au § 8 bis

## 7. Transferts hors UE

Transferts hors UE : Anthropic + OpenAI + Perplexity + Voyage AI + Sentry + GitHub + Cloudflare (PoPs US) + Google (dont Google Agenda) + Bing + **Calendly** + **Telegram** (Émirats arabes unis).

⚠️ **Calendly** reçoit des données directement identifiantes (nom, e-mail, téléphone d'un prospect). Son DPA est accepté, avec clauses contractuelles types (cf. `src/content/subprocessors.ts`). **Google Agenda** reçoit les mêmes rendez-vous (nom et téléphone dans la description). **Telegram** ne reçoit, pour le guide et la lettre, qu'une adresse masquée.

**Garanties art. 46 RGPD** :

- **Clauses Contractuelles Types (SCC) Commission UE 2021/914** — à signer avec chaque sous-traitant US (à faire — déjà identifié dans le runbook `R28-dpa-renewal.md`)
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
| Lettre d'information (`newsletter_subscribers`)                                | Confirmé : **3 ans après l'inscription, la dernière demande du guide ou le dernier clic dans une lettre** (seules les actions de la personne) ; désinscrit : adresse **36 mois** après la désinscription, puis **empreinte seule, sans limite** (liste d'opposition) ; rebond définitif : **36 mois après le rebond** ; inscription `pending` jamais confirmée : **30 jours** — détail § 8 bis | Référentiel CNIL « gestion des activités commerciales » (3 ans après le dernier contact émanant de la personne ; respect durable de l'opposition) |
| Demandes du guide IA (`guide_requests`)                                        | **3 ans après la dernière demande par le formulaire ou le dernier clic sur le bouton de téléchargement** — détail § 8 bis | Même référentiel                                                                     |
| Registre de preuve (`consent_events`)                                          | Lettre et guide : **5 ans après la fin de l'inscription**. Autres formulaires : non purgé par ces règles (sous empreinte, sans adresse) | Art. 7.1 (démontrer le consentement ou l'information) ; prescription des actions |
| Liste d'opposition (`email_oppositions`)                                       | **Sans limite de durée** (empreinte seule, jamais l'adresse)                                               | Respect durable de l'opposition                                                      |
| File vers le CRM Pro (`crm_sync_outbox`)                                       | Lignes acquittées (`sent`) : **30 jours**. Lignes non abouties (`pending`, `failed`, `gave_up`) : jusqu'à leur traitement. Toutes supprimées à l'effacement | La charge porte l'adresse en clair : pas au-delà du suivi de la synchronisation |
| `CalendlyEvent` (réservation d'appel)                                          | **36 mois** après le rendez-vous (ou après la capture si aucun horaire)                                     | Demande commerciale — durée alignée sur la notice art. 13 publiée (« Demandes commerciales : 3 ans ») |
| Logs applicatifs (IP SHA-256, user agent, paths)                               | **28 jours rolling** — ⚠️ voir la note ci-dessous                                                          | Sécurité opérationnelle (art. 6.1.f intérêt légitime — détection fraude, rate-limit) |
| `Article` publié + contenus éditoriaux                                         | Indéfini                                                                                                   | Contenu non-PII, archives éditoriales                                                |
| `GenerationProvenance` (AI Act art. 50 — promptHash, modelVersion, timestamps) | **6 ans**                                                                                                  | Obligation AI Act art. 19 + 50 (registre traitements IA) — cf. ADR 0024              |
| Cookies CMP `axion_consent`                                                    | 13 mois                                                                                                    | Recommandation CNIL Lignes directrices cookies                                       |
| Sessions admin (Argon2id)                                                      | 7 jours sliding                                                                                            | Sécurité opérationnelle                                                              |
| Backups DB chiffrés (cf. ADR 0022)                                             | 7 j local / 30 j distant Storage Box                                                                       | Continuité service + DRP                                                             |

> ⚠️ **Note — journaux techniques, incohérence préexistante non tranchée dans ce
> lot.** Ce registre annonce **28 jours** pour les journaux applicatifs ; la
> politique de confidentialité publiée annonce « Logs techniques : **12 mois**
> maximum », et la purge quotidienne des `activity_logs` applique 12 mois
> (`RETENTION_LOGS_MONTHS`). L'une des deux mentions est à aligner sur l'autre.

> ### Conservation des réservations d'appel
>
> Durée retenue : **36 mois**, durée usuelle maximale d'une demande commerciale et
> celle que publie la notice art. 13 (« Demandes commerciales : 3 ans »).
>
> **Application** : purge quotidienne (03:00 UTC) sur `startTime`, avec repli sur
> `capturedAt` pour les réservations sans horaire — sans ce repli, une ligne
> jamais enrichie resterait en base indéfiniment. Surchargeable par
> `RETENTION_CALENDLY_MONTHS`. Verrou :
> `src/server/queue/workers/__tests__/la-retention-des-appels-suit-la-notice.spec.ts`
> rougit si la durée du worker et celle de la notice divergent.
>
> ⚠️ Ne pas confondre avec la décision « prospection : conservation SANS LIMITE »
> du 2026-08-20 (`ProspectionCompany` / `ProspectionPerson` /
> `ProspectionHealthPractitioner`), qui reste **intacte** et protégée par sa
> propre garde.

Procédure de purge automatisée : `src/server/queue/workers/retention-purge-worker.ts`, quotidienne (03:00 UTC).

## 8 bis. Guide IA, lettre d'Axion-IA et flux vers le CRM Pro (lot L6, 2026-09-25)

> **À relire par le dirigeant avant fusion** (dépôt public). Cette section ne contient
> aucune donnée réelle : ni adresse, ni empreinte, ni volume, ni date d'incident. Elle
> décrit le traitement tel que le **code** le fait ; là où le code et la consigne
> diffèrent, l'écart est écrit plutôt que passé sous silence.

### Traitement A — Guide IA entreprise (envoi du guide)

| Rubrique | Contenu |
| --- | --- |
| Finalité | Envoyer par e-mail le guide IA entreprise à qui le demande (page `/guide-ia`, encart de fin d'article, ou envoi déclenché depuis la console) ; savoir si le guide a été ouvert |
| Base légale | Exécution de la demande de la personne (art. 6.1.b) |
| Personnes | Toute personne qui demande le guide, quelle que soit la nature de son adresse |
| Données (`guide_requests`) | Adresse e-mail ; empreinte HMAC de l'adresse (clé de dédoublonnage) ; contenu demandé ; origine (formulaire / console) ; provenance (page de collecte, jamais une donnée personnelle) ; langue ; version de la mention affichée ; jeton **aléatoire** du lien personnel ; dates de demande, de dernière demande par le formulaire, de dernier passage en file, d'envoi, de premier affichage du lien, de premier clic sur le bouton de téléchargement ; nombre d'envois. **Aucune IP, aucun agent navigateur** dans cette table |
| Journal d'envoi (`email_logs`) | Adresse du destinataire, gabarit `guide-ia-envoi`, statut, dates ; rebond éventuel |
| Destinataires | **ZeptoMail** (Zoho, région UE) achemine l'e-mail « Votre guide », transactionnel. Messagerie interne **Telegram** de l'équipe : adresse **masquée** uniquement. Statistiques d'audience Plausible : événement anonyme, sans donnée personnelle |
| Transferts hors UE | **Telegram** (Émirats arabes unis) : adresse masquée seulement ; cadre déclaré dans `src/content/subprocessors.ts`. ZeptoMail : région UE |
| Durée | Demande : **3 ans après la dernière demande par le formulaire ou le dernier clic sur le bouton de téléchargement** — seules les actions de la personne comptent. Une ligne créée par un envoi console vit 3 ans à compter de sa création. Journal d'envoi du guide : **3 ans** (et non les 5 ans des pièces Qualiopi : un envoi du guide ne prouve aucune pièce). Purge quotidienne existante, `src/server/newsletter/retention.ts` |
| Ce qui n'est pas un contact | Un renvoi depuis la console ou le rattrapage (`queued_at`, `sent_at`) : geste de l'équipe, pas de la personne. Le premier affichage du lien (`first_seen_at`) : un antivirus (Safe Links, prévisualisation) le déclenche sans la personne |

### Traitement B — Lettre d'Axion-IA (deux bases légales)

| Rubrique | Contenu |
| --- | --- |
| Finalité | Adresser 1 à 2 e-mails par mois, à chaque nouveauté utile. **Aucune lettre n'est envoyée à ce jour** ; aucun outil d'envoi de masse n'est en service |
| Base légale — adresse **professionnelle** | Intérêt légitime (art. 6.1.f) : tenir informés les professionnels qui s'intéressent aux services d'Axion-IA, après l'information donnée sous le formulaire. Cadre de la prospection électronique : **art. L.34-5 du Code des postes et des communications électroniques** — entre professionnels, la prospection sans consentement préalable est admise pour un objet en rapport avec l'activité de la personne, à condition qu'elle soit informée à la collecte et puisse s'opposer simplement et gratuitement (lien en un clic). La preuve est l'**information** (événement `information`, texte de la mention archivé par sa version) |
| Base légale — adresse **personnelle** (liste fermée de messageries grand public) | Consentement (art. 6.1.a) par une case **facultative et décochée**, retirable à tout moment ; sans la case, la personne reçoit le guide seul et n'est pas inscrite. **Art. L.34-5 CPCE** : consentement préalable exigé. La nature de l'adresse est décidée côté serveur. La preuve est l'événement `optin` (texte de la case archivé par sa version) |
| Données (`newsletter_subscribers`) | Adresse e-mail ; langue ; statut (`pending`, `confirmed`, `unsubscribed`, `bounced`) ; provenance ; dates d'inscription, de confirmation, de désinscription ; référence et version du texte présenté ; jetons **aléatoires** de confirmation et de désinscription ; IP **hachée** (SHA-256 salé). Champs d'engagement prévus pour l'outil d'envoi (dernier envoi, dernier clic, rebonds temporaires) : vides tant qu'aucune lettre ne part |
| IP en clair | **Supprimée.** Le champ a quitté le modèle au lot L2 ; la colonne `ip_address` est supprimée de la base par la migration `20260925120000_newsletter_drop_ip_address` (lot L6). Seule l'empreinte subsiste |
| Registre de preuve (`consent_events`) | Empreinte HMAC de l'adresse (**jamais l'adresse**), point de collecte, version du texte, action (`optin`, `information`, `optout`, et `fin` — fin de l'inscription constatée par la purge, point de départ des 5 ans), date du geste, IP **hachée**, agent navigateur **haché** (préfixe `h:`, même mécanisme et même sel que l'IP, pour tous les points de collecte ; les valeurs anciennes en clair sont hachées par la purge quotidienne, sans suppression de ligne) |
| Liste d'opposition (`email_oppositions`) | Empreinte HMAC de l'adresse, gabarit d'origine, provenance, dates. Jamais l'adresse. Alimentée aussi par la purge des désinscrits : après 3 ans, l'adresse est supprimée et seule son empreinte est gardée ici |
| Désinscription | Lien en un clic dans l'e-mail « Votre guide » (quand la personne est abonnée) et dans chaque lettre ; propagée au CRM Pro (traitement C) et, le jour où il sera en service, à l'outil d'envoi |
| Destinataires | Messagerie interne **Telegram** de l'équipe : adresse **masquée** à l'inscription. Aujourd'hui : aucun prestataire d'envoi de lettre. **MailWizz + PowerMTA** : prévus, **non en service**, rien n'est construit pour envoyer ; contrat et prérequis dans l'ADR 0052 (`docs/adr/0052-lettre-mailwizz-powermta-contrat-sans-envoi.md`). Avant le premier envoi : DPA de l'hébergeur, inscription dans `subprocessors.ts` et dans ce registre |
| Transferts hors UE | **Telegram** (Émirats arabes unis) : adresse masquée seulement. Aucun autre à ce jour (aucun outil d'envoi en service) |
| Durées | Abonné confirmé : **3 ans après l'inscription, la confirmation ou la réinscription, le dernier clic dans une lettre, ou la dernière demande du guide par le formulaire / le dernier clic sur son bouton depuis la même adresse** (recherche par empreinte). Seules les actions de la personne comptent : une lettre **envoyée** sans réponse, un renvoi du guide depuis la console, ou une ligne de demande créée par la console ne prolongent rien. Inscription `pending` jamais confirmée (ancien parcours) : **30 jours** après la création ou la dernière relance. Désinscrit : adresse **36 mois** après la désinscription, puis **empreinte seule, sans limite de durée** (liste d'opposition). Journal de la confirmation (`newsletter-confirm-optin`) : 3 ans. Preuve (`consent_events`, références de la lettre et du guide) : **5 ans après la fin de l'inscription**. Liste d'opposition : **sans limite de durée** |
| Abonnés en rebond (`bounced`) | Adresse en échec de distribution définitif : **36 mois après le rebond** (`bounced_at`), pour ne plus y écrire ; puis supprimée, la fin de l'inscription est consignée au registre de preuve |

### Traitement C — Flux vers le CRM Pro (lettre + guide)

| Rubrique | Contenu |
| --- | --- |
| Finalité | Suivre la relation avec les personnes qui demandent le guide ou s'abonnent à la lettre (décision du responsable de traitement : ce flux, et lui seul, fait de ces personnes des contacts du CRM) ; propager les désinscriptions et les effacements |
| Base légale | Intérêt légitime (art. 6.1.f) à suivre les échanges avec les personnes qui ont demandé le guide ; opposition possible à tout moment. Aucune prospection commerciale n'est adressée à une adresse personnelle sans consentement |
| Événements transmis | `newsletter_optin` (émis à la **confirmation** par bouton, `src/server/newsletter/confirmer.ts`) et `newsletter_optout` (file `crm_sync_outbox`, derrière son drapeau). Lot L4-S, derrière `CRM_SYNC_GUIDE_ENABLED`, **fermé par défaut** : `lead_magnet_requested` (au **clic** sur le bouton du guide, jamais à la simple demande), l'inscription à la lettre reportée au même clic ou à la confirmation, et `email_hard_bounced`. Effacement : propagé par empreinte (`propagateGdprToCrm`) |
| Données transmises | Adresse e-mail et son empreinte HMAC ; selon l'événement : version et date du texte présenté, référence du point de collecte, provenance, date du geste |
| Destinataire | Axion CRM Pro, logiciel **interne** (même responsable de traitement). Pas de sous-traitant supplémentaire |
| Transferts hors UE | Aucun sous-traitant ajouté par ce flux |
| Durée côté site | File `crm_sync_outbox` (charge utile avec l'adresse en clair) : lignes acquittées (`sent`) supprimées **30 jours** après l'envoi ; lignes non abouties (`pending`, `failed`, `gave_up`) gardées jusqu'à leur traitement ; **toutes** les lignes de la personne supprimées à l'effacement (recherche par l'empreinte portée dans la charge) |
| Durée côté CRM | Régie par le CRM Pro (plan : personnes non rattachées et inactives purgées à 3 ans, lot L4-C) |

### Droits (A, B, C)

- **Effacement** : `/api/gdpr-erase` et l'effacement console suppriment l'abonné et **toutes** ses demandes du guide (par l'adresse et par l'empreinte), pseudonymisent le journal d'envoi, suppriment la corbeille d'envoi et **les lignes de la file vers le CRM** (tous statuts), et propagent au CRM. Survivent **uniquement sous empreinte** : le registre de preuve (5 ans au plus pour la lettre et le guide) et la liste d'opposition. Le courriel de confirmation énumère les demandes du guide supprimées et dit ce qui est conservé sans l'adresse. Test : `src/lib/__tests__/effacement-d-un-demandeur-du-guide.spec.ts`.
- **Accès / portabilité** : `/api/gdpr-export` rend l'inscription (y compris la référence du texte présenté et les champs d'engagement), les demandes du guide (origine, version, dates), les événements du registre de preuve avec leurs empreintes d'IP et d'agent navigateur, l'empreinte en liste d'opposition et les événements de la file vers le CRM (type, statut, dates). Sont **déclarés** hors export, avec leur raison : les jetons d'accès (confirmation, désinscription, lien du guide) et la charge de la file CRM (copie des données déjà rendues). Une lecture en échec est signalée dans l'export au lieu d'être rendue vide.
- **Opposition** : lien en un clic, sans connexion.

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
| Accès                            | 15      | Endpoint `/fr/mes-donnees` (export JSON personnalisé) + e-mail `contact@axion-ia.com`                                                       |
| Rectification                    | 16      | E-mail `contact@axion-ia.com` + modification manuelle admin                                                                                 |
| Effacement (« droit à l'oubli ») | 17      | Endpoint effacement RGPD + e-mail `contact@axion-ia.com` ; cascade automatique Submission/Booking/Subscriber                                |
| Limitation                       | 18      | E-mail `contact@axion-ia.com` — flag `isLimited` sur entités concernées (à implémenter si demande)                                          |
| Portabilité                      | 20      | Endpoint `/fr/mes-donnees` (export JSON portable)                                                                                           |
| Opposition                       | 21      | Lien de désinscription en un clic (jeton aléatoire) dans l'e-mail du guide et dans chaque lettre + e-mail `contact@axion-ia.com`                                                                      |
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

**Personne responsable du déclenchement** : le représentant légal d'Axion-IA, pour le responsable de traitement (la société).

---

## TODOs à finaliser avant audit CNIL

1. **[P0]** Compléter l'adresse postale (siège social — section §1 + mentions légales du site)
2. **[P0]** Compléter le SIREN
3. **[P1]** Signer les DPA avec Anthropic, OpenAI, Sentry (SCC Commission UE 2021/914) — runbook `R28-dpa-renewal.md`
4. **[P1]** Vérifier la certification DPF US des sous-traitants (Cloudflare/GitHub OK ; Anthropic/OpenAI/Sentry à vérifier)
5. **[P2]** Initialiser `docs/rgpd/breach-register.md` (template registre violations)
6. **[P2]** Planifier le test de restauration mensuel (runbook `R23-backup-restore-test.md`)
7. **[P2]** Aligner la durée des journaux techniques (28 jours ici, 12 mois dans la politique publiée — note du § 8)

---

**Daté** : 2026-05-22
**Signature** : le représentant légal d'Axion-IA, pour le responsable de traitement (la société)

_Document destiné à être présenté en cas d'audit CNIL. À mettre à jour à chaque changement matériel de traitement (nouveau sous-traitant, nouvelle finalité, modification durée conservation, etc.). Revue annuelle obligatoire._
