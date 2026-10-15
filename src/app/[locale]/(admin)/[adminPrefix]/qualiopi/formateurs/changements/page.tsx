/**
 * Admin — Formateurs › Changements de compte bancaire et d'adresse (lot E, M12 ;
 * écran W-7, décision 72).
 *
 * Les demandes faites par les formateurs indépendants depuis leur espace. Une demande
 * se valide au plus tôt 48 heures après sa création (le serveur le revérifie) ; tant
 * qu'elle n'est pas validée, les virements attendent (ADR 0066 ; vérification 1, V1-C-1). L'IBAN demandé
 * n'est JAMAIS affiché : en cas de doute, appelez le formateur au numéro connu.
 *
 * Livré ÉTEINT : interrupteur `formateurs.changement_coordonnees` coupé = la page le dit
 * et ne lit rien. Réservée au droit de rémunérer un formateur.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import {
  refuserChangementAction,
  validerChangementAction,
} from "@/server/actions/qualiopi/formateur-changements";
import { lireDemandesAValider } from "@/server/qualiopi/formateurs-independants/changements-coordonnees";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Changements de coordonnées | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const ISSUES: Readonly<Record<string, string>> = {
  valide: "Changement validé : la fiche est à jour et le formateur est prévenu.",
  refusee: "Demande refusée : la fiche n'a pas été modifiée.",
  trop_tot: "Trop tôt : une demande se valide au plus tôt 48 heures après sa création.",
  non_avisee:
    "Validation impossible : l'avis de changement d'IBAN n'est pas parti à l'adresse connue du formateur. Sans cet avis, il n'a pas pu s'y opposer ; refusez la demande, il pourra en faire une nouvelle.",
  fiche_close:
    "Validation impossible : la fiche du formateur n'est plus active, ou la collaboration est terminée.",
  deja_traitee: "Cette demande a déjà été traitée.",
  motif: "Motif obligatoire : indiquez pourquoi la demande est refusée.",
  introuvable: "Demande introuvable.",
  refuse: "Action réservée au droit de rémunérer un formateur.",
  coupe: "Le changement de coordonnées est coupé.",
  erreur: "L'opération n'a pas abouti. Réessayez dans un instant.",
};

const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ChangementsCoordonneesPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!peutEngager(acces.role, "remunerer_formateur")) {
    return (
      <AccesRefuse
        motif="Cette page est réservée aux personnes qui rémunèrent les formateurs."
        retourHref={`/${locale}/${adminPrefix}`}
      />
    );
  }
  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  const allume = await interrupteurAllume("changement_coordonnees");
  const demandes = allume
    ? await lireDemandesAValider(new Date()).catch((err: unknown) => {
        // Le nom de l'erreur seulement : aucune donnée de fiche.
        console.error(
          "[formateurs/changements] lecture indisponible :",
          err instanceof Error ? err.name : "inconnue",
        );
        return null;
      })
    : [];
  const issueBrute = (await searchParams).issue;
  const issue = typeof issueBrute === "string" ? (ISSUES[issueBrute] ?? null) : null;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Changements de compte bancaire et d'adresse"
        description="Demandes des formateurs indépendants. Validation au plus tôt 48 heures après la demande ; d'ici là, les virements sont mis en attente, puis versés sur le nouveau compte."
      />
      {issue && (
        <p role="status" className="admin-card mb-[var(--space-admin-4)]">
          {issue}
        </p>
      )}
      {!allume ? (
        <p className="admin-meta">
          Le changement de coordonnées est coupé (interrupteur{" "}
          <Link href={`${base}/interrupteurs`}>
            « Changement de compte bancaire et d&apos;adresse »
          </Link>
          ).
        </p>
      ) : demandes === null ? (
        <p className="admin-meta">La liste n&apos;a pas pu être lue. Réessayez dans un instant.</p>
      ) : demandes.length === 0 ? (
        <p className="admin-meta">Aucune demande en attente.</p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-4)]">
          {demandes.map((d) => {
            return (
              <li key={d.id} className="admin-card">
                <h2 className="admin-h3">
                  <Link href={`${base}/${d.trainerId}`}>{d.formateur}</Link> —{" "}
                  {d.nature === "iban" ? "compte bancaire" : "adresse professionnelle"}
                </h2>
                <p className="admin-meta">
                  Demandé le {DATE_HEURE.format(d.createdAt)} · validable à partir du{" "}
                  {DATE_HEURE.format(d.validableAt)}
                </p>
                {d.nature === "iban" ? (
                  <p className="admin-meta">
                    Le nouvel IBAN n&apos;est pas affiché. Avant de valider, confirmez la demande
                    avec le formateur, au numéro déjà connu (jamais à un numéro donné dans la
                    demande).
                  </p>
                ) : (
                  <p>Nouvelle adresse : {d.adresse}</p>
                )}
                <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]">
                  <form action={validerChangementAction}>
                    <input type="hidden" name="demandeId" value={d.id} />
                    <button type="submit" className="admin-button" disabled={!d.validable}>
                      Valider
                    </button>
                  </form>
                  <form
                    action={refuserChangementAction}
                    className="flex gap-[var(--space-admin-2)]"
                  >
                    <input type="hidden" name="demandeId" value={d.id} />
                    <input
                      name="motif"
                      required
                      maxLength={500}
                      placeholder="Motif (gardé en console)"
                      aria-label="Motif du refus"
                      className="admin-input"
                    />
                    <button type="submit" className="admin-button-ghost">
                      Refuser
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AdminPageShell>
  );
}
