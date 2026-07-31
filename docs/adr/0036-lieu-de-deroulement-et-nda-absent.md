# ADR 0036 — Lieu de déroulement réel, et NDA absent traité comme une situation régulière

- **Statut** : accepté
- **Date** : 2026-07-31
- **Contexte** : enregistrement du premier client réel (formation 4 h en intra) — les documents produits partaient chez le client et, à terme, dans le dossier de déclaration d'activité.

## Contexte

Deux défauts distincts sont apparus en préparant l'émission des pièces d'une session intra réelle. Ils n'ont pas la même nature, mais ils se manifestaient sur les mêmes documents.

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

## Décision

### Lieu de déroulement

1. **`src/server/qualiopi/lieu/lieu-input.ts`** — schéma zod + `normaliserLieu()`. La chaîne vide devient `null` (jamais `""` : deux représentations du vide en base finissent toujours par diverger) ; les clés absentes restent absentes, donc un formulaire partiel n'efface pas ce qu'il n'affiche pas. L'URL de visio est restreinte à `http(s)` — un `javascript:` ou un `data:` recopié dans une convocation envoyée par courriel n'est pas un lieu.
2. **Saisie** — `LieuFieldset` (composant contrôlé partagé) branché sur `SessionForm` (création simple **et** récurrente : une série se tient au même endroit) et sur un nouveau `SessionLieuForm` en fiche session.
3. **`setSessionLieuAction`** — première action de modification d'une session. Volontairement **sans verrou de statut** : corriger le lieu d'une session déjà réalisée doit rester possible, sinon on fige une erreur dans une pièce d'audit sans rien protéger. La traçabilité passe par le journal d'activité, qui enregistre l'avant et l'après.
4. **`resolveLieuDocument()` / `resolveLieuConvocation()`** — un seul point de décision, branché sur les six documents. Priorité au lieu réel ; **repli conservé** sur l'adresse de l'organisme quand aucun lieu n'est saisi (exact pour une formation dans nos locaux, et ne fait pas diverger les pièces déjà remises de celles réémises pour les mêmes sessions). La convocation reçoit `undefined` plutôt que « — » : une ligne « Lieu : — » est pire que pas de ligne.

### NDA

5. **`NdaFieldRow`** dans `base-layout.tsx` — la ligne disparaît tant que le numéro n'existe pas, et réapparaît partout dès qu'il est saisi, sans autre intervention. Appliqué aux onze gabarits concernés.

## Conséquences

- La convention, la convocation, l'émargement, le contrat, la tripartite et la lettre de mission portent le lieu réel de la session.
- Les documents d'un organisme non encore déclaré ne signalent plus l'absence de NDA comme un défaut ; le pied de page continue de la nommer et de citer l'article, **une** fois.
- Les documents **déjà générés ne sont pas régénérés** — un PDF émis est figé, et c'est voulu. Après correction d'un lieu, il faut réémettre la pièce ; `SessionLieuForm` le dit explicitement à l'écran.
- Aucune migration : les colonnes existaient déjà. Les sessions antérieures restent sans lieu et conservent le comportement d'avant jusqu'à saisie.

## Ce qui a été écarté

- **Faire du lieu un champ obligatoire.** Une session peut légitimement être créée avant que la salle ou le lien de visio soient connus. Bloquer la création aurait déplacé le problème sans le résoudre.
- **Supprimer le repli sur l'adresse de l'organisme.** Techniquement plus honnête, mais cela aurait modifié le rendu de toutes les sessions existantes, y compris celles dont les documents sont déjà entre les mains d'un client.
- **Une mention « déclaration en cours d'enregistrement » sur les documents.** Envisagée, écartée : elle affirmerait qu'un dossier a été déposé, ce qui est invérifiable depuis le code et faux tant que rien ne l'a été. Le pied de page existant constate l'absence et cite l'article — il dit ce qui est.

## Références

- Art. L.6351-1 C. trav. — déclaration d'activité dans les trois mois suivant la première convention
- Art. L.6352-4 C. trav. — mention du NDA sur les documents contractuels (exigible une fois le numéro obtenu)
- Art. L.6353-1 C. trav. — contenu de la convention, dont les conditions de déroulement
- Indicateur Qualiopi 9 — information du bénéficiaire sur les conditions de réalisation
- `src/server/qualiopi/documents/conformite.ts` — historique du retrait du NDA des champs bloquants (28-29/07/2026)
