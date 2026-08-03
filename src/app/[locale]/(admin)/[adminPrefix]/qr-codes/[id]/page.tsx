// Admin — édition d'un QR dynamique (+ aperçu / téléchargement SVG, stats, suppression).
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { QrLinkForm } from "../QrLinkForm";
import {
  updateQrLinkAction,
  deleteQrLinkAction,
  toggleQrLinkAction,
} from "@/features/admin-qr-codes/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function EditQrCodePage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const link = await prisma.qrLink.findUnique({ where: { id } });
  if (!link) notFound();

  const base = `/${locale}/${adminPrefix}/qr-codes`;
  const publicUrl = `${SITE_URL}/qr/${link.slug}`;
  const lastScan = link.lastScanAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
        link.lastScanAt,
      )
    : "jamais";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`QR — ${link.label}`}
        description={`URL imprimée (figée) : ${publicUrl}`}
        actions={
          <a href={base} className="admin-link">
            ← Retour à la liste
          </a>
        }
      />

      <div className="grid gap-8 md:grid-cols-[1fr_280px]">
        <QrLinkForm
          action={updateQrLinkAction}
          submitLabel="Enregistrer"
          defaults={{
            id: link.id,
            slug: link.slug,
            destinationUrl: link.destinationUrl,
            label: link.label,
            category: link.category,
            active: link.active,
          }}
        />

        <aside className="flex flex-col items-center gap-4 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-6)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/qr/${link.slug}/svg`}
            alt={`QR code ${link.slug}`}
            width={200}
            height={200}
            className="rounded-md border border-[color:var(--color-admin-border)] bg-white p-2"
          />
          <a
            href={`/qr/${link.slug}/svg`}
            download={`qr-${link.slug}.svg`}
            className="admin-button"
          >
            Télécharger le SVG
          </a>

          <div className="w-full text-center text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            <div>
              Scans : <b className="text-[color:var(--color-admin-fg)]">{link.scanCount}</b>
            </div>
            <div>Dernier scan : {lastScan}</div>
            <div>Statut : {link.active ? "actif" : "désactivé"}</div>
          </div>

          <form action={toggleQrLinkAction}>
            <input type="hidden" name="id" value={link.id} />
            <button type="submit" className="admin-link">
              {link.active ? "Désactiver ce QR" : "Réactiver ce QR"}
            </button>
          </form>

          <form action={deleteQrLinkAction}>
            <input type="hidden" name="id" value={link.id} />
            <button type="submit" className="admin-button-refuse">
              Supprimer définitivement
            </button>
          </form>
        </aside>
      </div>
    </AdminPageShell>
  );
}
