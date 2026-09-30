// « E-mail de suivi » d'un rendez-vous (chantier visio, PR 7 ; V-14) — vue de
// l'onglet « Rendez-vous » (`/rendez-vous?emailSuivi=<rencontreId>`), pas une
// page de plus (cliquet des pages de la console : voir `VueCompteRendu.tsx`).
//
// Will choisit le destinataire parmi les participants CLIENT validés du
// rendez-vous, puis :
//   · « Préparer l'e-mail » : le worker le rédige depuis les faits VALIDÉS ;
//   · « Utiliser le modèle fixe » : sans IA, depuis les mêmes faits.
// Dans les deux cas l'e-mail est GARÉ dans « E-mails à valider » : il ne part
// que sur son clic. L'état affiché ici est LU dans `email_outbox`.
//
// Régime REFUS (décision A2) : garde en PREMIÈRE instruction, avant toute
// lecture. Texte brut, formulaires serveur ; seul le bouton d'envoi
// (`BoutonGeste`) est client, pour se désactiver pendant l'envoi (V1-02).

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { BoutonGeste } from "@/components/admin/visio/BoutonGeste";
import { LIBELLE_ETAT_EMAIL_SUIVI } from "@/features/dossier-client/etat-email-suivi";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { lireEmailsDeSuivi } from "@/features/dossier-client/queries";
import { gesteSuiviAction } from "@/features/dossier-client/suivi-actions";
import { prisma } from "@/lib/prisma";

interface Props {
  readonly locale: string;
  readonly adminPrefix: string;
  readonly rencontreId: string;
  readonly message: string | undefined;
  readonly erreur: string | undefined;
}

const carte =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titre = "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold";
const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const bouton =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-hover)]";

function dateFr(d: Date | null): string {
  return d
    ? d.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

export async function VueEmailSuivi({ locale, adminPrefix, rencontreId, message, erreur }: Props) {
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const base = `/${locale}/${adminPrefix}/rendez-vous`;
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={base} />;
  if (!/^[0-9a-f-]{36}$/.test(rencontreId)) notFound();

  const rencontre = await prisma.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      titre: true,
      clientId: true,
      participants: {
        where: { role: "client", contactId: { not: null } },
        select: { contactId: true },
      },
    },
  });
  if (!rencontre) notFound();
  const ids = rencontre.participants.map((p) => p.contactId).filter((x): x is string => x !== null);
  const [contacts, faitsValides, emails, etape] = await Promise.all([
    prisma.clientContact.findMany({
      where: { id: { in: ids }, statut: "actif" },
      select: { id: true, nom: true, fonction: true, adresses: { select: { nature: true } } },
    }),
    prisma.fait.count({ where: { rencontreId, statut: "valide" } }),
    lireEmailsDeSuivi(rencontreId),
    prisma.traitementVisio.findFirst({
      where: { rencontreId, etape: "email_suivi" },
      select: { statut: true, derniereErreur: true },
    }),
  ]);
  const retour = `${base}?emailSuivi=${rencontreId}`;
  const cache = (geste: string) => (
    <>
      <input type="hidden" name="geste" value={geste} />
      <input type="hidden" name="retour" value={retour} />
      <input type="hidden" name="rencontreId" value={rencontreId} />
    </>
  );

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <a href={`${base}/rencontres/${rencontreId}`} className={discret}>
          ← Compte rendu du rendez-vous
        </a>
      </div>
      <AdminPageHeader
        title="E-mail de suivi"
        description={`${rencontre.titre} — préparé depuis les faits validés, relu par vous avant tout envoi.`}
      />
      {message ? <p className="mb-[var(--space-admin-3)]">{message}</p> : null}
      {erreur ? (
        <p className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-error)]">{erreur}</p>
      ) : null}

      <section className={carte}>
        <h2 className={titre}>Préparer</h2>
        {faitsValides === 0 ? (
          <p className={discret}>
            Validez d&apos;abord le compte rendu : l&apos;e-mail part des faits validés.
          </p>
        ) : contacts.length === 0 ? (
          <p className={discret}>
            Aucun participant client n&apos;est rattaché à une personne de la fiche : rattachez-le
            dans « Après l&apos;appel ».
          </p>
        ) : (
          <ul className="space-y-[var(--space-admin-3)]">
            {contacts.map((c) => (
              <li key={c.id}>
                <p className="font-medium">
                  {c.nom}
                  {c.fonction ? <span className={discret}> · {c.fonction}</span> : null}
                  {c.adresses.length === 0 ? (
                    <span className={discret}> (aucune adresse e-mail sur sa fiche)</span>
                  ) : null}
                </p>
                <div className="mt-[var(--space-admin-1)] flex flex-wrap gap-[var(--space-admin-2)]">
                  <form action={gesteSuiviAction}>
                    {cache("email_preparer")}
                    <input type="hidden" name="contactId" value={c.id} />
                    <BoutonGeste className={bouton}>
                      Préparer l&apos;e-mail (rédigé depuis les faits)
                    </BoutonGeste>
                  </form>
                  <form action={gesteSuiviAction}>
                    {cache("email_gabarit_fixe")}
                    <input type="hidden" name="contactId" value={c.id} />
                    <BoutonGeste className={bouton}>Utiliser le modèle fixe</BoutonGeste>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {etape?.statut === "echec_definitif" ? (
          <p className="mt-[var(--space-admin-3)]">
            La rédaction automatique a échoué : utilisez le modèle fixe.
          </p>
        ) : null}
        <p className={`mt-[var(--space-admin-3)] ${discret}`}>
          Rien ne part sans votre clic : l&apos;e-mail attend dans « E-mails à valider », où vous
          pouvez le corriger. Ni prix, ni lien, ni adresse n&apos;y figurent.
        </p>
      </section>

      <section className={carte}>
        <h2 className={titre}>E-mails de suivi de ce rendez-vous</h2>
        {emails.length === 0 ? (
          <p className={discret}>Aucun pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            {emails.map((e) => (
              <li key={e.id}>
                {dateFr(e.creeLe)} — {e.contactNom} — {LIBELLE_ETAT_EMAIL_SUIVI[e.etat]}
                {e.sujet ? <span className={discret}> · « {e.sujet} »</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageShell>
  );
}
