#!/usr/bin/env node
/**
 * Fail the build if the static output is too thin.
 * Prevents READY deploys with ~0 pages from stealing production aliases.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const MIN_HTML_PAGES = 40;
const DIST = path.resolve('dist');

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`assert-min-pages: missing dist at ${DIST}`);
    process.exit(1);
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const pages = await walk(DIST);
if (pages.length < MIN_HTML_PAGES) {
  console.error(
    `assert-min-pages: FAIL — found ${pages.length} HTML pages in dist/ (need >= ${MIN_HTML_PAGES}). Refusing thin build.`
  );
  process.exit(1);
}
console.log(`assert-min-pages: OK — ${pages.length} HTML pages (>= ${MIN_HTML_PAGES}).`);
