/**
 * CLIQUET — un rebond ne peut pas disparaître de l'écran qui le montre.
 *
 * ## Le défaut, et pourquoi il n'a rougi nulle part
 *
 * 🔴 2026-08-24 — LE STATUT ÉTAIT ÉCRIT, ET AUCUN ÉCRAN NE LE LISAIT.
 *
 * `EmailLogStatus.bounced` a été ajouté le 2026-08-20 avec le webhook ZeptoMail.
 * Son commentaire dans le schéma nomme lui-même l'enjeu :
 *
 *     un rebond dur était indiscernable d'une remise réussie : le relais
 *     acceptait le message (`sent`), le serveur destinataire le refusait
 *     ensuite, et rien ne revenait. Une convocation « envoyée » pouvait
 *     n'être jamais arrivée.
 *
 * Le webhook écrit bien `bounced`. Mais `admin-emails/query.ts` déclarait
 * `STATUTS = ["sent", "failed", "pending"]` — une liste écrite à la main, restée
 * à trois valeurs. Conséquence : aucun filtre ne proposait les rebonds, aucun
 * compteur ne les comptait. **Le défaut avait été corrigé à moitié : la donnée
 * arrive, personne ne la voit.**
 *
 * 🔑 C'est la forme récurrente de cette nuit — une notion introduite d'un côté et
 * oubliée sur son jumeau. Et c'est la seconde fois en une matinée qu'une LISTE
 * ÉNUMÉRÉE À LA MAIN prend du retard sur ce qu'elle prétend couvrir : le cliquet
 * du booléen d'envoi portait sept noms en dur et en a laissé passer un huitième.
 *
 * ## Ce que ce fichier garde
 *
 * Que la console couvre **toutes** les valeurs de l'énum, quelle qu'en soit la
 * liste. `STATUTS` est désormais DÉRIVÉ de `EmailLogStatus` : une cinquième
 * valeur sera couverte le jour de sa naissance. Ce test refuse le retour d'une
 * énumération manuelle, et vérifie que chaque statut a bien un compteur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EmailLogStatus } from "../../../../prisma/generated/client";

const QUERY = readFileSync(
  join(process.cwd(), "src", "features", "admin-emails", "query.ts"),
  "utf8",
);
const VUE = readFileSync(
  join(
    process.cwd(),
    "src",
    "app",
    "[locale]",
    "(admin)",
    "[adminPrefix]",
    "emails-envoyes",
    "_components",
    "VueEmails.tsx",
  ),
  "utf8",
);

describe("un rebond ne disparaît pas de l'écran", () => {
  it("l'énum porte bien `bounced` — sinon ce cliquet garde une règle imaginaire", () => {
    // Contre-témoin : si le statut disparaissait du schéma, tout ce qui suit
    // n'aurait plus d'objet et passerait au vert en ne gardant rien.
    expect(
      Object.values(EmailLogStatus),
      "`bounced` a disparu de `EmailLogStatus` : le webhook ZeptoMail n'a plus " +
        "où écrire un rebond, et ce cliquet ne garde plus rien",
    ).toContain("bounced");
  });

  it("`STATUTS` est DÉRIVÉ de l'énum, jamais énuméré à la main", () => {
    // 🔑 Le cœur du correctif. Une liste écrite à la main a laissé `bounced`
    // dehors pendant quatre jours ; une liste dérivée ne le peut pas.
    expect(
      QUERY,
      "`STATUTS` est redevenu une liste littérale. C'est exactement ainsi que " +
        "`bounced` est resté invisible : le statut existait, le webhook l'écrivait, " +
        "et la console ne le proposait dans aucun filtre. Écrire " +
        "`Object.values(EmailLogStatusEnum)`.",
    ).toMatch(/const STATUTS[^=]*=\s*Object\.values\(/);

    expect(
      QUERY,
      "une liste littérale de statuts subsiste dans `query.ts` : elle prendra du " +
        "retard sur l'énum au prochain ajout",
    ).not.toMatch(/const STATUTS[^=]*=\s*\[/);
  });

  it("chaque statut de l'énum a son compteur", () => {
    // `parStatut` est ce que l'écran affiche. Un statut sans compteur est un
    // statut que personne ne verra jamais, quelle que soit la donnée en base.
    const compteurs: Record<string, string> = {
      sent: "envoyes",
      failed: "echecs",
      pending: "enAttente",
      bounced: "rebonds",
    };
    const sansCompteur = Object.values(EmailLogStatus).filter(
      (s) => compteurs[s] === undefined || !QUERY.includes(`${compteurs[s]}: compte("${s}")`),
    );
    expect(
      sansCompteur,
      "statut(s) de `EmailLogStatus` sans compteur dans `parStatut`. Un statut " +
        "que la console ne compte pas est invisible à l'écran, quoi qu'il y ait " +
        "en base — c'est le défaut exact de `bounced`. Ajouter le compteur ET sa " +
        "correspondance dans ce test.",
    ).toEqual([]);
  });

  it("l'écran AFFICHE les rebonds, et permet de les filtrer", () => {
    // Un compteur calculé mais jamais rendu serait le même défaut d'un cran plus
    // loin. On exige la carte ET le lien de filtre : un rebond demande un geste
    // humain — corriger l'adresse — donc il faut pouvoir ouvrir la liste.
    expect(
      VUE,
      "la carte « Rebonds » a disparu de la console : le compteur existe, " + "personne ne le voit",
    ).toContain("parStatut.rebonds");

    expect(
      VUE,
      "le compteur de rebonds n'est plus cliquable : on sait qu'il y en a, on ne " +
        "peut pas savoir LESQUELS, donc pas corriger l'adresse",
    ).toMatch(/statut:\s*"bounced"/);
  });
});
