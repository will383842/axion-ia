// Fil unique des échanges d'une fiche client (lot 1, PR-3, 25/10/2026).
// Composant SERVEUR, lecture seule, sans JavaScript. Objet seulement : jamais le corps d'un
// e-mail ni l'adresse du destinataire (la copie complète s'ouvre d'un clic, derrière la console).

import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import type { EchangeDuFil, GenreEchange } from "@/features/dossier-client/fil-des-echanges";
import { NomDestinataire } from "./fiche/NomDestinataire";
import { compterEmails, TuilesEmails } from "./fiche/TuilesEmails";

const GENRE: Readonly<Record<GenreEchange, string>> = {
  rendez_vous: "Rendez-vous",
  email: "E-mail",
  email_en_attente: "E-mail à valider",
  questionnaire: "Questionnaire",
};

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export function FilDesEchanges({
  fil,
  sourcesEnPanne = 0,
  clientId,
  adminPrefix,
  destinataires,
}: {
  fil: ReadonlyArray<EchangeDuFil>;
  /** Sources de lecture en panne : le fil est incomplet. */
  sourcesEnPanne?: number;
  clientId: string;
  adminPrefix: string;
  /** NOM du destinataire par clé de ligne, quand il est connu. Jamais l'adresse. */
  destinataires?: Readonly<Record<string, string>>;
}): React.ReactElement {
  const { envoyes, aValider } = compterEmails(fil);
  const clesAvecNom = fil
    .filter((x) => x.genre === "email" || x.genre === "email_en_attente")
    .map((x) => x.cle)
    .join(",");
  return (
    <section aria-labelledby="fil-des-echanges" className="admin-carte">
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-baseline justify-between gap-[var(--space-admin-3)]">
        <h2 id="fil-des-echanges" className="admin-carte-titre">
          E-mails et courriers de cette fiche
        </h2>
        <Link
          href={`/fr/${adminPrefix}/emails-envoyes?client=${clientId}&fenetre=0`}
          className="admin-link text-[length:var(--text-admin-sm)]"
        >
          Tous les e-mails de cette fiche
        </Link>
      </div>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        E-mails envoyés pour les rendez-vous et le questionnaire, e-mails en attente de validation :
        le plus récent d&apos;abord. L&apos;objet et le contenu de chaque e-mail sont gardés 5 ans ;
        rien n&apos;est supprimé automatiquement.
      </p>
      <TuilesEmails envoyes={envoyes} aValider={aValider} />
      {sourcesEnPanne > 0 ? (
        <p role="alert" className="admin-alert admin-alert-warning mb-[var(--space-admin-3)]">
          <span>
            Une partie du fil n&apos;a pas pu être lue : il est incomplet. Rechargez la page.
          </span>
        </p>
      ) : null}
      {fil.length === 0 && sourcesEnPanne === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun échange rattaché à cette fiche pour l&apos;instant.
        </p>
      ) : fil.length === 0 ? null : (
        <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          {fil.map((e) => (
            <li
              key={e.cle}
              className="flex flex-wrap items-center gap-x-[var(--space-admin-3)] gap-y-[var(--space-admin-1)]"
            >
              <span className="text-[color:var(--color-admin-fg-muted)] tabular-nums">
                {jourHeure(e.date)}
              </span>
              <AdminBadge tone="outline">
                {e.canal === "telegram" ? "Message Telegram" : GENRE[e.genre]}
              </AdminBadge>
              {e.lien !== null && e.genre !== "email" ? (
                <Link href={e.lien} className="admin-link">
                  {e.titre}
                </Link>
              ) : (
                <span>{e.titre}</span>
              )}
              {destinataires !== undefined ? (
                destinataires[e.cle] != null ? (
                  <span className="text-[color:var(--color-admin-fg-muted)]">
                    à {destinataires[e.cle]}
                  </span>
                ) : null
              ) : e.genre === "email" || e.genre === "email_en_attente" ? (
                <NomDestinataire clientId={clientId} cles={clesAvecNom} cle={e.cle} />
              ) : null}
              <span className="text-[color:var(--color-admin-fg-muted)]">{e.etat}</span>
              {e.lien !== null && e.genre === "email" ? (
                <Link href={e.lien} className="admin-link inline-flex min-h-[44px] items-center">
                  Voir la copie
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
