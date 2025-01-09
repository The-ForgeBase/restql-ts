# Contributing to RestQL-TS

We love your input! We want to make contributing to RestQL-TS as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Pull Request Process

1. Update the README.md with details of changes to the interface, if applicable
2. Update the docs with any new features or changes
3. The PR will be merged once you have the sign-off of at least one maintainer

## Any Contributions You Make Will Be Under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report Bugs Using GitHub's [Issue Tracker](https://github.com/yourusername/restql-ts/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/yourusername/restql-ts/issues/new); it's that easy!

## Write Bug Reports With Detail, Background, and Sample Code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/restql-ts.git
   cd restql-ts
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run tests:

   ```bash
   npm test
   ```

4. Run linter:
   ```bash
   npm run lint
   ```

## Project Structure

```
restql-ts/
├── src/
│   ├── adapters/         # Framework adapters
│   ├── sdk/             # Query builder SDK
│   ├── types.ts         # Type definitions
│   ├── sqlBuilder.ts    # SQL query builder
│   ├── parser.ts        # Request parser
│   └── index.ts         # Main entry point
├── docs/               # Documentation
├── examples/          # Example usage
└── tests/            # Test files
```

## Testing

We use Jest for testing. Please ensure all new features include appropriate tests.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Coding Style

- We use Prettier for code formatting
- We use ESLint for linting
- TypeScript is used throughout the project
- Follow existing code style and conventions

## Documentation

- Use JSDoc comments for functions and classes
- Keep the README.md up to date
- Update type definitions when changing interfaces
- Add examples for new features

## Adding New Features

1. First, discuss the feature in an issue
2. Create a new branch for your feature
3. Add tests for your feature
4. Update documentation
5. Submit a pull request

## SQL Dialect Support

When adding support for a new SQL dialect:

1. Create a new file in `src/dialects/`
2. Implement the dialect-specific SQL generation
3. Add tests for the new dialect
4. Update documentation with dialect-specific examples

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Reference issues and pull requests liberally after the first line

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
