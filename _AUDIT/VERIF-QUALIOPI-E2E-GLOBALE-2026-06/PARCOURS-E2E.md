# PARCOURS-E2E — flows exécutés & résultats observés

Niveaux : **RUNTIME** = exécuté contre Postgres dev réel (probe tsx, sortie observée) ;
**TESTÉ** = spec vitest verte (mocke prisma/auth) ; **CODE** = revue de code `fichier:ligne`.
Les server actions portent `requireAdminWrite()` (auth NextAuth) → non appelables depuis un probe tsx
sans session ; elles sont donc prouvées au niveau TESTÉ + CODE, et leurs gardes pures au niveau RUNTIME.

## 1. Seed du référentiel au boot — **RUNTIME ✅**
`probes/01,02,03`. Clean-room DB vierge : offres `0→11`, config `0→30/30`, grille active `v1→v2`.
Idempotent, non-destructif (NDA préservé), stub no-op, verrou concurrence OK, kill-switch présent.
🔴 P0 trouvé (advisory lock cassé) → **corrigé** → re-prouvé.

## 2. Gardes financement (OPCO accord/tripartite, CPF EDOF, FT POEI) — **RUNTIME ✅**
`probes/04`. Chaque violation forcée → `ok=false, gravite=critique` avec message légal. Ces résultats
sont consommés par `transitionSessionAction` (garde `planifiee→en_cours`) → démarrage bloqué.

## 3. Machine à états session — **RUNTIME ✅**
`probes/04`. Whitelist `{planifiee:[en_cours,annulee,reportee], en_cours:[realisee,annulee], realisee:[],
annulee:[], reportee:[]}`. 5 transitions interdites refusées, 5 autorisées acceptées. Idempotence
`FormationTransition unique(sessionId,toStatus,trigger)` + catch P2002 (CODE :297).

## 4. Clôture session sans émargement — **TESTÉ ✅ (corrigé C2)**
Garde manuelle (`sessions.ts:246-266`) ET désormais cron (`crons-worker` +garde) refusent « réalisée »
sans aucun émargement. 3 specs : skip-sans-émargement / applique-avec-émargement / 0-inscrit-applique.

## 5. Génération des 19 templates PDF — **RUNTIME ✅**
38 tests de rendu (`attestations-factures`/`conventions`/`sessions-docs`/`render`/`support-pdf` specs) :
chaque template produit un buffer **`%PDF`** non vide (rendu React-PDF pur, sans mock DB). Facture =
TVA 0 + mention art. 261-4-4° CGI verbatim ; certificat = heures en centièmes.

## 6. Attestation / certificat & abandon/exclu — **TESTÉ ✅ (corrigé C4)**
Attestation refuse abandon/exclu (`attestation-service.ts:121`). Certificat de réalisation refuse
désormais aussi (corrigé C4, +2 specs). `publishFormationAction` exige `validatedBy` (CODE :269).

## 7. Devis → convention — **TESTÉ + CODE**
`transformDevisToConventionAction` : pose `transforme_convention` (idempotent), garde « accepté requis »
bloquante ; la session se crée séparément avec `devisId` (couplage faible documenté, R11/feature).

## 8. Facturation 3 types de client — **CODE ✅ / numérotation corrigée C3**
Intra (session-level), inter-entreprises (par inscription, `interEntreprises` requis), B2C
(particulier → destinataire « stagiaire »). Numérotation facture session-level rendue atomique
(`withNumberRetry`, C3) — les autres chemins (session/devis/facture-inter) l'étaient déjà.

## 9. Formateur — assignation bloquante si non habilité — **CODE ✅**
`assignTrainerToSessionAction` : `isTrainerHabilite` (actif/statut/formationsHabilitees/
sousTraitantVerifieAt) → refus si non habilité.

## 10. RGPD anonymisation + révocation portail — **TESTÉ ✅ (corrigé C5)**
`supprimerStagiaire` : anonymisation destructive réelle (nom/prénom/email/handicap → `[supprime]`/null)
**+ révocation des accès portail** (corrigé C5, transaction, +1 spec). Token portail CSPRNG 256 bits.

## 11. Pages admin & RBAC — **CODE ✅** (analyse exhaustive des 40 pages)
40/40 null-safe (`notFound()` sur les `[id]`), RBAC (auth+rôle) sur 40 pages + SSE (auth+rôle+rate-limit
30/60s). 2 liens nav hub corrigés (C6), 1 titre fallback (C7).
