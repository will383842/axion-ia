// V2-S12 — Donnée personnelle dans une réponse, un journal, une sortie serveur
// ou un e-mail.
//
//   · ÉNUMÉRATION : les deux formulaires publics qui envoient un lien (connexion
//     à l'espace, « retrouver mon dossier ») répondent-ils pareil pour une
//     adresse connue et une inconnue ?
//   · RÉPONSES D'ERREUR : un IBAN refusé (dossier en ligne, espace) ne revient
//     ni dans le message ni dans l'adresse de redirection ;
//   · JOURNAUX : chaque ligne du journal d'activité écrite pour la fiche ou la
//     demande, et TOUT ce que le serveur écrit sur sa sortie pendant les gestes ;
//   · E-MAIL : l'avis F43 (changement de compte) part à l'adresse connue — le
//     spec en lit le corps dans le puits SMTP.
// Valeurs semées reconnaissables, rendues au spec pour la recherche.

// eslint-disable-next-line no-restricted-imports
import { demanderChangementIbanAction } from "@/app/[locale]/espace-formateur/dossier/actions";
// eslint-disable-next-line no-restricted-imports
import { enregistrerActiviteAction } from "@/app/formateur/dossier/[id]/[jeton]/actions";
// eslint-disable-next-line no-restricted-imports
import { demanderLienDossier } from "@/app/formateur/dossier/retrouver/actions";
import { basculerFormateursChangementCoordonneesAction } from "@/server/actions/qualiopi/formateurs-interrupteurs";
import { sendFormateurMagicLinkAction } from "@/server/actions/formateur/auth.actions";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";
import { jetonDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";

import {
  adresse,
  allumerParLaConsole,
  attendre,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  noterReglage,
  prisma,
  seConnecter,
  validerTextesParLaConsole,
} from "../donnees";
import { formulaire, issue, sessionEspace } from "../v2s-outils";
import { poserCookie } from "../../../../fixtures/formateurs/securite-serveur/faux-next-headers";

const IBAN_VALIDE = "FR7630006000011234567890189";
const IBAN_FAUX = "FR7630006000011234567890188";

/** Tout ce que le serveur écrit sur sa sortie pendant `f`. */
async function sortieServeur<T>(f: () => Promise<T>): Promise<{ valeur: T; sortie: string[] }> {
  const sortie: string[] = [];
  // Accès par nom : on REMPLACE les méthodes le temps des gestes, on n'écrit rien.
  const sorties = console as unknown as Record<string, (...args: unknown[]) => void>;
  const noms = ["log", "info", "warn", "error", "debug"];
  const avant = noms.map((n) => sorties[n]);
  const texte = (a: unknown) =>
    a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : JSON.stringify(a);
  for (const n of noms) sorties[n] = (...args) => void sortie.push(args.map(texte).join(" "));
  try {
    return { valeur: await f(), sortie };
  } finally {
    noms.forEach((n, i) => (sorties[n] = avant[i]!));
  }
}

export default async function v2s12(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, ["textes_valides", "dossier_en_ligne"]);
      await validerTextesParLaConsole(direction, [{ gabarit: "formateur-iban-changement" }]);
      await noterReglage("formateurs.changement_coordonnees");
      seConnecter(direction);
      await basculerFormateursChangementCoordonneesAction(
        { ok: true, message: "" },
        formulaire({ actif: "1" }),
      );
      seConnecter(null);

      const actif = await creerIndependant({ actif: true });
      // Une autre fiche active pour l'énumération : son lien de connexion ne doit
      // pas se mêler, dans le puits, à l'avis F43 de la première.
      const connu = await creerIndependant({ actif: true });
      const enCours = await creerIndependant({ dossierStatut: "a_completer" } as never);
      const inconnue = adresse("inconnue");

      const { valeur: r, sortie } = await sortieServeur(async () => {
        const connexion = {
          connue: await sendFormateurMagicLinkAction(undefined, formulaire({ email: connu.email })),
          inconnue: await sendFormateurMagicLinkAction(undefined, formulaire({ email: inconnue })),
        };
        const retrouver = {
          connue: await demanderLienDossier(undefined, formulaire({ email: enCours.email })),
          inconnue: await demanderLienDossier(undefined, formulaire({ email: inconnue })),
        };
        const dossier = await issue(() =>
          enregistrerActiviteAction(
            formulaire({
              id: enCours.id,
              jeton: jetonDossierFormateur(enCours.id, 0, new Date()) ?? "",
              siret: "73282932000074",
              nda: "84691234569",
              regimeTva: "franchise_293b",
              iban: IBAN_FAUX,
            }),
          ),
        );
        poserCookie(FORMATEUR_COOKIE_NAME, await sessionEspace(actif));
        const espaceFaux = await issue(() =>
          demanderChangementIbanAction(formulaire({ iban: IBAN_FAUX })),
        );
        const espaceValide = await issue(() =>
          demanderChangementIbanAction(formulaire({ iban: IBAN_VALIDE })),
        );
        poserCookie(FORMATEUR_COOKIE_NAME, null);
        // Laisse partir les envois lancés sans attente (« retrouver »).
        await new Promise((ok) => setTimeout(ok, 1_500));
        return { connexion, retrouver, dossier, espaceFaux, espaceValide };
      });

      const demandes = await prisma.demandeChangementFormateur.findMany({
        where: { trainerId: actif.id },
        select: { id: true },
      });
      const journal = await prisma.activityLog.findMany({
        where: { targetId: { in: [actif.id, enCours.id, ...demandes.map((d) => d.id)] } },
        select: { action: true, changes: true },
      });
      // L'avis part par la file : on attend que le worker l'ait traité AVANT
      // d'effacer la demande (sans elle, la relecture au départ l'annulerait).
      const avis = await attendre(
        () =>
          prisma.emailLog.findMany({
            where: { recipient: actif.email, template: "formateur-iban-changement" },
            select: { status: true },
          }),
        (l) => l.length > 0 && l.every((x) => x.status !== "pending"),
      );
      const avisF43 = avis.filter((x) => x.status === "sent").length;
      await prisma.demandeChangementFormateur.deleteMany({ where: { trainerId: actif.id } });
      for (const d of demandes) await prisma.activityLog.deleteMany({ where: { targetId: d.id } });

      return {
        r,
        sortie,
        journal,
        avisF43,
        demandes: demandes.length,
        semees: {
          ibanValide: IBAN_VALIDE,
          ibanFaux: IBAN_FAUX,
          emailActif: actif.email,
          emailConnu: connu.email,
          emailEnCours: enCours.email,
          emailInconnue: inconnue,
          telephoneActif: actif.telephone,
          telephoneEnCours: enCours.telephone,
          nom: actif.nom,
          prenomActif: actif.prenom,
          adresseActif: actif.adresse,
        },
      };
    });
  } finally {
    await menage();
  }
}
