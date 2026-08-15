# Vérification complémentaire — ce que le premier passage n'avait pas ouvert

**Date** : 15/08/2026, second passage · Complète `AUDIT-OPCO-CHAINE-COMMERCIALE.md`
**Méthode** : lecture statique uniquement. **Aucune mesure n'a été exécutée** — pas de profilage, pas
de `EXPLAIN`, pas de charge simulée. Les constats de volume ci-dessous décrivent la **forme** des
requêtes, pas un temps observé. C'est précisément ce que la fixture volumétrique (§4.0 du plan
console) doit transformer en chiffres.

---

## 1. Ce que le premier audit avait manqué — 4 modules entiers

Le périmètre annoncé à l'étape 1 (« boîte de réception, tunnels, devis, dossiers, barèmes,
financements, cockpit, recouvrement ») m'avait fait ouvrir la moitié du dossier `financements/`.
L'autre moitié existe, et elle est **meilleure que ce que l'audit laissait croire**.

| Module | Ce qu'il fait | Conséquence pour l'audit |
|---|---|---|
| `acompte.ts` | Trois règles de droit hiérarchisées : **CPF** (la CDC paie après service fait → aucun acompte n'a de sens) · **subrogation totale** (réclamer un acompte à qui n'est pas le payeur) · **particulier** (L.6353-6, rien avant les 10 jours) | ✅ Le trou « qui paie quoi et quand » est **déjà traité** au niveau de l'acompte. Mon T5 (clauses absentes) reste vrai pour le **refus** ; il ne l'est pas pour l'acompte. |
| `conditions-client.ts` | Délai / taux d'acompte / mode de facturation, le spécifique primant sur le global, `null` ≠ zéro | ✅ Plafond légal L.441-10 (60 j) porté en constante |
| `rapprochement.ts` | Parse l'export CSV Finom **réel** et suggère les rapprochements, **sans rien écrire** | ⚠️ v1 sans persistance : le pointage bancaire reste un geste manuel. C'est cohérent avec l'avertissement de fraîcheur de `relance-contexte.ts`, mais c'est **le goulot du recouvrement à l'échelle** |
| `fec.ts` + `compta-export.ts` | Export FEC 18 colonnes (art. A.47 A-1 LPF) + CSV compta | ✅ Le dossier de contrôle fiscal existe |
| `e-invoicing/` | Classe le canal réglementaire · adaptateur PA en attente de décision | 🔴 voir V7 ci-dessous |

**Correctif à mon rapport** : je concluais « le contrat manque partout ». C'est vrai des clauses
OPCO ; c'est **faux** de l'échéancier et de l'acompte, qui sont finement traités. La correction est
portée ici plutôt que réécrite dans le rapport, pour ne pas effacer l'historique du raisonnement.

---

## 2. Sept constats de volume — la forme des requêtes

### 🔴 V1 — La liste des sessions charge toute la base, inscriptions comprises

`listSessionsForAdmin()` (`server/qualiopi/presence/queries.ts:173-216`) :

- **aucun `take`, aucun `skip`, aucun `where`** — toutes les sessions, depuis toujours ;
- `include: { enrollments: { select: { tauxPresencePct, statut } } }` — **chaque ligne
  d'inscription** est hydratée… pour calculer une moyenne **en JavaScript** (lignes 190-196) ;
- plus un `_count` par session.

Au volume cible : **1 200 sessions × ~7 inscrits = 8 400 lignes** rapatriées pour afficher
1 200 moyennes. Et rien ne purge : sans `where`, la page **empire linéairement, pour toujours**.

> C'est la forme exacte du défaut **D1** du plan (« liste des sessions jamais chargée en 30 s »).
> Le Lot 0 n'a plus à chercher la cause : il a à la **mesurer**.

Remède : moyenne par agrégat SQL (`groupBy` + `_avg`), pagination, et fenêtre par défaut
(12 mois glissants) avec archives explicites — le motif est déjà en place au hub facturation
(`PAGE_SIZE = 25`, `skip`/`take`, `totalPages`).

### 🔴 V2 — Les trois plafonds trient à l'envers du besoin, et aucun ne le dit

| Écran | Plafond | Tri | Ce qui disparaît en premier |
|---|---|---|---|
| Vue Dossiers | `TAKE_MAX = 200` **par source** (`dossiers-pipeline.ts:52`, appliqué l. 377/406/448/481) | `updatedAt desc` | les dossiers **dormants** |
| « À traiter » | `listAlertes({ limit: 50 })` (`a-traiter/page.tsx:94`) | `createdAt desc` | les alertes **les plus anciennes** |
| Pièces en attente de signature | `take: 30` (`pieces-en-attente.ts:96`) | — | au-delà de 30 |

Le commentaire du pipeline assume le choix : « *sous plafond, on sacrifie les dossiers dormants,
jamais ceux qui bougent* ». À une poignée de dossiers, c'est raisonnable. À 1 200, **un dossier
dormant n'est pas un dossier sans importance : c'est un dossier oublié** — exactement celui que la
vue existe pour rattraper. Le tri « le plus récent d'abord » fait donc disparaître en priorité ce
qu'on a négligé le plus longtemps.

🔴 Et **aucun des trois n'affiche qu'il a tronqué**. Un écran qui montre 200 lignes sur 1 200 sans
le dire ne se lit pas comme incomplet : il se lit comme exhaustif.

### 🔴 V3 — Le moteur d'alertes travaille une alerte à la fois

