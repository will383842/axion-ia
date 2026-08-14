# 2026-08-14 — CGV : régime des produits numériques

Suite directe de `2026-08-14_CGV-clauses-limitatives.md`. Les CGV renforcées le
matin même couvraient les prestations ; elles ignoraient totalement le **produit
numérique**.

## Le constat, mesuré

Comptage dans `src/content/legal.ts` avant ce patch :

| Terme                               | Occurrences                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `téléchargement` / `téléchargeable` | 0                                                                                            |
| `ebook`                             | 0                                                                                            |
| `L.221-28`                          | 0                                                                                            |
| `support physique`                  | 0                                                                                            |
| `durée d'accès`                     | 0                                                                                            |
| `numérique`                         | 5, **toutes sans rapport** (accessibilité numérique, empreinte numérique, outils numériques) |

## Le trou était plus large que « il manque une section »

Trois stipulations existantes rendaient une vente en ligne littéralement
inapplicable :

- **« Objet et champ d'application »** énumérait les prestations sans mentionner
  la vente de contenus. Un produit numérique n'était donc rattaché à aucun
  contrat.
- **« Devis et commande »** pose que « toute prestation fait l'objet d'un devis
  chiffré », signé avant que la commande soit ferme. Un achat en ligne n'a pas
  de devis.
- **« Annulation, report et remboursement »** calcule son barème « en jours
  ouvrés avant la date de début de la prestation ». Un fichier livré à la
  seconde du paiement n'a pas de date de début — la lecture littérale donnait
  « aucune somme n'est due » à plus de 15 jours, pour un fichier déjà
  téléchargé.

## Ce qui a été ajouté

Trois sections dédiées :

1. **Nature, livraison et accès** — absence de support matériel, format et
   volume, configuration requise et interopérabilité (art. L.111-1 C. conso.),
   livraison immédiate par lien après encaissement, durée d'accès bornée à
   12 mois à défaut d'indication, invitation à conserver son propre exemplaire.
   🔴 Prix **TTC** dès qu'un consommateur achète (art. L.112-1), alors que la
   section « Prix » raisonne en HT pour le B2B — sans cette précision,
   l'affichage boutique aurait contredit les CGV.
2. **Droit de rétractation et renonciation expresse** — le cœur du sujet.
3. **Garantie de conformité et remboursement** — barème à date écarté, garantie
   légale de conformité des contenus numériques (L.224-25-12 et s.) et vices
   cachés maintenus, remboursement par le même moyen de paiement.

Plus : `Objet` et `Définitions` mis à jour (« Produit numérique » défini), et
les deux délimitations ci-dessous.

## Les trois conditions qui font tenir la renonciation

L'art. L.221-28 13° n'exonère du délai de 14 jours que si l'exécution a commencé
après **accord préalable exprès** _et_ **renoncement exprès**. La case seule ne
suffit pas :

1. Elle doit être **distincte** de l'acceptation des CGV — une case globale
   « j'accepte tout » n'est pas un consentement exprès à la renonciation.
2. Elle ne doit pas être **pré-cochée**, et le consentement doit être
   **horodaté et conservé** : la preuve incombe au professionnel.
3. La confirmation sur **support durable** doit rappeler la renonciation
   (art. L.221-13), sinon le délai court malgré la case.

À défaut de recueil dans ces conditions, le texte dit explicitement que les
14 jours restent applicables — plutôt que de laisser un silence qui se plaide.

> ⚠️ **Aucun composant d'interface ne met ceci en œuvre**, et c'est volontaire :
> il n'existe à ce jour aucune route publique de paiement (`paiement`,
> `checkout`, `boutique`, `panier`, `commander`, `acheter` → aucune ; le Stripe
> Checkout existant est piloté depuis la console sur facture ou acompte). Une
> case reliée à aucun paiement ne prouverait rien. La section définit le régime ;
> la case naîtra avec le tunnel.

## 🔴 Le point dur : L.6353-6 ne se renonce pas

Pour une **formation** vendue à un particulier, l'interdiction de percevoir une
somme avant dix jours (art. L.6353-6 C. trav.) est d'ordre public. Aucune case à
cocher ne rend conforme un paiement immédiat. Autrement dit :

- tunnel à paiement immédiat pour un **fichier** → viable ;
- tunnel à paiement immédiat pour une **formation vendue à un consommateur** →
  structurellement non conforme.

Ce n'est pas un défaut de rédaction, c'est une limite légale. La délimitation
existait déjà, mais **implicitement** : elle tenait à la subordonnée « Lorsqu'une
formation est souscrite » de la section chapeau, pendant que les cinq sous-titres
annoncent « Particulier — … » et se lisent comme une règle générale. Elle est
désormais **dite dans les deux sens** : le régime formation ne régit pas le
numérique, et la renonciation numérique ne s'oppose pas à une formation.

## Le piège évité : rendre une phrase fausse

La section « Particulier — médiation de la consommation » affirme :

> « À ce jour, Axion-IA ne commercialise aucune prestation auprès de
> consommateurs et n'a donc pas adhéré à un dispositif de médiation. »

Ajouter un régime de vente aux particuliers **sans toucher à cette phrase**
l'aurait rendue fausse sur un support contractuel — exactement l'erreur que les
CGV se gardent de commettre ailleurs. L'engagement a donc été étendu : aucun
produit numérique ne sera vendu à un particulier avant l'adhésion à un médiateur
agréé, laquelle est une **obligation légale** (art. L.612-1), pas une option.

🔴 **C'est le vrai bloquant avant toute vente B2C**, au même titre que la case à
cocher.

## Le verrou consommateur, inversé

Les produits numériques renversent la logique du verrou : leur clause phare — la
renonciation — **vise** le consommateur et ne peut donc pas être neutralisée,
sinon elle ne sert plus à rien. Ce qui est verrouillé, c'est ce qu'elle ne doit
pas emporter avec elle : garantie légale de conformité et vices cachés, d'ordre
public. Une lecture « j'ai coché, je n'ai plus aucun recours » serait fausse et
abusive.

## Tests

`cgv-clauses-protectrices.spec.ts` passe de 23 à 32 cas. **Preuve par la rougeur
faite** : en retirant « non cochée par défaut » et l'extension de la médiation,
exactement les deux tests concernés tombent — et eux seuls. 79 tests verts sur
les quatre fichiers qui dépendent du contenu légal.

## Ce qui reste

- **Relecture avocat**, comme pour la forclusion 90 j et le plafond 12 mois.
- **Adhésion à un médiateur de la consommation** avant toute vente B2C.
- Le **composant de case à cocher** au moment du tunnel de vente, avec
  horodatage et conservation du consentement.
