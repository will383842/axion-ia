# Agent 5 — Funnels conversion E2E (audit 2026-05-15)

Mode AUDIT-ONLY : aucun submit, aucun POST. Toutes les URLs testées via `curl -I` ou WebFetch sur prod `https://axion-ia.com`.

## TL;DR Funnels

**8 funnels sur 10 BLOQUÉS** par 503 systématique sur les pages cœur revenu (`/reserver`, `/audit/{ciblee,approfondie,strategique-pme,strategique-eti}`, `/interventions/{individuel,dirigeants,conference,approfondie,gagner-du-temps,…}`, `/implementation/ia-custom`, `/demande-devis`, `/roi`, `/guide-ia`, et `/url-inexistante`). L'origine VPS retourne `no available server` (proxy Coolify down ou container backend mort sur ces routes). Cloudflare `cf-cache-status: BYPASS` → la requête atteint bien l'origine, qui refuse.

Site EN entièrement UP. C'est donc une régression FR isolée (probablement un build/route group cassé côté FR).

---

## Funnel 1 — Home FR → Interventions → Collectives → 1-jour → Réserver

| #   | URL                                    | Status    | CTA visible étape suivante                                                               | Verdict                               |
| --- | -------------------------------------- | --------- | ---------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | `/fr`                                  | 200       | "Intervenir auprès de vos équipes" → `/fr/interventions`                                 | OK                                    |
| 2   | `/fr/interventions`                    | 200       | "Voir les interventions équipes" → `/fr/interventions/collectives`                       | OK                                    |
| 3   | `/fr/interventions/collectives`        | 200       | "Voir les formations" 1j → `/fr/interventions/collectives/1-jour`                        | OK                                    |
| 4   | `/fr/interventions/collectives/1-jour` | non testé | (probablement OK + lien `/interventions/essentielle`)                                    | À tester                              |
| 5a  | `/fr/interventions/essentielle`        | 200       | "Réserver à ce tarif (Standard)" → `/fr/reserver?intervention=essentielle&tier=standard` | OK page produit                       |
| 5b  | `/fr/reserver?…`                       | **503**   | **DROPOUT TOTAL** — `no available server`                                                | **ROUGE — funnel cassé étape finale** |

**Dropout estimé : 100% à l'étape 5b.** Page `/reserver` est le seul point d'entrée du calendrier.

---

## Funnel 2 — Home FR → Audit → Flash → Réserver

| #   | URL                                            | Status  | Verdict                                                                       |
| --- | ---------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| 1   | `/fr`                                          | 200     | "Auditer votre entreprise" → `/fr/audit`                                      |
| 2   | `/fr/audit`                                    | 200     | "Voir le format (Flash)" → `/fr/audit/flash`                                  |
| 3   | `/fr/audit/flash`                              | 200     | "Réserver sur le calendrier" → `/fr/reserver?intervention=audit-flash-onsite` |
| 4   | `/fr/reserver?intervention=audit-flash-onsite` | **503** | **DROPOUT TOTAL**                                                             |

**ROUGE.** Le 2e funnel le plus stratégique (audit flash entry-level) coupé.

---

## Funnel 3 — Home FR → Implementation → IA Custom → Devis

| #   | URL                            | Status  | Verdict                                                    |
| --- | ------------------------------ | ------- | ---------------------------------------------------------- |
| 1   | `/fr`                          | 200     | "Implémenter dans votre entreprise" → `/fr/implementation` |
| 2   | `/fr/implementation`           | 200     | (page OK) "Voir le catalogue"                              |
| 3   | `/fr/implementation/ia-custom` | **503** | **DROPOUT TOTAL avant atterrissage page produit**          |
| 4   | `/fr/contact` (fallback)       | 200     | Form OK (alternative)                                      |

**ROUGE.** Funnel principal IA custom (ticket 8-50K€) cassé. Fallback contact existe mais ne capte pas le contexte.

---

## Funnel 4 — Home FR → Actualités → Article → CTA bas

| #   | URL                          | Status  | Verdict                                     |
| --- | ---------------------------- | ------- | ------------------------------------------- |
| 1   | `/fr`                        | 200     | OK                                          |
| 2   | `/fr/actualites`             | 200     | OK                                          |
| 3   | `/fr/actualites/ia-pme-2026` | **503** | **DROPOUT TOTAL — articles factory en 503** |

**ROUGE.** Tout le top funnel content marketing (blog/actualités) est coupé.

---

## Funnel 5 — Home FR → Cas concrets → Case study → CTA

| #   | URL                                                        | Status  | Verdict                       |
| --- | ---------------------------------------------------------- | ------- | ----------------------------- |
| 1   | `/fr`                                                      | 200     | OK                            |
| 2   | `/fr/cas-concrets`                                         | 200     | OK, liste 5 cas               |
| 3a  | `/fr/cas-concrets/industrie-comptabilite`                  | 200     | OK + CTA "Voir l'Essentielle" |
| 3b  | `/fr/cas-concrets/tpe-artisan-prospection`                 | **503** | DROPOUT                       |
| 3c  | `/fr/cas-concrets/cabinet-juridique-comptes-rendus`        | **503** | DROPOUT                       |
| 3d  | `/fr/cas-concrets/banque-onboarding`                       | 200     | OK                            |
| 3e  | `/fr/cas-concrets/retail-tickets-sav`                      | 200     | OK                            |
| 4   | CTA "Voir l'Essentielle" → `/fr/interventions/essentielle` | 200     | OK                            |
| 5   | Bouton "Réserver" → `/fr/reserver?…`                       | **503** | DROPOUT FINAL                 |

