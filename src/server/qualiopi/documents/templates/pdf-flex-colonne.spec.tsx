/**
 * Garde structurelle — `flex` sur un `<Text>` dans un conteneur en COLONNE.
 *
 * ## Le défaut qu'elle attrape
 *
 * Constaté le 2026-08-03 sur `AXI-DOC-2026-018` (kit OPCO réel, envoyé à un
 * financeur) : les cinq lignes de « Pièces constitutives du dossier » étaient
 * **illisibles**, le libellé et sa référence légale imprimés l'un par-dessus
 * l'autre — « Convention de formation / accord tripartite » superposé à
 * « L.6353-1 / L.6353-2 ».
 *
 * Cause : `pieceLabel` portait `flex: 1` alors que son parent est un conteneur
 * en colonne (le défaut de `<View>` en @react-pdf). Le label réclamait toute la
 * hauteur disponible, et le `<Text>` suivant se rendait dessus.
 *
 * Le style venait de `kit-cpf.tsx`, où il est **inoffensif** : ce gabarit-là ne
 * rend qu'une seule ligne par pièce, dans un conteneur en LIGNE. C'est pourquoi
 * cette garde distingue les deux orientations au lieu d'interdire `flex`
 * partout — l'interdire partout casserait des mises en page correctes.
 *
 * ## Pourquoi une garde, et pas un test du kit OPCO
 *
 * Les `.spec` des gabarits n'assertent que « le buffer commence par %PDF ». Un
 * chevauchement ne s'y voit pas : les deux textes SONT présents, ils sont juste
 * au même endroit. Rien n'aurait signalé la récidive dans un autre gabarit.
 */

import { describe, it, expect } from "vitest";
import React from "react";

import { KitOpcoPdf } from "./kit-opco";
import { BulletList } from "../base-layout";
import type { OrganismeIdentite } from "../organisme";

// ─────────────────────────────────────────────────────────────────────────────
// Marcheur d'arbre
// ─────────────────────────────────────────────────────────────────────────────

type Style = Record<string, unknown>;

/** Le `style` d'une primitive @react-pdf accepte un objet OU un tableau. */
function aplatirStyle(style: unknown): Style {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(aplatirStyle)) as Style;
  if (style !== null && typeof style === "object") return style as Style;
  return {};
}

function porteFlex(style: Style): boolean {
  return style["flex"] !== undefined || style["flexGrow"] !== undefined;
}

/**
 * Parcourt l'arbre en portant l'orientation du conteneur courant.
 *
 * @react-pdf suit le défaut CSS de Yoga : un `<View>` sans `flexDirection`
 * empile ses enfants en COLONNE. C'est exactement le cas qui a produit le
 * chevauchement — le style ne disait rien, et le défaut a fait le reste.
 */
function collecterTextesFautifs(
  node: React.ReactNode,
  orientationParent: "row" | "column",
  fautifs: string[],
): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string" || typeof node === "number") return;
  if (Array.isArray(node)) {
    for (const enfant of node) collecterTextesFautifs(enfant, orientationParent, fautifs);
    return;
  }
  if (!React.isValidElement(node)) return;

  const element = node as React.ReactElement<Record<string, unknown>>;
  const type = element.type;

  // Nos composants sont des fonctions PURES (aucun hook) : on les invoque pour
  // voir ce qu'ils rendent réellement, plutôt que de nous arrêter à leur nom.
  if (typeof type === "function") {
    const rendu = (type as (props: unknown) => React.ReactNode)(element.props);
    collecterTextesFautifs(rendu, orientationParent, fautifs);
    return;
  }

  const style = aplatirStyle(element.props["style"]);

  if (type === "TEXT" && orientationParent === "column" && porteFlex(style)) {
    const apercu = JSON.stringify(element.props["children"]).slice(0, 70);
    fautifs.push(apercu);
  }

  const orientation =
    type === "TEXT"
      ? orientationParent
      : style["flexDirection"] === "row"
        ? "row"
        : style["flexDirection"] === "column"
          ? "column"
          : // Ni l'un ni l'autre : c'est le DÉFAUT de Yoga qui s'applique.
            type === "VIEW" || type === "PAGE" || type === "DOCUMENT"
            ? "column"
            : orientationParent;

  collecterTextesFautifs(element.props["children"] as React.ReactNode, orientation, fautifs);
}

