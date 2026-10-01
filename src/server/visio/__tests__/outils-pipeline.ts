/** Données fictives des tests du circuit (transcription, précontrôles). */

import type { SegmentStocke } from "../dialogue";
import type {
  DonneesPrecontrole,
  EnregistrementATraiter,
  PortDonnees,
  SegmentAEcrire,
} from "../port-donnees";

export const T0 = new Date("2026-10-06T10:00:00Z");

export function seg(
  p: Partial<SegmentStocke> & Pick<SegmentStocke, "piste" | "debutMs" | "texte">,
): SegmentStocke {
  return {
    ordre: p.ordre ?? p.debutMs,
    finMs: p.debutMs + 3_000,
    locuteurBrut: p.piste === "client" ? "A" : null,
    horsAccord: false,
    apresRefus: false,
    ...p,
  };
}

/** Un client qui parle assez pour ne pas être « muet ». */
export function conversation(): SegmentStocke[] {
  const out: SegmentStocke[] = [];
  for (let i = 0; i < 20; i++) {
    out.push(
      seg({
        piste: "axion",
        debutMs: i * 20_000,
        texte: `Question numéro ${i} de Williams sur le projet.`,
      }),
    );
    out.push(
      seg({
        piste: "client",
        debutMs: i * 20_000 + 5_000,
        finMs: i * 20_000 + 15_000,
        texte: `Réponse détaillée ${i} du client sur son besoin de formation.`,
      }),
    );
  }
  return out;
}

export function precontrole(p: Partial<DonneesPrecontrole> = {}): DonneesPrecontrole {
  return {
    enregistrementId: "e1",
    transcriptionId: "tr1",
    nature: "visio",
    dureeMs: 600_000,
    accordDeclareMs: 10_000,
    segments: conversation(),
    preuvesDejaEcrites: 0,
    ...p,
  };
}

export function enregistrement(p: Partial<EnregistrementATraiter> = {}): EnregistrementATraiter {
  return {
    id: "e1",
    rencontreId: "00000000-0000-4000-8000-0000000000f1",
    nature: "visio",
    statut: "depose",
    debut: T0,
    fin: new Date(T0.getTime() + 600_000),
    motifArret: "manuel",
    fenetresHorsAccord: [],
    origineMs: T0.getTime(),
    courtConfirme: false,
    fenetresVerifiees: false,
    tranches: [
      {
        id: "tc0",
        piste: "client",
        numero: 0,
        debutCaptureEpochMs: T0.getTime(),
        dureeMs: 180_000,
        niveauFinMuet: true,
        statut: "complete",
        empreinteAnnoncee: "x",
      },
      {
        id: "ta0",
        piste: "axion",
        numero: 0,
        debutCaptureEpochMs: T0.getTime(),
        dureeMs: 180_000,
        niveauFinMuet: true,
        statut: "complete",
        empreinteAnnoncee: "x",
      },
    ],
    ...p,
  };
}

/** Un port de transcription en mémoire : ce qui est écrit, et dans quel ordre. */
export function portTranscription(
  e: EnregistrementATraiter | readonly EnregistrementATraiter[] | null,
) {
  const liste: readonly EnregistrementATraiter[] =
    e === null ? [] : Array.isArray(e) ? e : [e as EnregistrementATraiter];
  const ecrits: Array<{ trancheId: string; segments: readonly SegmentAEcrire[] }> = [];
  const journal: string[] = [];
  // Modifiable : un test remplace une méthode pour simuler un cas.
  const port: { -readonly [K in keyof PortDonnees]?: PortDonnees[K] } = {
    aTranscrire: async () => liste,
    lireSonTranche: async (id) => {
      journal.push(`lire:${id}`);
      return Buffer.from(id);
    },
    ouvrirTranscription: async () => "tr1",
    purgerSonTranche: async (id) => {
      journal.push(`purger:${id}`);
      return true;
    },
    marquerEnregistrement: async (_tx, _id, statut) => {
      journal.push(`statut:${statut}`);
    },
    ecrireSegmentsTranche: async (_tx, a) => {
      ecrits.push({ trancheId: a.trancheId, segments: a.segments });
    },
    retenirTranscription: async (_tx, a) => {
      journal.push(liste.length > 1 ? `retenue:${a.enregistrementId}` : "retenue");
    },
  };
  return { port, ecrits, journal };
}
