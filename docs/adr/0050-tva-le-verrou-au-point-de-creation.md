# ADR 0050 — TVA : l'ordre permanent passe du document au code, et le verrou est au point de CRÉATION

- **Statut** : **ACCEPTÉ** — tranché en session le 2026-09-06, sur instruction explicite de Will (« fais tout de bout en bout selon tes recommandations »)
- **Date** : 2026-09-06
- **Auteur** : Claude, en fermant le §11.1 de l'état vivant Qualiopi du 2026-09-05
- **Référence** : `src/server/qualiopi/legal/tva.ts`, `src/server/qualiopi/legal/tva.spec.ts`, `tests/unit/ci/la-tva-ne-peut-pas-tomber-a-zero.spec.ts`

## 1. L'ordre existait. Le code ne le faisait pas.

Ordre permanent de Will, consigné de longue date : **« TVA toujours facturée, jamais
d'exonération. »**

Le code disait autre chose. `exoneration_261` (art. 261-4-4° CGI) et `franchise_293b`
(art. 293 B CGI) étaient des chemins de **première classe** : le régime est relu depuis la
configuration `regime_tva` **à chaque émission**, sur huit sites, et un override par ligne
`tauxTvaPercent: 0` court-circuitait tout le reste.

Le défaut était bien `assujetti`, donc **rien de faux n'est parti**. Mais rien ne
l'empêchait — et l'asymétrie compte : **une facture émise fige son régime**. La corriger
après coup ne se fait pas par une modification, mais par un **avoir**.

🔑 C'est le même motif que trois autres défauts trouvés le même jour : **un écart entre ce
que le dépôt affirme et ce que le code fait**, invisible tant que personne ne le
déclenche.

## 2. La décision — verrouiller, sans porte dérobée

`regimeTvaApplique()` rend **toujours** `assujetti`. Un régime d'exonération passé en
entrée est **ignoré et journalisé**, jamais appliqué.

Trois conséquences, chacune sous témoin :

| Ce qui change                          | Avant         | Après                         |
| -------------------------------------- | ------------- | ----------------------------- |
| `tauxTvaLigne("exoneration_261", {})`  | `0`           | **`20`**                      |
| `tauxTvaLigne("assujetti", {taux: 0})` | `0`           | **`20`** (relevé, journalisé) |
| `mentionTvaKey("franchise_293b")`      | mention 293 B | **`null`**                    |

**Pas de drapeau d'environnement.** Un drapeau est une porte, et personne n'en a demandé
une : l'ordre est absolu. Le jour où l'attestation DREETS (Cerfa 3511) existe, le verrou
se lève **par un ADR et cette fonction** — pas par un réglage qu'un clic peut changer.

## 3. 🔑 Pourquoi le verrou est au point de CRÉATION — et pourquoi j'ai dû me corriger

**Le premier jet de cet ADR défendait l'inverse, et il avait tort.** Je le laisse écrit
plutôt que de le réécrire en silence : l'erreur est instructive et elle a failli falsifier
des documents opposables.

L'argument initial était : verrouiller à la **lecture** — les huit
`getQualiopiConfig("regime_tva")` — suppose de n'en oublier aucune aujourd'hui et à chaque
site ajouté demain ; verrouiller à l'**usage**, dans `tauxTvaLigne` et `mentionTvaKey`,
couvrirait tous les chemins par construction.

Séduisant, et faux. **Neuf tests existants l'ont dit** :

> Ces fonctions servent DEUX moments qu'elles ne peuvent pas distinguer : le calcul d'une
> pièce qu'on **crée**, et le **re-rendu** d'une pièce déjà émise.

Le verrou à l'usage réimprimait donc à 20 % une facture partie exonérée, et émettait un
avoir à 20 % contre elle. **Ce n'est pas empêcher un document futur, c'est falsifier un
document opposable** — et un avoir qui ne porte pas le régime de sa facture cesse de
l'annuler : les deux pièces restent au registre en se contredisant.

🔑 **La leçon dépasse la TVA.** Une valeur qui a deux cycles de vie — _choisie_, puis
_figée_ — ne se verrouille pas là où on la LIT, mais là où on la CHOISIT. Une fonction
pure partagée par la création et la reproduction ne peut pas porter la règle : elle ne
sait pas lequel des deux mondes l'appelle.

Le verrou vit donc en deux endroits, tous deux du côté de la **création** :

