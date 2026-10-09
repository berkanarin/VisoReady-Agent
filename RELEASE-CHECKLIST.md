# Release Gate

No command in this package publishes, pushes or creates a remote release automatically.

## Automated preparation

- Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e`. Build first: installer tests require the compiled runtime.
- Run `pnpm exec node scripts/release-smoke.mjs`. Keep its JSON report locally.
- Create a new clean bundle: `node scripts/release.mjs --out <new-directory>`.
- Validate its `RELEASE-MANIFEST.json` hashes. Only the allowlisted sources, demo, editor, docs and notices belong in a release.
- Do not upload the smoke workspace: it contains installed dependencies, generated runtime metadata and test outputs.

## Before public distribution

- Verify the final remote repository URL, visibility and ownership with the maintainer.
- Review the actual staged files for credentials, local paths and private material. An allowlist is not a secret scanner.
- Include MIT LICENSE and preserve all third-party notices; do not relabel dependencies as original MIT code.
- Confirm the bundled editor is the intended VisoReady.html version.
- Test a new real Codex session and a new real Claude Code session discovering the installed skill and completing the bundled demo. A runner smoke test alone does not prove model behavior.
- Test macOS/Linux before advertising those platforms as verified. Windows validation does not establish portability by itself.
- Add the real repo URL and release tag to public instructions once they exist.
- Describe this as a beta with support limitations; no claim of universal one-click support.

## Known limitations

The package must remain at its installed path. No auto-update service or automatic migration of edited skills is provided. Native capture needs a host tool. Quality warnings need human review. The agent has no authority to mutate production data just because it is installed.
