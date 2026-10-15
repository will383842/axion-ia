// E29 — Un ÉDITEUR tente les gestes qui engagent : tous doivent être refusés.
//
// Chaque geste passe par son ACTION de console, sous une session `editor`
// réelle de la base du banc. On rend la réponse de l'action ET l'état en base
// après coup (rien ne doit avoir bougé).

import { creerFicheFormateurDepuisCandidatureAction } from "@/features/admin-job-applications/fiche-formateur-actions";
import { enregistrerIssueFormateurAction } from "@/features/admin-rendezvous/issue-formateur-actions";
import { setFormateurActifAction } from "@/server/actions/coaching-admin/formateurs.actions";
import { contresignerEtOuvrirEspaceAction } from "@/server/actions/qualiopi/formateurs-verifier-contresigner";
import { basculerFormateursTextesValidesAction } from "@/server/actions/qualiopi/formateurs-interrupteurs";
import {
  createTrainerDocumentAction,
  validateTrainerDocumentAction,
} from "@/server/actions/qualiopi/trainer-documents";
import { setTrainerActifAction, updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import {
  validerTexteEmailAction,
  validerTexteEmailFormAction,
  validerTousTextesFormateursAction,
} from "@/server/email/textes-valides-actions";
import {
  empreinteAttendue,
  listeDesTextesAffichee,
  TEXTES_FORMATEURS_A_VALIDER,
} from "@/server/email/textes-formateurs-a-valider";
import { cleTexteValide } from "@/server/email/textes-valides";

import {
  adresse,
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  noterReglage,
  prisma,
  seConnecter,
} from "../donnees";

/** Rend la réponse, ou le message de l'exception (les gardes `require*` lèvent). */
async function tenter(f: () => Promise<unknown>): Promise<unknown> {
  try {
    return await f();
  } catch (e) {
    return { leve: e instanceof Error ? e.message : String(e) };
  }
}

export default async function e29(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const editeur = await creerAdmin("editor");
      // « Retenu » ne s'atteint qu'avec le suivi de l'échange allumé : sinon
      // l'action refuserait pour une autre raison que le rôle.
      await allumerParLaConsole(direction, ["textes_valides", "echange_ouvert", "suivi_echange"]);

      const t = await creerIndependant({
        actif: false,
        sousTraitantVerifieAt: new Date(Date.now() - 86_400_000),
        sousTraitantNda: "84691234569",
      });
      const gabarit = "formateur-invitation-relance";
      const cleTexte = cleTexteValide(gabarit);
      await noterReglage(cleTexte);
      const texteAvant = await prisma.setting.findUnique({ where: { key: cleTexte } });

      seConnecter(editeur);
      const r: Record<string, unknown> = {};

      // (a) activer
      r["activer_fiche"] = await tenter(() => setTrainerActifAction({ id: t.id, actif: true }));
      r["activer_coaching"] = await tenter(() =>
        setFormateurActifAction({ trainerId: t.id, actif: true } as never),
      );
      r["contresigner"] = await tenter(() =>
        contresignerEtOuvrirEspaceAction({
          trainerId: t.id,
          codeAttestation: "BANC",
          attestationAuthentique: true,
          piecesVerifiees: true,
          formationIds: [],
          orangeVerifie: false,
          motifOrange: null,
        } as never),
      );

      // (b) pièce de garde : ajout, puis validation
      r["ajouter_piece"] = await tenter(() =>
        createTrainerDocumentAction({
          trainerId: t.id,
          type: "attestation_vigilance_urssaf",
          dateEmission: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        }),
      );
      // L'ajout est refusé à l'éditeur (écart E29 corrigé) : la pièce à valider est
      // posée par le banc, comme la direction l'aurait saisie, pour éprouver la validation.
      const piece =
        (await prisma.trainerDocument.findFirst({
          where: { trainerId: t.id, type: "attestation_vigilance_urssaf" },
          select: { id: true, statutValidation: true },
        })) ??
        (await prisma.trainerDocument.create({
          data: {
            trainerId: t.id,
            type: "attestation_vigilance_urssaf",
            dateEmission: new Date(Date.now() - 86_400_000),
          },
          select: { id: true, statutValidation: true },
        }));
      r["valider_piece"] = piece
        ? await tenter(() =>
            validateTrainerDocumentAction({ id: piece.id, statutValidation: "valide" }),
          )
        : null;

      // (c) textes `formateur-*` : valider, approuver tout, allumer l'interrupteur
      r["valider_texte"] = await tenter(() =>
        validerTexteEmailAction({
          gabarit,
          valide: true,
          empreinte: empreinteAttendue(cleTexte) ?? "",
        }),
      );
      const fdTexte = new FormData();
      fdTexte.set("gabarit", gabarit);
      fdTexte.set("valide", "1");
      fdTexte.set("empreinte", empreinteAttendue(cleTexte) ?? "");
      r["valider_texte_formulaire"] = await tenter(() =>
        validerTexteEmailFormAction({ ok: true, message: "" } as never, fdTexte),
      );
      const fdTous = new FormData();
      fdTous.set("confirme", "oui");
      fdTous.set("nombre", String(TEXTES_FORMATEURS_A_VALIDER.length));
      fdTous.set("liste", listeDesTextesAffichee());
      r["approuver_tous"] = await tenter(() =>
        validerTousTextesFormateursAction({ ok: true, message: "" } as never, fdTous),
      );
      const fdInt = new FormData();
      fdInt.set("actif", "1");
      r["interrupteur_textes"] = await tenter(() =>
        basculerFormateursTextesValidesAction({ ok: true, message: "" }, fdInt),
      );

      // (d) « Retenu »
      const fdIssue = new FormData();
      fdIssue.set("calendlyEventId", `BANC-${t.id.slice(0, 8)}`);
      fdIssue.set("issue", "retenu");
      fdIssue.set("confirmer", "oui");
      r["retenu"] = await tenter(() =>
        enregistrerIssueFormateurAction({ etat: "initial" } as never, fdIssue),
      );
      r["fiche_depuis_candidature"] = await tenter(() =>
        creerFicheFormateurDepuisCandidatureAction({ candidatureId: t.id }),
      );

      // (e) changer l'adresse d'un indépendant
      const nouvelle = adresse("nouvelle");
      r["changer_email"] = await tenter(() => updateTrainerAction({ id: t.id, email: nouvelle }));

      const apres = await prisma.trainer.findUniqueOrThrow({
        where: { id: t.id },
        select: { actif: true, email: true, accesVersion: true },
      });
      const pieceApres = await prisma.trainerDocument.findMany({
        where: { trainerId: t.id },
        select: { type: true, statutValidation: true },
      });
      const texteApres = await prisma.setting.findUnique({ where: { key: cleTexte } });
      const interrupteurTextes = await prisma.setting.findUnique({
        where: { key: "formateurs.textes_valides" },
        select: { value: true },
      });
      const fichesCreees = await prisma.trainer.count({ where: { email: nouvelle } });

      return {
        reponses: r,
        avant: { email: t.email },
        apres,
        pieceApres,
        texteInchange:
          JSON.stringify(texteAvant?.value ?? null) === JSON.stringify(texteApres?.value ?? null),
        interrupteurTextes: interrupteurTextes?.value ?? null,
        fichesCreees,
      };
    });
  } finally {
    await menage();
  }
}
