# 14 — EDITORIAL PIPELINE, CALENDRIER, HEALTH DASHBOARD, QUALITY SCORE — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (section Agent 14, ~ligne 357)
> Agent : 14 — Editorial pipeline, calendrier, health dashboard, quality score
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, aucun code écrit)
> Référence : HEAD `main` (commit `95bba36`)
> Inputs amont : `00-REALITY-CHECK.md`, `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`, `src/app/[locale]/(admin)/[adminPrefix]/calendrier/page.tsx`, `src/content/interventions-taxonomy.ts`

---

## 0. TL;DR

L'Agent 14 conçoit la **couche éditoriale humaine** qui se superpose au workflow technique sans le remplacer. Trois livrables :

1. **Pipeline éditorial 8 états** (`Idea → Brief → Draft → Review → Approved → Scheduled → Published → Archived`) **cohabitant** avec le `status` workflow technique 7 états d'Agent 8 (`draft / review / approved / scheduled / published / archived / deprecated`). Mapping clair : `pipelineStage` couvre **l'amont** éditorial (Idea, Brief — phases humaines avant que le contenu existe), `status` technique couvre **l'aval** (Approved → publication — phases machine de cycle de vie). Aucune fusion : ce sont deux axes orthogonaux d'une même entrée.
2. **Calendar view `/connaissances/calendrier`** custom CSS grid 7×N (pas FullCalendar/react-big-calendar — perf et cohérence design), drag-drop reschedule, code couleur par `type` + opacity par `pipelineStage`, filtres auteur/reviewer/type/domain.
3. **Health dashboard `/connaissances/sante`** 8 panneaux KPIs + content gap matrix + top entries.

Plus : **quality score /100** 10 critères paramétrés par type via SSOT `quality-thresholds.ts`, bloquant publish sous seuil avec override admin loggé, surface live en éditeur. Reviewer assignment round-robin par domain avec ownership + escalade 48h. Notifications email + Telegram redacté PII + badge in-app.

---

## 1. PIPELINE ÉDITORIAL — DEUX AXES COMPLÉMENTAIRES

### 1.1 Doctrine : cohabitation, pas fusion

Deux dimensions distinctes d'une entrée KB :

- **Pipeline éditorial** (`pipelineStage`) — état humain de la chaîne de production : « cette idée est-elle prête, briefée, rédigée, relue ? ». Sémantique **process humain**, pas accessibilité publique.
- **Status workflow technique** (`status`, Agent 8) — état du cycle de vie machine de l'entrée : « cette entrée est-elle publiable, publiée, archivée, dépréciée ? ». Sémantique **lifecycle technique**, conditionne le rendu public.

Anti-pattern à éviter (mentionné explicitement §367 du prompt) : **un seul champ d'état mélangé**, où « Brief » et « draft » se court-circuitent, où « Review » éditorial et « review » technique se chevauchent sans contrat clair. La cohabitation rend chaque axe **monosémantique** et permet l'évolution indépendante (on peut changer le pipeline éditorial sans casser le rendu public, et inversement).

### 1.2 États pipeline éditorial (`pipelineStage`)

| Stage       | Description sémantique                                                                                        | Qui agit           | Sortie attendue                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------- |
| `idea`      | Idée capturée (titre + 1 phrase). Pas encore de plan, pas de mot-clé cible.                                   | OWNER, EDITOR      | Idée scoreable (priorité, intérêt SEO/audience) |
| `brief`     | Brief rédigé : `targetKeyword`, `targetWordCount`, angle, audience, sources à citer, lien `assignedAuthorId`. | EDITOR             | Auteur peut démarrer la rédaction               |
| `draft`     | Rédaction en cours. Tiptap JSON présent, partiellement complet.                                               | AUTHOR (assigné)   | Brouillon prêt pour relecture                   |
| `review`    | Soumis pour relecture. `assignedReviewerId` défini.                                                           | REVIEWER (assigné) | Verdict OK / changes requested                  |
| `approved`  | Relecture OK, prêt à programmer ou publier.                                                                   | REVIEWER → EDITOR  | Verrouillage du contenu, planification          |
| `scheduled` | Programmé pour publication future (`scheduledFor` défini).                                                    | EDITOR             | Cron déclenche publish à l'heure prévue         |
| `published` | Visible publiquement.                                                                                         | (auto)             | Entrée live sur surface publique                |
| `archived`  | Retirée du pipeline actif. Pas de plus d'évolution éditoriale prévue.                                         | EDITOR/OWNER       | Entrée hors-pipeline, conserve historique       |

### 1.3 États workflow technique (`status`, Agent 8 — rappel)

`draft / review / approved / scheduled / published / archived / deprecated`

`deprecated` est **exclusif au technique** (entrée encore visible mais marquée obsolète SEO/HCU). Pas d'équivalent pipeline éditorial.

### 1.4 Mapping pipeline ↔ status — table de cohabitation

| `pipelineStage` | `status` typique attendu | Notes                                                                      |
| --------------- | ------------------------ | -------------------------------------------------------------------------- |
| `idea`          | `draft`                  | Entrée existe en DB avec metadata minimale, body vide ou stub.             |
| `brief`         | `draft`                  | Body toujours vide, mais `briefMarkdown` rempli.                           |
| `draft`         | `draft`                  | Body Tiptap en cours.                                                      |
| `review`        | `review`                 | Verrouillage Agent 8 actif. Reviewer notifié.                              |
| `approved`      | `approved`               | Quality score gate passé.                                                  |
| `scheduled`     | `scheduled`              | `scheduledFor` synchronisé entre les deux axes.                            |
| `published`     | `published`              | (auto) cron publie.                                                        |
| `archived`      | `archived`               | Symétrie totale.                                                           |
| (n/a)           | `deprecated`             | Aucune valeur `pipelineStage` ne correspond — c'est un état technique pur. |

**Invariant à enforcer** (Agent 8 ou helper dédié `lib/knowledge/state-transitions.ts`) : transitions de `pipelineStage` autorisées séquentielles vers l'avant, retour arrière possible **uniquement vers `draft` ou `brief`** (rework demandé par reviewer). Tentative `published → draft` interdite (passer par `archived` ou créer une nouvelle révision via `KnowledgeVersion` Agent 8).

**Pas de fusion en DB** : on garde **les deux champs** sur `KnowledgeEntry`. Le coût est ~4 bytes d'enum supplémentaires, le gain est la lisibilité et la maintenabilité.

