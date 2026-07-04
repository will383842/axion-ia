# 02 — Sources, collecte & enrichissement

> Spec de conception. Source de vérité : `PLAN-DIRECTEUR-V1.md` §6, §16. **Tout gratuit. Infra axionia
> (BullMQ + Prisma + Server Actions), pas de Fastify.**

## 1. Sources gratuites

| Source                                                              | Fournit                                                                                                     | Accès                                   | Clé           | Rate-limit                | Rôle                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------- | ------------------------- | ---------------------------------------- |
| **Stock Sirene open data** (INSEE/data.gouv)                        | SIREN/SIRET, NAF, tranche effectif→taille, adresse/commune/dép., forme & catégorie, `statutDiffusion`, état | Fichiers CSV (~4 Go, MAJ mensuelle)     | Non           | — (download)              | **Backbone exhaustivité**                |
| **Flux MAJ quotidien Sirene**                                       | Créations, cessations, changements                                                                          | Fichier delta / `dateDernierTraitement` | Non           | —                         | **Fraîcheur**                            |
| **API recherche-entreprises** (`recherche-entreprises.api.gouv.fr`) | Dirigeants + siège, filtres NAF/dép/tranche/catégorie                                                       | REST                                    | Non           | ~7 req/s                  | **Ciblage/UX, dénombrement wizard**      |
| **API Sirene** (`portail-api.insee.fr`)                             | Vérif ponctuelle, curseur sans plafond                                                                      | REST                                    | Token gratuit | ~30 req/min (à confirmer) | Complément/vérif                         |
| **INPI RNE**                                                        | Dirigeants & représentants à jour                                                                           | API/open data                           | Token gratuit | —                         | Dirigeants (⚠️ opposition RNE)           |
| **Annuaire administration** (`api-lannuaire.service-public.fr`)     | Emails/tél **institutionnels officiels** publics                                                            | REST                                    | Non           | —                         | **Volet public** (mairies, préfectures…) |
| **BODACC** (DILA/data.gouv)                                         | Créations, procédures collectives, cessions, radiations                                                     | API                                     | Non           | —                         | Événements / dé-prioriser                |
| **BAN** (`api-adresse.data.gouv.fr`)                                | Géocodage lat/lng                                                                                           | REST                                    | Non           | —                         | Carte                                    |
| **Site public de l'entreprise**                                     | Email, téléphone, responsables                                                                              | Mini-crawl HTTP                         | Non           | politesse                 | Enrichissement (§4)                      |

**Interdits** (CGU / RGPD) : LinkedIn, Pages Jaunes, société.com, annuaires privés, **scraping de SERP**
(Google/Bing) — retiré de l'architecture.

## 2. Collecte de masse (exhaustivité)

Pipeline `stock-ingestor-worker` :

1. Télécharger le Stock Sirene (stub-aware : early-exit si `stub.invalid`).
2. Stream-parse CSV (pas de chargement mémoire complet).
3. **Bulk-upsert par batch** (`createMany skipDuplicates` ou table staging + `INSERT … ON CONFLICT`),
   dédup SIREN/SIRET.
4. Alimenter **`StockReference`** (dénombrement par dép × NAF × taille × type).
5. `delta-worker` quotidien : appliquer créations/cessations/changements (marquer cessés, ne pas purger).

**Exhaustivité PROUVÉE** : `attendu` = compte réel (Stock/`total_results`) ; une cellule n'est `fait`
que si `collecte ≥ attendu` (tolérance documentée), sinon `erreur` + alerte. KPI « écart d'exhaustivité »
= Σattendu − Σcollecté. Cellules **paresseuses** (créées seulement si attendu > 0).

**Mode ciblage API (résiduel)** : découpage adaptatif récursif (NAF section→…→sous-classe → tranche →
commune → fenêtrage déterministe sur SIREN) pour ne jamais tronquer silencieusement à 10 000.

## 3. Robustesse & débit

- **Rate-limit distribué RÉEL** : une **file BullMQ par source** avec `limiter:{max,duration}` (pattern
  `content-fact-check-worker.ts`) + **token-bucket Redis** partagé (`chatbot/resilience/token-bucket.ts`)
  pour tenir la limite **globale** malgré la concurrence. Respect `Retry-After` sur 429.
- **Circuit breaker par source** (ouvre après K échecs → pause de la file + alerte, half-open).
- **Validation Zod** de chaque réponse API (un changement de schéma silencieux ≠ écriture de `null` en masse).
- **Idempotence** : DB = source de vérité ; jobs éphémères (`removeOnComplete`) **ou** nonce d'attempt
  dans le jobId (`cell:<id>:run:<runId>`) → évite le no-op BullMQ sur jobId existant. Test « re-enqueue
  après failed » obligatoire.
- **Backpressure** : fenêtre bornée de jobs en vol (drip-feed via scheduler). Priorités : collecte > enrichissement.

## 4. Enrichissement gratuit (cascade)

1. **Données ouvertes** : dirigeants, adresse, ville, dép., effectif, forme (déjà fournis).
2. **Découverte du site web** : (a) champ site des données ouvertes ; (b) heuristique domaine + vérif
   **DNS/HTTP réelle**. **Pas de scraping de SERP.**
3. **Confirmation d'appartenance au SIREN** : domaine retenu uniquement si sa page mentions-légales/contact
   contient le **SIREN** ou la **dénomination** → évite de scraper une homonyme. Sinon `non_contactable`.
4. **Mini-crawl 2 passes** (`enrich-worker`, via `ssrfSafeFetch` + robots.txt/ai.txt) :
   - **Passe A — coordonnées** : `/mentions-legales` → `/contact` (+ variantes) → footer `/`. Arrêt à
     email+tél. Budget `maxPagesContact=3`.
   - **Passe B — personnes** (si `enrichirPersonnes`) : `/equipe`, `/notre-equipe`, `/direction`,
     `/qui-sommes-nous`, `/a-propos`, `/associes`, `/organigramme`, `/team`… (SSOT `crawl-targets.ts`) →
     capture **responsables de secteur/équipe**. Toujours tentée, indépendante de A. Budget
     `maxPagesPersonnes=4`, profondeur ≤ 2. Plafond global `maxPagesEntreprise=7`.
   - Politesse : timeout 8 s, 2 MB/page, crawl-delay, 1 entreprise/domaine à la fois (verrou Redis),
     ETag/If-Modified-Since sur re-vérif (304 = no-op).
5. **Validation gratuite** : email (syntaxe RFC + **MX DNS**, marque `role` pour contact@/info@),
   téléphone (normalisation **E.164 FR**). Statut dans `verifStatus`.
6. **Matching personne ↔ email nominatif** : patterns `prenom.nom@`, `pnom@`, `nom@` → `personId` +
   `personMatchConfidence` ; `isNominatif` vs `isGenerique`.

## 5. Anti-re-scrape / fraîcheur

Cellules `fait` sautées ; upsert par SIREN ; fenêtre `refreshAfter` (SiteSetting) ; `contentHash`
(no-op si inchangé) ; skip enrichissement récent ; opt-out exclu ; mode « rafraîchir » explicite.

## 6. Organisations publiques

EDF/La Poste/SNCF/administrations/collectivités : même pipeline (SIREN), dimension `typeOrganisation`.
Pour les **contacts publics**, privilégier l'**Annuaire de l'administration** (coordonnées officielles)
plutôt que le scraping de leurs sites.
