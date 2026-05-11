# PASS B — FAUX POSITIFS

Findings retirés ou dégradés après croisement.

## Findings retirés (faux positifs)

| Finding original                                | Source                                                       | Raison de retrait                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `og:image localhost en prod`                    | mémoire `axionia_bugs_seo_preexistants_2026-05-09`           | Phase 4 P-05 confirme `og:image` = `https://axion-ia.com/api/og?title=...` — **RÉSOLU code-side**, mémoire à mettre à jour                                                                                                      |
| `/sitemap.xml 404 = bug critique`               | mémoire `axionia_bugs_seo_preexistants_2026-05-09` + Phase 0 | AGT-04 explique : trade-off Next 16 documenté `src/app/sitemap-index.xml/route.ts:1-20`. Le rôle est rempli par `/sitemap-index.xml`. **Dégradé en P1 cosmétique** (lien Footer + lien dans robots.txt à pointer correctement). |
| `Resend usage prompt master`                    | Prompt master § 3.3 + R-05 mentionnent Resend                | Réalité code : Nodemailer + PowerMTA + MailWizz. Resend INTERDIT (`.env.example:32`). **Erreur du prompt master, pas un drift code**.                                                                                           |
| `BookingFlow.tsx + HouseCalendar.tsx code mort` | AGT-01 P1-03                                                 | Confirmé code mort par AGT-01 lui-même (`grep -rn 'import.*HouseCalendar' src/app` = 0 hit) → reste un P1 nettoyage, **pas un faux positif** mais à arbitrer Will (suppression ou réintégration).                               |

## Findings dégradés (sévérité abaissée)

| Finding                              | Sévérité initiale      | Sévérité après Pass B | Raison                                                                                                                               |
| ------------------------------------ | ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| P0-CONF-07 Aucun `@db.Timestamptz`   | P0                     | P1                    | 1 seule source code-side, AGT-11 unique. Will doit décider impact UTC.                                                               |
| P0-CONF-10 HSTS 2 ans vs 1 an        | P0 (drift cité prompt) | P1 (cosmétique)       | 1 an reste OWASP-compliant. Pas d'impact sécu effectif.                                                                              |
| P0-CONF-11 Ratio Paris 76/24 vs 95/5 | P0 (AGT-05)            | P1 (méthodologique)   | Contradiction AGT-05 (76/24) vs AGT-15 (96/4). Méthodes de mesure incompatibles → besoin d'arbitrage méthode avant de classer P0/P1. |
| P0-CONF-14 `<img>` crus              | P0 (A11Y-01)           | P1                    | A11Y reste OK si alt présent, perf marginale (2 images sur ~50 pages).                                                               |
| P0-CONF-15 Tests Axe 6 %             | P0                     | P1                    | Dette technique. Site déjà en prod non bloqué — couverture progressive.                                                              |
| P0-CONF-16 Web Vitals non re-mesurés | P0                     | P1                    | Mémoire baseline 47.2 % pré-patches. AGT-03 P-06 LHCI skippé Phase 4 (postbuild risk). Action = re-mesurer locale.                   |

## P1 promus en P0 (rares)

Aucun.

## Findings sans source unique mais confirmés par auto-évidence (validés)

| Finding                                                    | Source unique | Évidence factuelle                                                                                                                                                      |
| ---------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-CONF-08 Sentry self-hosted promis mais inexistant       | AGT-14        | Lecture directe `docker/monitoring/docker-compose.monitoring.yml` (sa promesse en commentaires vs sa réalité absente) = évidence factuelle ne nécessitant pas 2e agent. |
| P0-CONF-13 `tests/integration/server-actions.test.ts` ment | AGT-13        | Lecture directe du fichier (`safeParse()` only au lieu de pipeline complet promis ll. 1-10) = évidence factuelle.                                                       |
| P0-CONF-18 DMARC absent                                    | Phase 4 P-03  | `nslookup -type=TXT _dmarc.axion-ia.com` = NXDOMAIN. DNS public, pas de 2e agent nécessaire.                                                                            |

## Patterns d'erreur agents (méta-analyse)

1. **AGT-05 vs AGT-15 contradictions de ratio HCU** : méthodologie grep ≠ méthodologie inspection manuelle. Future audits → standardiser scriptable.
2. **AGT-04 alarmiste sur sitemap.xml** : finding initial P1, dégradé après lecture du trade-off documenté. Le code-comment doit servir de référence.
3. **Mémoires obsolètes** : `axionia_bugs_seo_preexistants_2026-05-09` à mettre à jour (og:image = résolu).
4. **Prompts d'audit peuvent contenir des erreurs** : mention Resend dans prompt master alors qu'il est interdit. Cross-référencer toujours code-side.
