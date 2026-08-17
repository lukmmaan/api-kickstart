# Security Policy

## Supported Versions

Only the latest published `1.x` release of `@api-kickstart/api-kickstart` receives security fixes.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report it privately through [GitHub Security Advisories](https://github.com/lukmmaan/api-kickstart/security/advisories/new) for this repository. Include:

- A description of the vulnerability and its impact
- Steps to reproduce, or a minimal proof-of-concept
- The affected version(s)

You should get an initial response within a few days. Once a fix is confirmed, a patch release will be published to npm and the advisory will be disclosed.

## Scope

`api-kickstart` composes auth, validation, and database/broker wiring on top of libraries it doesn't implement itself — JWT signing/verification is handled by [`jose`](https://github.com/panva/jose), password hashing by Node's built-in `scrypt`. A vulnerability in one of those underlying libraries should be reported to that project directly; a vulnerability in how this package wires them together (e.g. a scope-filtering bypass, a refresh-token rotation flaw, a CSRF check that can be circumvented) is in scope here.
