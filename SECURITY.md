# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability, please report it privately - do not open a public GitHub issue with exploit details.

**Preferred path:** Use GitHub's built-in [Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).
This is available under the **Security** tab of this repository -> "Report a vulnerability".
It keeps details confidential until a fix is ready.

**Fallback:** If Private Vulnerability Reporting is unavailable, open a GitHub issue with minimal details labeled **security** and request a private contact path. A maintainer will respond with a secure channel.

Please include:

- a clear description of the issue
- steps to reproduce
- affected versions/branches (if known)
- potential impact

We aim to acknowledge reports within **5 business days**.

## Scope

This is a browser-based game with no backend service. The primary attack surface is:

- Malformed level or benchmark data imported by the user (input validation in `packages/shared/src/constraints.ts` and parsers)
- Worker message handling (validated via versioned protocol schemas)
- Third-party dependencies

Implementation guidance for repo-level secure coding and trust-boundary handling lives in
`docs/security-guidance.md`.

## Supported versions

Until the first stable release, security fixes will be applied to the `main` branch.