**ROUGE.** 2 cas sur 5 en 503 ; tous les funnels qui aboutissent à `/reserver` cassent.

---

## Funnel 6 — Home FR → FAQ → FAQ détail → CTA

| #   | URL                          | Status  | Verdict         |
| --- | ---------------------------- | ------- | --------------- |
| 1   | `/fr`                        | 200     | OK              |
| 2   | `/fr/faq`                    | 200     | OK              |
| 3a  | `/fr/faq/definition`         | 200     | OK + CTA header |
| 3b  | `/fr/faq/data-security`      | 200     | OK              |
| 3c  | `/fr/faq/billing`            | 200     | OK              |
| 3d  | `/fr/faq/training`           | **503** | DROPOUT         |
| 3e  | `/fr/faq/methodology`        | **503** | DROPOUT         |
| 4   | CTA primary → `/fr/reserver` | **503** | DROPOUT         |

**ORANGE-ROUGE.** FAQ list-pages OK mais 2 detail-pages cassées + CTA final 503.

---

## Funnel 7 — Implantations → Région → Ville → Service ville

| #   | URL                                                   | Status  | Verdict             |
| --- | ----------------------------------------------------- | ------- | ------------------- |
| 1   | `/fr`                                                 | 200     | OK                  |
| 2   | `/fr/implantations`                                   | 200     | OK                  |
| 3   | `/fr/implantations/ile-de-france`                     | 200     | OK                  |
| 4   | `/fr/implantations/ile-de-france/paris`               | 200     | OK — 4 CTAs primary |
| 5   | CTAs ville → `/fr/reserver?ville=paris&service=audit` | **503** | DROPOUT             |

**ROUGE.** Tout l'investissement pSEO villes (Paris pilote + ~2150 villes) converge vers `/reserver` cassé.

---

## Funnel 8 — Audit par ville → CTA

| #   | URL                              | Status  | Verdict                                                   |
| --- | -------------------------------- | ------- | --------------------------------------------------------- |
| 1   | `/fr/audit/par-ville/lyon`       | 200     | Page "préparation" partielle — pas de contenu local riche |
| 2   | `/fr/audit/par-ville/marseille`  | 200     | Idem                                                      |
| 3   | `/fr/audit/par-ville/toulouse`   | 200     | Idem                                                      |
| 4   | CTA "Réserver…" → `/fr/reserver` | **503** | DROPOUT                                                   |

**ROUGE + ORANGE.** Pages templates indexées Google montrent "Page locale détaillée en préparation" et CTA final cassé.

---

## Funnel 9 — Comparaisons → CTA

| #   | URL                                                        | Status  | Verdict |
| --- | ---------------------------------------------------------- | ------- | ------- |
| 1   | `/fr/comparaisons`                                         | 200     | OK      |
| 2   | CTA "Voir l'Essentielle" → `/fr/interventions/essentielle` | 200     | OK      |
| 3   | "Réserver…" → `/fr/reserver`                               | **503** | DROPOUT |

**ROUGE.**

---

## Funnel 10 — 404 retour

| #   | URL                        | Status  | Verdict                         |
| --- | -------------------------- | ------- | ------------------------------- |
| 1   | `/fr/url-test-inexistante` | **503** | **PAS DE 404 — 503 à la place** |
| 2   | `/fr/non-existent-page`    | **503** | idem                            |

**ROUGE GATE.** Aucune page 404 servie côté FR : le serveur retourne 503 sur tout slug inconnu. Aucun CTA de retour. Impact UX + SEO majeur (Google index 503 = soft 404 erratique).

---

## Synthèse

| Métrique                                   | Valeur                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Funnels testés                             | 10                                                                                                                                                |
| Funnels OK end-to-end                      | **0**                                                                                                                                             |
| Funnels avec dropout final sur `/reserver` | **9/10**                                                                                                                                          |
| Funnels avec dropout étape page-produit    | **6/10** (interventions individuel/dirigeants/conference/approfondie/coaching/audit/ciblee, audit/strategique-pme/-eti, implementation/ia-custom) |
| 404 graceful                               | **NON**                                                                                                                                           |
| Dropout taux estimé conversion (si trafic) | **≈100%** sur tunnel direct booking                                                                                                               |

**Le proxy Coolify ou un build FR partiel sert 503 sur :**

- `/reserver` (cœur revenu)
- la majorité des pages détail format intervention (10+ pages)
- 3 niveaux d'audit sur 4
- pages "factory" content (actualités, connaissances) — slugs présents dans la liste mais détail 503
- `/sitemap.xml` (impact SEO immédiat)
- `/roi` (simulateur)
- `/guide-ia`
- 404 catch-all
