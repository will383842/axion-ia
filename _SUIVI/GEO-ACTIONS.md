# Suivi des 18 actions GEO hors-code

> **Ce fichier est la source de vérité du rappel mensuel WhatsApp.**
> Cochez une case, le rappel cesse d'en parler. Quand tout est coché **et**
> vérifié, le rappel s'arrête de lui-même.

Pour cocher : ouvrez ce fichier sur GitHub, cliquez sur le crayon ✏️, remplacez
`- [ ]` par `- [x]`, puis **Commit changes**. Rien d'autre à faire.

Le pas-à-pas détaillé (où aller, quoi écrire au caractère près) :
`_AUDIT/GEO-AEO-E2E-2026-08-14/03-RESTE-WILL.md`

---

## ⚙️ Une seule fois — activer le rappel WhatsApp (2 min)

Le workflow `rappel-geo-mensuel.yml` tourne le **1er de chaque mois**. Il vérifie
tout seul ce qui est vérifiable et n'envoie que ce qui reste. Mais **les secrets
WhatsApp vivent dans Coolify, pas dans GitHub Actions** — il faut les y recopier
une fois :

> GitHub → **Settings** → **Secrets and variables** → **Actions** → _New repository secret_
>
> | Nom du secret               | Où trouver la valeur                           |
> | --------------------------- | ---------------------------------------------- |
> | `WHATSAPP_CALLMEBOT_APIKEY` | Coolify → app **`axion-ia-worker`** → Env vars |
> | `WHATSAPP_NOTIFY_PHONE`     | idem (format international, ex. `+33...`)      |

Sans eux, le workflow **ne rougit pas** : il écrit simplement le bilan dans ses
logs, sans envoyer. Avec eux, vous recevez le rappel sur WhatsApp.

**Pour tester tout de suite** : onglet _Actions_ → _Rappel mensuel — actions GEO
hors-code_ → **Run workflow**.

---

## ⛔ La règle qui prime sur tout

Trois fiches (LinkedIn, Google Business, Crunchbase) portent un champ
**organisme de formation / Qualiopi**. **Laissez-le vide.** Le registre public
dit `est_organisme_formation = false`, et le seul « Axion » vérifiablement
Qualiopi est **AXION FORMATIONS**, Saint-Quentin, NDA 22020045002.

Renseigner un statut non corroborable grave l'erreur là où vous ne pourrez plus
la reprendre — et envoie le moteur vers l'homonyme.

## L'identité à recopier partout

| Champ     | Valeur exacte                                                           |
| --------- | ----------------------------------------------------------------------- |
| Nom       | `Axion-IA`                                                              |
| Adresse   | `11 Avenue Paul Verlaine, 38100 Grenoble, Auvergne-Rhône-Alpes, France` |
| Création  | `2026`                                                                  |
| Fondateur | `Williams Jullin` — avec un « s »                                       |
| Site      | `https://axion-ia.com/fr` — **jamais** `www.` (deux 301 en cascade)     |
| SIREN     | `108018631`                                                             |

---

## Vague 1 — gratuit, ~2 h en tout

- [ ] **R-01 · LinkedIn** (15 min) — `linkedin.com/company/axion-ia-france` → Admin tools → Edit page.
      Dit « Paris » et « 2025 ». 🚫 **Ne touchez pas au slug de l'URL**, il est déclaré en `sameAs` dans le code.
- [ ] **R-02 · Crunchbase puis F6S** (45 min) — _Claim this profile_, gratuit.
      🔑 **Commencez par LIRE** : l'audit n'a jamais pu voir ces fiches (403 / bot-wall), et ce sont les sources n° 1 et n° 2 du moteur sur votre marque.
- [ ] **R-03 · Les Pépites Tech** (20 min) — dit « 138 Av. des Champs-Élysées » et « French Tech Grand Paris ».
      Seul lien potentiellement _dofollow_ de tout votre profil : demandez une **ancre de marque**, pas « Visiter leur site ».
- [ ] **R-04 · QR `podcast`** (2 min) — console → QR codes → slug `podcast` → `/fr/podcast`.
      _(vérifié automatiquement)_ Chaque flyer déjà distribué envoie sur une page d'erreur.
