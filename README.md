# exit-sequence
A terminal-style web escape game where you explore, survive, and find a way out.

## Node.js setup

Use Node.js 24.19.0 (LTS), pinned in `.nvmrc`. This version satisfies Vite's
Node.js requirements and has been verified with this project's build.

With nvm installed, run from the repository root in both your local environment
and the Codex Cloud environment setup script:

```sh
nvm install
nvm use
npm ci
```

Before building in a new shell, run `nvm use` to select the pinned version:

```sh
nvm use
npm run build
```

Codex Cloud must have nvm loaded in the shell running these commands. The
`.nvmrc` file specifies the version; it does not switch Node.js automatically.

## Exploration prototype

Explore an initially unknown 4×4 base, collect escape supplies, and avoid one
robot using cameras, prediction, lures and temporary bulkheads. The robot cannot
be defeated. All item placements and balance values are provisional; see
[prototype specification](docs/prototype-spec.md).

```sh
npm test
npm run build
git diff --check
```

Real-browser checks use Playwright with an installed Chromium. Start `npm run dev`
in one terminal, then run `npm run test:browser` in another. By default the check
uses `/usr/bin/chromium`, `http://127.0.0.1:5173/exit-sequence/`, and writes artifacts
to `/tmp/exit-sequence-browser`. Override these with `CHROMIUM_PATH`,
`EXIT_SEQUENCE_URL`, and `EXIT_SEQUENCE_ARTIFACTS`. Both languages are exercised
at 320px, including all 23 requested gameplay scenarios. Deterministic fixtures
cover risky branches; a full escape route also runs through normal UI controls.
Test state access is injected only into the browser check's Vite response and is
not shipped in the production build.
