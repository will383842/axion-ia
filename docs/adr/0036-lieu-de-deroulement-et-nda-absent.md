# ADR 0036 — Documents de session : lieu réel, programme annexé, NDA absent traité comme une situation régulière

- **Statut** : accepté
- **Date** : 2026-07-31
- **Contexte** : enregistrement du premier client réel (formation 4 h en intra) — les documents produits partaient chez le client et, à terme, dans le dossier de déclaration d'activité.

## Contexte

Trois défauts distincts sont apparus en préparant l'émission des pièces d'une session intra réelle. Ils n'ont pas la même nature, mais ils se manifestaient sur les mêmes documents.

### 1. Le lieu de déroulement n'existait qu'à moitié

Le schéma portait déjà les colonnes `lieu_type`, `lieu_intitule`, `lieu_adresse`, `lieu_code_postal`, `lieu_ville`, `lieu_salle`, `lieu_visio_url` sur `TrainingSession`, et `src/server/qualiopi/lieu/format-lieu.ts` savait les rendre en une ligne lisible. Mais :

- **aucun écran ni aucune Server Action n'écrivait ces colonnes** — elles restaient NULL pour toutes les sessions ;
- les cinq documents qui impriment un lieu (convention, convention tripartite, contrat de formation, feuille d'émargement, lettre de mission) écrivaient en dur `identite.adresseExercice || identite.adresseSiege || "—"`, soit **l'adresse de l'organisme** ;
- la convocation déclarait un champ `lieu` optionnel que personne n'alimentait : le stagiaire recevait une convocation **sans adresse**.

Conséquence concrète : pour une formation donnée chez le client — le cas majoritaire en intra — la convention annonçait comme lieu de déroulement l'adresse d'Axion-IA. Le lieu est une condition de déroulement au sens de l'art. L.6353-1 et l'objet même de l'indicateur Qualiopi 9 (information du bénéficiaire sur les conditions de réalisation). Ce n'est pas une imprécision d'affichage : c'est une mention contractuelle fausse.

S'y ajoutait un défaut de conception plus large : **aucune action de modification de session n'existait**. `createSessionAction` et `transitionSessionAction` étaient les deux seules écritures. Une adresse mal saisie était donc définitive.

### 2. Le NDA absent était signalé comme une donnée manquante

Les 28 et 29 juillet 2026, le numéro de déclaration d'activité a cessé de déclasser convention, tripartite, contrat et facture en SPÉCIMEN (cf. commentaires de `conformite.ts`). Motif : l'art. L.6351-1 fait courir le délai de déclaration à compter de la conclusion de la **première convention de formation**. C'est donc cette convention qui ouvre le délai — au moment de l'émettre, l'organisme n'a légalement pas encore de numéro. Exiger le NDA revenait à demander le résultat avant la cause.

Le geste n'avait cependant été appliqué qu'au garde-fou. Dans le **corps** des documents, onze gabarits rendaient toujours le NDA en `FieldRow … required`, ce qui imprime « Non renseigné » en rouge. La pièce se contredisait : un pied de page expliquant posément que la déclaration n'est pas encore enregistrée, et vingt lignes plus haut un champ signalé manquant. C'est exactement le défaut corrigé pour la ligne « Certification Qualiopi » (F29), dans ces mêmes fichiers, pour le même motif.

### 3. La convention annexait un programme qui n'existait pas

La convention imprime depuis l'origine, en section « 5. Documents annexés » :

```
– Programme détaillé de la formation
– Règlement intérieur des stagiaires
– Conditions générales de vente (CGV)
```

Le règlement intérieur est générable, les CGV existent. **Le programme, non.** Vérification faite sur les quatre voies possibles : aucune valeur de `DocumentType` (25 types) ne le portait ; la page publique `/formations/[slug]` charge pourtant la formation entière mais ne rend pas `programmeDetaille` ; la fiche formation admin non plus ; le ZIP « dossier de session » n'empaquette que des documents générés.

Donc, pour les 22 formations du catalogue et depuis l'origine, la pièce contractuelle référençait une annexe que rien ne produisait.

L'enjeu est double : contractuel — une convention qui annexe un document inexistant — et réglementaire, le programme de l'action étant l'une des trois pièces exigées à l'appui de la déclaration d'activité (art. R.6351-5 C. trav.), avec la première convention signée et la liste des intervenants.

Le **contenu**, lui, existait déjà : `Formation.programmeDetaille` est peuplé par le moteur et figé dans le snapshot de la session. Seul le contenant manquait.

## Décision

### Lieu de déroulement

1. **`src/server/qualiopi/lieu/lieu-input.ts`** — schéma zod + `normaliserLieu()`. La chaîne vide devient `null` (jamais `""` : deux représentations du vide en base finissent toujours par diverger) ; les clés absentes restent absentes, donc un formulaire partiel n'efface pas ce qu'il n'affiche pas. L'URL de visio est restreinte à `http(s)` — un `javascript:` ou un `data:` recopié dans une convocation envoyée par courriel n'est pas un lieu.
2. **Saisie** — `LieuFieldset` (composant contrôlé partagé) branché sur `SessionForm` (création simple **et** récurrente : une série se tient au même endroit) et sur un nouveau `SessionLieuForm` en fiche session.
3. **`setSessionLieuAction`** — première action de modification d'une session. Volontairement **sans verrou de statut** : corriger le lieu d'une session déjà réalisée doit rester possible, sinon on fige une erreur dans une pièce d'audit sans rien protéger. La traçabilité passe par le journal d'activité, qui enregistre l'avant et l'après.
4. **`resolveLieuDocument()` / `resolveLieuConvocation()`** — un seul point de décision, branché sur les six documents. Priorité au lieu réel ; **repli conservé** sur l'adresse de l'organisme quand aucun lieu n'est saisi (exact pour une formation dans nos locaux, et ne fait pas diverger les pièces déjà remises de celles réémises pour les mêmes sessions). La convocation reçoit `undefined` plutôt que « — » : une ligne « Lieu : — » est pire que pas de ligne.

### NDA

5. **`NdaFieldRow`** dans `base-layout.tsx` — la ligne disparaît tant que le numéro n'existe pas, et réapparaît partout dès qu'il est saisi, sans autre intervention. Appliqué aux onze gabarits concernés.

### Programme de l'action

6. **Nouveau `DocumentType.programme`** (migration `20260731120000`, `ALTER TYPE … ADD VALUE IF NOT EXISTS` — l'entrypoint rejoue `migrate deploy` à chaque démarrage, la migration doit être ré-exécutable). Série de numérotation `document`, comme les autres pièces dont `documents_generes` est propriétaire.
7. **`programme-modules.ts`** — lecture défensive de `programmeDetaille`, qui porte **trois formes** vivantes en base : chaîne JSON sérialisée, tableau de modules (catalogue), objet `{ modules, contenuDetaille, … }` (moteur de contenu). Priorité à `contenuDetaille.modules`, plus fidèle à ce qui sera animé. Ne lève jamais : une donnée illisible produit une liste vide.
8. **`ProgrammeFormationPdf`** — six sections : identification, public et prérequis, objectifs, contenu, moyens, évaluation et sanction. Alimenté par `readFormationForDocs`, **la même source que la convention** : les deux pièces d'un dossier ne peuvent donc pas se contredire, et le programme reste celui de l'action telle que vendue si le catalogue est refondu.
9. **`readFormationForDocs` expose désormais `versionProgramme` et `certificationType`** — capturés dans le snapshot depuis l'origine, mais jamais rendus accessibles aux gabarits. La version est ce qu'un auditeur recoupe entre l'annexe et la convention.
10. **Bouton placé juste après « Convention de formation »** dans la console, pas en fin de grille : les deux se génèrent ensemble ou la première promet une pièce qui ne l'accompagne pas.

## Conséquences

- La convention, la convocation, l'émargement, le contrat, la tripartite et la lettre de mission portent le lieu réel de la session.
- Les documents d'un organisme non encore déclaré ne signalent plus l'absence de NDA comme un défaut ; le pied de page continue de la nommer et de citer l'article, **une** fois.
- Les documents **déjà générés ne sont pas régénérés** — un PDF émis est figé, et c'est voulu. Après correction d'un lieu, il faut réémettre la pièce ; `SessionLieuForm` le dit explicitement à l'écran.
- Aucune migration : les colonnes existaient déjà. Les sessions antérieures restent sans lieu et conservent le comportement d'avant jusqu'à saisie.

## Ce qui a été écarté

- **Faire du lieu un champ obligatoire.** Une session peut légitimement être créée avant que la salle ou le lien de visio soient connus. Bloquer la création aurait déplacé le problème sans le résoudre.
- **Supprimer le repli sur l'adresse de l'organisme.** Techniquement plus honnête, mais cela aurait modifié le rendu de toutes les sessions existantes, y compris celles dont les documents sont déjà entre les mains d'un client.
- **Une mention « déclaration en cours d'enregistrement » sur les documents.** Envisagée, écartée : elle affirmerait qu'un dossier a été déposé, ce qui est invérifiable depuis le code et faux tant que rien ne l'a été. Le pied de page existant constate l'absence et cite l'article — il dit ce qui est.
- **Faire du programme une section de la convention plutôt qu'une pièce séparée.** La convention l'annonce comme une annexe ; l'y intégrer aurait résolu le manque en changeant ce que la convention est. Et le programme circule seul — au dossier DREETS, chez un OPCO, en amont d'une vente — ce qu'une section ne permet pas.
- **Réutiliser `supports-service.toFormationInput` pour lire `programmeDetaille`.** Il traite déjà les trois formes, mais appartient à la chaîne pédagogique et peut évoluer pour ses propres raisons. Un document légal ne doit pas dépendre d'un module dont ce n'est pas le contrat.
- **Imprimer le total des durées de modules.** Écarté : il peut diverger de la durée contractuelle pour de bonnes raisons (découpage pédagogique), et l'afficher inviterait un auditeur à lire un écart contractuel là où il n'y en a pas. `totalDureeModulesMin` existe et reste disponible pour un contrôle interne, mais la pièce n'imprime que `dureeHeures`.

## Références

- Art. L.6351-1 C. trav. — déclaration d'activité dans les trois mois suivant la première convention
- Art. L.6352-4 C. trav. — mention du NDA sur les documents contractuels (exigible une fois le numéro obtenu)
- Art. L.6353-1 C. trav. — contenu de la convention, dont les conditions de déroulement
- Indicateur Qualiopi 9 — information du bénéficiaire sur les conditions de réalisation
- `src/server/qualiopi/documents/conformite.ts` — historique du retrait du NDA des champs bloquants (28-29/07/2026)
