# 🚨 NO-GO ALERT — Audit E2E 2026-05-11

**Verdict** : 🔴 **NO-GO selon règle stricte § 8.1 du prompt master**
**Score** : 78.7 / 100 (sous seuil 🟡 = 85)
**P0 confirmés Pass B** : 12 (> 3)
**Cible** : `https://axion-ia.com` (site en PROD live depuis 2026-05-08)

---

## Lecture immédiate (essentiel)

Le 🔴 NO-GO **n'est PAS une alarme « site down ou breach immédiat »**.

- Site live + healthz OK + headers OWASP en place + RGPD partiel OK.
- Le NO-GO signifie : **le code ne mérite pas un sign-off "production-ready" sans corrections** selon la règle stricte de l'audit (≥ 85 ET ≤ 3 P0).

**Will doit arbitrer** :

- Soit traiter les 12 P0 (~2 jours dev + actions Will) → ré-audit → 🟢/🟡.
- Soit accepter explicitement le 🔴 comme état transitoire et publier `WHAT-TO-DO-NOW.md` avec une priorisation différente.

**En attendant l'arbitrage, je n'ai PAS publié `WHAT-TO-DO-NOW.md`** (règle § 8.3).

---

## Top 3 raisons NO-GO

### 1. 🔴 Monitoring/Observabilité aveugle en prod (3 P0)

- **`withSentryConfig` absent de `next.config.ts:140`** → sourcemaps non uploadées → stacks prod minifiées illisibles.
- **PII scrub Sentry absent** (`beforeSend`, `sendDefaultPii`) dans les 3 configs (server/edge/client) → IP, cookies, headers Authorization **fuient dans Sentry par défaut**. Aggravé par debug dump credentials `auth.ts:99-117` actif depuis 2026-05-10.
- **Sentry self-hosted promis** dans `docker/monitoring/docker-compose.monitoring.yml` (commentaires) **mais inexistant** → faux signal documentation/runbook.

→ Si incident prod, **diagnostic très handicapé** + **fuite RGPD possible** via breadcrumbs.

### 2. 🔴 Flow business `/reserver` cassable (2 P0)

- **Turnstile widget client absent** dans les 6 forms (commentaire explicite `ContactForm.tsx:60-62`). Si `TURNSTILE_SECRET_KEY` set en prod, **toutes les soumissions échouent** (verifyTurnstile fail-closed). Conversion `/reserver` à 0%.
  - **À vérifier d'urgence Will** : `Coolify env vars | grep TURNSTILE_SECRET_KEY` → si vide, P0 dégradé ; si set, **production marketing cassée silencieusement depuis le dernier deploy**.
- **Aucun test E2E `/reserver`** → cette panne n'aurait jamais été détectée en CI.

### 3. 🔴 RGPD bouclier incomplet (3 P0)

- **`/mes-donnees/export`** référencée dans `gdpr-export/request/route.ts:48` (email RGPD) **mais inexistante** → lien 404 dans email d'export RGPD. Article 20 portabilité non opérationnel bout-en-bout.
- **DPA Hetzner + Cloudflare non signés** (`_AUDIT/DPA-REGISTER.md:18-19,45`). Article 28 RGPD non démontré formellement (action Will hors code, 1 h).
- **DMARC absent** (`_dmarc.axion-ia.com` NXDOMAIN). Emails AxionIA usurpables. Aggravation du risque PowerMTA outbound.

---

## Risques immédiats (impact 24-48 h)

| Domaine                | Risque concret                                                      | Probabilité                  | Impact                                      |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| **Forms /reserver**    | 100 % submissions rejetées si Turnstile secret set                  | Inconnue (action vérif Will) | Critique — perte de leads silencieuse       |
| **Sentry RGPD**        | Breach Article 32 si erreur prod avec IP user dans breadcrumbs      | Moyenne                      | Sanction CNIL possible (€10k-€20M selon CA) |
| **GDPR export 404**    | Réclamation utilisateur "export demandé jamais reçu" → plainte CNIL | Faible (peu de demandes V1)  | Modéré                                      |
| **DPA non signés**     | Audit CNIL ou inspection trouve gap formel Art. 28                  | Faible (start-up phase)      | Modéré-Élevé                                |
| **DMARC absent**       | Spoofing axion-ia.com → phishing clients                            | Faible-Moyenne               | Élevé (réputation)                          |
| **CF Managed Content** | AEO/GEO investissement neutralisé (ChatGPT/Claude/Perplexity)       | 100 % bots respectueux       | Marketing : perte de visibilité LLM         |

