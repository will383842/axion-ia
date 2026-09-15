/**
 * 🔴 UNE ALERTE DONT LA CAUSE A DISPARU RESTAIT OUVERTE (2026-09-15).
 *
 * Constat sur la seule session réelle, réservée la veille pour le lendemain :
 *
 *   · `rappel_j7_non_envoye`, levée le matin du premier jour. La session avait
 *     été créée moins de 24 h avant son début : aucun rappel ne pouvait partir.
 *     La levée est corrigée depuis #1066 — mais l'alerte DÉJÀ OUVERTE ne se
 *     refermait pas, parce que le code portait `resolutionAuto: false`.
 *   · `satisfaction_manquante`, levée huit jours après la fin. La stagiaire a
 *     répondu le lendemain ; l'alerte était toujours ouverte le jour suivant.
 *
 * Question posée par Will : « il ne faut pas que le système d'alerte vérifie et
 * se mette à jour tout seul ? » — si. Une alerte dont la condition n'est plus
 * vraie se referme au passage suivant du moteur, sans script ni clic.
 *
 * Le catalogue est RÉEL ici (contrairement à `alertes-service.spec.ts`) : c'est
 * précisément sa valeur qui décide. La base est simulée par une table en
 * mémoire que `findMany` FILTRE vraiment — un mock qui rendrait tout, quel que
 * soit le `where`, ferait passer une résolution qui ne regarde pas le code.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Ligne = { id: string; code: string; cibleId: string | null; resolue: boolean };
let base: Ligne[] = [];

const findManySessions = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      createMany: vi.fn(async () => ({ count: 0 })),
      update: vi.fn(),
      updateMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => ({
        count: args.where.id.in.length,
      })),
      findMany: vi.fn(async (args: { where: { resolue?: boolean; code?: { in: string[] } } }) =>
        base.filter(
          (l) =>
            (args.where.resolue === undefined || l.resolue === args.where.resolue) &&
            (args.where.code === undefined || args.where.code.in.includes(l.code)),
        ),
      ),
    },
    siteSetting: { upsert: vi.fn() },
    trainingSession: { findMany: (...a: unknown[]) => findManySessions(...a) },
  },
}));

vi.mock("./evaluateur", () => ({
  evaluerAlertes: vi.fn(),
  evaluerAlertesDetaille: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { synchroniserAlertes } from "./alertes-service";
import { ALERTE_CATALOGUE } from "./catalogue";
import { evaluerAlertesDetaille } from "./evaluateur";
import { sessionsSansRappelJ7 } from "@/server/qualiopi/notifications/rappel-j7-manquant";

const mp = prisma as unknown as {
  alerteSysteme: { updateMany: ReturnType<typeof vi.fn> };
};
const evaluer = evaluerAlertesDetaille as unknown as ReturnType<typeof vi.fn>;

type Candidate = {
  code: string;
  niveau: "important";
  titre: string;
  message: string;
  cibleId: string;
};

function candidate(code: string, cibleId: string): Candidate {
  return { code, niveau: "important", titre: "T", message: "M", cibleId };
}

function balayage(opts: {
  candidates?: Candidate[];
  reglesEnEchec?: string[];
  reglesTronquees?: { nom: string; trouvees: number; retenues: number }[];
  codesTronques?: string[];
}) {
  evaluer.mockResolvedValueOnce({
    candidates: opts.candidates ?? [],
    reglesEnEchec: opts.reglesEnEchec ?? [],
    reglesTronquees: opts.reglesTronquees ?? [],
    codesTronques: opts.codesTronques ?? [],
  });
}

/** Les identifiants effectivement passés à la commande de résolution. */
function idsResolus(): string[] {
  return mp.alerteSysteme.updateMany.mock.calls.flatMap(
    (c) => (c[0] as { where: { id: { in: string[] } } }).where.id.in,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  base = [];
});

// ─────────────────────────────────────────────────────────────────────────────
// Le cas réel, puis la même famille
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les codes dont la condition se VÉRIFIE en base, et qui se referment donc
 * seuls dès que le balayage ne la voit plus :
 *
 *   · `rappel_j7_non_envoye` — la règle écarte désormais le rappel impossible ;
 *   · `satisfaction_manquante` — la réponse est enregistrée sur le questionnaire ;
 *   · `suivi_froid_manquant` — idem, à froid ;
 *   · `attestation_non_envoyee` — la notification pose `attestationNotifieeAt`.
 */
const SE_FERMENT_SEULES = [
  "rappel_j7_non_envoye",
  "satisfaction_manquante",
  "suivi_froid_manquant",
  "attestation_non_envoyee",
] as const;

