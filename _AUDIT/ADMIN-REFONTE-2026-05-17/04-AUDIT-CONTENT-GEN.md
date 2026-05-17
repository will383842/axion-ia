# A4 — Audit Content Generator (FOCUS WILL, poids ×2)

> Sous-agent Explore, poids ×2. Lecture seule.
> Date : 2026-05-17.

## Scoring (/120)

| #   | Critère                                                                   | Score /10 | Justification + LOC                                                                                                                | Quick wins                                                                             |
| --- | ------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Onboarding                                                                | 7         | Checklist linéaire 5 étapes hardcodées (onboarding/page.tsx). Manque modale Stepper (Sprint 1.5).                                  | Visual progress indicator inline + lien « skip » vers `/coverage/new` pour experts.    |
| 2   | Orchestrator                                                              | 8         | Vue KPIs + table campagnes actives fluide. Manque graphe quotidien.                                                                | Card « Quota today: X/Y » + barre progression visuelle.                                |
| 3   | Coverage                                                                  | 6         | Pagination 30, filtres status/secteur OK. Manque drill-down détail campagne. Création lente (1 écran/étape).                       | Refactor `/coverage/new` en 3-step modal (nom + scope + distrib) + autosave brouillon. |
| 4   | Jobs                                                                      | 7         | SSE stream + JobLogStream mature (`EventSource` ligne 48, `withCredentials` ✅). Pagination/filtres OK. Manque drill-down rapide.  | Bouton « Copy logs as JSON » + timeline visuelle (Gantt CSS) étapes job.               |
| 5   | Publications                                                              | 6         | TiptapEditor V1 minimal (167 LOC, StarterKit seul). Article edit OK mais monospace → WYSIWYG attendu Will.                         | Upgrade Tiptap : Image + Link extensions, toolbar visuelle minimal.                    |
| 6   | Review queue                                                              | 7         | Paginated 50/page (P1-B audit fix, ligne 39 `listReviewPaginated` ✅). Approve/Reject fluide. Manque diff côte-à-côte.             | Modal « Compare » : original HTML vs régénéré + highlighter diff (delta.js léger).     |
| 7   | Quality                                                                   | 8         | Graphe 5 scores 30j CSS inline (zéro Recharts dep ✅). Drill-down par jour. Manque trend alertes.                                  | Alerte rouge si delta 5j < -10 pts sur tout score.                                     |
| 8   | Geo                                                                       | 8         | GeoEventsBanner SSE temps réel (poll 5s, `POLL_INTERVAL` ✅). KPIs régions cohérents. Manque sélecteur ville rapide.               | Searchbox autocomplete villes + batch actions (generate top 10 failed regions).        |
| 9   | RSS                                                                       | 5         | Squelette V1 (80 LOC). Toggle/remove OK. Modèles `RssSource/RssItem` manquent (Sprint 4 noté). Config JSON temp.                   | Sprint 4 prio : impacter `RssSource` schema. V1 : validation URL + test fetch button.  |
| 10  | Costs                                                                     | 7         | Table coûts/provider/cap OK. Projection conditionnelle (besoin 7j hist). Manque alerte budget atteint (couleur sans toast/action). | Toast/banner si cap dépassé + estimé fin de mois > budget annoncé.                     |
| 11  | Author Manon                                                              | 8         | Doctrine v2.1 (`aiGenerated + isPersona` flagged, page.tsx:75). JSON-LD Person rebuild OK.                                         | Preview JSON-LD en read-only card + test copier-coller Google Rich Results.            |
| 12  | Cross-cutting (JobLogStream, GeoEventsBanner, TemplateForm, SubmitButton) | 7         | SSE endpoints robustes (auth + 5/10min timeout). SubmitButton disable-on-pending mature. TemplateForm sans validation UX.          | TemplateForm : input-validation + error toast si slug dupe ou systemPrompt vide.       |

**Total** : **85/120** (× poids 2 = **170/240 pondéré**)

---

## Contrat JobLogStream (à préserver §3.10)

