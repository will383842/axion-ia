# Profil canonique Manon — persona éditoriale Axion-IA (v2.1)

> Seed pour table Prisma `AuthorProfile[slug=manon]` (cf. § 12.1bis master). Ingéré Sprint 1.
> **Doctrine Will acté 2026-05-14 : Option A — Transparence totale + photo IA disclosed (v2.1).** Manon est une persona éditoriale fictive sous laquelle signe l'équipe éditoriale d'Axion-IA + le processus de production IA supervisé. Pas un imposteur d'une vraie personne. Pas de fake LinkedIn / fake Twitter. Transparence revendiquée.
> **v2.1 (2026-05-14)** : Will a fourni un portrait IA générée (`/auteurs/manon.png`) au lieu des Options 1/2/3 originales. La photo est explicitement marquée `aiGenerated: true` + disclaimer transparent partout (alt, caption, JSON-LD description, page `/fr/equipe/manon`).

## Pourquoi un persona transparent ?

- Cohérent avec doctrine HCU 2024 « people-first content » : signature humaine + processus transparent = mieux qu'une signature vague type « la rédaction »
- Cohérent avec AI Act 2026 : signal honnête sur l'usage de l'IA dans la chaîne de production
- Cohérent avec Anthropic / OpenAI guidelines : disclosure honest d'AI assistance
- Évite les risques légaux (pas d'usurpation d'identité, pas de faux profil social)
- Réduit le risque SEO (Google détecte mal mais sanctionne fortement les profils auteurs frauduleux quand détectés)

## 1. Identité

```json
{
  "slug": "manon",
  "displayName": "Manon",
  "jobTitle": "Plume éditoriale d'Axion-IA",
  "isPersona": true,
  "isActive": true
}
```

→ Pas de nom de famille. Pas d'« avocate Manon X. ». Juste « Manon ».

## 2. Photo — Portrait IA disclosed (v2.1, choix Will 2026-05-14)

**Doctrine v2.1** : la photo est un **portrait synthétique généré par IA**, présenté avec disclaimer explicite partout. Pas une vraie personne (pas d'usurpation d'identité), pas une image trouvée sur Internet (pas de copyright tiers). Disclosure transparente conforme AI Act 2026 et HCU Google 2024.

### Option visuelle retenue (Will 2026-05-14) — Option 4 « Portrait IA disclosed »

- **Source** : `axionia/public/auteurs/manon.png` (1024×1024 PNG, fourni par Will 2026-05-14)
- **Caractéristiques** : visage féminin souriant, intérieur clair avec étagère + plantes, tons chauds compatibles palette terracotta/crème
- **`aiGenerated: true`** dans `AuthorProfile`
- **Variantes runtime** : Next/image génère AVIF 80 / 256 / 1024 automatiquement via `<Image>` (formats `image/avif`, `image/webp` configurés `next.config.ts`)

### Disclaimers OBLIGATOIRES (à appliquer partout côté code)

1. **Alt text** : `« Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA »`
2. **Caption visuelle** sous la photo sur `/fr/equipe/manon` : `« Illustration générée par IA. Manon est une persona éditoriale ; sous ce nom signe notre équipe + processus IA supervisé. »`
3. **Person JSON-LD `description`** : reprendre disclaimer transparent (cf. § 7)
4. **Meta `<meta name="ai-generated-image" content="true">`** sur la page auteur (proposé spec 2026, non bloquant)
5. **AuthorByline tooltip** : « Voir notre processus éditorial » → menu déroulant + disclaimer

### Options 1/2/3 archivées (non retenues)

- ~~Option 1 illustration symbolique workspace~~ — pas choisie
- ~~Option 2 avatar SVG monogramme M~~ — pas choisie
- ~~Option 3 silhouette / dos / mains~~ — pas choisie
- ✅ **Option 4 portrait IA disclosed** — RETENUE 2026-05-14

Sprint 1 Day 1 : ingestion seed → `AuthorProfile.photoUrl80/256/1024 = "/auteurs/manon.png"` (Next/image gère resize), `AuthorProfile.aiGenerated = true`, `AuthorProfile.personaDisclaimer` enrichi avec mention IA.

## 3. Bio transparente (300-400 mots)

> Draft à valider/réécrire :

