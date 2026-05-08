// Dashboard admin placeholder (Sprint 15 step 5 / M9 V1).
//
// Console minimal — affiche les KPIs basiques + liens vers sections futures
// (M9 livrera 14 sections complètes : calendrier, options, soumissions, blog,
// cas, témoignages, FAQ, aide, catégories, newsletter, paramètres,
// utilisateurs, activity logs).

import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

async function logoutAction() {
  "use server";
  await signOut({ redirect: false });
  const adminPrefix = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
  redirect(`/fr/${adminPrefix}/login`);
}

export default async function AdminDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  const [pendingOptions, totalSubmissions, totalArticles, totalSubscribers] = await Promise.all([
    prisma.bookingOption.count({ where: { status: "pending" } }),
    prisma.submission.count(),
    prisma.article.count({ where: { status: "published" } }),
    prisma.newsletterSubscriber.count({ where: { status: "confirmed" } }),
  ]);

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Tableau de bord</h1>
          <p className="admin-meta">
            Connecté en tant que {session.user.email} ·{" "}
            <strong>{(session.user as { role: string }).role}</strong>
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="admin-button-ghost">
            Déconnexion
          </button>
        </form>
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-card">
          <p className="admin-card-label">Options 48h en attente</p>
          <p className="admin-kpi-value">{pendingOptions}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Soumissions totales</p>
          <p className="admin-kpi-value">{totalSubmissions}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Articles publiés</p>
          <p className="admin-kpi-value">{totalArticles}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Abonnés newsletter</p>
          <p className="admin-kpi-value">{totalSubscribers}</p>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-h2">Sections M9 à venir</h2>
        <p className="admin-meta-block">
          14 sections complètes prévues : Calendrier · Options · Soumissions · Blog · Cas concrets ·
          Témoignages · FAQ · Centre d&apos;aide · Catégories · Newsletter · Paramètres ·
          Utilisateurs · Activity logs.
        </p>
        <p className="admin-meta-block">
          Pour activer la 2FA sur votre compte :{" "}
          <a href={`/fr/${adminPrefix}/2fa/setup`} className="admin-link">
            /2fa/setup
          </a>
        </p>
      </div>
    </section>
  );
}