`synchroniserAlertes()` (`alertes/alertes-service.ts:168-224`) :

1. 28 règles en amont, chacune un `findMany` **sans borne** ;
2. `for (const c of candidats) await creerOuDedup(c)` → **2 aller-retours par candidate**
   (`findFirst` puis `create`, l. 63-82), **en séquence** ;
3. `for (const alerte of alertesOuvertes) await resoudreAlerte(alerte.id)` → un `update` par
   alerte, **en séquence**.

Au volume cible (400 alertes ouvertes), c'est **800+ aller-retours séquentiels** par passage, plus
28 balayages complets. Et la table n'a **pas d'index composite `(code, cibleId, resolue)`**
(`schema.prisma:8181-8185` : `code`, `resolue`, `niveau`, `(cibleType, cibleId)` séparés) ni
**contrainte d'unicité** — la déduplication lecture-puis-écriture est donc aussi une **course** en
cas d'exécution concurrente.

Remède : index composite + `@@unique`, `createMany({ skipDuplicates: true })` pour les créations,
`updateMany` unique pour les résolutions. La logique métier ne bouge pas.

### 🔴 V4 — Une alerte critique = un e-mail, vers une seule adresse

`handleAlertes` (`queue/workers/qualiopi-formation-crons-worker.ts:637-656`) récupère **toutes** les
alertes critiques non notifiées et appelle `notifierAlerteInterne` **une par une**. Le destinataire
(`notifications-service.ts:651-654`) est :

```
QUALIOPI_ALERTE_EMAIL ?? WEEKLY_REPORT_EMAIL ?? "williamsjullin@gmail.com"
```

Aucun regroupement, aucun routage par rôle, et un **repli codé en dur sur une adresse personnelle**.
Un matin à 40 critiques = 40 e-mails dans une boîte.

> ⚠️ **Correction au Lot 14 du plan console.** Il fonde son besoin sur « un canal Telegram unique ».
> Le canal d'alerte interne réellement câblé ici est **l'e-mail, un par alerte**. Le remède du
> Lot 14 (destinataire dérivé, agrégation, désescalade) reste exactement le bon ; la cible à
> corriger n'est pas celle qu'il nomme. À rectifier dans le lot avant de l'exécuter.

### ⚠️ V5 — Inter-entreprises : un dossier de financement pour N financeurs

`creerDossierDepuisSession` (`dossier-financement.ts:130-212`) ne lit que des champs **de session** :
`financementType`, `opcoSubrogation`, `priseEnChargeMontantCents`, `numeroDossierOpco`.

Or `resolveEnrollmentFinancement` (`inter-entreprises.ts:49`) existe **précisément** parce qu'en
inter-entreprises chaque inscription porte son propre financeur — et il n'est utilisé que par la
facturation par participant (`actions/qualiopi/factures-inter.ts:117`). Le dossier de financement,
lui, l'ignore.

À « des centaines d'entreprises clientes », l'inter est le modèle de volume : six entreprises, six
OPCO, et **un seul dossier à un seul payeur**. Le modèle sait pourtant faire (`DossierPayeur` est
multi-payeurs) : c'est le constructeur qui ne s'en sert pas.

### ⚠️ V6 — La file d'e-mails n'a pas de limiteur de débit

`email-worker.ts:174` : `concurrency: 8`, **aucun `limiter`** BullMQ (`{ max, duration }`). Une
vague de convocations J-5 sur 200 inscrits part à pleine vitesse vers le fournisseur d'envoi. La
rétention Redis est bornée (1 000 / 5 000), le **débit** ne l'est pas.

### 🔴 V7 — Facturation électronique : la première échéance est dans 17 jours

`e-invoicing/canal.ts` classe correctement, et `pa-adapter.ts` fige l'interface en attendant le
choix de la Plateforme Agréée (stub explicite si `PA_PROVIDER` absent — décision assumée, pas un
oubli). Mais la chaîne de déduction dit ceci :

- régime configuré = **`assujetti`** (`legal/tva.ts:37`, `REGIME_TVA_DEFAUT`) ;
- donc `exoneree` est **faux** (`canal.ts:50-54`) : la formation **n'est pas** « hors champ
  261-4-4° » ;
- donc un client professionnel français tombe en **`pa_einvoicing`** (l. 60).

Échéances de la réforme, telles que le module lui-même les documente : **réception obligatoire au
1/9/2026**, émission TPE/PME au 1/9/2027.

> Ce n'est **pas** un défaut de code — l'adaptateur est prêt à recevoir une implémentation. C'est
> une **décision de Will avec une date** : choisir la Plateforme Agréée. Le premier audit ne l'avait
> pas vue parce qu'il n'a pas ouvert `e-invoicing/`.

---

## 3. Ce que cette vérification ne couvre toujours pas

Par honnêteté sur les limites, et pour que le prochain passage sache où reprendre :

- **aucune mesure exécutée** — tous les constats de volume sont statiques ;
- `crm/` (tunnels d'entrée) n'a été lu que par ses points d'entrée OPCO ;
- les pages `cockpit-financier`, `pilotage`, `mode-auditeur` n'ont pas été ouvertes ligne à ligne :
  elles relèvent de la **porte d'audit du Lot 12**, pas de celle-ci ;
- la génération du ZIP d'audit (`dossier-session.ts`, boucles séquentielles R2) est connue comme
  lente mais **n'a pas été rechiffrée au volume** — elle est déjà au périmètre du Lot 0.
