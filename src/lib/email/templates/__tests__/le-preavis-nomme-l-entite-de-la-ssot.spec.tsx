/**
 * ⛔ Le préavis nomme l'entité responsable lue à la SOURCE, jamais une copie.
 *
 * ## Pourquoi
 *
 * Le registre interne a désigné pendant trois mois « Axion-IA OÜ » et le droit
 * estonien, un reste de la bascule de juin : la société estonienne n'existe
 * plus (décision B4 de Will, 28/09). Le préavis est le premier texte qu'un
 * client lit sur l'enregistrement de ses visios : il doit nommer le
 * responsable réel, tel que les réglages légaux de la console le donnent
 * (`resolveLegalIdentity()`), avec la SSOT `IDENTITE_LEGALE` pour seul repli.
 *
 * ## Ce que la garde vérifie
 *
 * 1. Une entité SENTINELLE passée dans la charge utile apparaît dans le texte :
 *    un gabarit qui écrirait l'entité en dur (« Axion-IA OÜ ») rougit ici.
 * 2. Sans charge utile, le texte nomme la SSOT.
 * 3. La mise en file passe au gabarit ce que rend la fonction d'identité.
 * 4. Le fichier du gabarit ne contient aucune raison sociale littérale.
 *
 * Mutation vérifiée : remplacer `{responsable}` par « Axion-IA OÜ » dans
 * `preavis-sous-traitants.tsx` → les tests 1 et 4 rougissent.
 * Contre-témoin : `src/lib/seo/__tests__/identite-legale-registre.spec.ts`
 * (aucune raison sociale dupliquée sous `src/`) reste vert.
 *
 * Angle mort avoué : la garde ne voit pas une entité fausse SAISIE dans les
 * réglages légaux de la console (`legal_overrides`) : c'est la source, et on la
 * suit. Elle ne voit pas non plus le registre `_AUDIT/DPA-REGISTER.md` (un
 * retour de « OÜ » n'y rougit nulle part jusqu'à la PR 8 du chantier).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@react-email/render";
import * as React from "react";

import { PreavisSousTraitantsEmail } from "../preavis-sous-traitants";
import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import { envoyerPreavis, type DependancesPreavis } from "@/server/visio/preavis-envoi";

const SENTINELLE = "ENTITE SENTINELLE DE TEST SAS";

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

async function rendu(payload: Record<string, unknown>): Promise<string> {
  return texte(await render(<PreavisSousTraitantsEmail locale="fr" payload={payload} />));
}

describe("préavis — l'entité responsable vient de la source", () => {
  it("⛔ nomme l'entité passée par la mise en file, et pas une autre", async () => {
    const t = await rendu({ responsable: SENTINELLE, contactRgpd: "rgpd@exemple.invalid" });
    expect(t).toContain(`Responsable du traitement : ${SENTINELLE}`);
    expect(t).not.toMatch(/OÜ|estoni/i);
    expect(t).not.toMatch(/\bAKI\b/);
  });

  it("sans charge utile, nomme la SSOT (IDENTITE_LEGALE), pas un littéral", async () => {
    const t = await rendu({});
    expect(t).toContain(`Responsable du traitement : ${IDENTITE_LEGALE.legalName}`);
  });

  it("⛔ la mise en file passe au gabarit l'entité rendue par la fonction d'identité", async () => {
    const appels: Array<Record<string, unknown>> = [];
    const deps: DependancesPreavis = {
      prisma: {
        client: {
          findMany: async () => [
            {
              id: "00000000-0000-0000-0000-00000000000a",
              contactEmail: "client@exemple.invalid",
              _count: { facturesFormation: 1 },
            },
          ],
        },
        emailOutbox: { findMany: async () => [] },
      },
      identite: async () => ({ legalName: SENTINELLE, dpoContact: "rgpd@exemple.invalid" }),
      mettreEnFile: async (_t, _to, _l, payload) => {
        appels.push(payload);
        return { garePourValidation: true };
      },
    };
    await envoyerPreavis({ envoyer: true }, deps);
    expect(appels).toHaveLength(1);
    expect(appels[0]?.["responsable"]).toBe(SENTINELLE);
    const t = await rendu(appels[0]!);
    expect(t).toContain(SENTINELLE);
  });

  it("⛔ le gabarit et la mise en file n'écrivent aucune raison sociale en dur", () => {
    const racine = process.cwd();
    for (const f of [
      join(racine, "src", "lib", "email", "templates", "preavis-sous-traitants.tsx"),
      join(racine, "src", "server", "visio", "preavis-envoi.ts"),
    ]) {
      const source = readFileSync(f, "utf8");
      expect(source, f).not.toMatch(/"[^"]*(AXION IA SAS|Axion-IA SAS|OÜ)[^"]*"/);
      expect(source, f).not.toMatch(/>[^<{]*(AXION IA SAS|Axion-IA SAS|OÜ)/);
    }
    // La mise en file lit bien la fonction d'identité des réglages légaux.
    const envoi = readFileSync(join(racine, "src", "server", "visio", "preavis-envoi.ts"), "utf8");
    expect(envoi).toContain('import("@/lib/legal-identity")');
    expect(envoi).toContain("identite: resolveLegalIdentity");
  });
});
