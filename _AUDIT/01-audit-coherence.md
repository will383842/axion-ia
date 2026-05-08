# Phase 1 — Audit transversal fichier-par-fichier · Axion-IA

> **Mission READ-ONLY** : audit ligne-par-ligne contre les **25 catégories validées en v10.1** (mises à jour Webflow 06/05/2026 soir).
> **Sources de vérité (ordre décroissant)** : `_DECISIONS-FINALES.md` (avec addendum Webflow) > `Design.md` racine + ADR `0001-design-direction-webflow.md` > `CLAUDE.md` v6 > skills `axionia-*` > docs `25-Stack-Technique-v3` / `13-Infrastructure-v2`.
> **Étendue** : 33 docx + 9 wireframes-briefs + 4 docs racine + 1 navigation + 1 Design.md + 1 ADR.
> **Méthode** : extension de `_AUDIT/00-fiches-lecture.md` §6 (16 contradictions déjà détectées) avec ajout des **2 nouvelles catégories Webflow (24, 25)** et requalification de la catégorie 7 (charte couleur).

---

## Méthode

1. **Inputs** : prompt-maître v1.1 (06/05/2026) + livrable Phase 0 (`00-fiches-lecture.md`) + sources de vérité actuelles (CLAUDE.md v6, \_DECISIONS-FINALES avec addendum Webflow, Design.md racine, ADR 0001).
2. **Grille** : 25 catégories listées dans le prompt — la catégorie 7 a basculé de « charte reportée » à « charte Webflow-inspired » le 06/05 soir, ce qui rend obsolètes tous les bandeaux « charte reportée » du dossier.
3. **Citations** : `file_path:line_number` ou `file_path:section` pour tout écart. Quand une donnée se trouve dans un `.docx`, je m'appuie sur la fiche Phase 0 (`00-fiches-lecture.md`) qui synthétise déjà chaque docx — note explicite quand la vérification précise nécessite une relecture binaire ultérieure.
4. **Statuts** :
   - 🟢 = aucun écart détecté contre la catégorie
   - 🟡 = écarts mineurs (résiduels, terminologie, doc historique)
   - 🟠 = écarts moyens (à corriger avant production)
   - 🔴 = écarts critiques (bloquant, à corriger AVANT tout code)
5. **Convention de gravité** alignée sur `_AUDIT/00-fiches-lecture.md` §6.

---

## Tableau croisé des 25 catégories

