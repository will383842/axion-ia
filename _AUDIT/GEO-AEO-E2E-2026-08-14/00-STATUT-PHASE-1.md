# STATUT PHASE 1 — audit GEO/AEO 50 agents (mis à jour 2026-08-14 19:10 UTC)

## Avancement

| Squad | Terminés | Manquants |
|---|---|---|
| A — crawl & découverte | A1 A2 A3 A4 A5 A6 (6/6) | — |
| B — JSON-LD | B1 B2 B3 B4 B6 (5/6) | **B5** (JobPosting) |
| C — metadata & indexabilité | C1 C2 C3 C4 C5 (5/5) | — |
| D — content-gen | D1 D3 D5 D7 D8 (5/8) | **D2 D4 D6** |
| E — images | E2 E3 (2/4) | **E1 E4** |
| F — live moteurs | F2 F4 (2/7) | **F1**(relancé) **F3 F5 F6 F7** |
| G — perf & rendu | 0/4 | **G1 G2 G3 G4** |

**25/40 terminés**, 14 P0 et 68 P1 remontés. 14 agents tués par la limite de
session (reset 00 h 30 Paris = 22 h 30 UTC), 1 (D4) par une coupure réseau.

Reprise programmée : moniteur armé jusqu'à 22:35 UTC, puis relance des 15
agents manquants, puis Phase 2 (squad H) et Phase 3 (squad S).

## Fil rouge déjà visible (à consolider en Phase 3)

**1. Le pipeline de déploiement ampute la preuve d'existence.** Trois agents
indépendants (A3, B1, B6) convergent : les listes du job warm
(`deploy-coolify.yml:747` et `:778`) oublient `/fr`, `/fr/mentions-legales`,
`/fr/conditions-generales`, les 4 pages services, `/fr/memo-isere`,
`/fr/blog`. Après chaque deploy, la home perd son bloc 77 avis et son
AggregateRating, les mentions légales repassent en « communiqué sur demande »
(donc SIREN/TVA invisibles), et le step warm re-fige cette version amputée à
l'edge Cloudflare. **Confirmé en direct** à 18:53:27 UTC : `AggregateRating`
absent du HTML servi, `cf-cache-status: HIT`, `Age: 1520` (cf.
`A3-ADDENDUM-preuve-live-postdeploy.md`). C'est le P0 n°1 : il attaque
précisément le « déficit d'existence vérifiable » diagnostiqué le 07-20.

**2. Le JSON-LD commercial est invisible aux crawlers IA.** B2 et B4
convergent : sur ~4 300 pages villes et ~30 gabarits, les schémas
(Service+Offer, AggregateOffer, FAQPage, LocalBusiness, HowTo) sont injectés
en `afterInteractive` — absents du HTML brut, donc invisibles à
Perplexity/OAI-SearchBot/Claude-SearchBot qui n'exécutent pas le JS.

**3. La machine à contenu est à l'arrêt depuis 21-25 jours.** D1, D3, D5, D7,
D8, A5, A3 le mesurent chacun de leur angle : dernier article 2026-07-20,
flux Google News éteint, gates jamais exercées, banque de mots-clés à
`usage_count=0`, tracking GSC gelé. Cause connue et déjà actée (kill switch
OpenAI) — non re-signalée comme découverte, mais ses effets en cascade le sont.

**4. Le verdict live est en dégradation.** F2 : position moyenne 22,2 → 25,5
et CTR ÷2,7 en deux semaines (W33), chaîne de soumission GSC en échec 100 %
depuis juin (token readonly). F4 : les moteurs de réponse décrivent Axion-IA
**sans jamais citer axion-ia.com** (Crunchbase et f6s captent la marque),
0 citation sur les requêtes commerciales, et l'homonyme Axion Formations
capte l'intent « avis ».

**5. Incohérences de politique IA.** A1 : `ai.txt` publie un `Allow: /` qui,
au sens du standard Spawning que le fichier cite lui-même, vaut opt-**in** au
training — l'inverse exact de la doctrine. `ai-policy.json` déclare CC-BY-4.0
sur le site entier. Et les exports de l'Observatoire (dataset citable annoncé
dans llms.txt) sont bloqués par `Disallow: /api/` — récidive exacte de la
classe de bug `/api/markdown` corrigée le 30/07.

## Rappel de périmètre

Audit-only : aucun patch appliqué, aucun commit, aucune soumission d'URL.
Tous les correctifs ci-dessus sont **prescrits**, pas exécutés.
