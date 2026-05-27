# Tools

Each tool lives in its own folder under `src/tools/`.

Current pattern:

- `tool.ts` defines the tool metadata and trigger bindings.
- `cards.ts` contains all `CardService` UI construction for that tool.
- `config.ts` handles loading and saving persisted settings.

Action points specifically follow this split so the card layer stays thin and the logic can be reused by triggers and actions.