### 1.5 Anti-patterns explicites

- Pipeline fusionné avec workflow technique → cf. §1.1.
- Pipeline = ENUM Postgres global partagé avec `PublishStatus` booking → polluer l'enum cross-domaine. **Créer `KbPipelineStage` dédié**, comme la recommandation reality check pour `KbStatus`.
- Stocker `pipelineStage` côté client (localStorage) → toute machine état doit vivre côté serveur, Postgres + ActivityLog source de vérité.

---

## 2. CHAMPS PRISMA ADDITIONNELS — `KnowledgeEntry`

Champs à ajouter au modèle `KnowledgeEntry` défini en Agent 1, **en plus** de `status`, `type`, `audience`, `confidentiality`, `domain`, etc.

```prisma
model KnowledgeEntry {
  // ... champs Agent 1 ...

  // ===== Pipeline éditorial (Agent 14) =====
  pipelineStage      KbPipelineStage   @default(idea)
  briefMarkdown      String?           @db.Text         // brief court éditeur, ≤ 4 000 chars
  targetKeyword      String?           @db.VarChar(200) // mot-clé cible SEO
  targetWordCount    Int?              @default(0)      // 0 = pas de cible
  scheduledFor       DateTime?         // pour pipelineStage='scheduled'

  assignedAuthorId   String?           // FK Author (KnowledgeAuthor selon Agent 12)
  assignedReviewerId String?           // FK AdminUser (REVIEWER role)
  reviewerEscalatedAt DateTime?        // tampon de la dernière escalade (≥ 48h sans verdict)

  assignedAuthor     KnowledgeAuthor?  @relation("assignedAuthor", fields: [assignedAuthorId], references: [id])
  assignedReviewer   AdminUser?        @relation("assignedReviewer", fields: [assignedReviewerId], references: [id])

  @@index([pipelineStage, status])     // dashboard filter
  @@index([scheduledFor])              // cron publish lookup
  @@index([assignedReviewerId, pipelineStage]) // « mes reviews en attente »
  @@index([assignedAuthorId, pipelineStage])   // « mes drafts »
}

enum KbPipelineStage {
  idea
  brief
  draft
  review
  approved
  scheduled
  published
  archived
}
```

**Décisions justifiées** :

- `briefMarkdown` en `Text` (pas Tiptap JSON) — c'est un brief interne, pas du contenu publiable. Markdown plain suffit, pas besoin du surcoût Tiptap. Le rendu admin se fait via lib légère type `marked` côté serveur (RSC).
- `targetWordCount` `Int?` — `null` ou `0` = pas de cible explicite, quality score utilise alors le seuil par type. Permet de surcharger ponctuellement (ex : FAQ rapide vs FAQ longue).
- `scheduledFor` `DateTime?` — `null` quand pas `scheduled`. **Toujours stocké en UTC** (Postgres natif), conversion timezone client uniquement à l'affichage.
- `reviewerEscalatedAt` — pour éviter de spammer le manager si l'escalade a déjà eu lieu (lock de 7 j minimum entre deux escalades).
- Index `(scheduledFor)` partiel souhaité (`WHERE pipelineStage = 'scheduled' AND scheduledFor IS NOT NULL`), Prisma migration script raw SQL.

---

## 3. CALENDAR VIEW — `/fr/<adminPrefix>/connaissances/calendrier`

### 3.1 Décision lib — custom CSS grid recommandé

Trois options évaluées :

| Lib                                                  | Taille bundle gz                          | Pros                                                                                          | Cons                                                                            | Verdict           |
| ---------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------- |
| `react-big-calendar`                                 | ~85 KB gz + moment.js ~25 KB              | Mature, drag-drop natif                                                                       | Lourd (>budget /admin), styling override coûteux, dépendance moment.js obsolète | **Refusé**        |
| `fullcalendar`                                       | ~120 KB gz (core + dayGrid + interaction) | Très complet, plugins drag-drop                                                               | Encore plus lourd, jQuery legacy en certains chemins, dual licensing premium    | **Refusé**        |
| **Custom CSS grid 7×N + drag handlers natifs HTML5** | ~3-5 KB gz code Axion-IA                  | Perf optimale, cohérence design 100%, contrôle total accessibility, pas de dépendance externe | À écrire (estimation 4-6 h dev)                                                 | **✅ Recommandé** |

Le calendrier admin existant `(admin)/[adminPrefix]/calendrier/page.tsx` (booking) utilise exactement ce pattern : `buildMonthGrid(year, month)` produit un tableau de 42 cells, rendu en CSS grid (`admin-calendar-grid` classes). **Le KB calendar réutilise ce squelette** + helpers communs extraits dans `src/lib/calendar-grid.ts` (mutualisation booking + KB).

Bénéfices alignement design system :

- Réutilise `admin-calendar-cell`, `admin-calendar-cell-today`, `admin-badge-*` existantes.
- Cohérence visuelle avec le calendrier booking (Will reconnaît immédiatement le pattern).
- 0 KB JS ajouté côté client tant qu'on est en SSR (cells rendues serveur).

### 3.2 Maquette ASCII mensuelle

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Mai 2026                                                              ← Avril  ⌂  Juin →       │
│  12 contenus programmés sur ce mois                                                              │
│                                                                                                  │
│  Filtres : [ Tous types ▾ ] [ Tous auteurs ▾ ] [ Tous reviewers ▾ ] [ Tous domains ▾ ]  ✕ Reset  │
├─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐                           │
│   Lun   │   Mar   │   Mer   │   Jeu   │   Ven   │   Sam   │   Dim   │                           │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤                           │
│         │         │         │         │   1     │   2     │   3     │                           │
│         │         │         │         │ ░Manon  │         │         │  ░ = draft (opacity 30%) │
│         │         │         │         │ article │         │         │                           │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤                           │
│   4     │   5     │   6     │   7     │   8     │   9     │  10     │                           │
│ ■Manon  │         │ ▓Pierre │ ■Manon  │         │         │         │  ■ = scheduled (full)    │
│ guide   │         │ case_st │ article │         │         │         │  ▓ = review (opacity 60%)│
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤                           │
│  11     │ [HOY] 12│  13     │  14     │  15     │  16     │  17     │                           │
│         │ ■■■     │ ■Manon  │         │ ▓Sophie │         │         │  [HOY] = today highlight │
│         │ 3 items │ faq     │         │ glossary│         │         │  ■■■ = stack 3+ items   │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤                           │
│  18     │  19     │  20     │  21     │  22     │  23     │  24     │                           │
│         │         │         │ ■Manon  │         │         │         │                           │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤                           │
│  25     │  26     │  27     │  28     │  29     │  30     │  31     │                           │
│         │         │         │         │ ▓ Manon │         │         │                           │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘                           │