describe("🔴 une alerte dont la cause a disparu se ferme au passage suivant", () => {
  it("le cas réel : rappel J-7 impossible ET questionnaire répondu — les deux se ferment", async () => {
    base = [
      { id: "a-rappel", code: "rappel_j7_non_envoye", cibleId: "sess-1", resolue: false },
      { id: "a-satisf", code: "satisfaction_manquante", cibleId: "enr-1", resolue: false },
    ];
    // La règle ne les produit plus : la session tenait sous 24 h d'avance, et la
    // stagiaire a répondu. Aucune règle en échec, aucune troncature.
    balayage({});

    const r = await synchroniserAlertes();

    expect(idsResolus().sort()).toEqual(["a-rappel", "a-satisf"]);
    expect(r.resolues).toBe(2);
  });

  it.each(SE_FERMENT_SEULES)("%s — se ferme seule, sans motif de fermeture humaine", (code) => {
    const entree = ALERTE_CATALOGUE[code];
    expect(entree?.resolutionAuto).toBe(true);
    expect(entree !== undefined && "motifSansResolutionAuto" in entree).toBe(false);
  });

  it.each(SE_FERMENT_SEULES)(
    "%s — contre-témoin : tant que la règle la produit, elle RESTE ouverte",
    async (code) => {
      base = [{ id: "ouverte", code, cibleId: "cible-1", resolue: false }];
      balayage({ candidates: [candidate(code, "cible-1")] });

      await synchroniserAlertes();

      expect(idsResolus()).not.toContain("ouverte");
    },
  );

  it.each(SE_FERMENT_SEULES)(
    "%s — une règle en ÉCHEC ne ferme rien : une erreur n'est pas une cause disparue",
    async (code) => {
      base = [{ id: "ouverte", code, cibleId: "cible-1", resolue: false }];
      balayage({ reglesEnEchec: ["une_regle_quelconque"] });

      await synchroniserAlertes();

      expect(mp.alerteSysteme.updateMany).not.toHaveBeenCalled();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Un prédicat ouvert échoue ouvert : la troncature n'est pas une disparition
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 une moisson TRONQUÉE ne ferme pas ce qu'elle a laissé de côté", () => {
  it("les alertes d'un code tronqué restent ouvertes, même absentes des candidates retenues", async () => {
    // 257 trouvées, 200 retenues : la 201e existe toujours en base. La fermer
    // parce qu'elle n'a pas passé le plafond serait confondre « pas lue » et
    // « disparue » — exactement ce que la suspension sur échec refuse déjà.
    base = [
      { id: "au-dela-du-plafond", code: "opco_sans_accord", cibleId: "s-250", resolue: false },
      { id: "cause-disparue", code: "referent_handicap_absent", cibleId: null, resolue: false },
    ];
    balayage({
      candidates: [candidate("opco_sans_accord", "s-1")],
      reglesTronquees: [{ nom: "opco", trouvees: 257, retenues: 200 }],
      codesTronques: ["opco_sans_accord"],
    });

    await synchroniserAlertes();

    expect(idsResolus()).not.toContain("au-dela-du-plafond");
    // Contre-témoin : la troncature d'UNE règle ne gèle pas les autres codes.
    expect(idsResolus()).toContain("cause-disparue");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ce qui ne se ferme JAMAIS tout seul — et reste ainsi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La fermeture est ici un acte humain VOULU (analyse, action corrective, lecture
 * d'un message, information des stagiaires) ou l'alerte naît d'un événement que
 * le balayage ne revoit jamais. Chaque motif est écrit au catalogue ; ce témoin
 * empêche qu'une passe « tout se ferme seul » les emporte au passage.
 */
const FERMETURE_HUMAINE = [
  "satisfaction_sous_seuil",
  "opco_formation_demarree_sans_accord",
  "qualiopi_expire",
  "sous_traitant_qualiopi_expire",
  "suppression_rgpd_j30",
  "evaluation_acquis_manquante",
  "positionnement_hors_delai",
  "formateur_message_apres_delai",
  "stagiaires_non_prevenus_changement_formateur",
  "besoin_adaptation_declare",
  "cloture_trace_presence_incomplete",
  "report_accord_financement_a_refaire",
  "job_ia_echoue",
] as const;

describe("les fermetures humaines ne sont pas emportées", () => {
  it.each(FERMETURE_HUMAINE)("%s — reste à fermeture humaine, motif écrit", (code) => {
    const entree = ALERTE_CATALOGUE[code];
    expect(entree?.resolutionAuto).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Le rappel J-7 : aucune session ne tombe hors de la lecture
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 rappel J-7 — la lecture n'est pas plafonnée", () => {
  it("sessionsSansRappelJ7 ne pose pas de `take` : une session hors plafond serait fermée à tort", async () => {
    // Depuis que le code se referme seul, une session que la requête n'a pas
    // RAMENÉE est une session dont l'alerte se ferme. Le plafond de 100 rendait
    // la 101e indiscernable d'une session régularisée.
    findManySessions.mockResolvedValue([]);
    await sessionsSansRappelJ7(new Date("2026-09-15T07:00:00Z"));
    const args = findManySessions.mock.calls[0]?.[0] as { take?: number };
    expect(args).toBeDefined();
    expect(args.take).toBeUndefined();
  });
});
