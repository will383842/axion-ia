/**
 * 🔴 LA FICHE SESSION DIT LA VÉRITÉ SUR L'ÉMARGEMENT — CE QUI PART SEUL, ET CE QUI MANQUE.
 *
 * ## Deux défauts de la seule session réelle (AXI-SESS-2026-001)
 *
 * 1. L'étape des liens affichait « Manuel — Émettre les liens, ou joints au
 *    rappel J-7 ». Une session réservée moins de 7 jours avant n'a jamais de
 *    rappel J-7 : lu au pied de la lettre, le texte disait que les liens ne
 *    partiraient jamais seuls. Depuis ce lot, ils partent seuls — le texte doit
 *    le dire, et dire le seul résidu (un QR imprimé un autre jour).
 *
 * 2. Aucune contresignature du formateur n'a été recueillie, et AUCUNE surface
 *    ne le signalait : ni la fiche, ni l'accueil du formateur. Une étape dédiée
 *    le rend visible tant qu'il manque — non bloquante (décision de Will).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { construireParcours, type SessionParcoursInput } from "../session-parcours";
import { entreeParcours, type LigneSessionParcours } from "../echeances-service";
import { ETAPES_DU_FORMATEUR, GESTE_FORMATEUR } from "@/server/formateur/etapes-formateur";

const d = (iso: string) => new Date(iso);

function dossier(patch: Partial<SessionParcoursInput> = {}): SessionParcoursInput {
  return {
    session: {
      statut: "en_cours",
      dateDebut: d("2026-09-16T07:00:00.000Z"),
      dateFin: d("2026-09-17T15:00:00.000Z"),
      formateurPrincipalId: "t-1",
      financementType: "direct",
    },
    documents: [],
    signaturesParPiece: new Map(),
    inscriptions: [
      {
        id: "e1",
        statut: "planifiee",
        emargementSigneAt: d("2026-09-16T10:00:00.000Z"),
        convocationEnvoyeeAt: d("2026-09-10T08:00:00.000Z"),
        questionnaires: [],
        evaluationFinaleAt: null,
        aUnAccesPortail: true,
      },
    ],
    liensEmargementActifs: 1,
    creneauxEmargement: 4,
    contresignature: { signees: 2, aContresigner: 2 },
    maintenant: d("2026-09-17T18:00:00.000Z"),
    ...patch,
  } as SessionParcoursInput;
}

const etape = (p: ReturnType<typeof construireParcours>, cle: string) =>
  p.etapes.find((e) => e.cle === cle);

describe("1. l'étape des liens dit qu'ils partent seuls", () => {
  it("🔴 le geste n'est plus « Manuel — … ou joints au rappel J-7 »", () => {
    const e = etape(construireParcours(dossier()), "liens_signature_emis");
    expect(e?.geste).not.toMatch(/^Manuel/);
    expect(e?.geste).not.toMatch(/joints au rappel J-7\.$/);
    expect(e?.geste).toMatch(/^Automatique/);
    // Les trois moments réels, nommés : sans eux, « automatique » ne dit pas
    // QUAND, et une session réservée la veille relirait le même doute.
    expect(e?.geste).toMatch(/rappel J-7/);
    expect(e?.geste).toMatch(/veille/);
    expect(e?.geste).toMatch(/jour m[êe]me/);
  });

  it("l'avertissement dit le résidu, et ce qui n'est jamais remplacé", () => {
    const e = etape(construireParcours(dossier()), "liens_signature_emis");
    expect(e?.avertissement).toMatch(/ne l'ENVOIE pas/);
    expect(e?.avertissement).toMatch(/aujourd'hui/);
    expect(e?.avertissement).toMatch(/imprimé/);
  });
});

describe("1 bis. l'écran « Liens de signature » de la console dit la même chose", () => {
  // Retire les commentaires JSX et TS : la prose qui EXPLIQUE l'ancien défaut
  // le cite forcément, seul le texte rendu compte.
  const source = readFileSync(
    join(process.cwd(), "src/components/admin/qualiopi/LiensEmargement.tsx"),
    "utf8",
  )
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    // Le JSX coupe les phrases sur plusieurs lignes : on lit le texte, pas la mise en page.
    .replace(/\s+/g, " ");

  it("🔴 ne dit plus que seul un rattrapage « du jour J » envoie les liens", () => {
    expect(source).not.toMatch(/le rattrapage automatique du jour J enverra les liens/);
  });

  it("dit qu'ils partent seuls, et ce que l'envoi automatique ne remplace jamais", () => {
    expect(source).toMatch(/partent seuls/);
    expect(source).toMatch(/fabriqué aujourd&apos;hui|fabriqué aujourd'hui/);
    expect(source).toMatch(/imprimé la veille/);
  });
});

describe("2. la contresignature du formateur a son étape", () => {
  it("🔴 demi-journées signées sans contresignature → l'étape est ouverte, et le DIT", () => {
    const p = construireParcours(dossier());
    const e = etape(p, "contresignature_formateur");
    expect(e, "aucune étape ne signale la contresignature manquante").toBeDefined();
    expect(e?.etat).not.toBe("fait");
    expect(e?.etat).not.toBe("sans_objet");
    expect(e?.avancement).toEqual({ fait: 0, total: 2 });
    expect(e?.avertissement).toMatch(/non bloquant/i);
    // Jamais « hors délai » : contresigner tard reste possible et utile.
    expect(e?.motifSansBorne).toBeDefined();
  });

  it("le geste dit que la DEMANDE est automatique, pas la signature", () => {
    const e = etape(construireParcours(dossier()), "contresignature_formateur");
    expect(e?.geste).toMatch(/^Automatique/);
    expect(e?.geste).toMatch(/formateur/);
    expect(e?.geste).toMatch(/jamais .*à sa place|personne ne signe à sa place/i);
  });

  it("tout contresigné → fait", () => {
    const e = etape(
      construireParcours(dossier({ contresignature: { signees: 2, aContresigner: 0 } })),
      "contresignature_formateur",
    );
    expect(e?.etat).toBe("fait");
  });

  it("aucune demi-journée signée terminée → sans objet", () => {
    const e = etape(
      construireParcours(dossier({ contresignature: { signees: 0, aContresigner: 0 } })),
      "contresignature_formateur",
    );
    expect(e?.etat).toBe("sans_objet");
  });

  it("🔴 l'étape concerne le FORMATEUR : elle entre dans son accueil, avec SON geste", () => {
    const table = ETAPES_DU_FORMATEUR as Record<string, boolean>;
    const gestes = GESTE_FORMATEUR as Record<string, string | undefined>;
    expect(table["contresignature_formateur"]).toBe(true);
    expect(gestes["contresignature_formateur"]).toMatch(/[Cc]ontresignez/);
  });
});

describe("3. la traduction ligne Prisma → parcours compte les demi-journées", () => {
  const jourDb = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const ligne = {
    statut: "en_cours",
    dateDebut: d("2026-09-16T07:00:00.000Z"),
    dateFin: d("2026-09-17T15:00:00.000Z"),
    formateurPrincipalId: "t-1",
    financementType: null,
    sessionRemplacement: [],
    documents: [],
    jours: [
      { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: null },
      { date: jourDb("2026-09-17"), heureDebut: "09:00", heureFin: "17:00", trainerId: null },
    ],
    emargementContresignatures: [{ date: jourDb("2026-09-16"), demiJournee: "matin" }],
    enrollments: [
      {
        id: "e1",
        statut: "planifiee",
        emargementSigneAt: null,
        convocationEnvoyeeAt: null,
        questionnaires: [],
        evaluations: [],
        emargementTokens: [],
        presences: [
          {
            id: "p1",
            date: jourDb("2026-09-16"),
            demiJournee: "matin",
            emargementSignatures: [{ id: "s1" }],
          },
          {
            id: "p2",
            date: jourDb("2026-09-16"),
            demiJournee: "apres_midi",
            emargementSignatures: [{ id: "s2" }],
          },
          // Créneau sans signature : ne compte pas.
          { id: "p3", date: jourDb("2026-09-17"), demiJournee: "matin", emargementSignatures: [] },
        ],
        trainee: { portailAcces: [] },
      },
    ],
  } as unknown as LigneSessionParcours;

  it("🔴 signées et à contresigner viennent du MÊME bilan que l'e-mail au formateur", () => {
    const e = entreeParcours(ligne, new Map(), d("2026-09-16T18:00:00.000Z"));
    expect(e.contresignature).toEqual({ signees: 2, aContresigner: 1 });
  });
});
