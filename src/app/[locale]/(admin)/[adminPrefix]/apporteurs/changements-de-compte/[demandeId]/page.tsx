// Lot 6 : le détail d'une demande de changement de compte, et la décision (super_admin seul).
// L'IBAN n'est jamais affiché : l'administrateur le lit sur le RIB (document) et le recopie ; le
// serveur compare l'empreinte, sans rien rendre.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import {
  refuserChangementCompteAction,
  validerChangementCompteAction,
} from "@/features/apporteurs-reseau/actions-changement-iban";
import { lireDetailDemande } from "@/features/apporteurs-reseau/requetes-changements-iban";
import { peutEngager } from "@/server/auth/habilitations";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetailChangementPage({
  params,
  searchParams,
}: {
  params: Promise<{ adminPrefix: string; demandeId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { adminPrefix, demandeId } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  if (!UUID.test(demandeId)) return <p>Demande introuvable.</p>;
  const detail = await lireDetailDemande(demandeId.toLowerCase());
  if (!detail) return <p>Demande introuvable.</p>;
  const { demande: d, alertes } = detail;
  const peutDecider = peutEngager(acces.role, "valider_changement_iban");
  const base = `/fr/${adminPrefix}/apporteurs/changements-de-compte/${d.id}`;
  const sp = await searchParams;

  async function valider(fd: FormData) {
    "use server";
    const r = await validerChangementCompteAction(fd);
    redirect(`${base}?${r.ok ? "retour=validee" : `erreur=${encodeURIComponent(r.message)}`}`);
  }
  async function refuser(fd: FormData) {
    "use server";
    const r = await refuserChangementCompteAction(fd);
    redirect(`${base}?${r.ok ? "retour=refusee" : `erreur=${encodeURIComponent(r.message)}`}`);
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Changement de compte bancaire"
        description={`Demande du ${jourParis(d.demandeeAt)}, compte demandé se terminant par ${d.fin4}.`}
      />
      <Link href={`/fr/${adminPrefix}/apporteurs/${d.apporteurId}`} className="underline">
        Voir la fiche de l&apos;apporteur
      </Link>
      {sp.retour ? <p role="status">Décision enregistrée.</p> : null}
      {sp.erreur ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {sp.erreur.slice(0, 200)}
        </p>
      ) : null}
      {alertes.map((a) => (
        <p
          key={`${a.code}-${a.apporteurId}`}
          role="alert"
          className="text-[color:var(--color-admin-danger)]"
        >
          {a.code === "deja-connu"
            ? "Ce compte est déjà celui d'un autre apporteur : "
            : "Ce compte a déjà fait l'objet d'une demande contestée : "}
          <Link href={`/fr/${adminPrefix}/apporteurs/${a.apporteurId}`} className="underline">
            voir la fiche
          </Link>
        </p>
      ))}
      <AdminCard as="section">
        <p>
          Compte actuel : se termine par {d.ancienFin4 ?? "—"}. Compte demandé : se termine par{" "}
          {d.fin4}.
        </p>
        <p>
          <AdminBadge>{d.statut}</AdminBadge>
          {d.confirmeeAt ? ` Confirmée le ${jourParis(d.confirmeeAt)}.` : null}
        </p>
        {d.motifRefus ? <p>Motif du refus : {d.motifRefus}</p> : null}
        {peutDecider ? (
          <p>
            <a href={`${base}/rib`} target="_blank" rel="noopener" className="underline">
              Ouvrir le RIB de la demande
            </a>
          </p>
        ) : null}
      </AdminCard>
      {peutDecider && d.statut === "confirmee" ? (
        <>
          <AdminCard as="section">
            <h2 className="font-semibold">Valider</h2>
            {!d.decidable ? (
              <p>Le délai d&apos;opposition de 72 heures n&apos;est pas écoulé.</p>
            ) : null}
            <form action={valider} className="flex flex-col gap-[var(--space-admin-3)]">
              <input type="hidden" name="demandeId" value={d.id} />
              <label>
                <input type="checkbox" name="titulaire" /> Le compte est au nom de l&apos;apporteur
                ou de son entreprise.
              </label>
              <label>
                <input type="checkbox" name="iban" /> L&apos;IBAN du RIB est lisible et complet.
              </label>
              <label>
                <input type="checkbox" name="rappel" /> J&apos;ai rappelé l&apos;apporteur au numéro
                de sa fiche.
              </label>
              <label>
                IBAN lu sur le RIB (recopié, pour contrôle)
                <input
                  name="ibanRecopie"
                  autoComplete="off"
                  maxLength={60}
                  required
                  className="admin-input"
                />
              </label>
              <button type="submit" className="admin-button" disabled={!d.decidable}>
                Valider le changement
              </button>
            </form>
          </AdminCard>
          <AdminCard as="section">
            <h2 className="font-semibold">Refuser</h2>
            <form action={refuser} className="flex flex-col gap-[var(--space-admin-3)]">
              <input type="hidden" name="demandeId" value={d.id} />
              <label>
                Motif (envoyé à l&apos;apporteur)
                <textarea
                  name="motif"
                  required
                  minLength={3}
                  maxLength={500}
                  className="admin-input"
                />
              </label>
              <button type="submit" className="admin-button">
                Refuser la demande
              </button>
            </form>
          </AdminCard>
        </>
      ) : null}
    </div>
  );
}
