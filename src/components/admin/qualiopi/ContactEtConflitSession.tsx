/**
 * 🔴 Lot L4 (2026-09-30), correction de revue — ce que la fiche 360° du
 * planning montrait et que la fiche session n'avait pas : le CONFLIT de
 * formateur et le téléphone et l'e-mail du CONTACT client. La 308 de la 360°
 * vers la fiche session les faisait disparaître ; ils sont repris ici, en tête
 * de fiche. Server Component, aucun JS client.
 */

import Link from "next/link";

import { PLANNING_TYPE_LABELS, planningDetailHref } from "@/features/admin-planning/types";
import { planningTimeLabel } from "@/features/admin-planning/labels";
import type { ConflitsFormateur } from "@/server/qualiopi/sessions/conflit-formateur";

export interface ContactClientSession {
  nom: string | null;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
}

const labelCls =
  "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
const valueCls =
  "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

export function ContactEtConflitSession({
  adminPrefix,
  contact,
  formateurNom,
  conflits,
}: {
  adminPrefix: string;
  contact: ContactClientSession | null;
  formateurNom: string | null;
  conflits: ConflitsFormateur;
}): React.ReactElement | null {
  const aContact =
    contact !== null &&
    (contact.nom !== null || contact.telephone !== null || contact.email !== null);
  const n = conflits.conflits.length;
  if (!aContact && n === 0 && !conflits.erreur) return null;

  return (
    <div className="mt-[var(--space-admin-4)] space-y-[var(--space-admin-3)]">
      {n > 0 ? (
        <div
          role="alert"
          className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
        >
          <p className="font-semibold">
            Conflit de planning — {formateurNom ?? "le formateur"} est déjà mobilisé sur {n} autre
            {n > 1 ? "s" : ""} prestation{n > 1 ? "s" : ""} qui chevauche{n > 1 ? "nt" : ""} cette
            session.
          </p>
          <ul className="mt-[var(--space-admin-2)] space-y-1">
            {conflits.conflits.map((c) => (
              <li key={c.key}>
                <Link href={planningDetailHref(adminPrefix, c)} className={lienCls}>
                  {planningTimeLabel(c)} — {c.titre} ({PLANNING_TYPE_LABELS[c.type]})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {conflits.erreur ? (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]"
        >
          Le planning du formateur n&apos;a pas pu être vérifié : un éventuel conflit de créneau
          n&apos;est pas exclu.
        </p>
      ) : null}
      {aContact && contact !== null ? (
        <div>
          <p className={labelCls}>Contact client</p>
          <p className={valueCls}>
            {contact.nom ?? "—"}
            {contact.fonction !== null ? ` — ${contact.fonction}` : ""}
          </p>
          <p className="text-[length:var(--text-admin-sm)]">
            {contact.telephone !== null ? (
              <a href={`tel:${contact.telephone}`} className={lienCls}>
                {contact.telephone}
              </a>
            ) : (
              "Téléphone non renseigné"
            )}
            {" · "}
            {contact.email !== null ? (
              <a href={`mailto:${contact.email}`} className={lienCls}>
                {contact.email}
              </a>
            ) : (
              "E-mail non renseigné"
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
