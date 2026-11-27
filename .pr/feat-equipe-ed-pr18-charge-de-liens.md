# Équipe éditoriale, PR 18 : chargé de liens

## But

Ajouter le rôle « chargé de liens » (netlinking honnête) à l'équipe éditoriale. Pour chaque article publié, il propose au plus 5 occasions de liens réelles, avec un court message en français (vouvoiement, sobre, lien vers l'article, sans prix, sans promesse, sans nom de ville). Rien n'est envoyé : un humain valide ou écarte chaque occasion dans la console.

Tout est éteint par défaut derrière `CONTENT_EQUIPE_EDITORIALE` (actif seulement si la valeur vaut exactement `true`). Éteint : aucun appel payant, aucun changement.

## Conception (sous-agent Opus, lecture seule)

- **Stockage** : champ JSON existant `ContentGenJob.outputJsonRaw`, clé `chargeLiens`. Pas de table, pas de migration, `prisma/` intact.
- **Sources réelles trouvées dans le dépôt** : retombées presse `MediaCoverage` (au plus 2 par article), institutions des fiches locales (`ficheLocale`, catégories cci / technopole / french-tech / pôle, via les villes de l'article), pages qui citent déjà l'article (`ContentCitation` → `ExternalReference`).

## ⚠️ Point à trancher par Will (escalade partielle)

Le dépôt ne contient **aucune base de journalistes, de médias régionaux, d'annuaires ni de partenaires de liens**. Les « médias régionaux de la base existante » n'existent donc pas : seules les retombées presse déjà publiées sont utilisées. Les partenaires (`PartnersSyncOutbox`, `ApporteurReseau`) ne sont pas des partenaires de liens, ils ne sont pas utilisés. Aucune adresse ni aucun contact n'est inventé. Le contrôle d'opposition est prêt (`EmailOpposition`, liste de suppression prospection, `optOut` des personnes) mais aucune source n'apporte encore d'e-mail de contact : il n'est exercé que par les tests. Pour une vraie campagne presse, il faudra fournir une base de contacts (autre PR).

## Fichiers

- `src/server/content-gen/equipe/charge-de-liens.ts` : règles pures (sélection, plafond, message, états).
- `src/server/content-gen/equipe/charge-de-liens-donnees.ts` : accès base (candidats, oppositions, coût engagé, lecture/écriture sous verrou de ligne `FOR UPDATE`).
- `src/server/actions/content-gen/charge-liens.ts` : actions « Valider » (marque + rend le message à copier) et « Écarter ». Réservé aux rôles `admin` et `super_admin` (l'éditeur est refusé).
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/charge-liens/` : page console (liste par article, message, boutons).
- `src/server/queue/workers/content-refresh-worker.ts` : exécution dans la tâche hebdomadaire existante `liens-hebdo` (pas de nouveau champ de job), 20 articles au plus par passage, imports à la demande.
- Tests : `charge-de-liens.test.ts`, `charge-de-liens-donnees.test.ts`, `__tests__/charge-liens.spec.ts`.

## Garanties et tests

- Au plus 5 occasions par article ; un seul appel au modèle (marqueur Redis `SET NX` posé avant l'appel).
- Plafond 3,00 $ par article : somme du `CostLedger` du job + majorant de l'appel, refus avant tout appel.
- Aucune occasion inventée : adresses et cibles viennent des données ; le modèle ne rend que des messages, rejetés s'ils contiennent un prix, « Grenoble », une promesse, un tutoiement, une autre adresse, un échange/achat de liens ; repli sur un texte sobre sans second appel.
- Contact en opposition jamais proposé ; en cas de doute (lecture en échec), non proposé ; rien n'est supprimé.
- Aucun envoi : test qui vérifie l'absence d'import d'envoi. « Valider » ne fait que marquer.
- Interrupteur éteint : module, actions et worker inchangés (test du worker existant vert).
- Droits : lecteur, éditeur et absence de session refusés (action et page).

## Risques

- `content-gen-worker` (régénération) et `quality-improver` réécrivent `outputJsonRaw` en entier sans verrou : une écriture concurrente peut effacer `chargeLiens` (risque accepté, documenté dans le code). Le verrou ne protège que les décisions entre elles.
- Les mêmes 2 retombées presse récentes peuvent être proposées pour plusieurs articles (limité à 2 par article).
- La copie dans le presse-papiers peut être refusée par le navigateur après l'attente serveur : un message de repli s'affiche.
- Mise en ligne : aucun contrat app↔worker modifié (champ de job inchangé, JSON ajouté seulement).

VERDICT OPUS : BON
