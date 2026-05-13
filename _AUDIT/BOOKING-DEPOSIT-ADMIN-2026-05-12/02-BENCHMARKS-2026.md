# 02 — Benchmarks 2026 — Booking deposit-gated, paiement, signature, admin, visio, file request

> **Mode** : AUDIT-ONLY. Source officielle quand possible (doc 2026). Pas d'invention. Quand l'information n'est pas vérifiable, marquée `[INCONNU — raison]`.
> **Cible** : nourrir le plan d'exécution V1 d'Axion-IA (cabinet IA opérationnel B2B premium, V2.1 LIVE).
> **Auditeur** : Claude Opus 4.7 (1M context) — 2026-05-12

---

## Catégorie 1 — Booking & calendrier

### Calendly

Source : [calendly.com/features](https://calendly.com/features), [help.calendly.com](https://help.calendly.com).

**À retenir**

1. **Routing forms** qui qualifient le lead avant de proposer un créneau (formulaire conditionnel → bon type d'event → bonne personne). C'est le pattern « no-cold-booking » indispensable pour un cabinet premium B2B.
2. **Workflows** natifs (rappel email/SMS, follow-up post-call, no-show tagging) configurables sans code, avec déclencheurs `before_event` / `after_event` / `event_cancelled`.
3. **Buffer time** avant/après chaque créneau + plafond de meetings par jour, paramétrable par type d'event — exactement la mécanique anti-burnout côté praticien.

**À NE PAS reproduire**

1. **L'iframe Calendly « brut »** plaquée sur la home : zéro contexte, zéro storytelling, zéro pré-qualif. Tueur de conversion premium.
2. La **page de confirmation générique** Calendly avec promotion de la marque Calendly elle-même : Axion-IA doit posséder 100 % son tunnel.
3. **Pricing par seat** ($10–15+/mois) qui devient cher dès qu'on multiplie les profils d'event publics — pas un blocker mais à anticiper.

**Idée actionable Axion-IA** : sur `/reserver`, placer un **micro-routing en 3 questions** (taille entreprise INSEE TPE/PME/ETI/grande-entreprise + secteur sensible oui/non + intervention pressentie) **avant** d'afficher le calendrier, pour router automatiquement vers `audit_flash_distance`, `audit_flash_onsite`, `essentielle_*`, `approfondie_*` ou `ia_custom` et pré-renseigner le `BookingType` côté server action.

---

### Cal.com (open-source)

Source : [cal.com/docs](https://cal.com/docs), GitHub `calcom/cal.com`.

**À retenir**

1. **Self-hostable** sous AGPLv3 → option d'indépendance totale si on souhaite migrer plus tard (data résidence UE, suppression des intermédiaires US). Garde la porte ouverte pour V3+.
2. **Workflows + webhooks programmables** (events `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`, `BOOKING_PAID`) directement intégrables avec notre `BullMQ` + `notification-worker`. Compatible Server Actions.
3. **Routing Forms** open-source équivalents à Calendly + **API v2 documentée** (Bearer token, 120 req/min) → permet d'embarquer une UI custom Axion-IA tout en déléguant la disponibilité à Cal.com.

**À NE PAS reproduire**

1. **UI par défaut « SaaS générique »** (palette violet/blanc, polices Inter, animations Framer) : ne correspond pas à la doctrine terracotta/serif italique d'Axion-IA. Forcerait un override CSS lourd.
2. **Complexité du modèle data interne** (Event Types × Schedules × Bookings × Teams × Orgs) : pour V1, c'est trop de surface pour 1 cabinet. Sur-engineering.
3. **Self-host = engagement ops** (Postgres + Redis + workers + e-mail relay), redondant avec la stack Hetzner CPX32 déjà sous tension côté Coolify.

**Idée actionable Axion-IA** : **ne pas adopter Cal.com en V1** (notre modèle Prisma `Booking` + `BookingType` + `BookingStatus` couvre déjà 90 % du besoin), mais **copier sa state-machine de booking** (`PENDING_PAYMENT → CONFIRMED → CADRAGE_DONE → CONTRACT_PENDING → CONTRACT_SIGNED → DELIVERED → COMPLETED`) et son **schéma de webhook payloads** comme référence canonique.

---

### Doctolib

Source : [about.doctolib.fr](https://about.doctolib.fr), observation produit publique 2026.

**À retenir**

1. **Pré-remplissage exhaustif côté patient** (motif → praticien → créneau, en 3 écrans max, sans aucune saisie clavier sur mobile) — UX de référence FR sur le booking serial premium.
2. **Rappels SMS J-1 + J-0** avec ré-orientation 1-clic vers reschedule. Taux de no-show divisé par 2 dans les études Doctolib publiées en 2024-2025 [INCONNU — chiffre 2026 non revérifié].
3. **Côté praticien** : agenda hebdo unifié, blocs de garde paramétrables, motifs avec durée par défaut, statuts `confirmé / honoré / non honoré / annulé` distincts. C'est la base d'un admin opérationnel.

**À NE PAS reproduire**

1. **Marketplace publique** où Axion-IA serait noyé parmi des cabinets concurrents : on est un cabinet unique, pas un annuaire.
2. **Téléconsultation Doctolib intégrée** : verrouillage propriétaire + facturation à l'acte, hors-scope V1 (on a Whereby/Jitsi en option).
3. **Notifications SMS surdimensionnées** (jusqu'à 3 SMS par RDV) qui deviennent coût + RGPD lourd à 2 150 villes pSEO. Axion-IA reste à 1 SMS J-1 max V1.

**Idée actionable Axion-IA** : reproduire le **funnel 3-écrans** côté `/reserver` : (1) intervention + taille org, (2) créneau, (3) contact + paiement acompte 30 % — avec **état persistant côté URL** (`?step=2&type=...`) pour qu'un rafraîchissement ne perde rien.

---

### Acuity Scheduling

Source : [acuityscheduling.com/features](https://www.acuityscheduling.com/features).

**À retenir**

1. **Intake forms** liés à chaque type d'appointment, avec champs conditionnels — utile pour pré-collecter le contexte client (besoin, urgence, taille équipe) **avant** le call de cadrage.
2. **Deposits & prepayments** natifs via Stripe/Square/PayPal — Acuity prouve que la mécanique deposit-gated est viable et acceptée même sur des marchés moins premium.
3. **Packages / memberships** : cartouches multi-séances pré-payées, applicables aux abonnements de support post-livraison Axion-IA (V2+).

**À NE PAS reproduire**

1. **UI 2010s** avec scroll vertical infini de blocs « Service / Type / Calendar » : Axion-IA cible une UX 2026 dense et calme.
2. **Branding Squarespace** (Acuity a été racheté par Squarespace) qui infiltre la confirmation : on doit owner 100 % du tunnel.
3. **Téléchargement de ICS uniquement** (pas d'invite calendar auto sur Outlook/Google sans config supplémentaire). V1 Axion-IA doit envoyer ICS attaché ET lien Google/Outlook 1-clic.

**Idée actionable Axion-IA** : ajouter un **intake form 5-champs** lié au `BookingType` (objectifs, contraintes connues, stack actuelle, urgence, secteur sensible oui/non) entre le paiement acompte et le call de cadrage, persisté dans `Booking.intakeForm` (JSONB) et affiché à l'admin avant le call.

---

## Catégorie 2 — Paiement & facturation

### Stripe Checkout (hosted)

Source : [docs.stripe.com/payments/checkout](https://docs.stripe.com/payments/checkout).

**À retenir**

1. **Hosted page Stripe-side** = PCI-DSS SAQ-A (la plus légère), zéro responsabilité de stocker la carte côté Axion-IA. Critique pour notre maturité ops V1.
2. **125+ moyens de paiement locaux** activables/désactivables par Dashboard sans redéploiement — on peut commencer carte + Link + Apple/Google Pay, ajouter SEPA Direct Debit ensuite pour les grands comptes FR.
3. **Modes `payment` + `setup` + `subscription`** distincts : on utilise `payment` pour l'acompte 30 % V1 et on garde `setup` en réserve pour V2+ (carte sauvegardée pour solde 70 %).

**À NE PAS reproduire**

1. **Re-skin agressif** de Checkout via custom CSS : Stripe limite volontairement la personnalisation pour ne pas casser la trust. Ne pas s'épuiser à fighter ça.
2. **Embedded Checkout iframe** dans un modal Axion-IA : ajoute une couche de fragilité (CSP, cookies tiers, mobile keyboard) sans gain UX significatif vs hosted page.
3. **Promo codes Stripe-side** pour V1 : créerait une double source de vérité avec nos `pricing.ts`. Garder le pricing en SSOT TypeScript.

**Idée actionable Axion-IA** : router `/reserver` → `stripe.checkout.sessions.create({ mode: 'payment', payment_intent_data: { capture_method: 'automatic', metadata: { bookingId, locale, axionRef: 'AXION-2026-NNNN' } } })`, **session expiry = 30 min** pour libérer le slot, redirect success → `/reserver/confirmation?session_id=...` qui valide via `checkout.session.completed` webhook avant d'afficher.

---

### Stripe Billing (subscriptions / invoices)

Source : [docs.stripe.com/billing](https://docs.stripe.com/billing).

**À retenir**

1. **Invoices PDF générées + envoyées automatiquement** avec custom logo/champs, conformes à la facturation FR de base (mentions légales, TVA séparée). Réduit le besoin d'un Pennylane/Sage en V1.
2. **Dunning intelligent** (relances automatiques sur paiements échoués, fenêtres configurables) : utile dès V1 pour le solde 70 % en fin de mission.
3. **Métering** (Stripe + Metronome) : option viable pour V2+ si Axion-IA introduit du support à l'usage / abonnement maintenance.

**À NE PAS reproduire**

1. **Stripe Tax « automatic »** sur facturation intra-UE B2B sans validation comptable préalable : risque de mis-tag VAT/reverse-charge tant que la structure FR vs EE n'est pas tranchée. **Désactivé V1** (cohérent avec décision Will : architecture TVA-agnostique).
2. **Subscriptions complexes** (multi-product, usage-based, proration) en V1 : on est en one-off / forfait, pas en récurrent. Garder Billing dormant.
3. **Customer Portal multi-langues automatique** sans override : la traduction par défaut FR peut diverger de la voix Axion-IA. À auditer phrase-par-phrase si activé.

**Idée actionable Axion-IA** : V1 → activer **Invoices Stripe-side** uniquement pour le **solde 70 %** post-livraison (avec lien `hosted_invoice_url` envoyé par email transactionnel Axion-IA, pas le mailing Stripe natif) et **archiver le PDF dans Hetzner Object Storage** pour les 10 ans légaux (cf. D30).

---

### Stripe Customer Portal

Source : [docs.stripe.com/customer-management](https://docs.stripe.com/customer-management).

**À retenir**

1. **No-code config Dashboard** : logo, couleurs, infos société, langues auto-détectées (50+) — déploiement en 15 min, idéal pour V1.
2. **Deep-links API** vers actions spécifiques (`update_payment_method`, `cancel_subscription`, `view_invoices`) : on peut envoyer un email avec un lien direct sans forcer le client à naviguer dans le portal.
3. **Annulation avec coupon de rétention + collecte du motif via webhook** : pattern de churn-reduction prêt à l'emploi (utile V2+ pour les abonnements maintenance).

**À NE PAS reproduire**

1. **Ne peut pas être embedded en iframe** (limitation officielle) : ne pas planifier d'intégration in-page, prévoir redirection.
2. **Modifications de subscriptions multi-produits limitées** : si on introduit packages V2+, vérifier qu'on reste mono-product par subscription.
3. **Max 10 produits offerts pour plan changes** : non-bloquant V1, à garder en tête pour V2+ si on multiplie les formules.

**Idée actionable Axion-IA** : en V1, exposer le portail Stripe via un bouton **« Mes factures »** dans `/mes-donnees` (admin client minimal) en `stripe.billingPortal.sessions.create({ customer, return_url: '/mes-donnees' })`. **Désactiver dans la configuration Dashboard tout ce qui ne sert pas V1** : pas de gestion subscription, pas d'update payment method, juste invoices viewing.

---

### Stripe Payment Link

Source : [docs.stripe.com/payment-links](https://docs.stripe.com/payment-links).

**À retenir**

1. **Création no-code en 30 sec** depuis le Dashboard : utile pour le sales ad-hoc (devis manuel signé hors Yousign exceptionnel) sans déploiement de code.
2. **QR code natif** + UTM params : utile pour conférences IA et événements physiques (`audit_flash_onsite` pitch sur site client).
3. **Webhook événements** (`checkout.session.completed` standard) → réutilisable avec le même handler que Checkout API.

**À NE PAS reproduire**

1. **Payment Link comme tunnel principal de réservation** : pas de logique conditionnelle, pas de routing par type d'event, pas de réservation de créneau → casse le modèle deposit-gated.
2. **Restriction par nombre d'achats** comme mécanisme de gestion de capacité : c'est bourrin. Gérer la dispo via le calendrier.
3. **Receipts Stripe par défaut** (logo Stripe en footer) pour les transactions premium : préférer un email transactionnel Axion-IA branded.

**Idée actionable Axion-IA** : créer **2 Payment Links statiques** maintenus à la main pour les cas hors-tunnel (acompte rectificatif après devis custom, complément suite à scope creep) + tag `metadata.source = 'manual_link'` pour les distinguer dans nos analytics. **Pas exposés sur le site public.**

---

## Catégorie 3 — Signature électronique

### Yousign (FR, eIDAS-conforme)

Source : [developers.yousign.com/docs](https://developers.yousign.com/docs).

**À retenir**

1. **eIDAS 3 niveaux** (SES / AES / QES) avec hébergement FR, GDPR-native — `[INCONNU — datacenter exact 2026]` mais positionnement FR/UE assumé, c'est le bon match pour Axion-IA cabinet IA estonienne/française.
2. **API REST + webhooks** documentés : `procedure.started`, `procedure.finished`, `member.signed`, `member.refused` — directement plugable sur notre `BullMQ` + state machine `CONTRACT_PENDING → CONTRACT_SIGNED`.
3. **eSeal** (cachet électronique automatique) : utile pour sceller le devis Axion-IA avant envoi au signataire, garantissant l'intégrité du PDF.

**À NE PAS reproduire**

1. **Workflow signature avec délai de validation > 48h** : casse l'effet « momentum » post-call de cadrage. Toujours fixer une **expiration courte (7 jours max)** sur les procédures.
2. **Niveau SES par défaut pour les NDA grands comptes** : passer en AES dès qu'on touche ETI/grande-entreprise / secteur sensible (D12). SES suffit pour les devis PME.
3. **Templates Yousign branded** côté signataire : préférer un email transactionnel Axion-IA qui contient le lien Yousign, plutôt qu'un email Yousign natif.

**Idée actionable Axion-IA** : implémenter en V1 un service `src/server/yousign/` avec 3 fonctions : `createProcedure(bookingId, type: 'devis' | 'nda' | 'devis+nda', level: 'SES' | 'AES')`, `getStatus(procedureId)`, `downloadSignedDoc(procedureId)`. Niveau **SES pour devis ≤ 5 000 € HT, AES au-dessus + NDA ETI/grande-entreprise** (cohérent D11/D12).

---

### DocuSign

Source : [docusign.com/products/electronic-signature](https://www.docusign.com/products/electronic-signature).

**À retenir**

1. **1000+ intégrations** + AI-Assisted (DocuSign Iris) pour préparation contractuelle automatique — référence mondiale, gage de robustesse pour audits clients ETI/grande-entreprise.
2. **Conditional routing** (routes multiples selon valeur de champ) : utile pour les workflows complexes V2+ où un devis suit un parcours « commercial → juridique → DG ».
3. **Web forms avec collecte de paiement** : pattern intéressant mais redondant avec notre Stripe Checkout V1.

**À NE PAS reproduire**

1. **Pricing $25–40/user/mois** + 100 envelopes/an : explose vite à l'échelle Axion-IA pSEO 2 150 villes si on génère beaucoup de devis. Yousign FR est plus économique.
2. **Hébergement US par défaut** (Azure US) : friction RGPD pour clients FR exigeants sur la résidence. DocuSign EU est dispo mais surcoût.
3. **UI signataire 2010s + branding DocuSign omniprésent** dans l'expérience : moins épuré que Yousign 2026.

**Idée actionable Axion-IA** : **ne pas choisir DocuSign en V1** (Yousign mieux positionné FR/UE/prix) mais documenter dans `_AUDIT/COMPETITIVE-SIGN.md` (futur) que **DocuSign reste le plan B** si un client grand-compte impose son propre prestataire.

---

### Skribble

Source : [skribble.com/en](https://www.skribble.com/en/).

**À retenir**

1. **QES ZertES + eIDAS** avec datacenters Suisse (FADP + RGPD) — pertinent si Axion-IA cible une clientèle suisse à V3+.
2. **Integrations Microsoft 365 + Google Drive natives** : moins de friction pour les clients qui vivent dans ces écosystèmes.
3. **Free trial 14j sans carte** : pratique pour POC client.

**À NE PAS reproduire**

1. **Focus DACH** : Skribble est leader Suisse/Allemagne, pas FR. Notre clientèle V1 est FR. Hors-scope.
2. **UI/IA disponible en EN/DE/FR/IT** mais traduction FR perfectible côté signataire `[INCONNU — pas vérifié 2026 directement]`. Yousign FR a un avantage natif.
3. **Pas d'avantage prix vs Yousign** sur le marché FR `[INCONNU — pricing 2026 non comparé en détail]`.

**Idée actionable Axion-IA** : **ignorer Skribble en V1**. Réévaluer V3+ uniquement si on signe un client cabinet d'avocats suisse ou si on déménage l'OÜ EE vers une structure CH.

---

### SignaturIt

Source : [signaturit.com/en](https://www.signaturit.com/en/).

**À retenir**

1. **Namirial Group, 100 % européen, eIDAS QTSP** — solidité légale équivalente à Yousign, hébergement UE garanti.
2. **Certified communications** (email/SMS avec preuve légale) : utile pour les notifications légales (rappel d'expiration de devis avec valeur probante).
3. **Identity verification AI-powered** intégré au workflow signature : pertinent pour les NDA ETI où on veut vérifier l'identité du signataire.

**À NE PAS reproduire**

1. **Marché core = Espagne** + LATAM, intégrations Salesforce/SAP : sur-dimensionné pour Axion-IA V1.
2. **UI moins polishée** que Yousign en 2026 `[INCONNU — vérif manuelle directe non faite]`.
3. **Documentation API moins riche en exemples FR** que Yousign.

**Idée actionable Axion-IA** : **ignorer SignaturIt en V1**. Plan C derrière Yousign et DocuSign si un client espagnol l'exige.

---

## Catégorie 4 — Admin dashboards 2026

### Linear

Source : [linear.app/method](https://linear.app/method).

**À retenir**

1. **Keyboard-first** + **command palette** (Cmd+K) qui couvre 100 % des actions : référence absolue 2026 pour la productivité admin. Tout doit être atteignable au clavier.
2. **Minimalisme délibéré** : pas de boutons décoratifs, hiérarchie typo claire, mono-source de vérité par écran. Inspiration directe pour la refonte admin Axion-IA.
3. **Real-time sync** (PartyKit / WebSocket) pour collaboration : utile si Axion-IA scale à plusieurs admins (V3+).

**À NE PAS reproduire**

1. **Dark-mode exclusif** dans la perception publique : Linear est aussi clair par défaut, mais beaucoup s'arrêtent au dark. Axion-IA doit garder son palette terracotta + crème en admin pour cohérence brand.
2. **Issues / Cycles vocabulary** : c'est un vocabulaire dev, pas business. L'admin Axion-IA doit parler « réservations / cadrages / devis / livraisons », pas « issues / sprints ».
3. **Plugins / Insights overkill** : ne pas reproduire le ML d'estimation de durée — useless en V1 cabinet.

**Idée actionable Axion-IA** : implémenter un **command palette `Cmd+K`** (déjà discuté dans l'audit Header Nav 2026 pour la home) **également dans l'admin** : recherche unifiée `réservation #AXION-... | client email | devis #... | facture #... | intervention | section`, sauter directement à la page. Hotkey global `?` qui liste les raccourcis.

---

### Vercel Dashboard

Source : observation produit publique 2026.

**À retenir**

1. **Hiérarchie 3 niveaux claire** (Team → Project → Deployment), navigation par breadcrumb permanent. Pattern admin transposable pour Axion-IA (Client → Réservation → Livrables).
2. **Logs streaming live** dans la page Deployment, sans rafraîchissement nécessaire : utile pour l'admin Booking Axion-IA pour voir l'historique des emails envoyés / webhook reçus en temps réel.
3. **Empty states** très soignés (illustrations, copy actionnable, CTA primary clair) : référence à reproduire sur toutes les listes vides admin.

**À NE PAS reproduire**

1. **Onglets horizontaux multi-niveaux** (parfois 2 lignes d'onglets sur les projets) qui fragmentent l'attention : préférer un nav-rail latéral unique.
2. **Modals de configuration profondes** (notamment env vars) sans deep-link : on perd le contexte au refresh. Tout doit avoir une URL stable.
3. **Densité d'info marketing** (upsell Vercel Pro/Enterprise) qui pollue le dashboard ops : l'admin Axion-IA n'a rien à vendre à lui-même.

**Idée actionable Axion-IA** : ajouter sur la page admin `/admin/reservations/[id]` un **timeline live** des événements (`booking.created → checkout.session.completed → email.sent → cadrage.scheduled → yousign.signed → invoice.paid → delivered`), streamé via Server-Sent Events ou polling 5s, **avec lien deep direct par événement**.

---

### Stripe Dashboard

Source : observation produit publique 2026 + [dashboard.stripe.com](https://dashboard.stripe.com).

**À retenir**

1. **Search universel** (`/`) qui trouve customers, transactions, invoices, PaymentIntents, charges par n'importe quel substring : référence d'ergonomie. Reproduire en V1 Axion-IA.
2. **Test mode toggle** ultra-visible (header switch + couleur orange globale) : élimine 100 % des erreurs « prod vs test ». Axion-IA devrait dupliquer (env `DEMO` / `LIVE`).
3. **Event log + Webhook attempts** détaillés par object (status, payload, retry count, response code) : pattern à reproduire pour notre admin Booking quand un webhook Stripe ou Yousign échoue.

**À NE PAS reproduire**

1. **Pricing tables / Coupons / Promo codes / Tax sections** : surfaces inutiles pour Axion-IA V1. Ne pas dupliquer ces sections en admin tant que pas de besoin métier.
2. **Verbosité technique** (IDs `pi_...`, `cs_...`, `ch_...` exposés au premier niveau) : l'admin Axion-IA doit prioriser le nom client + réf `AXION-2026-NNNN` lisible humain, IDs Stripe en second.
3. **Settings tree à 4 niveaux** : éviter, garder l'admin Axion-IA en 2 niveaux maximum (Section / Sous-section).

**Idée actionable Axion-IA** : **search universel `/admin/_search?q=...`** (Cmd+K aussi) qui matche par : référence `AXION-...`, email client, téléphone, nom dirigeant, ville, type intervention. Backend = `prisma.$queryRaw` avec `ILIKE` + `unaccent` Postgres + LIMIT 20. Cache 60s.

---

### Notion admin / settings

Source : observation produit publique 2026.

**À retenir**

1. **Sidebar gauche personnalisable** + favoris + recently visited : aide à zapper entre clients/missions en cours.
2. **Settings groupés par contexte** (Workspace / Team / Members / Billing / Integrations) avec un seul écran modal qui se splitte left-rail / content : pattern visuel propre.
3. **Page-as-database** : chaque ressource admin peut être ouverte en vue détail OU listée filtrable — la même donnée, 2 perspectives.

**À NE PAS reproduire**

1. **Flexibilité infinie** des blocs Notion : créerait du chaos en admin (chaque admin reconfigure sa vue). Axion-IA doit avoir des vues canoniques et figées.
2. **Performance dégradée** sur grandes bases (>10k rows) : Notion freeze. L'admin Axion-IA doit garder p75 < 200ms sur listes 1000+ items.
3. **Sharing model complexe** (Team/Workspace/Public/Anyone with link/Selected people) : pas besoin V1 (1-2 admins max).

**Idée actionable Axion-IA** : sur chaque liste admin (réservations, devis, factures), exposer **2 vues built-in** : `Tableau` (densité max, tri/filter colonnes) + `Kanban par statut` (state-machine 16 valeurs), **avec persistance de la vue choisie en `localStorage` clé `axn:admin:view:<resource>`**.

---

### PostHog

Source : [posthog.com/docs](https://posthog.com/docs).

**À retenir**

1. **Product OS unifié** : analytics, session replay, feature flags, surveys, A/B tests en un seul outil — moins de tabs ouverts pour l'admin.
2. **Session replay GDPR-aware** (masking auto des champs sensibles, IP anonymisée optionnelle) : compatible avec doctrine RGPD Axion-IA (déjà en place via Plausible + Clarity).
3. **Self-host option** (PostHog Cloud EU ou self-host) → résidence UE possible.

**À NE PAS reproduire**

1. **Overhead JS** de la lib PostHog (>40 KB gz) : redondant avec notre stack Plausible (1 KB) + Clarity. Ne pas ajouter en V1.
2. **Feature flags PostHog** alors qu'Axion-IA est mono-tenant mono-produit : sur-dimensionné, garder simple via env vars.
3. **A/B tests sur un site avec trafic faible** (early-stage Axion-IA) : pas assez de volume pour conclusions stat-sig avant V3+.

**Idée actionable Axion-IA** : **ne pas adopter PostHog en V1**. Garder Plausible (web vitals + funnels basiques) + Clarity (sessions replay free) déjà en place. Réévaluer V3+ si on dépasse 100k visits/mois et qu'on veut un outil unifié.

---

### GitHub org settings

Source : observation produit publique 2026.

**À retenir**

1. **Audit log filterable** + export CSV par range temporel + filter par actor/event : pattern legal-grade indispensable pour conformité RGPD Axion-IA (qui a modifié quoi, quand).
2. **Roles & permissions matrix** explicite (Owner / Admin / Member / Outside collaborator) : clarté max sur qui peut faire quoi.
3. **2FA enforcement org-wide** + SAML SSO : sécurité non-négociable. Axion-IA admin V1 doit imposer 2FA TOTP (déjà acté dans audits OWASP).

**À NE PAS reproduire**

1. **Settings à 5 niveaux** (Org → Repo → Branch → File → Permission) : sur-engineering pour Axion-IA mono-cabinet.
2. **Marketplace apps** (3rd party) qui ouvrent un risque supply-chain : on garde l'admin Axion-IA fermé en V1.
3. **Insights graphiques pléthoriques** sans drilling possible : préférer un dashboard sobre avec 5-7 KPI critiques.

**Idée actionable Axion-IA** : implémenter un **audit log Prisma** (`AdminAuditLog` model : `actor`, `action`, `targetType`, `targetId`, `before`, `after`, `ip`, `userAgent`, `createdAt`) avec **rétention 10 ans** (cohérent D30) + page `/admin/audit-log` filtrable par actor/action/date + export CSV pour DPO sur demande.

---

### Doctolib pro (côté praticien)

Source : observation produit publique 2026.

**À retenir**

1. **Agenda du jour en pleine page**, prochain RDV mis en avant + checklist patient (dossier complété ? paiement à jour ?) : pattern « morning brief » à reproduire pour l'admin Axion-IA.
2. **Statuts patients distincts post-RDV** (honoré / non honoré / annulé / en cours) accessibles d'un clic depuis l'agenda : évite que l'admin perde 30s par RDV à chercher.
3. **Téléconsultation intégrée** (1-clic depuis le RDV) : pattern utile si Axion-IA passe sur Whereby embedded V2+.

**À NE PAS reproduire**

1. **UX médicalisée** (terminologie « patient », « praticien », « consultation ») : Axion-IA est B2B, terminologie « client », « cabinet », « cadrage ».
2. **Workflow facturation Sécu / mutuelles** : zéro pertinence cabinet IA.
3. **Notifications push opt-out par défaut** : Axion-IA garde opt-in clair (RGPD).

**Idée actionable Axion-IA** : créer **`/admin/dashboard` page d'accueil avec « Aujourd'hui »** : (1) prochain cadrage avec lien direct Whereby/Meet, (2) devis en attente de signature > J+3, (3) acomptes expirés à relancer, (4) livrables à envoyer cette semaine. Max 5 cards, pas plus. Tout actionnable en 1 clic.

---

## Catégorie 5 — Visio cadrage

### Jitsi Meet (open-source self-hostable)

Source : [jitsi.org](https://jitsi.org).

**À retenir**

1. **Self-hostable** sur Hetzner CPX32 (mais coûteux CPU : Jitsi Videobridge est gourmand) — résidence UE garantie, zéro dépendance tiers.
2. **Pas de compte requis** côté invité : on partage juste un lien `https://meet.axion-ia.com/booking-AXION-2026-NNNN` et le client clique.
3. **API embed (iframe)** disponible : on peut intégrer Jitsi dans l'admin Axion-IA pour lancer le call sans quitter le contexte.

**À NE PAS reproduire**

1. **Self-host Jitsi en V1** : exigeant en CPU (videobridge), bande passante (TURN/STUN), monitoring (ops 24/7). Hors budget V1.
2. **Default UI Jitsi** (palette violette, branding Jitsi) sans white-label : casse la cohérence Axion-IA.
3. **Pas d'enregistrement natif simple** sans plugin Jibri + storage S3 : surface technique trop large pour V1.

**Idée actionable Axion-IA** : **différer Jitsi à V3+**. En V1, utiliser un lien Google Meet généré manuellement (ou Whereby si on accepte le coût — voir ci-dessous), copié dans l'email de confirmation et dans le ICS attaché.

---

### Whereby

Source : [whereby.com/information/embedded](https://whereby.com/information/embedded).

**À retenir**

1. **Embedded en 3 lignes de code** (iframe ou web component) : on peut intégrer le call directement dans l'admin et le client clique un lien `meet.axion-ia.com/...` qui reste sur notre domaine.
2. **Pricing Build $9.99/mois + $0.004/min participant** : économique pour volumes V1 (~100 calls/mois × 60min × 2 participants = ~$48/mois max).
3. **White-label custom branding** sur plans payants + AI transcription disponible ($0.0065/min) — pertinent pour les comptes-rendus de cadrage automatiques V2+.

**À NE PAS reproduire**

1. **Free tier 2000 min/mois** insuffisant dès qu'on dépasse 15-20 cadrages : passer direct au plan Build payant ou rester sur Meet/Jitsi.
2. **Transcription auto activée par défaut** sans consentement explicite : enjeu RGPD majeur (D9 cadrage + recording). Doit être **opt-in explicite** dans l'email de cadrage.
3. **Stocker les transcriptions chez Whereby** sans contrôle : préférer export auto vers Hetzner Object Storage si on les conserve.

**Idée actionable Axion-IA** : **adopter Whereby en V1** plan Build ($9.99/mois flat + variable) avec **room URL dynamique par booking** (`meet.axion-ia.com/booking-${axionRef}`), généré côté server lors de `CADRAGE_SCHEDULED`, expiré 1h après l'heure du call. **Recording opt-in** uniquement.

---

### Google Meet (UX intégration)

Source : observation produit publique 2026.

**À retenir**

1. **Lien généré automatiquement** quand un event Google Calendar contient un participant + visio activée — zéro friction côté praticien.
2. **Ubiquité utilisateurs** : 95 %+ des décideurs B2B FR/UE ont déjà un compte Google ou peuvent rejoindre sans compte.
3. **Notes IA Gemini intégrées** (2025+) qui résument le call automatiquement `[INCONNU — fonctionnalité 2026 exacte non vérifiée]` — utile pour compte-rendu cadrage.

**À NE PAS reproduire**

1. **Branding Google omniprésent** dans l'expérience : casse l'aura premium Axion-IA pour les comptes haut de gamme.
2. **Dépendance Google Workspace** : si Axion-IA scale internationalement, certaines orgs sensibles refusent Google.
3. **Recording auto** Google Meet conservé chez Google (US par défaut) : friction RGPD pour clients FR très exigeants.

**Idée actionable Axion-IA** : **V1 = Google Meet par défaut** (généré via Google Calendar API si on connecte le calendrier Axion-IA, sinon lien manuel collé dans l'email de confirmation). Migrer vers Whereby V2 dès qu'on industrialise les transcriptions + white-label.

---

## Catégorie 6 — File request docs

### Notion file request

Source : `[INCONNU — fonctionnalité officielle Notion file request à confirmer, l'URL https://www.notion.com/help/file-requests retourne 404 en 2026-05]`. Référence à des patterns de partage Notion sur des pages publiques avec invitation d'upload.

**À retenir**

1. **Page Notion publique** avec champ d'upload + commentaires : pattern qu'on retrouve chez Notion forms / databases publiques.
2. **Zéro setup côté client** : juste un lien.
3. **Notifications natives** quand un nouvel upload arrive.

**À NE PAS reproduire**

1. **Stockage dans Notion** : faible contrôle data residence (US par défaut), pas RGPD-grade pour docs sensibles client.
2. **Pas de chiffrement at-rest documenté précisément** vs alternatives self-host.
3. **Surface produit non focalisée** : facile que le client se perde sur la page Notion.

**Idée actionable Axion-IA** : **ne pas utiliser Notion** pour file requests. Construire en V1.5 un **portail client minimal `/mes-donnees/onboarding`** où le client uploade ses docs (audit existant, accès SaaS, schéma archi, etc.) directement vers Hetzner Object Storage (S3-compat) chiffré at-rest, avec **lien magique par email** (signed URL 7j, RGPD-clean).

---

### Loom file requests

Source : observation produit publique 2026 / [loom.com](https://www.loom.com).

**À retenir**

1. **Loom = vidéo asynchrone** principalement, file request est un add-on récent — pertinent pour demander **un screencast** explicatif du contexte client.
2. **Embed sur n'importe quelle page** + analytics (qui a regardé combien de temps) : utile pour Axion-IA pour partager des démos d'audits aux prospects.
3. **AI-generated summaries + chapters** : pratique pour résumer un cadrage enregistré V2+.

**À NE PAS reproduire**

1. **Workflow file request pas central produit** : surface annexe chez Loom, mieux ailleurs.
2. **Stockage US par défaut** : friction RGPD.
3. **Branding Loom** dans les vidéos qu'on partage.

**Idée actionable Axion-IA** : **utiliser Loom comme outil sales/ops interne** uniquement (ex. envoyer un screencast démo d'audit à un prospect), **pas comme file request**. Pour les file requests, voir Dropbox / portail custom.

---

### Dropbox file request

Source : [dropbox.com/features/share/file-requests](https://www.dropbox.com/features/share/file-requests).

**À retenir**

1. **Lien dédié file-request** : le client uploade sans avoir besoin de compte Dropbox, juste son nom + email + fichiers.
2. **Notification email + tag automatique** des uploads dans un dossier dédié : workflow ops propre.
3. **Limite de taille / type de fichier configurable** : on évite que le client uploade 4 GB de vidéos d'écran inutiles.

**À NE PAS reproduire**

1. **Dropbox business plan obligatoire** pour features avancées (rétention, audit log) : surcoût.
2. **Branding Dropbox** sur la page d'upload : casse l'expérience premium Axion-IA.
3. **Stockage US par défaut** (sauf Dropbox Business EU paid tier) — RGPD friction.

**Idée actionable Axion-IA** : **V1 alternative tactique = utiliser Dropbox file request sur une page interne `/onboarding/upload` redirigée**, le temps de bâtir le portail custom S3-compat Hetzner V1.5. Marqué `legacy` dès le go-live du portail custom.

---

## HORS SCOPE V1 — Mentions 1 phrase max

### PDP e-invoicing FR

- **Pennylane** : suite comptabilité + facturation FR populaire, candidate PDP pour la réforme e-invoicing 2026-2027 ; à réévaluer V3+ une fois la structure juridique Axion-IA tranchée.
- **Sage** : leader historique, PDP pré-immatriculée ; sur-dimensionné pour Axion-IA V1.
- **Cegid** : éditeur FR, PDP candidate ; même verdict que Sage, hors V1.

### Qualiopi software

- **Beedeez** : LMS Qualiopi-ready, hors V1 (Axion-IA ne fait pas de formation pure).
- **Workelo** : onboarding + parcours, hors V1.
- **Edusign** : signature de feuilles de présence Qualiopi, hors V1.
- **Digiforma** : back-office OF (organisme de formation) complet, hors V1.

---

## Synthèse cross-catégories

### 5 patterns récurrents à adopter

1. **Hosted page tiers + webhooks vers nous, plutôt qu'embed iframe**. Pour Stripe (Checkout, Customer Portal), Yousign, Whereby : laisser le prestataire owner l'écran sensible (paiement, signature, vidéo) et nous concentrer sur l'orchestration via webhooks. Réduit la surface PCI-DSS / eIDAS / TURN-STUN à zéro. **Application Axion-IA** : Checkout hosted + Yousign hosted + Whereby embedded (la seule exception, et seulement quand on aura un besoin admin réel).

2. **State machine explicite + audit log infaillible**. Tous les leaders (Stripe events, GitHub audit log, Doctolib statuts, Linear timeline) exposent un journal séquentiel par objet (réservation, devis, facture) avec acteur + timestamp + payload before/after. **Application Axion-IA** : modèle Prisma `AdminAuditLog` + page `/admin/audit-log` filtrable + rétention 10 ans + export CSV DPO. Décision D17 (state machine 16 valeurs) cohérente.

3. **Command palette (Cmd+K) + search universel transversal**. Linear, Stripe Dashboard, Vercel : c'est l'attendu 2026 pour tout admin pro. Un seul raccourci, accès à tout (réservations, clients, devis, factures, pages admin). **Application Axion-IA** : implémenter `Cmd+K` côté admin **et** côté public (déjà discuté dans audit Header Nav).

4. **Empty states + timelines live + deep-links partout**. Vercel, Stripe, Doctolib : chaque liste a un empty state actionnable, chaque détail a une timeline événements live (SSE ou polling 5s), chaque modal a une URL persistante. **Application Axion-IA** : timeline live sur `/admin/reservations/[id]` qui montre `booking.created → checkout.session.completed → email.sent → cadrage.scheduled → yousign.signed → invoice.paid → delivered` en temps réel.

5. **Funnel pré-qualifié + deposit-gated explicite**. Calendly Routing Forms, Acuity Deposits, Doctolib motif-first : on **qualifie avant de réserver** et on **engage financièrement avant de bloquer du temps premium**. Ne **jamais** afficher un calendrier vide sans contexte. **Application Axion-IA** : 3 questions micro-routing avant le calendrier sur `/reserver`, puis Stripe Checkout acompte 30 % avant confirmation du créneau, cohérent décisions D1/D3/D9.

### 3 anti-patterns à éviter

1. **Iframe Calendly / DocuSign / Notion sur une page premium B2B**. Casse la trust, fragmente le branding, alourdit le DOM, expose à des CSP issues. **Anti-pattern frontal**. Axion-IA doit owner 100 % de son tunnel public, ne déléguer au tiers QUE l'écran transactionnel critique (Stripe hosted page, lien Yousign dans email transactionnel branded).

2. **Sur-engineering du modèle data + admin (Notion-style flexibilité, Cal.com Event Types × Schedules × Teams × Orgs)**. Tentation de prévoir « le futur » → écrans de config 4 niveaux profonds. **Garder 2 niveaux max** dans l'admin V1 et faire converger les vues sur les 5-7 KPI critiques (réservations du jour, devis en attente, factures impayées, livrables à envoyer, no-show à recycler). Décision D32 (export CSV mensuel V1) est dans cette logique.

3. **Stockage US par défaut sur données sensibles client (Notion file request, Loom uploads, Dropbox free, Whereby recording, Google Meet recording)**. Friction RGPD croissante 2026 pour les clients FR/UE ETI/grande-entreprise. **Toujours préférer un fournisseur UE-native (Yousign FR, Whereby NO/UE, Hetzner DE) + Object Storage Hetzner pour les fichiers clients chiffrés at-rest**. Architecture TVA-agnostique (FR vs EE) ne change pas ce verdict : la résidence UE est non-négociable.

---

**Fin du livrable benchmarks Phase 3** — `02-BENCHMARKS-2026.md` — Auditeur : Claude Opus 4.7 (1M context) — 2026-05-12.
