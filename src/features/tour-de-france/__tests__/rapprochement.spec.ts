import { describe, expect, it } from "vitest";
import { statutAffiche } from "../rapprochement";

const rdv = new Set(["h-avec-rdv"]);

describe("rapprochement : « rendez-vous pris » est calculé à la lecture", () => {
  it("une demande reçue dont l'empreinte a un rendez-vous du Tour devient « rdv_pris »", () => {
    expect(statutAffiche({ statut: "recue", emailHash: "h-avec-rdv" }, rdv)).toBe("rdv_pris");
  });

  it("une demande relancée à la main avec rendez-vous devient aussi « rdv_pris »", () => {
    expect(statutAffiche({ statut: "relancee_main", emailHash: "h-avec-rdv" }, rdv)).toBe(
      "rdv_pris",
    );
  });

  it("sans rendez-vous, le statut stocké est gardé", () => {
    expect(statutAffiche({ statut: "recue", emailHash: "h-autre" }, rdv)).toBe("recue");
    expect(statutAffiche({ statut: "relancee_main", emailHash: "h-autre" }, rdv)).toBe(
      "relancee_main",
    );
  });

  it("une demande écartée ou effacée ne ressuscite jamais", () => {
    expect(statutAffiche({ statut: "ecartee", emailHash: "h-avec-rdv" }, rdv)).toBe("ecartee");
    expect(statutAffiche({ statut: "effacee_rgpd", emailHash: "h-avec-rdv" }, rdv)).toBe(
      "effacee_rgpd",
    );
  });

  it("sans empreinte (demande effacée), aucun rapprochement", () => {
    expect(statutAffiche({ statut: "recue", emailHash: null }, rdv)).toBe("recue");
  });

  it("un statut stocké inconnu vaut « recue »", () => {
    expect(statutAffiche({ statut: "n-importe-quoi", emailHash: "h-autre" }, rdv)).toBe("recue");
  });
});
