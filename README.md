# EXIT SEQUENCE

A small cause-discovery prototype in a damaged lunar base. Observe an anomaly,
inspect its actual cause, decide how to deal with it, and confirm the cause through
the result. Scientific knowledge lets you skip hints; it is never required.

15 scenes, 30 choice definitions, three problems: pressure holding a door shut,
ice blocking a valve shaft, and two machines overloading a power supply.
Three free AI hints per problem lead all the way to a clear explanation and a
solution. Ordinary mistakes remain recoverable. No inventory puzzles, preparation
slots, action costs, random events or time limit.

Japanese and English share the same logic. The green terminal has a story log,
full-width choices and a language-only menu. Tap the log to skip typing; reduced
motion displays text immediately. Reading and language changes never advance play.

Target first play: 5–10 minutes, pending human playtesting. Automated checks confirm
that the routes work, not whether discovery feels satisfying.
See [design](docs/game-design.md), [spec](docs/prototype-spec.md),
[writing](docs/writing-style.md), [UI](docs/ui-layout.md), and
[evaluation report](docs/implementation-report.md).

Node 24.19.0 (`.nvmrc`):

```sh
npm ci
npm test
npm run build
git diff --check
npm run dev
# In another terminal:
npm run test:browser
```

Chromium uses `/usr/bin/chromium` and `http://127.0.0.1:5173/exit-sequence/`.
Override with CHROMIUM_PATH or EXIT_SEQUENCE_URL. Screenshots and the report go to
`/tmp/exit-sequence-browser` (EXIT_SEQUENCE_ARTIFACTS overrides this).
Browser tests operate real buttons in ja/en at 320px: A without hints, B with all
final hints, C with recoverable mistakes. Read-only State inspection is injected
only into the test response and is never shipped.
