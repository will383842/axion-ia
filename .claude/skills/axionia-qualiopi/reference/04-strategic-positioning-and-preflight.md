# 04 — Positionnement stratégique, conformité transverse & pré-vol

> Ce fichier capture le contexte **non déductible du seul code** qui conditionne tout le projet.
> Issu d'une vérification croisée (offre client, mémoire projet, ADR, état git réel). À lire avant la
> Phase 1. Plusieurs points sont des **STOP & ASK** : ne pas trancher seul.

---

## 1. ⚠️ Tension « Intervention » vs « Formation » (STOP & ASK n°1)

La marque Axion-IA dit délibérément **« Intervention »**, **pas « formation »**, et l'offre client
publique (`OFFRE-CLIENT-AXION-IA.md`) **ne mentionne jamais CPF/OPCO/financement** — choix assumé pour
rester hors du cadre réglementaire et garder un modèle **forfait fixe**. En parallèle, le dossier
`AXION_IA_COMPLET_QUALIOPI` montre une volonté **réelle** de devenir organisme de formation déclaré
(NDA DREETS AURA + Qualiopi).

**DÉCISION ACTÉE PAR WILL (2026-06-03) : déploiement PHASÉ, piloté par un flag.**

- **Phase A — AVANT les autorisations (NDA, puis Qualiopi)** : il est **illégal** d'afficher
  « Qualiopi / éligible CPF / finançable OPCO ». Le public reste **neutre** (« Intervention », silence
  financement). Le back-office Qualiopi est **entièrement construit mais l'affichage public est OFF**.
  Renfort technique : le filtre `checkTranslationBannedWords()` **bannit déjà le mot « formation »** du
  contenu public (`src/lib/knowledge/banned-words.ts:11`) — donc en Phase A, rien ne peut fuiter.
- **Phase B — APRÈS obtention NDA + Qualiopi** : on bascule un flag **`OF_PUBLIC_DISCLOSURE_ENABLED=true`**
  (sur le modèle existant `EN_LOCALE_ENABLED`, réglable côté Coolify, redémarrage). Ce flag :
  (a) affiche les mentions Qualiopi/financement sur les pages OF dédiées ; (b) **assouplit le filtre
  banned-words uniquement sur ces pages OF** (le reste du site reste « Intervention ») ; (c) active les
  fiches formation publiques conformes (ind. 1).
- **Modèle de prix** : forfait fixe public conservé (`pricing.ts`) ; la **ventilation horaire** OPCO
  n'apparaît que dans les documents OPCO/conventions (voir §4) et le back-office.

**Implémentation** : tout le module Qualiopi est livrable dès maintenant **avec le flag à `false`** —
aucune fuite publique. Will bascule le flag le jour où Qualiopi est obtenu. **Ne jamais activer le flag
ni publier de contenu « formation/Qualiopi/financement » public sans confirmation explicite de Will.**

## 2. ⚠️ Entité juridique : SAS France PARTOUT (zéro OÜ) — ACTÉ PAR WILL

**Décision de Will (2026-06-03) : c'est la France de partout, plus d'OÜ.** L'organisme de formation est
**Axion-IA SAS, France** (siège Paris, direction effective Saint-Lattier, Isère — DREETS AURA). L'OÜ
estonien est **legacy/abandonné** : à ne plus utiliser nulle part (documents OF, mentions légales,
factures, JSON-LD, footer). Si une mention OÜ traîne encore dans le code/contenu (ex. ancien wording),
**la signaler à Will** ; ne pas la propager dans le nouveau module. Les placeholders légaux (SIRET, NDA, adresses) restent dans `SiteSetting` (cat. qualiopi),
à renseigner par Will. Si une mention OÜ traîne dans le code/contenu, **signaler, ne pas propager**.

## 3. ⚠️ Silence financement sur le public (mémoire + gate)

La mémoire impose **« financement = silence total »** sur le contenu grand public (anti-doorway). Deux
gardes réels : (a) `checkTranslationBannedWords()` (`src/lib/knowledge/banned-words.ts:11`) **bannit le
mot « formation »/« formateur »…** du contenu public publié ; (b) `BANNED_TERMS` côté keywords. Donc :

- ❌ Pas de « formation », « finançable CPF », « éligible OPCO », « Qualiopi » sur les pages publiques
  **tant que `OF_PUBLIC_DISCLOSURE_ENABLED` est `false`** (Phase A).
- ✅ CPF/OPCO/France Travail = **données back-office** (qui paie, calculs, kits, conventions) + mentions
  **réglementaires** dans les documents (facture, convention) — jamais du marketing en Phase A.
- ✅ Tout texte public produit par le module **passe `checkTranslationBannedWords()`** avant publication ;
  l'assouplissement sur les pages OF dédiées est **gouverné par le flag** (Phase B uniquement).

## 4. Facturation duale : forfait ↔ ventilation horaire (OPCO)

Le public est en **forfait fixe** ; les OPCO **raisonnent à l'heure** (ex. plafond Atlas ~40 €/h/
participant, plafond annuel ~8 000 €/entreprise — **paramètres `SiteSetting` (cat. qualiopi), jamais en dur**). Les
tarifs Axion (≈ 61–186 €/h selon effectif) **dépassent** souvent ces plafonds → **reste à charge**.

Le Qualiopi Manager doit donc gérer **deux modes** sans casser le SSOT `pricing.ts` :

