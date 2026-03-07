# Contributing to Sonic Pi for VS Code

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or 20
- [VS Code](https://code.visualstudio.com/) 1.109+
- [Sonic Pi](https://sonic-pi.net/) v4.x (for manual testing)

### Getting Started

```bash
git clone https://github.com/bamr87/vs-sonic-pi.git
cd vs-sonic-pi
npm install
npm run build
```

### Running the Extension

1. Open the project in VS Code
2. Press **F5** to launch the Extension Development Host
3. Open or create a `.spi` file in the new window
4. Make sure Sonic Pi is running to test the connection

### Running Tests

```bash
npm test            # run all tests once
npm run test:watch  # run tests in watch mode
```

### Linting

```bash
npm run lint
```

## Project Structure

```
src/
├── extension.ts          # Entry point — activation, wiring
├── commands/             # Run, Stop command handlers
├── config/               # ConfigManager (VS Code settings)
├── connection/           # OSC transport, heartbeat, port discovery
├── data/                 # sonic-pi-data.json (synths, samples, FX, etc.)
├── language/             # Completions, hover, diagnostics, snippets
├── log/                  # Log output channel and formatting
├── types/                # TypeScript type definitions
└── ui/                   # Status bar, tree views, webviews
```

See [docs/00-index.md](docs/00-index.md) for detailed architecture documentation and the [PRD](PRD.md) for the full product requirements.

## Code Style

- **TypeScript** with strict mode
- **ESLint** for linting (`npm run lint`)
- **Prettier** for formatting (config in `.prettierrc`)
- Use the **disposable pattern** — all subscriptions and resources must be pushed to `context.subscriptions` or cleaned up in `dispose()`
- Prefer `async/await` over raw promises
- Prefix unused parameters with `_`

## Making Changes

### Branch Naming

- `feature/<short-description>` for new features
- `fix/<short-description>` for bug fixes
- `docs/<short-description>` for documentation changes
- `chore/<short-description>` for maintenance tasks

### Commit Messages

Use clear, imperative-mood messages:

```
Add hover documentation for FX parameters
Fix heartbeat timeout on slow connections
Update README with new keybinding table
```

### Pull Request Process

1. Fork the repository and create your branch from `main`
2. Make your changes and add tests where appropriate
3. Run `npm run lint` and `npm test` to verify everything passes
4. Update documentation if your change affects user-facing behavior
5. Open a pull request with a clear description of the changes

## Updating Sonic Pi Data

The extension's language data (synths, samples, FX, scales, chords) is extracted from the Sonic Pi source. To regenerate it:

1. Clone the [Sonic Pi repository](https://github.com/sonic-pi-net/sonic-pi) alongside this project
2. Run `SONIC_PI_PATH=/path/to/sonic-pi npm run extract-data`

## Reporting Issues

- Use the [bug report template](https://github.com/bamr87/vs-sonic-pi/issues/new?template=bug_report.md) for bugs
- Use the [feature request template](https://github.com/bamr87/vs-sonic-pi/issues/new?template=feature_request.md) for ideas

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
