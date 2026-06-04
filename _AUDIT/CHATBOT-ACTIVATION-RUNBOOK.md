# Runbook d'activation du chatbot (T-25) — procédure de mise en service

> **But** : passer le chatbot de « éteint » à « en ligne » **en sécurité**, par paliers (canary), avec checklist d'acceptation (DoD), surveillance et rollback en 1 clic.
>
> **Mur dur** : l'activation est une action **sortante, payante (LLM), publique et difficile à défaire**. Elle se fait **manuellement par Will**, jamais en autopilot. Ce document est la marche à suivre.

---

## 0. État actuel (rappel)

- `CHATBOT_ENABLED` (serveur) = **non défini / false** → la route `POST /api/chatbot/message` répond **503**.
- `NEXT_PUBLIC_CHATBOT_ENABLED` (client) = **non défini / false** → le widget **ne monte pas** (zéro octet, zéro requête).
- Code **complet, testé, poussé** sur `feat/chatbot-core` (jamais mergé `main`).

---

## 1. Pré-requis — Definition of Done (à cocher AVANT d'allumer)

### Données & dépendances

- [ ] **DB migrée** : `prisma migrate deploy` a appliqué `chatbot_core`, `chatbot_prospect_profile`, et le SQL FTS (`migrations_fts/*chatbot_fts.sql`) via psql (vector(1024) + HNSW + tsvector + GIN).
- [ ] **Tenant seedé** : `axion-ia` présent (`prisma/seeds/chatbot.ts`), `actif=true` (vérifiable dans la console → Chatbot → Réglages).
- [ ] **Knowledge ingéré** : worker `chatbot-ingest` exécuté → `chat_kb_chunks` peuplé et **embeddé** (sinon retrieval vide). Vérifier le nombre de chunks.
- [ ] **`VOYAGE_API_KEY` valide** (≠ 401) : sinon la recherche vectorielle est down et on tombe en **repli FTS seul** (dégradé mais fonctionnel). À régénérer si nécessaire. _(Impacte la qualité du RAG, pas le cœur catalogue déterministe.)_
- [ ] **`IP_HASH_SALT`** défini (RGPD — hash des IP).

### Sécurité & conformité

- [ ] **DPA signés** avec les sous-traitants IA (Anthropic, OpenAI, Voyage) + clause de non-rétention. **Bloquant RGPD.**
- [ ] **RGPD chat\_\*** vérifié : export/erase/purge couvrent bien les conversations/messages/escalades (déjà codé — `gdpr-export`, `gdpr-erase`, `retention-purge-worker`).
- [ ] **Turnstile** (anti-abus) : décider du mode au canary —
      - soit `CHATBOT_TURNSTILE_ENABLED` reste **off** au canary (rate-limit IP/session déjà actif),
      - soit on **câble l'émission du token côté widget** avant de le passer `true` (sinon le 1er message de chaque session serait rejeté en prod).
- [ ] **Budget LLM** : cost-cap mensuel validé (console → Réglages → « Cap coût mensuel »). Le provider-router applique déjà un cap + alertes Telegram.

### Observabilité

- [ ] **Sentry** opérationnel (erreurs route/worker).
- [ ] **Telegram** configuré (alertes escalade + cost-cap).
- [ ] **Plausible** actif (funnel `Chat Started / RDV / Escalated / Lead`).

---

## 2. Variables d'environnement (Coolify → Application → Env vars)

| Variable | Scope | Valeur canary | Rôle |
|---|---|---|---|
| `CHATBOT_ENABLED` | RUN (serveur) | `true` | Ouvre la route SSE + démarre les workers chatbot |
| `NEXT_PUBLIC_CHATBOT_ENABLED` | BUILD+RUN (client) | `true` | Autorise le montage du widget |
| `NEXT_PUBLIC_CHATBOT_PAGES` | BUILD+RUN (client) | `/fr/audit` | **Canary par page** : widget visible UNIQUEMENT sur ces préfixes. Vide = partout |
| `CHATBOT_TURNSTILE_ENABLED` | RUN | `false` (au canary) | Turnstile à l'ouverture de session (voir §1) |
| `RETENTION_CHAT_MONTHS` | RUN | `12` (défaut) | Rétention RGPD des conversations |

> ⚠️ `NEXT_PUBLIC_*` sont **inlinées au build** → un changement nécessite un **rebuild** de l'image (pas juste un restart). Prévoir un déploiement.

---

## 3. Procédure d'activation par paliers (canary)