Légende couleurs (par type) :
  ■ bleu    = article            ■ vert     = case_study
  ■ violet  = guide              ■ orange   = glossary_term
  ■ rouge   = doctrine           ■ jaune    = faq
  ■ gris    = help_article       ■ rose     = playbook

Légende opacity (par pipelineStage) :
  ░ 30% = draft     ▒ 45% = review     ▓ 60% = approved     ■ 100% = scheduled
```

### 3.3 Cell rendering — structure HTML/CSS

```tsx
<div
  className="admin-calendar-cell kb-cell"
  data-date={dateKey} // 2026-05-12
  data-stage="scheduled" // pour drag handlers
  draggable={canReschedule} // OWNER/EDITOR uniquement
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
>
  <div className="admin-calendar-cell-date">12</div>
  <ul className="kb-cell-entries">
    {entries.map((e) => (
      <li
        key={e.id}
        className={`kb-cell-entry kb-type-${e.type} kb-stage-${e.pipelineStage}`}
        title={`${e.title} — ${e.assignedAuthor?.name ?? "—"}`}
        style={{ opacity: STAGE_OPACITY[e.pipelineStage] }}
      >
        <Link href={`/fr/${prefix}/connaissances/${e.id}`}>
          {e.assignedAuthor?.initials ?? "?"} {e.type}
        </Link>
      </li>
    ))}
    {entries.length > 3 && <li className="kb-cell-more">+ {entries.length - 3} autres</li>}
  </ul>
</div>
```

CSS extrait :

```css
.kb-cell-entry {
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 2px;
}
.kb-type-article {
  background: var(--kb-blue);
}
.kb-type-case_study {
  background: var(--kb-green);
}
.kb-type-guide {
  background: var(--kb-violet);
}
.kb-type-glossary_term {
  background: var(--kb-orange);
}
.kb-type-doctrine {
  background: var(--kb-red);
}
.kb-type-faq {
  background: var(--kb-yellow);
}
.kb-type-help_article {
  background: var(--kb-gray);
}
.kb-type-playbook {
  background: var(--kb-pink);
}
```

(Variables CSS terracotta-compatibles : dérivées de la palette Axion-IA, contrast ≥ 4.5:1 avec texte sombre — A11y AA via `axionia_contrast_check`.)

### 3.4 Drag-drop reschedule

Implémentation HTML5 native (pas react-dnd, trop lourd) :

```ts
// server action — src/server/actions/knowledge/reschedule.ts
"use server";

