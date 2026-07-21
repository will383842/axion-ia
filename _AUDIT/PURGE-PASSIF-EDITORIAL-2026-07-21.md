# Inventaire de purge — passif éditorial

**Date** : 2026-07-21 · **Périmètre** : 163 articles `published` en base prod
**Statut** : ⛔ **AUCUNE ÉCRITURE EFFECTUÉE.** Ce document est l'inventaire soumis à revue avant toute modification.

---

## Volumétrie

| Défaut | Articles | Nature |
|---|---:|---|
| `PRIX` — token `{{price:...}}` non résolu | **50** | Bug de rendu. Fuit aussi dans le JSON-LD `FAQPage` envoyé à Google |
| `STAT31` — statistique « 31 % » | **35** | Attribuée à France Compétences (28), DARES (22), INSEE (11), BPI France (8) — mêmes chiffres, sources incompatibles |
| `ALT` — `alt="text"` | **15** | Placeholder d'image publié |
| `TOKEN` — `[lien]` / `[AFNOR]` / `[UNESCO]` | **10** | Tokens de template visibles dans le texte |
| `SESSION12` — « Session 12+ » | **3** | Jargon de sprint interne exposé aux prospects |

**69 articles distincts** portent au moins un défaut, soit **42 % du corpus publié**.

---

## Règles de traitement proposées

| Défaut | Traitement | Interdit |
|---|---|---|
| `PRIX` | Résoudre via `PRICE_TOKEN_REGISTRY`, sinon **« Sur devis »**. Vérifier séparément le HTML **et** le JSON-LD — la fuite y est distincte | ❌ Inventer un prix. ❌ Laisser « À partir de À partir de » (bug de composition observé) |
| `STAT31` | **Supprimer la phrase entière** quand la source invoquée n'a pas publié le chiffre | ❌ Remplacer par un autre chiffre non sourcé. ✅ Conserver les usages réellement sourcés (progression 8 % → 31 %, Syntec Numérique) |
| `ALT` | Générer un `alt` descriptif à partir du contexte de l'image | ❌ Laisser vide |
| `TOKEN` | Suppression du token ; si c'était un lien attendu, supprimer la phrase | — |
| `SESSION12` | Suppression de la phrase entière | — |

**Prérequis à l'exécution** : sauvegarde des colonnes `body` et `body_text` des 69 articles concernés, pour rollback immédiat.

---

## Liste par article (tri : gravité puis `qualityScore`)

Le `qualityScore` est affiché pour illustrer qu'il **ne prédit pas** la présence de défauts — voir l'audit §5.2 (r = +0,25).

### Défauts multiples (≥ 3 catégories)

| Slug | Défauts | quality |
|---|---|---:|
| `audit-ia-grigny` | PRIX · STAT31 · ALT · TOKEN | 77 |
| `coaching-ia-dirigeant-aurillac` | STAT31 · ALT · TOKEN | 79 |
| `audit-ia-malakoff-comprendre-optimiser` | PRIX · STAT31 · TOKEN | 78 |
| `audit-ia-bretigny-sur-orge` | PRIX · STAT31 · TOKEN | 77 |
| `referencement-ia-grenoble-entreprise-faq` | PRIX · STAT31 · ALT | 84 |
| `audit-ia-rueil-malmaison` | PRIX · STAT31 · ALT | 80 |
| `audit-ia-roi-grigny` | PRIX · ALT · SESSION12 | 79 |

### `STAT31` + `TOKEN`

`formation-ia-bagneux-defis-metier` (82) · `formation-ia-saint-genis-laval` (81) · `coaching-ia-dirigeant-dammarie-les-lys` (79) · `formation-ia-ris-orangis` (78) · `formation-ia-bourgoin-jallieu` (76)

### `STAT31` + `ALT`

`etude-de-cas-formation-ia-grenoble` (83) · `formation-ia-gonesse` (77)

### `STAT31` seul

`formation-ia-rillieux-la-pape` (85) · `coaching-ia-dirigeant-gonesse-cas-concret` (83) · `coaching-ia-dirigeant-grigny` (82) · `formation-ia-puteaux-solutions` (80) · `formation-ia-longjumeau` (79) · `formation-ia-fontenay-aux-roses` (78) · `formation-ia-romans-sur-isere-options` (77) · `coaching-ia-dirigeant-roissy-en-brie` (77) · `formation-ia-clichy-sous-bois-optimisez-competences` (77) · `formation-ia-neuilly-plaisance` (75) · `formation-ia-herblay-sur-seine` (75) · **`coach-ia-grenoble-guide-pratique` (56)**

> ⚠️ `coach-ia-grenoble-guide-pratique` est l'anomalie GSC signalée dans l'audit : **position 2,0, 52 impressions, 0 clic**. Elle porte une statistique fabriquée. À traiter en priorité et à observer après correction.

### `SESSION12`

`coaching-ia-dirigeant-mantes-la-ville-roi` (80) · `formation-ia-saint-gratien-roi` (76) · *(+ `audit-ia-roi-grigny`, listé plus haut)*

