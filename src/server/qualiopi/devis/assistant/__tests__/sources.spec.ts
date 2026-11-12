import { describe, expect, it } from "vitest";
import type { InboxItem } from "@/features/admin-inbox/types";
import { sourcesPourQui, CANAUX_SOURCES_DEVIS } from "../sources";

function item(p: Partial<InboxItem> & { key: string }): InboxItem {
  return {
    channel: "message",
    detailHref: `/fr/x/contacts/messages/${p.key}`,
    receivedAt: new Date("2026-11-01T10:00:00Z"),
    subject: "Audit IA",
    contactName: "Claire Martin",
    contactEmail: "claire@exemple.fr",
    context: "SCI Invest Sun",
    statusLabel: "Nouveau",
    needsAction: true,
    sourceId: p.key,
    unread: true,
    ...p,
  };
}

const CLIENT = { id: "c-1", numero: "CLI-1", raisonSociale: "SCI Invest Sun" };

describe("S13 — sources « Pour qui ? » (boîte de réception, lecture seule)", () => {
  it("ne retient que les canaux appel et message (jamais candidature ni podcast)", () => {
    expect([...CANAUX_SOURCES_DEVIS].sort()).toEqual(["appel", "message"]);
    const r = sourcesPourQui(
      [
        item({ key: "a", channel: "appel" }),
        item({ key: "m", channel: "message" }),
        item({ key: "c", channel: "candidature" }),
        item({ key: "p", channel: "podcast" }),
      ],
      new Map(),
      "",
    );
    expect(r.map((x) => x.lien)).toHaveLength(2);
  });

  it("une demande dont l'e-mail correspond à une fiche porte son clientId", () => {
    const r = sourcesPourQui([item({ key: "m1" })], new Map([["claire@exemple.fr", CLIENT]]), "");
    expect(r[0]?.clientId).toBe("c-1");
  });

  it("sans fiche client : clientId null + lien vers la page existante, aucune création", () => {
    const r = sourcesPourQui([item({ key: "m2" })], new Map(), "");
    expect(r[0]?.clientId).toBeNull();
    expect(r[0]?.lien).toBe("/fr/x/contacts/messages/m2");
  });

  it("la comparaison de l'e-mail ignore la casse", () => {
    const r = sourcesPourQui(
      [item({ key: "m3", contactEmail: "Claire@Exemple.FR" })],
      new Map([["claire@exemple.fr", CLIENT]]),
      "",
    );
    expect(r[0]?.clientId).toBe("c-1");
  });

  it("n'expose jamais l'adresse e-mail ni le téléphone dans le résultat", () => {
    const r = sourcesPourQui([item({ key: "m4" })], new Map(), "");
    expect(JSON.stringify(r)).not.toContain("claire@exemple.fr");
  });

  it("la recherche porte sur nom, société, objet et e-mail, sans casse ni accent", () => {
    const items = [
      item({ key: "a" }),
      item({
        key: "b",
        contactName: "Éric Dupont",
        contactEmail: "eric@autre.fr",
        context: "Boulangerie",
        subject: "Site web",
      }),
    ];
    expect(sourcesPourQui(items, new Map(), "invest")).toHaveLength(1);
    expect(sourcesPourQui(items, new Map(), "ERIC")).toHaveLength(1);
    expect(sourcesPourQui(items, new Map(), "autre.fr")).toHaveLength(1);
    expect(sourcesPourQui(items, new Map(), "inconnu")).toHaveLength(0);
  });

  it("rôle sans accès aux coordonnées (nom et e-mail nuls) : la ligne reste, sans fiche devinée", () => {
    const r = sourcesPourQui(
      [item({ key: "r", contactName: null, contactEmail: null })],
      new Map(),
      "",
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.clientId).toBeNull();
    expect(r[0]?.libelle).toBe("SCI Invest Sun");
  });
});
