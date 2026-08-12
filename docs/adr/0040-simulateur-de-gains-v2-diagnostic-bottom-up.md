# ADR 0040 — Simulateur de gains v2 : diagnostic bottom-up et budget de charge de `/roi`

- **Statut** : Accepted (2026-08-12)
- **Remplace** : le modèle de `/roi` introduit le 2026-07-09
  (`src/components/roi/compute.ts` + `RoiSimulator.tsx`, supprimés).
- **Ne touche pas** : la doctrine d'honnêteté des chiffres (art. L121-2), qui est
  au contraire renforcée ; le SSOT `pricing.ts` ; les gates CI existants.

## Contexte

`/roi` v1 posait deux curseurs et une question centrale : « combien d'heures par
jour vos équipes passent-elles sur des tâches répétitives ? ».

C'est le seul chiffre qu'un dirigeant ne connaît pas. Il répondait donc au jugé,
et **l'intégralité du calcul en découlait**. Le résultat était un montant que
l'utilisateur savait lui-même avoir fabriqué — donc un montant sur lequel il
n'agissait pas. Un simulateur qui demande d'inventer la donnée qui sert ensuite à
impressionner ne convainc personne deux fois.

Deux conséquences pratiques :

1. La sortie était générique. Les mêmes quatre familles de tâches pour tout le
   monde, aucune recommandation, aucun ordre de priorité. Rien à faire lundi
   matin.
2. La page était une maquette bureau repliée sur mobile : deux colonnes hautes
   empilées, un curseur Radix à 250 crans (effectif 1 → 250) impossible à régler
   au pouce, un `<select>` de onze secteurs. Or `/roi` est destinée à recevoir du
   trafic payant, donc majoritairement mobile.

## Décision

### 1. Un diagnostic, pas des curseurs

On ne demande que des grandeurs qu'un dirigeant connaît de tête : combien de
devis par semaine, de factures par mois, d'appels par jour. Le temps est ensuite
**reconstruit par le bas**, tâche par tâche :

```
heures_an = volume_annuel × minutes_unitaires / 60
gain_an   = heures_an × taux_automatisation × facteur_maturité
```

Le référentiel (`src/content/roi/model/tasks.ts`) porte, pour chaque tâche, son
temps unitaire de référence, la part réellement supprimable, l'effort de mise en
œuvre, le délai, et un champ `proofFr` qui justifie le taux. **Toute ligne du
rapport est traçable jusqu'à une fiche du référentiel** : un dirigeant sceptique
peut demander « d'où sort ce chiffre ? » et obtenir une réponse en une phrase.

### 2. Aucune saisie numérique, jamais

Toutes les réponses sont des tranches, en un appui. Un dirigeant ne sait pas
s'il émet 34 ou 41 factures par mois, mais il sait sans hésiter que c'est
« entre 20 et 50 ». La tranche est donc à la fois plus honnête qu'un chiffre
inventé et infiniment plus rapide au pouce — un champ numérique sur mobile ouvre
un clavier, décale la mise en page et fait abandonner.

### 3. « Je ne sais pas » exclut, il n'estime pas

Proposé sur chaque question de volume. La tâche correspondante est alors **retirée
du total plutôt qu'estimée au jugé**. Le rapport annonce donc moins que la
réalité, jamais plus, et le dit explicitement (`unmeasuredFunctions`). C'est la
contrepartie exacte de la promesse de sérieux.

### 4. Trois garde-fous de vraisemblance

- Une tâche sectorielle est écartée hors de ses secteurs, et écartée tout court
  en profil générique : on ne prétend pas connaître un métier que l'utilisateur
  n'a pas nommé.
- Aucun taux d'automatisation ne dépasse 0,9 — il reste toujours la relecture, la
  décision et l'envoi. Un test le verrouille.
- **Plafond de capacité à 60 %** (`CAPACITY_GUARD_SHARE`) : les tâches du
  référentiel ne peuvent jamais représenter plus de 60 % de la capacité de
  l'équipe. Sans lui, un dirigeant de trois personnes cochant partout la tranche
  haute obtenait « 9 ETP récupérés » — arithmétiquement correct, manifestement
  faux, et destructeur de crédibilité en une ligne.

### 5. Le rapport dit ce qui NE s'automatise pas

