# F6 — ADDENDUM : vérification indépendante du lien LinkedIn (session principale)

Déclencheur : Will a fourni le permalien numérique
`https://www.linkedin.com/company/123134154` le 2026-08-15.
Vérifications faites par la session principale, 2026-08-14 ~23:00 UTC.

## 1. Le code est bien scindé en deux slugs — CONFIRMÉ indépendamment

`grep -rn "linkedin.com/company/…" src/` :

| Slug | Occurrences | Fichiers |
|---|---|---|
| `axion-ia` | **3** | `src/components/nav/Footer.tsx` (**sitewide**), `src/app/[locale]/presse/page.tsx`, `src/server/image-bank/services/image-jsonld-graph.service.ts` (pages galerie) |
| `axion-ia-france` | **8** | `src/lib/seo.ts`, `src/lib/seo/job-posting.ts`, `src/lib/seo/ville-service-jsonld.ts`, `src/lib/email/templates/_layout.tsx` (+ son test), `src/app/[locale]/memo-isere/page.tsx`, `src/app/[locale]/implantations/[region]/[ville]/page.tsx`, `src/app/[locale]/carrieres/page.tsx` |

Le constat structurel de F6 est donc **confirmé** : le lien social du pied de
page (présent sur toutes les pages) et le `sameAs` des pages presse/galerie
divergent du slug déclaré partout ailleurs, y compris dans `seo.ts` qui est
la source du `sameAs` de l'Organization.

## 2. `axion-ia-france` est bien la page réelle — CONFIRMÉ

Fetch public (2026-08-14 ~23:00 UTC) de
`https://www.linkedin.com/company/axion-ia-france` :

- Nom : **« Axion-IA.com »**
- Siège : **Paris**
- Fondée : **2025**
- Site : `https://axion-ia.com`
- Abonnés : **7**
- Secteur : IT Services and IT Consulting, 2-10 employés

➡️ Ceci **confirme le diagnostic de F5** : le profil tiers le plus autoritaire
contredit le registre sur trois attributs — **Paris** contre le siège Kbis
**Grenoble**, **2025** contre `foundingDate: "2026"`, et **« Axion-IA.com »**
contre la raison sociale **« AXION IA »**. C'est la racine identifiée du
« siège à Paris » que Perplexity affirmait le 2026-07-20.

➡️ Signal d'autorité additionnel, non relevé jusqu'ici : **7 abonnés**. Un
`sameAs` vers un profil quasi vide apporte peu de poids d'entité.

## 3. Ce que la vérification n'a PAS pu établir — point ouvert

F6 affirme que `linkedin.com/company/axion-ia` est la page d'une société
homonyme québécoise (« Les Automatisation Axion IA Inc. », axionia.ca).
**Je n'ai pas pu le confirmer** : la page renvoie l'authwall LinkedIn en
accès public, elle n'est pas indexée sous ce slug, et je ne peux pas
m'authentifier. Ce qui est en revanche établi : `axionia.ca` **existe bien**
et est une société québécoise d'automatisation (recherche web, 2026-08-14).

Le permalien numérique fourni par Will (`/company/123134154`) est également
derrière l'authwall — **la correspondance ID numérique ↔ slug reste à
confirmer par Will**, connecté à son compte : ouvrir le permalien numérique
redirige automatiquement vers l'URL vanity, qui est la réponse.

**Statut du finding F6 n°1** : le défaut de cohérence interne est CONFIRMÉ et
doit être corrigé quoi qu'il arrive (3 fichiers à aligner sur `seo.ts`). La
qualification « pointe vers une société tierce » reste **[À CONFIRMER]** —
elle change la gravité (simple incohérence ⇒ P1 ; mis-association active vers
un concurrent homonyme ⇒ P0), pas la nature du correctif.

## 4. Conséquence pour le patch

Quelle que soit la réponse, le correctif est le même et il est petit :
faire converger les 3 occurrences `axion-ia` vers la valeur unique déjà
portée par `src/lib/seo.ts`, et **supprimer la duplication littérale** en
introduisant une constante unique (le fait que 11 call-sites codent l'URL en
dur est la cause première de la divergence — un correctif qui se contente de
remplacer 3 chaînes laissera le défaut se reproduire).

Note technique : le permalien **numérique** est immunisé contre un changement
futur de slug vanity, mais pour un `sameAs` la forme vanity est préférable
(c'est l'URL canonique que LinkedIn expose et que les moteurs rapprochent de
l'entité). Recommandation : constante unique en forme vanity confirmée.

## 5. Correctifs d'identité à porter côté LinkedIn (action Will, pas du code)

À faire figurer dans `03-RESTE-WILL.md` : aligner la page LinkedIn sur le
registre — **siège Grenoble** (et non Paris), **année de fondation** conforme
au Kbis, **raison sociale** « Axion IA » plutôt que « Axion-IA.com ». Tant que
ce profil dit « Paris », il continuera d'alimenter les moteurs de réponse en
information fausse, quel que soit le contenu du site.
