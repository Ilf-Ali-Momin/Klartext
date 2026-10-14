# Data flows (technical facts for the privacy policy)

This file describes what the code does with data. It is not a privacy policy and not legal advice. Whoever
writes the Datenschutzerklärung should check every point against the deployed setup and the providers'
current terms. Keep this file up to date when the code changes.

## Uploaded letters

- The browser resizes photos to at most 1600 px and re-encodes them as JPEG before upload. PDFs are sent as they are (max 4 MB).
- `POST /api/explain` receives the images or PDF as base64 in the request body and holds them in memory only.
- The server sends them to the Anthropic API (model from `LLM_MODEL`) together with the system prompt, and receives the structured explanation.
  - Anthropic's own retention and processing location are set by Anthropic's terms and your account settings. Confirm them before launch (owner checklist).
- The explanation is returned to the browser and shown there. The server does not write the letter, the extracted text or the explanation to a database, file, log or analytics tool.
- Server logs contain only a request id, an error type and an HTTP status (`lib/log.ts`).
- The calendar file (.ics) is built in the browser. Nothing about it is sent to the server.

## Cookies (both httpOnly, SameSite=Lax, Secure in production, first party)

| Name | Content | Lifetime | Purpose |
| --- | --- | --- | --- |
| `bk_free` | number of free letters used on this device | 1 year | one free letter per device |
| `bk_code` | the credit code the person bought or entered | 2 years | lets the device use paid letters |

There are no analytics, tracking pixels, third party scripts or externally loaded fonts.

## Supabase (Postgres)

| Table | Content | Retention |
| --- | --- | --- |
| `free_usage` | `sha256(ip + IP_HASH_SALT + day)`, the day, a count | deleted after 7 days by `cleanup_free_usage()` |
| `credits` | random code, Stripe Checkout session id, pack, credits total and left, created at | no automatic deletion |
| `paid_usage` | credit id, the hour, a request count | deleted after 1 day by `cleanup_free_usage()` |

No names, emails, raw IP addresses or letter content are stored. The daily IP hash changes every day and needs the secret salt to reproduce.

## Stripe

- `/buy` sends the person to Stripe Checkout. Stripe collects payment details and, depending on the payment method, name and email. The app never receives card details.
- The app stores only the Checkout session id with the credit row. The owner can look up a lost code by finding the session in the Stripe dashboard.

## Hosting

- Next.js on Vercel with functions pinned to `fra1` (Frankfurt), or Docker on Hetzner (phase 6).
- The host sees request metadata such as IP addresses in its own request logs. Check the host's log retention.