---

## Actions 24-48 h MAX

### Quick wins (< 1 heure cumulé)

1. **DMARC DNS Namecheap** : ajouter TXT `_dmarc` `v=DMARC1; p=none; rua=mailto:dmarc@axion-ia.com` (5 min).
2. **CF Dashboard** → Security → Bots → Désactiver "Cloudflare Managed Content `robots.txt`" (5 min). Débloque AEO/GEO immédiatement.
3. **Verif urgente Turnstile** : `Coolify → env vars → TURNSTILE_SECRET_KEY` set ou pas ? Si set ET widget client absent → **désactiver temporairement TURNSTILE_SECRET_KEY** OU **forcer fail-open temporaire** OU **désactiver verifyTurnstile** le temps de câbler le widget. **Sinon perte business continue**.
4. **`withSentryConfig`** réintégration `next.config.ts` (30 min, code seulement). PR + rebuild.
5. **Sentry `beforeSend` PII scrub** (1 h). Patch sur 3 configs.

### Actions Will hors code (< 2 h)

6. **DPA Hetzner** : ouvrir compte Hetzner Console → DPA → accepter / signer en ligne (15 min).
7. **DPA Cloudflare** : pareil sur dashboard CF (15 min).
8. **Compte mail dpo@axion-ia.com** : confirmer redirection vers boîte personnelle ou créer alias (15 min).

### Code patches (1-2 jours dev)

9. **Page `/mes-donnees/export`** : créer le route + Zod input + template email tester (2-4 h).
10. **Turnstile widget** dans 6 forms : ajouter `@marsidev/react-turnstile` ou natif iframe + champ caché `cf-turnstile-response` (2-3 h).
11. **Spec E2E `/reserver`** : Playwright booking submit chromium (2-3 h).
12. **Sentry self-hosted promesse** : soit retirer du compose (préféré, 30 min), soit câbler clone `getsentry/self-hosted`.

---

## Pourquoi ne pas publier `WHAT-TO-DO-NOW.md` maintenant

§ 8.3 du prompt master : "Stop : attendre arbitrage Will avant tout `WHAT-TO-DO-NOW.md` publication."

Si `WHAT-TO-DO-NOW.md` était publié maintenant, Will lirait :

- "Verdict 🔴" → réaction d'urgence potentiellement disproportionnée (le site fonctionne).
- Une liste de 12 P0 sans contexte → priorisation difficile.

**Avec ce `🚨-NO-GO-ALERT.md`**, Will dispose :

- D'une lecture immédiate de gravité réelle.
- Du Top 3 raisons NO-GO en clair.
- D'actions 24-48 h max **chiffrées** (effort).
- D'un séquençage quick-wins → patches → actions hors code.

**Will arbitre** :

1. **Option A** : "On fait les 12 P0 (~2 j dev + 2 h Will) → re-audit → 🟢/🟡 attendu". Je publie `WHAT-TO-DO-NOW.md` orienté ce sprint.
2. **Option B** : "On accepte le 🔴 comme transitoire, priorise certain P0 (ex: Sentry + Turnstile + DMARC), on traite le reste en P1". Je publie `WHAT-TO-DO-NOW.md` orienté priorisation choisie.
3. **Option C** : "On creuse d'abord (vérif Turnstile env vars, mesurer Lighthouse local, action DPA Will, etc.) avant de prioriser". Je relance les checks runtime nécessaires.

---

## Ressources

- **Synthèse complète** : `_AUDIT/E2E-2026-05-09/SYNTHESE-FINALE.md`
- **Détail Pass B** : `_AUDIT/E2E-2026-05-09/05-PASS-B/PASS-B-CROISEMENT-P0.md`
- **15 rapports agents** : `_AUDIT/E2E-2026-05-09/02-AGENTS/AGT-01..15-*.md`
- **10 raccordements** : `_AUDIT/E2E-2026-05-09/03-RACCORDEMENTS/R-01..10-*.md`
- **8 vérifs prod-live** : `_AUDIT/E2E-2026-05-09/04-PROD-LIVE/P-01..08-*.md`
- **Inventaires** : `_AUDIT/E2E-2026-05-09/01-INVENTAIRE/`

---

**🛑 J'attends ton arbitrage (Option A / B / C ou autre) avant de publier `WHAT-TO-DO-NOW.md` ou de poursuivre.**
