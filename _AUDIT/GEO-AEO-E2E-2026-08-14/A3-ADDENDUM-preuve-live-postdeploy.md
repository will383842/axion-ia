# A3 — ADDENDUM : preuve live directe du P0 « home /fr re-figée stub post-deploy »

Mesure faite par la session principale, **2026-08-14 18:53:27 UTC**, soit ~17 min
après l'atterrissage du deploy #601 (run 31824504716, `completed success`
18:36 UTC ; un deploy suivant — fix CGV — est reparti à 18:36 UTC).

## Mesure

`curl -s https://axion-ia.com/fr` (HTML complet, 1 577 128 octets) :

| Signal | Valeur | Lecture |
|---|---|---|
| HTTP | 200 | — |
| `cf-cache-status` | **HIT** | servie depuis l'edge Cloudflare |
| `Age` | **1520 s** | mise en cache ~18:28 UTC, pendant la fenêtre de restart du deploy |
| `x-nextjs-cache` | HIT (prerender) | version ISR bakée |
| `grep -c "AggregateRating"` | **0** | le JSON-LD AggregateRating est ABSENT |
| `grep reviewCount\|ratingValue` | **aucune occurrence** | bloc avis absent du HTML |
| `grep -c "77"` | 2 (hash CSS + unicode-range) | aucun rapport avec les avis |

Contre-point : l'agent A3 avait mesuré la même home **saine** à 17:56 UTC
(avant l'atterrissage) : `reviewCount 77` présent, cf HIT.

## Conclusion

Le P0 d'A3 est **CONFIRMÉ par observation directe** : à chaque déploiement,
la home est re-servie en version stub (sans le bloc 77 avis ni son
AggregateRating) et le step « warm » du workflow la re-fige à l'edge
Cloudflare AVANT revalidation, car `/fr` est absente des deux listes du job
warm (`.github/workflows/deploy-coolify.yml:747` et `:778`). Durée
d'exposition : jusqu'à ~1-2 h par deploy (et les jours à deploys multiples —
comme aujourd'hui, 3 deploys — la fenêtre se rejoue à chaque fois).

Patch prescrit (inchangé) : ajouter `"/fr"` à `PATHS` (l.747) et
`"https://axion-ia.com/fr"` à `FILES` (l.778). Voir aussi les P1 d'A3
(/fr/memo-isere, /fr/blog absents des mêmes listes).

---

## Seconde salve de mesures — 19:16 UTC : le coupable est l'edge CF, pas l'ISR

Le deploy avait atterri à **18:26 UTC** (chronologie corrigée par F1 via
`gh run view` ; le « 18:36 » était la fin de workflow). Trois mesures :

| Heure UTC | Requête | `cf-cache-status` | `Age` | `x-nextjs-cache` | AggregateRating |
|---|---|---|---|---|---|
| 18:53:27 | `/fr` | HIT | 1520 | HIT | **absent** |
| 19:16:30 | `/fr` | HIT | 2903 | HIT | **absent** |
| 19:16:37 | `/fr` | HIT | 2911 | HIT | **absent** |
| 19:16:56 | `/fr?nocache=…` | **MISS** | — | HIT | **présent — ratingValue 4.9, reviewCount 77** |

Lecture : `Age: 2903` à 19:16:30 date la mise en cache CF à **18:28:07 UTC**,
soit **2 minutes après l'atterrissage du deploy** — exactement la fenêtre où
le rendu est encore amputé. Cette version est ensuite servie **50 minutes et
plus** (elle expire à ~19:28, s-maxage 3600).

Le point important : sur la requête cache-bust, `x-nextjs-cache` est **HIT**
et l'AggregateRating **est là**. Donc **le cache ISR de Next est déjà guéri** ;
ce qui reste malade, c'est **le cache d'edge Cloudflare**, qui a photographié
le rendu stub à 18:28 et le sert une heure durant. La root-cause n'est donc
pas « l'ISR met 1 h à repopuler » mais « le step warm pousse `/fr` dans le
cache CF **avant** la revalidation » (`deploy-coolify.yml:808`, cohérent avec
l'analyse d'A3), et `/fr` n'étant dans aucune des deux listes, rien ne vient
ensuite ni la revalider ni purger cette entrée.

Conséquence aggravante mesurée ce jour : **4 deploys le 2026-08-14**
(14:57, 18:26, un annulé, un parti 18:55 qui atterrira ~19:50). Chaque
atterrissage réarme une fenêtre d'~1 h. Sur une journée de livraison
soutenue, la home passe l'essentiel de son temps **sans preuve sociale ni
AggregateRating** — y compris pour un crawler qui passerait à ce moment-là.

Le patch des 2 lignes reste valable, mais l'ordre des steps doit être
vérifié en même temps : purge CF **puis** revalidate **puis** warm, sinon le
warm re-fige à nouveau une version pré-revalidation.

---

## ⚠️ CORRECTIONS APPORTÉES PAR LA CONTRE-VÉRIFICATION (H1 et H3)

Cet addendum a été écrit avant la Phase 2. **Deux de ses conclusions sont à
rectifier** — le fait mesuré (la home servie sans AggregateRating) tient, son
explication change :

1. **H1** : l'ordre interne des steps est **déjà** revalidate → purge → warm.
   Ma recommandation de « vérifier l'ordre des steps » était donc sans objet.
   Le vrai défaut d'ordonnancement est ailleurs : le job **`lhci` tourne en
   parallèle du job `warm`** et chauffe explicitement `/fr`, `/fr/formations`
   et `/fr/audit`. Le correctif est de le sérialiser (`needs: [deploy, warm]`).
   ⚠️ G1 et G3 prescrivent deux ordonnancements **incompatibles** pour ce même
   bug : retenir celui de **G3**.

2. **H3** : le cache Cloudflare est **par PoP**. Un warmer lancé depuis un
   runner GitHub chauffe le PoP vu par ce runner, **pas le PoP MRS** que
   voient les visiteurs français et Googlebot-EU. H3 relève d'ailleurs une
   mesure de F5 qui se contredit (MISS à T+43 min, soit 34 min après la fin du
   job `warm`) — incompatible avec un edge uniformément figé. Le patch reste
   pertinent, **sa justification change** : ce n'est pas « le warm re-fige la
   mauvaise version partout », c'est « le warm ne couvre pas les PoP qui
   comptent, et là où il agit il peut figer une version amputée ».

3. **H1**, aggravation : le volet **vatID/SIRET est PERMANENT et site-wide**,
   pas une fenêtre post-deploy. Les pages 100 % statiques
   (`/fr/conditions-generales`, `/fr/a-propos`, `/fr/contact`, **hubs villes
   indexables**) ne portent **jamais** `vatID`, quelle que soit l'heure. Seul
   le passage des `COMPANY_*` en build-args corrige ce volet.

**Ce qui reste établi sans réserve** : les mesures brutes du tableau ci-dessus
(HIT sans AggregateRating à 18:53 et 19:16, présence au cache-bust à 19:16:56
avec `x-nextjs-cache: HIT`). L'ISR est saine ; le contenu servi ne l'était pas.
