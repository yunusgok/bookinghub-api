# Dependency review

Reviewed against the installed lockfile on 2026-11-21. Versions below are verified installed versions, not a claim that the repository will remain on the latest release indefinitely. `npm ci` reproduces the dependency tree.

| Runtime package  | Version | Declared license |
| ---------------- | ------- | ---------------- |
| Hono             | 4.13.19 | MIT              |
| Drizzle ORM      | 0.45.4  | Apache-2.0       |
| Zod              | 4.6.7   | MIT              |
| @hono/swagger-ui | 0.6.2   | MIT              |

The Worker imports these four runtime packages and project code. Development tooling is excluded from the Worker import graph. The dry-run build was inspected for sharp, lightningcss and Miniflare imports; none were present.

Development dependencies include Wrangler 4.166.0, Cloudflare Vitest plugin 1.9.0, Vitest 4.1.12, TypeScript 6.0.3 and Drizzle Kit 0.31.11. The Cloudflare plugin's declared Vitest peer range includes 4.1. The project's Node baseline is 24; the complete check passed on Node 24.22.3 and initial development checks passed on Node 25.2.0. GitHub Actions uses Node 24 and current release tags `actions/checkout@v7.0.1` and `actions/setup-node@v7.1.0`, verified against their official release pages.

## Security override

Drizzle Kit's stable package still depends on deprecated esbuild-kit loaders. Their original esbuild version was affected by GHSA-67mh-4wv8-2f99 (development server origin handling). A narrowly scoped npm override changes `@esbuild-kit/core-utils`'s esbuild to `^0.28.2`. A fresh install, `npm ci`, schema generation and the complete check pass with this override. `npm audit` reports zero known vulnerabilities across the final lockfile. This is a point-in-time advisory check, not proof of absence of vulnerabilities.

Remove or revisit the override when upstream replaces the old loader. Do not use `npm audit fix --force` to downgrade Drizzle Kit to incompatible versions. Retained upstream deprecation notices are documented rather than hidden.

## License inventory

The lockfile contains MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0, MIT OR Apache-2.0, MPL-2.0 and LGPL-containing expressions. MPL entries belong to development-only lightningcss packages. LGPL-containing entries belong to development-only sharp/libvips optional platform packages pulled by the Cloudflare tooling. These are not copied into the Worker bundle or vendored in this source repository. The project source is MIT; dependency packages retain their own licenses and notices.

## Recheck

```sh
npm ci
npm audit
npm ls --depth=0
npm run db:generate
npm run check
```

The full license expressions and package sources are recorded in `package-lock.json` and the corresponding installed package metadata. No dependency license or advisory result is represented as a certification.
