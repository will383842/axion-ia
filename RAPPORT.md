# Rapport — Lot A2 : référentiel enrichi des 11 OPCO

Branche de code : `opco/a2-referentiel-opco` — tête `bd2e95e57996e8276637e09174d4b1ed20611ad3`.

## Ce qui est fait

- `OPCO_FICHES: Record<OpcoId, OpcoFiche>` dans `src/server/qualiopi/financements/opco-referentiel.ts` :
  7 champs par OPCO, chacun un `Fait<T> = { valeur, source, releveLe, aVerifier? }`.
- Fonctions pures : `dateLimiteDepotPourSession`, `dateLimiteFacturation`, `faitsAVerifier`.
- Rien d'importé : le module reste importable par `ClientBrancheForm.tsx` (composant client).
  `OPCO_LABELS` n'a pas changé. Pas de schéma Prisma ni de migration.
- Diff : 2 fichiers, +333 / −2.

## Fichiers

- `src/server/qualiopi/financements/opco-referentiel.ts` (+167)
- `src/server/qualiopi/financements/opco-referentiel.spec.ts` (+168, 20 tests ajoutés)

## ROUGE avant VERT

ROUGE — commit `8124e58d` (tests seuls) :

```
$ pnpm vitest run src/server/qualiopi/financements/opco-referentiel.spec.ts
 FAIL  src/server/qualiopi/financements/opco-referentiel.spec.ts
TypeError: Cannot read properties of undefined (reading 'atlas')
 ❯ src/server/qualiopi/financements/opco-referentiel.spec.ts:109:20
 Test Files  1 failed (1)
```

VERT — commit `bd2e95e5` :

```
$ pnpm vitest run src/server/qualiopi/financements/opco-referentiel.spec.ts
 ✓ src/server/qualiopi/financements/opco-referentiel.spec.ts (32 tests) 16ms
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

ESLint et Prettier passent sur les deux fichiers ; `tsc --noEmit` ne signale rien sur ces fichiers.

## ⚠️ Limite principale : aucune page d'OPCO n'a pu être ouverte

Le proxy de sortie de la session bloque (`EGRESS_BLOCKED` / `CONNECT 403`) akto.fr, opco-atlas.fr,
opcoep.fr, opco2i.fr, etc. Ni WebFetch ni curl n'ont pu lire une seule source. La confirmation
s'est faite uniquement par **extraits de recherche web** renvoyés sur les domaines officiels. Règle
appliquée :

- l'extrait cite le fait sur le domaine officiel → valeur gardée, sans `aVerifier` ;
- l'extrait ne le confirme pas → `null` + `aVerifier: true` (le relevé du chantier n'est **pas** recopié) ;
- **une seule exception** : le délai de facturation Atlas (90 jours), exigé comme témoin par la
  consigne mais non retrouvé dans l'extrait. Il est gardé avec `aVerifier: true` et apparaît
  dans `faitsAVerifier()`.

Résultat : 13 faits renseignés sur 77 ; 65 champs remontent dans `faitsAVerifier()` (64 null + Atlas 90 j).
Il faudra repasser les faits « non confirmés » ci-dessous depuis un poste qui a accès aux sites.

## Faits confirmés (relevés le 2026-10-03)

| OPCO | Champ | Valeur | Source |
| --- | --- | --- | --- |
| Atlas | modeDeDepotConstate | compte_adherent | https://www.opco-atlas.fr/conditions-generales.html (CG en vigueur au 04/02/2026 ; « déposer une demande de prise en charge dans son espace myAtlas Entreprise ») |
| OPCO EP | delaiFacturationJours | 30 | https://www.opcoep.fr/ressources/centre-ressources/juridique/conditions-generales-gestion-controle-opcoep.pdf (« au plus tard dans les 30 jours suivant la fin de l'action ») |
| Constructys | delaiDepotJours | 15 | https://www.constructys.fr/financer-vos-projets-de-formation/modalites-demandes-de-prise-charge/conditions-de-prise-en-charge-2/ |
| L'Opcommerce | dateLimiteDepot2026 | 2026-11-30 | https://www.lopcommerce.com/media/bsbnjydz/conditons-generales-gestion.pdf (¹) |
| L'Opcommerce | portailEntrepriseUrl | https://entreprise.lopcommerce.com/forconet/ | idem (¹) |
| OPCO Mobilités | dateLimiteDepot2026 | 2026-12-31 | https://www.opcomobilites.fr/actualites/detail/calendrier-de-prise-en-charge-des-actions-de-formation-rappels-importants (exception : 15/01/2027 pour un début entre le 15 et le 31/12/2026) |
| Ocapiat | delaiDepotJours | 0 | https://www.ocapiat.fr/wp-content/uploads/fiche-de-presentation-BOOST-COMPETENCES-OCAPIAT.pdf (dispositif Boost Compétences, < 50 salariés, uniquement) |
| Opco Santé, Uniformation | opcoHorsChampTva | true | https://www.akto.fr/content/uploads/2025/12/CPcommunOpcos_TVA.pdf (²) |
| les 9 autres | opcoHorsChampTva | false | idem (²) |

(¹) L'extrait de recherche reprenait ces deux faits parmi plusieurs PDF de lopcommerce.com ; je ne
peux pas garantir que ce soit ce PDF précis (CG mai 2026) qui les porte. À reconfirmer.
(²) Le PDF du communiqué n'a pas pu être ouvert. Le fait est corroboré par des sources secondaires
(https://www.marche-public.fr/contrats-publics/Formation-professionnelle-reforme-2026-tva-opco.htm,
dépêche AEF https://www.aefinfo.fr/depeche/743232) : communiqué commun du 22/12/2025, réforme
reportée au 1er/10/2026, Opco Santé et Uniformation non concernés.

## Faits non confirmés (laissés à null + aVerifier)

| OPCO | Champ | Relevé du chantier | Ce qu'a donné la vérification |
| --- | --- | --- | --- |
| Atlas | delaiFacturationJours | 90 | **gardé avec aVerifier** (témoin) ; « 3 mois » non retrouvé dans l'extrait |
| Atlas | portailEntrepriseUrl | myAtlas | URL exacte non trouvée |
| Atlas | delaiDepotJours | avant le début, réponse sous 29 j | l'extrait parle de 30 jours d'avance et de 20 jours de décision : contradiction, et un délai de réponse n'est pas un délai de dépôt minimum |
| Atlas | dateLimiteDepot2026 | 31/12 | non retrouvé |
| OPCO EP | delaiDepotJours | 30 | « 1 mois avant » non retrouvé |
| OPCO EP | portailOfUrl | https://messervicesenligne-of.opcoep.fr/ | l'extrait cite « messervicesenligne » comme point d'entrée unique, mais le domaine vu est `messervicesenligne.opcoep.fr` (sans `-of`) |
| OPCO 2i | modeDeDepotConstate | compte_adherent | Mon Compte 2i / API confirmés pour les factures, pas « dépôt par l'entreprise » |
| OPCO 2i | portailEntrepriseUrl | https://portail.opco2i.fr/ | non retrouvé |
| OPCO 2i | delaiFacturationJours | 120 | « 4 mois » non retrouvé (charte : https://www.opco2i.fr/wp-content/uploads/2026/04/opco2i-charte-qualite-et-politique-de-controle-juin-2026.pdf) |
| tous | autres champs | — | aucun relevé autorisé |

Hors consigne, non saisi : un extrait OPCO Mobilités indique une demande « au minimum un mois avant
le démarrage ». Pas dans la liste autorisée, donc laissé à null.

## Autres limites

- Les fonctions de date ajoutent ou retirent des multiples de 24 h (calcul en UTC). Avec une date
  à minuit heure de Paris, un passage d'heure d'été ou d'hiver décalerait le résultat d'une heure ;
  le jour calendaire en UTC est juste. Le futur écran devra formater la date en conséquence.
- `delaiDepotJours` d'Ocapiat ne vaut que pour Boost Compétences ; les autres dispositifs Ocapiat
  peuvent avoir d'autres règles.
- `dateLimiteDepot2026` est stockée mais n'entre pas dans `dateLimiteDepotPourSession` (la consigne
  dit « début − délai »).

## Corps de PR prêt à coller

```markdown
## Ce que fait cette PR

