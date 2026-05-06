# CLAUDE.md — AxionIA · v6
# Fichier de référence pour Claude Code
# À lire OBLIGATOIREMENT au démarrage de chaque session
# Cette version v6 remplace toutes les versions précédentes

> 🔴 **Source de vérité ultime** : `axionia-package/docs/_DECISIONS-FINALES.md` (06/05/2026).
> Ce CLAUDE.md s'aligne dessus. En cas de doute, ce fichier-ci doit céder devant `_DECISIONS-FINALES.md`.

---

## 🔴 INSTRUCTION PERMANENTE POUR CLAUDE CODE

Ce fichier est **vivant**. À chaque session :
1. Le lire en entier avant de toucher quoi que ce soit
2. Si un autre document du dossier contredit ce fichier → ce fichier fait foi
3. Ajouter une note datée en bas (section JOURNAL DE BORD) dès que :
   - Tu prends une décision technique importante
   - Tu découvres quelque chose de non documenté
   - Will te donne une instruction qui doit être retenue
   - Tu résous un bug complexe
   - Tu modifies l'architecture
   - Tu ajoutes une dépendance ou un service externe

---

## 1. IDENTITÉ DU PROJET

| Champ | Valeur |
|---|---|
| Nom du projet | AxionIA |
| Description | Plateforme web vitrine professionnelle — cabinet IA opérationnel pour entreprises |
| Positionnement | Cabinet IA nouvelle génération · premium · opérationnel · résultats chiffrés |
| URL production | https://axion-ia.com |
| Domaine | axion-ia.com — confirmé par Will (06/05/2026) |
| URL admin | https://axion-ia.com/[ADMIN_URL_PREFIX] (variable d'env) |
| URL staging | https://staging.axion-ia.com |
| **Forme juridique** | **OÜ (société estonienne)** |
| **Juridiction** | **Estonie** |
| **Langues** | **FR (principal) + EN (secondaire)** — site multilingue dès le lancement |

⚠️ **Le nom commercial / coordonnées société (numéro registrikood, capital, TVA EE) seront définis ultérieurement par Will. Aucun document ne doit afficher de nom de société, SIREN, SIRET, RCS français — la société est ESTONIENNE.**

---

## 2. RÈGLES ABSOLUES DE LANGAGE

**Le mot « formation » est BANNI partout.** Toujours utiliser :
- « formation » → « intervention »
- « formateur » → « intervenant »
- « former » → « accompagner / faire monter en compétence »
- « formé(e) » → « accompagné(e) / opérationnel(le) »

Une intervention = concret, chez le client, résultat immédiat. AxionIA ne fait pas de formations.

---

## 3. INTERNATIONALISATION (i18n)

### Langues supportées
- **FR** — langue principale, par défaut
- **EN** — langue secondaire, dès le lancement

### Structure URL
```
/                       → redirige vers /fr (ou langue détectée du navigateur)
/fr/                    → version française
/fr/interventions
/fr/audit
/fr/implementation
/fr/cas-concrets
...
/en/                    → version anglaise
/en/interventions       (ou /en/services)
/en/audit
/en/implementation
/en/case-studies
...
```

### Implémentation technique
- Librairie : **next-intl** (standard de facto Next.js App Router)
- Fichiers de traduction : `/messages/fr.json` et `/messages/en.json`
- Toutes les chaînes de caractères du site DOIVENT passer par next-intl, jamais en dur
- Switcher de langue dans le header (FR · EN) et dans le footer (sélecteur)
- Détection automatique de la langue du navigateur au premier visit, mémorisation cookie ensuite
- hreflang automatique sur chaque page (FR ↔ EN)
- Sitemap multilingue (entrées dupliquées avec attributs hreflang)

### Règles éditoriales
- Le copy FR n'est PAS une traduction littérale du EN, c'est l'inverse : on rédige d'abord en FR, l'anglais s'adapte
- Les noms des modules sont traduits :
  - « Interventions entreprise » ↔ « Corporate AI sessions » (ou « Corporate interventions ») — ⚠️ **JAMAIS « training »** (équivalent EN de « formation », banni cf. `axionia-core` §1)
  - « Audit & optimisation » ↔ « AI audit & optimization »
  - « Implémentation IA » ↔ « AI implementation »
  - « Cas concrets » ↔ « Case studies »
- Les prix restent affichés en € HT dans les deux langues (TVA estonienne en sus, taux selon résidence client)

---

## 4. LES 3 MODULES — STRUCTURE DÉFINITIVE

### MODULE 1 — Interventions entreprise
- 5 types d'interventions (l'Essentielle est l'OFFRE PHARE)
- Réservation via **calendrier maison** sur `/interventions` (3 états : RÉSERVÉ / OPTION / DISPONIBLE — voir doc 24)
- Calendly est **abandonné**
- Notification Telegram [INTERVENTION] + table `bookings`

**Les 5 interventions :**

| # | Nom | Cible | Format | Prix HT |
|---|---|---|---|---|
| ★ A | Intervention Essentielle IA | Tous secteurs · tous niveaux | 1 journée | 490 / 790 / 1 190 € |
| B | Vos équipes gagnent 1h/jour | Équipes & salariés (11+) | 1 journée | Sur devis |
| C | Réduire vos coûts cachés | Managers | 1 journée | Sur devis |
| D | Ce que l'IA peut faire pour VOUS | Conférence tous niveaux | ½ journée | Sur devis |
| E | Devenir une entreprise IA | Dirigeants & CODIR | 1 journée | Sur devis |

### MODULE 2 — Audit & optimisation entreprise
- 4 tailles d'entreprise × 2 modalités (à distance / sur site)
- Formulaire 5 étapes → notification Telegram [AUDIT] + table `submissions`
- Rapport livré en 5 jours ouvrés

| Taille | À distance | Sur site |
|---|---|---|
| TPE / Artisan (1-9) | 290 € | 490 € |
| PME (10-49) | 690 € | 990 € |
| Moyenne (50-249) | 1 290 € | 1 990 € |
| Grande (250+) | Sur devis | Sur devis |

### MODULE 3 — Implémentation IA entreprise
- 4 niveaux : automatisation simple / projet intermédiaire / projet complet / IA custom
- Inclut le **service premium IA Custom** (page dédiée)
- Formulaire 4 étapes → notification Telegram [AUTO] + table `submissions`

