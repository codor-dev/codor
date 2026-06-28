# Changelog

All notable changes to Codor are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the format of
[Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] - 2026-06-28

A security-focused release. The previous "secure" claims are now actually
enforced rather than advisory.

### Security
- **Real human-in-the-loop approval.** Commands no longer execute the instant the
  model proposes them. With autopilot off (now the default), execution pauses
  until you explicitly approve each command; rejecting feeds the decision back to
  the model instead of running anything.
- **Secrets moved to the OS keychain.** Vault credentials and the API key are now
  stored in the native OS keychain (macOS Keychain / Windows Credential Manager /
  Linux Secret Service) instead of plaintext in SQLite. The secret is read only
  inside the Rust backend at execution time and never crosses into JavaScript. A
  one-time migration moves any existing plaintext secrets into the keychain and
  clears them from the database.
- **Fail-closed command filters.** If the security database is missing or
  unreadable, commands are now blocked rather than allowed through. Filter
  matching also normalizes whitespace so trivial obfuscation (`rm  -rf  /`) no
  longer slips past.
- **Safer SSH.** `StrictHostKeyChecking` changed from `no` to `accept-new` to
  detect man-in-the-middle key changes; host parsing hardened against malformed
  `user@host` targets.
- **No silent local execution.** A missing or wrong credential id now errors out
  instead of falling back to running the command on the host machine. Local
  execution requires a credential whose secret is exactly `local`/`localhost`.
- **Content Security Policy enabled.** Replaced the disabled (`null`) CSP with a
  restrictive policy to mitigate API-key exfiltration via XSS.

### Added
- macOS builds are now code-signed with an Apple Developer ID and notarized.
- Maximum iteration cap (25) on the agent loop to prevent runaway tool-call loops
  and unexpected API costs.

### Fixed
- Backup filenames now use millisecond timestamps to avoid collisions when
  backing up the same file twice within one second.
- Synced version numbers across `package.json`, `Cargo.toml`, `tauri.conf.json`,
  and the in-app About screen; cleaned up placeholder crate metadata.

## [0.1.0] - 2026-06-28

- Initial release: local-first DevOps agent with Rust command filters, pure-Rust
  backups, and CI/CD release workflow.
