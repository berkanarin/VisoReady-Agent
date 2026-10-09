# Install VisoReady Agent

This is a local skill and tool package for Codex and Claude Code, not a hosted chatbot or a Claude.ai web upload. A terminal-capable coding agent can perform the installation. Never install a similarly named registry package as a substitute.

## Give this to your coding agent

> Install VisoReady Agent from https://github.com/berkanarin/VisoReady-Agent for the coding assistant I am using. Read INSTALL.md at the repository root first. Check prerequisites and inspect installation commands. Do not overwrite an unrelated existing skill or change security policies. Run doctor and the bundled demo, report failures and quality warnings, then tell me how to start a new session. Do not capture my projects yet.

Official repository: https://github.com/berkanarin/VisoReady-Agent.

## Requirements

- Node.js 22.13 or later; pnpm 11.25.0 (the version pinned in package.json).
- Git if cloning; a writable local directory that will remain in place.
- Internet for dependency installation and the Chromium download; adequate disk space.
- A local Codex or Claude Code installation that discovers user skills. The skill itself does not supply the AI model or account.

The bootstrap checks Node and pnpm before installing anything. It does not install prerequisites globally, bypass execution policies, sign in, or change permissions. On Linux, missing Chromium system libraries may require an administrator; follow the browser error instead of silently escalating.

## Install

Clone the entire repository and enter its root directory. Do not download only `skill/visoready-agent`.

```sh
git clone https://github.com/berkanarin/VisoReady-Agent.git
cd VisoReady-Agent
node scripts/setup.mjs --client codex
```

For Claude Code use `--client claude`; to install both use `--client both`. Windows also supports `./Setup.ps1 -Client codex` when local policy allows scripts. The Node command needs no PowerShell policy change.

The setup installs locked dependencies, builds the runtime, downloads Chromium, checks the editor and browser, and installs the selected skill. It does not run customer applications.

```sh
pnpm agent doctor
pnpm demo
```

The demo uses only its bundled local fixture. Review its generated `check/quality.json`; warnings may remain even when functional checks pass.

## Start using it

Start a new coding-agent session. Ask:

> Use VisoReady Agent to analyze my local project and suggest usage-flow topics. Wait for my selection before capturing anything.

Then provide your project path or repository URL. A specific request such as "Create a new-reservation flow" already selects the topic. The agent should use real UI, ask for missing access, and return an editable VisoReady JSON plus a preview. Open the JSON with VisoReady's Project/Open action, review and share.

## Installed paths and updates

- Codex: `$CODEX_HOME/skills/visoready-agent`, or `~/.codex/skills/visoready-agent`.
- Claude Code: `~/.claude/skills/visoready-agent`.
- `runtime.json` is generated locally. It records this package path and the Node executable; never commit or redistribute it.

Update the repository in the same directory, review changes, then rerun setup. Same-location installs refresh the skill and runtime metadata. Different installations are rejected instead of being overwritten. Back up any personal modifications before updating. Keep this package directory: installed skills delegate to it.

If you move the package, verify the old skill belongs to VisoReady Agent, back up that skill directory, remove only that owned installation and rerun setup from the new location. Do not edit other skills. To uninstall, remove only this skill directory; the package and generated projects remain until you choose to remove them.

## Scope and privacy

Web capture works through Playwright. Desktop apps such as PowerPoint need a separately available, authorized computer-control tool. No automatic native controller, video import or fake-UI fallback is bundled. Source projects can require their own runtime, backend, test data or login.

The runtime does not call a model API. The host coding agent's normal account and data policies still apply. Never commit `.env`, browser sessions, private captures, production snapshots or `runtime.json`. Use test data. Installation/build scripts execute code; review the source before running them.

## Verified versus pending

The release smoke script checks an isolated package directory, separate pnpm store, separate browser cache, both skill paths, both runner commands and a real browser demo on the current host. This is not a fresh operating-system image or a Claude Code conversation test. macOS/Linux and actual new-session discovery in both clients remain release checklist items until performed.
