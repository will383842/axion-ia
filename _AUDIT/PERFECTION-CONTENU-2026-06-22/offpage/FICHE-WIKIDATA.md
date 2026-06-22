# Fiche Wikidata — Axion-IA & Williams Jullin

Objectif : créer (ou compléter) deux entités Wikidata afin d'ancrer l'entité
« Axion-IA » et son fondateur dans le Knowledge Graph (corroboration `sameAs`
émise par le site, triangulation Google Knowledge Panel / AI Overviews /
Perplexity).

> ⚠️ **Règles de saisie Wikidata**
> - Chaque déclaration (statement) **doit** porter une **référence** (`reference URL`,
>   P854) pointant vers une source vérifiable. Wikidata refuse les données promotionnelles
>   non sourcées — privilégier les pages officielles `axion-ia.com` et LinkedIn.
> - **Ne rien inventer** : tout champ factuel manquant reste `[À COMPLÉTER PAR WILL]`.
> - Axion-IA est une **SAS française** — `country = France (Q142)`. Aucune mention
>   Estonie / OÜ (interdit).
> - Une fois les Q-numbers créés, les renseigner dans les env vars Coolify pour que le
>   site émette le `sameAs` Wikidata :
>   - `WIKIDATA_QNUMBER_AXIONIA = Qxxxxxxx`
>   - (`WIKIDATA_QNUMBER_MANON` concerne la persona, hors périmètre de cette fiche)
>   Ces variables sont lues par `src/lib/seo/wikidata-sameas.ts` → `buildOrganizationSameAs()`.

---

## sameAs déjà émis par le site (à réutiliser comme références / liens croisés)

Émis dans le JSON-LD `Organization` (`src/lib/seo.ts`, nœud `/#organization`) :

| URL | Type Wikidata recommandé |
| --- | --- |
| `https://axion-ia.com` | P856 (site officiel) |
| `https://www.linkedin.com/company/axion-ia-france` | P4264 (LinkedIn company ID) ou P973 (described at URL) |
| `https://about.me/axion-ia` | P973 (described at URL) |
| `https://www.indiehackers.com/AxionIA` | P973 (described at URL) |

Émis dans le nœud `Person` Williams (`src/lib/seo/williams-person.ts` + `src/lib/seo.ts`) :

| URL | Type Wikidata recommandé |
| --- | --- |
| `https://www.linkedin.com/in/williamsjullin/` | P6634 (LinkedIn personal profile ID = `williamsjullin`) |
| `https://axion-ia.com/fr/equipe/williams` | P973 (described at URL) |

> Le site lit aussi un éventuel `WIKIDATA_QNUMBER_AXIONIA` pour ré-émettre l'URL Wikidata
> en `sameAs` : la triangulation est **bidirectionnelle** une fois l'entité créée.

---

## Entité (a) — Axion-IA

**Label (fr) :** Axion-IA
**Label (en) :** Axion-IA
**Description (fr) :** cabinet de conseil et de formation en intelligence artificielle basé en France
**Description (en) :** France-based artificial intelligence consulting and training firm
**Alias :** AxionIA · Axion IA · Axion-IA SAS · axion-ia.com

