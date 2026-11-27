#!/usr/bin/env node
// What the family's search finds of this site, written into dist/ after the
// build: dist/search.json. abap2UI5/docs fetches it at build time into the one
// search index the home page (https://abap2ui5.github.io/) and the playground
// read, as the group "Why abap2UI5". The shape is the one every site of the
// family publishes: { site, url, entries: [{ title, text, headings, terms, url }] }.
//
// Read from the BUILT pages, not from the .astro files: the text of this site
// is data inside its pages, and the HTML is the one place where it is all
// written out. One entry per section with an id (the ids are addresses, see
// AGENTS.md, so a hit lands on the section), and one per question of the FAQ.
// Nothing here may fail the build quietly: a page that yields no entry is an
// error, because it means the markup changed under this reader.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.join(import.meta.dirname, "..", "dist");
const ROOT = "https://abap2ui5.github.io/docs-manager/";

/* The entities the built HTML carries, `&amp;` LAST: decoded first, it turned
 * `&amp;lt;` - the text "&lt;" - into "<". Numeric ones (`&#39;`, `&#x2014;`)
 * are whatever character they name; a number that names none stays as it is. */
const NAMED = { lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const codePoint = (n, whole) => (Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole);
export const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (whole, n) => codePoint(Number(n), whole))
    .replace(/&#x([0-9a-f]+);/gi, (whole, h) => codePoint(parseInt(h, 16), whole))
    .replace(/&(lt|gt|quot|apos|nbsp);/g, (_, name) => NAMED[name])
    .replace(/&amp;/g, "&");
// A tag is a space (a word ends at </td>), but not before punctuation:
// `<a>Who runs it</a>, and` is "Who runs it, and", not "Who runs it , and".
export const text = (html) =>
  decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/ ([.,;:!?)])/g, "$1").trim();
const sentence = (s, max = 220) => {
  const first = s.match(/^.{20,}?[.!?](\s|$)/)?.[0].trim() ?? s;
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
};
const words = (s) =>
  [...new Set(s.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length >= 4 && !/^\d+$/.test(w)))].join(" ");

function sections(file, url) {
  const html = fs.readFileSync(path.join(DIST, file), "utf8");
  const out = [];
  for (const m of html.matchAll(/<section\b[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
    const [, id, body] = m;
    const h2 = body.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
    if (!h2) continue;
    /* the first paragraph that is a sentence: the short line above a heading
     * (the kicker, "What it costs") is a label, not what the section says */
    const p = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((x) => text(x[1])).find((t) => t.length >= 40);
    const headings = [...body.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map((h) => text(h[1])).filter(Boolean);
    out.push({
      title: text(h2[1]),
      text: p ? sentence(p) : "",
      /* the h3 of a section have no id of their own, and the entry's url
       * already carries the section's: a heading here would send a reader to
       * `#id#id` in a box that appends its anchor. Their words are matched. */
      headings: [],
      terms: words(`${headings.join(" ")} ${text(body)}`),
      url: `${url}#${id}`,
    });
  }
  if (!out.length) throw new Error(`search-feed: no section with an id and a heading in ${file}`);
  return out;
}

/* One entry per question, sent to the question itself: every <details> of
 * the FAQ carries an id (the slug of its question, src/pages/faq.astro), and
 * a question without one is an error - a hit on it would land at the top of
 * the page, which is what every FAQ hit did before. */
export function questions(html, url, file = "the page") {
  const out = [];
  for (const m of html.matchAll(/<details\b([^>]*)>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)) {
    const id = m[1].match(/\sid="([^"]+)"/)?.[1];
    const title = text(m[2]);
    if (!id) throw new Error(`search-feed: the question "${title}" in ${file} has no id to link to`);
    const answer = text(m[3]);
    out.push({ title, text: sentence(answer), headings: [], terms: words(answer), url: `${url}#${id}` });
  }
  if (!out.length) throw new Error(`search-feed: no question in ${file}`);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = [
    ...sections("index.html", ROOT),
    ...questions(fs.readFileSync(path.join(DIST, "faq", "index.html"), "utf8"), `${ROOT}faq/`, "faq/index.html"),
    ...sections("community/index.html", `${ROOT}community/`),
  ];
  fs.writeFileSync(path.join(DIST, "search.json"), JSON.stringify({ site: "Why abap2UI5", url: ROOT, entries }));
  console.log(`search-feed: ${entries.length} entries -> dist/search.json`);
}
