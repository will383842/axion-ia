# DNS Records — Axion-IA Cloudflare zone

**Provider** : Cloudflare (Free plan suffit V1-V2 — ADR 0009).
**Origin** : Hetzner Cloud CPX32 Frankfurt — IP `<TO_FILL>`.
**SSL/TLS mode Cloudflare** : Full (strict).

## Records A / AAAA

| Type | Name         | Target         | Proxied     | TTL  | Sprint | Notes                                        |
| ---- | ------------ | -------------- | ----------- | ---- | ------ | -------------------------------------------- |
| A    | axion-ia.com | `<CPX32-IPv4>` | ✅ Yes      | Auto | M11    | Apex domain (canonical)                      |
| A    | www          | `<CPX32-IPv4>` | ✅ Yes      | Auto | M11    | Caddy 301 → apex                             |
| A    | admin        | `<CPX32-IPv4>` | ✅ Yes      | Auto | M11    | Coolify UI (optionnel — peut rester IP-only) |
| A    | mail         | `<CPX32-IPv4>` | ❌ DNS-only | Auto | M11    | PowerMTA SMTP — ne JAMAIS proxy              |
| A    | mailwizz     | `<CPX32-IPv4>` | ✅ Yes      | Auto | M11    | MailWizz UI campagnes                        |
| A    | sentry       | `<CPX32-IPv4>` | ✅ Yes      | Auto | S23    | Sentry self-hosted dashboard                 |
| A    | plausible    | `<CPX32-IPv4>` | ✅ Yes      | Auto | S23    | Plausible Analytics                          |
| A    | uptime       | `<CPX32-IPv4>` | ✅ Yes      | Auto | S23    | Uptime Kuma dashboard                        |
| AAAA | axion-ia.com | `<CPX32-IPv6>` | ✅ Yes      | Auto | M11    | IPv6 dual-stack                              |
| AAAA | www          | `<CPX32-IPv6>` | ✅ Yes      | Auto | M11    |                                              |

## Records MX (delivery email entrant)

| Type | Name | Priority | Target            | TTL  | Notes           |
| ---- | ---- | -------- | ----------------- | ---- | --------------- |
| MX   | @    | 10       | mail.axion-ia.com | Auto | PowerMTA reçoit |

## Records TXT (email security)

| Type | Name                | Value                                                                                                        | Notes                                        |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| TXT  | @                   | `v=spf1 mx ip4:<CPX32-IPv4> -all`                                                                            | SPF strict                                   |
| TXT  | \_dmarc             | `v=DMARC1; p=quarantine; pct=100; rua=mailto:dpo@axion-ia.com; ruf=mailto:dpo@axion-ia.com; adkim=s; aspf=s` | DMARC quarantine + reports                   |
| TXT  | default.\_domainkey | `v=DKIM1; k=rsa; p=<DKIM-PUBLIC-KEY-2048-BITS>`                                                              | DKIM signature (généré par PowerMTA)         |
| TXT  | mta-sts             | `v=STSv1; id=2026050901;`                                                                                    | MTA-STS policy (avec well-known/mta-sts.txt) |
| TXT  | \_smtp.\_tls        | `v=TLSRPTv1; rua=mailto:dpo@axion-ia.com`                                                                    | TLS-RPT reports                              |

## Records CAA (autorisation Let's Encrypt)

| Type | Name | Flags | Tag   | Value                     | Notes      |
| ---- | ---- | ----- | ----- | ------------------------- | ---------- |
| CAA  | @    | 0     | issue | "letsencrypt.org"         | Caddy ACME |
| CAA  | @    | 0     | iodef | "mailto:dpo@axion-ia.com" | Reporting  |

## Records BIMI (logo email — ADR 0009 future)

| Type | Name           | Value                                                                           |
| ---- | -------------- | ------------------------------------------------------------------------------- |
| TXT  | default.\_bimi | `v=BIMI1; l=https://axion-ia.com/bimi-logo.svg; a=https://axion-ia.com/vmc.pem` |

(BIMI nécessite VMC payant ~$1500/an — reporté V2+.)

## Cloudflare Page Rules

1. `*axion-ia.com/api/*` → Cache Level: Bypass (toutes les API/Server Actions ne doivent pas être cachées)
2. `*axion-ia.com/_next/static/*` → Edge Cache TTL: 1 month, Browser Cache TTL: 1 year (immutable)
3. `*axion-ia.com/admin/*` → Cache Level: Bypass + Disable Performance (admin sensible)

## Vérifications post-config

```bash
# DNS propagation
dig +short axion-ia.com
dig +short MX axion-ia.com
dig +short TXT axion-ia.com

# SSL handshake
openssl s_client -connect axion-ia.com:443 -servername axion-ia.com </dev/null 2>/dev/null | openssl x509 -noout -dates

# Email security validators
# https://mxtoolbox.com/SuperTool.aspx?action=spf%3aaxion-ia.com
# https://mxtoolbox.com/SuperTool.aspx?action=dmarc%3aaxion-ia.com
# https://mxtoolbox.com/dkim.aspx
```