- **Transport** : SSE (`text/event-stream`), `withCredentials: true` (JobLogStream.tsx:48, route.ts:144).
- **Endpoint** : `/api/content-gen/jobs/[id]/stream` (`ReadableStream`, route.ts:44).
- **Format payload** : `{ type: "log" | "status" | "ready" | "done" | "timeout" | "error", id?, level?, step?, message?, timestamp?, status?, qualityScore?, durationMs?, reason?, initialCount? }`.
- **Reconnect** : client ferme l'`EventSource` quand job en `published | failed | cancelled` ou timeout 5 min (route.ts:74-75).
- **Auth** : `requireAdmin()` côté serveur (route.ts:29).
- **Polling V1** : DB 3s (`POLL_INTERVAL_MS = 3000`) → Redis pub/sub V2.
- **Sentry breadcrumbs** : à confirmer (pas vu de `Sentry.captureMessage` dans JobLogStream).
- → **La refonte UI doit consommer identiquement** ces endpoints. Aucun changement de signature ni de timing sans STOP & ASK Will + API parallèle versionnée.

### Endpoint frère

- `/api/content-gen/geo-events` (route.ts:35 `ReadableStream`, `POLL_INTERVAL_MS = 5000`, `MAX_DURATION_MS = 10*60*1000`).

---

## Top 15 patches UX prioritaires

| Prio | Titre                                                                     | Effort  | Impact     | Composant                                           |
| ---- | ------------------------------------------------------------------------- | ------- | ---------- | --------------------------------------------------- |
| P0   | SSE reconnect exponential backoff + visual feedback                       | 2 h     | Critical   | JobLogStream, GeoEventsBanner                       |
| P0   | Coverage/new refactor : 3-step modal vs page linéaire                     | 3 h     | Critical   | coverage/new/page.tsx                               |
| P1   | Review queue diff côte-à-côte (highlight original vs généré)              | 2.5 h   | High       | review-queue/[id]/page.tsx + nouveau `<DiffViewer>` |
| P1   | Jobs detail : timeline Gantt CSS (queued → running → quality → publish)   | 1.5 h   | High       | jobs/[id]/page.tsx                                  |
| P1   | Geo : searchbox autocomplete villes (200+) + favoris                      | 1.5 h   | High       | geo/page.tsx                                        |
| P1   | SubmitButton : prevent double-submit + visual pending                     | ✅      | OK         | déjà OK (SubmitButton.tsx:44-50)                    |
| P2   | TiptapEditor upgrade : Image + Link toolbar                               | 2 h     | Medium     | TiptapEditor.tsx                                    |
| P2   | TemplateForm validation UX (slug dupe check async, systemPrompt non-vide) | 1.5 h   | Medium     | templates/new/page.tsx + endpoint `/check-slug`     |
| P2   | Quality dashboard : alerte -5 pts trend 5j                                | 1 h     | Medium     | quality/page.tsx                                    |
| P2   | Costs : toast « Budget cap 80 % atteint »                                 | 0.5 h   | Low-Medium | costs/page.tsx                                      |
| P3   | GeoEventsBanner : re-colorer carte React v1.5                             | 4 h     | Low-Medium | geo/page.tsx (composant lourd, slack 2 sem.)        |
| P3   | Job retry : modal confirmation + log excerpt                              | 1 h     | Low        | jobs/[id]/page.tsx                                  |
| P3   | RSS fetch test button V1                                                  | 0.5 h   | Low        | rss/new/page.tsx                                    |
| P3   | Author Manon : preview JSON-LD card read-only                             | 0.5 h   | Low        | author/manon/page.tsx                               |
| P3   | Keyword tracking : drill-down rank progression                            | Backlog | Low        | keyword-tracking/page.tsx (Sprint 5+)               |

---

## Storyboard idéal end-to-end

**Brief → Publish — 6 étapes** :

