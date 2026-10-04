# RELECTURE — Lot OPCO A8 : suivi de l'entreprise qui dépose (`opco/a8-suivi-entreprise`)

Relecteur A09. Deux lentilles : **EXACTITUDE** et **SÉCURITÉ**. Aucun code de la PR n'a été modifié.
Ce que j'ai lu : `git diff origin/main...origin/opco/a8-suivi-entreprise`, à la tête `3cb6f12f`
(47 fichiers, +4254 / −115), et `RAPPORT.md` de la branche `rapports/opco-a8-suivi-entreprise`.

## Ce qui a tourné

- `pnpm install` : OK.
- `DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub pnpm prisma:generate` : OK.
- `pnpm vitest run` sur ces chemins :
  - `src/server/qualiopi/financements/`, `src/server/qualiopi/alertes/`, `src/app/api/qualiopi/` ;
  - les specs du gabarit `opco-suivi-entreprise`, de `DepotOpcoPanel` et de `payloads-exemple`.
- Résultat : **97 fichiers, 1983 tests verts, 1 todo**. Je n'ai lancé ni la suite complète ni
  `next build`.

---

## 🔴 EXACTITUDE — défaut bloquant

### E1. Un ancien lien « Accord reçu » écrase la date de l'accord saisie par l'admin, y compris après la facturation

**Le code en cause :**

- `src/server/qualiopi/financements/suivi-entreprise/reponse.ts:107` : `lireJeton("reponse")` vérifie
  seulement trois choses : le jeton existe, il n'a pas expiré, il n'a pas déjà servi. Il ne regarde
  **ni l'état du dossier, ni l'état du suivi**.
- `reponse.ts:240-242` : la relecture du dossier ne porte que sur `statut` et `depotFaitLe`.
  `accordEcritLe` n'est pas lu.
- `reponse.ts:259-263` : sur la réponse `accord`, la fonction appelle `enregistrerAccordEcrit`
  sans condition.
- `src/server/qualiopi/financements/accord-ecrit.ts:31` : `planAccordEcrit` rend `date_seule` pour
  les statuts `accord_recu`, `facture` et `paiement_recu`.
- Dans `enregistrerAccordEcrit` (`dossier-financement.ts`), le geste `date_seule` fait
  `updateMany({ data: { accordEcritLe } })`. La date existante est remplacée.
- `page-publique.ts:126` : le champ date est **pré-rempli avec la date du jour**
  (`value="${aujourdhui}"`).

**Scénario :**

1. Dépôt le 01/10. La relance « réponse de l'OPCO ? » de J+10 part le 11/10. Son jeton est valable
   jusqu'au 10/11.
2. Le 15/10, l'admin saisit dans le Hub l'accord daté du **13/10**. Le dossier passe en
   `accord_recu`, puis en `facture`. Les relances s'arrêtent (`suiviTermine`), mais **le jeton du
   11/10 reste valide**.
3. Le 20/10, le contact rouvre l'ancien e-mail et clique sur « Accord reçu ». Comme la date est
   pré-remplie, il valide « 20/10 » sans y toucher.
4. Le POST passe toutes les gardes. `planAccordEcrit("facture")` rend `date_seule`, et
   `accordEcritLe` devient **20/10** à la place de 13/10.

**Conséquence :**

- `accordEcritLe` est la date qui « fait foi pour le régime de paiement »
  (`regime-paiement-session.ts:66`, `dateAccord: accordEcritLe ?? accordAt`).
- Un tiers non authentifié, de bonne foi, réécrit donc un fait financier qu'un humain habilité a déjà
  acté, après facturation. Aucune alerte ne se lève.
- C'est exactement ce que la PR garantit pour `depotFaitLe` (« jamais par-dessus une date déjà
  saisie », `reponse.ts:246-257`), mais pas pour la date de l'accord.
- Les tests ne voient pas le défaut : `reponse.spec.ts` simule `enregistrerAccordEcrit`, et aucun
  cas « dossier déjà en accord » n'existe.

**Correctif attendu (petit, dans la PR) :** avant d'appeler `enregistrerAccordEcrit`, appliquer la même
garde que pour le dépôt.

