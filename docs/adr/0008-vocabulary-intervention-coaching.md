# ADR 0008 — Vocabulaire : « formation » → « intervention coaching »

> **Note de numérotation** : initialement assigné 0007, renommé 0008 pour éviter collision avec `0007-typography-hierarchy-v3-2.md` (working copy Will commitée en parallèle 2026-05-08).

- **Statut** : accepted
- **Date** : 2026-05-08
- **Auteur** : Will (décision directe) — formalisation Claude Opus 4.7
- **Amende** : `0003-lift-formation-ban.md` (gate CI retiré 2026-05-07 reste retiré, mais convention éditoriale **plus stricte que jamais**)
- **ADRs liées** : `0003-lift-formation-ban.md` (cet ADR remplace la lecture « tout est autorisé » par « tout doit être remplacé »)

---

## Contexte

ADR 0003 (2026-05-07) a retiré le check CI `anti-formation` pour permettre la refonte du module Interventions B2B avec un vocabulaire commercial standard. La conséquence implicite était que le mot « formation » devenait autorisé partout. **Ce n'est PAS l'intention.**

2026-05-08, Will tranche : « formation doit être remplacé par intervention coaching ». La convention éditoriale est désormais explicite et plus stricte que sous l'ADR 0003 :

- **Avant ADR 0003** : « formation » INTERDIT, gate CI bloquant.
- **ADR 0003 (2026-05-07)** : gate CI retiré, vocabulaire commercial réintégré sans direction précise.
- **ADR 0008 (2026-05-08, ce document)** : « formation » doit être **systématiquement remplacé** par « intervention coaching » dans tout copy / slug / commit / meta / JSON-LD / fixture / seed / doc publique. Pas de gate CI ré-ajouté (volontaire — la convention est éditoriale, pas mécanique), mais le respect est attendu.

## Décision

### Table de remplacement canonique

| À remplacer   | À utiliser                                                               |
| ------------- | ------------------------------------------------------------------------ |
| **formation** | **intervention coaching**                                                |
| formateur     | intervenant coach (ou « intervenant » si contexte clair)                 |
| former        | accompagner / faire monter en compétence (ou « coacher » selon contexte) |
| formé(e)      | accompagné(e) / opérationnel(le)                                         |

### Variantes contextuelles acceptables

- « intervention IA » (au lieu de « formation IA »)
- « cabinet conseil » (au lieu de « cabinet de formation »)
- « atelier IA » (au lieu de « formation atelier »)
- « accompagnement IA » (générique)

### Périmètre d'application

| Surface                                                             | Application                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| Copy public (`messages/fr.json`, `messages/en.json`)                | **OBLIGATOIRE**                                       |
| Slugs publics (URLs)                                                | **OBLIGATOIRE**                                       |
| JSON-LD (Service.name, FAQPage answers, Article.body)               | **OBLIGATOIRE**                                       |
| Meta (title, description, OG)                                       | **OBLIGATOIRE**                                       |
| Content modules (`src/content/*.ts`)                                | **OBLIGATOIRE**                                       |
| Fixtures de test                                                    | **OBLIGATOIRE**                                       |
| Seeds Prisma                                                        | **OBLIGATOIRE**                                       |
| Commits Conventional                                                | **OBLIGATOIRE**                                       |
| Documentation (`_AUDIT/`, `axionia/`, skills `axionia-*`)           | **OBLIGATOIRE** sauf citations historiques explicites |
| Bible historique `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 | NON modifiée (source figée — décision Will préalable) |

### Pas de gate CI

Volontairement, **aucun script `check-vocabulary.sh` ou équivalent n'est ajouté**. La discipline est éditoriale. ADR 0003 reste valide : le gate CI `anti-formation` reste retiré.

Si dérive constatée à l'usage, un gate CI pourra être ré-introduit via un ADR ultérieur (`0008-vocabulary-ci-gate.md` hypothétique).

## Conséquences

### Positives

- Branding « cabinet IA opérationnel » et « intervention coaching » cohérents avec le positionnement B2B premium (vs « formation » qui évoque organisme de formation classique).
- SEO long-tail : « intervention coaching IA » est une niche moins saturée que « formation IA ».
- Distinction claire avec les organismes de formation Qualiopi (Axion-IA OÜ ne souhaite pas s'inscrire dans ce cadre réglementaire).

### Négatives / À surveiller

- **Sweep nécessaire** sur le code HEAD (`src/`, `messages/`, `content/`) pour appliquer la convention. Hors scope DOC-SYNC V14 (lecture seule code) — à effectuer Sprint 15 ou commit dédié.
- **Risque d'inconsistance** sans gate CI : à monitorer en Pass B Sprint 23 (`PROMPT-VERIFICATION-FINALE.md`).
- **Documents périmés** : tous les docs `_AUDIT/` patchés DOC-SYNC V14 référencent désormais « intervention coaching ». ADR 0003 reste valide mais doit être lu avec ADR 0008.

## Implémentation

### Côté docs (effectué 2026-05-08 par DOC-SYNC V14)

- `_DECISIONS-FINALES.md` : section « formation banni » mise à jour avec convention.
- 5 skills `axionia-*` patchés (core, content-models, design, seo-aeo, README).
- Mémoire `axionia_progress.md` : ligne ADR 0008 ajoutée.
- `axionia/CHANGELOG.md` : entrée ADR 0008.

### Côté code (à effectuer Sprint 15+)

- Sweep `axionia/src/content/*.ts` : remplacer les occurrences résiduelles « formation » par « intervention coaching ».
- Sweep `axionia/messages/fr.json` + `en.json` : idem.
- Sweep slugs `axionia/src/i18n/routing.ts` : si une route contenait « formation » (probablement aucune côté HEAD `fd91518`).
- Vérifier JSON-LD : `Service.name`, `FAQPage.mainEntity[].name`, `Article.body` cf. `src/lib/seo.ts`.

### Pas d'action automatique

- Aucun script de remplacement automatique massif (`sed`) ne sera lancé sans review humaine — risque de casser des phrases.

## Liens

- ADR 0003 — Lift formation ban (`0003-lift-formation-ban.md`)
- `_DECISIONS-FINALES.md` § Ban Stripe + interdits (révisé 2026-05-08)
- Skill `axionia-core/SKILL.md` § 1 Lexique convention
- Mémoire `axionia_progress.md` ligne ADR 0008