Ajoute au référentiel `opco-referentiel.ts` une fiche sourcée par OPCO (`OPCO_FICHES`) : portails
entreprise et OF, délai de dépôt, délai de facturation, date limite de dépôt 2026, hors champ TVA,
mode de dépôt. Chaque fait porte sa source (URL) et sa date de relevé (2026-10-03) ; un fait non
confirmé reste `null` et `aVerifier`. Trois fonctions pures : `dateLimiteDepotPourSession`,
`dateLimiteFacturation`, `faitsAVerifier` (pour un futur écran). TypeScript seul : pas de schéma
Prisma, pas de migration, aucun import serveur (le module est importé par `ClientBrancheForm.tsx`).
`OPCO_LABELS` est inchangé.

## ROUGE avant VERT

- `8124e58d` (tests seuls) : `TypeError: Cannot read properties of undefined (reading 'atlas')`, 1 fichier en échec.
- `bd2e95e5` : `opco-referentiel.spec.ts`, 32 tests passent.

## Attaque

- Chaque fait non null a une source http(s) et une date ISO ; chaque fait null est `aVerifier` (test).
- Atlas = `compte_adherent`, facturation Atlas = 90 j ; Opco Santé et Uniformation hors champ TVA, les 9 autres non (tests).
- Dates : Constructys au passage de l'année (début 10/01/2027 → dépôt au 26/12/2026), Atlas
  (fin 15/11/2026 → facturation au 13/02/2027), délai nul (Ocapiat), délai inconnu → `null`,
  date d'entrée non modifiée.
- `faitsAVerifier()` liste exactement les champs marqués.

## Limites

- Les sites des OPCO étaient bloqués par le proxy de la session : faits confirmés par extraits de
  recherche uniquement. 13 faits sur 77 sont renseignés ; les autres sont `null` et `aVerifier`.
- Facturation Atlas (90 j) gardée comme témoin mais marquée `aVerifier` (non retrouvée dans l'extrait).
- Portail OF d'OPCO EP et toutes les valeurs d'OPCO 2i non confirmés → `null`.
- Calcul de dates en jours de 24 h (UTC).
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
