import { describe, expect, it } from "vitest";

import type { InboxItem } from "@/features/admin-inbox/types";
import { UNIFIED_TYPE_LABELS, DB_TYPE_LABELS } from "@/features/admin-submissions/type-labels";
import { TYPES_RENDEZ_VOUS } from "@/server/calendly/type-rendez-vous";

import {
  NATURES_EXCLUES,
  NATURES_GARDEES,
  ordonnerSources,
  sourcesPourQui,
  type SourcePourQui,
} from "../sources";

function item(key: string, nature: string | undefined, channel: "appel" | "message" = "message") {
  const base: InboxItem = {
    key,
    channel,
    detailHref: `/fr/x/${key}`,
    receivedAt: new Date("2026-11-01T10:00:00Z"),
    subject: "Objet",
    contactName: `Nom ${key}`,
    contactEmail: null,
    context: null,
    statusLabel: "Nouveau",
    needsAction: true,
    sourceId: key,
    unread: false,
  };
  return nature === undefined ? base : { ...base, nature };
}

describe("natures gardées / exclues (demandes utiles à un devis)", () => {
  it.each([
    "audit",
    "implementation",
    "formation",
    "un_a_un",
    "devis",
    "simulateur_roi",
    "contact",
    "quote_request",
    "intervention",
    "diagnostic",
    "echange_projet",
  ])("garde %s", (n) => {
    expect(sourcesPourQui([item("a", n)], new Map(), "")).toHaveLength(1);
  });

  it.each([
    "apporteur",
    "recrutement",
    "presse",
    "partenariat",
    "speaker",
    "investisseur",
    "support_client",
    "autre",
    "salon",
    "tour_de_france_ia",
    "nature-inconnue",
  ])("exclut %s", (n) => {
    expect(sourcesPourQui([item("a", n)], new Map(), "")).toHaveLength(0);
  });

  it("exclut une ligne sans nature", () => {
    expect(sourcesPourQui([item("a", undefined)], new Map(), "")).toHaveLength(0);
  });

  it("exhaustivité : chaque type de message et de rendez-vous est classé", () => {
    const classes = new Set<string>([...NATURES_GARDEES, ...NATURES_EXCLUES]);
    const manquants = [
      ...Object.keys(UNIFIED_TYPE_LABELS),
      ...Object.keys(DB_TYPE_LABELS),
      ...TYPES_RENDEZ_VOUS,
      "apporteur",
    ].filter((k) => !classes.has(k));
    expect(manquants).toEqual([]);
    const doubles = NATURES_GARDEES.filter((n) =>
      (NATURES_EXCLUES as readonly string[]).includes(n),
    );
    expect(doubles).toEqual([]);
  });
});

describe("ordonnerSources", () => {
  const s = (id: string, clientId: string | null): SourcePourQui => ({
    clientId,
    libelle: id,
    detail: "",
    lien: `/${id}`,
  });

  it("le client choisi d'abord, puis l'ordre d'arrivée", () => {
    const r = ordonnerSources([s("a", null), s("b", "c1"), s("c", "c2"), s("d", "c1")], "c1");
    expect(r.map((x) => x.libelle)).toEqual(["b", "d", "a", "c"]);
  });

  it("sans client : ordre d'arrivée ; borne par défaut 10", () => {
    const tous = Array.from({ length: 15 }, (_, i) => s(`s${i}`, null));
    const r = ordonnerSources(tous, undefined);
    expect(r).toHaveLength(10);
    expect(r[0]?.libelle).toBe("s0");
    expect(ordonnerSources(tous, undefined, 30)).toHaveLength(15);
  });
});
