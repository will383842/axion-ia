// @vitest-environment node

/**
 * Verrou — aucun destinataire de la PAROLE des rendez-vous n'est déclaré actif
 * sans contrat de sous-traitance écrit (chantier visio, PR 8 ; art. 28).
 *
 * La parole d'un rendez-vous passe par deux tiers : **Hetzner** (nos serveurs,
 * la base) et **OpenAI** (transcription et compte rendu). Cloudflare y est
 * aussi (son chiffré), et son DPA est accepté depuis le 2026-05-09. Déclarer
 * l'un d'eux `active` avec un `dpaStatus` `pending`, c'est publier un flux de
 * parole sans cadre art. 28 : refusé ici.
 *
 * La garde lit `subprocessors.ts` (ce qui est PUBLIÉ), pas le registre : c'est
 * la page publique qui engage. Le geste de Will (signer le DPA OpenAI dans
 * platform.openai.com) doit donc se traduire par un `dpaStatus` à jour AVANT
 * que l'interrupteur de la notice passe à `active`.
 *
 * Contre-témoin : une liste fictive (entrée active, DPA `pending`) est refusée.
 * Angle mort : la garde fait confiance au champ `dpaStatus` ; elle ne peut pas
 * vérifier qu'un contrat a réellement été signé (c'est le registre et Will).
 */

import { describe, expect, it } from "vitest";

import { SUBPROCESSORS, type Subprocessor } from "../subprocessors";
import { ANNONCE_VISIO_ACTIVE } from "@/server/visio/visio-annonce";
import { NOM_ENTREE_COMPTES_RENDUS_VISIO } from "../visio-annonce-textes";

/** Les entrées qui reçoivent la parole des rendez-vous. */
function destinatairesDeLaParole(liste: readonly Subprocessor[]): Subprocessor[] {
  return liste.filter(
    (s) =>
      s.name === NOM_ENTREE_COMPTES_RENDUS_VISIO ||
      s.name.startsWith("Hetzner") ||
      s.name.startsWith("Cloudflare"),
  );
}

/** Ceux qui sont actifs sans cadre écrit. */
function sansCadre(liste: readonly Subprocessor[]): string[] {
  return destinatairesDeLaParole(liste)
    .filter((s) => s.activationStatus === "active" && s.dpaStatus === "pending")
    .map((s) => s.name);
}

describe("aucun destinataire de la parole n'est actif sans cadre écrit", () => {
  it("🔴 Hetzner, Cloudflare et OpenAI (comptes rendus) : jamais actifs avec un DPA en attente", () => {
    expect(sansCadre(SUBPROCESSORS)).toEqual([]);
  });

  it("🔴 Hetzner porte un contrat signé (la base qui garde la parole)", () => {
    expect(SUBPROCESSORS.find((s) => s.name.startsWith("Hetzner"))?.dpaStatus).toBe("signed");
  });

  it("🔴 l'annonce ne peut être active que si OpenAI (comptes rendus) a un cadre écrit", () => {
    const entree = SUBPROCESSORS.find((s) => s.name === NOM_ENTREE_COMPTES_RENDUS_VISIO);
    if (!ANNONCE_VISIO_ACTIVE) return;
    expect(entree, "annonce active sans entrée publiée").toBeDefined();
    expect(entree?.dpaStatus).not.toBe("pending");
  });

  it("🔑 CONTRE-TÉMOIN : une entrée active au DPA en attente est refusée", () => {
    const fictive: Subprocessor = {
      name: NOM_ENTREE_COMPTES_RENDUS_VISIO,
      location: "San Francisco, USA",
      serversLocation: "USA",
      purposeFr: "x",
      purposeEn: "x",
      dataCategoriesFr: "x",
      dataCategoriesEn: "x",
      legalBasis: "6.1.a_consent",
      dpaStatus: "pending",
      transferFramework: "scc",
      category: "content_gen_ai",
      activationStatus: "active",
    };
    expect(sansCadre([fictive])).toEqual([NOM_ENTREE_COMPTES_RENDUS_VISIO]);
    expect(sansCadre([{ ...fictive, dpaStatus: "signed" }])).toEqual([]);
  });
});
