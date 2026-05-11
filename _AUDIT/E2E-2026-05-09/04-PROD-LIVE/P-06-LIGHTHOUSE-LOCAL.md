# P-06 — LIGHTHOUSE LOCAL

## Statut

**`[NON MESURÉ — postbuild risk + audit-only]`**

## Rationale

Le prompt master § 0.5bis prévoit l'option Lighthouse local via :

```bash
SENTRY_DISABLE_AUTO_UPLOAD=true \
NEXT_PUBLIC_SENTRY_RELEASE_DISABLE=true \
INDEXNOW_DISABLED=true \
npx --yes next build
```

suivi de `pnpm start` + `lhci collect`.

### Risques identifiés Phase 0

1. **Sentry release upload** : `withSentryConfig` n'est **PAS appliqué** dans `next.config.ts:140` (AGT-12 P0-1 + AGT-14 P0-M1). En théorie, `pnpm build` ne déclenche **pas** d'upload Sentry (puisque `withSentryConfig` est absent). MAIS le **postbuild script** `tsx scripts/indexnow-ping.ts` (package.json:19) **ping bing/yandex** systématiquement → effet externe.
2. **Postbuild IndexNow** : si `INDEXNOW_DISABLED=true` n'est pas câblé dans `scripts/indexnow-ping.ts`, le script ping quoi qu'il arrive. Avant de lancer, il faudrait lire ce script pour confirmer la garde d'environnement.
3. **Port 3000 conflict** : non vérifié (Phase 0 n'a pas lancé `pnpm dev`).
4. **Temps wall-clock** : `pnpm build` + `pnpm start` + 5 URLs LHCI = ~5-10 min. Acceptable.

### Décision V2.1 § 0.5bis

> Si aucune des deux options n'est câblée dans le repo → `[NON MESURÉ — postbuild risk]` et **skip P-06 LHCI**.

→ **Skip P-06 LHCI**. Cela rejoint AGT-03 (Performance) qui mentionne 9 mesures `[NON MESURÉ — Phase 4 P-06]`.

## Conséquences

- **Web Vitals** : pas de mesure labo nouvelle dans cet audit. Référence baseline : `_AUDIT/AUDIT-WEB-VITALS-2026-*.md` (2026-05-08 Perf home 81, CLS /reserver 0.552 lab, TBT 300 ms — patches V1-V2 commit d21f9d0 puis V3-V6 EN ATTENTE mémoire `axionia_audit_web_vitals_v3_v6_pending`).
- **Bundle size** : `pnpm bundle:check` (size-limit) non lancé. Configuration `100 KB` First Load (`package.json:163-166`) — mais doctrine `AGENTS.md` `≤ 75 KB gz` → drift documenté AGT-03 P1.
- **CrUX RUM réel** : domaine `[ACTION WILL]` (cf. § 12 prompt master "Ce que l'audit ne couvre pas").

## Recommandation

Will lance localement après l'audit :

```bash
INDEXNOW_DISABLED=true npm_config_ignore_scripts=true pnpm build
pnpm start --port 3010 &
pnpm lhci collect --url=http://localhost:3010/fr \
                  --url=http://localhost:3010/en \
                  --url=http://localhost:3010/fr/audit \
                  --url=http://localhost:3010/fr/reserver \
                  --url=http://localhost:3010/fr/implantations/ile-de-france/paris
```

Et compare avec `lighthouserc.json` budgets pour confirmer ou infirmer les patches Web Vitals V1-V2 (~30 min wall-clock).