- **Mode direct** : facture forfait au client, **avec TVA** (jamais de mention d'exonération — voir
  reference/01, §TVA), prix issu de `pricing.ts`.
- **Mode OPCO** : conversion forfait → **ventilation horaire** (participants × heures × barème), calcul
  du reste à charge, convention (tripartite si subrogation), facture libellée à l'OPCO si subrogation.

Le prix **affiché** reste toujours dérivé de `pricing.ts` ; le calcul OPCO est un **service interne**.

## 5. AI Act art. 50 (ADR 0024) — Formation Engine = système d'IA

Le contenu pédagogique généré par IA doit être **marqué** (`aiGenerated: true` / mention) conformément à
l'art. 50 du règlement IA UE (échéance août 2026) et à l'ADR 0024. Conséquences :

- Tracer dans `formations` que le contenu est généré par IA + le modèle utilisé.
- **Aucun chiffre/ROI non étayé** sans validation humaine (cf. grille qualité anti-hallucination) — c'est
  aussi une contrainte de la voix de marque (« factuel, chiffré, honnête »).
- Validation humaine obligatoire avant publication (déjà dans le pipeline).

## 6. Sous-traitance formateurs (indicateur 19/27 ⭐ — NC majeure)

Tout **formateur sous-traitant** doit avoir **NDA + Qualiopi valides**, **vérifiés sur data.gouv.fr** avec
**capture d'écran datée archivée AVANT chaque mission**. Non-conformité = **échec direct** de l'audit.
Le module doit : table `sous_traitants_of` (distincte de `formateurs` internes), champs
`nda_numero`/`qualiopi_numero`/`qualiopi_validite`/`verifie_at`/`screenshot_url`, alerte si expiration
proche, blocage d'assignation si non vérifié. Statuts formateurs : **salarié** (CDI temps partiel +
commission, SMIC plancher via `SiteSetting` (cat. qualiopi)) vs **sous-traitant** (lettre de mission, tarif jour) —
voir guides `12_FORMATEURS_STATUTS_CONTRATS` et `11_STRATEGIE_PRIX_OPCO`.

## 7. Excellence pédagogique (kit) — à encoder dans Engine + supports

Le `07_KIT_FORMATION_EXCELLENCE` fixe des règles concrètes pour des formations de très grande qualité,
à refléter dans le Formation Engine (grille + prompts) et les supports : structure de journée
(ouverture → modules 90/75 min → clôture avec QCM + plan d'action), **ratio 70/30 pratique/théorie**,
règle des **20 minutes** sans interaction, slides (≤ 3 bullets, ≤ 35 mots, ≥ 28 pt, ≤ 40 slides/jour,
3 couleurs charte), 4 techniques de démo, ateliers 20-30 min, outils interactifs, livrables J0/J+1/J+30,
les 10 erreurs à éviter, cibles (satisfaction > 90 %, réussite QCM > 70 %, plan d'action 100 %).

## 8. Pré-vol projet (AVANT la première migration Prisma) — STOP & ASK

L'autopilot s'insère dans un repo **vivant, partagé, déployé à chaque push `main`**. Avant toute
migration Qualiopi :

1. **Backup/DR (ADR 0032) non commité** : du code/migrations backup/DR sont en attente et `prisma
generate` peut être bloqué (verrou DLL si un `pnpm dev` tourne). **Coordonner avec Will** : soit ce
   chantier est commité/poussé et déployé d'abord, soit on établit une base de migration propre — sinon
   **conflits de numérotation de migrations**. Ne pas mélanger backup/DR et Qualiopi dans un même commit.
2. **Working tree partagé multi-sessions** : `git fetch` + `git log origin/main..HEAD` + `git status`
   avant de commencer ; rebaser sur `origin/main` ; **jamais `--force`** ; **push = deploy (~25-50 min)**.
3. **Numérotation migrations** : timestamp strictement croissant, additif, **jamais `DROP`** ni
   `ALTER ... DISABLE TRIGGER`.
4. **Ne pas toucher** les pages `/interventions/*` (chantier refonte récent) ; **réutiliser** les
   composants formation existants (hero, bandeaux, maillage) pour les fiches publiques.
5. **Collision d'URL** : distinguer les pages-intention **marketing** (`/interventions/*`,
   `/implementation/*`) des **fiches formation réglementaires** publiques. Trancher le schéma d'URL des
   fiches Qualiopi avec Will (ex. `/formations/[slug]`).

## 9. ADR de référence (lire avant de coder)

- **0020** migrations additives/réversibles · **0022/0023** stratégie & criticité backup (Formation/
  Stagiaire = très critiques, rétention ≥ 5 ans) · **0024** AI Act/disclosure · **0025** chiffrement PII
  at-rest (handicap → AES-256-GCM) · **0026** build externalisé + `stub.invalid` · **0032** backup/DR PITR.

## 10. Gates qualité — détail confirmé

`pnpm verify:all` = typecheck, lint, **i18n:check**, **anti-siren**, **anti-hex** (interdit les hex en
dur — applique directement « zéro couleur en dur »), **use-client**, **contrast**, **radius**,
**image-bank:isolation-check**, **test**. Prévoir un **`qualiopi:isolation-check`** analogue (cloisonner
le code Qualiopi sous ses chemins dédiés). Le build prod utilise **`pnpm build --webpack`** — **ne jamais
retirer `--webpack`** (bug Turbopack + `middleware.ts`). Gate A (per-commit) seul bloquant ; Lighthouse =
autorité Web Vitals.
