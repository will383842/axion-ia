// Le client Zoho Mail (2026-09-27) : configuration facultative, jeton
// rafraîchi, compte et boîte de réception découverts, pagination bornée par la
// date, identifiants géants préservés, en-têtes normalisés. `fetch` DOUBLÉ :
// aucun appel réseau.

import { describe, expect, it, vi } from "vitest";

import { creerClientZohoMail, lireConfigZohoMail, type ConfigZohoMail } from "../client";

const CONFIG: ConfigZohoMail = {
  clientId: "id",
  clientSecret: "secret",
  refreshToken: "rafraichir",
  accountId: null,
  dc: "eu",
};

function reponse(corps: unknown, statut = 200): Response {
  const texte = typeof corps === "string" ? corps : JSON.stringify(corps);
  return new Response(texte, { status: statut, headers: { "Content-Type": "application/json" } });
}

function ligneMessage(id: string, recu: number, from = "camille@exemple.fr") {
  return `{"messageId":"${id}","folderId":"900","fromAddress":"${from}","subject":"Re: x","summary":"ok","receivedTime":"${recu}"}`;
}

describe("la configuration", () => {
  it("🔴 une variable obligatoire absente : `null`, le relevé reste inerte", () => {
    expect(lireConfigZohoMail({})).toBeNull();
    expect(
      lireConfigZohoMail({ ZOHO_MAIL_CLIENT_ID: "a", ZOHO_MAIL_CLIENT_SECRET: "b" }),
    ).toBeNull();
    expect(
      lireConfigZohoMail({
        ZOHO_MAIL_CLIENT_ID: "a",
        ZOHO_MAIL_CLIENT_SECRET: "b",
        ZOHO_MAIL_REFRESH_TOKEN: "   ",
      }),
    ).toBeNull();
  });

  it("le centre de données vaut `eu` par défaut ; un centre inconnu rend le module inerte", () => {
    const base = {
      ZOHO_MAIL_CLIENT_ID: "a",
      ZOHO_MAIL_CLIENT_SECRET: "b",
      ZOHO_MAIL_REFRESH_TOKEN: "c",
    };
    expect(lireConfigZohoMail(base)).toEqual({
      clientId: "a",
      clientSecret: "b",
      refreshToken: "c",
      accountId: null,
      dc: "eu",
    });
    expect(
      lireConfigZohoMail({ ...base, ZOHO_MAIL_DC: "COM", ZOHO_MAIL_ACCOUNT_ID: "42" }),
    ).toMatchObject({
      dc: "com",
      accountId: "42",
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(lireConfigZohoMail({ ...base, ZOHO_MAIL_DC: "evil.example" })).toBeNull();
  });
});

describe("la lecture", () => {
  it("🔴 rafraîchit le jeton, découvre compte et boîte, s'arrête à la date demandée", async () => {
    const depuis = new Date(1_000_000);
    const appels: string[] = [];
    const fetchDouble = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      appels.push(`${init?.method ?? "GET"} ${u}`);
      if (u.startsWith("https://accounts.zoho.eu/oauth/v2/token")) {
        expect(String(init?.body)).toContain("grant_type=refresh_token");
        return reponse({ access_token: "jeton", expires_in: 3600 });
      }
      expect((init?.headers as Record<string, string>)["Authorization"]).toBe(
        "Zoho-oauthtoken jeton",
      );
      if (u === "https://mail.zoho.eu/api/accounts") {
        return reponse({ data: [{ accountId: "2560636000000008002" }] });
      }
      if (u.endsWith("/folders")) {
        return reponse({
          data: [
            { folderId: "800", folderType: "Sent" },
            { folderId: "900", folderType: "Inbox" },
          ],
        });
      }
      if (u.includes("/messages/view")) {
        expect(new URL(u).searchParams.get("folderId")).toBe("900");
        // Du plus récent au plus ancien ; le dernier est AVANT `depuis`.
        return reponse(
          `{"data":[${ligneMessage("1709887058769100001", 3_000_000)},${ligneMessage("2", 2_000_000)},${ligneMessage("3", 500_000)}]}`,
        );
      }
      throw new Error(`appel inattendu : ${u}`);
    });

    const client = creerClientZohoMail(CONFIG, fetchDouble as unknown as typeof fetch);
    const r = await client.listerMessagesRecus(depuis);

    expect(r.complet).toBe(true);
    expect(r.messages.map((m) => m.messageId)).toEqual(["1709887058769100001", "2"]);
    expect(r.messages[0]!.receivedAt.getTime()).toBe(3_000_000);
    // Aucune route vers le CORPS ni vers une pièce jointe.
    expect(appels.some((a) => /\/content|\/attachments/.test(a))).toBe(false);
    // Le jeton est gardé : un seul rafraîchissement pour quatre appels.
    expect(appels.filter((a) => a.includes("/oauth/v2/token"))).toHaveLength(1);
  });

  it("un identifiant rendu en NOMBRE géant garde tous ses chiffres", async () => {
    const fetchDouble = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("/oauth/")) return reponse({ access_token: "j", expires_in: 3600 });
      if (u.endsWith("/folders"))
        return reponse({ data: [{ folderId: "9", folderType: "Inbox" }] });
      return reponse(
        '{"data":[{"messageId":1709887058769100001,"folderId":9,"fromAddress":"a@b.fr","subject":"s","summary":"","receivedTime":5000}]}',
      );
    });
    const client = creerClientZohoMail(
      { ...CONFIG, accountId: "42" },
      fetchDouble as unknown as typeof fetch,
    );
    const r = await client.listerMessagesRecus(new Date(0));
    expect(r.messages[0]!.messageId).toBe("1709887058769100001");
  });

  it("🔴 un jeton refusé en 200 `{ error }` lève : le relevé l'attrape et n'avance pas", async () => {
    const fetchDouble = vi.fn(async () => reponse({ error: "invalid_code" }));
    const client = creerClientZohoMail(CONFIG, fetchDouble as unknown as typeof fetch);
    await expect(client.listerMessagesRecus(new Date(0))).rejects.toThrow(/invalid_code/);
  });

  it("lit les en-têtes en JSON et les rend en minuscules", async () => {
    const fetchDouble = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("/oauth/")) return reponse({ access_token: "j", expires_in: 3600 });
      expect(u).toContain("/api/accounts/42/folders/900/messages/77/header?raw=false");
      return reponse({
        data: { headerContent: { "Auto-Submitted": ["auto-replied"], "Message-Id": ["<m@x>"] } },
      });
    });
    const client = creerClientZohoMail(
      { ...CONFIG, accountId: "42" },
      fetchDouble as unknown as typeof fetch,
    );
    expect(await client.lireEntetes("900", "77")).toEqual({
      "auto-submitted": ["auto-replied"],
      "message-id": ["<m@x>"],
    });
  });
});
