/**
 * L'échange formateur indépendant se réserve sur NOTRE site, sans rien changer
 * aux quatre rendez-vous existants (lot F-CAL-1, 2026-10-09).
 *
 * 🔴 Le piège : `choixDuTypeRendezVous` rend la PREMIÈRE entrée de la table qui
 * porte le type demandé. L'entrée formateur est classée `autre` (l'enum Prisma
 * n'a pas de valeur « formateur », et ce lot ne migre rien) : elle ne doit
 * JAMAIS répondre pour `autre`, sinon un rendez-vous non classé se ferait
 * reprogrammer sur le calendrier formateur.
 */
import { afterEach, describe, it, expect } from "vitest";

import {
  CHOIX_PUBLICS,
  CHOIX_RENDEZ_VOUS,
  CHOIX_SANS_TYPE_PROPRE,
  TOUS_LES_CHOIX,
  choixDeLaRoute,
  choixDuTypeRendezVous,
  configDuChoix,
  TYPES_RESERVABLES,
  urlConfigureeDuChoix,
} from "../types-reservables";
import {
  URL_CALENDLY_APPORTEUR_PAR_DEFAUT,
  URL_CALENDLY_FORMATEUR_PAR_DEFAUT,
} from "../urls-par-defaut";
import { choixDeLUrlCalendly, lienDeReservationDuSite } from "@/lib/calendly/lien-du-site";

const URL_FORMATEUR = "https://calendly.com/axion-ia/echange-formateur-independant";

afterEach(() => {
  delete process.env.CALENDLY_FORMATEUR_URL;
});

describe("l'adresse par défaut", () => {
  it("calque de l'apporteur, sur le slug réel du compte", () => {
    expect(URL_CALENDLY_FORMATEUR_PAR_DEFAUT).toBe(URL_FORMATEUR);
    expect(URL_CALENDLY_APPORTEUR_PAR_DEFAUT).toBe(
      "https://calendly.com/axion-ia/echange-apporteur",
    );
  });

  it("la variable CALENDLY_FORMATEUR_URL l'emporte, lue à l'appel", () => {
    expect(urlConfigureeDuChoix("formateur")).toBe(URL_FORMATEUR);
    process.env.CALENDLY_FORMATEUR_URL = "https://calendly.com/autre/formateurs";
    expect(urlConfigureeDuChoix("formateur")).toBe("https://calendly.com/autre/formateurs");
  });
});

describe("la cinquième entrée", () => {
  it("existe, privée, classée « autre », en visio seulement", () => {
    expect(TOUS_LES_CHOIX).toContain("formateur");
    expect(CHOIX_SANS_TYPE_PROPRE).toEqual(["formateur"]);
    const c = configDuChoix("formateur");
    expect(c.route).toBe("formateur-independant");
    expect(c.type).toBe("autre");
    expect(c.public).toBe(false);
    expect(c.formats).toEqual(["visio"]);
    expect(c.variable).toBe("CALENDLY_FORMATEUR_URL");
  });

  it("le texte : « Échange formateur indépendant — 20 minutes en visio », sans « poste » ni « entretien »", () => {
    const c = configDuChoix("formateur");
    expect(c.titre).toBe("Échange formateur indépendant — 20 minutes en visio");
    const tout = [c.nom, c.titre, c.promesse, c.premiereEtape, c.deuxiemeEtape, c.troisiemeEtape]
      .join(" ")
      .toLowerCase();
    expect(tout).not.toMatch(/\bposte\b|entretien/);
    // Vouvoiement : aucun tutoiement.
    expect(tout).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/);
  });

  it("la route mène au choix", () => {
    expect(choixDeLaRoute("formateur-independant")).toBe("formateur");
  });
});

describe("les quatre entrées existantes ne bougent pas", () => {
  it("CHOIX_PUBLICS inchangé", () => {
    expect(CHOIX_PUBLICS).toEqual(["diagnostic", "projet"]);
  });

  it("CHOIX_RENDEZ_VOUS (les choix à type propre) inchangé, et en tête de TOUS_LES_CHOIX", () => {
    expect(CHOIX_RENDEZ_VOUS).toEqual(["diagnostic", "projet", "apporteur", "salon"]);
    expect(TOUS_LES_CHOIX).toEqual(["diagnostic", "projet", "apporteur", "salon", "formateur"]);
  });

  it.each([
    ["diagnostic", "diagnostic"],
    ["echange_projet", "projet"],
    ["apporteur", "apporteur"],
    ["salon", "salon"],
    ["autre", null],
    [null, null],
    ["formateur", null],
  ] as const)("choixDuTypeRendezVous(%s) → %s", (type, attendu) => {
    expect(choixDuTypeRendezVous(type)).toBe(attendu);
  });

  it("les routes des quatre", () => {
    expect(
      (["diagnostic", "projet", "apporteur", "salon"] as const).map(
        (c) => TYPES_RESERVABLES[c].route,
      ),
    ).toEqual(["diagnostic", "echange-projet", "apporteur", "salon-gofab"]);
  });
});

describe("le lien écrit dans un e-mail mène au calendrier maison", () => {
  it("l'adresse Calendly formateur → /fr/appel/formateur-independant?depuis=fa-…", () => {
    expect(choixDeLUrlCalendly(URL_FORMATEUR)).toBe("formateur");
    expect(
      lienDeReservationDuSite(URL_FORMATEUR, {
        depuis: "fa-invitation",
        origine: "https://axion-ia.com",
      }),
    ).toBe("https://axion-ia.com/fr/appel/formateur-independant?depuis=fa-invitation");
  });

  it("TÉMOIN — l'apporteur mène toujours à /fr/appel/apporteur", () => {
    expect(
      lienDeReservationDuSite(URL_CALENDLY_APPORTEUR_PAR_DEFAUT, {
        depuis: "email-invitation-apporteur",
        origine: "https://axion-ia.com",
      }),
    ).toBe("https://axion-ia.com/fr/appel/apporteur?depuis=email-invitation-apporteur");
  });
});

describe("le report d'un échange formateur reste sur le calendrier formateur", () => {
  it("classé autre, nommé formateur : l'adresse formateur, pas le type appel", async () => {
    const { urlDeReprogrammation } = await import("../choix-rendez-vous");
    delete process.env.CALENDLY_API_TOKEN;
    await expect(
      urlDeReprogrammation({
        typeRendezVous: "autre",
        eventTypeName: "Échange formateur indépendant (20 min)",
      }),
    ).resolves.toBe(URL_FORMATEUR);
  });

  it("TÉMOIN — classé autre, nom neutre : inchangé (type appel)", async () => {
    const { urlDeReprogrammation } = await import("../choix-rendez-vous");
    await expect(
      urlDeReprogrammation({ typeRendezVous: "autre", eventTypeName: "Rendez-vous perso" }),
    ).resolves.not.toBe(URL_FORMATEUR);
  });
});