| Niveau | Prix HT | Délai |
|---|---|---|
| Automatisation simple | À partir de 990 € | 1-3 sem. |
| Projet intermédiaire | À partir de 2 900 € | 3-6 sem. |
| Projet complet | À partir de 5 900 € | 6-10 sem. |
| IA custom d'entreprise | 8 000 à 50 000 € | 4-12 sem. |

---

## 5. ARBORESCENCE COMPLÈTE DES URLs

Toutes les URLs publiques sont préfixées par la langue (`/fr/...` ou `/en/...`). Les URLs ci-dessous sont indiquées sans le préfixe pour la lisibilité.

```
# Module 1 - Interventions entreprise
/interventions                       → Page parent · simulateur ROI · calendrier preuve sociale
/interventions/essentielle           → ★ OFFRE PHARE 490 €
/interventions/equipes
/interventions/managers
/interventions/conference
/interventions/dirigeants

# Module 2 - Audit & optimisation
/audit                               → Page parent · grille 4 tailles × 2 modalités
/audit/complet
/audit/departement
/audit/point-de-vente
/audit/cabinet

# Module 3 - Implémentation IA
/implementation                      → Page parent · 11 exemples (renommé depuis /automatisations)
/implementation/ia-custom            → SERVICE PREMIUM
/implementation/chatbot
/implementation/processus
/implementation/structuration
/implementation/crm-erp
/implementation/documents
/implementation/agents
/implementation/integrations
/implementation/no-code

# Cas concrets (nouveau nom plus engageant que "cas clients")
/cas-concrets                        → Listing filtrable
/cas-concrets/[slug]                 → Cas individuel (indexable)
/cas-concrets/secteur/[slug]         → Listing par secteur

# Contenus indexables (déplacés dans le footer)
/blog                                → Listing
/blog/[slug]
/blog/categorie/[slug]
/blog/tag/[slug]
/blog/auteur/[slug]
/faq                                 → Listing accordéon
/faq/[slug]                          → Question individuelle (indexable)
/faq/categorie/[slug]
/centre-aide                         → Listing
/centre-aide/[slug]                  → Article individuel (indexable)
/centre-aide/categorie/[slug]
/temoignages/[slug]
/recherche                           → Recherche cross-content

# Pages transversales
/a-propos
/contact
/confirmation
/desabonnement
/maintenance

# Pages légales (droit estonien)
/mentions-legales
/conditions-generales                → CGV/CGU adaptées droit estonien
/politique-confidentialite
/cookies
/rgpd

# Système
/404 · /500 · /sitemap.xml · /robots.txt

# Admin
/[ADMIN_URL_PREFIX]                  → Console admin (URL secrète)

# API
/api/calendar/slots
/api/calendar/options
/api/forms/submit
/api/contact
/api/newsletter
/api/search
```

---

## 6. STACK TECHNIQUE — ARRÊTÉE

| Couche | Choix | Raison |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR/SSG mix indispensable SEO/AEO |
| Langage | TypeScript 5+ strict | Type safety, refactoring sûr |
| Style | Tailwind v4 + CSS variables | Charte couleurs en variables = changement trivial |
| Composants | shadcn/ui (Radix headless) | Code possédé, accessible WCAG, restylable |
| Forms | React Hook Form + Zod | Multi-step lourds, validation type-safe |
| BDD | PostgreSQL 16+ + Prisma 5+ | Standard, typé |
| State serveur | TanStack Query 5+ | Cache + revalidation |
| State client | Zustand | Léger, pas de Provider |
| Animations | motion (Framer Motion light v11+) | Compteurs, simulateur ROI, transitions |
| Icônes | Lucide React | Cohérent, tree-shakeable |
| **i18n** | **next-intl 3+** | **FR + EN dès le lancement** |
| **Emails** | **PowerMTA + MailWizz self-hosted + Nodemailer + React Email** | **100% maison sur VPS Hetzner — Resend/SendGrid/Mailgun/Brevo INTERDITS** |
| Queue jobs | BullMQ + Redis 7 | File d'envoi emails, tâches asynchrones |
| Analytics | Plausible self-hosted | RGPD-friendly, lightweight, pas de bannière cookie |
| Auth admin | **Auth.js v5** + 2FA TOTP | Standard, sécurisé |
| Anti-spam | Cloudflare Turnstile + honeypot + rate limit Redis | Multi-couches |
| Tests | Vitest + Playwright | Unit + E2E |
| Monitoring | Sentry self-hosted + Uptime Kuma + Pino | Errors + uptime + logs |
| **Hébergement** | **Hetzner Cloud CX32 (Frankfurt) + Coolify + Cloudflare** | **UE pour cohérence société estonienne + RGPD** |

⚠️ **Vercel / AWS / GCP / Azure / Render / Railway / Fly.io / Cloudflare Pages écartés en tant qu'HÉBERGEURS** : société estonienne → hébergement UE obligatoire (Hetzner Frankfurt Allemagne). Évite les transferts de données hors UE qui complexifient la politique de confidentialité.

⚠️ **Distinction packages npm open-source** : `@vercel/og` (génération OG images) et `motion` (ex-Framer Motion, racheté par Vercel) sont des **packages npm sous licence MIT**, parfaitement utilisables sur Hetzner. Le ban concerne **uniquement la plateforme d'hébergement vercel.com**, pas ces libs.

⚠️ **Resend / SendGrid / Mailgun / Brevo INTERDITS** : la stratégie email est PowerMTA + MailWizz self-hosted (que Will maîtrise) — voir `_DECISIONS-FINALES.md` et le skill `axionia-emails`.

---

## 7. CHARTE VISUELLE — Webflow-inspired (validée 06/05/2026)

🎨 **Décision Will 06/05/2026 (soir)** : direction visuelle officielle = **Webflow-inspired**.
Source de vérité : `Design.md` racine + ADR `docs/adr/0001-design-direction-webflow.md`.

### Palette
- **Webflow Blue** `#146ef5` = couleur primaire UNIQUE (CTA, liens, focus)
- **6 couleurs secondaires** disponibles : purple `#7a3dff`, pink `#ed52cb`, green `#00d722`, orange `#ff6b00`, yellow `#ffae13`, red `#ee1d36` — usage **disciplined** (1 par module, jamais 3+ sur une section)
- **Canvas blanc** `#ffffff` dominant, near-black `#080808` pour texte primaire
- Toutes les couleurs en CSS variables Tailwind v4, jamais en dur

