# 📚 PHASE 0 — Fiches de lecture · Axion-IA

> **Mission** : synthèse READ-ONLY de TOUS les documents/skills du dossier Axion-IA, prélude à l'audit transverse de la Phase 1. Conforme au prompt-maître v1.1 (06/05/2026).
>
> **Source de vérité ultime** : `axionia-package/docs/_DECISIONS-FINALES.md` (06/05/2026).
> **Référence Claude Code** : `CLAUDE.md v5` (réécrit pour aligner sur \_DECISIONS-FINALES).

---

# 1. Synthèse des 33 fichiers `.docx`

Méthode : extraction `python-docx` → fiche 10 lignes par doc + détection des contradictions transverses.

### 00 — Synthèse Globale

- **Statut** : v3 — référence, aligné v10.1.
- Récapitule identité OÜ estonienne, domaine `axion-ia.com`, FR+EN, Hetzner Frankfurt, mobile-first.
- 3 modules : Interventions / Audit / Implémentation IA — tunnel naturel.
- Grille tarifs : Essentielle 490/790/1190 €, Audit 290–1990 €, Implémentation 990–50 000 €.
- Header épuré 5 items + CTA central « Réserver · 490 € », Blog déplacé en footer.
- Charte couleurs reportée → palette neutre via CSS variables.
- Mot « formation » BANNI ; modules nommés Interventions/Audit/Implémentation IA.
- **Cohérence** : aligné `_DECISIONS-FINALES.md`.

### 01 — Vision & Positionnement

- **Statut** : v2 — référence (bandeau OÜ ajouté).
- Cabinet IA opérationnel premium (TPE → grand compte, FR+international).
- Tunnel : M1 Interventions → M2 Audit → M3 Implémentation.
- KPI an 1 : 50 interventions, 20 audits, 10 implémentations, CA 150–250 k€ HT.
- Différenciation : « on intervient, on code, on déploie » — aucune théorie.
- Domaine `axion-ia.com`, OÜ estonienne, FR principal.
- **Cohérence** : OK.

### 02 — Charte Graphique