```markdown
Manon est la plume éditoriale d'Axion-IA.

Sous ce nom signe notre équipe éditoriale : audit IA, méthodologie, cas
concrets anonymisés, comparatifs d'outils, panoramas sectoriels. Nous avons
choisi de réunir notre production de contenus sous une persona unique plutôt
que multiplier les signatures dispersées — pour donner à nos lectrices et
lecteurs un repère stable, une voix cohérente d'un article à l'autre.

Notre processus : pour chaque sujet, l'un de nos consultants identifie un
angle issu de nos interventions terrain (cabinets, PME industrielles, écoles,
mairies, ETI multi-sites). Une recherche temps réel via Perplexity Sonar
sécurise les données chiffrées et les citations. Une rédaction assistée par
Claude (Anthropic) et GPT-4o (OpenAI) produit le premier jet, qui passe
ensuite par notre relecture éditoriale humaine — sur tous les contenus de
niveau tier-1, sans exception. Les contenus tier-2 (généralement actualités
ou variantes ciblées) sont publiés sans relecture systématique, marqués
`noindex,follow` par défaut, et promus tier-1 après revue manuelle.

Nous écrivons sur l'IA opérationnelle — pas la prouesse technique, pas la
hype, pas les « game changers ». Ce qui nous intéresse, c'est le moment où
une équipe de 12 personnes gagne 4 heures par semaine sur la lecture de
factures, où un cabinet médical sort des comptes-rendus en 15 minutes au
lieu de 45, où une mairie produit un compte-rendu de conseil municipal sans
saisir une ligne.

Axion-IA accompagne des dirigeants de TPE, PME, ETI, écoles, universités,
mairies et organisations publiques qui veulent passer de la fascination IA
à des résultats mesurables. Manon en est la voix éditoriale.

Vous trouverez sur ce site les articles signés Manon : guides piliers,
comparatifs d'outils, cas concrets anonymisés, FAQ thématiques, actualités
analysées. Tous nos contenus respectent une charte éditoriale stricte : pas
de garantie chiffrée non sourcée, pas de promesse marketing creuse, citations
de sources externes systématiques, anonymisation totale des cas concrets,
mention transparente de notre processus IA + relecture humaine.

— L'équipe éditoriale Axion-IA
```

→ **Will valide** (2026-05-14) : ✅ **OK tel quel** — bio validée sans ajustement.

## 4. Expertises (`knowsAbout[]` JSON-LD)

Cohérent avec doctrine éditoriale Axion-IA (collective + processus transparent) :

```json
[
  "Intelligence artificielle opérationnelle",
  "Audit IA en entreprise",
  "Transformation digitale TPE PME ETI",
  "Implémentation IA custom",
  "AEO et SEO 2026",
  "Automatisation des processus métiers",
  "Méthodologie Axion-IA",
  "Conduite du changement IA"
]
```

→ Inchangé vs v1.x. Will valide (2026-05-14) : ✅ **ces 8** — inchangé.

## 5. Pas de `sameAs[]` externes — doctrine v2.0

⚠️ **Refonte v2.0** : Manon étant une persona éditoriale fictive, **aucun lien externe `sameAs`** n'est inclus dans son `Person` JSON-LD :

- ❌ Pas de LinkedIn URL (pas de fake profil)
- ❌ Pas de Twitter / X handle (pas de fake compte)
- ❌ Pas de Wikidata Q-id (pas de personne réelle à référencer)
- ❌ Pas de `alumniOf` (rien à inventer)
- ❌ Pas de `award[]` (idem)

**À la place, signaux d'autorité collectif (Organization)** :

- Toutes les `Article.publisher = Organization Axion-IA` (vraie société estonienne avec `legalName`, `vatID`, `foundingDate`, `taxID` Tallinn, etc.)
- `Article.author = Person Manon` mais avec note `description` transparente : « Persona éditoriale d'Axion-IA. Sous ce nom signe l'équipe éditoriale + processus IA supervisé. »
- `Article.editor` ou `Article.publisher.creator` peut référencer l'Organization

## 6. Page canonique `/fr/equipe/manon` v2.0

Page indexable tier-1 honnête :

