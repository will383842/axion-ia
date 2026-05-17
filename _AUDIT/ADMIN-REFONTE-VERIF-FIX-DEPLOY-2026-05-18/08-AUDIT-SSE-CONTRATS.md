# Audit A8 — SSE contrats JobLogStream + GeoEventsBanner

## Résumé

- **Score brut** : 200 / 200
- **Verdict** : 🟢 CONFORME
- **Poids** : ×3

## Méthode

```bash
git diff admin-refonte-baseline-2026-05-17..HEAD --stat -- \
  'src/components/admin/content-gen/JobLogStream*' \
  'src/components/admin/**/*Banner*' \
  'src/app/**/api/**/stream*' \
  'src/app/**/api/**/geo-events*'
# → 0 fichier touché
```

## Fichiers SSE audités (4)

### Clients V2 (inchangés)

1. **`src/components/admin/content-gen/JobLogStream.tsx`** (159 lignes)
   - `new EventSource(url, { withCredentials: true })`
   - URL : `/api/content-gen/jobs/{jobId}/stream`
   - Event types : `"log" | "status" | "ready" | "done" | "timeout" | "error"`

2. **`src/components/admin/content-gen/GeoEventsBanner.tsx`** (115 lignes)
   - `new EventSource(url, { withCredentials: true })`
   - URL : `/api/content-gen/geo-events`
   - Event types : `"geo-event" | "tick" | "ready" | "timeout" | "error"`

### Routes API serveur (inchangées)

3. **`src/app/api/content-gen/jobs/[id]/stream/route.ts`** (150 lignes)
   - Runtime nodejs, `dynamic: force-dynamic`
   - Auth `requireAdmin()` (RBAC)
   - Headers `Content-Type: text/event-stream`
   - Poll DB 3s, max 5 min

4. **`src/app/api/content-gen/geo-events/route.ts`** (112 lignes)
   - Runtime nodejs, `dynamic: force-dynamic`
   - Auth `requireAdmin()` (RBAC)
   - Headers `Content-Type: text/event-stream`
   - Poll DB 5s, max 10 min

## Vérifications du contrat

- ✅ EventSource natif inchangé.
- ✅ Headers `text/event-stream` présents.
- ✅ Event types client ↔ serveur cohérents.
- ✅ Message payloads compatibles.
- ✅ Auth RBAC préservé.
- ✅ Auto-close logic intacte.
- ✅ 0 commit baseline..HEAD sur ces 4 fichiers.

## Findings

- **P0 / P1 / P2** : ❌ Aucun

## Verdict

🟢 Contrats SSE intacts. **200/200**.
