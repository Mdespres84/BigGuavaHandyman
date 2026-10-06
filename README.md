# Big Guava Handyman — Website Build & Launch Guide

Master reference for the bigguavahandyman.com website. Everything needed to edit, publish, connect and maintain the site lives in this file and this folder.

Last consolidated: October 6, 2026.

---

## 1. What the site is

A static website hosted free on GitHub Pages. No server, database, admin login or payments, so there is very little to attack.

- **9 service pages** with price ranges, plus Services, Service Area, FAQ, About, Privacy and 404 pages.
- **Estimate builder** (`estimate.html`): customers pick services, size and add-ons; the price range updates live; they send the list. The request is emailed to you through **Web3Forms** (free). Nothing is sold on the site.
- **Built-in rules:** $179 minimum visit, $2,500 job cap warning (Florida handyman-exemption limit), prices rounded to $5.
- **Products Big Guava supplies** (TV mounts, cord covers, anti-tip kits, pet screen): labor keeps its own price; a "Who supplies it?" sub-choice shows $0 for customer-supplied or "Cost + 15%" for Big Guava-supplied. No fixed product price is shown.
- **Hours:** Saturday–Sunday, 8 a.m.–5 p.m. Service area: ~30 minutes from Town 'N' Country.
- **Brand:** logo Concept A (halved guava with hex nut). Colors: green `#1F4D3A`, pink `#E8798A`, red `#C23B52`, cream `#F6EFE6`. Fonts: Bricolage Grotesque (headings) and Figtree (body), self-hosted.

## 2. File map

| Path | What it is |
|---|---|
| `index.html` | Home page |
| `services.html`, `services/*.html` | Service overview + 9 service pages |
| `estimate.html` | Estimate builder / request form |
| `service-areas.html`, `faq.html`, `about.html`, `privacy.html`, `404.html` | Supporting pages |
| `data/services.json` | **All prices and options.** Edit this to change pricing. |
| `assets/js/config.js` | **Form key and phone number.** |
| `assets/js/estimate.js` | Estimate builder logic and form submission |
| `assets/js/site.js` | Menu toggle, cart count, "from $" prices |
| `assets/css/site.css` | All styling |
| `assets/fonts/` | Self-hosted fonts (no outside font service) |
| `assets/img/` | Logo, favicons, link-share image (`og.png`) |
| `favicon.svg`, `site.webmanifest` | Browser/phone icons |
| `robots.txt`, `sitemap.xml` | Search engine files |
| `.well-known/security.txt` | Security contact |
| `.nojekyll` | Tells GitHub Pages to serve files as-is. **Must be uploaded.** |
| `.gitignore` | Keeps junk files out of the repo |

## 3. Before you go live

### 3a. Replace placeholders (find-and-replace across all files)

| Find | Replace with |
|---|---|
| `(813) 555-0100` | Your Google Voice number, e.g. `(813) 123-4567` |
| `+18135550100` | Same number as `+1` + 10 digits |
| `hello@bigguavahandyman.com` | Your Big Guava address (e.g. `mike@bigguavahandyman.com`) — or keep `hello@` as an alias |
| `https://bigguavahandyman.com` | Only if you end up on a different domain |

### 3b. Connect the form (Web3Forms)

