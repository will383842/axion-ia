VERDICT: À CORRIGER

# Audit de la PR #2355 — avertissement avant un avoir du Hub sur une facture commissionnée

Relecture d'exactitude et audit argent, en lecture seule, de `origin/feat/hub-avoir-avertissement-commission` (commit `4e1815419`).

## Ce qui est vérifié et juste

- **Périmètre du helper** `factureCommissionneeParApporteur` : identique, ligne pour ligne, au garde-fou de `src/server/actions/qualiopi/garanties-journee-ia.ts` (l. 470-481) : facture d'origine + factures sœurs du même devis (`avoirDeId: null`), commissions `statut ≠ annulee`. Une facture sans devis ne lit que ses propres commissions ; une facture introuvable rend `false` et laisse `genererAvoirFacture` lever sa propre erreur.
- **Pas de contournement côté serveur** : le contrôle est dans `genererAvoirAction` (`src/server/actions/qualiopi/facturation-hub.ts:469`), après `requireHabilitation("facturer")` et la validation zod. `confirmerReprise` est un `z.boolean().optional()` : une chaîne `"true"` est refusée par zod, et seul `true` strict lève le refus. Un appel direct de l'action sans la case est donc refusé. La case est une confirmation, pas une habilitation : un utilisateur habilité « facturer » peut l'envoyer, c'est voulu.
- **Avoirs sans commission** : comportement inchangé (une lecture de plus, aucun refus). Avoir partiel : même contrôle que l'avoir total, ce qui est juste (l'avoir partiel reprend aussi au prorata).
- **Habilitations** : inchangées. Le calcul de la page n'est fait que si `peutEcrire && !estAvoir`.
- **TVA** : non touchée ; `genererAvoirFacture` est appelé avec les mêmes paramètres qu'avant.
- **Contrôles lancés** : `pnpm typecheck` vert (avec `NODE_OPTIONS=--max-old-space-size=12000`) ; `pnpm vitest run src/server/actions/qualiopi/facturation-hub` : 6 fichiers, 52 tests verts. `pnpm-lock.yaml` inchangé.
- **Les tests mordent** : retirer les factures sœurs du helper fait échouer « une facture sœur du même devis commissionnée refuse » ; retirer la condition `confirmerReprise` fait échouer le premier test ; changer le filtre de statut fait échouer le quatrième.

## Constats

1. **`src/server/qualiopi/financements/avoir-commission-apporteur.ts:20-25` — gravité HAUTE (argent).** Le helper ne voit que les commissions **déjà créées**. Or le passage quotidien ne crée la commission qu'une fois la commande payée, et la calcule **nette des avoirs** (`src/features/apporteurs-reseau/passage-quotidien.ts:1054-1064`, `commande.baseApresAvoirsCents`). Cas concret : facture d'acompte (ou facture pas encore soldée) d'une entreprise présentée par un apporteur ; l'émetteur fait un bon d'achat offert en avoir du Hub sur cette facture. Aucun avertissement (zéro ligne de commission à ce moment), et la commission créée plus tard est **diminuée en silence** — exactement ce que la règle interdit (un bon d'achat ne reprend pas la commission). C'est la fenêtre la plus fréquente, puisque toute commande est d'abord non soldée. Le garde-fou de `garanties-journee-ia.ts` a la même limite (hors périmètre de cette PR, mais même correctif).
   **Correctif proposé** : rendre aussi `true` quand le client de la facture (SIREN) est couvert par une présentation d'apporteur protégée qui commissionnerait la commande — réutiliser la lecture du passage quotidien (`lirePresentationsProtegees` + `presentationQuiCouvre` / `presentationPourEtablissement`, à exporter) plutôt que d'en écrire une seconde. Ajouter un test : aucune ligne de commission, présentation couvrante → refus sans confirmation. Adapter le texte : « … porte ou portera une commission d'apporteur ».

2. **`src/server/actions/qualiopi/facturation-hub.ts:482-489` — gravité MOYENNE (traçabilité).** Le journal `facturation.avoir.emettre` n'enregistre pas que la reprise a été confirmée. En cas de contestation d'un apporteur, rien ne prouve que l'émetteur a déclaré « vrai remboursement ».
   **Correctif proposé** : ajouter `confirmerReprise: parsed.data.confirmerReprise === true` dans `changes`, et un test qui le vérifie.

3. **`src/components/admin/qualiopi/FactureFormationActions.tsx:179` et `:441` — gravité BASSE (ergonomie).** `commissionApporteur` est calculé au chargement de la page. Si une commission est créée entre le chargement et le clic (passage quotidien), le serveur refuse avec « Cochez la confirmation… » alors que la case n'est pas affichée : l'émetteur est bloqué sans comprendre jusqu'à un rechargement.
   **Correctif proposé** : faire renvoyer par l'action un code distinct (ex. `{ error, confirmationRequise: true }`) et afficher la case dans ce cas ; à défaut, ajouter « rechargez la page » au message.

4. **`src/server/qualiopi/financements/avoir-commission-apporteur.ts:23` — gravité BASSE.** `statut ≠ annulee` compte aussi les lignes `reprise` et les lignes à montant nul, que la reprise (`avoir-client.ts`, `statut ∈ MODIFIABLES ∪ {versee}`, `montantCents > 0`) ignore. Effet : avertissement en trop (sûr, pas de perte d'argent). C'est le choix du garde-fou des garanties ; à garder tel quel si l'alignement sur celui-ci est voulu, sinon aligner sur le filtre de la reprise.

5. **`src/server/actions/qualiopi/facturation-hub-avoir-commission.spec.ts` — gravité BASSE (tests).** Non couverts : facture sans devis (pas de lecture des sœurs), facture introuvable, exclusion des avoirs parmi les sœurs (`avoirDeId: null` peut être retiré sans faire rougir un test), et avoir partiel avec commission. Le composant client (case, envoi conditionnel de `confirmerReprise`) n'a aucun test.
   **Correctif proposé** : ajouter ces trois cas au spec serveur (`findMany` non appelé quand `devisId` est nul ; `where` contient `avoirDeId: null` ; refus aussi avec `montantPartielHtCents`).

## Conclusion

Le code ajouté est exact et ne peut pas être contourné côté serveur ; aucune régression sur les avoirs sans commission, habilitations inchangées. Mais le garde-fou ne couvre pas le cas où la commission n'existe pas encore (constat 1), alors que l'avoir la diminuera quand même : la règle « un bon d'achat ne reprend jamais la commission » n'est donc protégée qu'une fois la commande soldée. À corriger (constats 1 et 2) avant fusion, ou à fusionner en connaissance de cause avec un suivi immédiat du constat 1.
