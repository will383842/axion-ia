# ADR 0038 — /appel affiche les créneaux, rendus côté serveur

- **Statut** : Accepted (2026-07-30)
- **Supersède** : la partie « le click-to-load est le chemin nominal » d'ADR 0034. Le reste d'ADR 0034 — la doctrine article 82, l'interdiction de rendre
  `.calendly-inline-widget[data-url]` avant consentement, `hide_gdpr_banner=1`,
  la déclaration de Calendly dans les trois registres — **reste intégralement en
  vigueur**, et `CalendlyConsentGate` reste monté comme repli.

> ⚠️ Numérotation : 0034 est utilisé **deux fois** dans ce dossier
> (`0034-calendly-click-to-load.md` et
> `0034-signature-electronique-afest-1to1.md`). Le premier numéro réellement
> libre au 2026-07-30 est 0038. Ne pas « corriger » 0034 en renumérotant : des
> références externes pointent dessus.

## Contexte

ADR 0034 a résolu un vrai problème de conformité : l'embed Calendly déposait ses
cookies tiers au parse, avant toute possibilité de consentement. Le remède —
click-to-load — était le bon motif, recommandé par la CNIL.

Le coût n'avait pas été mesuré au bon endroit. Sur `/appel`, qui est le funnel
UNIQUE du site depuis la suppression de `/reserver`, le visiteur qui venait
choisir une heure trouvait à la place :

- un titre « Calendrier de réservation Calendly » ;
- un paragraphe de six lignes sur Calendly LLC, Atlanta, l'adresse IP, les
  cookies et les Clauses Contractuelles Types ;
- trois liens juridiques ;
- deux boutons, dont un seul menait au calendrier.

Verdict de Will, 2026-07-30 : « ça fait trop de blabla pour rien ». Il a raison
sur le fond — cette surface était devenue un formulaire de consentement là où on
attendait un agenda. Et l'ADR 0034 le disait déjà lui-même en conséquence :
« un clic s'interpose », « il n'existe pas d'alternative légale au chargement
inconditionnel ».

Cette dernière phrase était vraie, et c'est exactement là qu'était l'erreur de
cadrage : elle raisonnait sur le chargement de **l'iframe**. Or l'iframe n'est
pas la seule façon d'afficher un calendrier.

## Décision

**Les créneaux sont demandés par NOTRE SERVEUR et rendus en HTML statique.**

`src/server/calendly/availability.ts` interroge l'API Calendly v2
(`/event_type_available_times`) avec le Personal Access Token déjà posé pour
ADR 0036. `src/components/booking/CalendlySlotPicker.tsx` — Server Component,
zéro JavaScript envoyé — rend le résultat sous forme de liens.

Conséquence juridique, qui est le cœur de la décision : le navigateur du
visiteur **n'émet aucune requête vers Calendly**. Pas de handshake TLS, pas d'IP
transmise, pas de cookie déposé, donc aucun accès en écriture ni en lecture à son
terminal. L'article 82 de la loi Informatique et Libertés ne s'applique pas — il
n'y a rien à faire consentir, donc rien à afficher pour le recueillir. Le
visiteur ne rejoint Calendly qu'en cliquant un créneau, pour confirmer nom et
email : une navigation à SON initiative, hors du champ de l'art. 82. C'est
littéralement le raisonnement qui justifiait déjà le lien « nouvel onglet »
d'ADR 0034 — appliqué cette fois au chemin principal.

Il reste **une ligne** d'information sous le calendrier (« Confirmation sur
Calendly (États-Unis) · nos sous-traitants »). Elle n'est pas un recueil de
consentement : c'est de la loyauté sur la destination d'un lien.

Quatre points de conception non évidents :

- **Le repli n'est pas un cas d'erreur, c'est le défaut.** Sans jeton, sur 403,
  sur panne réseau ou sur agenda plein, `fetchAvailableSlots()` renvoie
  `{ ok: false }` et la page rend `CalendlyConsentGate`, inchangé. Ce cas se
  produit **à chaque build** : le jeton est un secret de runtime Coolify, absent
  des GitHub Actions. La page est donc prérendue avec le placeholder, et l'ISR la
  repeuple en production. Même contrat que les stubs Prisma/Redis (AGENTS.md).
- **`export const revalidate` passe de 86400 à 900 sur `/appel`.** Contre-
  intuitif et à ne pas « optimiser » : hériter de l'intervalle du `fetch` ne
  suffit pas, puisqu'au build aucun `fetch` n'a lieu — la route garderait 24 h et
  servirait le repli prérendu pendant tout ce temps.
- **La fenêtre de temps est une clé de cache.** `start_time` est dans l'URL
  demandée. Calculée sur l'horloge, elle serait unique à chaque rendu et le cache
  de données ne servirait jamais. Elle est donc quantifiée sur le pas du TTL :
  une URL par intervalle, un appel réseau par intervalle. Deux tests gardent
  cette propriété, invisible autrement.