### Typographie
- **Police principale** : **Manrope** (Google Fonts, variable, gratuite — substitut open-source de `WF Visual Sans Variable` propriétaire)
- **Police monospace** : **Inconsolata** (Google Fonts)
- Échelle : 80px display hero, 56px section H, 32px sub, 24px feature, 16px body, 15px label uppercase
- Tabular figures sur stats (`font-feature-settings: "tnum"`)

### Spatial & visuel
- **Radius conservatif 4-8px** sur fonctionnels (cards/inputs/buttons), 50% sur avatars
- **Shadow signature 5-couches cascade** sur cards élevées
- **Spacing fractionnel** : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px
- **Container max-width** : 1280px
- **Breakpoints** : 479px / 768px / 992px / 1280px
- **Animation signature** : `translate-x-[6px]` au hover sur CTA primaires + `prefers-reduced-motion` strict

### Discipline d'usage des secondaires
- Module 1 — Interventions : **Webflow Blue** (déjà primaire)
- Module 2 — Audit : **Orange** subtil
- Module 3 — Implémentation IA : **Purple** subtil
- Cycles success/warning/error : green / yellow / red

### Mobile-first ABSOLU
Voir section 8. Tous les patterns ci-dessus sont conçus mobile-first puis amplifiés desktop.

### Détails complets
Voir le skill `axionia-design` pour : tokens CSS variables complets, patterns Boutons/Cards/Forms, animations Motion, iconographie Lucide, anti-patterns mis à jour.

---

## 8. APPROCHE MOBILE-FIRST — RÈGLE FONDAMENTALE

🔴 **Toute page, tout composant, tout layout est conçu et codé MOBILE D'ABORD.**

### Pourquoi
- 70%+ du trafic B2B vient désormais de mobile (LinkedIn, recherche en mobilité)
- Google indexe en mobile-first depuis 2019
- Les décideurs B2B consultent en déplacement avant de partager le lien sur desktop
- Le rendu mobile soigné est un signal de qualité B2B premier ordre

### Règles techniques absolues
- Tailwind : on commence par les classes sans préfixe (= mobile), puis on ajoute `sm:`, `md:`, `lg:` pour agrandir
- Jamais l'inverse : on n'écrit pas `lg:flex md:hidden` mais `flex lg:flex-row` (mental model bottom-up)
- Tests viewport obligatoires : 375px (iPhone SE), 414px (iPhone Pro), 768px (iPad), 1024px (laptop), 1440px (desktop)
- Touch targets min 44×44px partout (norme WCAG)
- Espacement inter-éléments min 8px en mobile pour éviter les mistaps
- Pas de hover-only : tout ce qui s'ouvre au hover desktop doit aussi s'ouvrir au tap mobile
- Navigation mobile = drawer ou bottom-sheet, jamais popup
- Formulaires : 1 input par "ligne" en mobile, type d'input adapté (`type="tel"`, `type="email"`, `inputmode="numeric"`)
- Images responsive avec `next/image` et tailles définies pour CLS = 0
- Pas de tableau qui dépasse en mobile : transformer en cards empilées
- Vidéos : poster image obligatoire, autoplay seulement si muted

### Performance mobile (budgets stricts v5)
- **LCP < 1.8s** sur 3G simulé
- **INP < 80ms**
- **CLS < 0.05**
- **Bundle JS first load < 80kb**
- **Lighthouse > 95** (perf, a11y, best-practices, SEO)
- Polices via `next/font` (preload + swap)
- TTFB < 200ms depuis Cloudflare edge
- Cloudflare cache hit ratio > 80%

---

## 9. HEADER — STRUCTURE DÉFINITIVE (épuré, mobile-first)

🎯 **Philosophie : épuré, moderne, expérience utilisateur exceptionnelle. Aucun nom de société affiché — uniquement un logo monogramme. Le CTA central est l'élément de conversion principal.**

### 9.1 Structure desktop (≥1024px)

```
[Logo monogramme] [Interventions entreprise] [Audit & optimisation] [Implémentation IA] [Cas concrets] [CTA Réserver · 490 €] [FR · EN]
```

| Élément | Détail |
|---|---|
| 1. Logo monogramme | Carré de 28-32px avec initiale ou symbole · pas de texte de société · lien vers / |
| 2. « Interventions entreprise » | Lien direct vers /interventions (pas de dropdown) |
| 3. « Audit & optimisation » | Lien direct vers /audit |
| 4. « Implémentation IA » | Lien direct vers /implementation |
| 5. « Cas concrets » | Lien direct vers /cas-concrets |
| 6. CTA central | « Réserver une intervention » + badge prix « 490 € » + flèche → · redirige vers /interventions/essentielle |
| 7. Sélecteur langue | « FR · EN » discret à droite |

### 9.2 Pourquoi pas de dropdowns

Volonté d'épure : **un clic = une page**. Les sous-pages des modules sont accessibles depuis la page parent (qui les présente toutes). Avantages :
- Header plus léger visuellement
- UX plus rapide (pas de menu à survoler)
- Mobile-friendly natif (pas de menus à reproduire en accordéon)
- SEO meilleur : les pages parents reçoivent du jus de lien depuis le header

### 9.3 Le CTA central — règles précises

- Texte exact FR : **« Réserver une intervention »**
- Texte exact EN : **« Book a session »**
- Badge prix accolé : **« 490 € »** (HT, dynamique depuis admin)
- Icône flèche → discrète à droite
- Style : bouton plein, couleur d'accent forte (la plus visible de la charte)
- Action au clic : redirection vers `/[lang]/interventions/essentielle` (PAS une modal)
- **Sticky** sur toutes les pages, à toutes les étapes du scroll
- Hauteur : tactile sur mobile (min 44px), proportionné sur desktop
- Tracking : événement analytics « cta_central_click »
- aria-label explicite incluant le prix

### 9.4 Variante mobile (<1024px) — header en 2 niveaux

```
Niveau 1 : [Logo monogramme] ............... [Burger ☰]
Niveau 2 : [Intervention en entreprise] ... [Réserver · 490 € →]
```