- [ ] **R-05 · Jeton OAuth GSC en scope _write_** (15 min) — workflow `gsc-oauth-refresh-write.yml`, mode `generate` puis `exchange`.
      _(vérifié automatiquement)_ 0 succès sur 40 runs depuis le 22/06.
- [ ] **R-06 · Cache Rule Cloudflare `.xml`** (10 min) — Edge TTL **explicite 600 s**, pas « Respect origin ».
      _(vérifié automatiquement)_ L'edge dépasse d'un facteur 5 la fraîcheur demandée.
- [ ] **R-07 · Clé API Bing Webmaster** (10 min) — secret GitHub `BING_WMT_API_KEY`.
      _(vérifié automatiquement)_ Sans rapport avec le ticket UCM000007450870.
- [ ] **R-08 · Lien sur JaimeLesStartups** (10 min) — mail à la rédaction, ancre « Axion-IA ».
      _(vérifié automatiquement)_ La page vous décrit sans aucun lien cliquable.
- [x] **R-09 · `AGENTS.md` global** — ✅ fait le 2026-08-17 (deux écarts : `/reserver` supprimée, et « les gates bloquent » qui était faux).

## Vague 2 — le NAP local

> **R-10 est le verrou** : sans téléphone public, R-11, R-12 et R-13 sont
> **impossibles**. Les trois annuaires l'exigent.

- [ ] **R-10 · Ligne pro + `COMPANY_PHONE`** (1 h, **~5-15 €/mois — seule action payante**)
      _(vérifié automatiquement)_
- [ ] **R-11 · Google Business Profile** (30 min + 5-14 j de vérification) — dépend de R-10
- [ ] **R-12 · Bing Places** (10 min) — dépend de R-11
- [ ] **R-13 · PagesJaunes** (20 min) — dépend de R-10

## Vague 3 — le long terme

- [ ] **R-14 · Entrer dans 3 à 5 comparatifs tiers** (semaines) — dépend de l'arbitrage Qualiopi
- [ ] **R-15 · Glossaire : arbitrer puis écrire** (arbitrage 30 min, rédaction longue)
- [ ] **R-16 · Pilote presse Isère/Drôme** (semaines)
- [ ] **R-17 · Wikidata** (30 min) — ⛔ **EN DERNIER, JAMAIS AVANT**
      Wikidata exige des sources secondaires indépendantes. Aujourd'hui : 0 retombée presse, 7 abonnés LinkedIn.
      Un item créé trop tôt serait supprimé pour défaut de notoriété — et **une suppression laisse une trace qui rend la seconde tentative plus difficile**.
- [ ] **R-18 · Avantages des 54 offres d'emploi** (1-2 h)

---

## ⛔ L'ordre à ne pas inverser

```
① Corriger les fiches tierces (R-01, R-02, R-03)
        ↓  ← elles disent « Paris » et « 2025 »
② Les déclarer en sameAs          ← code, DÉJÀ FAIT
        ↓
③ Téléphone → Google Business → Bing Places → PagesJaunes
        ↓
④ Comparatifs tiers + presse locale
        ↓
⑤ Wikidata — EN DERNIER
```

**Pourquoi ① avant ②** : déclarer ces fiches en `sameAs` avant de les corriger,
c'est **signer vous-même l'erreur d'entité** que tout le reste cherche à
supprimer.

---

## Ce que ça répare

Sur « Qui est Axion-IA ? », l'audit a mesuré **9 sources citées, 0 sur
axion-ia.com**. Crunchbase en #1, F6S en #2, puis sept homonymes américains. Sur
les deux requêtes commerciales testées : **0 mention**.

Le domaine **est** bien indexé — 9 pages remontent. Ce n'est pas un problème
d'indexation, c'est un problème **d'autorité d'entité**. Aucune ligne de code ne
corrige ça : les 45 correctifs plafonnent vers **72 %**.

⚠️ **Et ce n'est pas la ligne d'arrivée.** L'audit part de **987 / 2 500
(39,5 %)**. Restent aussi 23 lots au plan de patches (dont 4 à risque élevé,
ADR requis) et **GEO-075 gelé** tant que la question Qualiopi n'est pas tranchée.
