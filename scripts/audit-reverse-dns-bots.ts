// Marker ES module — isolation namespace vs autres scripts dossier `scripts/`.
export {};

// Reverse DNS check + forward verify bots — audit indexation 2026-05-18 P2-27.
//
// Outil one-shot : prend un fichier de logs en input (format Coolify/Caddy
// access log standard), filtre les requêtes avec UA bots légitimes connus,
// reverse DNS chaque IP, forward verify le hostname résolu, output JSON
// report listant les FAKE BOTS (UA Googlebot mais reverse DNS ≠ googlebot.com).
//
// Usage :
//   npx tsx scripts/audit-reverse-dns-bots.ts --log=/path/to/access.log \
//     [--output=_AUDIT/reverse-dns-YYYY-MM-DD.json] [--sample=200]
//
// Pourquoi ce check :
//   - Scrapers utilisent UA "Googlebot" pour bypasser robots.txt + WAF
//   - Vraie Googlebot a toujours reverse DNS resolving vers *.googlebot.com
//   - Forward verify (DNS → IP) garantit pas de DNS spoofing
//   - Action si fake détecté : flagger pour Cloudflare WAF custom rule
//
// Pas de cron auto — Will run manuel via SSH dump log + ce script. V2 :
// integration Coolify Logs API + cron weekly + Telegram alert.

import { resolve as dnsResolve, reverse as dnsReverse } from "node:dns/promises";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// Bots dont on doit valider la reverse DNS (UA → hostname pattern).
// Pattern : si UA contient string clé → reverse DNS doit matcher regex.
const KNOWN_BOTS: Array<{
  uaPattern: RegExp;
  expectedHostnameRegex: RegExp;
  name: string;
}> = [
  {
    name: "Googlebot",
    uaPattern: /Googlebot/i,
    expectedHostnameRegex: /\.googlebot\.com$|\.google\.com$/i,
  },
  {
    name: "Bingbot",
    uaPattern: /Bingbot/i,
    expectedHostnameRegex: /\.search\.msn\.com$|\.bing\.com$/i,
  },
  {
    name: "AppleBot",
    uaPattern: /Applebot/i,
    expectedHostnameRegex: /\.applebot\.apple\.com$|\.apple\.com$/i,
  },
  {
    name: "ClaudeBot",
    uaPattern: /ClaudeBot|anthropic-ai|Claude-Web/i,
    // Anthropic n'a pas de pattern reverse DNS officiel documenté — accept all (no verify).
    expectedHostnameRegex: /.+/,
  },
  {
    name: "PerplexityBot",
    uaPattern: /PerplexityBot|Perplexity-User/i,
    expectedHostnameRegex: /\.perplexity\.ai$|\.perplexity\.com$|.+/,
  },
  {
    name: "OAI-SearchBot",
    uaPattern: /OAI-SearchBot|ChatGPT-User|GPTBot/i,
    expectedHostnameRegex: /\.openai\.com$|\.chatgpt\.com$|.+/,
  },
];

interface Args {
  log: string;
  output: string;
  sample: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) opts[m[1]!] = m[2]!;
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    log: opts.log ?? "",
    output: opts.output ?? `_AUDIT/reverse-dns-${today}.json`,
    sample: Number.parseInt(opts.sample ?? "200", 10),
  };
}

interface LogEntry {
  ip: string;
  userAgent: string;
  timestamp: string;
}

/**
 * Parse log line — supports common formats :
 *   - Caddy JSON : `{"client_ip":"...","request":{"headers":{"User-Agent":["..."]}},"ts":...}`
 *   - Apache combined : `IP - - [timestamp] "METHOD path" status size "ref" "UA"`
 *   - Nginx access : similar to Apache combined
 */
function parseLogLine(line: string): LogEntry | null {
  // Try JSON first (Caddy/Coolify)
  if (line.startsWith("{")) {
    try {
      const obj = JSON.parse(line) as {
        client_ip?: string;
        request?: { headers?: { "User-Agent"?: string[] } };
        ts?: number;
      };
      const ua = obj.request?.headers?.["User-Agent"]?.[0];
      if (obj.client_ip && ua) {
        return {
          ip: obj.client_ip,
          userAgent: ua,
          timestamp: obj.ts ? new Date(obj.ts * 1000).toISOString() : "",
        };
      }
    } catch {
      // skip malformed line
    }
    return null;
  }
  // Apache/Nginx combined format
  const m = line.match(
    /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"[^"]*"\s+\d+\s+\S+\s+"[^"]*"\s+"([^"]+)"/,
  );
  if (m) {
    return { ip: m[1]!, userAgent: m[3]!, timestamp: m[2]! };
  }
  return null;
}

