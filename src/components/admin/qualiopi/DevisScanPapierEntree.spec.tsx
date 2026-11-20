/**
 * Entrée de l'écran « devis signé sur papier » : qui voit le bouton, dans quel état du devis.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import {
  DevisScanPapierEntree,
  libelleSignaturePapier,
  type EtatDevisPourScan,
} from "./DevisScanPapierEntree";

afterEach(cleanup);

const BOUTON = { name: "Verser le devis signé (scan PDF)" };
const ETAT: EtatDevisPourScan = {
  statut: "envoye",
  offre: null,
  offreSha256: null,
  documentGenereId: "doc-1",
  pieceType: "devis",
  pieceAnnulee: false,
  clientASigne: false,
};

function rendre(
  etat: Partial<EtatDevisPourScan>,
  role: string | null,
  signataireNom = "Jean Dupont",
) {
  return render(
    <DevisScanPapierEntree
      etat={{ ...ETAT, ...etat }}
      role={role}
      devisId="11111111-1111-4111-8111-111111111111"
      signataireNom={signataireNom}
      organismeNom="Axion-IA"
      validiteDepassee={null}
      verserAction={vi.fn()}
    />,
  );
}

describe("DevisScanPapierEntree", () => {
  it.each(["admin", "super_admin"])("%s voit le bouton sur un devis envoyé classique", (role) => {
    rendre({}, role);
    expect(screen.getByRole("button", BOUTON)).toBeTruthy();
  });

  it.each(["responsable_qualite", "secretaire", "editor", "reader", null])(
    "rôle %s : aucun bouton",
    (role) => {
      rendre({}, role);
      expect(screen.queryByRole("button", BOUTON)).toBeNull();
    },
  );

  it.each(["brouillon", "accepte", "refuse", "expire", "transforme_convention"])(
    "statut %s : aucun bouton",
    (statut) => {
      rendre({ statut }, "admin");
      expect(screen.queryByRole("button", BOUTON)).toBeNull();
    },
  );

  it.each([
    ["client déjà signé", { clientASigne: true }],
    ["aucune pièce", { documentGenereId: null }],
    ["pièce annulée", { pieceAnnulee: true }],
    ["pièce qui n'est pas un devis", { pieceType: "convention" }],
    ["type de pièce inconnu", { pieceType: null }],
    ["devis à formules (offre)", { offre: { v: 1 } }],
    ["devis à formules (empreinte)", { offreSha256: "abc" }],
  ])("%s : aucun bouton", (_nom, etat) => {
    rendre(etat, "admin");
    expect(screen.queryByRole("button", BOUTON)).toBeNull();
  });

  it("fiche sans nom de signataire : message, aucun bouton", () => {
    rendre({}, "admin", "  ");
    expect(screen.getByTestId("scan-papier-fiche-sans-nom")).toBeTruthy();
    expect(screen.queryByRole("button", BOUTON)).toBeNull();
  });

  it("libelleSignaturePapier dit papier et original conservé", () => {
    const t = libelleSignaturePapier(new Date("2026-11-20T10:05:00Z"), "Axion-IA");
    expect(t).toContain("signature manuscrite sur papier");
    expect(t).toContain("l'original est conservé par Axion-IA");
    expect(t).not.toContain("Signé le");
  });
});