| #   | Catégorie                                                                                                                            | Statut | Fichiers fautifs (principaux)                                                                                                                                                                                                                                                                                                                                      | Citation pivot                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Domaine `axion-ia.com` (avec tiret)                                                                                                  | 🟢     | —                                                                                                                                                                                                                                                                                                                                                                  | `CLAUDE.md:34` `_DECISIONS-FINALES.md:14`                                                                                  |
| 2   | Société OÜ estonienne (jamais SIREN/SIRET/RCS)                                                                                       | 🟡     | doc 31 (corps texte « Tribunal Saint-Étienne »)                                                                                                                                                                                                                                                                                                                    | `_AUDIT/00-fiches-lecture.md:238`                                                                                          |
| 3   | URLs canoniques `/implementation` `/cas-concrets` `/conditions-generales`                                                            | 🟠     | doc 09 ENUM (`automatisation`), doc 15 (`/automatisations` résiduel)                                                                                                                                                                                                                                                                                               | `_AUDIT/00-fiches-lecture.md:89,442`                                                                                       |
| 4   | Header épuré 5 items SANS dropdown                                                                                                   | 🟠     | doc 06 (« Hover Interventions \| Dropdown »)                                                                                                                                                                                                                                                                                                                       | `_AUDIT/00-fiches-lecture.md:70,441`                                                                                       |
| 5   | Footer 5 zones avec Blog dans Ressources                                                                                             | 🟢     | —                                                                                                                                                                                                                                                                                                                                                                  | `CLAUDE.md:437-442` doc 26                                                                                                 |
| 6   | Mobile-first explicite                                                                                                               | 🟢     | —                                                                                                                                                                                                                                                                                                                                                                  | `CLAUDE.md:300-330` doc 06 doc 26                                                                                          |
| 7   | **Charte Webflow-inspired** (anciennement « reportée »)                                                                              | 🔴     | doc 02 corps + bandeau, axionia-megapack-skills/axionia-design, axionia-package/README.md, axionia-package/.agents/product-marketing-context.md, wireframe 01-Header-Footer:491, CLAUDE.md:713 (§19 Phase 3 « palette neutre »), megapack/axionia-design SKILL, megapack/skills/README.md                                                                          | `Wireframes-Briefs-Axion-IA/01-Header-Footer.md:491` `axionia-megapack-skills/.claude/skills/axionia-design/SKILL.md:3,22` |
| 8   | Calendly abandonné (calendrier maison)                                                                                               | 🟡     | doc 12 (archivé OK), doc 14/15 références résiduelles, doc 09 ENUM « Calendrier maison/Cal.com »                                                                                                                                                                                                                                                                   | `_AUDIT/00-fiches-lecture.md:118-120,450`                                                                                  |
| 9   | Multilingue FR + EN avec `next-intl`                                                                                                 | 🟢     | —                                                                                                                                                                                                                                                                                                                                                                  | `CLAUDE.md:80-87` `_DECISIONS-FINALES.md:102-114`                                                                          |
| 10  | Hébergement Hetzner (Vercel/AWS/GCP/Render INTERDITS)                                                                                | 🟢     | — (anciennes mentions Vercel toutes corrigées en docs racines)                                                                                                                                                                                                                                                                                                     | `CLAUDE.md:251-253` `_DECISIONS-FINALES.md:89-92`                                                                          |
| 11  | Mot « formation » banni (sauf SEO contrôlé doc 18)                                                                                   | 🟠     | doc 11 (Meta `/interventions/equipes`), doc 16 (Hero sous-titre), doc 30 (sous-titre À propos)                                                                                                                                                                                                                                                                     | `_AUDIT/00-fiches-lecture.md:115,143,231,440`                                                                              |
| 12  | 3 modules Interventions / Audit / Implémentation IA                                                                                  | 🟢     | —                                                                                                                                                                                                                                                                                                                                                                  | `CLAUDE.md:100-141`                                                                                                        |
| 13  | Cohérence Navigation.md ↔ docs                                                                                                       | 🟢     | —                                                                                                                                                                                                                                                                                                                                                                  | `Navigation-Complete-Axion-IA.md:1-340` aligné CLAUDE.md §5                                                                |
| 14  | URLs critiques mentionnées dans bons docs                                                                                            | 🟡     | doc 09 ENUM (manque `implementation`)                                                                                                                                                                                                                                                                                                                              | doc 09 §schemas                                                                                                            |
| 15  | **Resend / SendGrid / Mailgun / Brevo INTERDITS**                                                                                    | 🔴     | doc 13 §5 (« pas de Brevo, pas de Resend, pas de Postmark » OK MAIS l'addendum textuel laisse trace), doc 14 bandeau (« Resend/React Email »), doc 25 v2 stack, doc 28 destinataires, **wireframe 00-README.md:103**, **wireframe 08-Console-Admin.md:717**                                                                                                        | `Wireframes-Briefs-Axion-IA/00-README.md:103` `Wireframes-Briefs-Axion-IA/08-Console-Admin.md:717`                         |
| 16  | Backups Hetzner Storage Box uniquement                                                                                               | 🟠     | doc 09 (Backblaze B2 / AWS S3), doc 13 v1 (`BACKUP_S3_*`) — doc 13 v2 corrige                                                                                                                                                                                                                                                                                      | `_AUDIT/00-fiches-lecture.md:88-90,436`                                                                                    |
| 17  | Auth.js v5 (pas NextAuth.js 5)                                                                                                       | 🟡     | doc 25 v3:38 (titre OK mais nom historique « (NextAuth) » entre parenthèses)                                                                                                                                                                                                                                                                                       | `25-Stack-Technique-v3.md:38`                                                                                              |
| 18  | **Perf budgets stricts** LCP<1.8s · INP<80ms · CLS<0.05 · JS<80kb · LH>95                                                            | 🔴     | wireframe 02-Page-Accueil:619-623 (LCP<2.5/INP<100/CLS<0.1/JS<100kb/LH>90), wireframe 03-Page-Essentielle:464-467,535,548, wireframe 07-Pages-Templates:670-673,760,764, wireframe 06-Formulaires:615 (LH>90), wireframe 08-Console-Admin:871 (LH>90), doc 15 (FID au lieu d'INP), doc 25 v2 (corrigé en v3)                                                       | `Wireframes-Briefs-Axion-IA/02-Page-Accueil.md:619-623` `Wireframes-Briefs-Axion-IA/03-Page-Essentielle.md:464-467`        |
| 19  | Plausible self-hosted (pas GA4)                                                                                                      | 🟠     | doc 13 v1 (mentionne GA_ID), doc 15 (Google Analytics actif) — corrigé en doc 13 v2                                                                                                                                                                                                                                                                                | `_AUDIT/00-fiches-lecture.md:127,448`                                                                                      |
| 20  | Tags Telegram canon `[INTERVENTION] [AUDIT] [AUTO] [CONTACT] [NEWSLETTER] [OPTION] [OPTION CONFIRMÉE] [OPTION EXPIRÉE] [ANNULATION]` | 🟡     | doc 12 / doc 24 (`[OPTION CONVERTIE]` au lieu de `[OPTION CONFIRMÉE]`, `[RÉSERVATION]` au lieu de `[INTERVENTION]`)                                                                                                                                                                                                                                                | `_AUDIT/00-fiches-lecture.md:188,443`                                                                                      |
| 21  | Droit estonien (pas droit français) pour CGV                                                                                         | 🔴     | **doc 31 (« Tribunal Saint-Étienne · droit français »)**                                                                                                                                                                                                                                                                                                           | `_AUDIT/00-fiches-lecture.md:238-239,444`                                                                                  |
| 22  | AKI (autorité estonienne, pas CNIL)                                                                                                  | 🟠     | doc 10 (notification CNIL 72h), seo-hreflang/cultural-profiles.md:32                                                                                                                                                                                                                                                                                               | `_AUDIT/00-fiches-lecture.md:109,445`                                                                                      |
| 23  | Variables d'env complètes (PMTA*\* MAILWIZZ*_ REDIS*URL NEXTAUTH*_ TURNSTILE*\* INDEXNOW_KEY SENTRY_DSN HETZNER_STORAGE*\*)          | 🟠     | doc 13 v1 (set obsolète SMTP*\*, BACKUP_S3*\*, GA_ID) — doc 13 v2 OK, mais le doc 13 binaire `.docx` racine reste à mettre à jour                                                                                                                                                                                                                                  | `_AUDIT/00-fiches-lecture.md:124-127,447`                                                                                  |
| 24  | **🆕 Direction visuelle Webflow-inspired** (Webflow Blue + 6 sec + Manrope + radius 4-8px + shadow 5-couches + translate-x-[6px])    | 🔴     | docx 02 (charte ancienne #1B3A6B / #B8922A / #2D7A5F décrite), wireframe 01-Header-Footer:491 (« charte reportée » placeholder), CLAUDE.md:713 (§19 Phase 3 « palette neutre »), axionia-megapack-skills/axionia-design (doctrine McKinsey/Roland Berger non corrigée), axionia-package/README.md:68, axionia-package/.agents/product-marketing-context.md:114-125 | `axionia-megapack-skills/.claude/skills/axionia-design/SKILL.md:3` `Wireframes-Briefs-Axion-IA/01-Header-Footer.md:491`    |
| 25  | **🆕 Police Manrope** (pas WF Visual Sans Variable en prod, propriétaire Webflow)                                                    | 🟠     | `Design.md:5,47` cite explicitement « WF Visual Sans Variable, fallback: Arial » sans signaler le substitut Manrope ; tout consommateur lisant `Design.md` sans avoir lu l'ADR risque d'implémenter la police propriétaire ; ADR `0001` corrige (l40) ; CLAUDE.md v6:271 corrige                                                                                   | `Design.md:47`                                                                                                             |

**Total** : sur 25 catégories, **5 vertes (1, 5, 6, 9, 10, 12, 13)** = 7 OK · **6 jaunes** = 6 mineures · **8 oranges** = 8 moyennes · **4 rouges** (7, 15, 18, 21, 24) — note : la cat. 24 et la cat. 7 partagent partiellement la même nature (charte historique), donc on peut traiter en bloc.

> **Score** : `7 catégories vertes / 25 = 28 %` parfaitement alignées · **18 nécessitent correction**, dont **5 critiques (rouges)**.

---

## Détail des écarts par fichier

> Convention : « FP0:§X » = « Fiche Phase 0, section X de `00-fiches-lecture.md` ». « `<file>:Lxx` » = ligne xx du fichier. Les écarts détaillés sur les `.docx` sont attestés via la fiche Phase 0 (extraction `python-docx` réalisée), avec contre-citation `00-fiches-lecture.md:Lxx`.

### 1. CLAUDE.md (racine, v6 — `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md`)

- **Cohérence générale** : 🟢 ce fichier-ci est l'une des **sources de vérité** post-Webflow. Aligné `_DECISIONS-FINALES.md` (l6) et ADR 0001 (l261-296).
- **Écart 1 (catégorie 24, mineur résiduel)** : `CLAUDE.md:713` — _« Phase 3 → Design system (palette neutre + composants shadcn) »_. La mention « palette neutre » est une trace de l'ancienne doctrine McKinsey/Roland Berger. Devrait être : _« Design system Webflow-inspired (Webflow Blue + 6 secondaires disciplined + Manrope + tokens CSS variables + composants shadcn) »_. Sévérité : moyenne — la §7 (l259-294) corrige déjà clairement, mais le §19 doit être réharmonisé.
- **Écart 2 (catégorie 11, terminologie)** : `CLAUDE.md:91-93` — la section i18n traduit « Interventions entreprise » en « Corporate AI training sessions » avec parenthèse alternative « Corporate interventions ». Le mot « training » en EN est l'équivalent direct de « formation » que la catégorie 11 bannit. Recommandation : supprimer la variante « Corporate AI training sessions » et conserver uniquement « Corporate interventions » ou « Corporate AI sessions ». Sévérité : 🟠 moyen.
- **Cohérence avec catégorie 18** : `CLAUDE.md:321-329` budgets perf strictement alignés (LCP<1.8 / INP<80 / CLS<0.05 / JS<80kb / LH>95) ✅.
- **Cohérence avec catégorie 24** : `CLAUDE.md:259-294` (§7) intégralement aligné Webflow-inspired ✅.
- **Cohérence avec catégorie 25** : `CLAUDE.md:271` Manrope explicitement nommée comme substitut de WF Visual Sans Variable ✅.

### 2. `_DECISIONS-FINALES.md` (`axionia-package/docs/_DECISIONS-FINALES.md`)

- **Cohérence générale** : 🟢 source de vérité ULTIME post-Webflow.
- **Écart 1 (catégorie 24/25, à compléter)** : `_DECISIONS-FINALES.md:5` — l'addendum Webflow est en _bloc unique_ en haut du document. Les sections 23-32 plus bas ne récapitulent PAS encore tokens / typographie / radius / shadow dans des tables structurées comme le reste du document. Ce n'est pas une contradiction mais une _incomplétude documentaire_ : si quelqu'un saute le bandeau, il ne trouve pas la stack visuelle dans le tableau §23 (« Stack technique VERROUILLÉE »). Recommandation : ajouter une section dédiée `## 🎨 Direction visuelle (Webflow-inspired)` avec tableau tokens / typographie / radius / shadow, indexée dans le sommaire. Sévérité : 🟡 mineur.
- **Écart 2 (catégorie 4.3 du prompt, écart numérique)** : `_DECISIONS-FINALES.md:228-242` — titre « Skills projet sur-mesure (10) » mais la liste énumère 11 items. Sévérité : 🟡 mineur (cosmétique). Le pack travaillé livre 18 skills — voir `00-fiches-lecture.md:387-398`.
- **Cohérence catégories 1, 9, 10, 15, 16, 19** : 🟢 toutes alignées.

### 3. Design.md racine (`Axion-IA_Dossier_FINAL_ABSOLU_v10.1/Design.md`)

- **Cohérence générale** : 🟢 source visuelle confirmée par ADR 0001.
- **Écart 1 (catégorie 25, critique pour la production)** : `Design.md:47` — _« Font: `WF Visual Sans Variable`, fallback: `Arial` »_. Cette ligne **n'avertit PAS** que `WF Visual Sans Variable` est propriétaire Webflow et ne peut PAS être chargée en production. Si Claude Code lit `Design.md` SANS lire l'ADR, il importera le nom de police inutilisable. **Recommandation prioritaire** : ajouter une note bloc _en tête_ du §3 :
  > ⚠️ Production : utiliser **Manrope** (Google Fonts, gratuite). `WF Visual Sans Variable` est une police propriétaire Webflow non distribuée publiquement et NE DOIT PAS apparaître dans `next/font` ou un `@font-face` du repo Axion-IA. Voir `docs/adr/0001-design-direction-webflow.md:40`.
  > Sévérité : 🟠 moyen. La même note doit apparaître au §1 (l5) et au §7 Do's-and-Don'ts (l81-83).
- **Écart 2 (catégorie 24, breakpoints à harmoniser)** : `Design.md:77` mentionne 3 breakpoints (479px, 768px, 992px) ; ADR 0001:47 et CLAUDE.md:281 ajoutent 1280px. Recommandation : ajouter 1280px dans `Design.md:77` et `:85` pour alignement strict avec ADR. Sévérité : 🟡 mineur.

### 4. ADR `0001-design-direction-webflow.md`

- **Cohérence générale** : 🟢 décision officielle propre, format Michael Nygard.
- **Aucun écart détecté.**
- **Note** : ADR mentionne (l79) `grep -ri "sobriété McKinsey\|Roland Berger\|charte reportée"` doit retourner 0 résultat — actuellement, **plusieurs occurrences subsistent** (voir §6 et §10 ci-dessous). Cette directive de surveillance n'est donc PAS encore satisfaite.

### 5. `13-Infrastructure-v2.md` (`axionia-package/docs/13-Infrastructure-v2.md`)

- **Cohérence générale** : 🟢 cette v2 corrige la v1 du `.docx` racine.
- **Écart 1 (catégorie 17)** : `13-Infrastructure-v2.md:154-155` — variable `NEXTAUTH_URL` et `NEXTAUTH_SECRET` correctes ; le nom officiel actuel est `Auth.js v5` mais les variables d'env restent traditionnellement nommées `NEXTAUTH_*` (compatibilité ascendante). 🟢 OK techniquement, mais Will pourrait ajouter un commentaire `# Auth.js v5 (anciennement NextAuth.js)` pour lever l'ambiguïté.
- **Écart 2 (catégorie 23)** : `13-Infrastructure-v2.md:152-208` — set des variables d'env très complet **sauf** : il manque `APP_AVAILABLE_LOCALES`, `CALENDAR_DEFAULT_OPTION_DURATION_HOURS`, `CALENDAR_REMINDER_HOURS`, `CALENDAR_WEBHOOK_SECRET`, `COMPANY_DPO_EMAIL`, `COMPANY_REGISTRATION_NUMBER` mentionnés dans `CLAUDE.md:526-592`. Sévérité : 🟡 mineur (à compléter pour parité 1:1).
- **Écart 3 (catégorie 7/24)** : `13-Infrastructure-v2.md` ne mentionne JAMAIS la charte visuelle (normal, c'est l'infra) — pas de problème.
- **Cohérence catégories 1, 10, 15, 16, 19** : 🟢 toutes alignées.

### 6. `25-Stack-Technique-v3.md` (`axionia-package/docs/25-Stack-Technique-v3.md`)

- **Cohérence générale** : 🟢 v3 corrige v2.
- **Écart 1 (catégorie 17, terminologie)** : `25-Stack-Technique-v3.md:38` — _« Auth admin · Auth.js v5 (NextAuth) + 2FA TOTP »_. La mention « (NextAuth) » entre parenthèses est l'ancien nom. Lever l'ambiguïté : _« Auth.js v5 (anciennement NextAuth.js) »_. Sévérité : 🟡 mineur.
- **Écart 2 (catégorie 24, manque)** : ce document ne décrit aucun token visuel (couleur, typographie, radius). Comme c'est `25-Stack-Technique`, c'est techniquement attendu. **MAIS** il référence ligne 35 _« Animations · motion (Framer Motion light) · 15kb au lieu de 50kb »_ sans citer la signature `translate-x-[6px]` de l'ADR. Recommandation : ajouter une ligne _« Voir ADR 0001 + skill `axionia-design` pour les patterns d'animation Webflow-inspired (translate-x-6px hover) »_. Sévérité : 🟡 mineur.
- **Écart 3 (catégorie 18)** : `25-Stack-Technique-v3.md:226-233` — table double cible v2/v3 strictement alignée (LCP<1.8 / INP<80 / CLS<0.05 / JS<80kb / LH>95). 🟢 OK.
- **Cohérence catégories 9, 10, 15, 17, 19, 23** : 🟢 toutes alignées.

### 7. `Navigation-Complete-Axion-IA.md`

- **Cohérence générale** : 🟢 référentiel propre, aligné CLAUDE.md §5.
- **Aucun écart catégoriel détecté** sur les 25 catégories.
- **Note** : 61 templates × 2 langues = 340 routes au démarrage (l34) — cohérent avec catégorie 9 (multilingue).

### 8. Wireframe `00-README.md` (`Wireframes-Briefs-Axion-IA/00-README.md`)

- **Cohérence générale** : 🟠 deux écarts critiques.
- **Écart 1 (catégorie 15, 🔴 critique)** : `00-README.md:103` — _« Email : Resend (depuis le doc 14) »_. Resend est INTERDIT par `_DECISIONS-FINALES.md:92` et `CLAUDE.md:255,510`. Doit devenir : _« Email : PowerMTA + MailWizz self-hosted + Nodemailer + React Email (architecture maison VPS Hetzner) »_. Sévérité : 🔴 critique.
- **Écart 2 (catégorie 7/24, mineur)** : `00-README.md:??` mention « charte reportée » répétée dans les conventions communes (cf. fiche Phase 0 `00-fiches-lecture.md:252`). Doit devenir : « charte Webflow-inspired actée 06/05/2026 (voir ADR 0001) ». Sévérité : 🟡 mineur.
- **Cohérence catégories 1, 4, 5, 6, 9, 10, 13** : 🟢 OK.

### 9. Wireframe `01-Header-Footer.md`

- **Cohérence générale** : 🟢 mais avec **Écart 1 (catégorie 7/24)** : `01-Header-Footer.md:491` — _« E. Variables CSS (placeholder, charte reportée) »_. Doit devenir : _« E. Variables CSS (Webflow-inspired — voir ADR 0001 + skill `axionia-design`) »_. Sévérité : 🟠 moyen — c'est un placeholder fonctionnel mais qui propage l'ancienne doctrine.
- **Catégorie 4 (header sans dropdown)** : 🟢 conforme — ce wireframe est la spec officielle (5 items).
- **Catégorie 5 (footer 5 zones)** : 🟢 conforme.
- **Catégorie 18 (perf)** : `01-Header-Footer.md:552` — _« Lighthouse score > 95 mobile + desktop »_. ✅ aligné.

### 10. Wireframe `02-Page-Accueil.md`

- **Cohérence générale** : 🔴 écart critique catégorie 18.
- **Écart 1 (catégorie 18, 🔴 critique)** : `02-Page-Accueil.md:619-623` — table perf cible : _« LCP < 2.5s | INP < 100ms | CLS < 0.1 | Bundle JS first load < 100kb | Score Lighthouse perf > 90 »_. Or `_DECISIONS-FINALES.md:144-149` impose **LCP<1.8 / INP<80 / CLS<0.05 / JS<80kb / LH>95**. Égal-ement `02-Page-Accueil.md:686-688` — checklist _« LCP < 2.5s mobile 3G | CLS < 0.1 | Lighthouse perf > 90 mobile »_ idem.
- **Écart 2 (catégorie 18)** : `02-Page-Accueil.md:622` _« Bundle JS first load < 100kb »_ = 25% trop laxiste vs cible v3 < 80kb.
- **Cohérence catégories 1, 4, 5, 9, 10, 13** : 🟢.

### 11. Wireframe `03-Page-Essentielle.md`

- **Cohérence générale** : 🔴 écart critique catégorie 18 répété.
- **Écart 1 (catégorie 18)** : `03-Page-Essentielle.md:464-467` — table perf : _« LCP < 2.5s | INP < 100ms | CLS < 0.1 | Lighthouse > 90 mobile »_. Idem checklist `:535,548`. Doit cibler v3.
- **Cohérence catégorie 12 (Essentielle = offre PHARE)** : 🟢 conforme.

### 12. Wireframe `04-Calendrier-Maison.md`

- **Cohérence générale** : 🟢.
- **Écart 1 (catégorie 20, terminologie)** : selon `00-fiches-lecture.md:188`, le calendrier liste _« 4 tags Telegram : `[OPTION] / [RÉSERVATION] / [OPTION EXPIRÉE] / [OPTION CONVERTIE]` »_. Le canon CLAUDE.md:480-482 dicte `[INTERVENTION]` (pas `[RÉSERVATION]`) et `[OPTION CONFIRMÉE]` (pas `[OPTION CONVERTIE]`). Sévérité : 🟡 mineur (tags à standardiser avant code).
- **Cohérence catégorie 8 (calendrier maison vs Calendly)** : 🟢 abandonne Calendly explicitement.

### 13. Wireframe `05-Simulateur-ROI.md`

- **Cohérence générale** : 🟢.
- **Catégorie 18** : `05-Simulateur-ROI.md:462` — _« Lighthouse perf > 95 »_ ✅ aligné v3.
- Aucun écart détecté.

### 14. Wireframe `06-Formulaires-Multistep.md`

- **Cohérence générale** : 🟡.
- **Écart 1 (catégorie 18)** : `06-Formulaires-Multistep.md:615` — _« Lighthouse > 90 sur les pages avec formulaire »_. Doit devenir > 95. Sévérité : 🟠 moyen.
- **Catégorie 11 (formation banni)** : à vérifier que les libellés Step ne contiennent pas « formation » — la fiche Phase 0 indique conformité, mais relecture binaire conseillée.

### 15. Wireframe `07-Pages-Templates.md`

- **Cohérence générale** : 🔴 écart critique catégorie 18.
- **Écart 1 (catégorie 18)** : `07-Pages-Templates.md:670-673` — table perf : _« LCP < 2.5s | INP < 100ms | CLS < 0.1 | Bundle JS first load < 100kb »_. Idem checklist `:760,764`. À corriger.

### 16. Wireframe `08-Console-Admin.md`

- **Cohérence générale** : 🔴 deux écarts critiques.
- **Écart 1 (catégorie 15, 🔴 critique)** : `08-Console-Admin.md:717` — _« Email : SMTP Resend, domaine d'envoi, signature »_. Resend INTERDIT. Doit devenir : _« Email : SMTP local PowerMTA (port 2525), domaine d'envoi `mail.axion-ia.com`, signature DKIM 2048 »_. Sévérité : 🔴 critique.
- **Écart 2 (catégorie 18)** : `08-Console-Admin.md:871` — _« Lighthouse > 90 sur toutes les pages admin »_. Doit devenir > 95. Sévérité : 🟠 moyen.

### 17. `02-Charte-Graphique.docx` (binaire, attesté via fiche Phase 0)

- **Cohérence générale** : 🔴 majeur (catégorie 7 + 24).
- **Écart 1 (catégorie 24, 🔴 critique)** : selon `00-fiches-lecture.md:34-39`, le bandeau de tête dit _« charte reportée »_ et le corps décrit toujours `#1B3A6B` / `#B8922A` / `#2D7A5F`. Cette doctrine est obsolète depuis l'ADR 0001 (06/05/2026 soir). Le bandeau doit devenir : _« CHARTE WEBFLOW-INSPIRED ACTÉE — voir Design.md racine + ADR 0001-design-direction-webflow.md »_ et le corps doit être réécrit avec la palette Webflow Blue + 6 secondaires + Manrope. Sévérité : 🔴 critique car c'est _le_ document que tout designer ouvrira en premier.
- **Sub-écart (catégorie 25)** : aucune mention de Manrope ni du substitut typographique → à ajouter.

### 18. `09-Base-Donnees-Sauvegardes.docx` (binaire)

- **Cohérence générale** : 🟠.
- **Écart 1 (catégorie 3)** : `00-fiches-lecture.md:89` — ENUM type contient `audit/automatisation/intervention`. Doit être `audit/implementation/intervention`. Sévérité : 🟠 moyen — bloquant pour migration Prisma.
- **Écart 2 (catégorie 16, 🔴 critique)** : `00-fiches-lecture.md:88-90` — mention « Backblaze B2 ou AWS S3 · région EU » comme stockage secondaire. Interdiction formelle (`_DECISIONS-FINALES.md:88-92`). Doit être : _« Hetzner Storage Box BX11 (S3-compatible, UE Allemagne) »_. Sévérité : 🔴 critique.
- **Écart 3 (catégorie 8)** : `00-fiches-lecture.md:450` — champ « Calendrier maison/Cal.com ». La mention Cal.com doit être supprimée (Calendrier maison uniquement).

### 19. `10-Securite-Plateforme.docx` (binaire)

- **Cohérence générale** : 🟠.
- **Écart 1 (catégorie 22)** : `00-fiches-lecture.md:109` — mention « notification CNIL 72h ». Doit être _« notification AKI (Andmekaitse Inspektsioon) 72h — autorité estonienne »_. Sévérité : 🟠 moyen (juridique).

### 20. `11-Pages-Dedicees.docx` (binaire)

- **Cohérence générale** : 🟠.
- **Écart 1 (catégorie 11)** : `00-fiches-lecture.md:115` — Meta description `/interventions/equipes` contient « former vos équipes ». Doit utiliser « accompagner / faire monter en compétence ». Sévérité : 🟠 moyen — affecte le SEO meta.

### 21. `12-Calendly-Telegram.docx` (binaire)

- **Cohérence générale** : 🟢 ARCHIVÉ avec bandeau « ne plus utiliser » (FP0:118).
- **Écart 1 (catégorie 20)** : tags `[OPTION CONVERTIE]` à remplacer par `[OPTION CONFIRMÉE]` si encore référencés ailleurs. Sévérité : 🟡 mineur.

### 22. `13-Infrastructure-Deploiement.docx` (binaire — racine)

- **Cohérence générale** : 🔴.
- **Écart 1 (catégorie 15, 🔴 critique)** : `00-fiches-lecture.md:124-127` — section emails contradictoire « recommande Brevo / Resend / Postmark ». Tout doit basculer sur PowerMTA + MailWizz. **Note** : la version v2 (`axionia-package/docs/13-Infrastructure-v2.md`) corrige déjà — il faut soit supprimer le `.docx` racine, soit remplacer son contenu par un renvoi vers la v2.
- **Écart 2 (catégorie 16)** : `BACKUP_S3_BUCKET` obsolète, doit être `HETZNER_STORAGE_BUCKET`. Voir CLAUDE.md:565-569.
- **Écart 3 (catégorie 23)** : variables d'env listées sont l'ancien set incomplet (manque PMTA*\*, MAILWIZZ*_, REDIS*URL, NEXTAUTH*_).
- **Écart 4 (catégorie 19)** : mention GA4 / GOOGLE_ANALYTICS_ID. Doit être Plausible self-hosted.

### 23. `14-Emails-Automatiques.docx` (binaire)

- **Cohérence générale** : 🔴.
- **Écart 1 (catégorie 15, 🔴 critique)** : `00-fiches-lecture.md:131-132` — bandeau multilingue mentionne « Resend / React Email ». Doit devenir « PowerMTA + MailWizz + Nodemailer + React Email ». Sévérité : 🔴 critique.

### 24. `15-Plan-Developpement.docx` (binaire)

- **Cohérence générale** : 🟠.
- **Écart 1 (catégorie 18)** : `00-fiches-lecture.md:137` — mention « FID < 100ms » → **FID est déprécié depuis 2024** (remplacé par INP). Doit être `INP < 80ms`.
- **Écart 2 (catégorie 18)** : « LCP < 2.5s · CLS < 0.1 » → cibles v3 = LCP<1.8 / CLS<0.05.
- **Écart 3 (cat. 19)** : Google Analytics actif → Plausible.
- **Écart 4 (cat. 8)** : « 4 événements Calendly » → suppression Calendly.
- **Écart 5 (cat. 3)** : `/automatisations` résiduel → `/implementation`.
- **Écart 6 (méthodologique)** : phasage 8 phases → CLAUDE.md:709-723 = 13 phases.

### 25. `16-Copywriting-Vendeur-Complet.docx` (binaire)

- **Cohérence générale** : 🔴.
- **Écart 1 (catégorie 11, 🔴 critique)** : `00-fiches-lecture.md:143` — Hero sous-titre contient _« Axion-IA forme vos équipes »_. Verbe banni. Doit être _« Axion-IA accompagne vos équipes »_ ou _« fait monter en compétence »_. Sévérité : 🔴 critique car c'est dans le HERO de la home.

### 26. `17` à `27` `.docx` (binaires)

- **Cohérence générale** : 🟢 alignés selon FP0:147-210.
- **Écart unique (catégorie 25)** : aucun de ces docs ne mentionne Manrope. Comme la charte Webflow vient d'être actée le 06/05 soir, c'est attendu. La mise à jour de la charte (doc 02) suffira à propager.

### 27. `25-Stack-Technique.docx` (binaire — racine)

- **Cohérence générale** : 🟠.
- **Écart 1 (catégorie 15)** : `00-fiches-lecture.md:194-196` — emails listés `Resend + React Email`. Doit être PowerMTA + MailWizz + Nodemailer + React Email. **Note** : la version v3 (`axionia-package/docs/25-Stack-Technique-v3.md`) corrige déjà — supprimer le binaire racine ou pointer vers v3.
- **Écart 2 (catégorie 17)** : « NextAuth.js 5 » → « Auth.js v5 ».
- **Écart 3 (catégorie 18)** : « LCP<2.5 / INP<100 / CLS<0.1 / JS<100kb » → seuils v3.
- **Écart 4 (catégorie 5)** : « Framer Motion 11+ » → « motion (Framer Motion light) ». 🟡 mineur (terminologie).

### 28. `28-Pages-Legales.docx` (binaire)

- **Cohérence générale** : 🟡.
- **Écart 1 (catégorie 15)** : `00-fiches-lecture.md:215-217` — destinataires politique conf. mentionnent « Resend EU region ». Doit être _« PowerMTA self-hosted Hetzner Frankfurt + MailWizz self-hosted »_. Sévérité : 🟠 moyen.

### 29. `29-Internationalisation.docx` (binaire)

- **Cohérence générale** : 🟢 (FP0:219-225).

### 30. `30-Page-A-Propos.docx` (binaire)

- **Cohérence générale** : 🔴.
- **Écart 1 (catégorie 11, 🔴 critique)** : `00-fiches-lecture.md:230-231` — sous-titre contient _« former leurs équipes »_. Verbe banni. Doit être _« accompagner leurs équipes »_. Sévérité : 🔴 critique.

### 31. `31-CGV-Politique-Deplacement.docx` (binaire)

- **Cohérence générale** : 🔴.
- **Écart 1 (catégorie 21, 🔴 critique)** : `00-fiches-lecture.md:238-239` — _« Tribunal compétent : Saint-Étienne (42), droit français »_. Contradiction critique avec CLAUDE.md:37-41 (OÜ estonienne). Doit devenir : _« Tribunal compétent : Harju Maakohus (Tallinn), droit estonien — clause d'arbitrage CCI Tallinn pour litiges B2B internationaux »_. Sévérité : 🔴 critique — un contrat sous mauvaise juridiction est inopposable.
- **Écart 2 (catégorie 2)** : présence de mentions « SIREN » à vérifier (FP0:38-41 indique 0 mention SIREN dans le pack mais pour ce doc 31 historique français, à relire binairement avant code).

### 32. `32-Guide-Utilisation.docx` (binaire)

- **Cohérence générale** : 🟢 méta-document, indique CLAUDE.md fait foi (FP0:243-245).
- **Écart 1 (catégorie 24/25)** : à mettre à jour pour citer ADR 0001 + Design.md racine + skill `axionia-design` réécrit. Sévérité : 🟡 mineur.

### 33. Documents skills surplus / skills mégapack obsolètes

> Ces fichiers ne sont pas dans la liste explicite du prompt, mais _contredisent activement_ les sources de vérité. À traiter en P1.

- **`axionia-megapack-skills/.claude/skills/axionia-design/SKILL.md:3,22`** — frontmatter description dit _« style B2B premium type McKinsey/Roland Berger... charte reportée »_. **Doctrine ENTIÈREMENT obsolète**. Recommandation : soit synchroniser avec la version `axionia-package/.claude/skills/axionia-design/SKILL.md` (qui est correcte, voir ligne 10 : _« Cette doctrine remplace l'ancienne référence McKinsey/Roland Berger »_), soit archiver le mégapack (qui est de toute façon un sous-ensemble strict du pack — voir FP0:401-402). Sévérité : 🟠 moyen. **Catégorie 24, critique pour cohérence**.
- **`axionia-megapack-skills/.claude/skills/README.md:18`** — _« charte reportée, etc. »_. À mettre à jour ou archiver. 🟡 mineur.
- **`axionia-package/README.md:68`** — _« axionia-design · Charte visuelle CSS variables (B2B McKinsey/Roland Berger) »_. Doit devenir _« Charte visuelle Webflow-inspired CSS variables — voir Design.md + ADR 0001 »_. Sévérité : 🟠 moyen.
- **`axionia-package/README.md:133`** — _« community-marketing (Discord/Slack ne colle pas au positionnement McKinsey) »_. La justification reste valable mais l'ancrage McKinsey est obsolète. Reformuler : _« Discord/Slack ne colle pas au positionnement cabinet IA premium B2B Axion-IA »_. 🟡 mineur.
- **`axionia-package/.agents/product-marketing-context.md:15,114-125,214`** — multiples références _« McKinsey/Roland Berger »_. Ce fichier est consommé par les skills marketing pour l'ICP / positionnement → à harmoniser avec « cabinet IA premium B2B » sans nommer McKinsey. Sévérité : 🟠 moyen.
- **`axionia-package/.claude/skills/axionia-core/SKILL.md:160-161,209`** — mentions _« sobriété B2B McKinsey, 80% blanc, pas de gradients »_ dans la section méta « comment combiner skills externes ». Reformuler en termes neutres alignés Webflow-inspired (« 80% blanc canvas dominant, single-accent Webflow Blue, pas de gradients gratuits »). Sévérité : 🟡 mineur.
- **`axionia-package/.claude/skills/seo-hreflang/references/cultural-profiles.md:32`** — _« CNIL (data protection) »_ dans le profil EU. Acceptable car c'est la _connaissance générale_ (la France utilise CNIL), mais pour Axion-IA l'autorité est AKI. Recommandation : ajouter au repo une note d'override projet _« Axion-IA → AKI Estonie, pas CNIL »_ dans `axionia-rgpd/SKILL.md` (déjà fait, l16) ✅.

---

## Score global de conformité

### Vue chiffrée (sur les 25 catégories)

| Statut              | Nb catégories | %    | Catégories                                                   |
| ------------------- | ------------- | ---- | ------------------------------------------------------------ |
| 🟢 Vertes           | 7             | 28 % | 1, 5, 6, 9, 10, 12, 13                                       |
| 🟡 Jaunes           | 6             | 24 % | 2, 8, 14, 17, 20, 25                                         |
| 🟠 Oranges          | 8             | 32 % | 3, 4, 11, 16, 19, 22, 23 + (sous-cat. 25)                    |
| 🔴 Rouges critiques | 4             | 16 % | 7/24 (charte historique), 15 (Resend), 18 (perf), 21 (droit) |

**Conformité générale : 28 % strictement vertes · 52 % à corrections mineures-moyennes · 16 % critiques bloquant le code.**

### Verdict

Le pack v10.1 est **stratégiquement cohérent** (identité OÜ, modules, tarifs, URLs, mobile-first, header épuré, multilingue, Hetzner). Les **5 contradictions critiques** sont les mêmes qu'en Phase 0 §6 (Resend, droit français des CGV, mot « formation » résiduel, perf budgets v2 dans wireframes), enrichies des **2 nouveaux blocs Webflow** (catégorie 24 + 25) qui requièrent une mise à jour systématique du doc 02 et de plusieurs README/skills.

---

## Plan de correction priorisé

### P0 — Critique (à corriger AVANT tout code)

> Bloque le démarrage du sprint 0 car contredit directement les sources de vérité.

1. **Wireframe `00-README.md:103`** — supprimer la mention « Resend » et la remplacer par l'architecture PowerMTA+MailWizz+Nodemailer+React Email (catégorie 15).
2. **Wireframe `08-Console-Admin.md:717`** — supprimer « SMTP Resend » et remplacer par « SMTP local PowerMTA (port 2525) + DKIM 2048 ». (catégorie 15).
3. **Wireframes `02-Page-Accueil.md:619-688`, `03-Page-Essentielle.md:464-548`, `07-Pages-Templates.md:670-764`** — basculer toutes les cibles perf de v2 (LCP<2.5/INP<100/CLS<0.1/JS<100kb/LH>90) vers **v3 (LCP<1.8 / INP<80 / CLS<0.05 / JS<80kb / LH>95)** (catégorie 18).
4. **Doc 31 (CGV) `.docx`** — réécrire la clause « Tribunal compétent / droit applicable » : remplacer _« Tribunal Saint-Étienne · droit français »_ par _« Harju Maakohus (Tallinn) · droit estonien »_ (catégorie 21).
5. **Doc 02 (Charte Graphique) `.docx`** — mettre à jour le bandeau (« charte reportée » → « charte Webflow-inspired actée 06/05/2026 ADR 0001 ») et réécrire le corps avec la palette Webflow + Manrope. Supprimer toute référence à `#1B3A6B / #B8922A / #2D7A5F` (catégories 7 + 24).
6. **Doc 16 (Copywriting Vendeur)** + **Doc 30 (À Propos)** — supprimer les verbes « former / forme » dans les sous-titres Hero (catégorie 11 critique car visible publiquement).
7. **Doc 09 (BDD)** — corriger ENUM `automatisation` → `implementation`, supprimer « Backblaze B2 / AWS S3 », supprimer mention « Cal.com » (catégories 3 + 16 + 8).
8. **Doc 14 (Emails)** — bandeau multilingue passer de « Resend / React Email » à « PowerMTA + MailWizz + Nodemailer + React Email » (catégorie 15).
9. **Design.md racine `:5,47,81-83`** — ajouter une note bloc explicite _« WF Visual Sans Variable est propriétaire Webflow ; production = Manrope (Google Fonts gratuite) »_ (catégorie 25).

### P1 — Cohérence (à corriger pendant le sprint 0 / avant Phase 4 frontend)

10. **Wireframe `01-Header-Footer.md:491`** — remplacer _« Variables CSS (placeholder, charte reportée) »_ par référence ADR 0001 + Webflow tokens (catégorie 24).
11. **Doc 13 binaire racine** — soit supprimer, soit remplacer par un renvoi vers `axionia-package/docs/13-Infrastructure-v2.md` (catégories 15 + 16 + 19 + 23).
12. **Doc 25 binaire racine** — soit supprimer, soit remplacer par un renvoi vers `axionia-package/docs/25-Stack-Technique-v3.md` (catégories 15 + 17 + 18).
13. **Doc 10 (Sécurité)** — remplacer « notification CNIL 72h » par « notification AKI (Andmekaitse Inspektsioon) 72h » (catégorie 22).
14. **Doc 11 (Pages dédiées)** — corriger Meta description `/interventions/equipes` (catégorie 11 SEO).
15. **Doc 15 (Plan Développement)** — remplacer FID par INP, durcir cibles perf, supprimer Calendly, supprimer GA4, basculer `/automatisations`→`/implementation`, harmoniser sur 13 phases (catégories 8 + 18 + 19 + 3).
16. **Doc 28 (Pages légales)** — supprimer mention « Resend EU region » dans destinataires politique conf. (catégorie 15).
17. **Wireframes `06-Formulaires-Multistep.md:615` + `08-Console-Admin.md:871`** — Lighthouse > 90 → > 95 (catégorie 18).
18. **Wireframe `04-Calendrier-Maison.md`** — harmoniser tags Telegram : `[RÉSERVATION]` → `[INTERVENTION]`, `[OPTION CONVERTIE]` → `[OPTION CONFIRMÉE]` (catégorie 20).
19. **CLAUDE.md:91-93** — supprimer la traduction « Corporate AI training sessions » (mot « training » proche de « formation ») au profit d'une formulation neutre comme _« Corporate AI sessions »_ (catégorie 11).
20. **CLAUDE.md:713 §19 Phase 3** — remplacer _« palette neutre »_ par _« design system Webflow-inspired (Webflow Blue + 6 secondaires + Manrope + tokens CSS variables) »_ (catégorie 24).
21. **Mégapack `axionia-megapack-skills/`** — DÉCISION : archiver intégralement (sous-ensemble strict du pack travaillé, source d'incohérence Webflow / charte reportée). Voir FP0:400-402.
22. **`axionia-package/README.md:68,133`** — basculer la description `axionia-design` vers Webflow-inspired et reformuler la justification anti-`community-marketing` (catégorie 24 + cosmétique).
23. **`axionia-package/.agents/product-marketing-context.md:15,114-125,214`** — neutraliser les références McKinsey/Roland Berger qui sont devenues obsolètes (catégorie 24).
24. **`axionia-package/.claude/skills/axionia-core/SKILL.md:160-161,209`** — reformuler en termes Webflow-inspired (catégorie 24).
25. **`Design.md:77,85`** — ajouter le breakpoint 1280px pour parité avec ADR 0001:47 (catégorie 24).

### P2 — Hygiène (à corriger Phase 1.S puis en continu)

26. **`_DECISIONS-FINALES.md:5`** — extraire l'addendum Webflow du bandeau et ajouter une section structurée `## 🎨 Direction visuelle (Webflow-inspired)` avec tables tokens / typo / radius / shadow / animation / breakpoints. Améliorerait la trouvabilité (catégorie 24).
27. **`_DECISIONS-FINALES.md:228`** — corriger « Skills projet sur-mesure (10) » → « (11) » (cosmétique).
28. **`25-Stack-Technique-v3.md:38`** — ajouter _« (anciennement NextAuth.js) »_ après « Auth.js v5 » (catégorie 17 cosmétique).
29. **`13-Infrastructure-v2.md:152-208`** — compléter le set de variables d'env pour parité avec CLAUDE.md:526-592 (`APP_AVAILABLE_LOCALES`, `CALENDAR_*`, `COMPANY_DPO_EMAIL`, `COMPANY_REGISTRATION_NUMBER`) (catégorie 23).
30. **Audit textuel projet** — exécuter le check ADR 0001:79 :
    ```
    grep -ri "sobriété McKinsey\|Roland Berger\|charte reportée"
    ```
    et corriger jusqu'à 0 résultat. Aujourd'hui : ~10+ occurrences (voir §33 ci-dessus).
31. **Doc 32 (Guide d'utilisation)** — ajouter référence ADR 0001 + skill `axionia-design` réécrit + Design.md racine dans l'ordre de lecture (catégorie 24).
32. **Doc 23 (Simulateur ROI)** : OK Phase 0, à revérifier que les copies n'utilisent jamais « formation ».
33. **Doc 24 (Calendrier Réservation)** : harmoniser nommage tags Telegram avec CLAUDE.md:480-482 (catégorie 20).

---

## Notes finales

### Données non vérifiables sans relecture binaire des docx

Les écarts attestés via `00-fiches-lecture.md` proviennent d'une extraction `python-docx` réalisée en Phase 0. Pour les corrections P0 sur `02-Charte-Graphique.docx`, `09-Base-Donnees.docx`, `13-Infrastructure-Deploiement.docx`, `14-Emails-Automatiques.docx`, `15-Plan-Developpement.docx`, `16-Copywriting-Vendeur.docx`, `25-Stack-Technique.docx`, `28-Pages-Legales.docx`, `30-Page-A-Propos.docx`, `31-CGV-Politique-Deplacement.docx`, une **passe binaire** sera nécessaire pour repérer la position exacte (paragraphe, run, table) du texte à corriger. Cette passe est hors-scope de la Phase 1 (lecture seule) et fera l'objet de la Phase 2 ou d'un sprint v10.2 dédié.

### Contradictions historiques non encore couvertes par les 25 catégories

- **Mégapack vs pack travaillé** : 88 vs 103 skills → décision d'archivage à acter (FP0:400-402). Catégorie « hygiène repo » non listée dans les 25.
- **Skills surplus** : 6 skills `axionia-*` ajoutés au pack (a11y, admin-ux, calendar, monitoring, performance, rgpd, testing) au-delà des 11 listés dans `_DECISIONS-FINALES.md:230-242`. À valider en Phase 1.S (FP0:386-398).
- **Phasage 8 vs 13** : doc 15 (8 phases) vs CLAUDE.md:709-723 (13 phases) → résolution P1.

### Nouvelles catégories Webflow — état des lieux

- **Catégorie 24 (Webflow-inspired direction)** : actée par ADR 0001 + Design.md + CLAUDE.md v6 + addendum `_DECISIONS-FINALES.md:5` + skill `axionia-design` réécrit (`axionia-package/.claude/skills/axionia-design/SKILL.md:10`). **Mais propagation incomplète** sur ~10 fichiers (mégapack, README, product-marketing-context, doc 02 binaire, wireframe 01-Header-Footer L491, CLAUDE.md L713 §19, axionia-core L160-161-209). Statut global : 🔴 critique.
- **Catégorie 25 (Manrope)** : actée par CLAUDE.md:271 + ADR 0001:40 + skill `axionia-design`. **Mais Design.md racine ne signale pas le substitut** au lecteur ne lisant pas l'ADR. Statut global : 🟠 moyen.

### Ce qui est solide

- Domaine, OÜ estonienne, 3 modules, prix, mobile-first, hébergement Hetzner, multilingue FR+EN, footer 5 zones, header 5 items, simulateur ROI, calendrier maison 3 états — toutes ces bases sont **alignées sans contradiction interne** dans les sources de vérité v6.
- `_DECISIONS-FINALES.md` reste effectivement la source de vérité ULTIME comme proclamé en `CLAUDE.md:6-7`.

---

_— Phase 1 livrée · 06/05/2026 · 33 docx + 9 wireframes-briefs + 4 docs racine + 1 navigation + 1 Design.md + 1 ADR audités · 25 catégories × N fichiers croisés · 16 contradictions Phase 0 confirmées et étendues à 33 entrées avec 2 nouvelles catégories Webflow · READ-ONLY respecté._
