/**
 * L8a — LES ÉTAPES, dans le vocabulaire de chaque monde.
 *
 * Emploi : Nouvelle → À l'étude → Échange prévu → Proposition faite → Retenue,
 * sorties « Non retenue », « Retirée », « Archivée ».
 * Réseau : Premier contact → Invitation envoyée → Échange prévu → Échange fait
 * → Prêt à signer → Signé, sorties « Sans suite », « Absent à l'échange ».
 * Après l'échange : « On poursuit / À revoir / Sans suite ».
 *
 * Le compilateur refuse un statut non traité : les tables sont des
 * `Record<…>` exhaustifs (un statut ajouté à l'énumération casse le typecheck).
 */
import { describe, expect, it } from "vitest";

import {
  BARRE_APPORTEUR,
  BARRE_EMPLOI,
  LIBELLE_APRES_ECHANGE,
  etapeApporteur,
  etapeEmploi,
} from "../etapes";
import { STATUTS_CANDIDATURE } from "@/content/recrutement/statuts";
import type { EtapeSuivi } from "@/lib/commercial-application/etape-suivi-apporteur";
import { motsInterditsApporteur } from "@/lib/commercial-application/vocabulaire-apporteur";

const J = new Date(Date.UTC(2026, 9, 5, 10));

const TOUTES_ETAPES_SUIVI: EtapeSuivi[] = [
  { type: "candidat", motif: null },
  { type: "candidat", motif: "opposition" },
  { type: "lien-envoye", le: J, annule: false },
  { type: "lien-envoye", le: J, annule: true },
  { type: "echange-reserve", le: J },
  { type: "echange-reserve", le: null },
  { type: "echange-fait", aRevoir: false },
  { type: "echange-fait", aRevoir: true },
  { type: "absent" },
  { type: "retenu" },
  { type: "contrat-envoye", le: J },
  { type: "dossier-a-completer" },
  { type: "dossier-signe" },
  { type: "contrat-contresigne", le: J },
  { type: "contrat-contresigne", le: null },
  { type: "non-retenu" },
  { type: "dossier-refuse" },
  { type: "contrat-termine" },
  { type: "sans-suite" },
];

describe("etapeEmploi", () => {
  it("chaque statut de candidature a une étape, et « Retenue » pour une embauche", () => {
    for (const s of STATUTS_CANDIDATURE) expect(etapeEmploi(s).libelle).toBeTruthy();
    expect(etapeEmploi("hired").libelle).toBe("Retenue");
    expect(etapeEmploi("rejected").libelle).toBe("Non retenue");
    expect(etapeEmploi("withdrawn").libelle).toBe("Retirée");
    expect(etapeEmploi("interview").libelle).toBe("Échange prévu");
  });

  it("la barre suit l'ordre de la maquette, et une sortie n'a pas de rang", () => {
    expect(BARRE_EMPLOI).toEqual([
      "Nouvelle",
      "À l'étude",
      "Échange prévu",
      "Proposition faite",
      "Retenue",
    ]);
    expect(etapeEmploi("offer").rang).toBe(3);
    expect(etapeEmploi("rejected").rang).toBeNull();
  });
});

describe("etapeApporteur", () => {
  it("🔴 aucune pastille apporteur ne contient un mot interdit", () => {
    for (const e of TOUTES_ETAPES_SUIVI) {
      for (const pret of [false, true]) {
        const p = etapeApporteur(e, { pretASigner: pret });
        expect(
          motsInterditsApporteur(`${p.libelle} ${p.precision ?? ""}`),
          JSON.stringify(e),
        ).toEqual([]);
      }
    }
    expect(motsInterditsApporteur(Object.values(LIBELLE_APRES_ECHANGE).join(" "))).toEqual([]);
    expect(motsInterditsApporteur(BARRE_APPORTEUR.join(" "))).toEqual([]);
  });

  it("reprend la logique de #1358 dans le vocabulaire du réseau", () => {
    expect(etapeApporteur({ type: "candidat", motif: null }).libelle).toBe("Premier contact");
    expect(etapeApporteur({ type: "lien-envoye", le: J, annule: false }).libelle).toBe(
      "Invitation envoyée",
    );
    expect(etapeApporteur({ type: "echange-reserve", le: J }).libelle).toBe("Échange prévu");
    expect(etapeApporteur({ type: "retenu" })).toMatchObject({
      libelle: "Échange fait",
      precision: "On poursuit",
    });
    expect(etapeApporteur({ type: "echange-fait", aRevoir: true }).precision).toBe("À revoir");
    expect(etapeApporteur({ type: "non-retenu" }).libelle).toBe("Sans suite");
    expect(etapeApporteur({ type: "contrat-envoye", le: J }).libelle).toBe("Prêt à signer");
    expect(etapeApporteur({ type: "contrat-contresigne", le: J }).libelle).toBe("Signé");
  });

  it("« Prêt à signer » posé à la main l'emporte sur une étape antérieure", () => {
    expect(etapeApporteur({ type: "retenu" }, { pretASigner: true }).libelle).toBe("Prêt à signer");
    expect(
      etapeApporteur({ type: "contrat-contresigne", le: J }, { pretASigner: true }).libelle,
    ).toBe("Signé");
  });

  it("libellés de l'après-échange", () => {
    expect(LIBELLE_APRES_ECHANGE).toEqual({
      retenu: "On poursuit",
      a_revoir: "À revoir",
      non_retenu: "Sans suite",
    });
  });
});

describe("L8d — l'issue de l'échange se dit dans le vocabulaire du réseau", () => {
  it("aucun mot de recrutement dans les boutons de l'issue", async () => {
    const { LIBELLE_ISSUE_APPORTEUR } = await import("@/features/admin-rendezvous/issue-apporteur");
    expect(LIBELLE_ISSUE_APPORTEUR.retenu).toBe("On poursuit");
    expect(LIBELLE_ISSUE_APPORTEUR.non_retenu).toBe("Sans suite");
    expect(motsInterditsApporteur(Object.values(LIBELLE_ISSUE_APPORTEUR).join(" "))).toEqual([]);
  });
});