- **La régression assumée d'ADR 0034 disparaît.** Celle-ci notait que si
  l'hydratation échouait, le bouton restait inerte et le calendrier
  inatteignable. Des liens dans le HTML initial fonctionnent sans React.

## Effet de bord traité : la capture des leads

Jusqu'ici, une réservation n'entrait dans `calendly_events` que par le
`postMessage` de l'iframe. Cliquer un créneau ouvre calendly.com dans un nouvel
onglet : **aucun `postMessage` ne parviendra plus par cette voie.**

Ce trou existait déjà — le CTA primaire d'ADR 0034 était « Ouvrir Calendly dans
un nouvel onglet », et tout ce qui y était réservé n'était capté par personne.
ADR 0038 rend ce chemin majoritaire, donc le laisser ouvert reviendrait à faire
disparaître les leads de la console.

`src/server/calendly/discover.ts` sonde donc `/scheduled_events` et crée les
lignes manquantes, greffé sur le passage horaire qui rafraîchit déjà les statuts
(`api/internal/calendly-refresh`). Nouvelle valeur d'enum `api_poll` pour
distinguer cette provenance (migration `20260730170000_calendly_source_api_poll`).
Aucun doublon possible : `invitee_uri` porte une contrainte UNIQUE, et une course
avec la capture `postMessage` est traitée comme un doublon, pas comme une erreur.

`CalendlyEventCapture` **reste monté** : le repli monte toujours l'iframe, et
c'est lui que rend le build.

## Conséquences

- **Performance** : plus rien de Calendly dans le chemin critique de `/appel` —
  ni widget.js, ni iframe, ni préconnexion. Le sélecteur n'envoie aucun
  JavaScript. Budget `/appel` (INP ≤ 150 ms, First Load ≤ 110 KB gz) : marge
  gagnée, pas consommée.
- **Un créneau peut être périmé jusqu'à 15 minutes.** Le visiteur atterrit alors
  sur un « créneau plus disponible » côté Calendly. Compte tenu du volume réel,
  la collision est rare et Calendly la gère proprement. Réduire le TTL
  augmenterait la charge API sans bénéfice mesurable.
- **Les heures affichées sont celles de Paris**, et le sélecteur le dit.
  Calendly, lui, affichera le créneau dans le fuseau du visiteur. Le lien porte
  l'instant exact : les deux sont cohérents, mais retirer la mention rendrait
  l'écart incompréhensible depuis l'étranger.
- **Dépendance nouvelle du rendu au jeton API.** `CALENDLY_API_TOKEN` ne sert
  plus seulement à l'enrichissement des fiches : il conditionne désormais
  l'affichage de `/appel`. S'il est révoqué, la page ne casse pas — elle revient
  au placeholder d'ADR 0034.
- **CSP et COEP inchangées.** `script-src assets.calendly.com`, `frame-src` et
  `connect-src calendly.com` restent nécessaires **au repli**. Les durcir
  « puisque Calendly ne charge plus » recasserait l'embed du repli — c'est le bug
  corrigé le 2026-07-07, déjà signalé par ADR 0034. Elles sont en outre le point
  de contrôle du test de cohérence des sous-traitants.
- **Registres inchangés** : Calendly reste un sous-traitant déclaré (il traite
  toujours les données de réservation), et `/sous-processeurs` reste lié depuis
  la page.

## Vérification restant à faire côté Will

Je n'ai pas pu éprouver `/event_type_available_times` contre le compte réel
(accès prod refusé pendant la session). C'est le point que l'ADR 0036 laissait
déjà ouvert : « les sources publiques divergent sur la disponibilité exacte de
l'API au palier gratuit ».

Si l'endpoint est refusé sur ce plan, **rien ne casse** : `/appel` affiche le
placeholder d'ADR 0034, exactement comme aujourd'hui. Pour trancher en une
commande, depuis le VPS :

```sh
# 1. lire le jeton depuis le conteneur applicatif, sans l'afficher
TOK=$(docker inspect <container> --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed -n 's/^CALENDLY_API_TOKEN=//p')

# 2. URI de l'event-type
curl -s -H "Authorization: Bearer $TOK" \
  "https://api.calendly.com/event_types?user=$(curl -s -H "Authorization: Bearer $TOK" \
  https://api.calendly.com/users/me | jq -r .resource.uri)&count=50" | jq -r '.collection[] | "\(.slug) \(.uri)"'

# 3. le test décisif — 200 = créneaux affichés, 403 = repli conservé
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOK" \
  "https://api.calendly.com/event_type_available_times?event_type=<URI>&start_time=$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)&end_time=$(date -u -d '+6 days' +%Y-%m-%dT%H:%M:%SZ)"
```

Sinon, plus simplement : déployer et regarder `/fr/appel`. Un calendrier de
créneaux = l'API répond ; le placeholder = elle ne répond pas.
