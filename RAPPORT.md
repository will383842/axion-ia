# Rapport — gel de Chrome sur `qualiopi/baremes-opco` (04/10/2026)

**Verdict : AUCUNE CORRECTION.** Le gel n'a pas pu être reproduit, ni par un test de
rendu jsdom, ni dans un vrai Chromium sur l'application réelle avec les 7 lignes de la
migration `20261004090000_baremes_opco_releves_2026`. Aucune cause n'est certaine ; je ne
corrige donc rien (pas de branche `fix/baremes-opco-gel`). Hypothèses classées plus bas.

Base : `origin/main` @ `7b7dd14a`.

## 1. Lecture du code (ce qui est exclu, et pourquoi)

| Pièce                                                | Ce qu'elle fait au montage                                                                                                                                        | Peut-elle boucler ?                                                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.tsx`                                           | Server Component : lecture DB, rendu HTML. Les dates `toLocaleDateString("fr-FR")` sont calculées **côté serveur uniquement**                                     | Non. Un Server Component n'est pas hydraté : aucune comparaison serveur/client, donc **aucune erreur d'hydratation possible** sur ces dates |
| `AdminPageShell`, `AdminPageHeader`, `AdminStatCard` | Server Components purs, sans état ni effet                                                                                                                        | Non                                                                                                                                         |
| `BaremeOpcoRowActions` (×7)                          | `useRouter`, `useTransition`, `useState`, `useConfirmation` — **aucun effet**                                                                                     | Non                                                                                                                                         |
| `useConfirmation`                                    | `useState(null)` + `useRef` + `useCallback([])`. Tant qu'on n'a pas cliqué, `dialogue === null` : **`AdminConfirmDialog` n'est même pas monté**                   | Non                                                                                                                                         |
| `AdminConfirmDialog`                                 | Deux `useEffect([open])` ; le second fait `setTypedValue("")` en microtâche, seulement quand `open` passe à `false` — valeur identique ⇒ React abandonne le rendu | Non. Pas de MutationObserver, pas de piège à focus en boucle (un seul `focus()` à l'ouverture)                                              |
| `BaremeOpcoForm`                                     | Initialiseurs paresseux `useState(() => new Date().toISOString()…)`, aucun effet                                                                                  | Non                                                                                                                                         |

Comparaison demandée : `qualiopi/incidents` monte **le même patron** (un
`IncidentRowActions` + `useConfirmation` + `{dialogue}` par ligne) sans gel signalé, et
`etat-des-fonds` a la même enveloppe (`AdminPageShell width="wide"`, tableau dans
`overflow-x-auto`). Seule différence structurelle de la page : 5 `<input type="number"
inputMode="decimal">` dans `BaremeOpcoForm` — sans effet mesurable ci-dessous.

## 2. Preuves

### 2.1 Test jsdom (`@testing-library/react`, patron de `TrainerDocumentsPanel.spec.tsx`)

Sonde montant `BaremeOpcoForm` + 7 `BaremeOpcoRowActions` sous un `<Profiler>`
(`showModal`/`close` polyfillés, absents de jsdom) :

```
commits après montage   1
commits après ouverture 2   (1 <dialog> présent)
console.error           []   — aucun « Maximum update depth exceeded »
```

Un rendu au montage, un seul de plus à l'ouverture du dialogue : **aucune boucle**.

### 2.2 Application réelle dans Chromium (reproduction de bout en bout)

Postgres 16 + pgvector + Redis locaux, `prisma migrate deploy` (donc **les 7 lignes de la
migration**, vérifiées par SQL), `pnpm db:seed`, `next dev`, connexion par le formulaire
via `tests/e2e/fixtures/admin-auth.ts`, puis `Page.captureScreenshot` par **CDP** avec
garde de 30 s :

```
/qualiopi/etat-des-fonds  200 | capture CDP ok 118 ms | tâches longues sur 15 s [69,116]   | pleine page ok
/qualiopi/baremes-opco    200 | capture CDP ok 202 ms | tâches longues sur 15 s [166,113,68] | pleine page ok
                                 dialogue « Supprimer » ouvert → capture CDP ok
3 onglets simultanés sur baremes-opco → captures 466 / 65 / 74 ms
```

`document.querySelectorAll("tr")` répond (16 lignes = 2 en-têtes + 7 + 7). Aucune
`pageerror`. Le fil principal est libre après chargement : rien ne tourne en continu.

## 3. Hypothèses classées (aucune n'est prouvée)

1. **Onglet en arrière-plan côté outil de capture (la plus probable).** Dans un Chrome
   **avec fenêtre**, un onglet non visible ne produit plus d'images ; `Page.captureScreenshot`
   attend alors une image qui ne vient pas et expire. « Sur plusieurs onglets » et « la page
   voisine s'affiche bien » (celle qui avait le focus ?) collent à ce scénario, pas à un défaut
   de la page. _Preuve contraire à chercher_ : refaire la capture sur `baremes-opco` en
   **onglet actif, seul**, ou en `--headless=new` ; si elle passe, l'hypothèse est confirmée.
2. **Différence propre à la production** non reproductible ici (consigne : pas de
   `next build`) — build de production, en-têtes CSP, couche Cloudflare. Rien dans le code de
   la page n'en dépend spécifiquement plus que `etat-des-fonds`. _À tester_ : capture CDP sur
   la prod en onglet actif, et lecture de la console (Long Tasks via `PerformanceObserver`).
3. **Données de production différentes de la migration.** Si la table contenait plus que
   les 7 lignes (relevés saisis à la main dans la journée), `take: 500` peut monter jusqu'à
   500 `BaremeOpcoRowActions` — sans boucle, mais plus lourd. _À vérifier_ :
   `SELECT count(*) FROM baremes_opco;` en lecture seule.
4. **Un dialogue resté ouvert** (`showModal` → couche supérieure + `::backdrop`) au moment
   de la capture : il ne fige pas le moteur de rendu ici (capture OK dialogue ouvert), donc
   peu probable.

Exclu par la mesure : boucle d'effets, mise à jour d'état pendant le rendu, focus piégé /
MutationObserver, erreur d'hydratation sur les dates.

## 4. Correction / ROUGE-VERT

Aucune. Aucun test n'a pu échouer sur le code actuel ; écrire un correctif sans ROUGE
aurait été inventer une cause.

## 5. Corps de PR

Sans objet (aucune PR). Si l'hypothèse 1 est confirmée, rien à corriger dans le dépôt ;
si une capture en onglet actif fige encore en prod, relancer avec la mesure des Long Tasks
de la prod jointe.

## Annexe — remarque hors sujet relevée en route

En `next dev`, la console signale « Refused to execute inline script … Content Security
Policy » sur toutes les pages admin (y compris `etat-des-fonds`). Non lié au gel, non
vérifié en production.
