// Lot 3 (2026-09-02) — la console dit ce qu'elle sait.
//
// Gardé :
//   - CHAQUE statut de l'énum a un libellé français, dérivé et typé — plus de
//     « bounced » en anglais brut sur le seul statut qui exige un geste ;
//   - le rebond définitif et le temporaire ne portent pas le même mot ;
//   - les puces de filtre de l'écran sont dérivées de l'énum ;
//   - le compteur de gabarits est dérivé du registre, jamais écrit ;
//   - le contrôle horaire remet en attente les « approuvé » abandonnés.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EmailLogStatus } from "../../../../prisma/generated/client";

const countMock = vi.fn();
const outboxUpdateMany = vi.fn();
const creerOuDedup = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { count: (...a: unknown[]) => countMock(...a) },
    emailOutbox: { updateMany: (...a: unknown[]) => outboxUpdateMany(...a) },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(async () => null), set: vi.fn() } }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => creerOuDedup(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn(async () => ({ ok: true })) }));

import { LIBELLES_STATUT_EMAIL, STATUTS_EMAILS, libelleStatutLigne } from "../query";
import { verifierSanteEmails, AGE_APPROUVE_ABANDONNE_MIN } from "@/server/email/health";

const VUE = readFileSync(
  join(
    process.cwd(),
    "src",
    "app",
    "[locale]",
    "(admin)",
    "[adminPrefix]",
    "emails-envoyes",
    "_components",
    "VueEmails.tsx",
  ),
  "utf8",
);

describe("libellés de statut", () => {
  it("🔴 chaque statut de l'énum a un libellé français", () => {
    for (const s of Object.values(EmailLogStatus)) {
      const libelle = LIBELLES_STATUT_EMAIL[s];
      expect(libelle, `statut sans libellé : ${s}`).toBeTruthy();
      expect(libelle, `libellé anglais brut pour ${s}`).not.toBe(s);
    }
    expect(STATUTS_EMAILS).toEqual(Object.values(EmailLogStatus));
  });

  it("le rebond définitif et le temporaire ne portent pas le même mot", () => {
    expect(libelleStatutLigne({ status: "bounced", bounceType: "hard" })).toBe("Rebond définitif");
    expect(libelleStatutLigne({ status: "bounced", bounceType: "soft" })).toBe("Rebond temporaire");
    expect(libelleStatutLigne({ status: "failed", bounceType: null })).toBe("Échec");
  });
});

describe("l'écran ne réécrit pas ce que le code sait", () => {
  it("les puces de filtre sont dérivées de l'énum, pas énumérées", () => {
    expect(VUE).toContain("STATUTS_EMAILS.map(");
    expect(VUE).not.toMatch(/\[\s*"sent",\s*"failed",\s*"pending"\s*\]/);
  });

  it("le nombre de gabarits déclarés n'est pas un chiffre écrit dans la vue", () => {
    expect(VUE).not.toMatch(/sur \d+ déclarés/);
    expect(VUE).toContain("nbGabaritsDeclares");
  });

  it("un échec porte un bouton « Renvoyer »", () => {
    expect(VUE).toContain("renvoyerEmailAction");
    expect(VUE).toContain("Renvoyer");
  });
});

describe("contrôle horaire — les « approuvé » abandonnés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countMock.mockResolvedValue(0);
    creerOuDedup.mockResolvedValue(null);
    process.env["ZEPTOMAIL_WEBHOOK_KEY"] = "cle";
  });

  it("🔴 remet en attente ceux approuvés depuis plus de 15 minutes, et le dit", async () => {
    outboxUpdateMany.mockResolvedValue({ count: 2 });
    const maintenant = new Date("2026-09-02T10:00:00Z");
    const sante = await verifierSanteEmails(maintenant);
    expect(sante.approuvesRemisEnAttente).toBe(2);
    expect(outboxUpdateMany).toHaveBeenCalledWith({
      where: {
        statut: "approuve",
        approuveAt: { lt: new Date(maintenant.getTime() - AGE_APPROUVE_ABANDONNE_MIN * 60_000) },
      },
      data: { statut: "a_valider", approuveAt: null, approuveById: null },
    });
    expect(sante.alertesLevees).toContain("emails_approuves_abandonnes");
  });

  it("rien à remettre : aucune alerte", async () => {
    outboxUpdateMany.mockResolvedValue({ count: 0 });
    const sante = await verifierSanteEmails(new Date());
    expect(sante.approuvesRemisEnAttente).toBe(0);
    expect(sante.alertesLevees).not.toContain("emails_approuves_abandonnes");
  });

  it("une base qui refuse le balayage ne fait pas tomber le contrôle", async () => {
    outboxUpdateMany.mockRejectedValue(new Error("base morte"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sante = await verifierSanteEmails(new Date());
    expect(sante.mesureIndisponible).toBe(false);
  });
});
