// V2-S13 — Fausse pièce : un éditeur ajoute une pièce de GARDE (attestation de
// vigilance URSSAF, avis de situation SIRENE) à la fiche d'un indépendant, puis
// tente de la valider ; un administrateur tente de valider la pièce qu'il a
// lui-même saisie (règle des quatre yeux). Témoin : un autre administrateur
// habilité la valide.

import {
  createTrainerDocumentAction,
  validateTrainerDocumentAction,
} from "@/server/actions/qualiopi/trainer-documents";

import {
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  prisma,
  seConnecter,
} from "../donnees";

async function tenter(f: () => Promise<unknown>): Promise<string> {
  try {
    const r = (await f()) as { error?: string } | null;
    return r !== null && typeof r === "object" && "error" in r ? `refus: ${r.error}` : "ok";
  } catch (e) {
    return `refus: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const hier = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export default async function v2s13(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const editeur = await creerAdmin("editor");
      const admin = await creerAdmin("admin");
      const autreAdmin = await creerAdmin("admin");
      const t = await creerIndependant({ actif: false });

      const ajouter = (type: string) =>
        tenter(() =>
          createTrainerDocumentAction({
            trainerId: t.id,
            type: type as never,
            fichierUrl: "https://example.test/banc/fausse-piece.pdf",
            dateEmission: hier(),
          }),
        );
      seConnecter(editeur);
      const editeurAjoute = {
        attestation_vigilance_urssaf: await ajouter("attestation_vigilance_urssaf"),
        kbis_avis_sirene: await ajouter("kbis_avis_sirene"),
      };
      const pieceEditeur = await prisma.trainerDocument.findFirst({
        where: { trainerId: t.id, type: "attestation_vigilance_urssaf" },
        select: { id: true },
      });
      // La pièce à valider : celle de l'éditeur si elle est née, sinon une pièce
      // posée par le banc (comme la direction l'aurait saisie).
      const cible =
        pieceEditeur ??
        (await prisma.trainerDocument.create({
          data: {
            trainerId: t.id,
            type: "attestation_vigilance_urssaf",
            fichierUrl: "https://example.test/banc/piece.pdf",
            dateEmission: new Date(Date.now() - 86_400_000),
          },
          select: { id: true },
        }));
      const editeurValide = await tenter(() =>
        validateTrainerDocumentAction({ id: cible.id, statutValidation: "valide" }),
      );

      // Quatre yeux : l'administrateur valide la pièce de garde qu'il a saisie.
      seConnecter(admin);
      const ajoutAdmin = await ajouter("kbis_avis_sirene");
      const pieceAdmin = await prisma.trainerDocument.findFirst({
        where: { trainerId: t.id, type: "kbis_avis_sirene" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const adminValideLaSienne = pieceAdmin
        ? await tenter(() =>
            validateTrainerDocumentAction({ id: pieceAdmin.id, statutValidation: "valide" }),
          )
        : "pas de pièce";
      seConnecter(autreAdmin);
      const autreAdminValide = pieceAdmin
        ? await tenter(() =>
            validateTrainerDocumentAction({ id: pieceAdmin.id, statutValidation: "valide" }),
          )
        : "pas de pièce";
      seConnecter(null);

      const valides = await prisma.trainerDocument.findMany({
        where: { trainerId: t.id, statutValidation: "valide" },
        select: { id: true },
      });
      return {
        editeurAjoute,
        pieceEditeurNee: pieceEditeur !== null,
        editeurValide,
        ajoutAdmin,
        adminValideLaSienne,
        autreAdminValide,
        cibleValidee: valides.some((v) => v.id === cible.id),
      };
    });
  } finally {
    await menage();
  }
}
