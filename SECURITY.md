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

## Notes on this repository's data

- No real client data, credentials, or `.db` files are ever committed —
  enforced via `.gitignore` and manually verified before every push
  (see `GIT_WORKFLOW.md`).
- Passwords are hashed with bcrypt; sessions are held in memory, not
  persisted to disk.
- IPC channel access is role-gated through `ipc-channels.cjs` as the
  single source of truth for permissions.

If you find an actual instance of committed secrets or client data in
this repository's history, please report it immediately via the private
channel above rather than filing a public issue — it will be treated as
a P0 and the history will be rewritten (see the remediation protocol in
`GIT_WORKFLOW.md`).