`src/content/roi/model/non-automatable.ts`. Ce bloc n'est pas une précaution
juridique, c'est un outil de vente : il désamorce la première objection du
dirigeant (« l'IA ne peut pas faire mon métier ») en lui donnant raison avant
qu'il l'ait formulée. Un simulateur qui sait dire non est le seul qu'on croit
quand il dit oui.

### 6. Le rapport reste libre, l'e-mail est un service

Le rapport complet s'affiche sans rien demander — cohérent avec
`isAccessibleForFree` déjà déclaré dans le JSON-LD `WebApplication`. Le
formulaire propose de le **recevoir**, pas de le **débloquer**. Un mur produit du
volume et des adresses jetables ; un service produit des rendez-vous.

L'action serveur **redécode les réponses et recalcule le rapport côté serveur** :
rien de ce que le client affiche n'est repris tel quel dans un e-mail signé de
notre nom.

### 7. Deux habillages, un seul moteur

- `/roi` — page canonique, indexée, avec tout le contenu éditorial (mode
  d'emploi, hypothèses, secteurs, villes, FAQ).
- `/simulateur` — variante tunnel, **`noindex`**, sans en-tête ni pied de page
  (technique CSS `:has()` du layout admin et de `/carrieres/widget`, qui évite
  d'appeler `headers()` dans le layout racine). Retirée du sitemap via
  `EXCLUDED_FROM_INDEX`. En trafic payant, chaque lien du méga-menu est une fuite.

### 8. Les réponses vivent dans l'URL

`?d=<réponses>&r=1`, mis à jour par `history.replaceState` — donc sans jamais
déclencher de `popstate`, donc sans re-rendu de route Next : sur mobile en 4G, un
aller-retour serveur par question serait rédhibitoire.

Le lien est un **contrat public** : les codes de `src/lib/roi/encode.ts` ne sont
jamais renommés, seulement étendus, et `ENCODING_VERSION` tranche en cas de
changement de grammaire. Un dirigeant envoie le lien à son associé le lundi,
celui-ci l'ouvre le vendredi après un déploiement : il doit voir le même rapport.
Ce partage interne est le canal de diffusion le plus efficace du rapport, et le
seul qui soit gratuit.

## Budget de charge — l'exception demandée

`AGENTS.md` fixe **First Load JS ≤ 75 KB gz / route** et exige un ADR pour toute
dégradation.

Le simulateur v2 embarque côté client le référentiel de tâches, le questionnaire,
le moteur de diagnostic et le rapport. **Ce choix est volontaire** : il permet le
recalcul instantané à chaque appui et fonde la promesse affichée à l'utilisateur
(« tout se calcule dans votre navigateur, rien n'est transmis »). L'alternative —
une action serveur par question — coûterait un aller-retour réseau par écran sur
mobile, exactement là où le parcours doit être le plus fluide.

**Mesure disponible à ce jour** : la source des modules embarqués pèse 26 Ko
gzippés commentaires retirés (39 Ko commentaires compris). Après minification, la
contribution réelle est sensiblement inférieure, et elle **remplace** la v1
(`RoiSimulator` + `compute.ts` + curseur Radix + `Label` Radix).

⚠️ **Ce chiffre est une estimation, pas une mesure de bundle.** Le delta réel
n'a pas été mesuré : un `next build` complet du dépôt (17 629 routes, ~25 min) n'a
pas été lancé en local. À vérifier au premier build CI. Deux atténuations
existent déjà :

- `/roi` **n'est pas** dans les 12 URLs de `lighthouserc.json` : le gate LHCI ne
  la couvre pas.
- Les gates `size-limit` et `lhci` PR-time sont déclarés **non bloquants** dans
  `ci.yml` depuis le 2026-05-29 et le 2026-07-01.

Si le delta mesuré dépassait franchement le budget, la découpe évidente est de
charger `ReportView` en `next/dynamic` : il ne sert qu'après la dernière
question, donc jamais au premier rendu.

## Conséquences

- **Supprimé** : `src/components/roi/{RoiSimulator.tsx,compute.ts,compute.test.ts}`.
- **Nouveau modèle** : `src/content/roi/model/` (types, fonctions et grandeurs,
  référentiel, non-automatisable, questionnaire).
- **Nouveau moteur** : `src/lib/roi/{diagnose.ts,encode.ts}` — pur, sans I/O,
  utilisable client, serveur et test.
- **Nouveau parcours** : `src/components/roi/v2/`.
- **Nouveau canal** : template e-mail `roi-report` + action
  `src/features/roi-report/actions.ts` (mêmes protections que `unified-contact` :
  rate-limit dur, honeypot dur, Turnstile souple).
- **111 tests** verrouillent le modèle, dont une suite `realism.spec.ts` qui borne
  les montants annoncés sur quatre archétypes d'entreprise. Ces bornes sont
  larges à dessein : elles n'imposent pas une valeur, elles interdisent
  l'absurde. Si l'une casse, la bonne question n'est pas « comment faire repasser
  le test » mais « ce chiffre est-il défendable devant un dirigeant ? ».

## Ce qui reste ouvert

- **Rendu mobile non validé visuellement.** L'extension Chrome refuse les
  adresses `localhost` / `127.0.0.1`, donc aucune capture réelle n'a pu être
  prise. Le rendu HTML des deux routes a été vérifié servi (200, contenu
  attendu), mais pas l'apparence. À faire avant d'envoyer du trafic payant.
- **Delta de bundle non mesuré** (cf. ci-dessus).
- **Pas de PDF.** L'e-mail porte les chiffres et le plan dans son corps, plus le
  lien permanent. Un PDF joint (via `@react-pdf/renderer`, déjà présent pour les
  documents Qualiopi) est un ajout possible, pas un prérequis.
- **Vidéo explicative par avatar** : hors périmètre de cet ADR. Le rapport produit
  déjà une sortie structurée (tâches typées, chiffres nommés) exploitable comme
  script. Le studio `generation_videos` est un pipeline de post-production — il
  ne synthétise ni voix ni avatar et exige du tournage réel en entrée.