- **Statut** : GELÉ — bandeau de tête « charte reportée ».
- Couleurs anciennes (#1B3A6B bleu / #B8922A or / #2D7A5F vert) NE PAS appliquer.
- Palette temporaire noir/blanc/gris (zinc-900/50/600), CSS variables Tailwind.
- Principes structurants valides : 80 % blanc dominant, McKinsey/Roland Berger.
- Polices indicatives : Instrument Serif/Neue Haas + DM Sans/Inter.
- **Cohérence** : OK avec CLAUDE.md §7 (charte reportée), mais corps du doc continue à décrire les 3 couleurs anciennes — risque que Claude Code les implémente s'il oublie le bandeau.

### 03 — Module Interventions (M1)

- **Statut** : v3 — référence.
- Offre phare « Intervention Essentielle IA » : 490/790/1190 € HT (2-8 / 9-15 / 16-25), 25+ sur devis.
- 4 autres interventions sur devis (équipes 11+ / managers / conférence ½j / dirigeants).
- Mot « formation » banni explicitement, on dit « intervention/intervenant ».
- URL canonique : `/interventions/essentielle`.
- Formulaire 5 étapes → notification Telegram `[INTERVENTION]`.
- **Cohérence** : OK.

### 04 — Module Implémentation IA (M3)

- **Statut** : v2 — référence (renommé depuis « Mise en place / automatisations »).
- Grille : simple ≥ 990 €, intermédiaire ≥ 2900 €, complet ≥ 5900 €, IA Custom 8 000–50 000 €.
- 8 catégories d'implémentations (chatbot, processus, agents, CRM/ERP, no-code…).
- Formulaire 4 étapes → Telegram `[AUTO]`.
- IA Custom = page premium `/implementation/ia-custom`.
- **Cohérence** : OK.

### 05 — Module Audit (M2)

- **Statut** : v2 — référence.
- 4 tailles × 2 modalités : TPE 290/490 € · PME 690/990 € · Moyenne 1290/1990 € · Grande sur devis.
- Livrable : rapport en 5 jours ouvrés, top 3 priorités IA + ROI + plan 90 jours.
- Formulaire 5 étapes → Telegram `[AUDIT]` (champ `numéro d'enregistrement`, pas SIREN).
- **Cohérence** : OK.

### 06 — Architecture Pages & UX

- **Statut** : v2 — référence (bandeaux mobile-first + header ajoutés).
- Structure home en 10 sections, page `/interventions` en 4 blocs (offre phare → simulateur ROI → calendrier preuve sociale → 5 cards).
- Compteurs officiels : +120 entreprises / +18 000 h / +6,4 M€ / 96 % satisfaction.
- Règles mobile-first et header épuré rappelées.
- **Cohérence** : OK, MAIS section "Navigation" en bas du doc parle encore de « Hover Interventions | Dropdown : Offre phare + 5 interventions + Voir toutes » — voir contradictions §7.

### 07 — Copywriting Complet

- **Statut** : v2 — corrigé partiellement.
- Hero, compteurs (+120 / +18 000 h / +6,4 M€), 3 cards modules, FAQ.
- Bandeau multilingue : copy FR référence, EN à adapter via next-intl.
- **Cohérence** : OK textuellement (« intervention » partout). Voir doc 16/30 pour résidus « formation ».

### 08 — Console Administration

- **Statut** : v2 — référence (toggle FR/EN documenté).
- Console FR-only mais éditeurs avec toggle FR/EN (status draft/published par langue).
- 4 rôles : Super Admin / Admin / Éditeur / Lecteur.
- 2FA TOTP obligatoire, URL admin via `[ADMIN_URL_PREFIX]`.
- **Cohérence** : OK.

### 09 — Base de Données & Sauvegardes

- **Statut** : référence avec addenda 09b/09c.
- 9 tables principales décrites + stratégie 3-2-1, AES-256, rétention 7j/4sem/12mois.
- Mention « Backblaze B2 ou AWS S3 · région EU » comme stockage secondaire.
- ENUM type `audit/automatisation/intervention` (encore « automatisation » au lieu d'« implementation »).
- **Cohérence** : ÉCART — stockage doit être Hetzner Storage Box uniquement (voir contradictions §2).

### 09b — BDD Addendum Calendrier

- **Statut** : référence.
- Tables `calendar_slots` (3 états) + `bookings_options` (renommée en 09c).
- Champs RGPD : `consent_display`, `display_sector`, `expires_at` = +48 h.
- **Cohérence** : OK.

### 09c — BDD Addendum Final

- **Statut** : v3 — référence (avec addendum v4 multilingue).
- 30 tables, ajout `case_studies`, `help_articles`, `article_tags`, `authors`, `settings`, `bookings_options`.
- Stratégie multilingue hybride : `*_translations` pour contenus longs, `*_fr/*_en` pour courts.
- **Cohérence** : OK.

### 10 — Sécurité Plateforme

- **Statut** : référence (à ajuster juridiction estonienne).
- 2FA TOTP, mot de passe ≥12, bcrypt rounds=12, sessions 8 h.
- TLS 1.3 / HSTS, CSP, rate limit 10/h/IP, fail2ban.
- RGPD : conservation 3 ans actives / 5 ans archivées.
- **Cohérence** : ÉCART — mention « CNIL » au lieu d'« AKI » (voir contradictions §11).

### 11 — Pages Dédiées

- **Statut** : v2 — référence (17 pages).
- 5 Interventions, 4 Audit, 9 Implémentation, transversales.
- Slugs localisés : `/cas-concrets ↔ /case-studies`, `/centre-aide ↔ /help-center`.
- **Cohérence** : OK, mais Meta description `/interventions/equipes` contient encore « former vos équipes » — voir contradictions §6.

### 12 — Calendly & Telegram

- **Statut** : ARCHIVÉ — bandeau « ne plus utiliser ».
- Calendly abandonné, remplacé par calendrier maison (doc 24).
- **Cohérence** : OK, mais référencé par doc 14/15 sous l'ancienne forme.

### 13 — Infrastructure & Déploiement

- **Statut** : référence (Hetzner confirmé, bandeau OÜ).
- Hetzner Cloud Frankfurt, Ubuntu 24.04, Coolify implicite.
- **Section emails contradictoire** : recommande « Brevo · Resend · Postmark » + `BACKUP_S3_BUCKET`.
- Variables d'env listées sont l'ancien set (manque PMTA*\*, MAILWIZZ*_, REDIS*URL, NEXTAUTH*_).
- **Cohérence** : ÉCART MAJEUR avec CLAUDE.md v5 — voir contradictions §1, §2, §13, §14.

### 14 — Emails Automatiques

- **Statut** : v2 — référence partielle.
- Bandeau multilingue : 8 templates × 2 langues = 16 templates « **Resend**/React Email ».
- **Cohérence** : ÉCART MAJEUR — Resend INTERDIT (voir contradictions §1).

### 15 — Plan de Développement

- **Statut** : à mettre à jour v2.
- Phasage 8 phases (CLAUDE.md v5 §19 indique 13 phases).
- Cite « LCP < 2.5s · **FID** < 100ms · CLS < 0.1 » (FID déprécié, doit être INP).
- **Cohérence** : ÉCART (voir contradictions §4, §15).

### 16 — Copywriting Vendeur Complet

- **Statut** : à corriger.
- Compteurs officiels : +120 / +18 000 h / +6,4 M€ / 96 %.
- **Sous-titre Hero contient « Axion-IA _forme_ vos équipes »** — verbe banni.
- **Cohérence** : ÉCART (voir contradictions §6).

### 17 — Témoignages & Preuves Sociales

- **Statut** : v2 — référence.
- 10 témoignages signés, 8 cas concrets, 5 données propriétaires, 6 stats sectorielles.
- **Cohérence** : OK.

### 18 — Stratégie AEO/SEO

- **Statut** : v2 — référence.
- Distinction explicite : mot-clé `formation IA` autorisé en SEO (intent), copy/AEO uses « intervention ».
- Mots-clés par page, blocs AEO 50-80 mots, mapping Schema.org par type.
- **Cohérence** : OK.

### 19 — Plan Éditorial Blog

- **Statut** : v2 — référence partielle.
- 52 articles, 5 catégories, blocs « Réponse en 30 secondes » 50-80 mots.
- **Cohérence** : OK.

### 20 — Copywriting Pages Sous-catégories

- **Statut** : v2 — référence.
- H1, AEO, prix, CTA, meta SEO pour 5 interventions + audit + implémentation.
- **Cohérence** : OK.

### 21 — Pages Interventions Détaillées

- **Statut** : v2 — référence.
- Programme heure par heure de l'Essentielle (09h-17h, 9 blocs), kit IA personnel.
- **Cohérence** : OK.

### 22 — IA Custom (Module 3)

- **Statut** : v2 — référence.
- URL `/implementation/ia-custom`, 8 000–50 000 € HT, 4-12 sem.
- 3 approches : RAG / fine-tuning / hybride.
- **Cohérence** : OK.

### 23 — Simulateur ROI & Réservation

- **Statut** : v2 — référence.
- Slider 2-25 participants → prix dynamique. Hypothèse gain 35 %.
- Tous paramètres éditables depuis console admin.
- **Cohérence** : OK.

### 24 — Calendrier Réservation

- **Statut** : référence (Calendly remplacé).
- 3 états : RÉSERVÉ / OPTION / DISPONIBLE, secteur affiché.
- Système d'option 48 h.
- 4 tags Telegram : `[OPTION] / [RÉSERVATION] / [OPTION EXPIRÉE] / [OPTION CONVERTIE]`.
- **Cohérence** : OK (mais nuance terminologique — voir contradictions §9).

### 25 — Stack Technique

- **Statut** : v2 — référence (intégré pack v10).
- Next.js 15 + TS strict + Tailwind v4 + shadcn + RHF/Zod + Postgres/Prisma + TanStack Query + Zustand + next-intl + Vitest + Playwright.
- Hébergement Hetzner Allemagne + Coolify, choix justifié vs Vercel.
- Perf budgets « LCP < 2.5s · INP < 100ms · CLS < 0.1 · JS < 100kb ».
- **Cohérence** : ÉCART — emails listés `Resend + React Email`, auth `NextAuth.js 5` (vs Auth.js v5), perf budgets plus laxistes que CLAUDE.md v5 (LCP<1.8 / INP<80 / CLS<0.05 / JS<80kb).

### 26 — Header & Footer

- **Statut** : v2 — référence (intégré pack v10).
- Header desktop 64 px, 7 zones, AUCUN dropdown.
- Mobile 2 niveaux (logo+burger / barre CTA) + drawer.
- Footer 5 zones, Blog dans Zone 3 Ressources.
- **Cohérence** : OK.

### 27 — Indexation & Schemas

- **Statut** : v2 — référence.
- Routes individuelles indexables × 2 langues.
- Mapping Schema.org complet (Organization, Service+Offer, QAPage, HowTo, Article, Person, Review).
- IndexNow + Bing Webmaster Tools.
- **Cohérence** : OK.

### 28 — Pages Légales (droit estonien)

- **Statut** : v2 — placeholder structurel.
- 6 pages : mentions légales / CGV / politique conf. / cookies / RGPD / accessibilité + désabonnement.
- Spécificités OÜ : registrikood, TVA EE, AKI = autorité estonienne (équivalent CNIL).
- Mention « Resend EU region » dans destinataires politique conf.
- **Cohérence** : ÉCART léger — mention Resend (voir contradictions §1).

### 29 — Internationalisation FR/EN

- **Statut** : NOUVEAU v1 — référence.
- next-intl 3+, structure messages par namespace.
- Préfixage URL `/fr/` `/en/`, slugs localisés via `pathnames`.
- hreflang automatique, sitemap × 2 langues.
- Console admin FR-only avec toggle FR/EN par contenu.
- **Cohérence** : OK.

### 30 — Page À Propos

- **Statut** : nouveau — référence.
- 6 sections (Mission / Fondateur / Approche / Secteurs / Engagements / CTA).
- Placeholders `[WILL_PRENOM]`, `[WILL_NOM]`, `[WILL_PHOTO]`, etc.
- **Sous-titre contient « former leurs équipes »** — verbe banni.
- **Cohérence** : ÉCART (voir contradictions §6).

### 31 — CGV & Politique de Déplacement

- **Statut** : nouveau (bandeau OÜ ajouté).
- CGV par module, acompte 30 %, annulation graduée.
- Politique déplacement : forfaits 0/80/150/250 € selon rayon.
- Tribunal compétent : Saint-Étienne (42), droit français.
- **Cohérence** : ÉCART MAJEUR — droit français vs OÜ estonienne (voir contradictions §10).

### 32 — Guide d'Utilisation

- **Statut** : NOUVEAU v1 — méta-document.
- Ordre de lecture : CLAUDE.md → 00 → 32 → 25 → 26 → 29 → 27 → 03/04/05 → 23/24 → reste.
- 18 règles non négociables récapitulées, phasage 13 étapes, 45-55 j-h estimés.
- **Cohérence** : OK, indique que CLAUDE.md fait foi.

---

# 2. Synthèse des 9 wireframes-briefs

### 00-README — Index des 8 priorités wireframes

- Sommaire 5 090 lignes de spec, conventions communes, charte reportée, mobile-first, WCAG 2.1 AA.
- ⚠️ **Contradiction critique** `00-README.md:103` : « Email : Resend (depuis le doc 14) » contredit `_DECISIONS-FINALES.md:91`.
- **Cohérence** : ÉCART (Resend mentionné).

### 01-Header-Footer — Composant global

- Header desktop + mobile (2 niveaux 56+48px), Footer 5 zones, Breadcrumbs.
- CTA « Réserver une intervention · 490 € » sticky, monogramme 32×32px.
- A11y : skip-to-content, `aria-current`, `role="dialog"`, focus trap.
- 16 checkpoints livraison, viewports 375/414/768/1024/1440/1920px.
- **Cohérence** : OK.

### 02-Page-Accueil — `/[locale]/` Hub commercial

- 14 sections (S0 AEO sr-only → S13 CTA final), simulateur inline, calendrier preuve sociale.
- Bloc AEO sr-only S0 (50-80 mots), `IntersectionObserver`, `Intl.NumberFormat`.
- Schemas Organization + WebSite + Service ×3 + FAQPage + BreadcrumbList.
- ⚠️ **Écart performance** : « LCP < 2.5s mobile 3G » vs `_DECISIONS-FINALES.md:144` (LCP < 1.8s).
- **Cohérence** : ÉCART perf.

### 03-Page-Essentielle — `/interventions/essentielle` OFFRE PHARE

- Hero 3 tranches prix (490/790/1190€), programme journée, simulateur ROI, calendrier 3 états, formulaire 5 étapes.
- 80% des conversions attendues, simulateur AVANT le prix.
- Schemas Service + Offer ×3 + FAQPage en JSON-LD.
- **Cohérence** : OK.

### 04-Calendrier-Maison — Composant signature

- 3 états (DISPONIBLE ●, OPTION 48h ○, RÉSERVÉ ✓), affichage **secteur** (Cialdini).
- Cells 56×56px desktop · 44×44px mobile, swipe horizontal.
- Race condition créneau pris pendant saisie, 2 clics pour réserver.
- **Cohérence** : OK.

### 05-Simulateur-ROI — Composant inline

- 3 sliders, calcul instantané, persistance entre simulateur et formulaire via params URL.
- Formule `gain_horaire × temps × nb × 220j × 0.7`, debounce 100ms.
- Touch target 44px, font-size 16px (anti-zoom iOS).
- **Cohérence** : OK.

### 06-Formulaires-Multistep — 3 formulaires transverses

- Réservation 5 étapes, Audit 5, Implémentation 4. Validation Zod, persistance localStorage 1h.
- Barre progression, indicateur étape, pré-remplissage URL params.
- 1 input/ligne mobile, `inputmode` adapté, `role="group"`, focus trap modal.
- **Cohérence** : OK.

### 07-Pages-Templates — 3 templates secondaires

- Article blog `/blog/[slug]`, FAQ `/faq/[slug]`, Cas concret `/cas-concrets/[slug]`.
- Bloc AEO (50-80 mots), Sommaire sticky desktop, schemas Article + QAPage + CaseStudy.
- Image cover `loading="eager"` (LCP), tags pills.
- **Cohérence** : OK.

### 08-Console-Admin — `/[ADMIN_URL_PREFIX]` back-office

- Login + 2FA TOTP, sidebar 240px / topbar 56px, mobile bottom-sheet.
- 14 sections (Activité, Contenus, Communication, Configuration), recherche `⌘K`.
- Will valide option 48h en <30s, Telegram + console real-time.
- Rate limit 5/15min/IP, captcha Turnstile, `__Host-session` cookie.
- **Cohérence** : OK.

---

# 3. Synthèse des 6 docs racine

### CLAUDE.md (v5 · 06/05/2026)

- Aligné sur \_DECISIONS-FINALES (déclaration explicite l3).
- 22 sections + Journal de bord. Identité, bannissement « formation », i18n, 3 modules, Stack, charte reportée, mobile-first, header 5 items.
- Stack : Next.js 15, TS strict, Tailwind v4, shadcn, Auth.js v5 + 2FA, **PowerMTA + MailWizz + Nodemailer + React Email**.
- Budgets : LCP<1.8s · INP<80ms · CLS<0.05 · JS<80kb · Lighthouse>95.
- **Cohérence** : aucune contradiction interne.

### \_DECISIONS-FINALES.md (06/05/2026)

- Source de vérité ULTIME.
- Identité OÜ Estonie, stack verrouillée, coût ~14,60€/mois, interdictions formelles (Vercel/AWS/GCP/Render/Resend/...).
- SEO/AEO : llms.txt + IndexNow + sitemap multi-fichiers + glossaire + comparaisons + méthodologie E-E-A-T.
- §225-244 : 11 skills sur-mesure énumérés (titre dit « (10) » → incohérence numérique mineure).
- **Cohérence** : source.

### 25-Stack-Technique-v3.md

- Philosophie (perf SEO/AEO + souveraineté UE + coût ~0), 4 couches.
- Cite explicitement « motion (Framer Motion light) 15kb », `@vercel/og` (lib npm MIT).
- Coûts détaillés Hetzner CX32 7€ + Storage 4€ + IP 1€ + Backups 1,40€ = ~14,60€/mois.
- **Cohérence** : excellente avec \_DECISIONS-FINALES et CLAUDE.md v5.

### 13-Infrastructure-v2.md

- Domaine confirmé, Hetzner CX32 Frankfurt, DNS Cloudflare 14 records (mail. en DNS-only).
- SSL Let's Encrypt + Cloudflare Origin, HSTS preload, emails maison PowerMTA+MailWizz.
- DKIM 2048 + SPF strict + DMARC + BIMI + reverse DNS PTR.
- Warmup IP : 10/j → 2000+/j (S6+).
- **Cohérence** : OK.

### Navigation-Complete-Axion-IA.md

- 61 templates × 2 langues = 340 routes au démarrage.
- 7 user flows critiques (Mermaid), états spéciaux par écran.
- **Cohérence** : OK.

### RAPPORT_AUDIT_v10.1.md

- 404 checks · 0 problème · 100% conformité.
- 15 catégories vérifiées, 7 corrections v10→v10.1.
- **Note** : Le rapport date d'avant CLAUDE.md v5. Certains points emails étaient encore alignés sur Resend dans des docs annexes — d'où les contradictions détectées en Phase 0.

---

# 4. Inventaire skills

## 4.1 — Mégapack source (88 skills) — `axionia-megapack-skills/.claude/skills/`

**8 skills `axionia-*`** : core · database · design · forms · i18n · mobile-first · seo-aeo · stack.

**80 skills génériques** : 14 superpowers (workflow) · 41 marketing · 24 SEO · 1 owasp-security.

## 4.2 — Pack travaillé (103 skills, dont 18 axionia-\*) — `axionia-package/.claude/skills/`

**18 skills `axionia-*`** :

| #   | Skill                | Origine                                       | Cité dans \_DECISIONS-FINALES.md ? |
| --- | -------------------- | --------------------------------------------- | ---------------------------------- |
| 1   | axionia-core         | mégapack + pack                               | ✅                                 |
| 2   | axionia-stack        | mégapack + pack                               | ✅                                 |
| 3   | axionia-design       | mégapack + pack                               | ✅                                 |
| 4   | axionia-mobile-first | mégapack + pack                               | ✅                                 |
| 5   | axionia-i18n         | mégapack + pack                               | ✅                                 |
| 6   | axionia-seo-aeo      | mégapack + pack                               | ✅                                 |
| 7   | axionia-forms        | mégapack + pack                               | ✅                                 |
| 8   | axionia-database     | mégapack + pack                               | ✅                                 |
| 9   | axionia-anti-spa     | pack uniquement                               | ✅                                 |
| 10  | axionia-deployment   | pack uniquement                               | ✅                                 |
| 11  | axionia-emails       | pack uniquement                               | ✅                                 |
| 12  | axionia-a11y         | pack uniquement (ajouté Phase 0 préliminaire) | ❌ — surplus                       |
| 13  | axionia-admin-ux     | pack uniquement (ajouté)                      | ❌ — surplus                       |
| 14  | axionia-calendar     | pack uniquement (ajouté)                      | ❌ — surplus                       |
| 15  | axionia-monitoring   | pack uniquement (ajouté)                      | ❌ — surplus                       |
| 16  | axionia-performance  | pack uniquement (ajouté)                      | ❌ — surplus                       |
| 17  | axionia-rgpd         | pack uniquement (ajouté)                      | ❌ — surplus                       |
| 18  | axionia-testing      | pack uniquement (ajouté)                      | ❌ — surplus                       |

**85 skills génériques** : 14 superpowers + 38 marketing + 27 SEO + 1 owasp + 1 web-design-guidelines (Vercel Labs) + 4 externes (ui-ux-pro-max, frontend-design Anthropic, claude-md-improver Anthropic, claude-automation-recommender Anthropic).

## 4.3 — Écart vs prompt-maître (12 attendus → 18 livrés)

- **Prompt-maître** annonce « 12 skills `axionia-*` chargés en session », et énumère « 8 mégapack + 4 probables (anti-spa, deployment, emails, a11y) ».
- **Réalité du pack** : **18 skills `axionia-*`** (les 12 attendus + 6 supplémentaires créés en préliminaire).

**Surplus de 6 skills (valeur ajoutée à valider en Phase 1.S)** :

1. `axionia-admin-ux` — patterns spécifiques back-office (sidebar, recherche ⌘K, bandeau alerte 48h).
2. `axionia-calendar` — composant signature 3 états, race conditions, options 48h.
3. `axionia-monitoring` — Sentry self-hosted + Uptime Kuma + Pino + Telegram alerts.
4. `axionia-performance` — budgets Lighthouse>95 + bundle<80kb + LCP<1.8s.
5. `axionia-rgpd` — droit estonien, AKI, droit à l'oubli, export Article 20.
6. `axionia-testing` — Vitest + Playwright + viewports + Lighthouse CI.

**Écart numérique mineur** : `_DECISIONS-FINALES.md:228` annonce « (10) » mais énumère 11 items. Le prompt-maître attend 12 → écart de 1 entre \_DECISIONS-FINALES (11) et prompt-maître (12).

## 4.4 — Note sur le mégapack vs le pack

Le **mégapack** (`axionia-megapack-skills/`) est un **sous-ensemble strict** du pack (`axionia-package/`) — aucun skill exclusif au mégapack. Il peut être archivé/supprimé sans perte (action décisionnelle Phase 1.S).

---

# 5. Inventaire `awesome-design-md-main/` (73 marques)

**Top 12 marques recommandées pour le futur `DESIGN.md` Axion-IA** (Phase 2.0) :

| Rang | Marque         | Justification Axion-IA                                                                                                |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1    | **Vercel**     | Blanc dominant, near-black #171717, _shadow-as-border_, Geist Sans serré. Référence absolue pour cabinet IA premium.  |
| 2    | **Stripe**     | Blanc canvas, navy #061b31, weight 300 display, ombres bleu-tintées = signaux luxe sans gradients.                    |
| 3    | **Linear**     | Discipline structurelle, single accent #5e6ad2, hairlines hyperfines. À inverser en thème clair.                      |
| 4    | **Apple**      | Galerie museum-like, Action Blue unique, type négative letter-spacing. Modèle pages cas-concrets et IA Custom.        |
| 5    | **IBM**        | Carbon Design = sobriété enterprise pure, blanc + IBM Blue + IBM Plex Sans 300. Très proche McKinsey/Roland Berger.   |
| 6    | **Mintlify**   | Dual mode docs : marketing clair + docs dense. Pour centre d'aide / FAQ / blog Axion-IA.                              |
| 7    | **Cal.com**    | Blanc, CTA noir, Cal Sans + Inter. Modèle direct pour calendrier maison.                                              |
| 8    | **Intercom**   | Cream blanc + Saans + un seul Fin Orange. Leçon « single accent » SaaS service.                                       |
| 9    | **Superhuman** | Blanc dominant 90%+, un seul moment dramatique. Inspiration page d'accueil et /interventions/essentielle.             |
| 10   | **Notion**     | Architecture (hero + cream surfaces + un seul purple, pricing 4-tier). Pour page pricing 3 modules (à épurer).        |
| 11   | **Resend**     | Dark editorial avec serif Domaine Display. À retenir uniquement pour inversion sombre (footer, sections témoignages). |
| 12   | **Sanity**     | Achromatic gray scale pure, pill primary. Discipline neutre = ton conseil-expertise.                                  |

**5 marques formellement DÉCONSEILLÉES** : PostHog (cream playful + mascottes), Sentry (dark purple + lime vif), Webflow (palette 6 secondaires + ombres 5-couches), Framer (gradients magenta/violet/orange), Lovable/Runway/Spotify/Nike/Pinterest (cluster grand public émotionnel).

---

# 6. Contradictions inter-docs détectées (consolidées)

**Synthèse globale** : le pack v10.1 est cohérent sur la stratégie (modules, prix, OÜ estonienne, mobile-first, header épuré, multilingue, Hetzner) mais **16 contradictions techniques persistent**, principalement issues de la fenêtre temporelle entre v3/v4 du dossier (Resend, Brevo, NextAuth) et la décision finale 06/05/2026 (PowerMTA self-hosted, Auth.js v5, perf budgets durcis).

| #   | Sujet                                                                                     | Source de vérité                                | Fichiers fautifs                                                                                                                                  | Sévérité                 |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | **Resend INTERDIT**                                                                       | CLAUDE.md v5 §6/§11 + \_DECISIONS-FINALES.md:91 | doc 13 §5, doc 14 bandeau, doc 25 stack, doc 28 destinataires, **wireframe 00-README:103**                                                        | 🚨 CRITIQUE              |
| 2   | **Stockage cloud** : Hetzner Storage Box uniquement                                       | CLAUDE.md v5 §12                                | doc 09 (Backblaze/AWS S3), doc 13 (`BACKUP_S3_*`)                                                                                                 | 🚨 CRITIQUE              |
| 3   | **Auth.js v5** (pas NextAuth.js 5)                                                        | CLAUDE.md v5 §6                                 | doc 25 stack                                                                                                                                      | ⚠️ Mineur                |
| 4   | **Perf budgets stricts** : LCP<1.8 / INP<80 / CLS<0.05 / JS<80kb / Lighthouse>95          | CLAUDE.md v5 §8/§16                             | doc 25 (LCP<2.5/INP<100/CLS<0.1/JS<100), doc 06 (idem), doc 15 (FID au lieu d'INP), doc 13 (Lighthouse>90), **wireframe 02-Page-Accueil:617-624** | 🚨 CRITIQUE              |
| 5   | **Animation `motion`** (pas Framer Motion classique)                                      | CLAUDE.md v5 §6                                 | doc 25 (Framer Motion 11+)                                                                                                                        | ⚠️ Mineur                |
| 6   | **Mot « formation/former » banni**                                                        | CLAUDE.md v5 §2                                 | doc 11 (Meta /interventions/equipes), doc 16 (Hero sous-titre), doc 30 (sous-titre À propos)                                                      | 🚨 CRITIQUE              |
| 7   | **Header sans dropdown**                                                                  | CLAUDE.md v5 §9.2 + doc 26 §2.2                 | doc 06 (« Hover Interventions \| Dropdown »)                                                                                                      | ⚠️ Moyen                 |
| 8   | **Module 3 = Implémentation IA** (pas /automatisations)                                   | CLAUDE.md v5 §4                                 | doc 09 ENUM (`automatisation`), doc 15 (`/automatisations` résiduel)                                                                              | ⚠️ Moyen                 |
| 9   | **Tags Telegram** `[OPTION CONFIRMÉE]` (pas CONVERTIE)                                    | CLAUDE.md v5 §11                                | doc 12, doc 24 (`[OPTION CONVERTIE]`)                                                                                                             | ⚠️ Mineur                |
| 10  | **Droit estonien CGV** (pas droit français)                                               | CLAUDE.md v5 §1 + doc 28                        | **doc 31 (« Tribunal Saint-Étienne · droit français »)**                                                                                          | 🚨 CRITIQUE              |
| 11  | **AKI** (pas CNIL)                                                                        | doc 28 §4                                       | doc 10 (notification CNIL 72h)                                                                                                                    | ⚠️ Moyen                 |
| 12  | **Charte reportée** : palette neutre + CSS variables                                      | CLAUDE.md v5 §7 + doc 02 bandeau                | doc 02 corps (#1B3A6B / #B8922A / #2D7A5F décrits)                                                                                                | ⚠️ Moyen (si bandeau lu) |
| 13  | **Variables d'env complètes** (PMTA*\*, MAILWIZZ*_, REDIS*URL, NEXTAUTH*_, TURNSTILE\_\*) | CLAUDE.md v5 §12                                | doc 13 (set obsolète SMTP*\*, BACKUP_S3*\*, GA_ID)                                                                                                | 🚨 CRITIQUE              |
| 14  | **Plausible self-hosted** (pas GA4)                                                       | CLAUDE.md v5 §6                                 | doc 13 (GA4 + GOOGLE_ANALYTICS_ID), doc 15 (Google Analytics actif)                                                                               | 🚨 CRITIQUE              |
| 15  | **Phasage 13 phases** (i18n en phase 2)                                                   | CLAUDE.md v5 §19 + doc 32                       | doc 15 (8 phases ancien ordre)                                                                                                                    | ⚠️ Moyen                 |
| 16  | **Calendrier maison uniquement**                                                          | CLAUDE.md v5 §11                                | doc 09 champ « Calendrier maison/Cal.com », doc 15 « 4 événements Calendly »                                                                      | ⚠️ Moyen                 |

**Recommandation** : passe de cohérence v10.2 ciblée sur les docs **13, 14, 15, 16, 25, 30, 31** + alignement ENUM Prisma doc 09 sur 09c + correction wireframe **00-README:103** et **02-Page-Accueil:617-624**.

---

# 7. Sortie Phase 0 — Synthèse exécutive

| Item                                      | Statut | Détail                                                                                                                                           |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lecture des 6 docs racine                 | ✅     | CLAUDE.md v5 + \_DECISIONS-FINALES + 25-Stack-Technique-v3 + 13-Infrastructure-v2 + Navigation + RAPPORT_AUDIT                                   |
| Lecture des 9 wireframes-briefs           | ✅     | Tous synthétisés en 10 lignes                                                                                                                    |
| Lecture des 33 fichiers `.docx`           | ✅     | Conversion python-docx, 33 fiches produites                                                                                                      |
| Inventaire mégapack (88)                  | ✅     | 8 axionia-\* + 80 génériques                                                                                                                     |
| Inventaire pack travaillé (103)           | ✅     | 18 axionia-\* + 80 génériques + 4 externes (ui-ux, frontend-design, claude-md-improver, claude-automation-recommender) + 1 web-design-guidelines |
| Écart skills (12 attendus → 18 livrés)    | ✅     | Surplus 6 skills à valider Phase 1.S                                                                                                             |
| Inventaire awesome-design-md (73 marques) | ✅     | Top 12 recommandés + 5 déconseillés                                                                                                              |
| Contradictions transverses                | ✅     | 16 contradictions identifiées (5 critiques)                                                                                                      |

---

# 8. Checkpoint Phase 0 — STOP & ASK Will

**Bilan rapide** :

- Le dossier v10.1 est globalement cohérent sur la **stratégie** (identité OÜ, modules, tarifs, URLs, mobile-first, header épuré, multilingue, Hetzner).
- **16 contradictions techniques** subsistent, dont **5 critiques** (Resend, Stockage cloud, Perf budgets, mot « formation » résiduel, droit français des CGV).
- Le pack skills livre **18 skills `axionia-*`** (vs 12 attendus dans le prompt-maître). Surplus = +6 skills supplémentaires (admin-ux, calendar, monitoring, performance, rgpd, testing) ajoutés en préliminaire.
- Aucune ligne de code n'est encore écrite. Wireframes-briefs prêts mais brief 00-README cite Resend une fois (à corriger).

**Question — OUI / CONTINUE / STOP** :

➡️ **Démarrer la PHASE 1 (audit transversal documentaire fichier-par-fichier ligne-par-ligne)** ?

Si **OUI**, je commence la Phase 1 (production de `_AUDIT/01-audit-coherence.md`) en :

1. Auditant chaque fichier ligne par ligne contre les 25 catégories validées en v10.1.
2. Détectant toute dérive supplémentaire vs ce qui est déjà listé en §6 ci-dessus.
3. Citant `file_path:line_number` pour chaque écart.

Si **STOP**, dis-moi quels points de la Phase 0 tu veux clarifier avant.

Si **CONTINUE avec ajustements**, indique les ajustements (par exemple : « ne pas faire la passe v10.2 sur les docx, on les corrigera après »).

---

_— Phase 0 livrée · 06/05/2026 · 33 docx + 9 wireframes + 6 docs racine + 88 skills mégapack + 103 skills pack + 73 marques DESIGN.md analysés. READ-ONLY respecté._
