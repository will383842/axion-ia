/**
 * Tests — le journal d'activité des deux exports de dossier d'audit garde le
 * compte de ce qui a été ÉCARTÉ.
 *
 * 🔴 Relecture de la PR 1089, constat n° 6. Depuis que les pièces RH, de
 * rémunération et de facturation sortent du dossier remis à l'auditrice, le
 * journal traçait un total sans dire combien de pièces avaient été retenues au
 * registre. Une trace d'export qui ne permet pas de reconstituer ce qui est
 * sorti — et ce qui n'est pas sorti — ne documente pas le traitement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/qualiopi/conformite/audit-dossier", () => ({
  genererManifesteAudit: vi.fn(),
  genererDossierAuditZip: vi.fn(),
}));
vi.mock("@/server/qualiopi/conformite/dossier-session", () => ({
  genererDossierSessionZip: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  requireAdminPublish: vi.fn().mockResolvedValue({ userId: "admin-uuid" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { genererDossierAuditZip } from "@/server/qualiopi/conformite/audit-dossier";
import { genererDossierSessionZip } from "@/server/qualiopi/conformite/dossier-session";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  exporterDossierSessionAction,
  exporterDossierZipAction,
} from "@/server/actions/qualiopi/conformite";

const mockLog = logQualiopiActivity as ReturnType<typeof vi.fn>;
const mockSession = genererDossierSessionZip as ReturnType<typeof vi.fn>;
const mockGlobal = genererDossierAuditZip as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("🔴 le journal des exports garde le compte des pièces écartées", () => {
  it("dossier de session : pièces en base, jointes ET écartées", async () => {
    mockSession.mockResolvedValue({
      base64: "",
      filename: "dossier-session-AXI-SESS-2026-003",
      incomplet: false,
      nbDocuments: 5,
      nbDocumentsJoints: 2,
      nbDocumentsHorsDossier: 3,
      nbDocumentsAnnulees: 0,
      nbChainesAnormales: 0,
      nbChainesContresignAnormales: 0,
      avertissements: [],
    });

    await exporterDossierSessionAction({ sessionId: "44444444-4444-4444-8444-444444444444" });

    const changes = (mockLog.mock.calls[0]![0] as { changes: Record<string, unknown> }).changes;
    expect(changes).toMatchObject({ nbDocuments: 5, nbDocumentsJoints: 2 });
    expect(
      changes["nbDocumentsHorsDossier"],
      "le journal de l'export ne dit pas combien de pièces ont été retenues au registre.",
    ).toBe(3);
  });

  it("ZIP du mode auditeur : pièces du registre et pièces formateurs écartées", async () => {
    mockGlobal.mockResolvedValue({
      base64: "",
      filename: "dossier-audit-qualiopi-2026-09-14",
      incomplet: false,
      nbPreuvesAttendues: 10,
      nbPreuvesJointes: 10,
      nbPiecesHorsDossier: 2,
      nbPiecesFormateursEcartees: 4,
      avertissements: [],
    });

    await exporterDossierZipAction();

    const changes = (mockLog.mock.calls[0]![0] as { changes: Record<string, unknown> }).changes;
    expect(changes).toMatchObject({ nbPiecesHorsDossier: 2, nbPiecesFormateursEcartees: 4 });
  });
});