- Hero : Visuel choisi (Option 1/2/3 § 2)
- H1 : « Manon — plume éditoriale d'Axion-IA »
- Bio transparente (cf. § 3)
- **Section dédiée « Notre processus éditorial »** : explique IA + relecture humaine, quels modèles utilisés, quel cycle de validation
- Liste articles signés (auto-générée filter `Article.author.@id`)
- **Pas de liens externes LinkedIn/Twitter** (cohérent doctrine)
- Lien vers `/fr/equipe` (page équipe Axion-IA — V2)
- Lien vers `/fr/methodologie` (méthodologie globale)
- Mention RGPD + transparence IA

→ Will valide preview Sprint 3 avant promotion tier-1.

## 7. Récap ingest Sprint 1

```json
{
  "slug": "manon",
  "displayName": "Manon",
  "jobTitle": "Plume éditoriale d'Axion-IA",
  "bioMd": "<bio § 3 — validée Will 2026-05-14>",
  "photoUrl80": "/auteurs/manon.png",
  "photoUrl256": "/auteurs/manon.png",
  "photoUrl1024": "/auteurs/manon.png",
  "photoAlt": "Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA",
  "aiGenerated": true,
  "linkedinUrl": null,
  "twitterHandle": null,
  "alumniOf": null,
  "awards": [],
  "isPersona": true,
  "personaDisclaimer": "Persona éditoriale d'Axion-IA. Sous ce nom signe l'équipe éditoriale + processus IA supervisé. Portrait illustratif généré par IA.",
  "knowsAbout": [
    "Intelligence artificielle opérationnelle",
    "Audit IA en entreprise",
    "Transformation digitale TPE PME ETI",
    "Implémentation IA custom",
    "AEO et SEO 2026",
    "Automatisation des processus métiers",
    "Méthodologie Axion-IA",
    "Conduite du changement IA"
  ],
  "isActive": true
}
```

→ Sprint 1 Day 1 : ingestion seed `AuthorProfile[slug=manon]`. Photo `/auteurs/manon.png` déjà placée 2026-05-14 (Sprint S0). Next/image gère AVIF/WebP au runtime via `<Image>`.

⚠️ Schéma Prisma `AuthorProfile` à étendre Sprint 1 Day 1 avec 2 nouvelles colonnes :
- `aiGenerated Boolean @default(false)` (Sprint 1 — flag transparence IA)
- `photoAlt String?` (alt text canonique, utilisé partout)

## 8. Conséquences sur le code

- Table `AuthorProfile` étendue : ajouter colonnes `isPersona Boolean @default(false)` et `personaDisclaimer String?`
- `buildPersonManonJsonLd()` :
  - Pas de `sameAs[]` (ou tableau vide)
  - Inclure `description` avec disclaimer transparent
  - Inclure `@type: "Person"` standard (Schema.org accepte personas — la transparence est dans la description)
  - **Bonus v2.0** : ajouter `worksFor: { @id Organization Axion-IA }` fort + `colleague[]` (V2)
- Composant `AuthorByline` : sur hover ou via lien « À propos » → menu déroulant qui affiche le disclaimer
- Page `/fr/equipe/manon` : section bien visible « Notre processus éditorial » avec mention transparente IA + relecture humaine

## 9. Will doit fournir — ✅ COMPLET 2026-05-14

- [x] **Choix Option visuelle** → Option 4 « Portrait IA disclosed »
- [x] **Photo source** → `axionia/public/auteurs/manon.png` (fournie 2026-05-14)
- [x] **Validation bio** → OK tel quel (cf. § 3)
- [x] **Validation expertises** → 8 inchangées (cf. § 4)
- [ ] (Action humaine) Vérifier `NEXT_PUBLIC_SITE_URL=https://axion-ia.com` est bien dans les env vars Coolify (sinon fallback prod déclenché par `seo.ts` SITE_URL, mais SSOT propre = mieux)

→ **Q13 RÉSOLU. Autopilote Sprint 1 débloqué.**

## ⚠️ Si Will change d'avis et veut B ou C plus tard

- **Option B** (Article.author = Organization, pas Person) : modifier `buildArticleJsonLd()` pour remplacer `author` par `Organization`. ~30 min code.
- **Option C** (cacher fictivité, faux LinkedIn/Twitter) : NON recommandé (cf. risques en intro). Si Will insiste, Claude posera STOP & ASK avant.
