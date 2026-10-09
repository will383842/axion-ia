/**
 * L7 — UN SEUL FIL « ÉCHANGES » : acceptation.
 *
 * Un apporteur invité, relancé, qui a répondu et réservé → quatre faits, dans
 * l'ordre des faits (le plus récent en tête), chacun de son côté : envoyé à
 * droite, reçu à gauche, notes au centre.
 */
import { describe, expect, it } from "vitest";

import { faitsApporteur, faitsEmploi, ordonnerFil } from "../fil";
import { motsInterditsApporteur } from "@/lib/commercial-application/vocabulaire-apporteur";

const J = (j: number, h = 10) => new Date(Date.UTC(2026, 9, j, h, 0));

describe("faitsApporteur", () => {
  const faits = faitsApporteur({
    envoyees: [],
    recues: [
      {
        id: "r1",
        recueLe: J(6, 8),
        objet: "Re: échange",
        extrait: "Parfait pour jeudi, à bientôt.",
        automatique: false,
        lienZoho: "https://mail.zoho.eu/x",
      },
    ],
    invitations: [
      { id: "i1", le: J(1), nature: "invitation", statut: "sent" },
      { id: "i2", le: J(4), nature: "rappel", statut: "sent" },
    ],
    echanges: [{ id: "c1", reserveLe: J(5), pour: J(9, 8), annule: false, suivi: null }],
    liens: [],
  });

  it("🔑 invité, relancé, a répondu, a réservé → quatre faits dans l'ordre", () => {
    expect(faits.map((f) => [f.sens, f.titre])).toEqual([
      ["recu", "Reçu"],
      ["note", "Échange de 15 minutes réservé"],
      ["envoye", "Envoyé · Rappel automatique"],
      ["envoye", "Envoyé · Invitation à l'échange"],
    ]);
  });

  it("aucun mot de recrutement dans ce que le fil apporteur affiche", () => {
    const tout = JSON.stringify(
      faitsApporteur({
        envoyees: [
          {
            id: "s1",
            repliedAt: J(2),
            repliedByName: "Will",
            subject: "Le réseau",
            deliveryStatus: "failed",
            errorMsg: null,
            modele: "Présenter le réseau",
            bodyText: null,
          },
        ],
        recues: [],
        invitations: [{ id: "i", le: J(1), nature: "invitation", statut: "a_valider" }],
        echanges: [
          {
            id: "c",
            reserveLe: J(3),
            pour: null,
            annule: true,
            suivi: { le: J(4), issue: "eu_lieu", decision: "non_retenu", note: null },
          },
        ],
        liens: [],
      }),
    );
    expect(motsInterditsApporteur(tout)).toEqual([]);
    expect(tout).toContain("Sans suite");
  });

  it("les fichiers d'un lien s'accrochent au message qui les a portés", () => {
    const f = faitsApporteur({
      envoyees: [
        {
          id: "s1",
          repliedAt: J(1),
          repliedByName: "Will",
          subject: "Le réseau",
          deliveryStatus: "sent",
          errorMsg: null,
          modele: null,
          bodyText: null,
        },
      ],
      recues: [],
      invitations: [],
      echanges: [],
      liens: [
        {
          id: "l1",
          reponseId: "s1",
          creeLe: J(1),
          ouvertLe: J(2),
          etat: "actif",
          fichiers: [
            {
              titre: "Kit",
              nomFichier: "Kit-apporteur.pdf",
              tailleLisible: null,
              telechargeLe: J(2),
              apercuSeulement: false,
            },
          ],
        },
      ],
    });
    expect(f).toHaveLength(1);
    expect(f[0]!.precisions).toContain("lien ouvert le 02/10");
    expect(f[0]!.fichiers?.[0]).toMatchObject({
      nom: "Kit-apporteur.pdf",
      etat: "téléchargé le 02/10",
    });
  });
});

describe("faitsEmploi", () => {
  it("la réponse reçue relevée (L3) n'apparaît qu'UNE fois, et les notes vont au centre", () => {
    const f = faitsEmploi({
      evenements: [
        {
          id: "e1",
          type: "email_recu",
          libelle: "Message reçu",
          occurredAt: J(3),
          authorName: "Relevé",
          summary: "Réponse reçue",
          body: null,
          replyId: null,
          reponseRecueId: "r1",
          livraison: null,
        },
        {
          id: "e2",
          type: "note",
          libelle: "Note",
          occurredAt: J(4),
          authorName: "Will",
          summary: "Bon rythme",
          body: null,
          replyId: null,
          reponseRecueId: null,
          livraison: null,
        },
      ],
      recues: [
        {
          id: "r1",
          recueLe: J(3),
          objet: "Re",
          extrait: "Dispo lundi",
          automatique: false,
          lienZoho: "z",
        },
      ],
      liens: [],
    });
    expect(f.map((x) => [x.sens, x.titre])).toEqual([
      ["note", "Note"],
      ["recu", "Reçu"],
    ]);
  });
});

describe("ordonnerFil", () => {
  it("plus récent d'abord, sans doublon", () => {
    const a = { id: "a", sens: "note" as const, quand: J(1), titre: "a", precisions: [] };
    const b = { id: "b", sens: "note" as const, quand: J(2), titre: "b", precisions: [] };
    expect(ordonnerFil([a, b, a]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