**Ligne 1** (56px de haut) :
- Logo monogramme à gauche
- Burger menu à droite

**Ligne 2** (CTA bar, 48px de haut, fond légèrement teinté) :
- Mention discrète à gauche : « Intervention en entreprise »
- Bouton compact à droite : « Réserver · 490 € → »
- Cette barre reste visible TOUJOURS pour garder le CTA accessible

**Drawer mobile** (à l'ouverture du burger) :
- Slide-in depuis la droite, 280-320px de large
- Liste verticale propre :
  - Interventions entreprise
  - Audit & optimisation
  - Implémentation IA
  - Cas concrets
  - Blog
  - FAQ
  - Centre d'aide
  - À propos
  - Contact
- Sélecteur langue (FR · EN)
- CTA gros en bas du drawer : « Réserver une intervention · 490 € »
- Coordonnées de contact discrètes en bas

### 9.5 Comportements

- Sticky toujours
- Au repos : fond blanc/neutre, pas d'ombre
- Au scroll : ombre subtile en bas (`box-shadow: 0 1px 3px rgba(0,0,0,0.04)`)
- Indicateur visuel discret sur l'item de nav correspondant à la page active (point sous l'item, ou opacité changée)
- Animations : 150ms ease-out pour tout
- Skip-to-content link en premier (caché, visible au focus clavier)
- Respecte `prefers-reduced-motion`

---

## 10. FOOTER — STRUCTURE DÉFINITIVE (avec Blog)

🎯 **Philosophie : footer riche en contenus indexables (le Blog y est déplacé) — c'est le pivot SEO/AEO du site.**

### 10.1 5 zones, structure desktop

**Zone 1 — Identité (colonne large à gauche)**
- Logo monogramme (version footer claire si fond foncé)
- Baseline courte (max 12 mots)
- Newsletter signup
- 3 réseaux sociaux : LinkedIn (priorité B2B) · YouTube · X

**Zone 2 — Services**
- ★ Essentielle 490 €
- Interventions entreprise
- Audit & optimisation
- Implémentation IA
- IA Custom

**Zone 3 — Ressources** (CONTIENT LE BLOG)
- **Blog** (déplacé depuis le header)
- Cas concrets
- FAQ
- Centre d'aide
- Guide IA gratuit (lead magnet PDF)

**Zone 4 — Entreprise**
- À propos
- Contact
- Partenaires
- Carrières
- Presse

**Zone 5 — Légal**
- Mentions légales
- Conditions générales
- Politique de confidentialité
- Cookies
- RGPD

### 10.2 Bandeau bas

- Copyright © [année] · [nom à compléter par Will]
- Mentions société estonienne : « OÜ · Tallinn · Numéro d'enregistrement à compléter · TVA EE à compléter »
- Email + téléphone de contact (à compléter)
- Sélecteur langue FR · EN
- Lien sitemap
- Lien accessibilité

### 10.3 Variante mobile

- Les 5 colonnes deviennent 5 accordéons fermés par défaut
- Sauf zone Identité (newsletter visible directement)
- Réseaux sociaux toujours visibles
- Bandeau bas en colonne empilée

---

## 11. INTÉGRATIONS EXTERNES

### Telegram (notifications)
Tags utilisés :
- `[INTERVENTION]` · `[OPTION]` · `[OPTION CONFIRMÉE]` · `[OPTION EXPIRÉE]`
- `[ANNULATION]` · `[AUTO]` · `[AUDIT]`
- `[CONTACT]` · `[NEWSLETTER]`

### Emails (PowerMTA + MailWizz + Nodemailer + React Email)

**Architecture** : Next.js → BullMQ queue → Nodemailer (SMTP localhost:2525) → PowerMTA → IP dédiée Hetzner → boîte de réception.
**MailWizz self-hosted** sur `mailwizz.axion-ia.com` pour les campagnes (newsletter).
**Domaine technique d'envoi** : `mail.axion-ia.com` (DNS-only chez Cloudflare, jamais proxied).

**8 templates × 2 langues = 16 templates React Email** :
1. Confirmation réservation intervention
2. Confirmation option posée
3. Rappel option à 24h restantes
4. Option expirée (créneau libéré)
5. Option confirmée par admin
6. Option refusée par admin
7. Confirmation demande implémentation
8. Confirmation demande audit

Tous les templates en FR ET EN.

**Délivrabilité** : DKIM 2048 + SPF strict (`-all`) + DMARC + BIMI + reverse DNS configuré.
**Warmup IP** progressif : 10/jour S1 → 50/jour S2 → 200/jour S3 → 500 → 1000 → 2000+.

**Expéditeurs** :
- Transactionnels : `noreply@axion-ia.com`
- Marketing (newsletter) : `news@axion-ia.com` (avec liens unsubscribe RFC 8058)
- From-name : à définir par Will.

⚠️ **Resend / SendGrid / Mailgun / Brevo INTERDITS** — voir `_DECISIONS-FINALES.md` et le skill `axionia-emails`.

### Calendly — ABANDONNÉ
Le calendrier maison du doc 24 fait foi. Doc 12 archivé.

---

## 12. VARIABLES D'ENVIRONNEMENT

Validation runtime obligatoire via `@t3-oss/env-nextjs` (`lib/env.ts`).

