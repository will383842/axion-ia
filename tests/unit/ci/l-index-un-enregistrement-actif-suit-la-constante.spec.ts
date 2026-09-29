/**
 * ⛔ L'INDEX « UN ENREGISTREMENT ACTIF » SUIT LA CONSTANTE
 * (chantier visio, PR 2 ; ADR 0054).
 *
 * `ETATS_ENREGISTREMENT_ACTIFS` (src/server/visio/etats.ts) dit au code quels
 * états occupent la place unique d'une rencontre ; l'index partiel
 * `enregistrements_un_actif` le dit à la base. S'ils divergent, la base
 * laisse passer deux captations simultanées de la même rencontre (deux sons
 * mêlés dans un compte rendu), ou refuse une reprise légitime.
 *
 * Le SQL de l'index est PRODUIT depuis la constante
 * (`sqlIndexEnregistrementsActifs()`) : la migration doit en contenir le texte
 * exact, et chaque état doit exister dans l'énumération Prisma.
 *
 * Mutation qui fait rougir : ajouter `"depose"` à la constante sans migration,
 * ou retirer `'interrompu'` de l'index dans la migration.
 */

import { describe, expect, it } from "vitest";
import { MIGRATION_VISIO, sqlIndexEnregistrementsActifs } from "../../../prisma/objets-sql-bruts";
import { ETATS_ENREGISTREMENT_ACTIFS } from "../../../src/server/visio/etats";
import { lire } from "./sources-du-circuit-visio";

const SQL = lire(`prisma/migrations/${MIGRATION_VISIO}/migration.sql`);
const SCHEMA = lire("prisma/schema.prisma");

function valeursEnum(nom: string): string[] {
  const bloc = new RegExp(`^enum ${nom} \\{([\\s\\S]*?)^\\}`, "m").exec(SCHEMA)?.[1] ?? "";
  return bloc
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+$/.test(l));
}

describe("l'index un enregistrement actif suit la constante", () => {
  it("la migration contient exactement l'index produit depuis la constante", () => {
    expect(SQL).toContain(sqlIndexEnregistrementsActifs());
  });

  it("l'index produit nomme chaque état actif, et eux seuls", () => {
    const produit = sqlIndexEnregistrementsActifs();
    const liste = /IN \(([^)]*)\)/.exec(produit)?.[1] ?? "";
    const etats = liste.split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(etats).toEqual([...ETATS_ENREGISTREMENT_ACTIFS]);
  });

  it("chaque état actif existe dans l'énumération EnregistrementStatut", () => {
    const valeurs = valeursEnum("EnregistrementStatut");
    expect(valeurs.length).toBeGreaterThan(5);
    for (const e of ETATS_ENREGISTREMENT_ACTIFS) expect(valeurs).toContain(e);
  });

  it("contre-témoin : une migration qui oublierait un état ne contiendrait pas l'index produit", () => {
    // On retire l'état DANS la ligne de l'index — pas dans l'énumération, qui
    // porte la même suite de valeurs plus haut dans le fichier.
    const produit = sqlIndexEnregistrementsActifs();
    const coupe = SQL.replace(produit, produit.replace("'accord_en_attente', ", ""));
    expect(coupe).not.toBe(SQL);
    expect(coupe).not.toContain(sqlIndexEnregistrementsActifs());
  });
});
