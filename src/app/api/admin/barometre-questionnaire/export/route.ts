// Export CSV des réponses au questionnaire du Baromètre 2027 — ADMINISTRATEUR UNIQUEMENT.
//
// La garde est ICI : session, puis `estSuperAdmin`. Les réponses brutes (textes libres compris)
// ne sont lues que par l'administrateur. Le fichier ne porte ni l'empreinte du code de retrait ni
// l'identifiant de ligne : rien ne permet de rapprocher une ligne d'une personne. Séparateur `;`,
// UTF-8 avec BOM ; `csvEscape` neutralise l'injection de formule (préfixe `'`).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { csvEscape } from "@/lib/csv";
import { estSuperAdmin } from "@/server/auth/habilitations";
import { CAMPAGNE } from "@/lib/barometre-questionnaire/constantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUESTIONS_FERMEES = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10",
  "q11",
  "q12",
  "q13",
  "q14",
] as const;

const ENTETE = ["jour", "questionnaire_version", ...QUESTIONS_FERMEES, "q15", "q16"] as const;

const LIMITE_LIGNES = 50_000;

function valeur(reponses: unknown, cle: string): string {
  if (typeof reponses !== "object" || reponses === null) return "";
  const v = (reponses as Record<string, unknown>)[cle];
  if (Array.isArray(v)) return v.map(String).join("|");
  return v == null ? "" : String(v);
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!estSuperAdmin(role)) return new NextResponse("Forbidden", { status: 403 });

  const lignes = await prisma.barometreQuestionnaireReponse.findMany({
    where: { campagne: CAMPAGNE },
    orderBy: { jour: "asc" },
    take: LIMITE_LIGNES,
    // Jamais `id` ni `codeRetraitHash`.
    select: {
      jour: true,
      questionnaireVersion: true,
      reponses: true,
      texteUsage: true,
      texteQuestion: true,
    },
  });

  const corps = lignes.map((l) =>
    [
      l.jour.toISOString().slice(0, 10),
      l.questionnaireVersion,
      ...QUESTIONS_FERMEES.map((q) => valeur(l.reponses, q)),
      l.texteUsage,
      l.texteQuestion,
    ]
      .map(csvEscape)
      .join(";"),
  );
  const csv = "﻿" + [ENTETE.join(";"), ...corps].join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="barometre-2027-reponses.csv"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
