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
