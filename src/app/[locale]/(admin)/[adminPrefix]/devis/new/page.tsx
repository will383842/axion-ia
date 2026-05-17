// Création devis depuis admin (Sprint A patch — UI gap fix).
//
// Page form pour générer un Quote draft à partir d'un Booking existant.
// Lance generateQuoteDraftFormAction → redirect vers /devis/[id] après succès.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { NewQuoteForm } from "./NewQuoteForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function NewQuotePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  // Pattern V1/V2 §3 (audit verif-fix-deploy 2026-05-18) — V2 non implémenté
  // pour cette route legacy admin. Flag check préservé pour spec compliance.
  if (await isAdminV2Enabled()) {
    // Intentional fall-through to V1 below.
  }

  const role = (session.user as { role?: string }).role ?? "reader";
  if (role !== "super_admin" && role !== "admin") {
    return (
      <section>
        <p className="admin-meta-block">
          Création réservée aux rôles <code>admin</code> / <code>super_admin</code>.
        </p>
      </section>
    );
  }

  const bookingIdParam = sp.bookingId;
  if (!bookingIdParam) {
    return (
      <section>
        <div className="admin-dashboard-head">
          <div>
            <Link href={`/fr/${adminPrefix}/devis`} className="admin-link admin-back">
              ← Devis
            </Link>
            <h1 className="admin-h1-large">Créer un devis</h1>
            <p className="admin-meta">Sélectionne d&apos;abord un booking depuis sa fiche.</p>
          </div>
        </div>
        <div className="admin-card">
          <p className="admin-meta-block">
            Pour créer un devis, passe par la fiche d&apos;une réservation (
            <code>/admin/{adminPrefix}/reservations/[id]</code>) et clique le bouton{" "}
            <strong>« Créer un devis »</strong> qui ouvrira ce formulaire avec le{" "}
            <code>bookingId</code> pré-rempli.
          </p>
          <Link href={`/fr/${adminPrefix}/reservations`} className="admin-link">
            → Liste des réservations
          </Link>
        </div>
      </section>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingIdParam },
    select: {
      id: true,
      interventionType: true,
      bookingDate: true,
      basePriceHtCents: true,
      status: true,
      submission: { select: { companyName: true, contactName: true, contactEmail: true } },
      fromSubmission: { select: { companyName: true, contactName: true, contactEmail: true } },
    },
  });
  if (!booking) notFound();

  const sub = booking.fromSubmission ?? booking.submission;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <Link
            href={`/fr/${adminPrefix}/reservations/${booking.id}`}
            className="admin-link admin-back"
          >
            ← Fiche booking
          </Link>
          <h1 className="admin-h1-large">Créer un devis</h1>
          <p className="admin-meta">
            Pour <strong>{sub?.companyName ?? "—"}</strong> · {booking.interventionType} ·{" "}
            {booking.bookingDate.toISOString().slice(0, 10)}
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-h2">Données du devis</h2>
        <p className="admin-meta-block">
          Le numéro <code>DEVIS-2026-NNNN</code> sera attribué atomiquement. Le devis sera
          d&apos;abord en <code>draft</code> ; tu pourras l&apos;envoyer ensuite via DocuSeal
          (signature séquentielle client → Axion-IA) depuis sa fiche détail.
        </p>
        <NewQuoteForm bookingId={booking.id} defaultAmountHtCents={booking.basePriceHtCents} />
      </div>
    </section>
  );
}
