// Route Handler : export iCalendar (.ics) de l'agenda d'un formateur.
//
// GET /fr/<adminPrefix>/planning/ics?trainerId=<uuid>&mois=6
//
// Renvoie le planning des N prochains mois d'un formateur au format
// `text/calendar`, en pièce jointe. Un formateur peut ainsi ABONNER son agenda
// (Google/Outlook/Apple) à ses prestations — les `UID` stables (cf. ics.ts)
// garantissent qu'une re-synchro met à jour les événements au lieu de les
// dupliquer.
//
// Auth admin obligatoire (même contrat que les autres routes admin : session
// NextAuth v5 + rôle super_admin/admin). Le segment [adminPrefix] est validé
// contre l'env — un Route Handler ne passe PAS par le layout admin, donc on
// re-fait la garde ici (sinon /planning/ics serait accessible sous n'importe
// quel préfixe).
//
// Stub-safe : au build, Prisma renvoie [] → l'ICS est un VCALENDAR vide valide.

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getPlanningRange } from "@/features/admin-planning/queries";
import { getTrainer } from "@/server/qualiopi/trainers/trainers";
import { buildPlanningIcs } from "@/features/admin-planning/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fenêtre d'export : bornée pour éviter un .ics démesuré (et rester lisible côté
// client d'agenda). 6 mois par défaut, 1 à 24 mois autorisés.
const DEFAULT_MONTHS = 6;
const MIN_MONTHS = 1;
const MAX_MONTHS = 24;

function parseMonths(raw: string | null): number {
  const n = raw !== null ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isInteger(n)) return DEFAULT_MONTHS;
  return Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, n));
}

/** Nom de fichier .ics sûr (ASCII, pas d'espace ni de caractère de contrôle). */
function safeFilename(base: string): string {
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les diacritiques combinants
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${slug || "agenda"}.ics`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ adminPrefix: string; locale: string }> },
): Promise<Response> {
  const { adminPrefix } = await params;

  // ── Garde préfixe admin (le layout ne s'applique pas aux Route Handlers) ──
  const expectedPrefix = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
  if (adminPrefix !== expectedPrefix) {
    return new NextResponse("not found", { status: 404 });
  }

  // ── Auth admin ────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL(`/fr/${adminPrefix}/login`, req.url));
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ── Paramètres ────────────────────────────────────────────────────────────
  const sp = req.nextUrl.searchParams;
  const trainerId = sp.get("trainerId");
  if (trainerId === null || trainerId === "") {
    return NextResponse.json({ error: "trainerId requis" }, { status: 400 });
  }
  const months = parseMonths(sp.get("mois"));

  // ── Fenêtre : de maintenant à +N mois ─────────────────────────────────────
  const from = new Date();
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + months);

  // ── Données (stub-safe : Prisma en erreur → [] / null) ────────────────────
  const [events, trainer] = await Promise.all([
    getPlanningRange(from, to, { trainerId }),
    getTrainer(trainerId),
  ]);

  const trainerNom = trainer !== null ? `${trainer.prenom} ${trainer.nom}`.trim() : "Formateur";
  const nomCalendrier = `Agenda Axion-IA — ${trainerNom}`;

  const ics = buildPlanningIcs(events, nomCalendrier);
  const filename = safeFilename(`axionia-agenda-${trainerNom}`);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
