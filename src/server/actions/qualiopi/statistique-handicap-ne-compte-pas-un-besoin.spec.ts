/**
 * Le compte « situation de handicap » ne compte plus un simple besoin d'adaptation.
 *
 * 🔴 Dette D4 de la relecture sécurité #1095 (décision du 2026-09-15). Un « oui »
 * au besoin d'adaptation du positionnement cochait `Trainee.situationHandicap`.
 * Or la question couvre aussi une difficulté d'accès, un aménagement, un problème
 * de santé passager : la personne était comptée « en situation de handicap » —
 * tuile de la liste des stagiaires (`countTrainees`), indicateurs 20 et 26 du
 * moteur de conformité (`trainee.count({ situationHandicap: true })`, même filtre).
 *
 * Ces cas rejouent les DEUX gestes sur une même fiche en mémoire, puis relisent
 * le compteur réel : un « oui » au positionnement n'y entre pas ; la case cochée
 * en console, si.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Fiche {
  id: string;
  prenom: string;
  nom: string;
  situationHandicap: boolean;
  handicapDetailsChiffre: string | null;
  deletedAt: Date | null;
}

const fiches = new Map<string, Fiche>();

function lire(id: string): Fiche {
  const f = fiches.get(id);
  if (f === undefined) throw new Error(`fiche absente : ${id}`);
  return f;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      update: async ({ where, data }: { where: { id: string }; data: Partial<Fiche> }) => {
        const f = lire(where.id);
        Object.assign(f, data);
        return { id: f.id, prenom: f.prenom, nom: f.nom };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const f = fiches.get(where.id);
        return f === undefined ? null : { id: f.id, prenom: f.prenom, nom: f.nom };
      },
      count: async ({ where }: { where: Record<string, unknown> }) =>
        [...fiches.values()].filter((f) =>
          Object.entries(where).every(([cle, valeur]) => {
            // Un filtre composé (OR, relation…) ne serait pas évalué ici : on
            // refuse plutôt que de rendre un faux zéro.
            if (valeur !== null && typeof valeur === "object") {
              throw new Error(`filtre non simulé : ${cle}`);
            }
            return (f as unknown as Record<string, unknown>)[cle] === valeur;
          }),
        ).length,
    },
    questionnaire: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => true) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: vi.fn(async () => null),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireSuperAdmin: vi.fn(),
  logQualiopiActivity: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/portail/cookie", () => ({
  getPortailToken: vi.fn(async () => "jeton"),
  setPortailCookie: vi.fn(),
  clearPortailCookie: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  verifierToken: vi.fn(),
  creerAcces: vi.fn(),
  revoquerAcces: vi.fn(),
  demanderAccesParEmail: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({ creerDemandeRgpd: vi.fn() }));
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  soumettreReponses: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
// ⚠️ Doublon COMPLET et FIDÈLE : la garde partagée `chiffrerDetailSante` lit
// `isEncryptedPii` et refuse d'écrire si le chiffrement n'a rien transformé.
// Sans ces deux exports, l'appel lève, l'exception est absorbée par le
// fail-soft du chemin, et le détail n'est PAS écrit — un rouge qui ne dit rien
// du sujet testé. La garde d'idempotence est reproduite, comme dans le module réel.
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => (v.startsWith("enc:") ? v : `enc:${v}`),
  decryptPii: (v: string | null) => v,
  isEncryptedPii: (v: unknown) => typeof v === "string" && v.startsWith("enc:"),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));

import { soumettreSatisfactionPortailAction } from "./portail";
import { updateTraineeAction } from "./trainees";
import { countTrainees } from "@/server/qualiopi/trainees/trainees";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { soumettreReponses } from "@/server/qualiopi/satisfaction/satisfaction-service";
import { prisma } from "@/lib/prisma";

const BESOIN = "11111111-2222-4333-8444-555555555555";
const HANDICAP = "66666666-7777-4888-9999-aaaaaaaaaaaa";
const QUEST_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

function fiche(id: string, prenom: string): Fiche {
  return {
    id,
    prenom,
    nom: "Test",
    situationHandicap: false,
    handicapDetailsChiffre: null,
    deletedAt: null,
  };
}

beforeEach(() => {
  fiches.clear();
  fiches.set(BESOIN, fiche(BESOIN, "Besoin"));
  fiches.set(HANDICAP, fiche(HANDICAP, "Handicap"));
  vi.mocked(verifierToken).mockResolvedValue({ traineeId: BESOIN } as never);
  vi.mocked(soumettreReponses).mockResolvedValue({ id: QUEST_ID } as never);
  // Même forme que `adaptation.spec.ts` : l'appartenance seule. Le contrôle du
  // oui/non explicite propre au type « positionnement » (#1099) est verrouillé
  // par ses propres specs ; ce fichier ne vérifie que la coche.
  vi.mocked(prisma.questionnaire.findUnique).mockResolvedValue({
    enrollment: { traineeId: BESOIN },
  } as never);
});

describe("🔴 D4 — compte « situation de handicap »", () => {
  it("un « oui » au positionnement, avec ou sans précision, n'y entre PAS", async () => {
    for (const reponses of [
      { besoinAdaptation: true },
      { besoinAdaptation: true, detailAdaptation: "Difficulté d'accès au bâtiment" },
    ]) {
      const r = await soumettreSatisfactionPortailAction({ questionnaireId: QUEST_ID, reponses });
      expect("data" in r).toBe(true);
    }

    expect(lire(BESOIN).situationHandicap).toBe(false);
    expect(await countTrainees({ situationHandicap: true })).toBe(0);
    // Le détail, lui, est bien rangé chiffré : on n'a rien perdu de la déclaration.
    expect(lire(BESOIN).handicapDetailsChiffre).toBe("enc:Difficulté d'accès au bâtiment");
  });

  it("la case cochée en console y entre toujours", async () => {
    const r = await updateTraineeAction({ id: HANDICAP, situationHandicap: true });
    expect(r).toEqual({ data: { id: HANDICAP } });

    expect(await countTrainees({ situationHandicap: true })).toBe(1);
    expect(await countTrainees()).toBe(2);
  });

  it("les deux gestes ensemble : seul le geste console compte", async () => {
    await soumettreSatisfactionPortailAction({
      questionnaireId: QUEST_ID,
      reponses: { besoinAdaptation: true },
    });
    await updateTraineeAction({ id: HANDICAP, situationHandicap: true });

    expect(await countTrainees({ situationHandicap: true })).toBe(1);
  });
});