| Verrou                          | Ce qu'il protège                                            |
| ------------------------------- | ----------------------------------------------------------- |
| `regimeTvaDepuisConfig(valeur)` | le régime **choisi** — calculé, imprimé **et persisté**     |
| `clampTauxLigneCreation(...)`   | le taux de ligne **saisi** (`normaliserLignesPourActivite`) |

Et deux chemins restent **délibérément non verrouillés**, chacun avec sa justification
écrite au-dessus du code : l'avoir (`facture-libre.ts`) et le re-rendu d'une facture
(`financements.ts`). La garde de dépôt ne les épingle pas — mais elle exige que
l'exemption soit **déclarée** (mention `ADR 0050` dans le commentaire attenant), jamais
devinée. Sans cette exigence, elle aurait dû choisir entre sanctionner les exemptions
légitimes et laisser passer les vraies fautes, c'est-à-dire ne rien garder du tout.

⚠️ Ce que la persistance a appris en plus : le régime **enregistré** sur la facture doit
être celui réellement appliqué. Sans cela, une pièce serait née avec
`regimeTva: "exoneration_261"` **et** 20 % de TVA — le même document contradictoire qu'on
refuse à l'impression. C'est un invariant de test existant (`tvaExoneree ⇔ montantTvaCents
=== 0`) qui l'a trouvé.

## 4. La moitié discrète, et c'est elle qui était dangereuse

Le régime est **visible** : il est dans la configuration, un écran l'affiche, un audit le
lit. Un `tauxTvaPercent: 0` posé sur une ligne ne l'est **pas**. Il court-circuitait le
régime, le défaut, et toute lecture d'écran — **une exonération de fait, ligne par ligne,
que rien ne montrait**.

Le clamp vit dans `normaliserLignesPourActivite` — le normaliseur de lignes **de
création** — et pas dans `tauxTvaLigne`, pour la raison du §3. Il ne borne que **vers le
bas** : un taux inférieur au standard est relevé, un taux supérieur passe. Le verrou existe pour ne jamais **sous-facturer** la TVA, pas pour figer
un taux — les taux réduits (5,5 %, 10 %) restent atteignables s'ils s'appliquent un jour.
Un témoin dédié refuse qu'on « simplifie » le clamp en une égalité, ce qui les fermerait
sans que personne s'en aperçoive.

## 5. Ce que le verrou coûte, et qui est assumé

**La facture mixte disparaît.** Formation exonérée + conseil taxé sur la même pièce était
le seul usage légitime de l'override à 0 %. Elle suppose l'exonération, que l'ordre
permanent refuse : elle tombe avec elle.

Le test qui la décrivait n'a pas été supprimé — il a été **retourné**, et il dit où
reprendre : le jour où l'attestation DREETS existe, c'est lui qui redeviendra faux en
premier.

**Aucun avoir n'est dû.** La production était configurée en `assujetti` : le verrou ne
change aucune facture déjà émise, il empêche celles qui n'auraient pas dû l'être.

## 6. Ce qui a été rejeté

- **Un drapeau d'environnement `TVA_EXONERATION_AUTORISEE`.** Une porte que personne n'a
  demandée, et qu'un incident de configuration peut ouvrir. L'ordre est absolu ; le verrou
  doit l'être.
- **Supprimer les régimes d'exonération.** Ils sont juridiquement justes et documentés.
  Ce qu'on verrouille est leur **atteinte**, pas leur existence : les supprimer rendrait la
  levée future plus coûteuse qu'elle ne doit l'être, et effacerait un raisonnement fiscal
  correct.
- **Lever une exception plutôt que corriger.** Une facture en cours d'émission ne doit pas
  échouer sur un réglage. On corrige, **et on le dit** — un verrou muet laisserait croire
  que la configuration a été prise en compte.

## 7. Comment lever le verrou, le jour venu

1. Obtenir l'attestation DREETS (Cerfa 3511), NDA et BPF à jour ;
2. écrire l'ADR qui l'acte, avec la date d'effet ;
3. modifier `regimeTvaApplique` — et **elle seule** : `regimeTvaDepuisConfig` en dépend, et
   tous les sites de création passent par elle ;
4. retourner les témoins de `tva.spec.ts`, qui décrivent aujourd'hui le verrou ;
5. retirer `tests/unit/ci/la-tva-ne-peut-pas-tomber-a-zero.spec.ts`, qui refuse le
   contournement.

⚠️ Le régime des factures **déjà émises** ne se rétablit pas rétroactivement : elles ont
figé le leur, et c'est ce qui les rend opposables.