```bash
# ============== Application ==============
APP_URL=https://axion-ia.com
APP_ENV=production
APP_DEBUG=false
APP_DEFAULT_LOCALE=fr
APP_AVAILABLE_LOCALES=fr,en
NEXTAUTH_URL=https://axion-ia.com
NEXTAUTH_SECRET=                     # 32+ chars random

# ============== Base de données (Hetzner) ==============
DATABASE_URL=                        # postgres connection pooled
DIRECT_URL=                          # postgres direct (pour migrations)
POSTGRES_USER=
POSTGRES_PASSWORD=

# ============== Redis (cache + queue + rate limit) ==============
REDIS_URL=                           # redis://default:password@host:6379

# ============== Admin ==============
ADMIN_URL_PREFIX=                    # URL secrète aléatoire (ex: x7k2n9)
ADMIN_EMAIL=
ADMIN_PASSWORD=

# ============== Telegram (notifications) ==============
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# ============== Calendrier maison ==============
CALENDAR_DEFAULT_OPTION_DURATION_HOURS=48
CALENDAR_REMINDER_HOURS=24
CALENDAR_WEBHOOK_SECRET=

# ============== Email (PowerMTA + MailWizz + Nodemailer) ==============
SMTP_HOST=localhost                  # PowerMTA local sur le VPS
SMTP_PORT=2525
SMTP_FROM_ADDRESS=noreply@axion-ia.com
SMTP_FROM_NAME=                      # à définir par Will
SMTP_FROM_MARKETING=news@axion-ia.com
PMTA_API_URL=                        # API PowerMTA (gestion queue)
PMTA_API_KEY=
MAILWIZZ_API_URL=https://mailwizz.axion-ia.com/api
MAILWIZZ_API_KEY=

# ============== Sauvegardes (Hetzner Storage Box, S3-compatible) ==============
HETZNER_STORAGE_ENDPOINT=             # u123456.your-storagebox.de
HETZNER_STORAGE_BUCKET=axionia-prod
HETZNER_STORAGE_KEY=
HETZNER_STORAGE_SECRET=

# ============== Anti-spam ==============
TURNSTILE_SITE_KEY=                  # Cloudflare Turnstile (public)
TURNSTILE_SECRET_KEY=                # Cloudflare Turnstile (server)

# ============== SEO / IndexNow ==============
INDEXNOW_KEY=                        # 8-128 chars alphanumeric

# ============== Analytics & monitoring ==============
PLAUSIBLE_DOMAIN=axion-ia.com
PLAUSIBLE_API_URL=https://plausible.axion-ia.com
SENTRY_DSN=                          # self-hosted ou cloud free tier
SENTRY_AUTH_TOKEN=

# ============== Société (à compléter par Will) ==============
COMPANY_NAME=
COMPANY_REGISTRATION_NUMBER=         # registrikood estonien
COMPANY_VAT_NUMBER=                  # TVA EE...
COMPANY_ADDRESS=
COMPANY_EMAIL=contact@axion-ia.com
COMPANY_DPO_EMAIL=dpo@axion-ia.com
COMPANY_PHONE=
```

---

## 13. BASE DE DONNÉES — TABLES

| Table | Rôle | Champs critiques |
|---|---|---|
| `submissions` | Soumissions formulaires | details JSONB · locale (fr/en) |
| `bookings` | Réservations interventions | intervention_type ENUM (essentielle, equipes, managers, conference, dirigeants) · price_paid · participants_tier · locale |
| `calendar_slots` | Créneaux du calendrier maison | date · status (RESERVED/OPTION/AVAILABLE) · sector_displayed |
| `bookings_options` | Options 48h | slot_id · expires_at · status |
| `articles` | Blog | locale · slug par locale |
| `article_translations` | Traductions articles | article_id · locale · title · body · slug |
| `article_tags` | Tags blog | slug UNIQUE par locale |
| `authors` | Auteurs blog | slug UNIQUE · bio_fr · bio_en |
| `testimonials` | Témoignages | slug UNIQUE · short_quote_fr · short_quote_en · full_quote_fr · full_quote_en |
| `case_studies` | Cas concrets | slug UNIQUE · sector · modules_used · translations |
| `faqs` | FAQ | slug UNIQUE · question_fr · question_en · answer_fr · answer_en |
| `help_articles` | Centre d'aide | slug UNIQUE · is_tutorial · translations |
| `surveys` + `survey_responses` | Sondages | OK existant |
| `categories` | Catégories | translations |
| `admin_users` | Comptes admin | OK existant |
| `activity_logs` | Logs admin | OK existant |
| `settings` | Paramètres modifiables | key/value |
| `newsletter_subscribers` | Abonnés newsletter | email · locale · confirmed |

⚠️ Pour le multilingue : choisir entre (a) un champ `locale` sur chaque ligne avec duplication, ou (b) une table de traductions séparée. Recommandation : option (b) pour les contenus longs (articles, cas concrets) et (a) pour les contenus courts (FAQ, témoignages).

---

## 14. CONSOLE D'ADMINISTRATION

- URL : `https://axion-ia.com/[ADMIN_URL_PREFIX]`
- Auth : email + mot de passe + **2FA TOTP obligatoire**
- 4 rôles : Super Admin / Admin / Éditeur / Lecteur
- **Interface admin en FR uniquement** (gérée par Will et son équipe)
- Mais permet de gérer les contenus FR ET EN (toggle de langue dans chaque éditeur)

### Sections
- Tableau de bord
- Soumissions · Catégories · Blog (avec translations) · Cas concrets · Témoignages · FAQ · Centre d'aide
- Calendrier (créneaux, options, validation)
- Paramètres simulateur ROI
- Pricing dynamique (3 modules)
- Tags & auteurs blog
- Newsletter (abonnés, exports)
- Sondages
- Configuration générale

---

## 15. SÉCURITÉ — RÈGLES ABSOLUES

