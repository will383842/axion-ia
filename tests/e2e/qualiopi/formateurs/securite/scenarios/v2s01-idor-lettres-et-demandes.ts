// V2-S01 — IDOR, suite d'E-D4 : ce qu'E-D4 ne visait pas.
//
// A, formateur connecté (vraie session de l'espace), vise chez B :
//   · la LETTRE DE MISSION de B (ancrée sur B, puis ancrée seulement sur la
//     session que B anime) et le CONTRAT DE TRAVAIL de B, par l'URL ;
//   · la demande de changement de COMPTE BANCAIRE et d'ADRESSE, en glissant
//     l'identifiant de B dans le formulaire.
// Témoin pour chaque URL : la même requête sur l'objet de A, qui passe la garde
// (le PDF manque au banc : « pdf_unavailable », jamais « not_found »).

// eslint-disable-next-line no-restricted-imports
import {
  demanderChangementAdresseAction,
  demanderChangementIbanAction,
} from "@/app/[locale]/espace-formateur/dossier/actions";
// eslint-disable-next-line no-restricted-imports
import { GET as lireContratTravail } from "@/app/api/formateur/contrat-travail/[id]/route";
// eslint-disable-next-line no-restricted-imports
import { GET as lireLettre } from "@/app/api/formateur/lettre-mission/[id]/route";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";

import {
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  CLE,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  creerSessionFormation,
  menage,
  noterReglage,
  prisma,
  seConnecter,
} from "../donnees";
import { formulaire, issue, reponse, sessionEspace } from "../v2s-outils";
import { poserCookie } from "../../../../fixtures/formateurs/securite-serveur/faux-next-headers";

const INCONNU = "00000000-0000-4000-8000-0000000000aa";

export default async function v2s01(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, ["textes_valides"]);
      await noterReglage("formateurs.changement_coordonnees");
      seConnecter(direction);
      const { basculerFormateursChangementCoordonneesAction } =
        await import("@/server/actions/qualiopi/formateurs-interrupteurs");
      const allumage = await basculerFormateursChangementCoordonneesAction(
        { ok: true, message: "" },
        formulaire({ actif: "1" }),
      );

      const a = await creerIndependant({ actif: true });
      const b = await creerIndependant({ actif: true });
      const debut = new Date(Date.now() + 20 * 86_400_000);
      const sessionB = await creerSessionFormation(debut);
      await prisma.trainingSession.update({
        where: { id: sessionB.id },
        data: { formateurPrincipalId: b.id },
      });

      const lettreA = await creerPieceASigner(a.id, "lettre_mission", "en_attente");
      const lettreB = await creerPieceASigner(b.id, "lettre_mission", "en_attente");
      // Une lettre sans ancre directe : seul le formateur principal de la session la lit.
      const lettreSessionB = await prisma.documentGenere.create({
        data: {
          type: "lettre_mission",
          numero: `BANC-SECU-${CLE}-LS`,
          hashSha256: "0".repeat(64),
          suppressionPrevueAt: new Date(Date.now() + 10 * 365 * 86_400_000),
          sessionId: sessionB.id,
        } as never,
        select: { id: true },
      });
      const contrat = (trainerId: string, n: string) =>
        prisma.documentGenere.create({
          data: {
            type: "contrat_travail",
            numero: `BANC-SECU-${CLE}-CT${n}`,
            hashSha256: "0".repeat(64),
            suppressionPrevueAt: new Date(Date.now() + 10 * 365 * 86_400_000),
            trainerId,
          } as never,
          select: { id: true },
        });
      const contratA = await contrat(a.id, "A");
      const contratB = await contrat(b.id, "B");

      poserCookie(FORMATEUR_COOKIE_NAME, await sessionEspace(a));
      const get = async (route: typeof lireLettre, id: string) =>
        reponse(
          await route(new Request("http://localhost/x") as never, {
            params: Promise.resolve({ id }),
          }),
        );
      const r = {
        lettre: {
          cible: await get(lireLettre, lettreB.id),
          temoin: await get(lireLettre, lettreA.id),
        },
        lettre_par_session: await get(lireLettre, lettreSessionB.id),
        lettre_inconnue: await get(lireLettre, INCONNU),
        contrat: {
          cible: await get(lireContratTravail, contratB.id),
          temoin: await get(lireContratTravail, contratA.id),
        },
        contrat_inconnu: await get(lireContratTravail, INCONNU),
        // Le formulaire porte l'identifiant de B : l'action doit l'ignorer.
        iban: await issue(() =>
          demanderChangementIbanAction(
            formulaire({ trainerId: b.id, id: b.id, iban: "FR7630006000011234567890189" }),
          ),
        ),
        adresse: await issue(() =>
          demanderChangementAdresseAction(
            formulaire({ trainerId: b.id, id: b.id, adresse: `3 place du Banc ${CLE} 69001 Lyon` }),
          ),
        ),
      };
      poserCookie(FORMATEUR_COOKIE_NAME, null);

      const demandes = await prisma.demandeChangementFormateur.findMany({
        where: { trainerId: { in: [a.id, b.id] } },
        select: { trainerId: true, nature: true },
      });
      await prisma.demandeChangementFormateur.deleteMany({
        where: { trainerId: { in: [a.id, b.id] } },
      });
      await prisma.documentGenere.deleteMany({
        where: { id: { in: [lettreSessionB.id, contratA.id, contratB.id] } },
      });
      return {
        allumage,
        r,
        demandesChezA: demandes
          .filter((d) => d.trainerId === a.id)
          .map((d) => d.nature)
          .sort(),
        demandesChezB: demandes.filter((d) => d.trainerId === b.id).length,
        adresses: [a.email, b.email],
      };
    });
  } finally {
    await menage();
  }
}
