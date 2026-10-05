/**
 * Verrou — le bouton d'un e-mail d'invitation mène à la page de NOTRE site, et les
 * anciens liens Calendly continuent de fonctionner (2026-10-05).
 *
 * Deux garanties, une par défaut possible :
 *
 *  · le lien écrit dans l'e-mail est `…/fr/appel/apporteur` quand l'adresse reçue
 *    est celle de l'échange apporteur — sinon les invitations continueraient de
 *    renvoyer sur la page Calendly brute, hors de notre design ;
 *  · AUCUNE rupture : une adresse que l'on ne reconnaît pas (autre compte, autre
 *    événement, lien saisi à la main) est rendue TELLE QUELLE, et la charge utile
 *    en file garde l'adresse Calendly — les invitations déjà parties pointent
 *    toujours sur calendly.com, qui n'a pas bougé.
 */

import { beforeAll, afterEach, describe, expect, it } from "vitest";

import { renderEmailTemplate } from "@/lib/email/templates/index";
import type { EmailJobName } from "@/server/queue/types";
import { choixDeLUrlCalendly, lienDeReservationDuSite, lienDuSite } from "../lien-du-site";
import { liensInsertionComposeur } from "@/lib/imprimes/liens-email";

const CALENDLY_APPORTEUR = "https://calendly.com/axion-ia/echange-apporteur";
const SITE = "https://axion-ia.com";

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});
afterEach(() => {
  delete process.env.CALENDLY_APPORTEUR_URL;
  delete process.env.CALENDLY_SALON_URL;
});

describe("la traduction d'une adresse Calendly en page du site", () => {
  it("🔑 contre-témoin : l'échange apporteur devient `/fr/appel/apporteur`", () => {
    const lien = lienDeReservationDuSite(CALENDLY_APPORTEUR);
    expect(new URL(lien).pathname).toBe("/fr/appel/apporteur");
    expect(lien).not.toContain("calendly.com");
  });

  it("les quatre types se reconnaissent à leur adresse", () => {
    expect(choixDeLUrlCalendly("https://calendly.com/axion-ia/diagnostic-ia")).toBe("diagnostic");
    expect(choixDeLUrlCalendly("https://calendly.com/axion-ia/premier-contact")).toBe("projet");
    expect(choixDeLUrlCalendly(CALENDLY_APPORTEUR)).toBe("apporteur");
    expect(choixDeLUrlCalendly("https://calendly.com/axion-ia/rencontre-salon-gofab")).toBe(
      "salon",
    );
  });

  it("la casse, la barre finale et les paramètres n'y changent rien", () => {
    expect(choixDeLUrlCalendly("https://Calendly.com/Axion-IA/Echange-Apporteur/?x=1")).toBe(
      "apporteur",
    );
  });

  it("une variable d'environnement redéfinit l'adresse reconnue", () => {
    process.env.CALENDLY_APPORTEUR_URL = "https://calendly.com/axion-ia/echange-apporteur-15";
    expect(choixDeLUrlCalendly("https://calendly.com/axion-ia/echange-apporteur-15")).toBe(
      "apporteur",
    );
  });

  it("l'ancien défaut de l'échange apporteur reste reconnu", () => {
    expect(choixDeLUrlCalendly("https://calendly.com/axion-ia/echange-apporteur-affaires")).toBe(
      "apporteur",
    );
  });

  it("🔴 AUCUNE RUPTURE : une adresse inconnue est rendue telle quelle", () => {
    for (const url of [
      "https://calendly.com/axion-ia/un-autre-evenement",
      "https://calendly.com/un-autre-compte/echange-apporteur",
      "https://exemple.fr/echange-apporteur",
      "pas une adresse",
    ]) {
      expect(lienDeReservationDuSite(url)).toBe(url);
      expect(choixDeLUrlCalendly(url)).toBeNull();
    }
  });

  it("l'emplacement mesuré est nettoyé : minuscules, chiffres, tirets, rien d'autre", () => {
    expect(lienDuSite("apporteur", { origine: SITE, depuis: "email-invitation-apporteur" })).toBe(
      `${SITE}/fr/appel/apporteur?depuis=email-invitation-apporteur`,
    );
    expect(lienDuSite("apporteur", { origine: SITE, depuis: "<script>" })).toBe(
      `${SITE}/fr/appel/apporteur`,
    );
    expect(lienDuSite("salon", { origine: SITE })).toBe(`${SITE}/fr/appel/salon-gofab`);
  });

  it("les UTM de l'adresse d'origine suivent, rien d'autre", () => {
    const lien = lienDeReservationDuSite(
      `${CALENDLY_APPORTEUR}?utm_source=linkedin&utm_medium=post&name=Camille&email=c@x.fr`,
      { origine: SITE },
    );
    const u = new URL(lien);
    expect(u.searchParams.get("utm_source")).toBe("linkedin");
    expect(u.searchParams.get("utm_medium")).toBe("post");
    expect(u.searchParams.has("name")).toBe(false);
    expect(u.searchParams.has("email")).toBe(false);
  });
});

