# Exit Sequence

A short SF survival puzzle in a damaged lunar base. Observe how machines behave,
combine independent preparations, execute a plan, and learn from the result.
The robot, airlock, lift and return ship each require more than one action.
Consequences are deterministic; the player's own memory can replace stored facts.

The provisional slice has 31 scenes, 94 choice definitions, four challenges,
four tools with multiple uses, and Japanese/English prose sharing the same rules.
See [design](docs/game-design.md), [prototype specification](docs/prototype-spec.md)
and [implementation report](docs/implementation-report.md).

The green terminal keeps story history above current full-width choices. The
top-right menu contains only language settings. Air, injury, alert and current
preparations are described in prose. Most failures allow another attempt; repeated
mistakes spend air, damage the body or raise alert. Consumables cannot be retrieved
again. There is no map, status panel, inventory panel or game save.

Tap the log to finish the typewriter animation. Reduced motion displays text
immediately. Reading and changing language never advance play. Only the language
preference is saved. The first-play target is 10–20 minutes; human play time and
the quality of the reasoning experience still need user playtesting.

Use Node.js 24.19.0 (pinned in `.nvmrc`).

```sh
npm ci
npm test
npm run build
git diff --check
```

Run `npm run dev` and then `npm run test:browser`.
Playwright uses `/usr/bin/chromium`, `http://127.0.0.1:5173/exit-sequence/`,
and writes screenshots/report to `/tmp/exit-sequence-browser`.
Override with CHROMIUM_PATH, EXIT_SEQUENCE_URL or EXIT_SEQUENCE_ARTIFACTS.

Tests play ordinary choices from START: six distinct solutions, an additional
refill route, recoverable mistakes and all three OVER conditions. Chromium tests
both languages at 320px and compare every operation with the reference Game.
Read-only observation is injected into the test browser's Vite response; it is
never shipped. Bounded exploration from legal routes covers every choice without
claiming exhaustive traversal of indefinitely repeatable panel adjustments.
