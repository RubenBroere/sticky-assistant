# Contributing to Sticky Assistant

First off, thank you for considering contributing to Sticky Assistant! It is people like you who make this project great.

## Branching Strategy

This project uses a standard branch structure:

- **`main`**: Reflects the stable, production-ready release state.
- **`dev`**: The active integration branch for ongoing development. All feature branches should target `dev` via Pull Requests.
- **Feature Branches**: For working on individual features or fixes (e.g. `feat/my-new-tool` or `fix/calendar-sync-bug`). Always branch off `dev`.

## Setup & Local Development Workflow

1. **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) (v20+) installed.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Build the production bundle**:
   ```bash
   npm run build
   ```
4. **Link to Google Apps Script**:
   Login and push using Clasp:
   ```bash
   npx clasp login
   npx clasp push
   ```

## Development & Code Guidelines

### 1. Code Style & Linting

- We use ESLint and Prettier to enforce consistent code style.
- Run the formatter before committing:
  ```bash
  npm run format
  ```
- Run the linter and TypeScript compiler checks:
  ```bash
  npm run lint
  ```
  Ensure all errors and warnings are resolved.

### 2. Unit Testing

- All core logic (non-UI) should have associated unit tests inside `*.test.ts` files.
- We use **Vitest** for unit testing.
- Run tests locally:
  ```bash
  npm run test
  ```

### 3. Exposing Callbacks to Google Apps Script

- The Google Apps Script runtime requires entry point triggers and UI callback functions to exist in the global scope.
- **Mandatory Step**: If you add any callback action (e.g. `setFunctionName('myAction')`), you **must** export it from `src/index.ts` so that the Rollup compilation and the `@gas-plugin/unplugin` can unroll it into a global-scope function in the output bundle.

## Pull Request Guidelines

1. Create your feature branch off `dev`.
2. Commit your changes with descriptive messages.
3. Verify that `npm run lint`, `npm run format`, `npm run test`, and `npm run build` all run cleanly locally.
4. Push your branch to GitHub and create a Pull Request targeting `dev`.
5. Fill out the Pull Request template checklist.
6. The CI pipeline will automatically run all linting, type-checking, formatting, and unit tests.
