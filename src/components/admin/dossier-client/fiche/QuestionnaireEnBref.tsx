/**
 * Emplacement du lot B10 : seul ce lot modifie ce fichier.
 * Questionnaire en bref : la réponse en une ligne, la date limite, et le brouillon « Demander au
 * dirigeant de relancer son équipe » (garé « à valider », jamais envoyé ici). On COMPTE les
 * réponses, on n'en montre jamais le contenu. Aucun bouton « relancer » pour un collaborateur.
 */

import Link from "next/link";
import { ClipboardList, MailCheck, Send } from "lucide-react";

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { lireQuestionnairesDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";
import { demanderAuDirigeantDeRelancerSonEquipeAction } from "@/features/dossier-client/fiche/actions-relance-equipe";
import {
  PHRASE_RELANCES_AUTOMATIQUES,
  entreeDepuisSuivi,
  phraseDateLimite,
  phraseEnBref,
  prenomDe,
} from "@/features/dossier-client/fiche/questionnaire-en-bref";
import { prisma } from "@/lib/prisma";
import type { ContexteFiche } from "./contexte";

const LECTURE_IMPOSSIBLE = `${TEXTE_LECTURE_IMPOSSIBLE.charAt(0).toUpperCase()}${TEXTE_LECTURE_IMPOSSIBLE.slice(1)}.`;

async function messageDejaPret(questionnaireId: string): Promise<boolean | null> {
  try {
    const l = await prisma.emailOutbox.findFirst({
      where: {
        template: "questionnaire-relance-equipe",
        entityType: "questionnaire_preaudit",
        entityId: questionnaireId,
        statut: "a_valider",
      },
      select: { id: true },
    });
    return l !== null;
  } catch {
    return null;
  }
}

export async function questionnaireEnBref(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  const tous = await lireQuestionnairesDeLaFiche(ctx.clientId);
  // Le questionnaire en cours : le plus récent déjà envoyé et pas clos.
  const q = tous.find((x) => x.envoyeLe !== null && x.closLe === null);
  if (q === undefined) return null;

  if (q.parPersonneEnPanne === true || q.parPersonne == null) {
    return (
      <AdminBloc teinte="gris" titre="Questionnaire en bref" niveau={2}>
        <p>{LECTURE_IMPOSSIBLE}</p>
      </AdminBloc>
    );
  }
  const suivi = q.parPersonne.suivi;
  const entree = entreeDepuisSuivi(suivi);
  const complet = entree.attendus > 0 && entree.manquants.length + entree.manquantsSansNom === 0;
  const limite = phraseDateLimite(q.expireLe);
  const prenomDirigeant =
    suivi.dirigeant.sourceNom === "brouillon" ? null : prenomDe(suivi.dirigeant.nom);
  const pret = ctx.role === "super_admin" && !complet ? await messageDejaPret(q.id) : false;

  return (
    <AdminBloc
      teinte={complet ? "vert" : "terracotta"}
      titre={
        <>
          <ClipboardList aria-hidden="true" className="inline h-4 w-4" /> Questionnaire en bref
        </>
      }
      niveau={2}
      className="mb-[var(--space-admin-6)]"
    >
      <p data-bloc="questionnaire-en-bref" className="font-medium">
        {phraseEnBref(entree)}
      </p>
      {limite !== null ? <p>{limite}</p> : null}
      <p className="text-[length:var(--text-admin-xs)]">{PHRASE_RELANCES_AUTOMATIQUES}</p>
      {ctx.role === "super_admin" && !complet ? (
        pret === true ? (
          <p className="mt-[var(--space-admin-2)]">
            <MailCheck aria-hidden="true" className="inline h-4 w-4" />{" "}
            <Link className="admin-link" href={`${ctx.qBase}/emails`}>
              Relire le message prêt
            </Link>
          </p>
        ) : pret === null ? (
          <p className="mt-[var(--space-admin-2)]">{LECTURE_IMPOSSIBLE}</p>
        ) : (
          <form
            action={demanderAuDirigeantDeRelancerSonEquipeAction}
            className="mt-[var(--space-admin-2)]"
          >
            <input type="hidden" name="clientId" value={ctx.clientId} />
            <input type="hidden" name="questionnaireId" value={q.id} />
            <AdminButton type="submit" variant="secondary" icon={Send}>
              {prenomDirigeant !== null ? `Demander à ${prenomDirigeant}` : "Demander au dirigeant"}{" "}
              de relancer son équipe
            </AdminButton>
          </form>
        )
      ) : null}
    </AdminBloc>
  );
}
