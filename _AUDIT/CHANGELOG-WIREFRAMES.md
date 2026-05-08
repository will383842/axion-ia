# CHANGELOG Wireframes — Corrections P0 audit Phase 1

**Date** : 2026-05-06
**Scope** : application des corrections P0 détectées par l'audit Phase 1 sur les briefs wireframes AxionIA
**Référentiels cités dans les nouveaux textes** : `axionia-emails`, `axionia-performance`, `axionia-design`, ADR 0001 du 06/05/2026 (`_DECISIONS-FINALES.md`).

---

## Fix 1 — `00-README.md` : Resend → PowerMTA + MailWizz

### `00-README.md:103`

- **Avant** :
  ```
  - **Email** : Resend (depuis le doc 14)
  ```
- **Après** :
  ```
  - **Email** : **PowerMTA + MailWizz self-hosted + Nodemailer + React Email** (cf. `axionia-emails`). Resend INTERDIT (abandonné le 06/05/2026, ADR 0001).
  ```

### `00-README.md:54` — bonus alignement charte (Fix 7)

- **Avant** :
  ```
  ⚠️ **Charte reportée** — toutes les valeurs colorées sont des placeholders neutres dans des variables CSS :
  ```
- **Après** :
  ```
  ✅ **Charte Webflow-inspired actée 06/05/2026 (ADR 0001)** — direction visuelle Webflow-inspired, palette Webflow Blue #146ef5 + 6 secondaires, typographie Manrope (cf. `axionia-design`). Les variables CSS ci-dessous restent encore neutres dans les wireframes ; elles seront migrées vers la charte définitive lors de l'implémentation :
  ```

---

## Fix 2 — `08-Console-Admin.md` : Resend résiduel (settings admin)

### `08-Console-Admin.md:717`

- **Avant** :
  ```
  - **Email** : SMTP Resend, domaine d'envoi, signature
  ```
- **Après** :
  ```
  - **Email** : SMTP PowerMTA self-hosted (transactionnel via Nodemailer + React Email) + MailWizz (campagnes newsletter), domaine d'envoi, signature DKIM/SPF/DMARC/BIMI (cf. `axionia-emails`). Resend INTERDIT.
  ```

### `08-Console-Admin.md:871` — bonus alignement perf (Fix 7)

- **Avant** :
  ```
  - [ ] Lighthouse > 90 sur toutes les pages admin
  ```
- **Après** :
  ```
  - [ ] Lighthouse > 95 sur toutes les pages admin · LCP < 1.8s · INP < 80ms · CLS < 0.05 · JS first load < 80kb (cf. `axionia-performance` + ADR Webflow-inspired 06/05/2026)
  ```

---

## Fix 3 — `02-Page-Accueil.md` : Perf budgets v2 → v3

### `02-Page-Accueil.md:617-623` (table perf)

- **Avant** :
  ```
  | LCP | < 2.5s | < 1.2s |
  | INP | < 100ms | < 50ms |
  | CLS | < 0.1 | < 0.05 |
  | Bundle JS first load | < 100kb | < 100kb |
  | Score Lighthouse perf | > 90 | > 95 |
  ```
- **Après** :

  ```
  | LCP | < 1.8s | < 1.0s |
  | INP | < 80ms | < 50ms |
  | CLS | < 0.05 | < 0.05 |
  | Bundle JS first load | < 80kb | < 80kb |
  | Score Lighthouse perf | > 95 | > 95 |

  > Budgets v3 Webflow-inspired (cf. `axionia-performance` + ADR `_DECISIONS-FINALES.md` du 06/05/2026).
  ```

### `02-Page-Accueil.md:686-688` (checkpoint livraison)

- **Avant** :
  ```
  - [ ] LCP < 2.5s mobile 3G
  - [ ] CLS < 0.1
  - [ ] Lighthouse perf > 90 mobile
  ```
- **Après** :
  ```
  - [ ] LCP < 1.8s mobile 3G · INP < 80ms · CLS < 0.05 · JS first load < 80kb · Lighthouse > 95 (cf. `axionia-performance` + ADR `_DECISIONS-FINALES.md` Webflow-inspired du 06/05/2026)
  ```

---

## Fix 4 — `03-Page-Essentielle.md` : Perf budgets v2 → v3

### `03-Page-Essentielle.md:462-467` (table perf)

- **Avant** :
  ```
  | LCP | < 2.5s | < 1.2s |
  | INP | < 100ms | < 50ms |
  | CLS | < 0.1 | < 0.05 |
  | Score Lighthouse | > 90 mobile | > 95 desktop |
  ```
- **Après** :

  ```
  | LCP | < 1.8s | < 1.0s |
  | INP | < 80ms | < 50ms |
  | CLS | < 0.05 | < 0.05 |
  | Bundle JS first load | < 80kb | < 80kb |
  | Score Lighthouse | > 95 mobile | > 95 desktop |

  > Budgets v3 Webflow-inspired (cf. `axionia-performance` + ADR `_DECISIONS-FINALES.md` du 06/05/2026).
  ```

### `03-Page-Essentielle.md:535` (checkpoint LCP)

- **Avant** :
  ```
  - [ ] LCP < 2.5s mobile 3G (pas affecté par le simulateur)
  ```
- **Après** :
  ```
  - [ ] LCP < 1.8s mobile 3G · INP < 80ms · CLS < 0.05 · JS first load < 80kb (pas affecté par le simulateur, cf. `axionia-performance` + ADR Webflow-inspired du 06/05/2026)
  ```

### `03-Page-Essentielle.md:548` (checkpoint Lighthouse)