export async function rescheduleEntryAction(formData: FormData) {
  const session = await auth();
  requireRole(session, ["OWNER", "EDITOR"]);

  const entryId = formData.get("entryId") as string;
  const newDate = formData.get("newDate") as string; // YYYY-MM-DD
  const newTime = formData.get("newTime") as string | null; // HH:mm UTC

  const scheduledFor = parseScheduledFor(newDate, newTime); // helper UTC

  // Garde-fou : ne peut être que pipelineStage='scheduled' ou 'approved'→'scheduled'
  const entry = await prisma.knowledgeEntry.findUniqueOrThrow({ where: { id: entryId } });
  if (!["approved", "scheduled"].includes(entry.pipelineStage)) {
    throw new Error("Cannot reschedule entry that is not approved or scheduled");
  }

  await prisma.knowledgeEntry.update({
    where: { id: entryId },
    data: {
      pipelineStage: "scheduled",
      scheduledFor,
      status: "scheduled", // sync workflow technique
    },
  });

  await logActivity({
    action: "kb.entry.rescheduled",
    targetType: "KnowledgeEntry",
    targetId: entryId,
    actorId: session.user.id,
    changes: {
      scheduledFor: { from: entry.scheduledFor, to: scheduledFor },
    },
  });

  revalidatePath(`/fr/${adminPrefix}/connaissances/calendrier`);
  return { success: true };
}
```

Côté client (composant `<CalendarCellDraggable>` minimal) :

```tsx
"use client";
function handleDrop(e: React.DragEvent) {
  e.preventDefault();
  const entryId = e.dataTransfer.getData("kb-entry-id");
  const newDate = e.currentTarget.dataset.date!;
  const fd = new FormData();
  fd.set("entryId", entryId);
  fd.set("newDate", newDate);
  startTransition(() => rescheduleEntryAction(fd));
}
```

**Optimistic UI** : déplace l'item visuellement immédiatement, rollback si l'action serveur rejette.

### 3.5 Filtres

URL searchParams (server-driven, pas state client) :

```
?type=article&author=manon&reviewer=will&domain=interventions
```

Combinables. Query Prisma ajoute des `where` conditionnels. Reset = lien sans params.

Filtres affichés en form GET avec `<select>` simples (pas combobox custom — perf).

### 3.6 Vue alternative : semaine / agenda

V1 = mois uniquement. V1.5 = vue semaine (7 colonnes × 24 lignes heures, mais densité scheduling KB rarement intraday) et vue agenda liste (`<table>` triée par `scheduledFor`).

---

## 4. HEALTH DASHBOARD — `/fr/<adminPrefix>/connaissances/sante`

### 4.1 Vue d'ensemble

Page server component, données calculées à la requête (cache 60s via `unstable_cache`). 8 panneaux + 2 sections complémentaires (top + gap matrix).

### 4.2 Les 8 panneaux KPIs

| #   | Panneau                         | Calcul SQL résumé                                                                                                                                                                                                          | Seuil alerte                   | Action                                    |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------- |
| (a) | **Review overdue > 12 mois**    | `COUNT(*) WHERE lastReviewedAt < NOW() - INTERVAL '12 months' AND status = 'published'`                                                                                                                                    | > 0 = warning, > 10 = critical | Lien vers liste filtrée                   |
| (b) | **Entrées sans translation EN** | `COUNT(*) FROM kb_entries WHERE type IN ('article','case_study','guide') AND status='published' AND NOT EXISTS (SELECT 1 FROM kb_translations WHERE entry_id = kb_entries.id AND locale = 'en' AND body_text IS NOT NULL)` | > 5 = warning                  | Bulk action « générer brouillon EN » V1.5 |
| (c) | **Sans coverImage**             | `COUNT(*) WHERE coverImageId IS NULL AND type IN ('article','case_study','guide','playbook')` (FAQ exempté)                                                                                                                | > 0                            | Filtre vers liste « action manquante »    |
| (d) | **Sans relations**              | `COUNT(*) WHERE NOT EXISTS (SELECT 1 FROM kb_relations WHERE source_id = kb_entries.id OR target_id = kb_entries.id)`                                                                                                      | > 20% du total = warning       | Helper IA V1.5 « suggérer relations »     |
| (e) | **Quality score < seuil**       | `COUNT(*) WHERE quality_score < threshold_for_type(type)`                                                                                                                                                                  | > 0                            | Lien vers liste avec breakdown            |
| (f) | **Tags orphelins**              | `COUNT(*) FROM kb_tags WHERE NOT EXISTS (SELECT 1 FROM kb_entries_tags WHERE tag_id = kb_tags.id)`                                                                                                                         | > 10                           | Bulk action « purger »                    |
| (g) | **Liens cassés**                | `COUNT(*) FROM kb_broken_links WHERE resolved_at IS NULL` (rempli par cron `knowledge-broken-links.ts`)                                                                                                                    | > 0 = warning                  | Liste détaillée avec URL + entrée         |
| (h) | **Content gap matrix**          | `SELECT type, domain, COUNT(*) FROM kb_entries WHERE status='published' GROUP BY type, domain` rendu en grille                                                                                                             | cellule = 0 → opportunité      | Lien vers création                        |

### 4.3 Maquette ASCII dashboard

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  Santé de la base de connaissances                              Mis à jour 12:34 (UTC+2)│
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                     │
│  │ Review > 12m │ │ Sans EN     │ │ Sans cover  │ │ Sans relation│                     │
│  │     ⚠ 7      │ │     ⚠ 12    │ │     ✓ 0     │ │     ⚠ 23    │                     │
│  │ → voir liste │ │ → générer   │ │             │ │ → suggérer  │                     │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘                     │
│                                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                     │
│  │ Score < seuil│ │ Tags orphelin│ │ Liens cassés │ │ Total pub.  │                     │
│  │     ⚠ 4      │ │     ⚠ 18    │ │     ✗ 3     │ │     127     │                     │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘                     │
│                                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  Content gap matrix (type × domain)                                                      │
│                                                                                          │
│              interventions  audit  implementation  pricing  legal  ressources            │
│  article          18          12         6           4        2        14                │
│  case_study        6           2         8           0        0         0                │
│  guide             3           1         2           0        0         5                │
│  glossary_term     8           4         3           2        6        21                │
│  faq              22          14         7           8        4         9                │
│  help_article      0           0         0           0        0        12                │
│  doctrine          1           0         0           1        2         0                │
│  playbook          0           0         0           0        0         0   ← opportunité│
│                                                                                          │
│  Cellules à 0 sont mises en évidence (opportunités de couverture).                       │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  Top 10 entrées (30 derniers jours)                                                      │
│  # Titre                                          Vues      Helpful   Type      Auteur   │
│  1 Comment auditer son SI en 5 étapes              4 218     94 / 7    article   Manon   │
│  2 Glossaire IA : RAG, embeddings, fine-tuning     3 102     72 / 3    glossary  Manon   │
│  3 Cas concret PME 80 personnes                    2 487     58 / 2    case_st   Manon   │
│  ...                                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Top entrées — vues + helpful

Source `kb_metrics_daily` (table d'agrégation matérialisée Agent 18). Vue serveur :

```sql
SELECT
  e.id, e.title, e.type, ka.name AS author,
  SUM(m.views_count) AS views_30d,
  SUM(m.helpful_up_count) AS helpful_up_30d,
  SUM(m.helpful_down_count) AS helpful_down_30d
FROM kb_entries e
LEFT JOIN kb_metrics_daily m ON m.entry_id = e.id AND m.day >= NOW() - INTERVAL '30 days'
LEFT JOIN kb_authors ka ON ka.id = e.primary_author_id
WHERE e.status = 'published'
GROUP BY e.id, ka.name
ORDER BY views_30d DESC NULLS LAST
LIMIT 10;
```

Affichage avec « + n KO » badge si helpful_down > helpful_up (alerte qualité).

### 4.5 Cache & perf

- `unstable_cache(loadHealthDashboard, ['kb-health'], { revalidate: 60, tags: ['kb-health'] })` — recalcul max 1/min, suffisant pour dashboard admin.
- Invalidation explicite via `revalidateTag('kb-health')` dans les server actions publish/archive.
- KPIs (a)–(g) calculés en une seule pass SQL (CTE unique) — pas 8 round-trips.

### 4.6 Anti-pattern : wall-clock client

Toutes les dates affichées (« review > 12 mois », « publié il y a 3 jours ») doivent être calculées **server-side** avec `NOW()` Postgres, pas avec `new Date()` côté client. Sinon les heures défilent dans le rendu et l'auteur voit des deltas variables selon timezone navigateur (anti-pattern §367 du prompt).

---

## 5. QUALITY SCORE

### 5.1 Formule — 10 critères × 10 pts = /100

| #   | Critère                       | Pondération | Test bool                                                                                         | Fallback per-type                                                       |
| --- | ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Metadata complets**         | 10 pts      | `title && excerpt && type && domain && audience && confidentiality && primaryAuthorId`            | obligatoire tous types                                                  |
| 2   | **Longueur ≥ seuil par type** | 10 pts      | `wordCount >= threshold(type)`                                                                    | seuil SSOT (cf. §5.2)                                                   |
| 3   | **coverImage présent**        | 10 pts      | `coverImageId IS NOT NULL`                                                                        | **dispensé pour `faq` et `doctrine`** (10 pts automatiques)             |
| 4   | **≥ 1 relation**              | 10 pts      | `kb_relations WHERE source_id = entry.id OR target_id = entry.id COUNT >= 1`                      | seuil applicable tous types                                             |
| 5   | **≥ 1 source citée**          | 10 pts      | `kb_citations WHERE entry_id = entry.id COUNT >= 1`                                               | **dispensé pour `faq` courte (< 100 mots)**                             |
| 6   | **Translation EN**            | 10 pts      | `kb_translations WHERE entry_id = entry.id AND locale='en' AND body_text IS NOT NULL`             | **dispensé pour `doctrine` (FR-only par doctrine éditoriale Axion-IA)** |
| 7   | **Alt text 100% images**      | 10 pts      | Parse `bodyJson` Tiptap pour comptage images vs `alt` non-vide                                    | applicable tous types avec images, 10 pts auto si 0 images              |
| 8   | **≥ 2 internal links**        | 10 pts      | Parse `bodyJson` pour links commençant par `/fr/` ou `/en/`                                       | **dispensé `glossary_term` (1 internal suffit)**                        |
| 9   | **≥ 1 external link**         | 10 pts      | Parse `bodyJson` pour links externes (https hors axion-ia.com)                                    | **dispensé `faq`, `doctrine`** (10 pts auto)                            |
| 10  | **Fraîcheur ≤ 12 mois**       | 10 pts      | `lastReviewedAt >= NOW() - INTERVAL '12 months'` ou `publishedAt >= NOW() - INTERVAL '12 months'` | applicable tous types                                                   |

**Score = somme des critères validés. Max = 100.**

### 5.2 Seuils par type — SSOT `src/content/knowledge/quality-thresholds.ts`

```ts
// SSOT seuils quality score par type — Knowledge Base 2026 Agent 14.
//
// Anti-pattern explicite §367 du prompt master : « quality score qui pénalise
// les entrées courtes par essence (FAQ courte = OK) ». Cette table établit
// donc des seuils DIFFÉRENCIÉS par type pour éviter de bloquer publish d'une
// FAQ légitime de 60 mots avec un score 60/100.
//
// `minWordCount` = critère 2 du quality score (longueur).
// `publishThreshold` = score /100 minimum pour publish, surchargeable par
// override admin justifié (loggé ActivityLog).

