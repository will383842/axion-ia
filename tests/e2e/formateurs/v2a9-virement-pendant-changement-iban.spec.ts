// @formateurs V2-A9 — un VIREMENT DE MISSION pendant un changement d'IBAN.
//
// Une facture de mission due ; le formateur demande un nouveau compte. Attendu (règle de
// cette vérification) : pendant l'attente, AUCUN virement — ni sur l'ancien compte, ni sur
// le nouveau —, la vue « Virements à faire » dit pourquoi, avec le même motif que la garde
// du clic ; au-delà des 48 h et de la validation, le virement part sur le NOUVEAU compte,
// et un écran ouvert avant le changement (empreinte de l'ancien IBAN) est refusé.
//
// ÉCART : les 48 h se comptent depuis `createdAt`, posé par la base à l'heure réelle (comme
// E24) : les instants du scénario partent de cette heure.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { jouer, jouerUne } from "../fixtures/formateurs/argent-execution";
import { IBAN_A, IBAN_B, factureDeMissionEmise } from "../fixtures/formateurs/argent-parcours";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { jouerV2aUne } from "../fixtures/formateurs/v2a-execution";

const H = 3_600_000;
const IBAN_OUVERT = {
  allumer: { "formateurs.changement_coordonnees": { actif: true } },
  textes: ["formateur-iban-changement", "formateur-iban-valide"],
} as const;

interface Garde {
  verdict: { autorise: boolean; motifs: string[] };
  ibanFin4: string | null;
}
type Etats = Record<string, { motifs: string[]; fin4: string | null; empreinte: string | null }>;

test.describe("@formateurs V2-A9 — virement pendant un changement d'IBAN", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("bloqué pendant l'attente (garde et vue d'accord) ; après validation, nouveau compte seulement", async () => {
    await avecVerrouArgent(async () => {
      const f = await factureDeMissionEmise({
        prenom: "Ibrahim",
        jours: ["2041-04-09", "2041-04-10"],
        emettre: false,
      });
      const demande = await jouerUne<{ ok: boolean }>({
        etape: "demander-iban",
        ...IBAN_OUVERT,
        trainerId: f.formateur.id,
        iban: IBAN_B,
        maintenant: new Date().toISOString(),
      });
      expect(demande).toEqual({ ok: true });
      const d = await prisma.demandeChangementFormateur.findFirstOrThrow({
        where: { trainerId: f.formateur.id, nature: "iban" },
        select: { id: true, statut: true, createdAt: true },
      });
      expect(d.statut).toBe("en_attente");
      const t = (heures: number) => new Date(d.createdAt.getTime() + heures * H).toISOString();

      // Pendant l'attente : refus au clic, sur l'ancien compte comme sur le nouveau.
      for (const h of [1, 47]) {
        const g = await jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: f.empreinte,
          maintenant: t(h),
        });
        expect(g.verdict.autorise).toBe(false);
        expect(g.verdict.motifs).toContain("compte_bancaire_a_valider");
        expect(g.ibanFin4).toBeNull();
      }
      // La vue dit la même chose que la garde (même fonction, lue pour l'écran).
      const vue = await jouerV2aUne<Etats>({
        etape: "etats-virements-mission",
        ids: [f.statementId],
        maintenant: new Date().toISOString(),
      });
      expect(vue[f.statementId]!.motifs).toContain("compte_bancaire_a_valider");
      // La fiche porte toujours l'ancien compte : la nouvelle valeur n'est écrite nulle part.
      expect(vue[f.statementId]!.fin4).toBe(IBAN_A.slice(-4));
      expect(vue[f.statementId]!.empreinte).toBe(f.empreinte);

      // Validation après 48 h.
      const admin = (await prisma.adminUser.findFirstOrThrow({ select: { id: true } })).id;
      const [valide] = await jouer([
        {
          etape: "valider-demande",
          ...IBAN_OUVERT,
          demandeId: d.id,
          adminId: admin,
          maintenant: t(48.1),
        },
      ]);
      expect(valide).toEqual({ ok: true });
      const nouvelle = (
        await prisma.trainer.findUniqueOrThrow({
          where: { id: f.formateur.id },
          select: { ibanEmpreinte: true },
        })
      ).ibanEmpreinte;
      expect(nouvelle).not.toBe(f.empreinte);

      // Un écran ouvert AVANT (ancienne empreinte) : refus ; rechargé : nouveau compte.
      const [perime, recharge] = await Promise.all([
        jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: f.empreinte,
          maintenant: t(49),
        }),
        jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: nouvelle,
          maintenant: t(49),
        }),
      ]);
      expect(perime.verdict.autorise).toBe(false);
      expect(perime.verdict.motifs).toEqual(["iban_change_depuis_l_affichage"]);
      expect(recharge.verdict).toMatchObject({ autorise: true, motifs: [] });
      expect(recharge.ibanFin4).toBe(IBAN_B.slice(-4));
    });
  });
});