1. Go to web3forms.com, enter the inbox that should receive requests (your Workspace inbox via the Big Guava alias), and copy the access key.
2. In the Web3Forms dashboard: restrict the key to `bigguavahandyman.com`, turn the spam filter on.
3. Open `assets/js/config.js` and set:
   - `WEB3FORMS_KEY` → your key (it's designed to be public)
   - `PHONE` → your business number
   - leave `PHOTO_UPLOADS: false` (attachments are a paid Web3Forms feature; customers text photos instead)
4. Until a key is in, the form runs in **preview mode** and says so on screen; nothing is sent.

Emails arrive with subject **"Estimate request $X–$Y from Name."**

## 4. Publish on GitHub Pages

1. **Turn on two-factor login on GitHub first.** Account takeover is the main real risk for this site.
2. Create a new **public** repo, e.g. `big-guava-site`.
3. Upload everything in this folder to the repo root (drag and drop works). Make sure `.nojekyll` and the `.well-known` folder go up — on a Mac, press Cmd+Shift+. in Finder to see hidden files.
4. Repo **Settings → Pages** → Source: **Deploy from a branch**, branch `main`, folder `/ (root)` → Save.
5. In 1–2 minutes it's live at `https://YOUR-USERNAME.github.io/big-guava-site/`.

## 5. Domain

1. Buy `bigguavahandyman.com` at **Cloudflare Registrar or Porkbun**. Turn on two-factor login and auto-renew; skip every add-on.
2. **Verify the domain with GitHub first:** profile **Settings → Pages → Add a domain**, then add the TXT record GitHub gives you at your registrar. This stops anyone else claiming your domain on GitHub.
3. Repo **Settings → Pages → Custom domain** → `bigguavahandyman.com` → Save (GitHub creates the `CNAME` file).
4. At the registrar, add DNS records:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `YOUR-USERNAME.github.io` |

   If you use Cloudflare, set these records to **DNS only** (grey cloud), not proxied.
5. When the certificate is ready (up to a day), tick **Enforce HTTPS**.

## 6. Email on the domain (uses the Workspace you already pay for)

Goal: customers only ever see the Big Guava address, never Streak.

1. Google Admin → **Account → Domains → Manage domains → Add a domain** → `bigguavahandyman.com` as a **User alias domain** (no extra cost). Verify with the TXT record it gives you.
2. DNS records at the registrar:

| Type | Name | Value |
|---|---|---|
| MX | `@` | `smtp.google.com`, priority 1 |
| TXT (SPF) | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT (DKIM) | `google._domainkey` | Generate in Admin → Apps → Gmail → Authenticate email, then click Start authentication |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:YOUR-BIG-GUAVA-ADDRESS` |

   If the registrar already shows an SPF record, merge into one — never two SPF records.
3. Send a test from a personal Gmail to `mike@bigguavahandyman.com`.
4. Gmail → Settings → Accounts → **Send mail as** → add the Big Guava address; turn on **Reply from the same address the message was sent to**.
5. **Make the Big Guava address your default "Send mail as"** (or switch the From line every time). The ops sheet's estimate/invoice drafts use your default address — today that's Streak.
6. Signature: name, phone, website. Never "licensed" or "contractor."
7. Gmail filters → label **Big Guava** for subject `Estimate request` (website) and `New job request` (ops sheet alerts).
8. After ~a month of clean DMARC reports, change DMARC to `p=quarantine`.

## 7. Go-live test

1. Re-upload any files you changed (config.js and the HTML pages after find-and-replace).
2. On your phone: build an estimate with a "Big Guava supplies it" option, send it, and confirm the email lands under the Big Guava label.
3. Check the phone and email links in the footer actually work.
4. Add the site to **Google Search Console** and submit `https://bigguavahandyman.com/sitemap.xml`.
5. Only now share the link (Google profile, Facebook, Nextdoor, flyer, cards, truck magnets).

## 8. Changing prices and services

Edit `data/services.json` and commit. Top-level settings:

- `minimumVisit` — minimum per visit (currently 179). **Also update the FAQ text** in `faq.html` (it says $179 in two places).
- `jobCap` — 2500, the warning threshold. Don't raise it; it's the legal limit for unlicensed work.
- `roundTo` — rounding for ranges.

Each service has:

- `variants` — pick-one sizes/options, each with `low` and `high`.
- `addons` — extras. `"each": true` multiplies by quantity (e.g. per TV); `"count": true` lets the customer choose how many.
- `qty` — whether the customer can set a quantity, and the max.
- `supply` — products Big Guava can supply (shows the "Who supplies it?" choice at cost + 15%).

The "from $X" prices on the home and services pages fill in from this file automatically. The schema data in each page's `<head>` (min/max prices for Google) and the price ranges written into each service page are static — if you change a service's range, update that service page and the `hasOfferCatalog` block too, or ask Claude to regenerate them.

## 9. Security (keep these true)

- Every page has a strict Content Security Policy: only the site's own files, and form data may go only to `api.web3forms.com`. Trusted Types are enforced.
- Nothing loads from other websites — fonts are self-hosted, no analytics, no trackers, no cookies. **Don't add embeds, chat widgets or analytics without updating the CSP and privacy page.**
- Form fields are stripped of line breaks (blocks email header tricks); a hidden honeypot drops bots; there's a 60-second resend cooldown.
- The cart lives only in the visitor's browser (localStorage) until they send it.
- **Two-factor login on GitHub, the registrar and Google Workspace** — these accounts are the real attack surface.
- The Web3Forms key is public by design; the domain restriction is what protects it.

## 10. Optional later: send website requests straight into the ops sheet

Right now website requests arrive by email only. The ops sheet (`ops/BigGuavaOps.gs`) already has a `doPost` endpoint that turns a website request into a Client + Estimate (status "Request"). To connect them:

1. In the ops sheet's Apps Script: **Deploy → New deployment → Web app**, Execute as **Me**, Who has access **Anyone**. Copy the URL and paste it in Settings → **Website Endpoint**.
2. In every page's Content Security Policy, change `connect-src` to:
   `connect-src 'self' https://api.web3forms.com https://script.google.com https://script.googleusercontent.com;`
3. In `assets/js/estimate.js`, after the Web3Forms send succeeds, add a second fire-and-forget POST to the web app URL (`mode: 'no-cors'`) with `name, phone, email, address, city, zip, timing, message, items: [{name, qty, price}], company_website: ''`. Keep Web3Forms — it's your backup if the script ever fails.
4. Test: send one estimate, confirm it lands both in email and on the Estimates tab.

Ask Claude to make the step 2–3 edits when you're ready; it's a small change.

## 11. Ongoing maintenance

- Price changes → `data/services.json` (+ service page and FAQ text if ranges/minimum change).
- New service → new entry in `services.json` + a new `services/*.html` page (copy an existing one) + add to nav lists, `sitemap.xml` and the schema block. Easier to have Claude generate it.
- Renew the domain (auto-renew on) and update `Expires` in `.well-known/security.txt` yearly.
- Update the copyright year in the footer each January.
- Never add "licensed," "contractor" or "insured" (until insurance is active) anywhere on the site.

## 12. Where things live

- **Site files:** this folder / the `big-guava-site.zip` in the Big Guava project.
- **Live preview:** the "Big Guava Handyman" artifact in Claude.
- **Ops system:** `ops/BigGuavaOps.gs` in the Big Guava project.
- **Launch order:** Big Guava Master Task List (Phase 2 = domain/email/phone, Phase 3 = website live).
- **Logo kit & brand guide:** `big-guava-logo-kit.zip` from the original business chat.