import type { KnowledgeType } from "./types";

export interface QualityThreshold {
  type: KnowledgeType;
  minWordCount: number; // critère 2
  publishThreshold: number; // score /100 minimum
  requiresEnTranslation: boolean;
  requiresCoverImage: boolean;
  requiresCitation: boolean;
  requiresExternalLink: boolean;
}

export const QUALITY_THRESHOLDS: ReadonlyArray<QualityThreshold> = [
  {
    type: "article",
    minWordCount: 400,
    publishThreshold: 70,
    requiresEnTranslation: true,
    requiresCoverImage: true,
    requiresCitation: true,
    requiresExternalLink: true,
  },
  {
    type: "case_study",
    minWordCount: 600,
    publishThreshold: 80,
    requiresEnTranslation: true,
    requiresCoverImage: true,
    requiresCitation: true,
    requiresExternalLink: false,
  },
  {
    type: "guide",
    minWordCount: 1500,
    publishThreshold: 80,
    requiresEnTranslation: true,
    requiresCoverImage: true,
    requiresCitation: true,
    requiresExternalLink: true,
  },
  {
    type: "glossary_term",
    minWordCount: 80,
    publishThreshold: 60,
    requiresEnTranslation: true,
    requiresCoverImage: false,
    requiresCitation: false,
    requiresExternalLink: false,
  },
  {
    type: "faq",
    minWordCount: 30,
    publishThreshold: 50,
    requiresEnTranslation: false,
    requiresCoverImage: false,
    requiresCitation: false,
    requiresExternalLink: false,
  },
  {
    type: "help_article",
    minWordCount: 200,
    publishThreshold: 65,
    requiresEnTranslation: true,
    requiresCoverImage: false,
    requiresCitation: false,
    requiresExternalLink: false,
  },
  {
    type: "doctrine",
    minWordCount: 300,
    publishThreshold: 75,
    requiresEnTranslation: false,
    requiresCoverImage: false,
    requiresCitation: true,
    requiresExternalLink: false,
  },
  {
    type: "playbook",
    minWordCount: 1000,
    publishThreshold: 75,
    requiresEnTranslation: true,
    requiresCoverImage: true,
    requiresCitation: true,
    requiresExternalLink: false,
  },
] as const;

export function getThreshold(type: KnowledgeType): QualityThreshold {
  const t = QUALITY_THRESHOLDS.find((q) => q.type === type);
  if (!t) throw new Error(`[quality-thresholds] type introuvable : "${type}"`);
  return t;
}
```

Note doctrine : `requiresEnTranslation: false` pour `doctrine` et `faq` reflète la décision projet où ces types sont parfois FR-only (doctrine Axion-IA interne, FAQ courtes spécifiques marché FR). Le critère 6 calcule alors 10 pts automatiques quand `requiresEnTranslation = false`.

### 5.3 Calcul — server function `lib/knowledge/quality-score.ts`

```ts
import type { KnowledgeEntry } from "@prisma/client";
import { getThreshold } from "@/content/knowledge/quality-thresholds";

export interface QualityBreakdown {
  score: number; // 0..100
  passes: boolean; // score >= publishThreshold(type)
  threshold: number;
  criteria: Array<{
    id: number;
    label: string;
    score: number; // 0 ou 10
    reason?: string; // si score=0, raison humaine pour UI
  }>;
}

export async function computeQualityScore(
  entry: KnowledgeEntry & {
    /* relations préchargées */
  },
): Promise<QualityBreakdown> {
  const threshold = getThreshold(entry.type);
  const criteria = [];

  // 1. Metadata
  const meta = !!(
    entry.title &&
    entry.excerpt &&
    entry.type &&
    entry.domain &&
    entry.audience &&
    entry.confidentiality &&
    entry.primaryAuthorId
  );
  criteria.push({
    id: 1,
    label: "Métadonnées complètes",
    score: meta ? 10 : 0,
    reason: meta ? undefined : "titre/excerpt/auteur manquant",
  });

  // 2. Longueur
  const wc = entry.wordCount ?? 0;
  const lenOk =
    wc >=
    (entry.targetWordCount && entry.targetWordCount > 0
      ? entry.targetWordCount
      : threshold.minWordCount);
  criteria.push({
    id: 2,
    label: `Longueur ≥ ${threshold.minWordCount} mots`,
    score: lenOk ? 10 : 0,
    reason: lenOk ? undefined : `${wc} mots < ${threshold.minWordCount}`,
  });

  // 3. Cover image
  const coverOk = threshold.requiresCoverImage ? !!entry.coverImageId : true;
  criteria.push({
    id: 3,
    label: "Image de couverture",
    score: coverOk ? 10 : 0,
    reason: coverOk ? undefined : "coverImageId manquant",
  });

  // 4. Relations
  // ... idem critères 4-10
  // [Détail complet écrit en Phase B, ici Phase A = spec]

  const score = criteria.reduce((s, c) => s + c.score, 0);
  return {
    score,
    passes: score >= threshold.publishThreshold,
    threshold: threshold.publishThreshold,
    criteria,
  };
}
```

### 5.4 Persistance score

Champs sur `KnowledgeEntry` :

```prisma
qualityScore        Int?     @default(0)  // 0..100, null si pas encore calculé
qualityScoreAt      DateTime?
```

Recalcul triggers :

- À chaque `upsertEntry` server action (avant commit Prisma).
- À chaque transition `pipelineStage` vers `review` ou `approved`.
- Cron quotidien `kb-quality-recompute.ts` pour rattraper les entrées invalidées par changement de seuils.

### 5.5 Bloque publish si score < seuil — avec override admin

```ts
// src/server/actions/knowledge/publish.ts
"use server";