1. **Briefing** (`/onboarding` ou `/coverage/new`) — Modal 3-step (Nom + Scope villes/régions + Template distribution). Autosave brouillon.
2. **Campagne lancée** (`/orchestrator`) — Voir nouvelle campagne dans table « Actives », KPI quota daily, barre avancement.
3. **Monitoring pipeline** (`/queue` + `/jobs`) — Vue liste jobs paginée, filtres rapides status/template/secteur. Bouton « Logs streaming » → modal JobLogStream SSE.
4. **Drill job** (`/jobs/[id]`) — Timeline Gantt CSS horizontale, SSE live logs + status, actions Retry/Cancel contextuelles.
5. **Review & approve** (`/review-queue`) — Paginated 50/item, Approve/Reject (SubmitButton pending-aware). Clic « Compare » → modal `<DiffViewer>` (original vs généré, delta highlight).
6. **Publish & monitor** (`/publications-status`, `/geo`) — Articles publiés, Geo cockpit KPIs + GeoEventsBanner SSE en temps réel. Si fail régional → highlight région rouge, bouton « Retry batch XX ».

**Composants primitifs nouveaux requis** :

- `<DiffViewer>` (Monaco Editor léger ou html-diff-viewer, ≤ 15 KB gz).
- `<GanttTimeline>` (CSS-only, pas Chart.js).
- `<CitySearchAutocomplete>` (debounce 300 ms, cache local villes).
- `<AlertBadge>` (trend quality < -5 pts, budget 80 %+).

---

## Anti-patterns détectés

1. **SSE reconnect manquant** — pas d'exponential backoff ni retry logic. Si serveur drop, l'admin voit « déconnecté » sans contexte. → Ajouter retry 5× @ [500ms, 1s, 2s, 4s, 8s] + toast d'échec final.
2. **Coverage création multi-page** — UX fatigante. → Modal Stepper.
3. **Review queue sans diff** — approver/rejeter sans lecture comparative. → Modal `<DiffViewer>` inline.
4. **TiptapEditor monospace-only** — V1 textarea monospace (TemplateForm.tsx:59). → Upgrade Image + Link Sprint 2.
5. **TemplateForm validation client absente** — slug dupe / systemPrompt vide invisibles. → Toast + check async.
6. **Geo villes table 300 lignes** — pas de search ni favoris. → Autocomplete + favoris localStorage.
7. **Quality sans alertes** — dégradation invisible. → AlertBadge rouge si delta < -10 pts.
8. **Costs budget seuil coloré mais sans action** — couleur orange sans notification. → Toast actif.

---

## Préservation obligatoire

- **2 endpoints SSE** : `/api/content-gen/jobs/[id]/stream` + `/api/content-gen/geo-events`. Format payload, timing (3s / 5s), MAX_DURATION (5min / 10min), `withCredentials`, `requireAdmin()` — **intouchables**.
- **`logActivity()` audit trail** : 6 fichiers, 26 appels (jobs.ts, coverage.ts, article.ts, review.ts, banned-phrases.ts, kill-switch.ts). Aucun retrait ni renaming.
- **Server Actions signatures** : toutes les pages importent depuis `src/server/actions/content-gen/**`. `"use server"` directives + `async function` conservés.
- **TemplateForm Zod schema** : `outputSchemaZod` stocke JSON string schema. Sérialisation inchangée.
- **Tiptap dynamic import** : pattern `dynamic(() => import(...), { ssr: false })` pour Tiptap v3 SSR-unsafe.
- **Prisma enums** : `ContentGenJobStatus`, `ContentType`, `ExpansionMode`, `ReviewStatus`, `ServiceSector` — pas de changement sans coordination cross-sprint.

---

**Conclusion** : Content Generator maturité **7.1/10** (poids ×2 = **14.2/20** sur cellule unique mais 170/240 sur le total scoring). Architecture SSE robuste, RBAC OK, UX fluide sur jobs/review/quality. Gaps : Coverage création lente, Review queue manque diff, TiptapEditor monospace, Geo sélecteur villes. Tous P0/P1 ≤ 2.5 h chacun, aucun bloqueur architectural.