| Propriété (P-id) | Libellé | Valeur | Source / référence (P854) |
| --- | --- | --- | --- |
| P31 | instance of (nature de l'élément) | entreprise (`Q4830453`) ; à préciser société par actions simplifiée (`Q2912172`, SAS) | Mentions légales `https://axion-ia.com` |
| P1454 | legal form (forme juridique) | société par actions simplifiée — SAS (`Q2912172`) | `legalName: "Axion-IA SAS"` (JSON-LD Organization) |
| P17 | country (pays) | France (`Q142`) | `addressCountry: "FR"` (JSON-LD Organization) |
| P159 | headquarters location (siège) | Paris (`Q90`) | `addressLocality: "Paris"` (JSON-LD Organization) |
| P452 | industry (secteur) | conseil (`Q2138309`) + intelligence artificielle (`Q11660`) | Site officiel |
| P112 | founded by (fondé par) | Williams Jullin (→ entité (b) ci-dessous) | `founder` JSON-LD + `/equipe/williams` |
| P571 | inception (date de création) | 2024 *(année seule ; date exacte `[À COMPLÉTER PAR WILL]`)* | `foundingDate: "2024"` (JSON-LD Organization) |
| P856 | official website (site officiel) | `https://axion-ia.com` | — (auto-référence) |
| P6634 | LinkedIn personal profile ID | *(n/a — entité société)* | — |
| P4264 | LinkedIn company ID | `axion-ia-france` (depuis `linkedin.com/company/axion-ia-france`) | LinkedIn |
| P973 | described at URL | `https://about.me/axion-ia` ; `https://www.indiehackers.com/AxionIA` | Profils publics |
| P1448 | official name (nom officiel) | Axion-IA SAS | `legalName` JSON-LD |
| P1320 | OpenCorporates ID | `[À COMPLÉTER PAR WILL]` | OpenCorporates (si fiche existe) |
| P3215 | SIREN number | `[À COMPLÉTER PAR WILL]` *(ne pas inventer)* | INSEE / Infogreffe |
| P127 | owned by | `[À COMPLÉTER PAR WILL]` *(si pertinent)* | — |
| P937 | work location | France (`Q142`) ; France métropolitaine | `areaServed: ["FR", "EU"]` JSON-LD |

> **Vérification d'éligibilité Wikidata (notabilité) :** Wikidata exige qu'un élément
> soit identifiable par une source sérieuse OU réponde à un besoin structurel. Pour une
> entreprise jeune, joindre des références solides (mentions légales, profils officiels,
> couverture presse de l'Observatoire). Si la notabilité est contestée, prioriser
> d'abord la couverture presse (communiqué Observatoire) avant la création.

---

## Entité (b) — Williams Jullin

**Label (fr) :** Williams Jullin
**Label (en) :** Williams Jullin
**Description (fr) :** entrepreneur et consultant français, fondateur d'Axion-IA
**Description (en) :** French entrepreneur and consultant, founder of Axion-IA

| Propriété (P-id) | Libellé | Valeur | Source / référence (P854) |
| --- | --- | --- | --- |
| P31 | instance of | être humain (`Q5`) | `/equipe/williams` (Person, `isPersona: false`) |
| P106 | occupation (profession) | entrepreneur (`Q131524`) ; consultant (`Q15978655`) ; chef d'entreprise | `jobTitle: "Fondateur & CEO d'Axion-IA"` |
| P108 | employer (employeur) | Axion-IA (→ entité (a)) | `worksFor` JSON-LD |
| P39 | position held (fonction occupée) | directeur général / CEO d'Axion-IA | `jobTitle` JSON-LD |
| P1830 | owner of / founder of *(via P112 sur l'entité a)* | Axion-IA | `founder` JSON-LD |
| P6634 | LinkedIn personal profile ID | `williamsjullin` (depuis `linkedin.com/in/williamsjullin/`) | `WILLIAMS_LINKEDIN` (`williams-person.ts`) |
| P973 | described at URL | `https://axion-ia.com/fr/equipe/williams` | Page autorité E-E-A-T |
| P27 | country of citizenship | `[À COMPLÉTER PAR WILL]` *(France probable — à confirmer, ne pas inventer)* | — |
| P21 | sex or gender | `[À COMPLÉTER PAR WILL]` *(si Williams souhaite le déclarer)* | — |
| P569 | date of birth | `[À COMPLÉTER PAR WILL]` *(ne pas inventer)* | — |
| P1559 | name in native language | Williams Jullin | Signature officielle |
| P101 | field of work (domaine d'activité) | intelligence artificielle (`Q11660`) ; stratégie d'entreprise ; transformation digitale | `knowsAbout` (`williams-person.ts`) |

> **Domaines d'expertise déclarés** (champ `knowsAbout`, source `williams-person.ts`) —
> utilisables pour P101 / description : « Stratégie IA en entreprise », « Direction et
> création d'entreprise », « Audit et implémentation IA », « Transformation digitale TPE
> PME ETI », « Conduite du changement ».

---

## Lien réciproque entre les deux entités

| Sur l'entité… | Propriété | Pointe vers |
| --- | --- | --- |
| Axion-IA (a) | P112 founded by | Williams Jullin (b) |
| Axion-IA (a) | P169 chief executive officer *(optionnel)* | Williams Jullin (b) |
| Williams Jullin (b) | P108 employer | Axion-IA (a) |

Établir ces deux liens croisés consolide le sous-graphe « fondateur ↔ société » et
maximise la résolution d'entité par les moteurs et LLMs.

---

## Checklist post-création (Will)

1. [ ] Créer/compléter l'entité **Axion-IA** avec références sur chaque statement.
2. [ ] Créer/compléter l'entité **Williams Jullin** avec références.
3. [ ] Relier P112 / P108 entre les deux entités.
4. [ ] Renseigner les champs `[À COMPLÉTER PAR WILL]` dès que les données réelles sont disponibles (SIREN, date exacte de création, etc.) — **sans rien inventer**.
5. [ ] Poser l'env var Coolify `WIKIDATA_QNUMBER_AXIONIA = Qxxxxxxx` (scope RUN) → **redeploy** pour que le site émette le `sameAs` Wikidata via `buildOrganizationSameAs()`.
6. [ ] Vérifier la triangulation : le nœud `Organization` (`/#organization`) doit lister l'URL Wikidata dans son `sameAs`.

*Fiche rédigée le 2026-06-22. Toutes les valeurs sont issues du code du site (JSON-LD Organization/Person, `williams-person.ts`, `wikidata-sameas.ts`, `legal-snapshot.ts`) ou marquées `[À COMPLÉTER PAR WILL]`. Aucune donnée chiffrée n'a été inventée.*
