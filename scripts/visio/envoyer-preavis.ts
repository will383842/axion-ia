/**
 * PRÉAVIS aux clients actifs avant l'enregistrement des visioconférences
 * (chantier visio, PR 1 ; règle B3, ADR 0056).
 *
 * La logique vit dans `src/server/visio/preavis-envoi.ts` (testée) ; ce fichier
 * ne fait que lire ses arguments et imprimer des COMPTES — jamais une adresse.
 *
 * ## Usage
 *
 *   tsx scripts/visio/envoyer-preavis.ts              # À BLANC (défaut)
 *   tsx scripts/visio/envoyer-preavis.ts --dry-run    # idem, explicite
 *   tsx scripts/visio/envoyer-preavis.ts --envoyer    # met en file de VALIDATION
 *
 * 🔑 `--envoyer` n'envoie rien directement : chaque préavis est garé dans
 * « E-mails à valider » de la console. C'est Will qui le fait partir, après
 * l'avoir relu. La date d'effet (envoi + 30 jours) est calculée au moment où
 * il part vraiment.
 * 🔑 Rejouable : une adresse qui a déjà un préavis en attente, approuvé ou
 * envoyé n'en reçoit pas un second.
 *
 * ## Contre la production
 *
 * `scripts/` n'est pas dans l'image : on le dépose dans le conteneur WORKER le
 * temps de s'en servir (modèle `careers-offres-seed.yml`). Il n'importe que des
 * modules de `src/`, présents dans le worker.
 *
 *   docker exec <worker> mkdir -p /app/scripts/visio
 *   docker cp envoyer-preavis.ts <worker>:/app/scripts/visio/envoyer-preavis.ts
 *   docker exec <worker> node_modules/.bin/tsx /app/scripts/visio/envoyer-preavis.ts
 *   docker exec <worker> node_modules/.bin/tsx /app/scripts/visio/envoyer-preavis.ts --envoyer
 *   docker exec <worker> rm /app/scripts/visio/envoyer-preavis.ts
 */

import { envoyerPreavis, lireArgumentsPreavis } from "@/server/visio/preavis-envoi";

async function main(): Promise<void> {
  const args = lireArgumentsPreavis(process.argv.slice(2));
  if (args.erreur) {
    console.error(`✗ ${args.erreur} Rien n'a été fait.`);
    process.exit(1);
  }

  const b = await envoyerPreavis({ envoyer: args.envoyer });

  const mode = b.mode === "a-blanc" ? "À BLANC (rien mis en file)" : "MISE EN FILE DE VALIDATION";
  console.log(`Mode                                  : ${mode}`);
  console.log(`Clients actifs (règle B3)             : ${b.actifs}`);
  console.log(`  · destinataires (adresses distinctes) : ${b.destinataires}`);
  console.log(`  · sans adresse utilisable           : ${b.sansAdresse}`);
  console.log(`  · adresse partagée avec une autre fiche : ${b.adressesEnDouble}`);
  console.log(`  · préavis déjà dans la file         : ${b.dejaEnFile}`);

  if (b.mode === "a-blanc") {
    console.log("\nÀ blanc : AUCUNE mise en file. Relancer avec --envoyer pour agir.");
    return;
  }
  console.log("");
  console.log(`Garés dans « E-mails à valider »      : ${b.misEnFile}`);
  console.log(`Non garés                             : ${b.nonMisEnFile}`);
  if (b.nonMisEnFile > 0) {
    console.error("\n✗ Des préavis n'ont pas été garés : relancer (rejouable, sans doublon).");
    process.exit(1);
  }
}

void main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    // Jamais le message brut : il pourrait contenir une adresse.
    console.error(`✗ Échec : ${e instanceof Error ? e.name : "erreur inconnue"}`);
    process.exit(1);
  });
