# A5-03 — Suivi Campagnes Actives — Score 42/100

Audit AUDIT-ONLY — 2026-05-21. Zéro commit, zéro modification.

---

## Fichiers inspectés

| Fichier | Statut |
|---------|--------|
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/_v2/CoverageListV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/[id]/_v2/CoverageDetailV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/queue/_v2/QueueV2.tsx` | Lu |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/_v2/JobsListV2.tsx` | Lu |
| `src/server/actions/content-gen/coverage.ts` | Lu |
| `src/app/api/content-gen/jobs/[id]/stream/route.ts` | Lu |
| `src/app/api/content-gen/` (glob complet) | Audité |

Routes API `campaigns/[id]/pause` et `campaigns/[id]/resume` : **ABSENTES** (glob `src/app/api/content-gen/campaigns/**` = 0 résultat).

---

## État actuel

### CoverageListV2 (vue liste)
Vue tableau statique (`<table>`), colonnes : Nom, Secteur, Scope, Cible, Statut, Gen/Pub/Fail, Coût est., Créée.
- Aucun bouton pause/resume sur les lignes de la liste.
- Aucune barre de progression visuelle.
- Pas d'ETA affichée.
- Statut affiché en texte brut (pas de badge coloré `running` vs `paused`).
- Layout : liste verticale tableau, une ligne par campagne. Pas de cartes côte à côte.

### CoverageDetailV2 (vue détail)
Server Component avec Server Actions inline.
- Boutons pause/resume/cancel/addSlots présents MAIS uniquement en page détail (navigation requise via clic sur nom dans la liste).
- Avancement : `{generatedCount} / {totalTargetCount} ({progressPct} %)` en texte `<p>`, sans barre `<progress>` ni composant graphique.
- Coût estimé affiché : `$X.XX` si `estimatedCostUsd` non null, sinon `—`.
- Durée estimée affichée : `{estimatedDurationMinutes} min` si non null, sinon `—`.
- Pas de calcul d'ETA dynamique basé sur velocity réelle (pas de `startedAt` + velocity = articles/minute).
- Pas de compteurs BullMQ live sur cette page.

### QueueV2 (vue queue globale)
Vue BullMQ globale (running/waiting/failed) — non filtrée par campagne.
- Compteurs globaux affichés par statut (running.total, waiting.total, failed.total).
- Tableau des 20 premiers jobs par statut avec lien vers détail.
- Pas de vue filtrable par campaignId.
- Description explicite : "La vraie vue Redis arrivera Sprint 6."

### API content-gen
- `GET /api/content-gen/jobs/[id]/stream` : SSE par job individuel (logs + status polling 3s), pas par campagne.
- Pas de route `PATCH /api/content-gen/campaigns/[id]/pause`.
- Pas de route `POST /api/content-gen/campaigns/[id]/resume`.
- Pas de route `GET /api/content-gen/campaigns/[id]/jobs` (jobs par campagne en live).

### Server Actions coverage.ts
- `pauseCampaign(id)` : Server Action correcte (flip status + purge BullMQ queued + audit log SOC2).
- `resumeCampaign(id)` : Server Action correcte (flip status + historique pause + audit log).
- `cancelCampaign(id, mode)` : deux modes `running_only` / `all`.
- `estimateCampaign(input)` : calcul coût/durée disponible AVANT lancement, non ré-utilisé en cours de campagne.
- `incrementCampaignTarget(id, delta)` : ajout slots disponible en running/paused.

---

## Gaps identifiés

### P0 (bloquant)

**P0-1 : Aucun bouton pause/resume dans la vue liste.**
La liste campagnes (`CoverageListV2`) n'expose pas d'action rapide. Pour pauser une campagne running, l'admin doit cliquer sur son nom, naviguer vers la page détail, puis cliquer sur le bouton. Friction maximale pour la gestion opérationnelle multi-campagnes.

**P0-2 : Progress bar absente — affichage purement textuel.**
`progressPct` est calculé dans `CoverageDetailV2` mais rendu uniquement en `<p>`. Aucun composant `<progress>` ni équivalent CSS. Idem dans `CoverageListV2` : colonne "Gen/Pub/Fail" affiche `X / Y / Z` sans barre. La lecture rapide de l'avancement est impossible en tableau multi-lignes.

**P0-3 : Pas d'ETA dynamique basée sur la velocity réelle.**
`estimatedDurationMinutes` est stocké en DB (saisi à la création, via `estimateCampaign`), mais c'est une estimation statique pre-lancement. Il n'y a pas de calcul live `(totalTargetCount - generatedCount) / velocity_actuelle` pour projeter une fin réelle. Le champ `startedAt` est disponible mais non exploité pour ce calcul.

### P1 (important)

**P1-1 : BullMQ jobs non filtrés par campagne.**
`QueueV2` affiche une vue globale (toutes campagnes confondues). Il n'existe pas de vue "jobs de la campagne X" dans `CoverageDetailV2`. Le lien vers `/content-gen/jobs` (filtre `campaignId`) n'est pas présent dans la page détail campagne.

**P1-2 : Statut sans badge coloré dans la liste.**
Le statut (`running`, `paused`, `completed`, etc.) est affiché en texte brut dans `CoverageListV2`. Un badge coloré (vert/orange/rouge) permettrait une lecture visuelle immédiate de l'état de la flotte de campagnes.

**P1-3 : Pas de lien direct "Voir jobs" depuis CoverageDetailV2.**
La page détail n'inclut pas de lien vers `/content-gen/jobs?campaignId=X` ni de compteur live des jobs en cours pour cette campagne. L'admin doit naviguer manuellement vers `/content-gen/queue`.

