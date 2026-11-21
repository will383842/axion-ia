import { describe, it, expect, vi } from "vitest";
import { cloreVersionRemplacee, VersionRemplaceeSigneeEntreTempsError } from "./version-remplacee";

type Appel = string;

function fabriquerTx(opts: {
  ligne: { statut: string }[];
  updateCount?: number;
  countNonSigne?: number;
}) {
  const appels: Appel[] = [];
  const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
    appels.push(`queryRaw:${strings.join("?")}`);
    return opts.ligne;
  });
  const updateMany = vi.fn(async () => {
    appels.push("devis.updateMany");
    return { count: opts.updateCount ?? 1 };
  });
  const count = vi.fn(async () => {
    appels.push("devis.count");
    return opts.countNonSigne ?? 1;
  });
  const tokenUpdateMany = vi.fn(async () => {
    appels.push("token.updateMany");
    return { count: 1 };
  });
  const tx = {
    $queryRaw: queryRaw,
    devis: { updateMany, count },
    documentSignatureToken: { updateMany: tokenUpdateMany },
  };
  return { tx: tx as never, appels, queryRaw, updateMany, count, tokenUpdateMany };
}

const base = {
  replacesDevisId: "11111111-1111-4111-8111-111111111111",
  documentGenereIdRemplace: "22222222-2222-4222-8222-222222222222",
  numero: "DEV-2",
};

describe("cloreVersionRemplacee — verrou de ligne et statut frais", () => {
  it("verrouille_la_ligne_avant_toute_ecriture", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "envoye" }] });
    await cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "envoye" });
    expect(m.appels[0]).toContain("FOR NO KEY UPDATE");
    expect(m.appels.indexOf("devis.updateMany")).toBeGreaterThan(0);
  });

  it("statut_frais_envoye_alors_que_statutRemplace_dit_expire_passe_expire", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "envoye" }] });
    await cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "expire" });
    expect(m.updateMany).toHaveBeenCalledTimes(1);
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statut: "expire" } }),
    );
  });

  it("statut_frais_expire_non_signe_aucune_ecriture_de_statut_jetons_revoques", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "expire" }], countNonSigne: 1 });
    await cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "envoye" });
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.count).toHaveBeenCalledTimes(1);
    expect(m.tokenUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("statut_frais_expire_signe_par_le_client_leve", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "expire" }], countNonSigne: 0 });
    await expect(
      cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "expire" }),
    ).rejects.toBeInstanceOf(VersionRemplaceeSigneeEntreTempsError);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("statut_frais_accepte_leve", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "accepte" }] });
    await expect(
      cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "envoye" }),
    ).rejects.toBeInstanceOf(VersionRemplaceeSigneeEntreTempsError);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("statut_frais_transforme_convention_leve", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "transforme_convention" }] });
    await expect(
      cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "expire" }),
    ).rejects.toBeInstanceOf(VersionRemplaceeSigneeEntreTempsError);
  });

  it("statut_frais_refuse_laisse_tel_quel", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "refuse" }] });
    await cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "envoye" });
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.count).not.toHaveBeenCalled();
  });

  it("ligne_absente_ne_leve_pas", async () => {
    const m = fabriquerTx({ ligne: [] });
    await expect(
      cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "envoye" }),
    ).resolves.toBeUndefined();
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("envoye_mais_updateMany_0_leve", async () => {
    const m = fabriquerTx({ ligne: [{ statut: "envoye" }], updateCount: 0 });
    await expect(
      cloreVersionRemplacee(m.tx, { ...base, statutRemplace: "envoye" }),
    ).rejects.toBeInstanceOf(VersionRemplaceeSigneeEntreTempsError);
  });

  it("sans_version_remplacee_aucune_requete_sur_devis", async () => {
    const m = fabriquerTx({ ligne: [] });
    await cloreVersionRemplacee(m.tx, {
      replacesDevisId: null,
      documentGenereIdRemplace: null,
      numero: "DEV-1",
    });
    expect(m.queryRaw).not.toHaveBeenCalled();
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.count).not.toHaveBeenCalled();
  });
});