export async function publishEntryAction(formData: FormData) {
  const session = await auth();
  requireRole(session, ["OWNER", "EDITOR"]);

  const entryId = formData.get("entryId") as string;
  const overrideReason = formData.get("overrideReason") as string | null;

  const entry = await prisma.knowledgeEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: {
      /* relations pour quality score */
    },
  });

  const breakdown = await computeQualityScore(entry);

  if (!breakdown.passes) {
    // Bloqué — autorise override uniquement si OWNER + reason justifiée ≥ 20 chars
    if (session.user.role !== "OWNER" || !overrideReason || overrideReason.length < 20) {
      return {
        success: false,
        error: "quality_score_below_threshold",
        breakdown,
      };
    }

    // Override accepté — log explicite
    await logActivity({
      action: "kb.entry.publish.override",
      actorId: session.user.id,
      targetType: "KnowledgeEntry",
      targetId: entryId,
      changes: {
        score: breakdown.score,
        threshold: breakdown.threshold,
        overrideReason,
      },
    });
  }

  await prisma.knowledgeEntry.update({
    where: { id: entryId },
    data: {
      status: "published",
      pipelineStage: "published",
      publishedAt: new Date(),
      qualityScore: breakdown.score,
      qualityScoreAt: new Date(),
    },
  });

  await logActivity({
    action: "kb.entry.published",
    actorId: session.user.id,
    targetType: "KnowledgeEntry",
    targetId: entryId,
    changes: { qualityScore: breakdown.score },
  });

  revalidatePath(`/fr/${getPublicPath(entry.type)}`);
  return { success: true, breakdown };
}
```

### 5.6 Surface éditeur — jauge live + breakdown

Composant `<QualityScoreGauge entry={entry} />` dans le panneau latéral de l'éditeur :

```
┌─────────────────────────────────────┐
│  Quality score                     │
│  ●●●●●●●○○○  68 / 100              │
│  Seuil article : 70 — ⚠ -2 pts     │
│                                    │
│  ✓ Métadonnées complètes      +10  │
│  ✓ Longueur ≥ 400 mots        +10  │
│  ✓ Image de couverture        +10  │
│  ✗ Relations (0/1 requis)      0   │
│  ✓ Source citée               +10  │
│  ✓ Translation EN             +10  │
│  ✗ Alt text (2/3 images)       0   │
│  ✓ ≥2 internal links          +10  │
│  ✗ External link manquant      0   │
│  ✓ Fraîcheur (publié < 12m)   +10  │
│                                    │
│  [Recalculer]                      │
└─────────────────────────────────────┘
```

Recalcul = server action sans persistance (juste preview). Persistence uniquement au save de l'entrée.

### 5.7 Anti-pattern : pénaliser FAQ courtes

Cf. §5.2 et §367 du prompt. La table SSOT établit `faq.minWordCount = 30` et `faq.publishThreshold = 50`, ce qui permet à une FAQ de 60 mots qui répond précisément à une question d'atteindre publishable sans bourrer artificiellement. Idem `glossary_term.minWordCount = 80`.

---

## 6. REVIEWER ASSIGNMENT

### 6.1 Algorithme

**Stratégie hybride** :

1. **Ownership-first** : si `Setting` `kb.reviewer.byDomain.${domain}` est défini, on assigne ce reviewer.
2. **Round-robin fallback** : sinon, on prend le reviewer (AdminUser role=REVIEWER) ayant la **plus ancienne dernière assignation** active.

```ts
// src/lib/knowledge/reviewer-assignment.ts

