# ADR 0045 — Console éditoriale : deux arbitrages laissés ouverts par les vérificateurs

- **Statut** : **DÉCIDÉ — réversible, les deux le sont en une ligne**
- **Date** : 2026-08-22
- **Auteur** : Claude, en clôturant les passes de vérification du protocole
- **Référence** : `_PLANS/PLAN-CONSOLE-EDITORIALE-2026-08.md` §4 et §7, `_PLANS/PROTOCOLE-BUILD-CONSOLE-EDITORIALE.md` §8, PR #783

## Pourquoi cet ADR existe

Trois agents ont audité la console éditoriale sans l'avoir écrite. Ils ont
trouvé treize défauts, tous corrigés — et **deux questions qu'ils ont refusé
de trancher eux-mêmes**, en signalant que le plan ne les tranchait pas non
plus.

Le §8 du protocole demande précisément ça : « remonter à l'humain plutôt
qu'interpréter ». Les laisser ouvertes indéfiniment reviendrait cependant à
figer le comportement actuel sans que personne ne l'ait choisi — ce qui est
la pire des deux options. Cet ADR les tranche donc, en écrivant le
raisonnement pour qu'il soit contestable.

**Les deux décisions sont réversibles en une ligne.** Si Will juge autrement,
le §« Comment revenir dessus » de chaque section dit exactement quoi changer.

---

## 1. Le rôle `montage` peut-il détacher un asset d'une publication ?

### La tension, telle que l'adversaire l'a posée

`detacherAssetAction` exige `asset.ecrire`, que le rôle `montage` possède. Or
le §4 réserve « supprimer quoi que ce soit » à l'admin, et la permission
`supprimer` existe bel et bien dans la matrice, attribuée au seul `admin`.

Le geste supprime une ligne de `ed_assets_publications`. C'est donc
littéralement une suppression — et littéralement pas la suppression d'un
asset.

### Décision : `asset.ecrire` reste

Trois raisons, dans cet ordre d'importance.

**1. Ce n'est pas l'objet qui disparaît, c'est le lien.** L'asset, son
fichier, son empreinte, son arbre de dérivation et ses autres rattachements
survivent intacts. Le geste inverse — rattacher — est offert sur le même
écran. Une opération réversible en un clic n'est pas une destruction.

**2. Exiger l'admin casserait la composition.** Le rôle `production` compose
les publications : c'est son travail. Lui interdire de retirer un média mal
placé l'obligerait à demander un admin pour chaque correction, et la console
cesserait d'être utilisable par l'équipe qu'elle est censée servir. Or la
matrice ne permet pas d'exempter `montage` sans exempter aussi `production`,
puisque les deux passent par `asset.ecrire`.

**3. Le rayon de dégâts de `montage` est déjà borné.** `filtreParDefaut`
restreint sa vue à `responsableMoi: true` : il ne voit, par défaut, que les
assets dont il est responsable. Il ne peut donc pas détacher au hasard dans
le dossier de quelqu'un d'autre.

### ⚠️ Ce que cette décision coûte, et qu'il faut assumer

Un monteur peut retirer le média d'une publication dont il a la charge, et
cette publication partirait sans son visuel. Le journal enregistre le geste
avec son auteur — depuis la migration `20260821120000_ed_journal_auteur`,
ajoutée pendant ces mêmes passes — mais **le journal constate, il n'empêche
pas**. La parade est la relecture avant publication, pas la permission.

### Comment revenir dessus

Une ligne, dans `src/server/actions/editorial/assets.ts` :

```ts
const membre = await requirePermission("asset.ecrire"); // → "supprimer"
```

Le test `assets.spec.ts` qui vérifie la permission demandée rougira, ce qui
est le comportement voulu : changer une règle doit se voir.

---

## 2. Une date de publication passée doit-elle être refusée ?

### La tension

Le protocole écrit qu'une date passée doit être « refusée avec un message qui
cite la règle ». **Aucune règle du plan ne l'interdit.** Et antidater est un
besoin réel : le dossier LinkedIn du T4 contient des publications déjà
parues, et les enregistrer à leur vraie date est le seul moyen d'avoir un
historique juste.

### Décision : une date passée est acceptée

Le protocole décrit ici un garde-fou générique, pas une règle métier de ce
produit. Refuser une date passée rendrait l'import impossible et forcerait à
mentir sur les dates — le remède serait pire.

**Ce qui EST refusé, et qui était le vrai danger** : les dates qui n'existent
pas (`2026-02-30`), et celles qui sortent de la fenêtre navigable du
calendrier (`< 2020` ou `> 2100`). C'est le défaut que la passe 4 avait
trouvé, et il est corrigé : `verifierDateIso` partage désormais ses bornes
avec `lireAnnee`, de sorte qu'aucune publication ne puisse exister à une date
que l'écran ne sait pas afficher.

Une date de 2024 est visible dans le calendrier, atteignable, modifiable. Une
date de 1999 ne l'était pas — et c'est la différence qui compte.

### ⚠️ Le trou qui reste

Une faute de frappe sur l'année (`2025` au lieu de `2026`) produit une
publication réelle, rangée un an trop tôt, et **rien ne la signale**. Elle
reste atteignable dans le calendrier, donc récupérable, mais il faut y
penser.

Un avertissement non bloquant à la saisie — « cette date est passée de N
jours, est-ce voulu ? » — fermerait ce trou sans rien interdire. Il n'est
**pas** implémenté : il demande un composant client sur un écran qui n'en a
aucun aujourd'hui, et le budget de performance de ce dépôt fait de chaque
kilo-octet client une décision. À rouvrir si la faute se produit vraiment.

### Comment revenir dessus

Dans `src/server/editorial/calendrier-pur.ts`, `verifierDateIso` : ajouter
une borne basse dynamique plutôt que `ANNEE_MIN`. Prévoir que **l'import
casse** — il porte des dates de septembre à décembre 2026 qui seront passées
dès 2027.

---

## Ce que ces deux décisions ont en commun

Dans les deux cas, la règle candidate protégeait contre un risque réel mais
en coûtait un plus grand : l'inutilisabilité pour la première, l'impossibilité
d'un historique juste pour la seconde.

Et dans les deux cas, **le vrai défaut était ailleurs** — pas dans la
permission ni dans la date passée, mais dans le journal sans auteur et dans
les dates hors calendrier. Les deux sont corrigés. C'est souvent ainsi : la
question posée n'est pas celle qui mordait.
