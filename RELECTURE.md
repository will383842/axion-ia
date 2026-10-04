# CONTRE-RELECTURE A09 — correctif du lot A8c (`c95cf601f`)

Branche relue : `opco/a8c-deux-circuits-paiement` @ `c95cf601`. Refus initial : `relectures/opco-a8c:RELECTURE.md` (défaut n° 1 EXACTITUDE, réserve RGPD P1).
Lentilles : **EXACTITUDE** et **SÉCURITÉ** (argent, RGPD). Relecture ciblée sur les 4 fichiers du correctif. Aucun code modifié.

## Commandes lancées

- `pnpm install` : OK. `DATABASE_URL=…stub.invalid… pnpm prisma:generate` : OK.
- `pnpm typecheck` : **OK** (0 erreur).
- `pnpm vitest run src/server/qualiopi/financements/ src/server/actions/qualiopi/subrogation-reventile-creances.spec.ts src/server/actions/qualiopi/` : **122 fichiers, 1 779 verts, 🔴 1 ÉCHEC**.

```
FAIL  src/server/qualiopi/financements/transmission-remboursement-opco.spec.ts
  > preparerTransmissionRemboursementOpco > remboursement, facture payée → e-mail à l'ENTREPRISE, garé, facture + certificat joints
  "pieces": [
    "Facture AXI-FACT-2026-210 (acquittée)",
-   "Certificat de réalisation",
  ]
```

Le même fichier passe à `c3c845b0` (6/6). **L'échec vient du correctif.** Voir le défaut S-1.

---

## (1) Un dossier dont une créance est facturée n'est plus reventilé — **OK**

`dossier-financement.ts:434-450`. Le `select` lit `payeurs` filtrés sur `factureFormationId: { not: null }` (`take: 1`). Un dossier est engagé si son statut n'est pas reventilable **ou** s'il a au moins une créance facturée. Il part alors dans `engages` et `continue` : ni `reventilerPayeurs`, ni écriture du drapeau `subrogation`.

- Le statut ne compte plus : `a_monter`, `envoye`, `accord_recu` et `refuse` avec une créance facturée sont tous engagés. Les scénarios A et B du refus initial sont fermés.
- Avertissement : `financements.ts:389-394`. `engages.length > 0` affiche « Le dossier de financement est déjà facturé… émettez un avoir… ». Témoin ajouté : « `accord_recu` portant DÉJÀ une créance facturée → engagé, aucune créance recréée », vert.
- Une créance n'est jamais détachée de sa facture, même après un avoir. Le dossier reste donc engagé après un avoir, et l'avertissement donne la bonne marche à suivre (refacturer le bon débiteur). C'est le comportement voulu.

Hors périmètre, antérieur au lot : la transition manuelle vers `accord_recu` / `refuse` (`dossier-financement.ts:225-227`) reventile toujours, même avec une créance facturée. Elle ne change pas de circuit, donc `engageFinanceur` retire bien la part déjà facturée. Ce n'est pas le défaut n° 1.

## (2) Aucun cas légitime bloqué — **OK**

Un dossier sans créance facturée (`payeurs: []`) dans un statut reventilable est toujours réaligné. Les témoins « cocher → créance `opco_subroge` + reste à charge » et « décocher → une seule créance du total à l'entreprise » passent avec `payeurs: []`. Le filtre `where` sur la relation ne compte que les lignes facturées. Une créance libre (ex. à 0 €) ne bloque donc rien.

## (3) Facture par inscription : seules les pièces de son stagiaire — **OK sur le code**, 🔴 suite rouge (S-1)

`pieces-facturation-opco-lecture.ts:117-120, 165-168` et `actions/qualiopi/pieces-facturation-opco.ts:62-68`.

Témoin de relecture local (non poussé, retiré). Mocks du spec de transmission. Documents : certificats `C-1` (t1) et `C-2` (t2), relevés `R-2` (t2) et `R-0` (sans stagiaire).

```
SESSION null      [ 'C-1', 'C-2', 'R-0', 'R-2' ]          ← facture de session : inchangée
INSCR   t1        [ 'C-1' ]                                ← inscription : son stagiaire seul
MAIL    ["AXI-FACT-2026-210.pdf","C-1.pdf"]                ← e-mail de remboursement : même chargeur, même filtre
VIDE    __aucun__ []                                       ← inscription sans stagiaire lisible : rien joint
```

- Le tirage d'émargement de toute la session n'est rendu que si `perimetreStagiaireId === null`. Sur une facture par inscription, le ZIP n'en contient pas. L'e-mail n'a jamais joint de tirage (`transmission-remboursement-opco.ts`, en-tête). Il passe par `chargerPiecesFacturation`, donc par le même filtre.
- Un relevé sans `traineeId` est exclu en mode inscription. C'est le sens prudent.
- La sentinelle `"__aucun__"` ne peut correspondre à aucun `traineeId` (uuid). Le filtre est fermé par défaut.

## (4) Typage du ternaire `{ ok: false as const }` — **OK**

`tsc --noEmit` passe. L'expression a le type `TirageEmargementAJour | { ok: false }`. `if (tirage.ok)` réduit le type à la branche `ok: true`, la seule qui porte `buffer` et `mention`. La variable n'est pas annotée, donc l'absence de `message` ne pose pas de problème.

---

## 🔴 Défaut S-1 (bloquant pour la fusion) — le correctif rend la suite rouge

`pieces-facturation-opco-lecture.ts:119`. `f.enrollmentId === null ? null : …`. Le fixture `facture()` de `transmission-remboursement-opco.spec.ts:42-84` n'a pas de champ `enrollmentId`. Il vaut donc `undefined`, le périmètre devient `"__aucun__"`, et le certificat est filtré. En production, Prisma rend toujours `null` sur un champ sélectionné : **le comportement réel est juste**, et l'erreur est fermée par défaut (sens RGPD sûr). Mais la PR ne peut pas passer la CI, et le correctif n'a ajouté **aucun témoin** du filtre par stagiaire, alors que c'était l'objet de la réserve P1.

**Correctif (petit) :**

1. Ajouter `enrollmentId: null, enrollment: null` au fixture `facture()` de `transmission-remboursement-opco.spec.ts`.
2. Ajouter les témoins « facture par inscription → seul le certificat de son stagiaire (ZIP et e-mail) », « inscription sans stagiaire → aucune pièce » et « inscription → aucun tirage d'émargement rendu » (`rendreTirageEmargementAJour` non appelé).

## Petit point (non bloquant)

- **P-a** — Sur une facture par inscription, le ZIP liste « Feuille d'émargement » parmi les pièces manquantes, sans dire pourquoi. L'admin peut croire à une panne de tirage. On peut ajouter une mention comme « non jointe : facture par inscription, le tirage couvre toute la session ».

---

## Verdicts

- **EXACTITUDE : `accepte`** — le défaut n° 1 est corrigé. Tout dossier dont une créance porte `factureFormationId` est engagé quel que soit son statut, n'est jamais reventilé, et l'avertissement s'affiche (témoin vert). Les dossiers sans facture sont toujours réalignés. Le typage est OK.
- **SÉCURITÉ : `refuse`** — la logique RGPD est juste et fermée par défaut (vérifiée par un témoin : ZIP et e-mail ne joignent que le stagiaire de l'inscription, pas de tirage de session, rien sans stagiaire lisible). Mais le correctif fait échouer `transmission-remboursement-opco.spec.ts` (1 test rouge, vert avant) et n'ajoute aucun témoin du filtre. À fusionner dès que le fixture est complété et les témoins ajoutés (S-1).
