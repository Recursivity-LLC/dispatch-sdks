# Releasing the Dispatch SDKs

The SDKs publish to the canonical registry for each language. Users install them the normal
way — no download page, no vendoring:

| Package            | Registry  | Install                          |
| ------------------ | --------- | -------------------------------- |
| `@dispatchitapp/core`   | npm       | `npm i @dispatchitapp/core`           |
| `@dispatchitapp/node`   | npm       | `npm i @dispatchitapp/node`           |
| `@dispatchitapp/browser`| npm       | `npm i @dispatchitapp/browser`        |
| `@dispatchitapp/express`| npm       | `npm i @dispatchitapp/express`        |
| `@dispatchitapp/fastify`| npm       | `npm i @dispatchitapp/fastify`        |
| `dispatchitapp`     | PyPI      | `pip install dispatchitapp`       |

(The Ruby gem `dispatch-rails` lives in the product repo and publishes to RubyGems separately.)

Releases run from GitHub Actions — never `npm publish` / `twine upload` from a laptop. Two
workflows:

- [`.github/workflows/release-js.yml`](.github/workflows/release-js.yml) — all five npm packages.
- [`.github/workflows/release-python.yml`](.github/workflows/release-python.yml) — `dispatchitapp`.

---

## One-time setup

### npm

1. The org is **`dispatchitapp`** (the `@dispatchitapp` scope every package uses), already
   created on npmjs.com. Naming history: `dispatch` was denied (npm blocks it — collides with
   the existing unscoped `dispatch` package) and `dispatchit` was already taken, so the scope
   is `@dispatchitapp` (it still maps to the dispatchit.app brand).
2. Create a **granular access token** (Account → Access Tokens → Generate → Granular):
   read+write to the `@dispatchitapp` scope, no expiry or a long one.
3. Add it to the repo as the **`NPM_TOKEN`** secret (Settings → Secrets and variables →
   Actions).
4. Provenance (the green "built on GitHub Actions" badge) needs nothing extra — the workflow
   already sets `id-token: write` and `NPM_CONFIG_PROVENANCE=true`.

### PyPI (Trusted Publishing — no token)

1. On PyPI, add a **pending publisher** before the first release (Account → Publishing →
   Add a pending publisher):
   - PyPI project name: `dispatchitapp`
   - Owner / repo: `Recursivity-LLC/dispatch-sdks`
   - Workflow filename: `release-python.yml`
   - Environment name: `pypi`
2. After the first successful publish the project exists and the pending publisher becomes a
   regular trusted publisher — nothing more to do.

### GitHub Environments

Create two environments (Settings → Environments) — they can be empty, but adding required
reviewers turns publishing into a one-click approval gate:

- `release` — used by `release-js.yml`
- `pypi` — used by `release-python.yml`

---

## Cutting a release

Versions are read straight from the manifests, so **bump first, then trigger**. Keep the
runtime SDK-identity constants in lockstep with the package version — they ride the wire in
the `X-Dispatch-Sdk` header:

- JS: `packages/<pkg>/package.json` **and** `packages/<pkg>/src/version.ts`
  (plus `packages/browser/src/widget/ticket.ts` `WIDGET_VERSION`).
- Python: `python/dispatchitapp/pyproject.toml` **and**
  `python/dispatchitapp/src/dispatchitapp/version.py` `SDK_VERSION`.

Then either:

- **Tag** — push `js-vX.Y.Z` or `py-vX.Y.Z`, or
- **Manual** — Actions tab → the workflow → "Run workflow".

The workflow builds, runs the test suite as a gate, then publishes. The npm job publishes in
dependency order and rewrites `workspace:*` to the concrete version range automatically.

### Prereleases

Stable versions go to the default channel (`latest` / no `--pre`). For a prerelease
(`1.1.0-rc.1` / `1.1.0rc1`), add an explicit npm dist-tag so it does **not** become `latest`:
in `release-js.yml`'s publish step, append `--tag next`. PyPI marks prereleases automatically
(pip skips them unless `--pre` is passed).
