// Admin échéanciers — liste profiles V1 + actions create/edit/archive (Sprint C).
//
// 4 profils par défaut (D40 grille SSOT) :
//   tiny    : 100 % à validation (J+7)             — ≤ 1 500 € HT
//   small   : 50 / 50 (J+14 / J-7)                  — 1 500-5 000 €
//   medium  : 30 / 30 / 40 (J+14 / J-7 / J+30)      — 5 000-15 000 €
//   large   : 30 / 30 / 40 + mensuel custom         — > 15 000 €

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ScheduleProfileForm } from "./ScheduleProfileForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

function formatEur(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function EcheanciersPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const role = (session.user as { role?: string }).role ?? "reader";

  const profiles = await prisma.paymentScheduleProfile.findMany({
    where: { archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { thresholdMinCents: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      installments: true,
      thresholdMinCents: true,
      thresholdMaxCents: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Échéanciers</h1>
          <p className="admin-meta">
            {profiles.length} profil{profiles.length > 1 ? "s" : ""} actif
            {profiles.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-h2">Profils disponibles</h2>
        <p className="admin-meta-block">
          Les profils sont sélectionnés automatiquement selon le seuil HT du booking. Override
          custom par booking via le drawer Réservations.
        </p>

        {profiles.length === 0 ? (
          <p className="admin-meta-block">
            Aucun profil actif. Crée le premier via le formulaire ci-dessous.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Slug</th>
                  <th>Tranches</th>
                  <th>Seuil min HT</th>
                  <th>Seuil max HT</th>
                  <th>Par défaut</th>
                  <th>Mise à jour</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const installments = Array.isArray(p.installments)
                    ? (p.installments as Array<{ percentage: number; description?: string }>)
                    : [];
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <code>{p.slug}</code>
                      </td>
                      <td>
                        {installments.map((t, i) => (
                          <div key={i} className="admin-meta-small">
                            {t.percentage} % · {t.description ?? "—"}
                          </div>
                        ))}
                      </td>
                      <td>{formatEur(p.thresholdMinCents)}</td>
                      <td>{formatEur(p.thresholdMaxCents)}</td>
                      <td>{p.isDefault ? "✓" : ""}</td>
                      <td>{p.updatedAt.toISOString().slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {role === "super_admin" ? (
        <div className="admin-card">
          <h2 className="admin-h2">Créer ou éditer un profil</h2>
          <p className="admin-meta-block">
            Les <code>installments</code> sont un JSON array. La somme des <code>percentage</code>{" "}
            doit faire 100 (tolérance arrondi 0,5 %). Exemple « medium » :
          </p>
          <pre
            className="admin-meta-block"
            style={{ background: "var(--color-bg)", padding: 12, borderRadius: 4 }}
          >
            {`[
  { "percentage": 30, "dueOffsetDays": 14, "dueRelativeTo": "validation", "description": "Acompte 30 %" },
  { "percentage": 30, "dueOffsetDays": -7, "dueRelativeTo": "booking_date", "description": "2e tranche J-7" },
  { "percentage": 40, "dueOffsetDays": 30, "dueRelativeTo": "j+30", "description": "Solde J+30 post-intervention" }
]`}
          </pre>
          <ScheduleProfileForm />
        </div>
      ) : (
        <div className="admin-card">
          <p className="admin-meta-block">
            Création / édition réservée au rôle <code>super_admin</code>.
          </p>
        </div>
      )}
    </section>
  );
}
