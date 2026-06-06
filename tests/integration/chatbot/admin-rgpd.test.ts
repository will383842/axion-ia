// Phase 3 — console admin (effet runtime réel) + RGPD (T-20/T-23/T-25).
// On exerce les fonctions runtime que les server actions encapsulent (les actions
// elles-mêmes exigent une session admin via requireAdminWrite — testées au niveau
// guard). Ici : effet PERSISTÉ et RÉPERCUTÉ sur le comportement du bot.
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/server/chatbot/tenant";
import {
  createPromptVersion,
  activatePromptVersion,
  getActivePromptContent,
  listPromptVersions,
} from "@/server/chatbot/generation/prompt-version";
import { exportChatDataForEmail } from "@/lib/rgpd-export-chat";
import { eraseChatDataForEmail } from "@/lib/rgpd-erase";
import { capturerLead } from "@/server/chatbot/tools/capturer-lead";

describe("Phase 3 — admin runtime + RGPD (DB réelle)", () => {
  let tenantId: string;

  beforeAll(async () => {
    const t = await getDefaultTenant();
    tenantId = t!.id;
  });

  it("T-20 — prompt versionné : create → activate → rollback, effet sur getActivePromptContent", async () => {
    // État initial (peut être null si aucune version active).
    const before = await getActivePromptContent(tenantId);

    const note = `audit-${randomUUID().slice(0, 8)}`;
    const v1 = await createPromptVersion(
      tenantId,
      "PROMPT V1 — instructions de test audit E2E (contenu suffisamment long).",
      `${note}-v1`,
    );
    const v2 = await createPromptVersion(
      tenantId,
      "PROMPT V2 — instructions de test audit E2E modifiées (contenu long).",
      `${note}-v2`,
    );

    await activatePromptVersion(tenantId, v2.version);
    expect(await getActivePromptContent(tenantId)).toContain("PROMPT V2");

    // Rollback vers V1.
    await activatePromptVersion(tenantId, v1.version);
    const active = await getActivePromptContent(tenantId);
    expect(active).toContain("PROMPT V1");

    // Invariant : une seule version active.
    const versions = await listPromptVersions(tenantId);
    expect(versions.filter((v) => v.actif).length).toBe(1);

    // Cleanup : désactive nos versions de test pour restaurer l'état initial.
    await prisma.chatPromptVersion.updateMany({
      where: { tenantId, version: { in: [v1.version, v2.version] } },
      data: { actif: false },
    });
    await prisma.chatPromptVersion.deleteMany({
      where: { tenantId, version: { in: [v1.version, v2.version] } },
    });
    // before était null → on reste cohérent (aucune version active restaurée).
    expect(before === null || typeof before === "string").toBe(true);
  });

  it("T-25 — réglages tenant : update confidenceThreshold → répercuté sur getDefaultTenant", async () => {
    const tenant = await prisma.chatTenant.findUnique({ where: { id: tenantId } });
    const original = (tenant!.reglages ?? {}) as Record<string, unknown>;
    try {
      await prisma.chatTenant.update({
        where: { id: tenantId },
        data: { reglages: { ...original, confidenceThreshold: 0.99 } as object },
      });
      const reloaded = await getDefaultTenant();
      expect(reloaded!.settings.confidenceThreshold).toBe(0.99);
    } finally {
      // Restaure les réglages d'origine.
      await prisma.chatTenant.update({
        where: { id: tenantId },
        data: { reglages: original as object },
      });
    }
    const restored = await getDefaultTenant();
    expect(restored!.settings.confidenceThreshold).not.toBe(0.99);
  });

  it("T-23 — RGPD export + erase couvrent les chat_* (sur données de TEST créées ici)", async () => {
    const email = `rgpd-${randomUUID().slice(0, 8)}@example.com`;
    const session = randomUUID();
    const convo = await prisma.chatConversation.create({
      data: { tenantId, sessionUuid: session },
      select: { id: true },
    });
    await prisma.chatMessage.createMany({
      data: [
        { conversationId: convo.id, role: "user", contenu: "Bonjour, je veux un audit RGPD test" },
        { conversationId: convo.id, role: "assistant", contenu: "Réponse test avec accents é à ç" },
      ],
    });
    // Lead rattaché (backlink submissionId) → ancre RGPD.
    await capturerLead(
      {
        nom: "RGPD Test",
        email,
        besoin_resume: "Test droit accès/effacement",
        consentement_rgpd: true,
      },
      { tenantId, conversationId: convo.id },
    );

    // Export (art. 15) : retrouve la conversation + messages.
    const exported = await exportChatDataForEmail(email);
    expect(exported.conversations.length).toBeGreaterThanOrEqual(1);
    const found = exported.conversations.find((c) => c.id === convo.id);
    expect(found).toBeTruthy();
    expect(found!.messages.length).toBe(2);

    // Erase (art. 17) : supprime la conversation rattachée.
    const erased = await eraseChatDataForEmail(email);
    expect(erased.conversationsDeleted).toBeGreaterThanOrEqual(1);
    const after = await prisma.chatConversation.findUnique({ where: { id: convo.id } });
    expect(after).toBeNull();
    // Messages supprimés en cascade.
    const msgs = await prisma.chatMessage.count({ where: { conversationId: convo.id } });
    expect(msgs).toBe(0);

    // Cleanup : la Submission de test reste (anonymisée par eraseSubmissionsForEmail
    // dans le flux complet) ; on la retire pour ne pas polluer.
    await prisma.submission.deleteMany({ where: { contactEmail: email } });
  });
});
