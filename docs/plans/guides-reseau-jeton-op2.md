# Plan — jeton de désinscription opaque `op2` (guides réseau, lot 2)

> Statut : **CONCEPTION** (aucun code). Base : `main` @ `0139fc1f` (11/11/2026).
> Destinataire : un développeur (Sonnet) qui exécute fiche par fiche, sans réinterpréter.
> Règles de Williams, non négociables : **aucune suppression de données de personnes** (mise à
> l'écart seulement) ; **un « stop » l'emporte toujours** ; **rien de personnel dans les journaux**.

## 1. Le problème, mesuré dans le code

Le lien « Ne plus recevoir de sollicitations » porte un jeton `op1` qui **contient l'adresse en
clair, encodée en base64url** : `op1.<adresse en base64url>.<HMAC tronqué>`. Quiconque voit le
lien voit l'adresse (un `atob` suffit). Ce lien voyage :

| Où                                                 | Constat                                                                                                                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format                                             | `src/server/email/opposition-jeton.ts:10` et `:52-56` (`jetonOpposition`) ; même texte en `src/server/email/opposition.ts:25`                                                          |
| Pied de chaque e-mail B, C, D                      | `src/lib/email/templates/index.tsx:813` (`urlOpposition(contexte.destinataire)`)                                                                                                       |
| En-tête `List-Unsubscribe` (RFC 8058)              | `src/server/queue/workers/email-worker.ts:286-289` → `src/lib/email/client.ts:310-312` (`/api/unsubscribe?token=…`)                                                                    |
| E-mail du guide de la page « Recevoir le guide »   | `src/server/guides-reseau/page-confirmation.ts:370` ; rattrapage `src/server/guide-ia/rattrapage.ts:237`                                                                               |
| Charge BullMQ (Redis) et corbeille de validation   | `src/server/guide-ia/envoi.ts:117-119` (`payload.oppositionToken`) ; `src/server/queue/queues.ts:1046-1050` (`garerPourValidation`)                                                    |
| **URL de la page `/fr/desabonnement?token=…`**     | `src/app/api/unsubscribe/route.ts:157` (le GET redirige en recopiant le jeton dans l'URL) ; lu en `src/app/[locale]/desabonnement/page.tsx:19,45,159`                                  |
| Scripts de mesure chargés sur **toutes** les pages | `src/app/[locale]/layout.tsx:362` (Plausible) ; Clarity, Meta, LinkedIn après accord (`src/components/analytics/`) : l'URL complète de `/fr/desabonnement?token=op1…` leur est visible |

Constats annexes (à corriger dans ce lot, cités pour qu'on ne les « découvre » pas) :

- `src/server/guide-ia/rattrapage.ts:221-222` affirme « jeton d'opposition signé, **sans adresse en
  clair** » : c'est faux pour `op1` (base64url ≠ chiffrement). Le commentaire doit suivre `op2`.
- `src/app/[locale]/desabonnement/page.tsx:101` reconnaît une opposition par `token.startsWith("op1.")`
  en dur : un `op2` y serait pris pour un jeton de newsletter (mauvais titre, mauvais bouton).
- `src/app/api/unsubscribe/route.spec.ts:23` simule `estJetonOpposition` par `startsWith("op1.")`.
- `src/server/email/opposition-jeton.ts:23-36` : la clé de signature dérive d'`AUTH_SECRET`. **Une
  rotation d'`AUTH_SECRET` casserait en silence tous les liens d'opposition jamais envoyés** (y compris
  les `op1` qu'on promet d'accepter sans date de fin). Voir décision **D2**.
- Hors périmètre mais contraire à la règle des journaux : `src/server/queue/queues.ts:995` journalise
  l'adresse en clair (`skipping enqueueEmail(${template}, ${to})`). Fiche séparée proposée (§9, J5).
- Déjà bon, à ne pas casser : Sentry retire le paramètre `token` des URL
  (`src/lib/observability/sentry-pii-scrub.ts:54`) ; la copie d'envoi masque les paramètres `token`
  (`src/lib/email/masquer-secrets.ts:50-51`) ; le GET n'agit jamais (`route.ts:20-30`).

## 2. Ce qu'on veut à la fin

1. **Tout nouveau lien** porte un jeton `op2` **opaque** : rien dans le jeton ne permet de lire
   l'adresse sans la clé serveur.
2. **Les anciens liens `op1` restent acceptés, sans date de fin** (un e-mail de 2026 ouvert en 2029
   doit encore permettre de dire « stop »). Plus aucun `op1` n'est **émis**.
3. **Plus de jeton dans l'URL de `/desabonnement`** (ni `op1`, ni `op2`, ni jeton de newsletter).
4. **Plus de jeton dans aucun journal** (console, Sentry, copie d'envoi, mesure d'audience).
5. Le « stop » ne se perd jamais : jeton illisible → page qui donne `contact@axion-ia.com`, comme
   aujourd'hui ; aucune nouvelle cause d'échec côté personne.

Ce qui **ne change pas** : l'URL de l'en-tête `List-Unsubscribe` garde le jeton en paramètre (RFC 8058
l'exige : le client de messagerie POSTe sur cette URL, sans corps identifiant). Avec `op2`, ce
paramètre ne révèle plus rien.

## 3. Le format `op2` (recommandation, à valider : D1)

**Recommandé — option A : chiffrement authentifié déterministe, sans table.**

```
op2.<kid>.<base64url( iv[12] ‖ chiffré ‖ tag[16] )>
  kid    : identifiant de clé, 1 à 4 caractères [a-z0-9] (premier : "k1")
  iv     : HMAC-SHA256(cléIv, adresse normalisée)[0..12]      ← IV « synthétique »
  chiffré: AES-256-GCM(cléChiffrement, iv, adresse), AAD = "op2|" + kid
```

- Lecture : décoder, déchiffrer (le tag GCM authentifie), **puis recalculer l'IV depuis l'adresse
  obtenue et exiger l'égalité** (refuse tout jeton fabriqué avec un IV arbitraire), puis
  `normaliserAdresse(adresse) === adresse`.
- **Stable** (même adresse → même jeton, comme `op1`) : l'en-tête et le pied de page concordent, et
  le test du worker `lireJetonOpposition(jetonPage) === normaliserAdresse(to)` reste valable.
- **Pur et synchrone** : `opposition-jeton.ts` reste importable par le registre des gabarits et le
  worker (`node:crypto` seulement, cf. son en-tête l. 3-8). Aucune écriture à l'envoi (« 44 gabarits,
  des milliers d'envois », `opposition.ts:12-16`).
- Longueur : ~80 caractères pour une adresse de 30 ; borne de lecture : jeton ≤ 512 caractères.

Option B (écartée sauf avis contraire de Williams) : jeton aléatoire + table de correspondance
(empreinte du jeton → adresse chiffrée). Plus opaque (une fuite de clé ne révèle rien), mais impose une
écriture **asynchrone** en base avant chaque rendu d'e-mail, donc casse la pureté du module, ajoute une
panne possible sur le chemin d'envoi et une table de plus à traiter à l'effacement.

**Clés** : dérivées d'un **secret dédié** `OPPOSITION_JETON_SECRET` (≥ 32 caractères, scope RUN,
conteneurs **app ET worker**, jamais un build-arg), par séparation de domaine :
`cléChiffrement = SHA-256("axion-opposition-op2-enc|" + kid + "|" + secret)`,
`cléIv = SHA-256("axion-opposition-op2-iv|" + kid + "|" + secret)`.
Rotation = nouveau `kid` + `OPPOSITION_JETON_SECRET_<KID>` conservé **à vie** pour la lecture (les liens
n'expirent pas). Secret absent en production → **pas d'émission `op2`** (repli : émettre `op1`, jamais
« pas de lien »), alerte Sentry sans valeur.

## 4. Plus de jeton dans l'URL de `/desabonnement` (recommandation, à valider : D3)

Aujourd'hui : e-mail → `GET /api/unsubscribe?token=X` → **303 vers `/fr/desabonnement?token=X`** →
bouton → `POST /api/unsubscribe` (jeton dans le corps).

Demain :

1. `GET /api/unsubscribe?token=X` : contrôle de débit inchangé ; **303 vers `/fr/desabonnement`
   SANS paramètre**, avec `Set-Cookie: __Host-axion-desinscription=<X>; Path=/; Secure; HttpOnly;
SameSite=Lax; Max-Age=900`. En-tête `Referrer-Policy: no-referrer` et `Cache-Control: no-store`.
   Le jeton n'est **pas** contrôlé au GET (le GET reste une navigation : aucune action, aucune
   différence de réponse entre un bon et un mauvais jeton).
2. `/[locale]/desabonnement/page.tsx` lit le jeton dans `cookies()` (plus dans `searchParams.token`) ;
   il affiche le bouton si le cookie existe ; le formulaire POST **ne porte plus de champ caché**.
   `searchParams.token` est **ignoré** (un vieil URL mis en favori ne doit pas réintroduire le jeton
   dans la page ; il tombe sur « lien requis »… voir rejeu ci-dessous).
3. `POST /api/unsubscribe` (formulaire) : jeton = corps **ou** cookie, dans cet ordre ; après
   traitement (succès **ou** échec) la réponse 303 **efface le cookie** (`Max-Age=0`).
4. POST « One-Click » (RFC 8058) : **inchangé** (jeton dans l'URL de l'en-tête).
5. Le type d'opposition affiché (`estOpposition`) se décide côté serveur par
   `estJetonOpposition()` (op1 **ou** op2), plus par `startsWith("op1.")`.

Alternative si le cookie est refusé par Williams : faire répondre le GET par une page HTML statique
sans script (modèle `src/app/guide-reseau/html-statique.ts`), formulaire POST avec jeton en corps. Le
jeton reste alors dans l'URL du seul lien d'e-mail, jamais dans une page qui charge Plausible.

## 5. Fichiers autorisés

Modifiables :

- `src/server/email/opposition-jeton.ts` (format, lecture op1+op2, émission op2)
- `src/server/email/opposition.ts` (commentaire d'en-tête, ré-exports ; **pas** la logique
  d'enregistrement)
- `src/app/api/unsubscribe/route.ts`, `src/app/api/unsubscribe/route.spec.ts`
- `src/app/[locale]/desabonnement/page.tsx`
- `src/server/queue/workers/email-worker.ts` (l. 270-290 seulement : validation du jeton de page)
- `src/server/guides-reseau/page-confirmation.ts` (l. 45 et 370 : appel du constructeur)
- `src/server/guide-ia/rattrapage.ts` (l. 47, 219-237 : appel et commentaire)
- `src/env.ts` (déclaration optionnelle de `OPPOSITION_JETON_SECRET*`, sans la rendre exigée au build :
  respecter `SKIP_ENV_VALIDATION`)
- `docs/guides-reseau-interrupteurs.md` (section « Jeton de désinscription »)
- Nouveaux tests : `src/server/email/__tests__/jeton-op2.spec.ts`,
  `src/server/email/__tests__/op1-accepte-sans-date-de-fin.spec.ts`,
  `src/app/api/unsubscribe/__tests__/aucun-jeton-dans-l-url-de-la-page.spec.ts`,
  `tests/unit/email/plus-aucun-op1-emis.spec.ts` (garde statique)

Interdits : `prisma/schema.prisma` et `prisma/migrations/**` (option A = aucune migration),
`src/lib/rgpd-erase.ts`, la logique de `enregistrerOppositionPourAdresse`, le CRM.

## 6. Étapes (deux PR, dans cet ordre — fenêtre app↔worker)

AGENTS.md (« DEUX conteneurs, DEUX vitesses ») : le **worker** rend les e-mails et atterrit ~50 min
**avant** l'app, qui sert `/api/unsubscribe`. Si le worker émettait `op2` avant que l'app sache le
lire, chaque clic de la fenêtre échouerait (« Lien expiré ou inconnu ») — un « stop » perdu.
D'où : **lecture d'abord, émission ensuite, derrière un interrupteur.**

### J1 (S) — Lecture `op2` + `op1` à vie (aucune émission changée)

1. Écrire les tests rouges J1 (§7).
2. `opposition-jeton.ts` : `lireJetonOpposition(token)` aiguille sur le préfixe : `op1.` → code actuel
   **inchangé** (signature AUTH_SECRET) ; `op2.` → déchiffrement §3. `estJetonOpposition` accepte les
   deux préfixes. Longueur > 512 → `null` sans calcul.
3. Ajouter `jetonOppositionOp2(email): string | null` (null si secret absent/court). Ne pas encore
   l'appeler.
4. `desabonnement/page.tsx:101` : `estOpposition` via `estJetonOpposition` (import du module pur).
5. Mettre à jour le mock de `route.spec.ts:23`.

### J2 (S) — Plus de jeton dans l'URL de `/desabonnement` (cookie)

1. Tests rouges J2. 2. `route.ts` GET (l. 146-160) et POST (l. 121-143) selon §4. 3. `page.tsx` lit
   `cookies()`, retire `token` de `searchParams` et le champ caché (l. 159).

J1 + J2 peuvent partir dans **une même PR** (PR-1). Vérifier l'atterrissage de l'app
(`x-axion-build-sha`) **avant** PR-2.

### J3 (S) — Émission `op2` derrière `OPPOSITION_JETON_V2` (PR-2)

1. Interrupteur `OPPOSITION_JETON_V2` (exactement `"true"`, lu à l'exécution, **éteint par défaut**,
   app **et** worker). Éteint : `jetonOpposition()` rend `op1` comme aujourd'hui.
2. Allumé : `jetonOpposition()` rend `jetonOppositionOp2()` ; s'il rend `null` (secret absent) →
   `op1` + `console.warn(JSON.stringify({ event: "opposition_jeton_repli_op1" }))` (sans valeur) +
   Sentry niveau warning, **au plus une fois par processus**.
3. Les quatre appelants (`templates/index.tsx:813`, `email-worker.ts:289`,
   `page-confirmation.ts:370`, `rattrapage.ts:237`) passent tous par `jetonOpposition()`/`urlOpposition()`
   : aucun ne fabrique un jeton lui-même. Corriger le commentaire faux `rattrapage.ts:221-222`.
4. `email-worker.ts:276-285` : garder la règle « le jeton de page doit désigner CE destinataire »
   (`lireJetonOpposition(jetonPage) === normaliserAdresse(to)`), valable pour op1 et op2. Un job mis en
   file **avant** l'allumage porte encore un `op1` : il reste accepté (pas de régénération).
5. Garde statique `plus-aucun-op1-emis.spec.ts` : aucun fichier de `src/` hors
   `opposition-jeton.ts` et des tests ne contient le littéral `"op1"` ni ne construit un jeton à la main.

### J4 (S) — Documentation et ordre d'allumage

`docs/guides-reseau-interrupteurs.md` : nouvelle section (secret, kid, interrupteur, ordre : poser
`OPPOSITION_JETON_SECRET` sur app **et** worker → vérifier PR-1 en ligne → allumer
`OPPOSITION_JETON_V2` sur les deux → vérifier un e-mail reçu).

### J5 (S, optionnelle, hors guides) — `queues.ts:995`

Remplacer `${to}` par `redactEmail(to)` (`src/lib/pii-redaction.ts`). Une ligne, un test.

## 7. Tests rouges à écrire AVANT le code

J1 :

- `jeton-op2.spec.ts`
  - aller-retour : `lireJetonOpposition(jetonOppositionOp2("A@B.fr "))` → `"a@b.fr"` ;
  - **opacité** : le jeton ne contient ni l'adresse, ni son base64/base64url, ni sa partie locale ;
  - stabilité : deux appels → même jeton ; deux adresses → deux jetons ;
  - altération d'un octet (iv, chiffré, tag, kid) → `null` ; IV remplacé par un autre IV valide pour une
    autre adresse → `null` ; `kid` inconnu → `null` ; > 512 caractères → `null` ;
  - autre secret → `null` ; secret absent/court → `jetonOppositionOp2` rend `null`.
- `op1-accepte-sans-date-de-fin.spec.ts` : un jeton `op1` **figé en dur dans le test** (calculé une fois
  avec l'`AUTH_SECRET` de test) est lu ; avec `vi.setSystemTime(new Date("2040-01-01"))` il l'est encore ;
  `enregistrerOpposition(op1)` et `enregistrerOpposition(op2)` de la **même** adresse posent **une**
  ligne `email_oppositions` (la seconde rend `dejaOpposee: true`).
- `desabonnement` : un `op2` affiche « l'arrêt des sollicitations commerciales ».

J2 (`aucun-jeton-dans-l-url-de-la-page.spec.ts`) :

- GET `?token=X` → 303, `Location` = `/fr/desabonnement` **sans** `token`, `Set-Cookie` contient
  `__Host-axion-desinscription`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=900` ;
- GET sans jeton → 303 `status=fail&reason=missing_token`, pas de cookie ;
- POST formulaire sans corps mais avec cookie → enregistre, 303 `status=ok`, cookie effacé ;
- POST formulaire, échec → cookie effacé aussi ;
- One-Click → 200, **aucun** `Set-Cookie`, jeton lu dans la requête comme avant ;
- la page rendue avec `searchParams.token = "op2…"` et sans cookie **ne contient pas** la valeur.

J3 :

- interrupteur éteint → `jetonOpposition()` commence par `op1.` (comportement actuel inchangé) ;
- allumé + secret → `op2.` ; allumé sans secret → `op1.` + un seul avertissement, sans la valeur ;
- `urlOpposition()` et l'en-tête `List-Unsubscribe` du worker portent le même jeton ;
- un job ancien portant un `op1` de page pour le bon destinataire → accepté ; pour un autre → ignoré ;
- aucune sortie console (espionner `console.*`) ne contient le jeton ni l'adresse.

## 8. Rejeu, doublon, désordre, panne

- **Rejeu** (double clic, rechargement, scanner de liens) : le GET n'agit pas ; le POST appelle
  `enregistrerOppositionPourAdresse`, déjà idempotent (`opposition.ts:418-455`, P2002 rattrapé). Un
  cookie déjà consommé est effacé : recharger la page montre « lien requis » + `contact@` (acceptable :
  l'opposition est faite et le bandeau `status=ok` est dans l'URL).
- **Doublon** : `op1` et `op2` de la même adresse → même `emailHash` → une seule ligne d'opposition.
- **Désordre** : e-mail rendu en `op1` avant l'allumage, cliqué après (ou l'inverse après un retour
  arrière) → les deux formats sont lus à vie. L'ordre des PR (lecture avant émission) supprime la
  fenêtre app↔worker.
- **Panne** : secret absent → repli `op1` (le lien existe toujours) ; Redis/limiteur en panne →
  comportement actuel de `checkRateLimit` ; base en panne → `internal`, page qui donne `contact@`
  (inchangé) ; cookie bloqué par le navigateur → la page ne voit pas le jeton : message « lien requis »
  - `contact@`, et le bouton natif « Se désabonner » du client de messagerie (One-Click) reste
    disponible. **Aucun chemin ne perd un « stop » déjà reçu.**

## 9. Migration et retour arrière

- **Aucune migration** (option A). Aucune donnée écrite par l'émission.
- Retour arrière J3 : éteindre `OPPOSITION_JETON_V2` (app + worker) → retour à `op1`. Les `op2` déjà
  envoyés restent lisibles **tant que le code de J1 reste en place** : **J1 ne se retire jamais**
  (sinon des « stop » deviennent impossibles). Le dire en tête du fichier `opposition-jeton.ts`.
- Retour arrière J2 : revenir au GET qui recopie le jeton — aucune donnée à reprendre ; le cookie
  expire seul en 15 min.
- Le secret `OPPOSITION_JETON_SECRET` ne se supprime jamais ; une rotation ajoute un `kid`.

## 10. Décisions à demander à Williams

- **D1** — Format : option A (chiffrement déterministe, sans table, recommandé) ou B (jeton aléatoire +
  table) ?
- **D2** — Secret : `OPPOSITION_JETON_SECRET` dédié (recommandé) ; et pour `op1`, accepter aussi
  `AUTH_SECRET_PRECEDENT` le jour où `AUTH_SECRET` tourne (sinon tous les `op1` meurent ce jour-là) ?
- **D3** — Cookie court `__Host-` (recommandé) ou page HTML statique servie par le GET ?
- **D4** — Durée du cookie : 15 min proposées (temps de lire la page et cliquer).
- **D5** — Faut-il, une fois `op2` allumé, **re-signer** les jobs déjà en file ? Recommandation : non
  (ils sont lus à vie, et réécrire Redis ajoute un risque).
- **D6** — Accord pour la fiche J5 (adresse en clair dans `queues.ts:995`), hors guides réseau.
- **D7** — Vérifier en SSH que le proxy du VPS (Traefik/Coolify) n'écrit pas de journal d'accès avec
  les requêtes ; s'il le fait, ces journaux contiennent l'URL de l'en-tête `List-Unsubscribe` (avec
  `op2`, sans adresse lisible) : accepter, ou masquer `token` dans le format du journal ?