function textesFautifs(node: React.ReactNode): string[] {
  const fautifs: string[] = [];
  collecterTextesFautifs(node, "column", fautifs);
  return fautifs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures minimales — seule la STRUCTURE compte ici, pas les valeurs.
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITE_FIXTURE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-TEST-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const KIT_OPCO = {
  numero: "AXI-FORM-2026-001",
  dateEmission: "03/08/2026",
  identite: IDENTITE_FIXTURE,
  nomOpco: "OPCO Atlas",
  numeroDossier: "ATLAS-2026-00123",
  intituleFormation: "IA appliquée aux entreprises",
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  ventilation: [
    {
      nomParticipant: "Jean Martin",
      heuresRealisees: 14,
      baremePrisEnChargeHeureCents: 2000,
      montantPrisEnChargeCents: 28000,
      resteAChargeCents: 0,
    },
  ],
  totalPrisEnChargeCents: 28000,
  totalResteAChargeCents: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("aucun <Text> ne réclame de flex dans un conteneur en colonne", () => {
  it("kit OPCO — la régression réellement constatée sur AXI-DOC-2026-018", () => {
    const fautifs = textesFautifs(React.createElement(KitOpcoPdf, { data: KIT_OPCO }));

    // Si ce test rougit, un libellé se rend PAR-DESSUS le texte qui le suit, et
    // le PDF part illisible au financeur sans qu'aucun autre test ne bronche.
    expect(fautifs).toStrictEqual([]);
  });

  it("le marcheur DÉTECTE réellement le défaut qu'il prétend interdire", () => {
    // 🔴 Sans ce test, une erreur du marcheur le rendrait vert en permanence et
    // la garde ne garderait rien. On lui soumet le défaut exact, reconstitué.
    const fautif = React.createElement(
      "VIEW",
      { style: {} }, // pas de flexDirection → colonne par défaut, comme Yoga
      React.createElement("TEXT", { style: { flex: 1 } }, "Libellé"),
      React.createElement("TEXT", { style: { fontSize: 8 } }, "Note légale"),
    );

    expect(textesFautifs(fautif)).toHaveLength(1);
  });

  it("BulletList garde chaque item d'un seul tenant au saut de page", () => {
    // 🔴 Constaté le 2026-08-03 sur AXI-DOC-2026-007 (lettre de mission réelle) :
    // la puce restait seule en bas de page 1 et son texte repartait page 2 SANS
    // marqueur. Sur une pièce contractuelle, une obligation qui s'ouvre sans
    // puce se lit comme la suite du paragraphe précédent.
    const rendu = BulletList({ items: ["Première obligation.", "Deuxième obligation."] });

    const rangees: React.ReactElement[] = [];
    const collecter = (n: React.ReactNode): void => {
      if (Array.isArray(n)) return n.forEach(collecter);
      if (!React.isValidElement(n)) return;
      const el = n as React.ReactElement<Record<string, unknown>>;
      if (el.type === "VIEW" && aplatirStyle(el.props["style"])["flexDirection"] === "row") {
        rangees.push(el);
      }
      collecter(el.props["children"] as React.ReactNode);
    };
    collecter(rendu);

    expect(rangees).toHaveLength(2);
    for (const rangee of rangees) {
      expect((rangee.props as Record<string, unknown>)["wrap"]).toBe(false);
    }
  });

  it("n'interdit PAS le flex légitime dans un conteneur en ligne", () => {
    // Le cas de `kit-cpf.tsx` : un seul libellé qui prend la largeur restante
    // d'une rangée. Interdire ce cas casserait des mises en page correctes.
    const sain = React.createElement(
      "VIEW",
      { style: { flexDirection: "row" } },
      React.createElement("TEXT", { style: { flex: 1 } }, "Libellé"),
    );

    expect(textesFautifs(sain)).toStrictEqual([]);
  });
});
