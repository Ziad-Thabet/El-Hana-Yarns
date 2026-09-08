# Security Policy

El-Hana Yarns is a desktop POS and business-management system handling
authentication, employee salary data, customer debt records, and payment
tracking for a real business. Security reports are taken seriously even
though this is a portfolio-published repository.

## Supported Versions

This project does not yet follow semantic version releases (see
`CHANGELOG.md`). Security fixes are applied directly to `main`.

| Branch | Supported |
| ------ | --------- |
| main   | ✅        |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead:
1. Use GitHub's [private vulnerability reporting](https://github.com/Ziad-Thabet/El-Hana-Yarns/security/advisories/new)
   (Security tab → "Report a vulnerability"), or
2. Contact the maintainer directly via GitHub: https://github.com/Ziad-Thabet

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (or a PoC if applicable)
- Which part of the system is affected (auth, IPC, database layer, etc.)

You can expect an initial response within a few days. This is a solo-
maintained project, so response time isn't guaranteed on an SLA, but
security reports are prioritized over feature work.

## How the application is defended

- **The renderer is not trusted.** `contextIsolation` and `sandbox` are on,
  `nodeIntegration` is off, and the only surface it can reach is the
  enumerated API in `preload.js`.
- **Every IPC call is authorised against the caller's own session,** resolved
  in the main process. A session id or actor planted in a payload is ignored,
  so the renderer cannot claim an identity it does not have.
- **Permissions are capabilities held by roles,** declared once in
  `ipc-channels.cjs` and stored as rows. A database whose roles table is empty
  still admits the owner, so a partial migration cannot lock a shop out of its
  own till.
- **Passwords are hashed with bcrypt** with per-hash salts. Sessions live in
  memory, expire, and are destroyed when a user is deactivated. Repeated failed
  logins are rate-limited and then locked out.
- **The activity log is append-only,** enforced by database triggers rather
  than by convention, and password fields are stripped before a record is
  written.
- **No real client data, credentials, or `.db` files are ever committed.**
  `.gitignore` covers `.db`, `.sqlite` and `userdata/`, and the test suite
  builds its own fixture rather than depending on a real database.

If you find an actual instance of committed secrets or client data in this
repository's history, please report it immediately via the private channel
above rather than filing a public issue. It is treated as the highest
priority: the credential is rotated first, then the history is rewritten and
force-pushed.
