import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/content-gen/articles/[id]/feedback
// Body: { type: "up" | "down", comment?: string }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: articleId } = await params;
  const body = (await req.json()) as { type?: string; comment?: string };

  if (body.type !== "up" && body.type !== "down") {
    return NextResponse.json({ error: "type must be up or down" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).articleFeedback.create({
    data: {
      articleId,
      userId: session.user.email,
      type: body.type,
      comment: body.comment ?? null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
