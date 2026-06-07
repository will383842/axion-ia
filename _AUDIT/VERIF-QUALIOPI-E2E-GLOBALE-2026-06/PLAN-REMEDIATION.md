# PLAN DE REMÉDIATION — Qualiopi E2E Globale · 2026-06-07

Mode **correction autopilot** : les BUGS ont été corrigés au fil de l'eau (✅ FAIT). Les
DÉCISION-WILL / DONNÉE-À-SAISIR ne sont PAS modifiés (cf. `QUESTIONS-WILL.md`).

## ✅ BUGS CORRIGÉS (cette session) — tous vérifiés (typecheck + specs + RUNTIME le cas échéant)

| # | Sév | Bug | Fichier | Correctif | Preuve |
|---|-----|-----|---------|-----------|--------|
| C1 | 🔴 P0 | **Seed auto au boot throw silencieusement** (`pg_try_advisory_lock(bigint,bigint)` inexistant) → référentiel jamais peuplé au 1ᵉʳ boot prod ; fail-soft avale l'erreur ; bouton admin idem | `src/server/qualiopi/seed/reference-data.ts` | cast `::int4` sur lock + unlock | RUNTIME probes 01/02/03 (clean-room : offres 0→11, config 0→30, grille v2) |
| C2 | 🔴 P0 | **Clôture cron `en_cours→realisee` sans garde émargement** → session « réalisée » sans preuve de présence, alimente BPF/certificats/attestations ; contourne la garde manuelle | `src/server/queue/workers/qualiopi-formation-crons-worker.ts` | check émargement avant transition ; skip + log si absent (symétrie garde manuelle) | spec +3 tests (skip/applique/0-inscrit) |
| C3 | 🟠 P1 | **Facture session-level non atomique** (`count+1` sans `withNumberRetry`) → collision concurrente P2002 non rattrapée ; tous les autres chemins protégés sauf celui-ci | `src/server/actions/qualiopi/financements.ts` | `withNumberRetry` autour de l'allocation+create | typecheck + specs financements verts |
| C4 | 🟠 P1 | **Certificat de réalisation émis pour abandon/exclu** (l'attestation refuse, le certificat non) | `src/server/actions/qualiopi/documents.ts` | garde `abandon`/`exclu` → refus (R.6313-3) | spec +2 tests (abandon/exclu refusés) |
| C5 | 🟠 P1 | **RGPD : `supprimerStagiaire` ne révoque pas `PortailAcces`** → token portail actif d'un stagiaire anonymisé reste exploitable 90 j | `src/server/qualiopi/portail/rgpd-service.ts` | `$transaction` : anonymisation + `portailAcces.updateMany(revoked:true)` | spec +1 test (révocation) |
| C6 | 🔵 P3 | **Liens de nav erronés** dans le hub : « Formateurs »→`/formations`, « Stagiaires »→`/sessions` | `…/qualiopi/page.tsx` | liens corrigés `/formateurs` `/stagiaires` | revue code |
| C7 | 🔵 P3 | **Titre sans fallback** : `Financement — null` si `titreSession` null | `…/sessions/[id]/financement/page.tsx` | `?? numero` | revue code |

## 🟡 NON-CORRIGÉS — décisions produit (cf. QUESTIONS-WILL.md), pas des bugs

- Anti-hallucination warning-only (F1) · gate score ≥80 à la publication (validation humaine = garde actuelle)
- off.29 proxy faux / off.20 proxy / off.7-16 preuves en dur · proxies pilotage M2/M7/M9/M11/M13/M14
- Garde émargement manuelle « 1 émargement sur N suffit » + fail-soft sur erreur de lecture (S5) — durcissement possible
- Garde financement fail-open si `getFinancementValidations` throw (`sessions.ts`) — durcissement possible
- Devis→convention sans création de session liée (couplage faible, déjà classé feature R11)
- B2C : pas de garde de rétractation L.6353-3 à -7 (mention présente, pas de blocage avant encaissement)
- P2 sécurité : logout portail ne révoque pas le token DB · rate-limit absent sur `accederPortailAction`
  (Server Action) · `checkRateLimit` fail-open si Redis down · fallback PII cleartext hors prod · fuite
  mineure 3 raisons d'échec post-auth `mon-espace` · `void prisma.update(lastUsedAt)` non-awaité

## 🟢 VÉRIFIÉ CONFORME (aucune action)

- Gardes financement OPCO accord/tripartite, CPF EDOF, FT POEI → **bloquent en critique** (RUNTIME probe 04)
- Machine à états session : transitions interdites refusées, autorisées acceptées (RUNTIME probe 04)
- 19 templates PDF → **%PDF** réel (38 tests render verts)
- Facture TVA=0 + mention art. 261-4-4° CGI verbatim · subrogation n° dossier bloquant · barème jamais inventé
- Attestation refusée abandon/exclu · assignation formateur non habilité bloquée · idempotence FormationTransition
- 40 pages admin null-safe (`notFound()` sur les `[id]`) · RBAC sur 40 pages + SSE (auth+rôle+rate-limit)
- Portail token CSPRNG 256 bits + findUnique index unique + timingSafeEqual + cookie HttpOnly/Secure +
  expiration + révocation · non-énumérabilité attestation · anonymisation destructive réelle ·
  AES-256-GCM handicap write-only + fail-fast prod · marquage `aiGenerated` (AI Act art. 50)
- **0 mock/TODO/stub** en chemin de prod (hors fallbacks légitimes `stub.invalid`)
- Registres complets (réclamations, veille×3, sous-traitants, partenariats, revue direction) · BPF réel ·
  pilotage réel · off.32 correctement gaté sur `statut=validee`

## Priorisation résiduelle
- **P0 deploy** : aucun restant (C1, C2 corrigés).
- **P1 vente financée** : aucun bug restant (C3, C4, C5 corrigés) ; reste les **DONNÉE-À-SAISIR** (NDA,
  SIREN, barèmes, RS/RNCP) sans lesquelles une vente financée réelle ne peut pas se faire — non-code.
- **P2 conformité** : proxies indicateurs (décisions Will) + durcissements optionnels.
- **P3** : cosmétique (corrigés C6/C7).
