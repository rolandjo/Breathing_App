# Versioning and releases

The app uses [Semantic Versioning](https://semver.org/):

- **Patch** (`1.1.1`) for fixes that do not add user-facing behavior.
- **Minor** (`1.2.0`) for backward-compatible features or meaningful asset changes.
- **Major** (`2.0.0`) for incompatible behavior or stored-data changes requiring migration.

## Single release version

`version.js` is the canonical runtime version. It supplies both the visible version badge and the service-worker cache name. `package.json` must contain the same version; `tests/version.test.js` checks this automatically.

## Release workflow

1. Create a feature or release branch from the latest `main`.
2. Update the version in both `version.js` and `package.json`.
3. Run `npm run check` and `npm test`.
4. Open a pull request targeting `main`.
5. Merge the pull request after checks pass.
6. Create a Git tag and GitHub release named `v<version>`.
7. Verify that GitHub Pages shows the expected version badge.

Do not edit the cache name directly. A version bump creates a new cache automatically, and the service worker removes caches from older releases after activation.
