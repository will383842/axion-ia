// Audit présentiel (PR3) : encart d'entrée posé dans « Ce que le client a pris ». Composant SERVEUR asynchrone.
// Réservé au super_admin : pour tout autre rôle il ne rend RIEN et ne touche pas à la base.
// Aucun contenu chiffré lu ici : seulement l'état de la séance (étape, dernière réception).

import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function EncartAudit({
  clientId,
  ficheHref,
}: {
  clientId: string;
  ficheHref: string;
}): Promise<React.ReactElement | null> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "super_admin") return null;

  let ligne: {
    derniereEtapeIndex: number;
    dernierEnvoiLe: Date | null;
    jetonRevoqueLe: Date | null;
    jetonExpireLe: Date;
  } | null = null;
  let panne = false;
  try {
    ligne = await prisma.auditTerrainSession.findFirst({
      where: { clientId },
      orderBy: { creeLe: "desc" },
      select: {
        derniereEtapeIndex: true,
        dernierEnvoiLe: true,
        jetonRevoqueLe: true,
        jetonExpireLe: true,
      },
    });
  } catch {
    panne = true;
  }

  const etat = panne
    ? "Lecture impossible pour le moment."
    : ligne === null
      ? "Aucun audit présentiel pour cette fiche."
      : `${ligne.derniereEtapeIndex === 0 ? "Pas encore commencé" : `Étape ${ligne.derniereEtapeIndex} sur 7`} · dernière réception : ${
          ligne.dernierEnvoiLe === null
            ? "aucune"
            : ligne.dernierEnvoiLe.toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
                dateStyle: "short",
                timeStyle: "short",
              })
        }${ligne.jetonRevoqueLe !== null ? " · jeton révoqué" : ""}`;

  return (
    <div
      data-bloc="encart-audit"
      className="mb-[var(--space-admin-4)] flex flex-wrap items-center justify-between gap-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] border-l-4 border-[color:var(--color-admin-bloc-bleu-accent)] bg-[color:var(--color-admin-bloc-bleu-bg)] p-[var(--space-admin-3)]"
    >
      <p className="text-[length:var(--text-admin-sm)]">
        <strong>Audit présentiel.</strong> {etat}
      </p>
      <Link href={`${ficheHref}/audit`} className="admin-button-secondary">
        Ouvrir l&apos;audit
      </Link>
    </div>
  );
}