- **Avant** :
  ```
  - [ ] Lighthouse > 90 mobile
  ```
- **Après** :
  ```
  - [ ] Lighthouse > 95 mobile (cf. `axionia-performance`)
  ```

---

## Fix 5 — `07-Pages-Templates.md` : Perf budgets v2 → v3

### `07-Pages-Templates.md:668-673` (table perf)

- **Avant** :
  ```
  | LCP | < 2.5s |
  | INP | < 100ms |
  | CLS | < 0.1 |
  | Bundle JS first load | < 100kb |
  ```
- **Après** :

  ```
  | LCP | < 1.8s |
  | INP | < 80ms |
  | CLS | < 0.05 |
  | Bundle JS first load | < 80kb |
  | Score Lighthouse | > 95 |

  > Budgets v3 Webflow-inspired (cf. `axionia-performance` + ADR `_DECISIONS-FINALES.md` du 06/05/2026).
  ```

### `07-Pages-Templates.md:760` (checkpoint LCP)

- **Avant** :
  ```
  - [ ] LCP < 2.5s mobile 3G
  ```
- **Après** :
  ```
  - [ ] LCP < 1.8s mobile 3G · INP < 80ms · CLS < 0.05 · JS first load < 80kb (cf. `axionia-performance` + ADR Webflow-inspired du 06/05/2026)
  ```

### `07-Pages-Templates.md:764` (checkpoint Lighthouse)

- **Avant** :
  ```
  - [ ] Lighthouse > 90 mobile
  ```
- **Après** :
  ```
  - [ ] Lighthouse > 95 mobile (cf. `axionia-performance`)
  ```

---

## Fix 6 — `01-Header-Footer.md` : charte Webflow-inspired cohérence

### `01-Header-Footer.md:491` (titre section CSS)

- **Avant** :
  ```
  ## E. Variables CSS (placeholder, charte reportée)
  ```
- **Après** :
  ```
  ## E. Variables CSS (placeholder, charte Webflow-inspired actée 06/05/2026 — ADR 0001)
  ```

### `01-Header-Footer.md:525` (note charte)

- **Avant** :
  ```
  ⚠️ **Charte reportée** — ces variables sont des placeholders neutres. Quand Will validera la charte, on changera UNIQUEMENT les valeurs des variables, pas le code des composants.
  ```
- **Après** :
  ```
  ✅ **Charte Webflow-inspired actée 06/05/2026 (ADR 0001)** — Webflow Blue #146ef5 + 6 secondaires + Manrope (cf. `axionia-design`). Les variables ci-dessus sont des placeholders neutres dans le wireframe ; les valeurs définitives Webflow Blue + secondaires seront injectées lors de l'implémentation. Le code des composants ne change pas, seules les valeurs des variables.
  ```

### `01-Header-Footer.md:552` (checkpoint Lighthouse)

- **Avant** :
  ```
  - [ ] Lighthouse score > 95 mobile + desktop
  ```
- **Après** :
  ```
  - [ ] Lighthouse score > 95 mobile + desktop · LCP < 1.8s · INP < 80ms · CLS < 0.05 · JS first load < 80kb (cf. `axionia-performance` + ADR Webflow-inspired 06/05/2026)
  ```

---

## Fix 7 — Uniformisation transverse (briefs 05, 06)

### `05-Simulateur-ROI.md:462` (checkpoint Lighthouse)

- **Avant** :
  ```
  - [ ] Lighthouse perf > 95
  ```
- **Après** :
  ```
  - [ ] Lighthouse perf > 95 · LCP < 1.8s · INP < 80ms · CLS < 0.05 · JS first load < 80kb (cf. `axionia-performance` + ADR Webflow-inspired 06/05/2026)
  ```

### `06-Formulaires-Multistep.md:615` (checkpoint Lighthouse)

- **Avant** :
  ```
  - [ ] Lighthouse > 90 sur les pages avec formulaire
  ```
- **Après** :
  ```
  - [ ] Lighthouse > 95 sur les pages avec formulaire · LCP < 1.8s · INP < 80ms · CLS < 0.05 · JS first load < 80kb (cf. `axionia-performance` + ADR Webflow-inspired 06/05/2026)
  ```

---

## Vérifications négatives

Recherches exhaustives sur l'ensemble du dossier `Wireframes-Briefs-AxionIA/` post-correction :

| Pattern                                                                            | Résultat                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Resend` (hors mentions « Resend INTERDIT » conservées comme garde-fou historique) | aucune occurrence active                                            |
| `GA4` / `Google Analytics`                                                         | aucune occurrence (Plausible déjà en place dans `00-README.md:104`) |
| `Inter Display` / `DM Sans` / `Instrument Serif`                                   | aucune occurrence                                                   |
| `McKinsey` / `Roland Berger`                                                       | aucune occurrence                                                   |
| `charte reportée` / `sobriété`                                                     | aucune occurrence active (remplacée par mention Webflow-inspired)   |

**Briefs non modifiés** :

- `04-Calendrier-Maison.md` : aucune mention impactée par les fixes (pas de table perf budgets, pas de Resend, pas de mention charte).

---

## Résumé exécutif

- **9 fichiers** dans le dossier wireframes (00 à 08).
- **8 fichiers modifiés** (00, 01, 02, 03, 05, 06, 07, 08).
- **1 fichier intact** (04-Calendrier-Maison.md, rien à corriger).
- **17 éditions ciblées** au total, aucune réécriture intégrale.
- Tous les nouveaux textes citent explicitement les référentiels canoniques : `axionia-emails`, `axionia-performance`, `axionia-design`, ADR 0001 (`_DECISIONS-FINALES.md`) du 06/05/2026.
