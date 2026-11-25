# Espace apporteur : page « Mes commissions » — plan de conception

> **Écrit le** 2026-11-25, sur `origin/main` à `3151c61a`. **Aucun code produit** : ce document est un plan.
> **Rôle tenu** : concepteur et auditeur argent, données, sécurité.
> **Lu pour l'écrire** : `src/features/apporteurs-reseau/` (`commissions.ts`, `commandes.ts`, `facturation.ts`, `autofacture-donnees.ts`, `regles.ts`, `envois.ts`, `presentations.ts`, `declaration-entreprise.ts`, `declaration-regles.ts`, `prestation-presentation.ts`, `passage-quotidien.ts`, `notification-attribution.ts`, `retrait.ts`, `solde-negatif.ts`, `requetes-console.ts`, `jeton.ts`, `donnees.ts`, `grille-reference.ts`, l'annexe 1 de `contrat-v2.ts`), `src/app/apporteur/dossier/`, la console `apporteurs/commissions`, `prisma/schema.prisma`, `src/lib/r2-storage.ts`, `src/lib/security/lien-signe.ts`, `next.config.ts`, `package.json` (cliquets de poids).
> **Ce qui n'a pas été vérifié** est listé au §7, sans exception.

---

## 0. L'essentiel en une page

### Ce que la page fera

Dans son espace (lien personnel, sans mot de passe), l'apporteur ouvre « Mes commissions » et lit, **entreprise par entreprise** : où en est sa présentation, si une commande est signée, si le client a payé, le montant de sa commission, quand elle est versée, et s'il y a une reprise. En bas de page, il retélécharge ses autofactures et ses avoirs.

La page **ne calcule rien**. Elle lit les montants déjà arrêtés en base (`commissions_apporteur.montant_cents`) et les états que la console lit aussi, par les mêmes fonctions.

### Cinq constats d'audit qui changent la conception

