# Balisage des encadrés d'article (lisibilité V2)

Quand l'interrupteur `CONTENU_LISIBILITE_V2` vaut `true`, les consignes de rédaction
(`src/server/content-gen/brand/consigne-lisibilite.ts`) demandent à Claude de baliser ses encadrés
en HTML sémantique. Les futurs modèles de pages peuvent les styler par classe. Le nettoyeur HTML
(`shared/html-sanitizer.ts`) conserve `<aside>` et `class`.

| Encadré        | Balisage                                                                                         | Quand                                         |
| -------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| À retenir      | `<aside class="callout callout-info ax-encadre ax-retenir"><p class="callout-label">À retenir</p>…</aside>`        | fin de section ou d'article                   |
| En bref        | `<aside class="callout callout-note ax-encadre ax-bref"><p class="callout-label">En bref</p>…</aside>`             | en tête (3 puces au plus)                     |
| Exemple        | `<aside class="callout callout-note ax-encadre ax-exemple"><p class="callout-label">Exemple illustratif</p>…</aside>`          | situation illustrative d'une PME              |
| Chiffre clé    | `<aside class="ax-stat" data-aeo="stat"><span class="ax-stat-num">…</span><span class="ax-stat-label">…</span></aside>` (existant) | seulement si un chiffre sourcé est fourni |
| Réponse directe | `<p data-aeo="answer">…</p>` (existant)                                                          | sous chaque `<h2>`                            |
| Mise en garde  | `<aside class="callout callout-warning">…</aside>` (existant)                                    | avertissement ponctuel                        |

Les classes `callout*` existent déjà dans `globals.css` : les encadrés s'affichent sans CSS neuve ; `ax-encadre`, `ax-retenir`, `ax-bref`, `ax-exemple` sont les crochets pour les futurs modèles de pages.

Règles de style : le type d'un encadré est porté par son titre texte (`callout-label`), jamais
par la seule couleur ; pas de `role="note"`, `alert` ou `status` (cf. `PLAN.md`).

Mesure automatique : `mesurerLisibiliteV2` (`quality/lisibilite-v2.ts`) compte les encadrés
(`ax-encadre`, `ax-stat`, `callout`), les phrases longues, les paragraphes longs et la part
d'intertitres en question. La barrière de relecture `lisibilite-v2` n'envoie qu'en relecture,
jamais en refus.
