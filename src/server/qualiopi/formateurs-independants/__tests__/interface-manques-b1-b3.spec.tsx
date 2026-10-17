/**
 * Manques B1-B3 de la vérification d'interface (2026-10-17) : les écrans « pas encore
 * ouvert » nomment la clé, et les pages sans porte sont reliées.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EcranPasEncoreOuvert } from "@/components/admin/qualiopi/EcranPasEncoreOuvert";

import { liensAnnexes } from "../a-faire-maintenant";
import { INTERRUPTEURS_ENTREE, INTERRUPTEURS_SIGNATURE } from "../interrupteurs";

describe("écrans « pas encore ouvert »", () => {
  it("missions (B2) nomme l'interrupteur et mène à l'écran Interrupteurs", () => {
    const html = renderToStaticMarkup(
      <EcranPasEncoreOuvert
        titre="Missions"
        interrupteurs={[INTERRUPTEURS_SIGNATURE.missions_console.libelle]}
        base="/fr/p"
      />,
    );
    expect(html).toContain(INTERRUPTEURS_SIGNATURE.missions_console.libelle);
    expect(html).toContain("/fr/p/qualiopi/formateurs/interrupteurs");
  });
  it("virements à faire nomme l'interrupteur", () => {
    const html = renderToStaticMarkup(
      <EcranPasEncoreOuvert
        titre="Virements à faire"
        interrupteurs={[INTERRUPTEURS_ENTREE.virements_a_faire.libelle]}
        base="/fr/p"
      />,
    );
    expect(html).toContain(INTERRUPTEURS_ENTREE.virements_a_faire.libelle);
  });
});

describe("liens d'entrée", () => {
  it("B1 : « changements » n'est offert que si son interrupteur est allumé", () => {
    const sans = liensAnnexes("/fr/p", { suivi_echange: false, mise_a_niveau: false });
    const avec = liensAnnexes("/fr/p", {
      suivi_echange: false,
      mise_a_niveau: false,
      changement_coordonnees: true,
    });
    expect(sans.some((l) => l.href.endsWith("/changements"))).toBe(false);
    expect(avec.some((l) => l.href === "/fr/p/qualiopi/formateurs/changements")).toBe(true);
  });
  it("B3 : lieux et rattrapage sont toujours reliés", () => {
    const hrefs = liensAnnexes("/fr/p", { suivi_echange: false, mise_a_niveau: false }).map(
      (l) => l.href,
    );
    expect(hrefs).toContain("/fr/p/qualiopi/formateurs/lieux");
    expect(hrefs).toContain("/fr/p/qualiopi/formateurs/rattrapage");
  });
});
