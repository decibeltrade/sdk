/**
 * Rewrites `dist` into specifiers Node's ESM resolver accepts: explicit `.js`
 * on relative imports, and an import attribute on JSON.
 *
 * `tsc` emits specifiers verbatim, and the source deliberately keeps them
 * extensionless — the web app maps `@decibeltrade/sdk` to `src/index.ts`
 * (apps/web/tsconfig.json) and Turbopack resolves those without TypeScript's
 * `.js`-to-`.ts` substitution, so adding extensions at the source would break
 * that build. Fixing the emitted output instead leaves every source consumer
 * alone. `src/esm-output.test.ts` is the guard that this ran.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(PACKAGE_ROOT, "dist");
const BUILD_INFO = resolve(PACKAGE_ROOT, "tsconfig.tsbuildinfo");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(js|d\.ts)$/.test(name) ? [full] : [];
  });
}

const exists = (p) => {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
};

const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.?\/[^"']*)\2/g;
// A bare JSON specifier: Node throws ERR_IMPORT_ATTRIBUTE_MISSING without one.
const JSON_IMPORT = /(\bfrom\s*)(["'])(\.\.?\/[^"']*\.json)\2(?!\s*with)/g;

// `incremental` is on, so deleting dist without its tsbuildinfo leaves tsc
// believing the output is current: it skips emit and exits 0. Dropping the
// stale file only unblocks the NEXT run, so recovering this one means building
// again afterwards.
if (!exists(DIST)) {
  if (!exists(BUILD_INFO)) {
    console.error("fix-esm-dist: no dist/ and no stale tsbuildinfo to clear.");
    process.exit(1);
  }
  console.log("fix-esm-dist: no dist/ — clearing stale tsbuildinfo and rebuilding");
  rmSync(BUILD_INFO);
  execFileSync(resolve(PACKAGE_ROOT, "node_modules/.bin/tsc"), {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
  });
  if (!exists(DIST)) {
    console.error("fix-esm-dist: rebuild still produced no dist/.");
    process.exit(1);
  }
}

let specifiers = 0;
let attributes = 0;
const unresolved = [];

for (const file of walk(DIST)) {
  const original = readFileSync(file, "utf8");
  let text = original.replace(RELATIVE, (match, head, quote, spec) => {
    if (/\.(js|json|css)$/.test(spec)) return match;
    const base = resolve(dirname(file), spec);
    let suffix;
    if (exists(`${base}.js`) || exists(`${base}.d.ts`)) suffix = ".js";
    else if (exists(resolve(base, "index.js")) || exists(resolve(base, "index.d.ts")))
      suffix = "/index.js";
    else {
      unresolved.push(`${file.replace(`${DIST}/`, "")}: ${spec}`);
      return match;
    }
    specifiers++;
    return `${head}${quote}${spec}${suffix}${quote}`;
  });

  if (file.endsWith(".js")) {
    text = text.replace(JSON_IMPORT, (_match, head, quote, spec) => {
      attributes++;
      return `${head}${quote}${spec}${quote} with { type: "json" }`;
    });
  }

  if (text !== original) writeFileSync(file, text);
}

if (unresolved.length) {
  console.error(`fix-esm-dist: ${unresolved.length} specifier(s) did not resolve:`);
  for (const u of unresolved) console.error(`  ${u}`);
  process.exit(1);
}

console.log(`fix-esm-dist: ${specifiers} specifiers, ${attributes} JSON attributes`);