describe("🔑 les gabarits d'e-mail écrivent le lien du site", () => {
  const CHARGE = { contactName: "Camille Martin", calendlyUrl: CALENDLY_APPORTEUR };

  const CAS: ReadonlyArray<readonly [EmailJobName, Record<string, unknown>, string]> = [
    ["apporteur-invitation-appel", CHARGE, "email-invitation-apporteur"],
    ["apporteur-invitation-relance", { ...CHARGE, etape: "j3" }, "email-relance-apporteur"],
  ];

  it.each(CAS)("%s : le bouton mène à /fr/appel/apporteur", async (gabarit, charge, depuis) => {
    const r = await renderEmailTemplate(gabarit, "fr", charge, {
      destinataire: "camille@exemple.fr",
    });
    expect(r.html).toContain("/fr/appel/apporteur");
    expect(r.html).toContain(`depuis=${depuis}`);
    // Le lien Calendly brut ne figure plus dans le message.
    expect(r.html).not.toContain("calendly.com/axion-ia/echange-apporteur");
  });

  it("🔴 l'aperçu RECONSTITUÉ d'une invitation d'avant le 05/10 garde le lien Calendly brut", async () => {
    // Ces invitations sont parties avec le lien Calendly : montrer la page du site
    // serait montrer un message qui n'a pas été envoyé.
    const r = await renderEmailTemplate(
      "apporteur-invitation-appel",
      "fr",
      { ...CHARGE, lienBrut: true },
      { destinataire: "camille@exemple.fr" },
    );
    expect(r.html).toContain(CALENDLY_APPORTEUR);
    expect(r.html).not.toContain("/fr/appel/apporteur");
  });

  it("une adresse saisie à la main (autre événement) part TELLE QUELLE", async () => {
    const r = await renderEmailTemplate(
      "apporteur-invitation-appel",
      "fr",
      { contactName: "Camille", calendlyUrl: "https://calendly.com/axion-ia/mon-autre-lien" },
      { destinataire: "camille@exemple.fr" },
    );
    expect(r.html).toContain("calendly.com/axion-ia/mon-autre-lien");
    expect(r.html).not.toContain("/fr/appel/apporteur");
  });
});

describe("le composeur de réponse propose le lien du site", () => {
  it("le bouton « Réserver un échange » insère la page du site", () => {
    const liens = liensInsertionComposeur(CALENDLY_APPORTEUR);
    const lien = liens.find((l) => l.id === "calendly-echange");
    expect(lien?.url).toContain("/fr/appel/apporteur");
    expect(lien?.url).not.toContain("calendly.com");
  });

  it("sans lien Calendly valide, aucun bouton (inchangé)", () => {
    expect(liensInsertionComposeur(undefined).some((l) => l.id === "calendly-echange")).toBe(false);
    expect(
      liensInsertionComposeur("http://pas-calendly.fr/x").some((l) => l.id === "calendly-echange"),
    ).toBe(false);
  });
});
