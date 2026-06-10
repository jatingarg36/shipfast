# Custom Domains / CNAME

## Overview

Allow ShipFast users to serve their published pages from their own domain (e.g. `pages.mybrand.com`) instead of the default ShipFast subdomain. The platform handles the CNAME resolution, SSL certificate provisioning, and routing — the user only needs to add a DNS record.

## Key Requirements

- User can add a custom domain to any page or their account from the dashboard
- Platform validates domain ownership (DNS TXT record check or CNAME verification)
- Automatic SSL certificate provisioning and renewal via Let's Encrypt (ACME protocol)
- CNAME routing: `pages.mybrand.com → shipfast.io` → resolves to the correct page
- Support for apex domains via ALIAS/ANAME or A record (not just subdomains)
- Domain can be scoped to a single page or act as a root for all user pages
- Clear error messaging for misconfigured DNS, expired certs, and propagation delays

## User Stories

**As a publisher:**
- I add my domain `demo.mycompany.com` in the dashboard and am shown the DNS record to add
- Once DNS propagates, my ShipFast page is live at my domain with HTTPS
- If my cert is about to expire, I get an email warning (ideally it renews automatically)
- I can remove a custom domain and revert to the default ShipFast URL at any time

**As a visitor:**
- I visit `demo.mycompany.com` and see the page load with no redirect or ShipFast branding in the URL
- HTTPS just works — no cert warnings

## High-Level Architecture

```
User DNS: demo.mycompany.com  CNAME  shipfast.io
                                        │
                                  Ingress / reverse proxy
                                  (checks SNI / Host header)
                                        │
                              Domain mapping store (DB/Redis)
                                  domain → page_id / user_id
                                        │
                                  Page serving layer
                                  (fetches HTML from S3)
```

**Key components:**

1. **Domain registration flow** — dashboard UI collects domain, stores pending record, shows required DNS entry
2. **DNS verification job** — background worker polls DNS until CNAME/TXT resolves correctly, then marks domain active
3. **Certificate manager** — uses `certbot` or an ACME library; issues cert on domain activation, stores in cert store (e.g. AWS Certificate Manager or file-based), auto-renews before expiry
4. **Ingress routing** — nginx/Caddy or custom reverse proxy reads `Host` header, looks up domain mapping, proxies to internal page server
5. **Domain mapping store** — fast lookup table (Redis or Postgres with index) mapping `hostname → page_id`

**Simplest viable path:** Use Caddy as the reverse proxy — it handles ACME/SSL automatically and can be configured programmatically via its admin API. On domain activation, add a Caddy site block via API and it handles certs with zero extra tooling.
