/**
 * Admin — « Virements à faire » (lot D, M9 ; W-8, plan 08 §12.1 / FAC-9).
 *
 * UNE vue, deux flux, AUCUNE fusion (`lireVirementsSortants`) : les commissions
 * des apporteurs et les relevés des formateurs, dans l'ordre de la date cible
 * (dernier jour ouvré au plus tard à l'échéance), orange à J-5, rouge une fois
 * passée.
 *
 *   · Relevés de MISSION : copie de l'IBAN (à la demande, journalisée), du
 *     montant et de la référence ; sélection multiple puis « Virements faits (N) »
 *     — chaque relevé repasse par la transition existante, avec l'empreinte de
 *     l'IBAN affiché. Rubriques suspendues (attestation URSSAF, compte à valider,
 *     nouvel IBAN) lues par la MÊME garde que le clic ; F38 sur geste.
 *   · Relevés MENSUELS et commissions des apporteurs : « Virement fait » reste sur
 *     leur propre écran (lien). Un relevé mensuel lit pourtant la règle C-1 du
 *     changement d'IBAN, comme le clic (relecture de la PR 1561) : il n'est « prêt à
 *     virer » que si aucun changement de compte ne le retient.
 *
 * 🔴 ÉTEINTE par `formateurs.virements_a_faire` : coupée, la page n'existe pas.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { EcranPasEncoreOuvert } from "@/components/admin/qualiopi/EcranPasEncoreOuvert";
import { INTERRUPTEURS_ENTREE } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { CopiesVirement } from "@/components/admin/qualiopi/remuneration/CopiesVirement";
import {
  prevenirVirementEnAttenteFormAction,
  virementsFaitsFormAction,
} from "@/server/actions/qualiopi/virements-a-faire";
import { gardePage } from "@/server/auth/garde-page";
import {
  lireVirementsSortants,
  totauxVirements,
  type CouleurVirement,
} from "@/server/paiements-sortants/virements";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { montantEnTexte } from "@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi";
import { LIBELLE_SUSPENSION_VIREMENT } from "@/server/qualiopi/formateurs-independants/paiement/virement-mission";
import {
  etatsVirementsMensuels,
  etatsVirementsMission,
} from "@/server/qualiopi/formateurs-independants/paiement/virements-a-faire-lecture";
import { echeanceEffective } from "@/server/qualiopi/remuneration/echeance";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Virements à faire | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}

const TON: Record<CouleurVirement, "destructive" | "warning" | "neutral" | "outline"> = {
  rouge: "destructive",
  orange: "warning",
  a_venir: "neutral",
  sans_echeance: "outline",
};
const LIBELLE_COULEUR: Record<CouleurVirement, string> = {
  rouge: "Échéance dépassée",
  orange: "À virer sous 5 jours",
  a_venir: "À venir",
  sans_echeance: "Sans échéance",
};

function jour(iso: string | null): string {
  return iso === null ? "—" : new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR");
}

export default async function VirementsAFairePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!(await lireEtatsEntree()).virements_a_faire) {
    return (
      <EcranPasEncoreOuvert
        titre="Virements à faire"
        interrupteurs={[INTERRUPTEURS_ENTREE.virements_a_faire.libelle]}
        base={`/${locale}/${adminPrefix}`}
      />
    );
  }

  const maintenant = new Date();
  const vue = await lireVirementsSortants(maintenant, echeanceEffective);
  const missions = vue.filter(
    (v) => v.flux === "formateur" && v.origineReleve === "passage_mission",
  );
  const etats = await etatsVirementsMission(
    missions.map((v) => v.pieceId),
    maintenant,
  );
  const autres = vue.filter(
    (v) => !(v.flux === "formateur" && v.origineReleve === "passage_mission"),
  );
  const mensuels = await etatsVirementsMensuels(
    autres
      .filter((v) => v.flux === "formateur")
      .map((v) => ({
        pieceId: v.pieceId,
        trainerId: v.beneficiaireId,
        bloque: v.factureAttendue === true || v.nonConforme === true,
      })),
    maintenant,
  );
  const totaux = totauxVirements(vue);
  const das2 = await interrupteurAllume("das2_commun");
  const base = `/${locale}/${adminPrefix}`;
  const retour = `${base}/qualiopi/remuneration/virements`;
  const annee = maintenant.getFullYear();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Virements à faire"
        description={`${vue.length} virement${vue.length > 1 ? "s" : ""} · ${montantEnTexte(totaux.total)} € · ${totaux.enRetard} en retard`}
      />

      {sp.ok !== undefined && (
        <div className="admin-alert admin-alert-success" role="status">
          {sp.ok}
        </div>
      )}
      {sp.erreur !== undefined && (
        <div className="admin-alert admin-alert-error" role="alert">
          {sp.erreur}
        </div>
      )}

      <AdminCard>
        <h2 className="admin-h2">Honoraires des formateurs (missions)</h2>
        {missions.length === 0 ? (
          <p className="admin-muted">Aucun virement de mission à faire.</p>
        ) : (
          <form
            action={virementsFaitsFormAction}
            className="flex flex-col gap-[var(--space-admin-3)]"
          >
            <input type="hidden" name="retour" value={retour} />
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Sélection</span>
                  </th>
                  <th scope="col">Formateur</th>
                  <th scope="col">Facture</th>
                  <th scope="col" className="text-right">
                    Montant TTC
                  </th>
                  <th scope="col">Virer avant le</th>
                  <th scope="col">Copier</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((v) => {
                  const e = etats.get(v.pieceId);
                  const motifs = e?.motifs ?? ["iban_absent"];
                  const bloque = v.factureAttendue === true || v.nonConforme === true;
                  const payable = !bloque && motifs.length === 0 && e?.empreinte != null;
                  const retard = e?.retard;
                  return (
                    <tr key={v.pieceId}>
                      <td>
                        {payable && (
                          <>
                            <input
                              type="checkbox"
                              name="releve"
                              value={v.pieceId}
                              aria-label={`Virement fait : ${v.reference ?? v.beneficiaire}`}
                            />
                            <input
                              type="hidden"
                              name={`empreinte_${v.pieceId}`}
                              value={e!.empreinte!}
                            />
                            {v.reference !== null && (
                              <input
                                type="hidden"
                                name={`reference_${v.pieceId}`}
                                value={v.reference}
                              />
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        {v.beneficiaire}
                        {e?.fin4 != null && <span className="admin-muted"> · IBAN …{e.fin4}</span>}
                      </td>
                      <td>
                        <Link
                          href={`${base}/qualiopi/remuneration/${v.pieceId}`}
                          className="admin-link"
                        >
                          {v.reference ?? "relevé"}
                        </Link>
                        {v.factureAttendue && (
                          <p className="admin-muted">Facture pas encore émise.</p>
                        )}
                        {v.nonConforme && (
                          <p className="admin-muted">Facture non conforme : virement bloqué.</p>
                        )}
                        {motifs.map((m) => (
                          <p key={m} className="admin-muted">
                            {LIBELLE_SUSPENSION_VIREMENT[m]}
                          </p>
                        ))}
                        {retard != null && retard.joursDeRetard > 0 && (
                          <p className="admin-muted">
                            Retard de {retard.joursDeRetard} j : pénalités{" "}
                            {retard.penalitesCents === null
                              ? "à calculer (taux de la Banque centrale européenne non renseigné)"
                              : `${montantEnTexte(retard.penalitesCents)} €`}{" "}
                            et indemnité de {montantEnTexte(retard.indemniteRecouvrementCents)} €,
                            dues de plein droit — l&apos;outil ne les ajoute pas encore au virement.
                          </p>
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {montantEnTexte(v.montantCents)} €
                      </td>
                      <td>
                        <AdminBadge tone={TON[v.couleur]} compact>
                          {LIBELLE_COULEUR[v.couleur]}
                        </AdminBadge>{" "}
                        {jour(v.dateCible)}
                      </td>
                      <td>
                        <CopiesVirement
                          trainerId={payable ? v.beneficiaireId : null}
                          empreinteAffichee={payable ? (e?.empreinte ?? null) : null}
                          montant={montantEnTexte(v.montantCents)}
                          reference={v.reference}
                        />
                        {motifs.includes("attestation_urssaf_echue_a_la_mission") && (
                          <button
                            type="submit"
                            formAction={prevenirVirementEnAttenteFormAction}
                            formNoValidate
                            name="attente"
                            value={v.pieceId}
                            className="admin-button-ghost mt-[var(--space-admin-2)]"
                          >
                            Prévenir le formateur (attestation URSSAF)
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <label className="flex items-center gap-[var(--space-admin-2)]">
              <input type="checkbox" name="confirmer" value="oui" required />
              Les virements cochés sont partis de la banque.
            </label>
            <div>
              <button type="submit" className="admin-button">
                Virements faits
              </button>
            </div>
            <p className="admin-muted">
              Chaque virement est relu au clic : facture conforme et non contestée, contrat-cadre
              signé, SIREN actif, et IBAN identique à celui affiché. Un virement refusé est signalé
              sans bloquer les autres.
            </p>
          </form>
        )}
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Autres virements (inchangés)</h2>
        <p className="admin-muted">
          « Virement fait » reste sur leur écran : relevés mensuels sur le relevé, commissions sur
          la page des commissions.
        </p>
        <table className="admin-table mt-[var(--space-admin-3)]">
          <thead>
            <tr>
              <th scope="col">Bénéficiaire</th>
              <th scope="col">Pièce</th>
              <th scope="col" className="text-right">
                Montant TTC
              </th>
              <th scope="col">Virer avant le</th>
              <th scope="col">État</th>
            </tr>
          </thead>
          <tbody>
            {autres.map((v) => {
              const m = v.flux === "formateur" ? mensuels.get(v.pieceId) : undefined;
              return (
                <tr key={`${v.flux}-${v.pieceId}`}>
                  <td>
                    {v.beneficiaire}{" "}
                    <AdminBadge tone="outline" compact>
                      {v.flux === "apporteur" ? "Apporteur" : "Formateur (mensuel)"}
                    </AdminBadge>
                  </td>
                  <td>
                    <Link
                      href={
                        v.flux === "apporteur"
                          ? `${base}/apporteurs/commissions`
                          : `${base}/qualiopi/remuneration/${v.pieceId}`
                      }
                      className="admin-link"
                    >
                      {v.reference ?? "relevé"}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{montantEnTexte(v.montantCents)} €</td>
                  <td>
                    <AdminBadge tone={TON[v.couleur]} compact>
                      {LIBELLE_COULEUR[v.couleur]}
                    </AdminBadge>{" "}
                    {jour(v.dateCible)}
                  </td>
                  <td>
                    {m?.pret === true && (
                      <AdminBadge tone="neutral" compact>
                        Prêt à virer
                      </AdminBadge>
                    )}
                    {m?.motifs.map((motif) => (
                      <p key={motif} className="admin-muted">
                        {LIBELLE_SUSPENSION_VIREMENT[motif]}
                      </p>
                    ))}
                    {m?.illisible === true && (
                      <p className="admin-muted">
                        Demandes de changement de compte illisibles : le paiement sera refusé.
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>

      {das2 && (
        <p>
          <a
            href={`${base}/paiements-sortants/das2/export?annee=${annee - 1}`}
            className="admin-link"
          >
            Export DAS 2 de {annee - 1}
          </a>
        </p>
      )}
    </AdminPageShell>
  );
}