### Palier 1 — une seule page (`/fr/audit`)

1. Poser les env vars du §2 avec `NEXT_PUBLIC_CHATBOT_PAGES=/fr/audit`.
2. Déclencher un **build + deploy** (les `NEXT_PUBLIC_*` sont inlinées au build).
3. Vérifier :
   - `/fr/audit` → la **bulle chatbot apparaît** (en bas à droite, après l'idle).
   - une autre page (ex. `/fr`) → **pas de bulle** (canary respecté).
   - envoyer un message « Quelles formations entre 2000 et 3000 € ? » → **3 cartes prix SSOT** + lien gaté + mention « vous dialoguez avec une IA ».
   - `/en/audit` → **301 vers FR** (EN désactivé, inchangé).

### Palier 2 — surveillance (24–72 h)

Surveiller (cf. §4). Si tout est vert :

### Palier 3 — généralisation

- Élargir `NEXT_PUBLIC_CHATBOT_PAGES` (ex. `/fr/audit,/fr/implementation,/fr/interventions`) **ou** la **vider** (= toutes les pages) → rebuild + deploy.

---

## 4. Surveillance (quoi regarder une fois allumé)

- **Console → Chatbot → Tableau de bord** : conversations, messages, **escalades ouvertes**, hits cache, **coût LLM estimé**.
- **Console → Chatbot → Escalades** : les questions sans réponse remontées (trous de KB à combler).
- **Lighthouse CI (`pnpm lhci`)** : LCP/INP/**CLS=0** sur les pages avec widget (gate Web Vitals).
- **Sentry** : erreurs route SSE / workers.
- **cost-ledger / Telegram** : approche du cap mensuel → alertes 80/100 %.
- **Plausible** : funnel de conversion (Started → RDV/Lead).

**Signaux d'alerte** → rollback (§5) : pic d'erreurs 5xx, CLS > 0, coût qui s'emballe, latence 1er token > 1,5 s soutenue, hallucination détectée (l'output-guard devrait l'empêcher, mais surveiller).

---

## 5. Rollback / kill-switch (immédiat)

Par ordre de rapidité :

1. **Kill-switch tenant (le plus rapide, sans deploy)** : Console → Chatbot → Réglages → décocher **« Tenant actif »** → Enregistrer. La route renvoie alors `tenant_not_found` (404) → le bot cesse de répondre. _(Le widget reste affiché mais inerte.)_
2. **Serveur off (sans rebuild)** : `CHATBOT_ENABLED=false` → restart container → route 503.
3. **Widget off (rebuild)** : `NEXT_PUBLIC_CHATBOT_ENABLED=false` → build + deploy → widget ne monte plus.
4. **Réduire le périmètre** : `NEXT_PUBLIC_CHATBOT_PAGES=/fr/audit` (revenir au canary) → rebuild.

> Aucune donnée n'est perdue au rollback ; les conversations restent en base (purgées par la rétention).

---

## 6. DoD finale (critères de recette — cahier §30)

- [ ] Exactitude des réponses (échantillon manuel) ; **0 hallucination de prix/URL** (garanti par output-guard + catalogue SSOT).
- [ ] **Escalade** de bout en bout : une question sans réponse crée une `ChatEscalation` (console) + ping Telegram.
- [ ] **Capture de lead** : le mini-formulaire (CTA « Être recontacté ») crée une `Submission` source=chatbot (consentement requis) + funnel « Chat Lead ».
- [ ] **RDV** : le bot renvoie le lien `/fr/appel`.
- [ ] **Mode dégradé** : couper Voyage/Anthropic ne produit jamais d'erreur brute (repli FTS / RDV).
- [ ] **RGPD** : un export/erase self-service inclut bien les données chat\_\*.
- [ ] **Web Vitals** : CLS=0, widget hors First Load (gate `lhci` + `size-limit` bucket `chatbot-widget` ≤ 30 KB gz).
- [ ] **Charge** : `k6 run scripts/load-test-chatbot.k6.js` sur staging tient ~200 VUs (1er token p95 < 1,5 s, < 2 % erreurs). _(Voir T-32.)_

---

## 7. Reste hors-périmètre activation (non bloquant)

- `qualifier_prospect` (le profil se déduit déjà des slots) — optionnel.
- Classifieur d'intention LLM (T-18) — confort sur questions générales, pas bloquant.
- Émission du token Turnstile côté widget — requis seulement si `CHATBOT_TURNSTILE_ENABLED=true`.

_Fin du runbook d'activation._
