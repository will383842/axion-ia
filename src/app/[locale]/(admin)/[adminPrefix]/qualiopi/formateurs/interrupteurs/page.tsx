/**
 * Admin — Formateurs freelance › Interrupteurs (lot S0-ter, ADR 0066 (f)).
 *
 * Chaque interrupteur du parcours, son état, ce qui manque pour l'allumer et
 * son dernier changement. Les clés `formateurs.*` ne se changent QU'ICI :
 * l'éditeur générique de réglages les refuse.
 */

import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import {
  INTERRUPTEURS,
  estPositionSure,
  prealablesManquants,
  type CleInterrupteur,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-lecture";
import {
  basculerFormateursActivationAutoAction,
  basculerFormateursChoixSuivantsAction,
  basculerFormateursCommunesGeoCronAction,
  basculerFormateursContratAutoAction,
  basculerFormateursControleRegistrePeriodiqueAction,
  basculerFormateursDossierEnLigneAction,
  basculerFormateursEchangeOuvertAction,
  basculerFormateursGardeActivationAction,
  basculerFormateursGardeMissionAction,
  basculerFormateursInvitationAutoAction,
  basculerFormateursLettreAutoAction,
  basculerFormateursPassagePaiementAction,
  basculerFormateursPiecesCronAction,
  basculerFormateursProchesBlocAction,
  basculerFormateursRelancesAutoAction,
  basculerFormateursTextesValidesAction,
} from "@/server/actions/qualiopi/formateurs-interrupteurs";

import { BoutonInterrupteur } from "./BoutonInterrupteur";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Interrupteurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const ACTIONS: Record<CleInterrupteur, typeof basculerFormateursTextesValidesAction> = {
  textes_valides: basculerFormateursTextesValidesAction,
  echange_ouvert: basculerFormateursEchangeOuvertAction,
  invitation_auto: basculerFormateursInvitationAutoAction,
  dossier_en_ligne: basculerFormateursDossierEnLigneAction,
  relances_auto: basculerFormateursRelancesAutoAction,
  pieces_cron: basculerFormateursPiecesCronAction,
  controle_registre_periodique: basculerFormateursControleRegistrePeriodiqueAction,
  contrat_auto: basculerFormateursContratAutoAction,
  garde_activation: basculerFormateursGardeActivationAction,
  activation_auto: basculerFormateursActivationAutoAction,
  garde_mission: basculerFormateursGardeMissionAction,
  lettre_auto: basculerFormateursLettreAutoAction,
  choix_suivants: basculerFormateursChoixSuivantsAction,
  passage_paiement: basculerFormateursPassagePaiementAction,
  communes_geo_cron: basculerFormateursCommunesGeoCronAction,
  proches_bloc: basculerFormateursProchesBlocAction,
};

function libelleEtat(valeur: boolean | string | null, cle: CleInterrupteur): string {
  const sorte = INTERRUPTEURS[cle].sorte;
  if (sorte === "date") return typeof valeur === "string" ? `Le ${valeur}` : "Pas de date";
  if (sorte === "garde_niveau") return valeur === "avertir" ? "Avertir" : "Refuser";
  if (sorte === "garde") return valeur === true ? "Garde active" : "Garde levée";
  return valeur === true ? "Allumé" : "Coupé";
}

const DATE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function InterrupteursFormateursPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const { etats, lignes } = await lireInterrupteurs();
  const direction = acces.role === "super_admin" || acces.role === "admin";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Interrupteurs"
        description="Formateurs freelance. Couper est toujours possible ; allumer exige ses préalables."
      />
      <AdminCard>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Interrupteur</th>
              <th>État</th>
              <th>Préalables manquants</th>
              <th>Dernier changement</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const def = INTERRUPTEURS[l.cle];
              const sure = estPositionSure(l.cle, l.valeur);
              const cible =
                def.sorte === "garde_niveau"
                  ? l.valeur === "avertir"
                    ? "refuser"
                    : "avertir"
                  : def.sorte === "date"
                    ? "2000-01-01"
                    : l.valeur !== true;
              const manques = sure ? prealablesManquants(l.cle, cible, etats) : [];
              const habilite =
                def.habilitation === "valider_texte_email"
                  ? acces.role === "super_admin"
                  : direction;
              return (
                <tr key={l.cle}>
                  <td>
                    <strong>{def.libelle}</strong>
                    <div className="admin-meta-small">{def.aide}</div>
                  </td>
                  <td>
                    <AdminBadge tone={sure ? "neutral" : "success"}>
                      {libelleEtat(l.valeur, l.cle)}
                    </AdminBadge>
                    {!l.lisible && l.misAJourLe ? (
                      <div className="admin-meta-small">Valeur illisible : position sûre.</div>
                    ) : null}
                  </td>
                  <td>
                    {manques.length ? (
                      <ul className="admin-meta-small">
                        {manques.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="admin-meta-small">—</span>
                    )}
                  </td>
                  <td className="admin-meta-small">
                    {l.misAJourLe
                      ? `${DATE.format(l.misAJourLe)}${l.misAJourPar ? ` · ${l.misAJourPar}` : ""}`
                      : "Jamais"}
                  </td>
                  <td>
                    <BoutonInterrupteur
                      action={ACTIONS[l.cle]}
                      sorte={def.sorte}
                      valeur={l.valeur}
                      desactive={!habilite}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>
    </AdminPageShell>
  );
}
