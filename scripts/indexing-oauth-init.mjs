// Flow OAuth one-shot pour obtenir un refresh_token Google Indexing API.
// Usage : node scripts/indexing-oauth-init.mjs
//
// Réutilise le même client OAuth Desktop que GSC (pas besoin d'en créer un
// nouveau). Demande simplement le scope `auth/indexing` en plus de
// `webmasters.readonly`. Le `prompt=consent` force Google à émettre un
// nouveau refresh_token (sinon réutilise l'ancien et oublie le scope ajouté).
//
// Pré-requis :
//   - Indexing API activée dans GCP projet axion-ia-seo
//     (https://console.cloud.google.com/apis/library?project=axion-ia-seo
//      → chercher "Indexing API" → Activer)
//   - Utilisateur authentifié OAuth doit être Owner de la propriété
//     Search Console axion-ia.com (Will l'est déjà via GSC OAuth setup)
//   - Fichier ../.secrets/gsc-oauth-client.json (déjà créé pour GSC)
//
// Écrit `INDEXING_OAUTH_REFRESH_TOKEN` dans ../.secrets/api-tokens.env.

import http from "node:http";
import { exec } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CLIENT_JSON = path.join(ROOT, ".secrets", "gsc-oauth-client.json");
const ENV_FILE = path.join(ROOT, ".secrets", "api-tokens.env");
const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}`;
// Scope Indexing API uniquement. Si tu veux conserver le scope GSC
// dans le MÊME refresh_token (token combiné), ajoute :
//   `https://www.googleapis.com/auth/webmasters.readonly`
// avec un espace entre. V1 : on garde 1 refresh_token par scope pour
// minimiser le blast radius en cas de révocation.
const SCOPE = "https://www.googleapis.com/auth/indexing";

function log(msg) {
  process.stdout.write(`[indexing-oauth-init] ${msg}\n`);
}

function openBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url.replace(/&/g, "^&")}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      log(`Impossible d'ouvrir le browser auto. Ouvrez manuellement :\n${url}`);
    }
  });
}

async function exchangeCodeForTokens({ code, clientId, clientSecret }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange ${res.status} : ${text}`);
  }
  return res.json();
}

async function updateEnvFile(refreshToken) {
  let content = "";
  try {
    content = await readFile(ENV_FILE, "utf8");
  } catch {
    log("api-tokens.env absent — création.");
  }
  const line = `INDEXING_OAUTH_REFRESH_TOKEN='${refreshToken}'`;
  const marker = "INDEXING_OAUTH_REFRESH_TOKEN=";
  if (content.includes(marker)) {
    content = content.replace(new RegExp(`${marker}.*`), line);
    log("INDEXING_OAUTH_REFRESH_TOKEN remplacé dans api-tokens.env.");
  } else {
    const block = `\n# ---------- Indexing API OAuth refresh token (généré ${new Date().toISOString()}) ----------\n${line}\n`;
    content = content.trimEnd() + "\n" + block;
    log("INDEXING_OAUTH_REFRESH_TOKEN ajouté à api-tokens.env.");
  }
  await writeFile(ENV_FILE, content, "utf8");
}

async function main() {
  const raw = await readFile(CLIENT_JSON, "utf8");
  const cfg = JSON.parse(raw).installed;
  if (!cfg?.client_id || !cfg?.client_secret) {
    throw new Error("gsc-oauth-client.json invalide (manque client_id/client_secret).");
  }

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: cfg.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    }).toString();

  log("Serveur callback sur " + REDIRECT_URI);
  log("Ouverture du browser sur la page de consent Google...");
  log("");
  log("⚠️  Pré-requis IMPORTANT :");
  log("    → Indexing API doit être ACTIVÉE dans GCP projet axion-ia-seo");
  log("    → https://console.cloud.google.com/apis/library?project=axion-ia-seo");
  log("    → Chercher 'Indexing API' → Activer (5 sec)");
  log("");
  log("⚠️  Si l'écran 'Application non vérifiée' apparaît :");
  log("    → Cliquer 'Paramètres avancés'");
  log("    → Cliquer 'Accéder à Axion-IA (non sécurisé)'");
  log("    C'est normal (app non soumise à vérification Google).");
  log("");

  const tokenPromise = new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const err = url.searchParams.get("error");

      if (err) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>Erreur OAuth</h1><pre>${err}</pre>`);
        server.close();
        reject(new Error(`Consent refusé : ${err}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Paramètre code manquant</h1>");
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens({
          code,
          clientId: cfg.client_id,
          clientSecret: cfg.client_secret,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<h1>✅ Indexing API token reçu</h1><p>Vous pouvez fermer cet onglet et revenir au terminal.</p>`,
        );
        server.close();
        resolve(tokens);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>Erreur échange token</h1><pre>${e.message}</pre>`);
        server.close();
        reject(e);
      }
    });
    server.listen(PORT, () => {
      openBrowser(authUrl);
      log("");
      log("Si rien ne s'ouvre, copiez-collez cette URL dans le browser :");
      log(authUrl);
    });
  });

  const tokens = await tokenPromise;
  if (!tokens.refresh_token) {
    throw new Error(
      "Pas de refresh_token reçu. Causes possibles :\n" +
        "  - L'app n'est pas en mode 'En production' dans GCP\n" +
        "  - Le scope a déjà été consenti sans 'prompt=consent' précédent\n" +
        "  Fix : révoquer l'accès dans https://myaccount.google.com/permissions et relancer.",
    );
  }

  log("");
  log("✅ Indexing refresh token obtenu (longueur : " + tokens.refresh_token.length + " chars)");
  log("   Access token expire dans : " + tokens.expires_in + "s");
  log("   Scope : " + tokens.scope);

  await updateEnvFile(tokens.refresh_token);

  log("");
  log("✅ Étape suivante (côté Claude) :");
  log("    → push INDEXING_OAUTH_REFRESH_TOKEN dans Coolify env");
  log("    → refactor worker content-google-indexing-worker.ts pour OAuth flow");
  log("    → commit + push + deploy");
}

main().catch((e) => {
  process.stderr.write(`[indexing-oauth-init] ERREUR : ${e.message}\n`);
  process.exit(1);
});
