// @vitest-environment node
/**
 * La carte « À faire le point » de l'onglet Rendez-vous mène à « Après
 * l'appel » OU à « Pas d'enregistrement : note manuelle » (plan §3.13,
 * vérification V1-C2). Les décomptes de clics partent de cette carte.
 *
 *   · le composant rend les deux entrées, chacune un formulaire serveur vers
 *     `ouvrirApresLAppelAction`, avec le rendez-vous et la destination ;
 *   · la page les pose sur la carte « À faire le point » d'un rendez-vous
 *     CLIENT, et seulement pour les rôles du dossier (A2) — jamais sur un
 *     échange apporteur.
 *
 * Mutation qui fait rougir : retirer `<LiensApresLAppel` de `CartePoint`.
 * Angle mort : le décompte de clics lui-même se fait à la main, sur la
 * production (écrit dans la description de la PR).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/actions-rencontres", () => ({
  ouvrirApresLAppelAction: vi.fn(),
}));

import { LiensApresLAppel } from "@/components/admin/dossier-client/LiensApresLAppel";

const PAGE = "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx";

describe("la carte « À faire le point » mène à « Après l'appel » ou à la note", () => {
  it("les deux entrées, avec le rendez-vous et la destination", () => {
    const html = renderToStaticMarkup(LiensApresLAppel({ calendlyEventId: "evt_42" }));
    expect(html).toContain("Après l&#x27;appel");
    expect(html).toContain("Pas d&#x27;enregistrement : note manuelle");
    expect(html.match(/name="calendlyEventId" value="evt_42"/g)).toHaveLength(2);
    expect(html).toContain('name="vers" value="apres"');
    expect(html).toContain('name="vers" value="note"');
  });

  it("la page les pose sur la carte « À faire le point », pour les rôles du dossier", () => {
    const src = readFileSync(join(process.cwd(), PAGE), "utf8");
    const carte = src.slice(src.indexOf("function CartePoint("), src.indexOf("function Chiffre("));
    expect(carte).toContain("<LiensApresLAppel calendlyEventId={r.id} />");
    expect(carte).toContain("dossierVisible && estTypeDuDossier(r.titre) ?");
    // Jamais sur un échange apporteur : les liens sont dans la branche client.
    const apporteur = carte.indexOf("<IssueEchangeApporteurForm");
    const liens = carte.indexOf("<LiensApresLAppel");
    expect(apporteur).toBeGreaterThan(-1);
    expect(liens).toBeGreaterThan(apporteur);
    expect(src).toContain("const voitDossier = peutVoirLesEchanges(acces.role);");
  });
});