| N°     | Constat                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Conséquence                                                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | **Les règles métier de la commande ne sont pas celles du code.** Le code applique l'annexe 1 du contrat 2.6 : formation au forfait par palier (250, 500, 1 000 €, prorata, plafonné), **30 %** sur l'accompagnement individuel, **30 %** sur les audits, 15 % sur les implémentations, 500 € fixes par conférence **sans prorata**. La Journée IA n'a **aucune commission** dans le code (`pricing.ts` : « Aucune commission tant que Williams ne l'a pas tranchée »). | La page affiche ce qui est stocké : elle n'est pas touchée par la grille. Mais **montrer des montants à l'apporteur avant d'avoir tranché l'écart, c'est lui montrer des montants calculés sur une grille que la commande dit ne plus être la bonne.** Décision D1. |
| **C2** | **La part de parrainage porte la présentation du FILLEUL.** `passage-quotidien.ts` crée la ligne du parrain avec `presentationId` = la présentation du filleul. Une lecture naïve « commission → entreprise » afficherait au parrain **le nom du client d'un autre apporteur**.                                                                                                                                                                                        | Les lignes `parrainage = true` ne sont jamais rattachées à une entreprise à l'écran, et la jointure est gardée par `presentation.apporteurId === apporteurId`. Test dédié (§2.3, T5).                                                                               |
| **C3** | **L'adresse `/apporteur/dossier/<id>/<jeton>/commissions` existe déjà** : c'est la grille de référence.                                                                                                                                                                                                                                                                                                                                                                | La nouvelle page s'appelle `/mes-commissions`.                                                                                                                                                                                                                      |
| **C4** | **Avant le paiement intégral, aucune ligne n'existe.** La commission n'est créée qu'une fois la commande soldée (`commandesSoldees`). « Commande signée » n'a donc aucune ligne en base ; sa seule trace est l'e-mail `apporteur-commande-signee` au journal des e-mails.                                                                                                                                                                                              | L'état « commande signée » se lit au journal des e-mails (ce qui a été dit à l'apporteur), pas en rejouant l'attribution. Jamais de montant à ce stade.                                                                                                             |
| **C5** | **La console n'a pas de fonction d'état.** Les libellés de `apporteurs/commissions/page.tsx` sont des conditions JSX sur `statut`, `autofactureNumero`, `litigeDepuis`, `prestationRealiseeAt`, `autofactureAttenteMotif`.                                                                                                                                                                                                                                             | Pour tenir « une seule source, pas de second calcul », le premier lot extrait une fonction pure `etatCommission()` et branche la console dessus, avant toute page apporteur.                                                                                        |

### Décisions demandées à Will

| N°     | Question                                                                                                                              | Recommandation                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Quelle grille fait foi : celle du contrat 2.6 dans le code, ou celle de la commande (Journée IA 500 €, 15 %, rien sur le récurrent) ? | **Trancher avant le lot 4** (la page). Les lots 1 à 3 n'en dépendent pas. Si la grille change, c'est un chantier contrat + `regles.ts` + `parite-contrat-code.spec.ts`, hors de ce plan.                                                                        |
| **D2** | Un seul mot pour la protection : « Réservée » (écran actuel) ou « Gardée » (la commande) ?                                            | « Gardée pour vous jusqu'au … », posé dans `LIBELLE_ETAT_DECLARATION`, donc changé **aux deux endroits à la fois**. Jamais deux mots pour une chose.                                                                                                            |
| **D3** | Affiche-t-on le prix facturé au client à côté du nom de l'entreprise ?                                                                | **Non.** Voir §3 : l'autofacture l'imprime déjà, mais sans le nom du client. La page ne fait pas ce rapprochement ; le PDF reste la pièce détaillée.                                                                                                            |
| **D4** | Un apporteur retiré du réseau avec de l'argent en jeu (mode restreint) voit-il « Mes commissions » ?                                  | **Oui, en lecture.** C'est son argent, et il reçoit déjà les e-mails d'argent (`GABARITS_ARGENT`). Un apporteur **résilié** n'a plus d'espace du tout (`etatDeLaPage` → neutre) : laissé tel quel, signalé au §7.                                               |
| **D5** | Montre-t-on un total (« versé en 2026 ») ?                                                                                            | **Non au lot 4.** Un total en tête de page se lit comme un compteur. Seul chiffre agrégé affiché : le virement à venir, qui est une dette d'Axion envers lui. Le total annuel (utile à sa déclaration) peut venir au lot 5, en bas de page, sans mise en avant. |
| **D6** | Durée du lien signé vers le PDF.                                                                                                      | `TTL_LECTURE_NOMINATIVE_S` (15 min), la constante partagée du dépôt. Voir §2.4.                                                                                                                                                                                 |

---

## 1. D'où vient chaque chiffre

### 1.1 Règle de conception

**Aucun appel à `calculerCommission`, `commandesSoldees`, `netDeLaCommande` ni `presentationPourEtablissement` depuis l'espace apporteur.** Ces fonctions décident ; elles tournent dans le passage quotidien et la console. La page lit leur résultat écrit en base. Verrouillé par une garde statique (§2.3, T7).

### 1.2 Table des sources

| Ce que l'apporteur lit                                | Source (colonne ou fonction existante)                                                                                                                                | Partagé avec la console par                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Nom de l'entreprise                                   | `presentations_entreprise.denomination` (ce qu'il a lui-même déclaré)                                                                                                 | même colonne                                                      |
| « Reçue le », « Gardée jusqu'au », « Non disponible » | `etatPourApporteur()` (`declaration-regles.ts`), déjà utilisée par `ListeDeclarations`                                                                                | fonction existante, inchangée                                     |
| « Validée le »                                        | `presentations_entreprise.confirmee_at` (à ajouter à `DeclarationVue`)                                                                                                | même colonne que la fiche console                                 |
| « Commande signée »                                   | journal des e-mails : `EmailLog` où `template = "apporteur-commande-signee"`, `entityType = "PresentationEntreprise"`, `entityId` = sa présentation, `sentAt` non nul | sans objet (la console n'affiche pas cet état)                    |
| « Payée par le client le »                            | existence de la ligne de commission ; date = `FactureFormation.paidAt`, repli `creeAt`                                                                                | le calcul `encaisseeAt` de `lireCommissions`, **extrait** (lot 2) |
| Prestation en attente, réalisée le                    | `etatPrestation()` (`prestation-presentation.ts`)                                                                                                                     | fonction existante, inchangée                                     |
| Montant de la commission (hors taxes)                 | `commissions_apporteur.montant_cents`, tel quel                                                                                                                       | même colonne                                                      |
| État de la commission                                 | **`etatCommission()`**, nouvelle fonction pure (lot 1)                                                                                                                | la console l'utilise à la place de ses conditions JSX             |
| Numéro et date de l'autofacture                       | `autofacture_numero`, `autofacture_emise_at` (repli `maj_at`, même repli que `lireCommissions.emissionAt`)                                                            | même repli, extrait                                               |
| Échéance de paiement                                  | `echeancePaiement(emission)` (`autofacture-donnees.ts`) : c'est la date imprimée sur le PDF                                                                           | `etatEcheances` de la console appelle la même fonction            |
| Virement à venir (toutes taxes comprises)             | `aVirerPartielCents()` par autofacture, via `lireVirementsAFaire()` **filtré par apporteur**                                                                          | même fonction, paramètre `apporteurId` ajouté (lot 2)             |
| « Versée le »                                         | `versee_at`                                                                                                                                                           | même colonne                                                      |
| Reprise, avoir                                        | ligne `statut = reprise`, `avoir_numero`, origine par `originesDesReprises()`                                                                                         | fonction existante                                                |
| Montant hors taxes et TVA                             | `totalTtcPieceCents(regimeTva, …)`                                                                                                                                    | fonction existante, celle du PDF                                  |

### 1.3 La fonction d'état unique (lot 1)

Nouveau module pur `src/features/apporteurs-reseau/etat-commission.ts` (aucun import serveur : la console, la page et le worker peuvent le lire).

```
etatCommission(ligne, maintenant) → { etat, depuis?, numero?, echeance?, motif? }
```

| État dérivé              | Condition (dans cet ordre)                                                                                                            | Aujourd'hui dans la console                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `annulee`                | `statut = annulee`                                                                                                                    | onglet « Annulées »                          |
| `retenue`                | `statut = retenue`                                                                                                                    | onglet « Retenues (manquement) »             |
| `reprise_a_deduire`      | `statut = reprise`, `releveMois` nul                                                                                                  | onglet « Reprises », sans avoir              |
| `reprise_deduite`        | `statut = reprise`, `releveMois` posé (avec `avoirNumero` s'il existe)                                                                | lien « avoir »                               |
| `sans_commission`        | `statut = versee`, `montantCents = 0`, `palier = "aucune-commission"`                                                                 | ligne close à 0 €                            |
| `compensee`              | `statut = versee` et `verseeAt` égal à `autofactureEmiseAt` (compensation, art. 12.4)                                                 | non distinguée                               |
| `versee`                 | `statut = versee`                                                                                                                     | onglet « Versées »                           |
| `a_preciser`             | `statut = a_qualifier` (sous-cas `hors_grille` si `palier = "hors-grille"`)                                                           | « Palier à choisir », « Activité à classer » |
| `en_attente_pieces`      | `statut = en_attente_vigilance`                                                                                                       | onglet « Attente vigilance »                 |
| `suspendue`              | `statut = due`, `litigeDepuis` posé                                                                                                   | badge de contestation                        |
| `en_attente_realisation` | `statut = due`, `prestationRealiseeAt` nul                                                                                            | « en attente de réalisation »                |
| `facturee`               | `statut = due`, `autofactureNumero` posé                                                                                              | « Dues (facturées) », échéances              |
| `en_attente_fiche`       | `statut = due`, pas d'autofacture, `autofactureAttenteMotif` posé (sous-cas `solde_negatif` au préfixe `PREFIXE_MOTIF_SOLDE_NEGATIF`) | « Autofacture en attente : il manque … »     |
| `due`                    | `statut = due`, réalisée, pas encore facturée (le passage horaire s'en charge)                                                        | implicite                                    |

Deux tables de libellés lisent cette fonction : celle de la console (inchangée à l'écran) et celle de l'apporteur (§4). **Un état, deux façons de le dire, un seul calcul.**

⚠️ Le cas `compensee` repose sur l'égalité `verseeAt === autofactureEmiseAt`, vraie parce que `facturerApporteur` écrit les deux avec le même `maintenant` dans la transaction d'émission. Elle doit être **verrouillée par un test dans `facturation-commissions.spec.ts`** au lot 1 ; si l'égalité paraît trop fragile à la relecture, on rend `versee` avec le libellé neutre « Réglée le … », qui est vrai dans les deux cas.

### 1.4 Ce qu'on entend par « relevé »

Depuis la décision du 06/10 (`facturation.ts`, en-tête), **il n'y a plus de relevé mensuel** : dès qu'une commission est due, une autofacture part. Le gabarit s'appelle encore `apporteur-releve` et la colonne `releve_mois` ne sert plus que de marqueur d'imputation. Les « relevés » à télécharger sont donc **les autofactures et leurs avoirs** : aucun autre PDF n'existe. La page elle-même tient lieu de relevé.

---

## 2. Cloisonnement, test IDOR, téléchargement des PDF

### 2.1 Modèle de menace

| Menace                                                                                                  | État actuel                                                                                       | Parade dans ce plan                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Lien d'un autre apporteur deviné                                                                        | Jeton HMAC-SHA256 de 43 caractères sur `id:versionLien`, comparé à temps constant (`jeton.ts`)    | Inchangé. La page et la route passent par `lireDossierParLien`, jamais par un contrôle recopié.                                       |
| **Numéro d'autofacture d'un autre** : la série `AXI-APP-AAAA-NNNN` est **séquentielle, donc devinable** | La route console lit le numéro seul (`findFirst` sans apporteur), protégée par la session admin   | La route apporteur exige `apporteurId = dossier.id` **dans le `where`**. C'est LE contrôle ; la limite de débit n'est qu'un frein.    |
| Clé R2 construite depuis l'adresse                                                                      | Clé = `apporteurs/autofactures/<apporteurId>/<numero>.pdf`                                        | `apporteurId` vient du dossier authentifié, `numero` d'une ligne relue en base. Rien de l'adresse n'entre dans la clé sans relecture. |
| Fuite par le parrainage (C2)                                                                            | Risque latent : aucune surface apporteur ne lit encore ces lignes                                 | Projection à liste blanche, garde `presentation.apporteurId`, test T5.                                                                |
| Fuite par une colonne de trop (motif de contestation du client, note interne, numéro de facture client) | `CommissionVue` de la console porte `litigeMotif`, `factureNumero`, `factureHtCents`, `apporteur` | Type `CommissionPourApporteur` à champs **énumérés** ; jamais de `...ligne`. Test T6.                                                 |
| Lien personnel transféré (chaque e-mail le porte)                                                       | Risque existant ; l'espace montre déjà identité et IBAN masqué                                    | Le risque **augmente** : la page montre de l'argent. Voir §2.5.                                                                       |
| Mise en cache partagée (Cloudflare) d'une page nominative                                               | Pages `force-dynamic`                                                                             | `Cache-Control: private, no-store` posé explicitement par la route ; à vérifier pour la page (§7).                                    |
| Fuite du lien par `Referer` vers R2 lors de la redirection                                              | `Referrer-Policy: same-origin` sur `/apporteur/dossier/:path*` (`next.config.ts`)                 | La nouvelle route reste **sous ce préfixe** pour hériter de l'en-tête ; `rel="noreferrer"` sur les liens en ceinture.                 |

### 2.2 Lecture cloisonnée (lot 2)

Nouveau module serveur `src/features/apporteurs-reseau/espace-commissions.ts` (`server-only` permis : il n'est lu ni par le worker ni par `commissions.ts`).

```
lireEspaceCommissions(dossier: { id, regimeTva }, maintenant) → EspaceCommissionsVue
```

Règles d'écriture, toutes testées :

1. **Chaque requête Prisma porte `apporteurId: dossier.id` dans son `where`**, ou un `id: { in: […] }` dont la liste sort d'une requête qui le portait.
2. La jointure vers la présentation sélectionne `apporteurId` ; le nom de l'entreprise n'est gardé que si `!ligne.parrainage && presentation.apporteurId === dossier.id`.
3. La sortie est un type à champs énumérés. Champs **interdits** : `factureId`, `factureNumero`, `factureHtCents`, `prixPublicHtCents`, `litigeMotif`, `prestationRealiseePar`, tout champ d'un autre apporteur, toute donnée de `CommandeAAttribuer`.
4. `dossier.id` vient de `lireDossierParLien` : la fonction ne prend **pas** un identifiant libre venu de l'adresse.

### 2.3 Tests de cloisonnement à écrire d'abord

| N°  | Test                                                                                                                                                                                                                         | Niveau                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| T1  | Jeton de A, identifiant de B dans l'adresse → 404 neutre, page et route                                                                                                                                                      | unité (Prisma simulé)                        |
| T2  | **IDOR** : lien valide de A, numéro d'une autofacture de B → 404, et `getSignedUrlR2` **n'est jamais appelée**                                                                                                               | unité, route                                 |
| T3  | Même réponse (statut, corps, en-têtes) pour « numéro d'un autre » et « numéro inexistant » : pas d'oracle                                                                                                                    | unité, route                                 |
| T4  | Numéro mal formé (`../`, encodé, trop long, minuscules) → 404 **sans requête en base**                                                                                                                                       | unité, route                                 |
| T5  | Parrain : sa page ne contient ni le nom de l'entreprise du filleul, ni le nom du filleul, ni l'activité, ni le palier                                                                                                        | unité, assemblage + rendu                    |
| T6  | Le rendu HTML de la page ne contient aucun des champs interdits (jeu de données portant des valeurs sentinelles dans chacun)                                                                                                 | unité, rendu                                 |
| T7  | Garde statique : aucun fichier sous `src/app/apporteur/dossier/[id]/[jeton]/` n'importe `@/lib/prisma`, `lireCommissions`, `lireVirementsAFaire` sans filtre, `lireFicheApporteur`, `calculerCommission`, `commandesSoldees` | `tests/unit/ci/`                             |
| T8  | Chaque appel Prisma de `lireEspaceCommissions` porte le filtre apporteur (client simulé qui enregistre les `where`)                                                                                                          | unité                                        |
| T9  | **Deux apporteurs sur une vraie base** : commissions, parrainage croisé, reprises, avoirs. La vue de A ne contient aucun identifiant, numéro ni nom de B                                                                     | intégration (`vitest.integration.config.ts`) |
| T10 | `versionLien` incrémentée (retrait, révocation) → 404 sur la page et la route                                                                                                                                                | unité                                        |
| T11 | La clé R2 demandée commence par `apporteurs/autofactures/<id de A>/`                                                                                                                                                         | unité, route                                 |
| T12 | Base factice (`stub.invalid`) : page et route rendent 404 sans requête (contrat ADR 0026)                                                                                                                                    | unité                                        |

### 2.4 Téléchargement des PDF (lot 3)

**État du stockage.** `genererPdfAutofacture` dépose chaque pièce sur R2 sous `apporteurs/autofactures/<apporteurId>/<numero>.pdf` (autofactures et avoirs, même série, même dossier). La console les sert en relisant les octets (`getObjectBufferR2`) derrière la session et le rôle de facturation.

**Conception retenue**, calquée sur `portail/mon-espace/documents/[id]/route.ts` :

```
GET /apporteur/dossier/<id>/<jeton>/factures/<numero>
  1. limite de débit par adresse hachée (30 par quart d'heure, « laisser-passer » sur panne Redis)
  2. numero conforme à /^AXI-APP-\d{4}-\d{4,}$/, sinon 404 sans requête
  3. dossier = lireDossierParLien(id, jeton), sinon 404
  4. ligne = findFirst({ apporteurId: dossier.id, OR: [{ autofactureNumero }, { avoirNumero }] }), sinon 404
  5. existsInR2(clé), sinon 404 (jamais la page d'erreur XML de R2)
  6. url = getSignedUrlR2(clé, TTL_LECTURE_NOMINATIVE_S, { fichier: { nom: numero + ".pdf", disposition } })
  7. 302 vers url, avec Cache-Control: private, no-store
```

Pourquoi une redirection et pas un lien signé écrit dans la page :

- la page n'a pas à signer N adresses à chaque affichage, dont la plupart ne seront jamais cliquées ;
- un lien signé écrit dans la page expire pendant que l'onglet reste ouvert, et l'apporteur clique sur un lien mort ;
- le contrôle d'appartenance est refait **au moment du clic**, pas au moment de l'affichage (un lien révoqué entre-temps ne sert plus).

Pourquoi 15 minutes et pas 60 secondes : c'est la constante partagée du dépôt pour une pièce nominative, et son commentaire interdit de la recopier avec une autre valeur « avec la meilleure intention ». Une durée plus courte casserait sans doute l'enregistrement du PDF sur téléphone, où le lecteur redemande l'adresse (non vérifié, §7). Si Will veut plus court, c'est une constante **nommée** de plus dans `r2-storage.ts`, pas un nombre dans la route.

Le lien signé R2 ne porte ni le jeton personnel ni l'identifiant du dossier dans sa partie lisible… sauf dans la clé (`apporteurs/autofactures/<apporteurId>/…`) : l'identifiant du dossier y apparaît. Il ne suffit pas à ouvrir l'espace (il faut le jeton), mais il est à noter.

### 2.5 Le lien personnel devient un accès à de l'argent

Le lien n'expire pas et figure au bas de chaque e-mail. Aujourd'hui, celui qui le détient voit l'identité, l'IBAN masqué, et peut déclarer une entreprise. Demain il verra les commissions et téléchargera des factures portant nom, adresse, SIRET et numéro de TVA (l'IBAN n'est **pas** imprimé sur l'autofacture, vérifié dans le gabarit).

Parades déjà en place : jeton non stocké, révocation par `versionLien`, `noindex`, `Referrer-Policy: same-origin`, CSP sans hôte tiers, adresse masquée chez Sentry (`sentry-pii-scrub.ts`).

À décider, sans bloquer le lot 4 :

- **accepter** le modèle actuel (recommandé pour le démarrage : la commande pose « lien personnel sans mot de passe ») ;
- ou, plus tard, **palier renforcé** pour l'argent seulement : « Mes commissions » demande un lien frais envoyé par e-mail (le gabarit `apporteur-lien-espace` et `fabriqueLienSigne` avec échéance existent déjà). C'est un lot à part.

---

## 3. Ce qu'on montre, ce qu'on ne montre pas

### 3.1 Ce que l'apporteur reçoit déjà aujourd'hui

| Support                    | Ce qu'il révèle                                                                                                                                                                                                                                                                                                                       | Ce qu'il ne dit pas                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| E-mail « commande signée » | Le **nom de l'entreprise**                                                                                                                                                                                                                                                                                                            | Aucun montant                                                     |
| E-mail `apporteur-releve`  | Total des commissions hors taxes, numéro d'autofacture, échéance à 30 jours, liste des avoirs (numéro, montant, autofacture rectifiée), somme virée                                                                                                                                                                                   | Aucun nom d'entreprise, aucun prix client                         |
| E-mail « virement fait »   | Montant viré, numéros, date                                                                                                                                                                                                                                                                                                           | Rien d'autre                                                      |
| **PDF d'autofacture**      | Son identité de facturation ; une ligne par commission : `Commission d'apport (<activité>) — palier <identifiant>[ × N sessions] — prix public X € HT, prix facturé Y € HT`. **Le prix hors taxes facturé au client y est imprimé** (formation : prix public et prix facturé ; conférence et activités au pourcentage : prix facturé) | **Le nom du client n'y figure pas**                               |
| PDF, ligne de parrainage   | « Parrainage (art. 4.6) » et un montant                                                                                                                                                                                                                                                                                               | Ni filleul, ni commande, ni prix (voulu, `designationCommission`) |
| PDF d'avoir                | « Reprise d'une commission d'apport déjà versée (art. 4.5) », renvoi à l'autofacture rectifiée                                                                                                                                                                                                                                        | Ni client, ni motif                                               |

**Réponse à la question posée.** Le relevé actuel (le PDF) communique déjà le prix négocié, ligne par ligne, mais **détaché du nom du client**. L'e-mail « commande signée » communique le nom, **détaché de tout montant**. Aucun support ne réunit aujourd'hui les deux. Pour une commission au pourcentage, la base se déduit de toute façon du montant ; pour une formation, le montant révèle seulement le rapport de remise.

Constat annexe, hors périmètre : la désignation imprime des identifiants techniques (`un_a_un`, `formation-generale-1j`) sur une pièce comptable. À corriger dans un lot à part, sans toucher aux pièces déjà émises.

### 3.2 Liste blanche de la page

**Montré** : nom de l'entreprise qu'il a déclarée ; état de la présentation et ses dates ; « commande signée » ; « payée par le client le » ; nature de la prestation **en clair** (libellé du palier ou de l'activité, jamais l'identifiant) ; commission hors taxes ; état ; numéro, date et échéance de son autofacture ; date de versement ; reprises et avoirs ; virement à venir.

**Jamais montré** :

- le prix facturé au client et le prix public, à côté d'une entreprise (D3) ;
- le numéro de la facture client, ses conditions de paiement, le détail acompte et solde ;
- le motif d'une contestation du client (`litigeMotif`) et les faits d'un manquement : il lit « suspendue », le détail lui a été écrit par e-mail ;
- **toute donnée d'un autre apporteur** : qui occupe une entreprise « non disponible », les candidats d'une commande à attribuer, l'identité d'un filleul ou d'un parrain ;
- une présentation démentie (règle existante de `etatPourApporteur` : « un litige ne s'affiche pas ») ;
- les notes internes, qui a marqué la prestation réalisée, les délais internes de gestion.

### 3.3 Ni promesse de gain, ni objectif, ni compteur

Règles d'écriture, verrouillées par un test de vocabulaire sur le fichier de textes et sur le rendu (lot 4) :

- **aucun montant avant qu'une ligne n'existe avec `montantCents` non nul.** « Commande signée » s'affiche sans chiffre : pas de « commission estimée », pas de « à venir : 500 € » ;
- aucun total en tête, aucun nombre d'entreprises présentées, aucun « ce mois-ci », aucune comparaison de périodes, aucune barre de progression. **En particulier, jamais de progression vers le seuil de vigilance de 5 000 €** ;
- aucun palier à atteindre, aucun rang, aucune félicitation, aucune incitation (« présentez-en d'autres ») sur cette page ;
- mots interdits dans les textes de la page : objectif, challenge, bravo, félicitations, gagnez, gagner plus, potentiel, classement, record, bonus, prime, performance, progression ;
- la page est un **état de compte** : des faits datés, au passé ou au présent.

---

## 4. Maquette textuelle

Page serveur, une colonne, lisible au téléphone, mêmes composants `Coquille` et styles que l'espace actuel. Montants toujours suivis de « hors taxes » en toutes lettres. Dates au format « 12 novembre 2026 ».

```
← Retour à mon espace

Mes commissions

┌──────────────────────────────────────────────────────────────┐
│ Virement à venir                                             │   (seulement s'il y en a un)
│ 600,00 € toutes taxes comprises                              │
│ Facture n° AXI-APP-2026-0014 du 18 novembre 2026             │
│ Échéance de paiement : 18 décembre 2026                      │
│ ↓ Télécharger la facture                                     │
└──────────────────────────────────────────────────────────────┘

Mes entreprises

┌──────────────────────────────────────────────────────────────┐
│ MENUISERIE DURAND                                            │
│ Présentée le 3 octobre 2026                                  │
│ Validée le 12 octobre 2026                                   │
│ Gardée pour vous jusqu'au 3 avril 2027                       │
│                                                              │
│ Commande du 2 novembre 2026                                  │
│   Commande signée                                            │
│   Payée par le client le 14 novembre 2026                    │
│   Prestation réalisée le 17 novembre 2026                    │
│   Formation générale, 1 jour                                 │
│   Commission : 500,00 € hors taxes                           │
│   ● Commission due · facture n° AXI-APP-2026-0014            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ GARAGE MARTIN                                                │
│ Présentée le 20 octobre 2026                                 │
│ Gardée pour vous jusqu'au 20 avril 2027                      │
│                                                              │
│   Commande signée                                            │
│   En attente du paiement du client                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ CABINET LEROY                                                │
│ Présentée le 8 novembre 2026                                 │
│ Reçue, nous l'étudions                                       │
└──────────────────────────────────────────────────────────────┘

Parrainage                                                        (seulement s'il y a des lignes)
  18 novembre 2026 · 50,00 € hors taxes · Versée le 20 novembre 2026

Mes factures et mes avoirs
  Facture n° AXI-APP-2026-0014 · 18 novembre 2026        ↓ Télécharger
  Avoir n° AXI-APP-2026-0011 · 2 novembre 2026           ↓ Télécharger
  Facture n° AXI-APP-2026-0007 · 9 octobre 2026          ↓ Télécharger

Comment lire cette page
  Votre commission est due quand le client a payé toute sa commande
  et que la prestation a eu lieu. Nous établissons alors la facture
  à votre nom et nous faisons le virement.
  Si le client est remboursé ou ne paie pas, la commission est reprise.
  → Voir la grille des commissions    → Télécharger mon contrat
```

### 4.1 Libellés des états, en français très simple

| État                              | Ce que l'apporteur lit                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Présentation à l'étude            | Reçue, nous l'étudions                                                                                                         |
| Sans réponse (délai de gestion)   | En attente d'une réponse. Nous revenons vers vous. _(libellé existant, sans délai cité)_                                       |
| Protégée                          | Gardée pour vous jusqu'au 3 avril 2027                                                                                         |
| Confirmée                         | Validée le 12 octobre 2026                                                                                                     |
| Non disponible                    | Non disponible. Nous vous avons écrit à ce sujet.                                                                              |
| Protection échue                  | Terminée le 3 avril 2027                                                                                                       |
| Commande signée, pas de ligne     | Commande signée · En attente du paiement du client                                                                             |
| `a_preciser`                      | Payée par le client. Montant en cours de calcul.                                                                               |
| `a_preciser`, hors grille         | Payée par le client. Ce produit ne figure pas dans votre grille : nous vous écrivons pour vous dire s'il donne une commission. |
| `en_attente_realisation`          | Payée par le client. La prestation n'a pas encore eu lieu.                                                                     |
| `en_attente_pieces`               | Commission acquise. Nous attendons vos deux documents pour la verser. → Déposer mes documents                                  |
| `en_attente_fiche`                | Il nous manque une information pour établir votre facture : _(ce qui manque)_. Écrivez-nous.                                   |
| `en_attente_fiche`, solde négatif | Une reprise reste à déduire avant le prochain versement.                                                                       |
| `suspendue`                       | Suspendue : le client conteste. Nous vous avons écrit à ce sujet.                                                              |
| `due`                             | Commission due. Votre facture arrive.                                                                                          |
| `facturee`                        | Commission due · facture n° … du … · échéance de paiement le …                                                                 |
| `versee`                          | Versée le 20 novembre 2026                                                                                                     |
| `compensee`                       | Réglée le 20 novembre 2026, par déduction d'une reprise                                                                        |
| `sans_commission`                 | Cette prestation ne donne pas de commission.                                                                                   |
| `reprise_a_deduire`               | Reprise de 500,00 € hors taxes : elle sera déduite de vos prochaines commissions.                                              |
| `reprise_deduite`                 | Reprise de 500,00 € hors taxes, déduite · avoir n° …                                                                           |
| `annulee`                         | Annulée                                                                                                                        |
| `retenue`                         | Retenue. Nous vous avons écrit à ce sujet.                                                                                     |

Tous ces textes vivent dans **un seul fichier** (`mes-commissions/textes.ts`), comme `textes.ts` et `textes-declaration.ts` aujourd'hui : c'est lui que le test de vocabulaire lit.

⚠️ « L'échéance de paiement » est la seule date d'avenir affichée, et c'est celle imprimée sur le PDF. **L'objectif interne de deux jours ouvrés n'est pas affiché** : ce serait une promesse, et la PR #2116 (ouverte, non lue : d'après son titre) retire ce délai de l'e-mail.

### 4.2 États vides

| Situation                                       | Écran                                                                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aucune entreprise présentée                     | « Vous n'avez pas encore présenté d'entreprise. » et le lien « Retour à mon espace ». Pas d'incitation.                                              |
| Des entreprises, aucune commande                | Les cartes d'entreprise seules. La section des factures affiche « Aucune facture pour l'instant. »                                                   |
| Dossier pas encore signé (en cours, à vérifier) | Le même écran sobre que la grille réservée (`EcranEtat`, pastille « Réservé »), sans aucun chiffre                                                   |
| Lien faux, révoqué, dossier refusé ou résilié   | La page neutre 404 existante : rien ne dit lequel                                                                                                    |
| Lien d'exemple de l'aperçu console              | L'écran d'exemple existant (`ID_DOSSIER_EXEMPLE`), jamais un 404                                                                                     |
| PDF absent du stockage                          | 404 neutre sur la route ; la ligne reste affichée. À surveiller par Sentry (`signalerErreurReseau`) : une facture sans pièce est une anomalie.       |
| Base ou stockage en panne                       | `error.tsx` existant de l'espace : « Réessayez dans un instant », sans détail technique                                                              |
| Plus de 100 présentations ou 300 lignes         | Borne de lecture ; mention « Les plus anciennes ne sont pas affichées. Écrivez-nous pour les obtenir. » La pagination viendra si le cas se présente. |

---

## 5. Performance et budget JS

### 5.1 Requêtes

Tout part de `dossier.id`. Aucune boucle ne lance de requête.

| N°  | Requête                                                                                                        | Index                                         |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1-4 | `lireDossierParLien` (existant : version du lien, retrait, dossier et pièces, SIRET)                           | clés primaires                                |
| 5   | présentations de l'apporteur, 100 au plus (`lireDeclarationsDe`, existant)                                     | `presentations_entreprise(apporteur_id)`      |
| 6   | commissions de l'apporteur, 300 au plus, colonnes énumérées, avec `presentation { denomination, apporteurId }` | `commissions_apporteur(apporteur_id, statut)` |
| 7   | factures : `paidAt` pour les `factureId` lus, **un seul `in`**                                                 | clé primaire                                  |
| 8   | origines des reprises (`originesDesReprises`, un `in`)                                                         | clé primaire                                  |
| 9   | journal des e-mails « commande signée » pour ses présentations, un `in`                                        | `EmailLog(entityType, entityId)`              |
| 10  | lignes suspendues par numéro (`suspenduesParNumero(apporteurId)`, existant)                                    | `commissions_apporteur(apporteur_id, statut)` |

Les requêtes 5 à 10 partent en un `Promise.all`. `lireDeclarationsDe` relit aujourd'hui les commissions des présentations (`lireCommissionsDesPresentations`) : au lot 2, la page lui passe les lignes de la requête 6 au lieu de les relire, pour ne pas lire deux fois la même table.

`realisationDisponible()` et `litigeDisponible()` (sondes de colonnes de la fenêtre app/worker) sont déjà mises en mémoire par leurs modules.

Pas de cache : page nominative, `force-dynamic`, `no-store`. Le volume par apporteur (quelques dizaines de lignes) ne le justifie pas.

### 5.2 Budget JS de la route

- **Zéro composant client.** La page est un composant serveur ; les téléchargements sont des liens `<a>`. Aucun `"use client"` nouveau, aucune bibliothèque de date ou de monnaie côté navigateur (`toLocaleDateString`, `euros()` tournent sur le serveur).
- Le JS de la route est donc le **shell partagé** (dette connue, cliquet 139 KB), plus un `page-*.js` de l'ordre de quelques centaines d'octets.
- Le cliquet concerné est **« Routes /apporteur/dossier — 25 KB cumulé »** (`.next/static/chunks/app/apporteur/**/page-*.js`). Il est **cumulé** sur l'espace entier : la nouvelle page y entre d'office.
- À mesurer au lot 4, en une passe (les octets sont déterministes) : `next build --experimental-build-mode compile`, puis `pnpm bundle:check`. Si le cliquet est dépassé, **STOP et demande à Will**, pas de relèvement en passant.
- LCP : texte seul, polices locales déjà préchargées par le layout. CLS : aucun contenu injecté après coup. INP : aucune interaction scriptée.
- La route PDF ne rend rien : une redirection.

La console n'est pas dans le budget Web Vitals ; le lot 1 y remplace des conditions par un appel de fonction, sans poids notable sur le cliquet admin (600 KB).

---

## 6. Découpage en lots

**Aucun lot ne porte de migration.** Aucune valeur d'énumération, aucune colonne, aucune forme de tâche BullMQ : la règle des deux versions en vol (app et worker) n'a rien à tolérer ici. Chaque PR s'ouvre en brouillon et ne passe « prête » qu'une fois, à la fin de son lot (`AGENTS.md`, CI-LOT1).

### Lot 0 — Décisions (aucun code)

D1 à D6 du §0. Seule D1 bloque, et seulement le lot 4.

### Lot 1 — La fonction d'état, et la console branchée dessus

- **Créés** : `src/features/apporteurs-reseau/etat-commission.ts` ; `__tests__/etat-commission.spec.ts`.
- **Modifiés** : `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/commissions/page.tsx` (ses conditions d'affichage appellent `etatCommission`) ; `__tests__/facturation-commissions.spec.ts` (verrou de l'égalité `verseeAt` / `autofactureEmiseAt` en compensation).
- **Tests d'abord** : table de vérité complète (7 statuts × litige × réalisée × facturée × motif d'attente × reprise imputée ou non) ; un test par état du §1.3 ; un test « l'ordre des conditions » (une ligne `due` suspendue ET non réalisée rend `suspendue`).
- **Critère de fusion** : l'écran de la console est **identique** avant et après (relecture visuelle par Will sur un jeu de lignes couvrant chaque onglet).
- **Conflits à prévoir** : PR #1417 (console alignée sur le contrat 2.7) touche la même page ; PR #2250 touche les imports de `commissions.ts` et `facturation.ts`.

### Lot 2 — La lecture cloisonnée (aucun écran)

- **Créés** : `espace-commissions.ts` (lecture, `server-only`) ; `espace-commissions-assemblage.ts` (pur : regroupe par entreprise, isole le parrainage, projette en liste blanche) ; leurs tests ; `tests/integration/…/espace-commissions-cloisonnement.spec.ts` (T9).
- **Modifiés** : `commissions.ts` (extraction de la projection `encaisseeAt` / `emissionAt` pour que la console et l'espace lisent le même repli) ; `facturation.ts` (`lireVirementsAFaire` accepte `{ apporteurId }`) ; `declaration-entreprise.ts` (`DeclarationVue` porte `confirmeeAt` ; accepte des lignes déjà lues).
- ⚠️ `commissions.ts` et `facturation.ts` sont atteints par le **worker** : aucun `server-only` n'y entre, et ils n'importent pas `espace-commissions.ts`. Garde existante : `le-worker-n-importe-pas-server-only.spec.ts`.
- **Tests d'abord** : T5, T6 (sur l'assemblage), T8, T9 ; « commande signée » lue seulement si l'e-mail est réellement parti (`sentAt` non nul, statut autre que `failed`) ; la somme « virement à venir » égale celle de `lireVirementsAFaire()` sans filtre pour ce même apporteur.

### Lot 3 — La route de téléchargement (dormante : aucun lien n'y mène)

- **Créés** : `src/app/apporteur/dossier/[id]/[jeton]/factures/[numero]/route.ts` ; `route.spec.ts`.
- **Modifiés** : aucun (le préfixe `/apporteur/dossier/` porte déjà les en-têtes et l'exclusion du proxy).
- **Tests d'abord** : T1, T2, T3, T4, T10, T11, T12 ; limite de débit ; disposition du fichier (`?dl=1`, comme la route du contrat) ; mode restreint selon D4.
- **Indépendant des lots 1 et 2** : peut fusionner le premier.

### Lot 4 — La page

- **Créés** : `src/app/apporteur/dossier/[id]/[jeton]/mes-commissions/page.tsx`, `textes.ts`, composants serveur de carte ; tests de rendu ; `tests/unit/ci/l-espace-commissions-ne-promet-rien.spec.ts` (vocabulaire interdit, aucun montant sans ligne, aucun total) ; garde statique T7.
- **Modifiés** : `page.tsx` de l'espace (un lien « Mes commissions », écran signé et, selon D4, mode restreint) ; `declaration-regles.ts` si D2 change le mot ; `le-mode-restreint-n-ouvre-que-la-vigilance.spec.ts` si D4 est oui.
- **Tests d'abord** : un test de rendu par état du §4.1 ; chaque état vide du §4.2 ; T5 et T6 sur le HTML rendu ; « commande signée » n'affiche aucun chiffre ; la page ne contient ni `factureHtCents` ni prix public.
- **Avant de passer « prête »** : mesure du poids (§5.2) ; parcours au téléphone ; relecture des textes par Will.
- **Dépend de** : lots 1, 2, 3, et D1.

### Lot 5 — Suites, facultatif

- Les e-mails d'argent (`apporteur-releve`, `apporteur-virement-fait`, `apporteur-commande-signee`) pointent vers « Mes commissions ». Le lien se calcule dans le gabarit à partir du lien d'espace déjà présent dans la charge : **aucun nouveau nom de gabarit, aucune nouvelle clé de charge**, donc rien à tolérer entre app et worker. À rebaser sur la PR #2116.
- Journal des téléchargements (qui a ouvert quelle pièce, quand), sur le modèle de `journaliserOuvertureDocument`. Demande une table : c'est le seul lot à migration, à traiter selon les règles app et worker d'`AGENTS.md`.
- Total versé dans l'année (D5), par la même requête que `lignesDas2Apporteurs`, filtrée.
- Libellés lisibles sur les lignes du PDF d'autofacture (§3.1).
- Palier d'accès renforcé pour l'argent (§2.5).

### Ordre de fusion

```
lot 3 (route, dormante)  ─┐
lot 1 (état + console)   ─┼─→ lot 2 (lecture) ─→ lot 4 (page) ─→ lot 5
D1 (grille)              ─┘                        ▲
                                                   └── bloqué par D1
```

Une fusion ne déclenche plus de mise en ligne (créneaux fixes) ; aucune de ces PR ne porte de contrat app et worker. Les PR ouvertes à surveiller : #2250, #1417, #1411, #2116, #2253, #2254 (cette dernière famille, « validation par rendez-vous », peut changer ce que « validée » veut dire : relire `etatPourApporteur` après leur fusion).

---

## 7. Ce qui n'a pas été vérifié

Rien n'a été exécuté : ni l'application, ni un test, ni un build. Aucun accès à la base de production, au stockage R2, aux journaux. Tout ce qui suit est donc une lecture de code, pas une mesure.

1. **L'écart de grille (C1).** Le contrat signé fait foi et son texte de référence est hors dépôt (`_APPORTEURS-DEMARRAGE-2026-10-05/CONTRAT-APPORTEUR-V2.md`). Je n'ai lu que `contrat-v2.ts` (version 2.6). Je n'ai trouvé nulle part dans le dépôt « mises en service », « ventes en une fois », ni une exclusion des abonnements, de l'hébergement ou des licences ; l'annexe A1.5 exclut le développement web, la maintenance et l'intervention sur demande. Je ne sais pas comment une facture de Journée IA est typée (`ActiviteFacturation` n'a pas de valeur pour elle) : si elle l'est en « formation » avec le palier d'un jour, le prorata sur un prix public de 1 900 € donnerait **392,10 €** pour 1 490 € facturés, et non 500 €. Calcul fait à la main sur la formule de `calculerCommission`, non exécuté.
2. **Les PR du contrat 2.7** (#1411, #1417) n'ont pas été lues : elles peuvent déjà traiter une partie de C1 ou de C5.
3. **Le poids de la route** n'est pas mesuré. « Quelques centaines d'octets » est une attente, pas un chiffre.
4. **`Cache-Control` de la page.** Le commentaire du layout dit que `next.config.ts` pose `no-store` sur `/apporteur/dossier/` ; le bloc que j'ai lu pose `Referrer-Policy`, `X-Robots-Tag` et la CSP, pas `Cache-Control`. À contrôler par `curl -sI` sur la prod avant le lot 4.
5. **La date « payée par le client ».** `factureId` d'une commission est la **dernière facture émise** de la commande, pas forcément la dernière payée : avec acompte et solde, `paidAt` peut précéder le paiement qui a réellement soldé la commande. La console a le même repli ; l'écart est de quelques jours au plus, mais c'est une date montrée à un tiers.
6. **« Commande signée » par le journal des e-mails.** Je n'ai pas vérifié la politique de la file (`outbox-policy.ts`) pour ce gabarit : s'il est retenu « à valider », l'état n'apparaîtra qu'après validation (voulu). Je n'ai pas vérifié non plus la durée de conservation de `EmailLog` : si le journal est purgé, l'état disparaît pour les commandes anciennes non payées.
7. **`annulee` et `retenue`.** Les libellés disent « nous vous avons écrit ». Je l'ai vérifié pour l'avoir client (`apporteur-commission-avoir-client`), la suspension et le manquement ; **pas pour chaque chemin d'annulation** (`ajustement.ts`, annulation à la main depuis la console). À vérifier avant d'écrire la phrase, sinon libellé nu « Annulée ».
8. **Les avoirs de neutralisation** (`manquement.ts`, `regenererAvoirsSansPiece`) : je suppose qu'ils sont déposés sous la même clé R2 que les autres ; non vérifié.
9. **Le suivi de clics du prestataire d'e-mail.** Si les liens des e-mails sont réécrits pour le suivi, le lien personnel transite par un tiers. Non vérifié ; déjà vrai aujourd'hui, plus sensible demain.
10. **La durée de 15 minutes** et le comportement des lecteurs PDF sur téléphone : affirmation de prudence, non testée.
11. **L'article 4.6 du contrat** (« aucun montant par filleul ») : le PDF imprime déjà une ligne et un montant par part de parrainage ; la page en fait autant. Si l'article impose un seul montant agrégé, PDF et page sont à revoir ensemble.
12. **Les volumes réels** (lignes par apporteur) : les bornes 100 et 300 sont reprises de l'existant ou posées par prudence.
13. **Le risque de requalification** : les règles du §3.3 appliquent la consigne de la commande. Elles ne valent pas avis juridique ; le texte final de la page mérite la relecture de la juriste qui a relu le contrat.