async function verifyBotIp(
  ip: string,
  expectedHostname: RegExp,
): Promise<{ ok: boolean; hostname?: string; forwardIps?: string[]; reason?: string }> {
  try {
    const reverseNames = await dnsReverse(ip);
    if (reverseNames.length === 0) {
      return { ok: false, reason: "no reverse DNS" };
    }
    const hostname = reverseNames[0]!;
    if (!expectedHostname.test(hostname)) {
      return { ok: false, hostname, reason: `hostname does not match expected pattern` };
    }
    // Forward verify : hostname should resolve back to the same IP
    const forwardIps = await dnsResolve(hostname);
    if (!forwardIps.includes(ip)) {
      return {
        ok: false,
        hostname,
        forwardIps,
        reason: `forward DNS mismatch (expected ${ip}, got ${forwardIps.join(",")})`,
      };
    }
    return { ok: true, hostname, forwardIps };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

interface Finding {
  ip: string;
  userAgent: string;
  botName: string;
  timestamp: string;
  verdict: "legitimate" | "fake" | "no_reverse_dns";
  hostname?: string;
  reason?: string;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.log) {
    console.error(
      "[audit-reverse-dns-bots] missing --log argument. Usage: --log=/path/to/access.log",
    );
    process.exit(1);
  }
  console.log(`[audit-reverse-dns-bots] reading ${args.log}...`);
  let logContent: string;
  try {
    logContent = await readFile(args.log, "utf-8");
  } catch (err) {
    console.error(`[audit-reverse-dns-bots] cannot read log file:`, err);
    process.exit(1);
  }

  const lines = logContent.split(/\r?\n/).filter((l) => l.length > 0);
  console.log(`[audit-reverse-dns-bots] ${lines.length} log lines`);

  // Dedupe IPs : 1 IP par bot pour optimiser DNS queries
  const botRequestsByIp = new Map<
    string,
    { userAgent: string; botName: string; timestamp: string; pattern: RegExp }
  >();

  for (const line of lines) {
    const entry = parseLogLine(line);
    if (!entry) continue;
    for (const bot of KNOWN_BOTS) {
      if (bot.uaPattern.test(entry.userAgent)) {
        if (!botRequestsByIp.has(entry.ip)) {
          botRequestsByIp.set(entry.ip, {
            userAgent: entry.userAgent,
            botName: bot.name,
            timestamp: entry.timestamp,
            pattern: bot.expectedHostnameRegex,
          });
        }
        break;
      }
    }
  }

  console.log(`[audit-reverse-dns-bots] ${botRequestsByIp.size} unique bot IPs to verify`);

  const sample = Math.min(args.sample, botRequestsByIp.size);
  const ipList = Array.from(botRequestsByIp.keys()).slice(0, sample);
  const findings: Finding[] = [];

  let i = 0;
  for (const ip of ipList) {
    i++;
    if (i % 20 === 0) {
      console.log(`[audit-reverse-dns-bots] verifying ${i}/${sample}...`);
    }
    const meta = botRequestsByIp.get(ip)!;
    const result = await verifyBotIp(ip, meta.pattern);
    findings.push({
      ip,
      userAgent: meta.userAgent,
      botName: meta.botName,
      timestamp: meta.timestamp,
      verdict: result.ok
        ? "legitimate"
        : result.reason === "no reverse DNS"
          ? "no_reverse_dns"
          : "fake",
      ...(result.hostname ? { hostname: result.hostname } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    logFile: args.log,
    totalLogLines: lines.length,
    uniqueBotIps: botRequestsByIp.size,
    sampleVerified: ipList.length,
    legitimate: findings.filter((f) => f.verdict === "legitimate").length,
    fakeBots: findings.filter((f) => f.verdict === "fake").length,
    noReverseDns: findings.filter((f) => f.verdict === "no_reverse_dns").length,
    findings,
  };

  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, JSON.stringify(summary, null, 2), "utf-8");

  console.log(`[audit-reverse-dns-bots] report written: ${args.output}`);
  console.log(`  - legitimate bots : ${summary.legitimate}`);
  console.log(`  - FAKE BOTS       : ${summary.fakeBots} 🚨`);
  console.log(`  - no reverse DNS  : ${summary.noReverseDns}`);

  if (summary.fakeBots > 10) {
    console.log(`[audit-reverse-dns-bots] ⚠️  ${summary.fakeBots} fake bots detected`);
    console.log(`  → Recommended : add Cloudflare WAF custom rule to block these IPs`);
  }
}

void main();