export async function assignReviewer(entry: KnowledgeEntry): Promise<string | null> {
  // 1. Ownership par domain
  const ownerSetting = await prisma.setting.findUnique({
    where: { key: `kb.reviewer.byDomain.${entry.domain}` },
  });
  if (ownerSetting?.value) {
    const reviewerId = (ownerSetting.value as { reviewerId: string }).reviewerId;
    const reviewer = await prisma.adminUser.findUnique({
      where: { id: reviewerId, role: { in: ["REVIEWER", "EDITOR", "OWNER"] }, deletedAt: null },
    });
    if (reviewer) return reviewer.id;
  }

  // 2. Round-robin : reviewer avec la moins récente assignation pending
  const candidates = await prisma.adminUser.findMany({
    where: { role: { in: ["REVIEWER", "EDITOR"] }, deletedAt: null },
    include: {
      assignedReviewEntries: {
        where: { pipelineStage: "review" },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (candidates.length === 0) return null;

  // Le plus « disponible » = celui avec le moins de reviews pending
  candidates.sort((a, b) => a.assignedReviewEntries.length - b.assignedReviewEntries.length);
  return candidates[0].id;
}
```

### 6.2 Escalade 48h

Cron toutes les 6h `scripts/kb-reviewer-escalation.ts` :

```ts
const overdueEntries = await prisma.knowledgeEntry.findMany({
  where: {
    pipelineStage: "review",
    updatedAt: { lt: new Date(Date.now() - 48 * 3600 * 1000) },
    OR: [
      { reviewerEscalatedAt: null },
      { reviewerEscalatedAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    ],
  },
  include: { assignedReviewer: true, primaryAuthor: true },
});

for (const entry of overdueEntries) {
  // Notif manager (Will = OWNER)
  const owner = await prisma.adminUser.findFirst({ where: { role: "OWNER", deletedAt: null } });
  await notifyManager(owner!, entry);

  // Reassign automatique vers un autre reviewer disponible
  const newReviewerId = await assignReviewer(entry); // exclut le reviewer escaladé
  await prisma.knowledgeEntry.update({
    where: { id: entry.id },
    data: {
      assignedReviewerId: newReviewerId,
      reviewerEscalatedAt: new Date(),
    },
  });

  await logActivity({
    action: "kb.review.escalated",
    targetType: "KnowledgeEntry",
    targetId: entry.id,
    actorId: "system",
    changes: {
      previousReviewerId: entry.assignedReviewerId,
      newReviewerId,
      reason: "no_verdict_48h",
    },
  });
}
```

### 6.3 Setting structure

```json
// Setting key: kb.reviewer.byDomain.interventions
// Setting value:
{
  "reviewerId": "user_xyz",
  "backup": ["user_abc"],
  "createdAt": "2026-05-13T10:00:00Z"
}
```

UI admin `/connaissances/parametres` permet d'éditer ce mapping (un sélecteur par domain).

---

## 7. NOTIFICATIONS

### 7.1 Trois canaux

| Canal                                   | Quand                                                       | Contenu                                                                                                         | PII                                     |
| --------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Email** (Zoho Mail via SMTP existant) | Assignation reviewer, escalade manager, publication réussie | Subject + lien admin direct + résumé titre/type/auteur                                                          | OK — email interne, audience admin only |
| **Telegram** (bot existant, ADR 0010)   | Assignation reviewer, escalade, publish                     | **Redacté via `pii-redaction.ts`** : titre entrée OK, mais nom auteur → initials, pas d'email reviewer en clair | Strict ADR 0010                         |
| **Badge admin in-app**                  | Toujours actif quand entrée requiert action                 | Badge count sur l'item de menu `/connaissances/calendrier` + `/connaissances/mes-reviews`                       | OK — session admin authentifiée         |

### 7.2 Template email reviewer

```
Subject: [Axion-IA KB] Relecture demandée : "{{title}}"

Bonjour {{reviewerFirstName}},

Une nouvelle entrée vient d'être soumise à votre relecture :

  Titre        : {{title}}
  Type         : {{type}}
  Auteur       : {{authorName}}
  Mots cible   : {{targetWordCount}}
  Mot-clé SEO  : {{targetKeyword}}

Ouvrir dans l'admin :
  https://axion-ia.com/fr/{{adminPrefix}}/connaissances/{{entryId}}

Délai souhaité : 48 h. Au-delà, l'entrée sera réassignée automatiquement.

— Axion-IA Knowledge Base
```

### 7.3 Template Telegram (PII-redacté)

```
[KB] Review demandée
Titre : {{title}}
Type : {{type}}
Auteur : {{authorInitials}}
→ https://axion-ia.com/fr/{{adminPrefix}}/connaissances/{{entryId}}
```

Pas de nom complet, pas d'email. Le reviewer connaît son nom dans l'admin.

### 7.4 Badge in-app

Server-side fetch dans le layout admin :

```ts
const pendingReviews = await prisma.knowledgeEntry.count({
  where: {
    assignedReviewerId: session.user.id,
    pipelineStage: "review",
  },
});
```

Affiché dans la sidebar nav comme pastille rouge.

### 7.5 Anti-pattern (rappel ADR 0010)

- Jamais envoyer **email reviewer en clair** dans Telegram.
- Jamais envoyer **contenu intégral de l'entrée** dans Telegram (uniquement metadata + lien).
- Helper `redactForTelegram(reviewerName)` → renvoie `J.D.` (initials, pas `Jean Dupont`).

---

## 8. ANTI-PATTERNS — RÉCAPITULATIF

| Anti-pattern                                                  | Pourquoi c'est mauvais                                                           | Mitigation prévue                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Pipeline fusionné avec workflow technique**                 | Court-circuite la sémantique, transitions arbitraires, debug impossible          | Deux champs (`pipelineStage` + `status`) avec table de mapping §1.4                                                    |
| **Quality score qui pénalise FAQ courtes**                    | Bloque publish d'entrées légitimes (FAQ 50 mots = pertinente)                    | SSOT `quality-thresholds.ts` avec `minWordCount` différencié par type §5.2                                             |
| **KPIs wall-clock client**                                    | Affichage incohérent selon timezone navigateur, comparaisons relatives variables | Tous calculs server-side avec `NOW()` Postgres, dates UTC stockées et affichées avec offset utilisateur explicite §4.6 |
| **Drag-drop sans optimistic UI**                              | Lag perçu, frustration sur calendrier dense                                      | `useTransition` + rollback si server action rejette §3.4                                                               |
| **Quality score persisté mais jamais recalculé**              | Devient obsolète, dérive vs seuils mis à jour                                    | Cron quotidien `kb-quality-recompute.ts` §5.4                                                                          |
| **Reviewer assignment one-shot sans escalade**                | Reviewer en vacances = entrées bloquées indéfiniment                             | Escalade 48h + reassign auto §6.2                                                                                      |
| **Notifications Telegram avec PII reviewer en clair**         | Violation ADR 0010                                                               | `redactForTelegram(name)` → initials §7.5                                                                              |
| **Pipeline override sans audit**                              | Publish d'entrées sub-seuil non tracé                                            | OWNER role + reason ≥ 20 chars + ActivityLog `kb.entry.publish.override` §5.5                                          |
| **Lib calendrier lourde (react-big-calendar / fullcalendar)** | +85 KB gz, casse budget Web Vitals AGENTS.md (≤ 75 KB gz)                        | Custom CSS grid 7×N réutilisant `admin-calendar-*` §3.1                                                                |
| **Filtres calendrier client-state**                           | URLs non partageables, perte au refresh                                          | URL searchParams server-driven §3.5                                                                                    |
| **`Setting` `kb.reviewer.*` éditable sans audit**             | Réassignation silencieuse                                                        | Wrap dans `upsertSettingAction` qui log `ActivityLog` action `kb.setting.updated`                                      |

---

## 9. STOP & ASK OUVERTS — pour Will avant Phase B

### 9.1 Calendrier — lib & ergonomie

1. **Confirmer custom CSS grid** (recommandation forte) vs `react-big-calendar` (lib mature mais lourde) ? Le calendrier booking existant utilise déjà ce pattern — cohérence forte. → **Recommandation : custom CSS grid.**
2. **Vue semaine + agenda V1 ou V1.5** ? V1 = mois seul + table list (`/connaissances/liste`) suffisamment couvre les besoins ; vue semaine est nice-to-have. → **Recommandation : V1.5.**
3. **Drag-drop activé pour REVIEWER ?** Strict : seuls OWNER/EDITOR peuvent reschedule. Reviewer peut **demander un reschedule** via commentaire mais pas drag-drop direct. → **Recommandation : strict.**

### 9.2 Quality score — seuils & politique

4. **Seuils par défaut §5.2** sont-ils acceptables ? FAQ=50/100, glossary=60/100, article=70/100, case_study=80/100, guide=80/100, doctrine=75/100, playbook=75/100, help=65/100. Will tranche.
5. **Override admin justifié** : 20 caractères minimum suffisant ? Faut-il forcer rotation OWNER (pas EDITOR pour override) ? → **Recommandation : OWNER only, 20 chars min, logged ActivityLog.**
6. **Recalcul quality score** : à chaque save (recommandation) ou uniquement à transition `review`/`approved` (perf) ? → **Recommandation : à chaque save + cron quotidien rattrape.**
7. **EN translation dispense pour `doctrine` et `faq`** : confirmé ? Cohérent avec mémoire `axionia_naming_brand_vs_project` (Axion-IA partout) + doctrine éditoriale Axion-IA (FR canonique).

### 9.3 Reviewer assignment

8. **Reviewer Setting `kb.reviewer.byDomain.${domain}`** : Will valide le pattern ou préfère une table dédiée `KnowledgeReviewerOwnership` ? `Setting` est plus light (mémoire reality-check §1.2). → **Recommandation : `Setting` réutilisé.**
9. **Escalade manager = Will (OWNER unique en V1)** ou Will tient à ajouter d'autres OWNER tôt ? → **Recommandation V1 : Will = unique OWNER, escalade Telegram + email vers Will.**
10. **Délai escalade 48h** : ajustable par `Setting` `kb.reviewer.escalationHours` (recommandation) ou hardcodé ? → **Recommandation : `Setting` (flex).**

### 9.4 Notifications

11. **Telegram opt-out reviewer** : faut-il permettre à un reviewer de désactiver Telegram (préférer email only) ? V1.5 si oui. → **Recommandation V1 : Telegram pour OWNER (Will), email pour reviewers EDITOR.**
12. **Newsletter interne digest hebdo** « ce qui a été publié cette semaine » pour l'équipe interne ? Hors-scope Agent 14 → délègue à Agent 15 (multi-format).

### 9.5 Pipeline éditorial — sémantique

13. **`pipelineStage = 'idea'` doit-il être créable sans body ?** Recommandation : oui (mode « capture d'idée rapide » avec juste un titre). UI dédiée `/connaissances/idees/new` minimal. Body vide accepté, status='draft'.
14. **Retour arrière `published → draft` interdit (cf. §1.4)** confirmé ? Ou Will veut autoriser pour micro-corrections rapides ? → **Recommandation : retour arrière → passe par `archived` puis nouvelle révision via `KnowledgeVersion` Agent 8 (versioning propre).**

---

## 10. RÉCAPITULATIF LIVRABLES PHASE B (informatif, sera tranché Phase B)

- `prisma/migrations/xxxx_add_kb_pipeline.sql` (champs + enum + indexes §2)
- `src/content/knowledge/quality-thresholds.ts` (SSOT §5.2)
- `src/lib/knowledge/quality-score.ts` (compute §5.3)
- `src/lib/knowledge/reviewer-assignment.ts` (algo §6.1)
- `src/lib/knowledge/state-transitions.ts` (invariants pipeline §1.4)
- `src/lib/calendar-grid.ts` (mutualisation booking + KB §3.1)
- `src/server/actions/knowledge/reschedule.ts` (§3.4)
- `src/server/actions/knowledge/publish.ts` (avec quality gate §5.5)
- `src/server/actions/knowledge/transition-stage.ts` (changement `pipelineStage` avec invariants)
- `src/app/[locale]/(admin)/[adminPrefix]/connaissances/calendrier/page.tsx` (§3)
- `src/app/[locale]/(admin)/[adminPrefix]/connaissances/sante/page.tsx` (§4)
- `src/components/admin/knowledge/QualityScoreGauge.tsx` (jauge éditeur §5.6)
- `src/components/admin/knowledge/CalendarCell.tsx` (cell draggable §3.3)
- `scripts/kb-reviewer-escalation.ts` (cron §6.2)
- `scripts/kb-quality-recompute.ts` (cron §5.4)
- `tests/quality-thresholds.test.ts` + `tests/quality-score.test.ts` + `tests/reviewer-assignment.test.ts` + `tests/state-transitions.test.ts`

Estimation Phase B : 1 sprint dédié KB-13 « editorial pipeline » (~3 j dev) + KB-14 « calendrier + santé » (~2 j dev) = **5 j dev** sur Sprint KB-13/14 combinés.

---

## 11. VERDICT AGENT 14

**GO** pour la conception telle qu'écrite ci-dessus, sous réserve de tranchage Will sur les 14 STOP & ASK §9.

Aucun bloquant doctrine, aucun conflit avec :

- `axionia_doctrine_code_ssot` (le SSOT `quality-thresholds.ts` suit le pattern `pricing.ts`)
- `axionia_pricing_zero_hardcode_2026-05-08` (toutes valeurs configurables ou via `Setting`)
- AGENTS.md Web Vitals (custom CSS grid garde le budget JS ≤ 75 KB gz)
- ADR 0010 Telegram PII (redaction systématique des notifications)
- Reality check §1.1-§1.2 et §9.14 (réutilisation `ActivityLog`, `Setting`, `AdminUser`, `Author`/`KnowledgeAuthor`)

L'Agent 14 produit une couche **purement humaine** (pipeline + calendar + dashboard + score + assignment) qui se superpose proprement aux fondations techniques d'Agents 1/3/4/8. Aucune compétition avec Agent 18 (tests/observabilité dashboard performance) qui mesure le **système**, alors qu'Agent 14 mesure le **contenu**.

---

**Fin Agent 14 — Editorial pipeline, calendrier, health dashboard, quality score.**
