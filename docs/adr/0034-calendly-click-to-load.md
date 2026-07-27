# ADR 0034 — Calendly en click-to-load

- **Statut** : Accepted (2026-07-26)
- **Supersède** : la partie « auto-init au parse » d'ADR 0030 (le reste d'ADR
  0030 — capture `event_scheduled`, persistance `CalendlyEvent`, limites
  honnêtes sur les annulations — reste en vigueur).

> ⚠️ Numérotation : cet ADR a d'abord été rédigé sous le numéro 0031. **0031 est
> déjà pris** (`0031-reply-system.md`), ainsi que 0032 et 0033. Le premier
> numéro libre au 2026-07-26 est 0034. Si une référence à
> `0031-calendly-click-to-load.md` traîne quelque part, c'est un vestige : la
> corriger.

## Contexte

ADR 0030 avait retenu l'embed natif Calendly rendu en SSR : markup statique
`.calendly-inline-widget[data-url]` + `<script async>` widget.js émis directement
dans le HTML de `/appel`. Ce choix était bon techniquement — il rendait
l'affichage du calendrier indépendant de l'hydratation React, instable sur cette
page (résidu React 418), et il a effectivement supprimé l'écran blanc
intermittent « il faut F5 ».

Il est en revanche irrecevable au regard de l'article 82 de la loi Informatique
et Libertés : widget.js s'exécute au parse et auto-scanne le DOM, donc l'iframe
Calendly — et les cookies tiers du domaine `calendly.com` — étaient posés sur le
terminal du visiteur **avant** toute hydratation. Or la CMP (`CookieConsent`) est
volontairement non rendue au SSR, pour éviter des boutons morts. Le gate de
consentement était donc architecturalement inatteignable depuis ce composant :
Calendly gagnait toujours la course. Ce n'était pas un oubli de garde.

S'y ajoutait `hide_gdpr_banner=1`, qui neutralisait le bandeau natif de
Calendly : il ne restait aucune information, ni la nôtre ni la leur.

Deux constats vérifiés en production le 2026-07-26, avant correctif :

```
curl -s https://axion-ia.com/fr/appel          | grep -c 'calendly-inline-widget'  → 1
curl -s https://axion-ia.com/fr/sous-processeurs | grep -ci calendly               → 0
```

Le second est le volet « registre » : Calendly, en production depuis le
2026-05-26, ne figurait dans aucun des trois registres — SSOT publique
`src/content/subprocessors.ts`, registre interne `_AUDIT/DPA-REGISTER.md`,
politique `src/content/legal.ts` — pendant que `/sous-processeurs` se déclarait
exhaustive (RGPD art. 13.1.e). La SSOT avait été figée le 2026-05-15, onze jours
avant l'arrivée de Calendly ; rien ne forçait sa mise à jour.

## Décision

1. **L'embed passe en click-to-load** (motif recommandé par la CNIL pour les
   contenus tiers). `CalendlyConsentGate` rend un placeholder informant du
   transfert vers Calendly LLC (États-Unis, Clauses Contractuelles Types) et ne
   monte le conteneur natif — ni les préconnexions, ni widget.js — qu'après un
   clic explicite.
2. **Calendly est déclaré dans les trois registres**, et la mécanisation qui
   manquait est posée : `src/content/__tests__/subprocessors-coherence.spec.ts`
   échoue si un hôte est ajouté à `src/lib/csp.ts` sans entrée SSOT + ligne au
   registre, ou s'il est justifié comme non-sous-traitant.

Quatre points de conception non évidents :

- **Le choix n'est pas persisté.** Un choix persisté déclencherait l'obligation
  de l'art. 7.3 (retrait aussi simple que le recueil) et donc un écran de
  révocation dédié. Ne pas cliquer suffit à retirer.
- **`hide_gdpr_banner=1` est conservé.** Le bandeau natif s'affiche _dans_
  l'iframe, donc après le dépôt des cookies : il ne protège rien, et
  superposerait une seconde demande contradictoire juste après notre propre
  recueil. Contrepartie : puisqu'on masque leur notice, le placeholder mentionne
  les finalités propres de Calendly et lie `calendly.com/privacy`.
- **Le lien « Ouvrir Calendly dans un nouvel onglet » est un CTA primaire**, et
  l'ancien bloc de repli « Le calendrier ne s'affiche pas ? » a été supprimé (il
  aurait fait deux liens concurrents vers la même cible, sous une question dont
  la prémisse est fausse avant le clic).
- **La politique de confidentialité cesse d'énumérer.** Sa section transferts
  affirmait que « les seuls transferts hors UE » concernaient trois modèles
  d'IA — déjà faux avant Calendly, la SSOT en déclarant sept autres hors UE. Elle
  ne nomme désormais aucun sous-traitant et renvoie à `/sous-processeurs` :
  une prose qui n'énumère pas ne peut plus diverger. Un test le verrouille, en
  dérivant la liste interdite de `SUBPROCESSORS` (et non d'une liste figée).

## Conséquences

- **Régression assumée** : l'initialisation redevient dépendante de
  l'hydratation. Si elle échoue, le bouton n'est jamais cliquable et le
  calendrier devient inatteignable, alors qu'avant il s'affichait sans React.
  Une panne intermittente rattrapable par F5 devient une panne totale.
  Atténuation : `/appel` porte `revalidate = 86400`, donc le placeholder est
  pré-rendu et son lien externe est dans le HTML initial, cliquable sans JS ; une
  navigation à l'initiative de l'utilisateur est hors art. 82.
- **Conversion** : `/appel` est le funnel unique depuis la suppression de
  `/reserver`. Un clic s'interpose. Il n'existe pas d'alternative légale au
  chargement inconditionnel. À suivre sur Plausible les deux semaines suivant le
  déploiement.
- **Performance** : amélioration attendue sur `/appel` (widget.js et l'iframe
  quittent le chemin critique).
- **CSP et COEP inchangées.** `src/lib/csp.ts` (script-src
  `assets.calendly.com`, connect-src et frame-src `calendly.com`) et
  `Cross-Origin-Embedder-Policy: unsafe-none` dans `proxy.ts` restent
  nécessaires **après** consentement. Les durcir « puisque Calendly ne charge
  plus par défaut » recasserait l'embed une fois accepté — c'est exactement le
  bug corrigé le 2026-07-07. Elles sont en outre devenues le point de contrôle
  du test de cohérence : les vider le rendrait aveugle.
- **`CalendlyEventCapture` reste monté** : listener `postMessage` passif, aucune
  requête réseau (vérifié `appel/page.tsx:245-256`), et aucun événement ne peut
  arriver tant que l'iframe n'existe pas.
- **Action Will restante** : accepter le DPA sur `https://calendly.com/dpa`
  (acceptation au dashboard). Tracée ligne 16 de `_AUDIT/DPA-REGISTER.md`.
- **Hors périmètre** : le registre Qualiopi indicateur 27 (`SousTraitant`)
  concerne la sous-traitance _pédagogique_. Calendly n'y a rien à faire.
