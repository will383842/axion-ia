# AUDIT INDEXATION / GOOGLE SEARCH CONSOLE — 2026-07-31

> Exécution du prompt `PROMPT-AUDIT-INDEXATION-GSC-2026-07-31.md`.
> Données : export GSC `DSC 31072026` (fenêtre 2026-05-12 → 2026-07-31) + CSV Performances
> W21→W31 + code `origin/main` (`23313f45`+) + contrôles live du 2026-07-31 (~17h).
> Fact-checké par 2 agents adversariaux le même jour. DB prod non interrogeable dans cette
> session (classifier) — les points DB sont marqués **[DB à vérifier]**.

---

## 1. VERDICT (l'essentiel en 10 lignes)

1. **La cause dominante de « moins de visibilité » est la DILUTION QUALITÉ/VOLUME, pas une
   barrière technique** : entre W21 et W31, les pages recevant des impressions passent de
   3 à 196 (×65), les impressions de 19 à 805 (pic 1 270 en W29), pendant que la **position
   moyenne pondérée s'effondre de 4,7 → 22,2** et le CTR de ~10 % → 2,4 %. Chaque nouvelle
   page publiée rankt page 2-3 et tire la moyenne vers le bas. C'est l'exact symptôme
   « plus de pages indexées, moins de visibilité ».
2. **Les « dents de scie » = cycle publication→indexation→déclassement/désindexation à
   retardement**, amplifié par trois bascules datées du même jour (03/07 : cap villes
   ~1 336 noindex + 10 archivages + slugs renommés) et par le système de tiers qui
   rétrograde automatiquement les articles en noindex. La courbe HTTPS (proxy « pages
   indexées ») monte 1→98 (07/07, burst content-gen) puis décroît **monotone** jusqu'à 4
   (31/07) — un drainage par re-crawl, pas des incidents ponctuels.
3. **L'hypothèse « on est trop conservateurs » est RÉFUTÉE comme cause principale** — et
   c'est même l'inverse : les sitemaps ne déclarent que **~1 193 URLs de pages** (cap villes
   480 actif), un périmètre volontairement resserré, et la visibilité chute quand même.
   Le problème n'est pas l'accès, c'est ce que Google trouve au bout.
4. Causes secondaires réelles et corrigibles : **28,7 % du crawl gaspillé** en
   redirections/erreurs, le bug 307 slug-history (**corrigé le 31/07, PR #446, vérifié
   308 en prod**), le `X-Robots-Tag` pSEO **jamais servi** (middleware racine mort), le
   gate anti-vide presse **cassé en live** (urlset vide servi), 2 feeds vides, l'incident
   VPS du 23/07 (26 765 ms).

---

## 2. CHRONOLOGIE CAUSALE (inflexions datées)

Table complète jour par jour : cf. sortie du script d'analyse (scratchpad) ; extraits décisifs :

| Date | Événement | Effet mesuré |
|---|---|---|
| 12/05 | Pic crawl 1 875 req (soumission sitemaps initiale ?) | baseline |
| 16/05 | EN désactivé + build GHA (ADR 26) | résidu EN en index (encore 13 imp. sur `/en` en W21) |
| 21-22/05 | Pics crawl 1 602/1 144 | découverte massive |
| 26/05 | `VILLES_EDITORIAL` figé | signal fraîcheur villes mort depuis |
| 01/06 | Latence 3 084 ms (lundi post-purge dominicale) | crawl ralenti |
| 08/06 | `EDITORIAL_BASELINE` figé | signal fraîcheur global mort |
| 17/06 | Latence 8 308 ms (cause non identifiée) | |
| 20/06 | services-villes retirés des sitemaps | −~5 000 URLs déclarées |
| 28/06→07/07 | **Burst publications + merges** (4-8/jour) | HTTPS 15→**98** ; crawl ×3 |
| **03/07** | **CAP villes ~1 336 noindex + 10 archivages + slugs renommés + 11 redirects** | début du drainage |
| 08/07→31/07 | Re-crawl des bascules + rétrogradations tiers | HTTPS 98→**4**, décroissance monotone |
| 09/07 | Juge 100 % OpenAI (`c8b84f73`) | qualité du flux à comparer avant/après |
| ~22/07 | Kill-switch **[DB à vérifier]** | plus de publications → plus rien ne compense le drainage |
| 23/07 | **Incident VPS : 26 765 ms de latence moyenne sur 640 req** | crawl maltraité 1 jour |
| 19-31/07 | 9-15 merges/jour = déploiements + purges CF en rafale | fenêtres froides répétées |

