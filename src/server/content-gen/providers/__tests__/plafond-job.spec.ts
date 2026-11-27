import { describe, expect, it, vi } from "vitest";
import { inscrirePlafondJob, verifierPlafondJob } from "../plafond-job";

describe("garde de plafond par job", () => {
  it("sans garde inscrite : aucun effet", async () => {
    await expect(verifierPlafondJob("j-sans")).resolves.toBeUndefined();
    await expect(verifierPlafondJob(undefined)).resolves.toBeUndefined();
  });

  it("une garde qui lève bloque, une autre job n'est pas touchée", async () => {
    const retirer = inscrirePlafondJob("j1", async () => {
      throw new Error("plafond");
    });
    await expect(verifierPlafondJob("j1")).rejects.toThrow("plafond");
    await expect(verifierPlafondJob("j2")).resolves.toBeUndefined();
    retirer();
    await expect(verifierPlafondJob("j1")).resolves.toBeUndefined();
  });

  it("retirer une ancienne garde ne retire pas la nouvelle", async () => {
    const g2 = vi.fn(async () => 0);
    const retirer1 = inscrirePlafondJob("j3", async () => 0);
    const retirer2 = inscrirePlafondJob("j3", g2);
    retirer1();
    await verifierPlafondJob("j3");
    expect(g2).toHaveBeenCalledTimes(1);
    retirer2();
  });
});