> `coaching-ia-dirigeant-mantes-la-ville-roi` cumule aussi une statistique ICF « 5,7× » détournée du coaching exécutif vers le « coaching IA », et **trois cas clients fabriqués localisés nominativement**. Candidat à la suppression pure plutôt qu'à la correction.

### `PRIX` + `STAT31`

`cours-ia-grenoble-entreprise-faq` (90) · `accompagnement-ia-entreprise-grenoble-faq` (89) · `atelier-ia-grenoble-entreprise` (85) · `diagnostic-ia-entreprise-grenoble` (83) · `formation-ia-villeurbanne-solutions-metier` (82) · `audit-ia-les-ulis-guide` (76) · `formation-ia-charenton-le-pont` (76) · `audit-ia-ivry-sur-seine-definition` (76) · `alternatives-audit-ia-les-ulis` (75) · `implementation-ia-grenoble-entreprise-faq` (67)

### `PRIX` + `ALT`

`formation-ia-le-plessis-trevise` (81) · `pourquoi-auditer-avant-implementer-ia` (78) · `coaching-ia-dirigeant-grenoble` (77) · `audit-intelligence-artificielle-taverny-entreprise` (75)

### `PRIX` seul

`formation-ia-rennes-faq` (**90**) · `developpement-ia-grenoble-faq` (90) · `cabinet-audit-ia-grenoble-faq` (87) · `formation-ia-versailles` (85) · `ateliers-ia-nimes-pme` (85) · `formation-ia-gif-sur-yvette` (85) · `integrateur-ia-grenoble-entreprise-faq` (84) · `formation-ia-nogent-sur-marne` (84) · `formation-ia-dammarie-les-lys` (84) · `formation-ia-caen` (84) · `formation-ia-ajaccio-guide-pas-a-pas` (83) · `mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` (82) · `formation-ia-saint-etienne-guide-pratique` (82) · `formation-ia-angers` (81) · `formation-ia-vitry-sur-seine` (81) · `formation-ia-rueil-malmaison` (80) · `etude-cas-audit-ia-champigny-sur-marne` (80) · `calculateur-roi-coaching-ia-dirigeant-velizy-villacoublay` (78) · `formation-ia-poitiers-axion-ia-vs-openclassrooms-comparatif` (77) · `audit-ia-bourgoin-jallieu` (77) · `audit-ia-venissieux-comprendre-optimiser` (77) · `comparaison-formation-ia-tremblay-en-france` (77) · `audit-ia-villeparisis-cas-concret-pme` (75) · `alternatives-formation-ia-nanterre` (75) · `formation-ia-saint-denis-comparatif-axion-ia-vs-generalistes` (73) · `comparatif-integrateurs-ia-grenoble-entreprise` (72) · `guide-agence-web-ia-auvergne-rhone-alpes` (71)

> `formation-ia-rennes-faq` porte la **note maximale du corpus (90/93)** et contient 3 tokens de prix non résolus ainsi qu'une statistique nationale auto-sourcée « données Axion-IA, 2025 ».

---

## Défauts restants, non détectables par regex

À traiter manuellement, article par article :

- **Études de cas fabriquées** (≥ 4 identifiées) — clients anonymes ou localisés avec pourcentages inventés. Suppression ou remplacement par un cas réel documenté.
- **Bloc « Sources » décoratif** — ~68 articles partagent le même quatuor France Compétences / AFNOR / Cnam / UNESCO, y compris une brève d'actualité sans rapport. Retirer quand aucune source n'est réellement citée dans le corps.
- **« Le règlement DORA, prévu pour 2025 »** — applicable depuis le 17/01/2025.
- **Statistique ICF « 5,7× »** appliquée au coaching IA.
- **`<h2>Liens internes et externes</h2>`** — titre de plomberie SEO exposé au lecteur.
- **URLs de sources cassées** (backtick collé à l'URL).

---

## Garde-fou à créer dans le même lot

Le contrôle CI existant **ne scanne que les fichiers statiques, jamais la base**. C'est pourquoi le token de prix corrigé le 2026-07-20 sur un article est réapparu sur 50 autres. Le nouveau contrôle doit interroger `article_translations` en base et échouer si un seul défaut est détecté.

## Requête de vérification post-purge

```sql
SELECT count(*) FILTER (WHERE t.body LIKE '%{{price:%' OR t.body_text LIKE '%{{price:%') AS prix,
       count(*) FILTER (WHERE t.body_text ~ '31\s?%')                                   AS stat31,
       count(*) FILTER (WHERE t.body LIKE '%alt="text"%')                               AS alt,
       count(*) FILTER (WHERE t.body ~ '\[(lien|AFNOR|UNESCO)\]')                       AS tokens,
       count(*) FILTER (WHERE t.body LIKE '%Session 12+%')                              AS session12
FROM article_translations t
JOIN articles a ON a.id = t.article_id
WHERE a.status = 'published';
-- Attendu après purge : 0 | 0 | 0 | 0 | 0
-- Mesuré au 2026-07-21 :  50 | 35 | 15 | 10 | 3
```
