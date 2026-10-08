# Exit Sequence

A short SF survival gamebook set in a critically damaged lunar base. Read sounds,
light and records, then choose an action using what you know and carry. A robot
is a narrative threat; choices have deterministic consequences.

The provisional slice has 18 scenes, two converging story branches, four facts,
four tools, three coarse state categories and three endings. Japanese and English
share all game rules. See [design](docs/game-design.md) and
[prototype specification](docs/prototype-spec.md).

The screen keeps story history and current choices in view, with a green terminal
palette and a language-only dropdown in the top-right hamburger button. Read the
scene and choose an action; facts and tools unlock new choices. Longer work uses
oxygen and noise raises robot alert. Choices cannot be undone. Tap the log to
finish text animation. Opening the menu and changing language never advances the
story. Only the language preference is saved; there is no game save.

Use Node.js 24.19.0 (pinned in `.nvmrc`). With nvm: `nvm install` and `nvm use`.

```sh
npm ci
npm test
npm run build
git diff --check
```

Run `npm run dev` in one terminal and `npm run test:browser` in another.
Playwright uses `/usr/bin/chromium`, `http://127.0.0.1:5173/exit-sequence/`, and
writes screenshots and a report to `/tmp/exit-sequence-browser` by default.
Override with `CHROMIUM_PATH`, `EXIT_SEQUENCE_URL`, `EXIT_SEQUENCE_ARTIFACTS`.
The test plays legal choices from START in both languages at 320px. Read-only
state and history access is injected into the test browser’s Vite response and is never
shipped. Unit tests traverse every reachable state and confirm every Scene and
Choice is reachable. There are no state-modifying browser fixtures.