**Corrélations testées** :
- Jours avec merge vs sans : latence **872 ms vs 1 064 ms** — l'hypothèse « deploy → origin
  lent pour Googlebot » n'est **pas confirmée** en moyenne quotidienne (le warm-up + le
  s-maxage absorbent l'essentiel).
- Lundis (post-purge dominicale) : 1 096 ms vs dimanche 790 ms — **effet purge hebdo réel
  mais modéré** (+~300 ms le lundi).

## 3. LE PARADOXE CHIFFRÉ (Performances W21→W31)

| Sem. | Pages avec imp. | Impressions | Clics | Position moy. pondérée |
|---|---:|---:|---:|---:|
| W21 | 3 | 19 | 2 | **4,7** |
| W24 | 28 | 66 | 0 | 15,9 |
| W27 | 47 | 540 | 6 | 14,1 |
| W28 | 102 | 808 | 21 | 13,1 |
| W29 | **191** | **1 270** | 27 | 15,8 |
| W30 | 126 | 776 | 27 | 17,8 |
| W31 | 196 | 805 | 19 | **22,2** |

Familles dominantes en fin de période : blog content-gen (W30 : 297 imp.) et villes —
**précisément les deux familles industrialisées**. Le clic ne suit pas (CTR ÷4) : Google
montre ces pages en positions 15-25 où personne ne clique, puis les déclasse.

## 4. ÉTAT LIVE DES SITEMAPS (contrôle du 31/07)

37 sitemaps dans l'index, tous en 200. **~1 193 URLs de pages** déclarées (hors images) :
480 villes (= le cap, actif et cohérent), 134 blog, 109 carrières, 103 avis, 97 FAQ,
83 pages, 61 secteurs, 32 news-evergreen, 27 formations… et :

- 🔴 **`/sitemap/presse.xml` servi avec 0 URL tout en étant listé** → le gate anti-vide
  presse (`sitemap-index.xml/route.ts:296`) ne remplit pas son contrat en live
  (incohérence de moment de rendu index↔route). C'est le flag GSC « Balise XML manquante ».
- ⚠️ `glossaire.xml` = **1 URL** et `guides.xml` = **1 URL** : le gate anti-thin glossaire a
  pratiquement vidé la famille — à assumer ou à requalifier.
- `news.xml` et `knowledge.xml` correctement absents (gates fonctionnels, creux réel).
- Canoniques auto-référentes ✅, hreflang EN absent ✅ sur les 6 pages échantillonnées.
- Cache CF : HIT sur audit/formations, **MISS** sur /fr, paris, secteurs (1h post-deploy,
  attendu), **BYPASS sur /fr/blog** → quelque chose (cookie/header) empêche le cache du hub
  blog — à investiguer.
- URLs nues → 301 `/fr/...` en 1 hop ✅ ; https://www → apex 1 hop ✅ (http://www = 2 hops).
- **Feeds blog ET actualités servis avec 0 item** (avis : 48 ✅) — signal « site mort » pour
  les bots AEO pourtant explicitement autorisés dans robots.txt.
- robots.txt live conforme au code (Crawl-delay Bing, Google-Extended bloqué, Sitemap OK).

## 5. LES 10 MÉCANISMES CANDIDATS — VERDICTS

