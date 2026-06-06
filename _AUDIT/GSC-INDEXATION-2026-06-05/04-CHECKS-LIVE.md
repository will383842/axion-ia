# 04 — CHECKS LIVE (exécutés + à exécuter par Will) — 2026-06-05

> Re-vérification indépendante du code par requêtes HTTP réelles. Réseau **disponible** lors de l'audit → la plupart des checks ont été **exécutés** (résultats ci-dessous, 2026-06-05 ~06:27 UTC). Les actions GSC/IndexNow mutantes restent **à exécuter par Will**.

---

## 1. Checks DÉJÀ exécutés (curl, 2026-06-05)

| # | Commande | Résultat | Lecture |
|---|---|---|---|
| 1 | `curl -I https://axion-ia.com/opengraph-image` | **502 Bad Gateway** (text/plain, cloudflare) | 🔴 **A-02 confirmé live** (pas stale) |
| 2 | `curl -I "https://axion-ia.com/api/og?title=Test"` | **200 image/png** | ✅ edge runtime OK ; A-07 résolu |
| 3 | `curl -I https://axion-ia.com/robots.txt` | 200 text/plain | ✅ |
| 4 | `curl -I https://axion-ia.com/en/about` | **301 → /fr/a-propos** (1 hop) | ✅ 301 propre |
| 5 | `curl -I https://axion-ia.com/sitemap-index.xml` | 200 application/xml | ✅ |
| 6 | `curl -I "https://axion-ia.com/fr/audit/demande"` | **200** | ✅ A-08 résolu (était 5xx GSC) |
| 7 | `curl -I https://axion-ia.com/implementation/documents` | 301 → /fr/… → **200** | ✅ A-08 résolu |
| 8 | `curl -I https://axion-ia.com/fr/contact` | **200** | ✅ saine mais JC (famine crawl) |
| 9 | `curl -I https://axion-ia.com/fr/galerie` | **200** | ✅ saine mais JC ; A-09 |
| 10 | `curl -I https://axion-ia.com/fr/tarifs` | **200** | ✅ 1-clic mais JC → preuve famine crawl |
| 11 | `curl -I https://axion-ia.com/fr/blog` | **200** | ✅ saine mais JC |
| 12 | `curl https://axion-ia.com/robots.txt` (body) | contient `Allow: /api/og` **+** `Disallow: /en/` | 🟠 A-03 contradiction confirmée |

**Conclusions live** : (a) seul `/opengraph-image` est un **5xx persistant** ; (b) les pages stratégiques sont **toutes 200 et saines** → le blocage est le **crawl**, pas le code ; (c) le `Disallow: /en/` coexiste avec le 301 (à unifier).

---

## 2. Checks complémentaires à exécuter (réseau autorisé — copier/coller)

```bash
# Diagnostiquer le 502 opengraph-image (voir le corps d'erreur + headers origine)
curl -sv https://axion-ia.com/opengraph-image 2>&1 | tail -30

# Vérifier la fuite hreflang en dans le sitemap images (doit être VIDE après P0-3)
curl -s https://axion-ia.com/sitemaps/images-fr.xml | grep -o 'hreflang="en[^"]*"' | sort | uniq -c
curl -s https://axion-ia.com/sitemaps/images-fr.xml | grep -c '/en/'

# Compter les URLs réellement émises par sous-sitemap (volume exposé à Google)
for s in pages blog faq help cas-concrets comparaisons glossaire implantations \
         services-villes-audit villes-ile-de-france; do
  n=$(curl -s "https://axion-ia.com/sitemap/$s.xml" | grep -c "<loc>"); echo "$s: $n"; done
curl -s https://axion-ia.com/sitemap-images-villes-t3-t4.xml | grep -c "<url>"

# Meta robots sur une ville cohorte (doit être index) vs hors-cohorte (doit être noindex)
curl -s https://axion-ia.com/fr/implantations/ile-de-france/paris | grep -i '<meta name="robots"'
# (remplacer par une ville hors cohorte connue) :
curl -s https://axion-ia.com/fr/implantations/occitanie/aimargues | grep -iE 'name="robots"|x-robots'

# hreflang sur une page FR (doit contenir fr + x-default, JAMAIS en)
curl -s https://axion-ia.com/fr/contact | grep -o 'hreflang="[^"]*"' | sort | uniq -c

# Confirmer 1-hop sur les redirections legacy FR
for u in /a-propos /galerie /connaissances /centre-aide /audit/demande; do
  echo "== $u =="; curl -sI "https://axion-ia.com$u" | grep -iE 'HTTP/|location'; done
```

---

## 3. Actions GSC / IndexNow — À EXÉCUTER PAR WILL

### 3.1 — Forcer l'indexation du Tier 0 (manuel, quota ~10-20/j)
1. GSC → **Inspection de l'URL** → coller une URL Tier 0 (`03b` A.1) → **Demander l'indexation**.
2. Prioriser : `/fr` · `/fr/audit` · `/fr/tarifs` · `/fr/contact` · `/fr/blog` · `/fr/methodologie` · `/fr/implementation` · `/fr/galerie` · `/fr/cas-concrets` · `/fr/comparaisons` · `/fr/glossaire` · hubs régions + 5-10 villes gold.
3. Répéter ~10-20/jour jusqu'à indexation du Tier 0.

### 3.2 — Re-soumettre le sitemap & purger les stale
1. GSC → **Sitemaps** → re-soumettre `https://axion-ia.com/sitemap-index.xml`.
2. GSC → Indexation → Pages → ouvrir `/api/og?title=…`, `/fr/audit/demande?objet=…`, `/implementation/documents` → **Valider la correction** (résolus, cf. §1).

### 3.3 — EN (après P0-3 déployé)
1. Vérifier `/robots.txt` ne contient plus `Disallow: /en/`.
2. Optionnel : GSC → Suppressions → préfixe `https://axion-ia.com/en/` (accélère la purge ; sinon le 301 fait le travail en 4-12 sem).

### 3.4 — IndexNow (après extension au Tier 0)
- Vérifier les logs du worker IndexNow : ping Bing/Yandex sur les URLs Tier 0 **200 index** uniquement (jamais une noindex).

### 3.5 — Cloudflare (403 EN)
- Vérifier **Bot Fight Mode / Managed Challenge** : ne doit pas renvoyer 403 à Googlebot vérifié (sinon ajoute un signal contradictoire EN — cf. A-03).

### 3.6 — Suivi hebdo (signal d'alerte régime permanent)
- Noter chaque semaine : `indexées`, `Détectée non indexée`, taux d'indexation de la cohorte courante.
- **Alerte / re-gel** si « Détectée non indexée » **+200 sur 7 j** OU taux cohorte **< 50 %** (cf. `03b` B.6).

---

## 4. Logs côté infra (Will / accès Coolify)
- **502 `/opengraph-image`** : consulter les logs du conteneur au moment d'un `curl /opengraph-image` → identifier l'exception edge (police/asset/runtime). Indispensable pour confirmer la cause exacte de A-02 avant fix.