- Si `accordAcquis(dossier)` est vrai (statut d'accord, `accordEcritLe` ou `accordAt` déjà posé),
  **ne rien écrire sur le dossier**.
- Garder la réponse, et le PDF s'il est « sain ».
- Journaliser `accordEcritLeConserve`.
- Ajouter un test sur le vrai `planAccordEcrit` pour les statuts `accord_recu` et `facture`.

Option supplémentaire : faire répondre `lireJeton("reponse")` par la page neutre dès que le suivi est
terminé (`suiviTermine`), ce qui fermerait aussi les réponses après « Arrêter les relances ».

---

## 🟢 SÉCURITÉ — revue point par point

**(1) Route publique `/api/qualiopi/suivi-opco/[jeton]` : conforme.**

- **Jeton** :
  - 32 octets de `randomBytes`, en base64url ;
  - forme vérifiée avant toute requête (`FORME_JETON`) ;
  - seule l'empreinte SHA-256 est stockée (`jeton_hash`, unique) ;
  - expiration à 30 jours, vérifiée à la lecture et dans le `WHERE` de la consommation.
- **Usage unique atomique** : `updateMany({ where: { id, reponse: null, jetonExpireLe: { gt: now } } })`
  puis contrôle de `count` (`reponse.ts:234`). Ce n'est pas un lire-puis-écrire, et la course est
  testée.
- **GET** : aucune écriture (testé). Les antivirus de messagerie qui suivent les liens ne déclenchent
  donc rien.
- **POST** : seul écrivain. Il est limité en débit par IP hachée (10 par quart d'heure, et laisse
  passer si le limiteur tombe en panne). Avec 256 bits d'entropie, deviner un jeton par force brute
  est impossible.
- **CSRF** : le jeton figure dans le chemin et sert de clé. Un site tiers ne peut fabriquer le POST
  qu'en connaissant le jeton.
  - `Referrer-Policy: same-origin`, l'absence de lien externe sur la page et
    `frame-ancestors 'none'` empêchent la fuite du jeton par `Referer` et le clickjacking.
  - La CSP bloque tout script et limite `form-action` à `'self'`.
- **Réponses neutres** : jeton inconnu, expiré, déjà utilisé, mal formé ou drapeau coupé donnent la
  même page en 404. Pas d'oracle d'énumération.
- **En-têtes** : `no-store`, `noindex`, CSP. Ils sont posés deux fois, par la route et par
  `next.config.ts`.
- **Contenu affiché** : uniquement l'intitulé de la formation et le nom de l'OPCO, échappés. Aucun nom
  de stagiaire, aucun montant.

**(2) Téléchargement du dossier : conforme.**

- Le serveur répond par une redirection 302 vers une URL R2 signée de 120 s
  (`Referrer-Policy: no-referrer`, `no-store`).
- La clé R2 vient du suivi lié au jeton. Elle est donc liée au bon dossier, et aucun identifiant ne
  passe par l'adresse.
- Le ZIP ne part jamais en pièce jointe : l'e-mail ne porte que le lien.

**(3) Dépôt du PDF d'accord : conforme.**

- Taille limitée à 10 Mo :
  - par `content-length` dans la route ;
  - par `brut.size` à la lecture ;
  - par un nouveau contrôle dans `conserverAccord`.
- Le type réel est vérifié par la signature `%PDF-`.
- ClamAV (`analyserOctets`) passe **avant** `uploadToR2`. Les verdicts `infecte` et `indisponible`
  conduisent tous deux à **ne pas stocker** le fichier.
- La console lit le PDF par une URL signée sur le domaine R2, pas sur l'origine du site.

**(4) Transitions : légales.**

- L'accord passe par `enregistrerAccordEcrit`, donc par `planAccordEcrit` puis
  `transitionnerDossier`. Le refus passe par `transitionnerDossier`. Le verrou optimiste est
  conservé.
- Un dossier `refuse` ou `clos` n'est jamais rouvert : `planAccordEcrit` le refuse, l'erreur est
  rattrapée et les relances s'arrêtent.
- Aucun montant n'est saisi par l'entreprise.
- `depotFaitLe` n'est jamais écrasé.
- Le défaut E1 est une erreur d'exactitude sur une date. Il ne crée pas de transition illégale et
  n'ouvre aucun accès au-delà de ce que le jeton confère au destinataire légitime : je le classe en
  EXACTITUDE, pas en sécurité.

**(5) Relances : conformes, avec une réserve en P1.**

- Pas d'envoi le week-end.
- Au plus un e-mail par jour (vérifié dans `prochaineRelance`).
- Idempotence entre workers assurée par la clé unique `(suivi_id, etape, rang)` (`P2002` → « déjà
  envoyé »).
- Le drapeau `OPCO_SUIVI_ENTREPRISE_ENABLED` est relu à chaque appel. Il coupe l'envoi automatique,
  le bouton, les relances et la page publique (`lireJeton`).

**(6) Migration `20261004190000_opco_suivi_entreprise` : conforme.**

- Ajouts seuls : deux tables neuves et des FK en cascade. Les CHECK sont en `NOT VALID`.
- Annotation `/// rgpd: technique` sur les deux modèles. Aucune adresse n'est stockée.
- Fenêtre app/worker : le passage quotidien et la règle d'alerte (les deux chemins du worker) sont
  gardés par `tablesSuiviDisponibles`. Seul le « oui » est mis en cache. Le cas stub est géré.
- Côté app, la migration passe dans l'entrypoint, avant le démarrage du serveur.

**(7) Alertes : conformes, avec une réserve en P3.**

- `resolutionAuto: true` sur les trois codes. Elles se referment quand le dépôt est saisi, l'accord
  acquis, les relances arrêtées, ou le dossier clos ou renvoyé.
- Le lien `tel:` n'existe que dans la console.

**(8) E-mails : conformes.**

- Vouvoiement, aucune promesse (« pouvant être refusée », « nous vous invitons à vérifier »).
- Charte terracotta et ivoire, sans réseaux sociaux.
- « Lien personnel, valable 30 jours. »

---

## Petits défauts (non bloquants)

- **P1 — Relances « réponse de l'OPCO » après le début de session.** Le filtre « jamais le jour du
  début ni après » ne s'applique qu'à la phase dépôt. À J+10/J+20/J+30 du dépôt, une relance peut partir
  après le début de la session (`planning.ts:253`). Le rapport l'annonce ainsi, mais cela s'écarte de la
  consigne « jamais après le début de session ». C'est à Will de trancher : borner, ou l'assumer et
  l'écrire.
- **P2 — Corps de requête non borné sans `content-length`.** En envoi `chunked`, sans en-tête de
  longueur, `req.formData()` (`route.ts:88`) lit tout le corps en mémoire avant le contrôle de taille.
  La route est hors du `matcher` du proxy, donc sans `proxyClientMaxBodySize`. Le risque est atténué par
  le limiteur de débit, mais il vaudrait mieux refuser un POST sans `content-length`.
- **P3 — Le téléphone sort aussi par e-mail interne.** Le message d'alerte, qui contient le téléphone
  du contact (`regle-suivi-entreprise-opco.ts:72`), est aussi envoyé au guichet `direction` par
  `envoi-groupe.ts` (`message: a.message`). L'adresse est interne et le téléphone professionnel, mais
  ce n'est pas « seulement dans la console ».
- **P4 — Ordre consommation / effets.** Le jeton est consommé (`reponse.ts:234`) avant les effets.
  Si `enregistrerDepotDossier` lève une « modification concurrente », la réponse est notée mais la
  date n'est pas écrite, et la page renvoie une erreur 500. L'alerte « à appeler » rattrape le cas.
  Un `try` qui journalise l'échec serait plus propre.
- **P5 — ZIP orphelin.** `uploadToR2` du ZIP nominatif s'exécute avant la création du suivi. Sur
  `P2002` ou si la file est indisponible, le ZIP reste dans R2 sans référence.
- **P6 — Lien de téléchargement après le dépôt.** La route `dossier` ne vérifie pas
  `dossierTelechargeable`. Après le dépôt, tout jeton de moins de 30 jours télécharge encore le ZIP.
  C'est sans conséquence (même destinataire, même dossier), mais c'est incohérent avec la page.
- **P7 — Drapeau actif par défaut en production.** Au premier passage de 08:30 qui suit la
  migration, l'envoi automatique part vers tous les dossiers Atlas et OPCO 2i éligibles (30 au plus).
  C'est voulu (« demandé par Will le 04/10 »), mais à confirmer avant la fusion, ou
  `OPCO_SUIVI_ENTREPRISE_ENABLED=false` à poser d'abord. Les e-mails déjà en file ne relisent pas le
  drapeau.

---

## Verdicts

- **EXACTITUDE : `refuse`** — E1. Un lien « Accord reçu » encore valide remplace `accordEcritLe`
  (date qui fait foi pour le régime de paiement) sur un dossier déjà en accord, facturé ou payé. Le
  champ date est pré-rempli à aujourd'hui (`reponse.ts:259-263` → `accord-ecrit.ts:31` →
  `date_seule`). La garde « jamais par-dessus une date déjà saisie » doit valoir pour l'accord comme
  pour le dépôt.
- **SÉCURITÉ : `accepte`** — jeton haché, usage unique atomique, expiration, GET sans écriture, POST
  limité en débit, page neutre uniforme, CSP stricte, ZIP par URL signée courte, ClamAV avant
  stockage avec refus si l'antivirus échoue, transitions légales.
