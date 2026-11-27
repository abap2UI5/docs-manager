// The reader behind dist/search.json (scripts/search-feed.mjs): what it makes
// of the HTML it is given. No build needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, text, questions } from "../scripts/search-feed.mjs";

test("entities: &amp; last, numeric ones by their number", () => {
  assert.equal(decode("Community &amp; Support"), "Community & Support");
  // decoded first, &amp; turned the text "&lt;" into "<"
  assert.equal(decode("write &amp;lt;br&amp;gt;"), "write &lt;br&gt;");
  assert.equal(decode("it&#39;s &#x27;one&#x27; &#8212; &#x2014;"), "it's 'one' — —");
  assert.equal(decode("&lt;b&gt; &quot;x&quot; &apos;y&apos;"), "<b> \"x\" 'y'");
  assert.equal(decode("&#0; &#x110000; &#99999999;"), "&#0; &#x110000; &#99999999;", "a number that names no character stays");
  assert.equal(text("<p>A&nbsp;<a>link</a>, and &#169; 2026</p>"), "A link, and © 2026");
});

test("a question is sent to its own id, and one without an id is an error", () => {
  const html = '<details id="is-it-free" open><summary>Is it free?</summary><p>Yes, MIT.</p></details>'
    + '<details id="who-runs-it-2"><summary>Who runs it?</summary><p>Two companies say so.</p></details>';
  const out = questions(html, "https://abap2ui5.github.io/docs-manager/faq/");
  assert.deepEqual(out.map((e) => e.url), [
    "https://abap2ui5.github.io/docs-manager/faq/#is-it-free",
    "https://abap2ui5.github.io/docs-manager/faq/#who-runs-it-2",
  ]);
  assert.equal(out[0].title, "Is it free?");
  assert.throws(() => questions("<details><summary>Q?</summary><p>A.</p></details>", "x/"), /has no id/);
  assert.throws(() => questions("<p>none</p>", "x/"), /no question/);
});