- HTTPS forcé · jamais de HTTP en production
- 2FA obligatoire admin sans exception
- Tokens CSRF sur tous les formulaires POST
- Rate limiting : 10 soumissions/heure par IP
- Validation Zod côté serveur sur tous les inputs
- Requêtes Prisma uniquement
- Logs activité admin
- Sauvegardes quotidiennes chiffrées sur Hetzner Object Storage
- Conformité RGPD (la société estonienne est dans l'UE → RGPD applicable)

---

## 16. SEO & AEO — RÈGLES ENRICHIES

- Bloc « Réponse directe » AEO en haut de chaque page (50-80 mots)
- Schema.org sur toutes les pages (voir doc 27)
- **hreflang** automatique sur chaque page (FR ↔ EN)
- Sitemap multilingue multi-fichier :
  - sitemap-index.xml
  - sitemap-pages-fr.xml + sitemap-pages-en.xml
  - sitemap-blog-fr.xml + sitemap-blog-en.xml
  - sitemap-faq-fr.xml + sitemap-faq-en.xml
  - sitemap-aide-fr.xml + sitemap-aide-en.xml
  - sitemap-cas-fr.xml + sitemap-cas-en.xml
- robots.txt avec disallow sur /admin, /api, /confirmation
- Core Web Vitals (budgets stricts v5) : **LCP < 1.8s · INP < 80ms · CLS < 0.05** (mobile et desktop) · Lighthouse > 95
- bloc AEO 50-80 mots sur chaque page parent
- llms.txt + IndexNow protocol
- Stratégie complète : doc 18 + doc 27 + skill `axionia-seo-aeo`

---

## 17. CONVENTIONS DE CODE

- Fichiers : kebab-case
- Composants : PascalCase
- Variables/fonctions : camelCase
- Tables BDD : snake_case (côté DB), PascalCase (modèles Prisma)
- CSS variables : kebab-case avec préfixe sémantique (`--color-bg-primary`)
- Commentaires en anglais (universel pour le code)
- Tests obligatoires sur : formulaires, calendrier maison, options 48h, notifications, emails, switcher de langue

---

## 18. COMPORTEMENTS PAR DÉFAUT — VALIDATION REQUISE

Ces points nécessitent l'OK explicite de Will :

- Changer l'URL de l'admin
- Modifier la structure d'une table BDD existante
- Supprimer/renommer un fichier critique
- Changer le format des messages Telegram
- Modifier les champs des formulaires
- Intégrer un service externe non listé
- Toucher au CTA central du header
- Modifier la grille de prix
- Activer Calendly (abandonné — interdit sans validation)
- Ajouter une 3e langue
- Afficher un nom de société (Will fournira plus tard)
- Changer d'hébergeur

---

## 19. ORDRE DE DÉVELOPPEMENT

Phase 1 → Infrastructure & config (Hetzner, Coolify, Postgres, déploiement)
Phase 2 → Setup i18n next-intl (FR + EN dès le début)
Phase 3 → Design system (palette neutre + composants shadcn)
Phase 4 → Header épuré 5 items + Footer 5 zones (avec Blog)
Phase 5 → Page d'accueil + page /interventions/essentielle (offre PHARE)
Phase 6 → Calendrier maison + simulateur ROI
Phase 7 → Pages des 5 interventions + 4 audits + 9 implémentations
Phase 8 → Formulaires multi-step + notifications Telegram + emails (FR + EN)
Phase 9 → Console admin (toutes sections + toggle langue par contenu)
Phase 10 → Blog + FAQ + centre d'aide + cas concrets (avec URLs individuelles + multilingue)
Phase 11 → Pages transversales (à propos, contact, légales, 404, 500, désabonnement)
Phase 12 → SEO/AEO (schemas, sitemaps multilingues, robots, performance)
Phase 13 → Sauvegardes + sécurité finale + monitoring

---

## 20. ERREURS FRÉQUENTES À ÉVITER

| Erreur | Conséquence | Comment éviter |
|---|---|---|
| Couleurs en dur | Impossible de basculer la charte | CSS variables Tailwind toujours |
| Réintroduire Calendly | Casse la stratégie preuve sociale | Calendrier maison uniquement |
| Concevoir desktop-first | Mobile cassé | Tailwind mobile-first absolu |
| Texte en dur (sans next-intl) | Pas traduisible | Toutes les chaînes via next-intl |
| URL admin devinable | Brute force | ADMIN_URL_PREFIX aléatoire |
| Form sans rate limiting | Spam | 10/h/IP dès le début |
| Images sans dimensions | CLS élevé | width + height définis toujours |
| Mention « Module 2 = Auto » | Confusion | Module 2 = Audit toujours |
| Mot « formation » utilisé | Incohérence + SEO faux | Lint check |
| Contenu FAQ/aide sans slug | Pas indexable | slug UNIQUE obligatoire |
| Hosting US (Vercel) | Transfert hors UE complexe | Hetzner Allemagne (UE) |
| Affichage SIREN/SIRET | Faux : société estonienne | Numéro d'enregistrement estonien + TVA EE |
| Header avec dropdowns lourds | Casse l'épure mobile | Liens directs vers pages parents |

---

## 21. GLOSSAIRE PROJET

| Terme | Définition |
|---|---|
| OÜ | Forme juridique estonienne (équivalent SARL) |
| Module 1 / 2 / 3 | Interventions entreprise / Audit & optimisation / Implémentation IA |
| Essentielle | Offre PHARE 490 € — universelle tous secteurs |
| IA Custom | Service premium Module 3 — IA sur mesure |
| Calendrier maison | Calendrier 3 états sur /interventions |
| Cas concrets | Anciennement « cas clients » — plus engageant |
| WebFactory | Outil propriétaire de Will qui a généré le dossier initial |
| AEO | Answer Engine Optimization — citation par Perplexity/ChatGPT |
| Bloc AEO | Paragraphe réponse directe 50-80 mots en haut de page |
| Will | Propriétaire du projet — seul décisionnaire |

---

## 22. DOSSIER COMPLET — RÉFÉRENCE

| Doc | Sujet | Statut |
|---|---|---|
| 00 | Synthèse globale | v3 (intégré au pack) |
| 01 | Vision & positionnement | À mettre à jour (société estonienne, multilingue) |
| 02 | Charte graphique | GELÉ — couleurs reportées |
| 03 | Module Interventions | OK v3 |
| 04 | Module Implémentation | OK v2 (renommé depuis « Mise en place ») |
| 05 | Module Audit | OK v2 |
| 06 | Architecture pages & UX | À enrichir |
| 07 | Copywriting complet | À corriger (« formation » + i18n + société estonienne) |
| 08 | Console admin | À enrichir v2 |
| 09 | Base de données | À enrichir v2 (multilingue + nouvelles tables) |
| 10 | Sécurité & RGPD | OK avec ajustements société estonienne |
| 11 | Pages dédiées | À corriger + ajouter essentielle/ia-custom |
| 12 | Calendly & Telegram | ARCHIVÉ |
| 13 | Infrastructure | OK — Hetzner confirmé |
| 14 | Emails automatiques | À enrichir v2 (FR + EN) |
| 15 | Plan de développement | À mettre à jour v2 |
| 16 | Copywriting vendeur | À corriger |
| 17 | Témoignages & cas concrets | OK avec slugs et i18n |
| 18 | Stratégie AEO/SEO | À corriger + multilingue |
| 19 | Plan éditorial blog | À corriger + version EN |
| 20 | Copywriting sous-catégories | À corriger |
| 21 | Pages interventions détaillées | À mettre à jour v2 |
| 22 | IA Custom | À corriger (Module 3) |
| 23 | Simulateur ROI | OK v2 |
| 24 | Calendrier réservation | OK |
| **25** | **Stack technique** | **NOUVEAU v2 (intégré au pack)** |
| **26** | **Header & Footer** | **NOUVEAU v2 (intégré au pack)** |
| **27** | **Indexation & schemas** | **NOUVEAU v2 (intégré au pack — multilingue)** |
| **28** | **Pages légales** | **NOUVEAU v2 (intégré au pack — droit estonien)** |
| **29** | **Internationalisation FR/EN** | **NOUVEAU v1 (intégré au pack)** |

---

# 📓 JOURNAL DE BORD

> Notes les plus récentes EN HAUT.

---

### [06/05/2026 soir 3] — Passe v10.2 close · démarrage Sprint 0
**Contexte :** Phase 0 Phase 1 / 1.S / 2 du `PROMPT-MAITRE.md` validées. 16 contradictions Phase 0 documentées dans `_AUDIT/00-fiches-lecture.md`. Will arbitre Q1=a (patch d'abord) puis précise « il y a tout maintenant ».
**Décision :** la passe v10.2 devient **documentaire** — pas de patch des 15 .docx historiques. Justification : CLAUDE.md v6 + `_DECISIONS-FINALES.md` + skills `axionia-*` + 22 LOCKs (cf. `CHANGELOG-LOCKS.md`) + wireframes vérifiés au grep résolvent les 16 points à la source. Les .docx deviennent archives de référence ; en cas de conflit, hiérarchie de décision applicable (`_DECISIONS-FINALES` > CLAUDE.md > axionia-* > génériques LOCKés > .docx).
**Décision Q2 (archivage skills) :** Q2=c — aucun déplacement. Les 9 skills hors-scope (signup-flow-cro, paywall-upgrade-cro, onboarding-cro, churn-prevention, revops, community-marketing, referral-program, aso-audit, seo-ecommerce) restent actifs au niveau racine. Mégapack `axionia-megapack-skills/` non archivé.
**Impact :** livrable `_AUDIT/CHANGELOG-v10.2.md` produit. Sprint 0 (M1) démarré sur la base de cette hiérarchie.
**À ne pas oublier :** lors d'une lecture de .docx archivé, vérifier d'abord que CLAUDE.md v6 / `_DECISIONS-FINALES.md` ne contredit pas le contenu lu — la décision finale prévaut.

### [06/05/2026 soir 2] — Directive Will : Home claire sur les 3 piliers
**Contexte :** Will rappelle que la page d'accueil doit afficher avec **clarté absolue** les 3 choses qu'AxionIA fait, et UNIQUEMENT ces 3.
**Décision :**
- **Pilier 1 — Interventions en entreprise** : sur site, opérationnelles, dès le lendemain (Module 1, offre phare Essentielle 490 €)
- **Pilier 2 — Audits en entreprise pour optimiser et gagner temps, argent, et main-d'œuvre** (Module 2, 290-1990 €) — accroche bénéfice explicite
- **Pilier 3 — Implémentations et codage IA** (Module 3, automatisations + agents + IA Custom 990-50 000 €)
**Impact :**
- Bandeau directive ajouté en tête de `Wireframes-Briefs-AxionIA/02-Page-Accueil.md`
- Hero + section "3 cartes modules" doivent porter ce message en clair, sans jargon
- Le visiteur doit comprendre en 5-10 secondes
**À ne pas oublier :** ne pas diluer le message avec d'autres offres. Pas de « formation IA » (mot banni). Pas de side-products en page d'accueil. Trois piliers clairs, point.

### [06/05/2026 soir] — CLAUDE.md v6 — Direction visuelle Webflow-inspired
**Contexte :** Will a fourni un `Design.md` racine explicitement « inspired by Webflow » et confirmé qu'il fait office de doctrine officielle (scénario A — nouvelle doctrine), levant la mention « charte reportée » de la v5.
**Décision :** ADR `docs/adr/0001-design-direction-webflow.md` créée et acceptée.
- Palette : Webflow Blue `#146ef5` + 6 secondaires disciplined (purple/pink/green/orange/yellow/red)
- Typographie : Manrope (substitut open-source du WF Visual Sans Variable propriétaire) + Inconsolata mono
- Spatial : radius 4-8px conservatif, shadow 5-couches cascade, échelle spacing fractionnelle Webflow
- Animation : `translate-x-[6px]` au hover sur CTA primaires
- Breakpoints : 479 / 768 / 992 / 1280px
**Impact :** réécriture complète de `axionia-design/SKILL.md`, mise à jour `axionia-core/SKILL.md` § charte, mise à jour `_DECISIONS-FINALES.md`, création ADR 0001.
**À ne pas oublier :**
- WF Visual Sans Variable est propriétaire Webflow → substitué par Manrope (Google Fonts gratuite)
- Tension positionnement « cabinet IA premium B2B » ↔ palette Webflow grand public — surveiller retours décideurs
- Discipline secondaires : 1 couleur par section, jamais 3+
- L'audit Phase 0 §5 listait Webflow dans les 5 marques formellement déconseillées — décision Will écrase cette recommandation

### [06/05/2026] — CLAUDE.md v5 — Synchronisation avec _DECISIONS-FINALES.md
**Contexte :** audit profond du dossier v10.1 — détection que CLAUDE.md v4 contredisait `_DECISIONS-FINALES.md` sur 3 décisions critiques (emails, auth, perf budgets) et que les variables d'env étaient incomplètes. v5 réaligne tout.
**Décisions actées (cohérentes avec `_DECISIONS-FINALES.md` qui fait foi) :**
- **Emails** : PowerMTA + MailWizz self-hosted + Nodemailer + React Email — Resend/SendGrid/Mailgun/Brevo INTERDITS
- **Auth admin** : Auth.js v5 (nom officiel depuis 2024, anciennement NextAuth.js)
- **Budgets perf stricts** : LCP < 1.8s · INP < 80ms · CLS < 0.05 · JS first load < 80kb · Lighthouse > 95 (au lieu des seuils permissifs Google génériques)
- **Variables d'env complètes** : ajout PMTA_*, MAILWIZZ_*, NEXTAUTH_*, REDIS_URL, TURNSTILE_*, INDEXNOW_KEY, SENTRY_DSN, HETZNER_STORAGE_*, COMPANY_DPO_EMAIL, DIRECT_URL
- **Animations** : `motion` (Framer Motion light v11+) au lieu de Framer Motion classique
- **Hiérarchie de décision** explicitée en tête : `_DECISIONS-FINALES.md` > skills `axionia-*` > CLAUDE.md > skills génériques
**Impact :** réécriture sections §6 (stack), §8 (perf budgets), §11 (emails), §12 (env vars), §16 (perf SEO). Aucune autre section modifiée — les décisions URLs/modules/Estonie/i18n/header/footer sont inchangées et déjà alignées.
**À ne pas oublier :**
- En cas de doute Claude Code doit consulter `axionia-package/docs/_DECISIONS-FINALES.md` qui est la source de vérité absolue
- Les skills `axionia-emails`, `axionia-stack`, `axionia-deployment` sont synchrones avec ces décisions
- Les skills `axionia-forms` et `axionia-i18n` ont été nettoyés des mentions résiduelles « Resend »

---

### [06/05/2026] — CLAUDE.md v4-bis — Domaine confirmé : axion-ia.com
**Contexte :** Will confirme le nom de domaine définitif.
**Décision :** axion-ia.com (avec tiret · .com pour international cohérent société estonienne).
- Sous-domaines : www.axion-ia.com (redirect 301) · admin.axion-ia.com (console admin) · api.axion-ia.com (webhooks/API) · staging.axion-ia.com (préprod)
- Adresses email : contact@axion-ia.com · noreply@axion-ia.com · admin@axion-ia.com · dpo@axion-ia.com (RGPD)
**Impact :** Tous les docs ont été mis à jour avec axion-ia.com en remplacement des placeholders [domaine] et de l'ancienne mention axionia.fr.
**À ne pas oublier :** vérifier que le domaine est bien acheté et que Hetzner pointe correctement avant la mise en prod.

### [06/05/2026] — CLAUDE.md v4 — Société estonienne, header épuré, mobile-first, multilingue
**Contexte :** Will précise plusieurs points critiques :
- La société est estonienne (OÜ), pas française. Pas de SIREN/SIRET.
- Le site est multilingue FR + EN dès le lancement.
- Le header doit être ÉPURÉ : 5 items uniquement (Logo · Interventions entreprise · Audit & optimisation · Implémentation IA · Cas concrets · CTA · sélecteur langue).
- Mobile-first absolu.
- Le Blog est déplacé du header au footer.
- Aucun nom de société à afficher pour l'instant — Will fournira plus tard.
**Décisions :**
- Hébergement définitif : Hetzner Allemagne (UE) — Vercel écarté pour cohérence société UE
- Module 3 renommé « Implémentation IA » (au lieu de « Mise en place »)
- /automatisations renommé /implementation
- /cas-clients renommé /cas-concrets (plus engageant)
- next-intl ajouté à la stack obligatoire
- Tables BDD enrichies pour gérer la traduction (article_translations, champs duplicés sur FAQ/témoignages, locale sur submissions)
- Header sans dropdowns : un clic = une page parent (qui présente les sous-pages)
- Header mobile en 2 niveaux : ligne logo+burger / barre CTA dédiée
- Sitemap multilingue (multi-fichier × 2 langues)
- Pages légales adaptées droit estonien
**Impact :** Pack complet régénéré : CLAUDE.md v4, doc 00 v3, doc 25 v2, doc 26 v2, doc 27 v2, doc 28 v2 + nouveau doc 29 i18n.
**À ne pas oublier :**
- Aucun nom de société dans aucun document tant que Will n'a pas tranché
- TVA EE (estonienne) en sus, pas TVA française
- Tous les textes doivent passer par next-intl (FR + EN)
- Mobile-first c'est non négociable, à vérifier à chaque PR

### [06/05/2026] — Versions précédentes archivées
(notes des versions v1 à v3 de CLAUDE.md — calendrier maison, ban formation, Essentielle 490€, modules numérotés, header CTA central, footer 5 zones)

### [06/05/2026] — Intégration pack v4 + cohérence v9 finale
**Contexte :** Nouveau pack reçu avec CLAUDE.md v4 + doc 00 v3 + docs 25-29 mis à jour. Intégration complète + pass de cohérence sur 25 docs existants.
**Actions réalisées :**
- CLAUDE.md v4 en place (ce fichier) — remplace toutes versions précédentes
- Doc 00 v3 en place (société estonienne OÜ, multilingue FR+EN, mobile-first)
- Docs 25/26/27/28 v2 mis à jour (stack Hetzner confirmé, header épuré, i18n multilingue)
- Doc 29 NOUVEAU : Internationalisation FR/EN (next-intl)
- Ancien doc 29 (CGV) renommé 31, ancien doc 30 (À Propos) conservé en 30
- Pass de cohérence sur 25 docs : /automatisations→/implementation, /cas-clients→/cas-concrets, "Mise en place"→"Implémentation IA", SIREN/SIRET→numéro estonien, Vercel→Hetzner Allemagne
**Décisions actées dans ce pack :**
- Société estonienne OÜ — JAMAIS afficher SIREN/SIRET/RCS français — numéro d'enregistrement estonien (à compléter par Will)
- Hébergement Hetzner Allemagne DÉFINITIF — Vercel écarté pour cohérence société UE
- Site multilingue FR+EN dès le lancement (next-intl) — URLs /fr/ et /en/
- Header ÉPURÉ : Logo + Interventions entreprise + Audit & optimisation + Implémentation IA + Cas concrets + CTA + langue — PAS de dropdowns
- Mobile-first absolu — règle non négociable
- /automatisations renommé /implementation
- /cas-clients renommé /cas-concrets
- Module 3 = "Implémentation IA" (plus "Mise en place")
- Blog déplacé du header vers le footer (Zone 3 Ressources)
- next-intl ajouté à la stack obligatoire
- Sitemap multilingue multi-fichier × 2 langues
- Pages légales adaptées droit estonien (AKI = CNIL estonienne)
**À ne pas oublier :**
- Aucun nom de société dans aucun document jusqu'à validation Will
- TVA EE (estonienne) — jamais TVA française
- Tous les textes du site via next-intl (FR + EN)
- Mobile-first = on code mobile D'ABORD, puis on agrandit (Tailwind sans préfixe d'abord)
- Sauvegardes sur Hetzner Object Storage (S3-compatible)
- Variable COMPANY_NAME dans .env (à compléter par Will)
