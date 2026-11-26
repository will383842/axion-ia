# feat(hub): avertissement + confirmation avant un avoir sur une facture commissionnée

## Quoi

- `genererAvoirAction` refuse d'émettre un avoir quand la facture (ou une facture sœur du même devis) porte une commission d'apporteur non annulée, sauf si `confirmerReprise: true`. Message : « Cette facture porte une commission d'apporteur : un avoir la reprend au prorata. S'il s'agit d'un bon d'achat offert, ne l'émettez pas comme avoir. Cochez la confirmation pour un vrai remboursement. »
- Nouveau helper `factureCommissionneeParApporteur` (`src/server/qualiopi/financements/avoir-commission-apporteur.ts`), même périmètre que le garde-fou de `garanties-journee-ia.ts`.
- Page facture : calcul serveur au chargement ; le formulaire d'avoir n'affiche l'avertissement et la case que si la facture est concernée.

## Pourquoi

Un avoir du Hub sur une facture commissionnée fait reprendre la commission au prochain passage quotidien. Un bon d'achat offert ne doit pas la reprendre : il ne doit jamais être émis comme avoir du Hub. Rien n'avertissait l'émetteur.

## Hors périmètre

Décision « rembourser » des garanties, calcul des reprises et plafond : inchangés. Aucune migration. Aucun fichier interdit touché.

## Tests

`facturation-hub-avoir-commission.spec.ts` (écrit rouge d'abord, 3 échecs sur 5) : refus sans confirmation, émission avec confirmation, inchangé sans commission, commission annulée exclue (filtre `statut ≠ annulee`), sœur du même devis → refus. `facturation-hub*` : 52 verts. `pnpm lint` : 0 erreur. `tsc --noEmit` : OK (lancé avec `node --max-old-space-size=12000`, `pnpm typecheck` plante en OOM par défaut). `pnpm-lock.yaml` : inchangé.

## Tour 2 (verdict de l'audit : constats 1, 2, 3, 5)

- **Constat 1 (argent)** : `factureCommissionneeParApporteur` rend aussi `true` quand le client de la facture est couvert par une présentation d'apporteur protégée qui commissionnerait la commande, même sans ligne de commission. Réutilise la lecture du passage quotidien (`lirePresentationsProtegees`, désormais exportée, + `presentationPourEtablissement`) : aucun changement de comportement dans `passage-quotidien.ts` (un mot-clé `export`). « À attribuer » compte comme commissionnée. Texte : « … porte ou portera une commission d'apporteur ». Le calcul des commissions et des reprises n'est pas touché. Non répliqué : l'exclusion « développement web signé avant la date d'effet » (l'avertissement reste du côté sûr).
- **Constat 2** : le journal `facturation.avoir.emettre` enregistre `confirmerReprise` (booléen strict) dans `changes`.
- **Constat 3** : l'action renvoie `{ error, confirmationRequise: true }` ; le formulaire affiche alors la case de confirmation sans rechargement.
- **Constat 5** : spec serveur complété (présentation couvrante sans ligne, autre SIREN, « à attribuer », journal, facture sans devis, `avoirDeId: null`, avoir partiel, facture introuvable).
- **Constat 4** : gardé tel quel (aligné sur le garde-fou des garanties).
- Aucune migration ; `pnpm-lock.yaml` inchangé. Le garde-fou de `garanties-journee-ia.ts` garde la même limite (hors périmètre).