**P1-4 : Vue liste non-réactive (Server Component pur).**
`CoverageListV2` est un Server Component sans ISR courte ni polling client. Pour voir l'avancement d'une campagne running, l'admin doit recharger manuellement la page.

**P1-5 : Pas de confirmation avant pause/cancel.**
Les Server Actions `pause`, `cancelRunningOnly`, `cancelAll` s'exécutent directement sans dialog de confirmation. Un clic accidentel sur "Annuler (all)" détruit tous les jobs non publiés.

### P2 (nice-to-have)

**P2-1 : Multi-campagnes côte à côte non implémenté.**
`CoverageListV2` est un tableau `width="wide"` vertical. Un layout grid 2-3 cartes côte à côte permettrait de comparer visuellement des campagnes parallèles (ex: `running` interventions vs `running` audits).

**P2-2 : Velocity/débit non calculé.**
Pas d'affichage "X articles/heure" calculé depuis `startedAt` + `generatedCount`, alors que les deux champs sont disponibles en DB.

**P2-3 : SSE par campagne absent.**
La route SSE `/api/content-gen/jobs/[id]/stream` fonctionne par job individuel. Il n'existe pas de stream SSE par campagne pour pousser les mises à jour `generatedCount` en temps réel vers la vue liste/détail.

**P2-4 : `estimatedCostUsd` non mis à jour en cours d'exécution.**
La valeur est celle estimée pre-lancement. Pas d'accumulation des `costUsd` réels des jobs terminés pour afficher un coût réel vs estimé.

**P2-5 : Pas de lien Bull Dashboard externe.**
`QueueV2` note explicitement "La vraie vue Redis arrivera Sprint 6" mais ne fournit pas de lien vers un éventuel Bull Board ou Arena déjà déployé.

---

## Scoring détaillé

| Critère | Max | Score | Justification |
|---------|-----|-------|---------------|
| C1 Pause/Resume inline | 30 | 20 | Pause/resume disponible via Server Actions mais UNIQUEMENT en page détail. Boutons absents de la liste. Pas d'action optimiste (Server Action = navigation complète). API REST absente. Fonctions `pauseCampaign` / `resumeCampaign` robustes (BullMQ purge + SOC2 audit log). |
| C2 Progress bar | 25 | 8 | `progressPct` calculé + affiché en texte `(XX %)` dans CoverageDetailV2. Colonne Gen/Pub/Fail dans la liste. Aucune barre visuelle `<progress>` ni composant graphique. |
| C3 ETA et coût estimé | 20 | 8 | `estimatedCostUsd` et `estimatedDurationMinutes` affichés dans la page détail. Pas d'ETA dynamique (velocity réelle absente). Valeurs statiques pre-lancement uniquement. `startedAt` disponible mais non exploité pour ETA live. |
| C4 BullMQ jobs visibles | 15 | 6 | QueueV2 affiche compteurs globaux running/waiting/failed + tableau 20 premiers jobs par statut. Mais vue non filtrée par campagne. SSE par job disponible. Pas de retry inline (retry via bouton global "Retry all failed"). |
| C5 Multi-campagnes | 10 | 0 | Vue liste plate (`<table>` vertical). Pas de layout grid/cartes côte à côte. Pas de vue expansible. |
| **TOTAL** | **100** | **42** | |

---

## Recommandations P0 urgentes

### R-P0-1 : Ajouter boutons pause/resume inline dans CoverageListV2

Modifier `CoverageListV2` pour ajouter une colonne "Actions" avec des `<form action={...}>` conditionnels :
```tsx
// Dans le <tr> de chaque campagne :
{r.status === "running" && (
  <form action={pauseInline.bind(null, r.id)}>
    <button type="submit" className="admin-button-ghost admin-button-sm">Pause</button>
  </form>
)}
{r.status === "paused" && (
  <form action={resumeInline.bind(null, r.id)}>
    <button type="submit" className="admin-button admin-button-sm">Reprendre</button>
  </form>
)}
```
Les Server Actions `pauseCampaign` / `resumeCampaign` existent déjà dans `coverage.ts`, aucune nouvelle logique nécessaire.

Effort estimé : **1-2h**.

### R-P0-2 : Ajouter barre de progression visuelle

Dans `CoverageListV2`, remplacer la colonne "Gen/Pub/Fail" par un composant avec `<progress>` :
```tsx
<td>
  <div className="flex flex-col gap-1">
    <progress value={r.generatedCount} max={r.totalTargetCount} className="admin-progress w-full" />
    <span className="admin-meta-small">
      {r.generatedCount}/{r.totalTargetCount} · pub {r.publishedCount} · fail {r.failedCount}
    </span>
  </div>
</td>
```
Dans `CoverageDetailV2`, remplacer le `<p>` texte par le même composant.

Effort estimé : **1h**.

### R-P0-3 : ETA dynamique basée sur velocity réelle

Dans `CoverageDetailV2`, ajouter le calcul :
```tsx
const now = new Date();
const elapsedMin = campaign.startedAt
  ? (now.getTime() - campaign.startedAt.getTime()) / 60000
  : null;
const velocity = elapsedMin && elapsedMin > 1
  ? campaign.generatedCount / elapsedMin
  : null; // articles/minute
const remaining = campaign.totalTargetCount - campaign.generatedCount;
const etaMin = velocity && velocity > 0 ? Math.ceil(remaining / velocity) : null;
```
Afficher : "ETA : ~Xh Ym (velocity X articles/heure)" dans la carte "Avancement".

Effort estimé : **1h** (calcul serveur pur, pas de dépendance externe).

---

*Audit réalisé en lecture seule — aucun fichier source modifié.*