| # | Mécanisme | Verdict |
|---|---|---|
| 1 | Deploy → pages vides + cache purgé | **PARTIEL** — warm-up existant amortit ; latence jours-merge pas pire ; mais 9-15 merges/jour fin juillet = fenêtres répétées |
| 2 | Gating anti-vide → sitemaps qui clignotent | **CONFIRMÉ mineur** + bug presse inversé (vide servi) |
| 3 | Fenêtre 48 h news | **CONFIRMÉ structurel** (news absent de l'index au contrôle) |
| 4 | Kill-switch → chute fraîcheur + pings BullMQ off | **PLAUSIBLE [DB à vérifier]** — crons GH continuent |
| 5 | Bascules 03/07 (cap villes + archivages + renommages) | **CONFIRMÉ — contributeur majeur du drainage** |
| 5bis | Juge OpenAI 09/07 | **INDÉTERMINÉ** (comparaison qualité avant/après à faire) |
| 6 | Incident VPS 23/07 | **CONFIRMÉ ponctuel** (26 765 ms) |
| 7 | `lastmod` figés (2 baselines) | **CONFIRMÉ** — actualisation 28,55 % du crawl seulement |
| 8 | Indexé-vide-puis-désindexé | **NON PROUVÉ** (nécessite l'historique de rendu) |
| 9 | Artefact reporting GSC | ÉCARTÉ (tendances sur 11 semaines, pas du bruit) |
| 9bis | Purge CF dominicale | **CONFIRMÉ modéré** (+300 ms le lundi) |
| 9ter/quater | Noindex conditionnels (tiers, galerie, glossaire) | **CONFIRMÉ structurel** — le mécanisme du « de plus en plus indexées puis chute » |

## 6. BARRIÈRES — VERDICTS (les 22 du prompt)

| Barrière | Verdict | Motif |
|---|---|---|
| Disallow 15 chemins robots | **GARDER** | surfaces privées, aucune perte mesurée |
| Google-Extended / GPTBot / ClaudeBot / Applebot-Ext bloqués | **GARDER** | doctrine citation-sans-training, AI Overviews passent par Googlebot |
| CCBot/Bytespider/omgili/Diffbot | **GARDER** | scrapers |
| Crawl-delay 1 Bingbot | **ASSOUPLIR → retirer** | l'origin tient (594-900 ms hors incident) ; Bing nourrit Copilot/ChatGPT |
| /logos/clients/ | **GARDER** | SERP off-brand documenté |
| Gating anti-vide (5+presse) | **GARDER mais RÉPARER presse** | le gate presse laisse passer un urlset vide |
| images-en gaté | **GARDER** | EN off |
| 2 baselines lastmod figées | **REMPLACER** | par un lastmod dérivé du contenu (hash/updatedAt) — le signal est mort depuis 8-9 semaines |
| 301 EN→FR | **GARDER** | fonctionne, 1 hop, résidu en résorption (13 imp W21 → 1 W31) |
| Kill-switch 14 workers | **DÉCOUPLER** | séparer « stop génération » de « stop pings/lifecycle » : aujourd'hui l'arrêt édito gèle aussi la tuyauterie d'indexation |
| Seuils juge | GARDER **[DB à vérifier]** | ne pas toucher (règle mémoire) |
| Tombstone soft-410 | **DURCIR → vrai 410** | la V2 différée ; purge plus rapide, crawl économisé |
| HMAC /api/indexnow | GARDER | route debug, coût 0 |
| revalidate élevés | GARDER | cohérent avec s-maxage |
| Cloudflare WAF/challenge | **[À VÉRIFIER côté CF]** | 3×403 GSC inexpliqués, aucun 403 applicatif public |
| **CAP villes 480** | **GARDER tel quel** | c'est la bonne décision : la dilution venait de là ; le rouvrir aggraverait le verdict §1. Réévaluer quand les 480 rankeront <10 |
| noindex surfaces privées | GARDER | |
| Tiers articles noindex auto | **GARDER mais INSTRUMENTER** | c'est le bon mécanisme anti-dilution, mais il est invisible : logger chaque rétrogradation (elles expliquent les dents de scie) |
| Gate anti-thin glossaire | **RÉGLER** | 1 URL survivante = famille morte ; soit enrichir les termes, soit assumer la suppression |
| noindex galerie conditionnel | GARDER (fix canonique EN à part) | |
| **Purge CF hebdo dimanche** | **SUPPRIMER ou cibler** | purge_everything récurrente sans justification visible ; +300 ms les lundis pour Googlebot |
| NOINDEX_STATIC_PATHS dupliqué | **UNIFIER** | un seul SSOT avec sitemap.ts |

## 7. PLAN DE REMÉDIATION

### P0 (cette semaine)
1. ✅ **FAIT — 307→308 slug-history** (PR #446, vérifié en prod).
2. **Supprimer/porter `middleware.ts` racine mort** → le `X-Robots-Tag: noindex` des stubs
   pSEO doit être servi (économie de crawl réelle sur les ~1 336 villes noindex : header
   lu sans rendre la page). *(chantier suivant de cette session)*
3. **Réparer le gate presse** : évaluer `presseEmittableCount` au même moment de rendu que
   la route, ou servir 404 quand vide.
4. **Feeds blog/actualités vides** : les brancher sur la DB (comme le rendu) ou les retirer.
5. **Canonique galerie EN → FR** (hygiène ; la page 301 déjà). *(chantier suivant)*
6. **Supprimer `cloudflare-purge-weekly.yml`** ou le remplacer par une purge ciblée
   (décision Will — c'est un workflow, 1 ligne à désactiver).

### P1 (2 semaines)
7. **Qualité avant volume** : audit éditorial de 15 articles content-gen (grille E-E-A-T),
   comparaison avant/après le passage 100 % OpenAI du 09/07. Tant que la position moyenne
   des nouvelles pages est >15, **ne pas relancer la génération en volume**.
8. **Lastmod vivant** : remplacer les 2 baselines par `max(updatedAt)` réel par famille.
9. **Vrai 410 tombstones** (la V2 différée).
10. **Instrumenter les rétrogradations de tiers** (log + compteur admin) et le monitoring
    Site Explorer (vérifier que les 4 workers tournent — **[DB à vérifier]**).
11. **BYPASS cache sur /fr/blog** : trouver le header/cookie responsable.
12. Retirer `Crawl-delay: 1` Bingbot.

### P2 (mois)
13. 404 GSC : exporter la liste des 463, classer (taxonomies blog `dynamicParams=false`
    vs anciennes URLs), 410 ou 301 par classe.
14. GSC : valider les corrections des buckets (noindex = en grande partie volontaire
    post-cap : marquer comme résolu), purger le résidu EN.
15. Maillage interne vers les 480 villes gardées (le cap ne vaut que si elles reçoivent
    du jus).

### Reste Will (non codable)
- Exports GSC : listes d'URLs des buckets (1 200 noindex / 884 détectées / 463 404),
  Performances 16 mois avec requêtes, rapport Core Web Vitals.
- Vérifier en base : état/date kill-switch, comptage tombstones
  (`Article.status IN ('archived','draft')`), table `SiteRouteAnomaly`.
- Cloudflare : vérifier WAF/challenge vs Googlebot (les 3×403) ; décision purge hebdo.
- GSC : confirmer que `www` n'est pas une propriété séparée qui pollue.

## 8. RÉPONSES AUX 5 QUESTIONS DU CRITÈRE DE RÉUSSITE

1. **Pourquoi les dents de scie ?** Cycle publication→indexation→déclassement/noindex à
   retardement (tiers auto, cap villes, tombstones), sur fond de purges CF répétées.
2. **Pourquoi + indexées / − visibles ?** ×65 pages à position moyenne 22 = dilution ;
   le volume industrialisé rankt en positions 15-25 sans clics.
3. **Quelles barrières ?** Retirer : crawl-delay Bing, purge hebdo, baselines lastmod.
   Renforcer : X-Robots-Tag (à ressusciter), vrai 410, gate presse. Garder : cap villes,
   tiers, robots AI — le conservatisme d'accès n'était pas le problème.
4. **Cette semaine ?** P0 1-6 ci-dessus ; le 1 est déjà en prod.
5. **Comment savoir dans 30 jours ?** Position moyenne pondérée hebdo (CSV W*) : objectif
   retour <15 ; courbe HTTPS GSC qui se stabilise ; part « actualisation » du crawl >35 %.
