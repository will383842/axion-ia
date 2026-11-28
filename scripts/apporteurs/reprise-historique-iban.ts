/**
 * REPRISE DE L'HISTORIQUE DES COMPTES des apporteurs (plan changement d'IBAN, §3.3, lot 9).
 *
 * Usage :
 *   pnpm tsx scripts/apporteurs/reprise-historique-iban.ts              # essai à blanc : compte, n'écrit rien
 *   pnpm tsx scripts/apporteurs/reprise-historique-iban.ts --appliquer  # écrit
 *
 * Ne modifie AUCUNE fiche ; rejouable sans effet (une fiche déjà reprise est sautée) ; n'affiche que des
 * comptes (jamais un IBAN). Variables requises : `DATABASE_URL`, `PII_ENCRYPTION_KEY`, `IBAN_EMPREINTE_SECRET`.
 * À lancer à la main, par une personne, depuis un clone du dépôt.
 */
import { reprendreHistoriqueIban } from "../../src/features/apporteurs-reseau/reprise-historique-iban";

const appliquer = process.argv.includes("--appliquer");
reprendreHistoriqueIban({ appliquer })
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    if (!appliquer) console.log("Essai à blanc : rien n'a été écrit. Relancer avec --appliquer.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Échec de la reprise :", e instanceof Error ? e.name : "inconnue");
    process.exit(1);
  });
