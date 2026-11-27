// Le bouton « Trame d'échange » (2026-11-27) : ouvre, dans un nouvel onglet, la
// trame imprimable A4 de l'échange avec un candidat apporteur.
//
// Il n'apparaît que pour un échange apporteur : le TYPE classé du rendez-vous
// (`typeRendezVous`) OU, à défaut, le nom de l'événement Calendly
// (`estAppelApporteur`, même règle que le reste de la console).
import Link from "next/link";

import { prenomDe } from "@/features/admin-rendezvous/suivi";
import { adminPath } from "@/lib/admin-path";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";

export function estEchangeAvecCandidatApporteur(r: {
  eventTypeName?: string | null | undefined;
  typeRendezVous?: string | null | undefined;
}): boolean {
  return r.typeRendezVous === "apporteur" || estAppelApporteur(r.eventTypeName);
}

export function BoutonTrameEchange({
  eventTypeName,
  typeRendezVous,
  contactName,
  className,
}: {
  eventTypeName?: string | null | undefined;
  typeRendezVous?: string | null | undefined;
  contactName?: string | null | undefined;
  className?: string | undefined;
}) {
  if (!estEchangeAvecCandidatApporteur({ eventTypeName, typeRendezVous })) return null;
  const prenom = prenomDe(contactName ?? null);
  const href =
    adminPath("fr", "imprimes/trame-apporteur") +
    (prenom ? `?${new URLSearchParams({ prenom }).toString()}` : "");
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      prefetch={false}
      className={className ?? "admin-link"}
    >
      Trame d&apos;échange
    </Link>
  );
}
