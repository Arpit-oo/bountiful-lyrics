import { describe, expect, it } from "vitest";
import { assignSingers, parseEmbed, parseSections, parseSingers, singerSides, skeleton } from "../src/lyrics/genius";
import { sanitizeSettings } from "../src/settings";
import { planChat } from "../src/styles/chat";

// Made-up lyrics, shaped like a Genius page.
const TEXT = `[Intro: Ana]
hello from the other room

[Verse 1: Ben]
I walk the line alone at night
counting every passing light

[Chorus: Ana & Ben]
we were young and we were free
you and me beneath the tree

[Verse 2: Ana]
paper planes across the bay
folding all our fears away

[Chorus: Ana & Ben]
we were young and we were free
you and me beneath the tree

[Bridge]
just the band now`;

describe("Genius parsing", () => {
  it("splits credits into unique names", () => {
    expect(parseSingers("Mike Shinoda, Mike Shinoda & Chester Bennington")).toEqual(["Mike Shinoda", "Chester Bennington"]);
    expect(parseSingers("Jay-Z (uncredited) and Beyoncé")).toEqual(["Jay-Z", "Beyoncé"]);
  });

  it("reads sections and their singers", () => {
    const s = parseSections(TEXT);
    expect(s.map((x) => x.singers)).toEqual([["Ana"], ["Ben"], ["Ana", "Ben"], ["Ana"], ["Ana", "Ben"], null]);
    expect(s[1]!.lines).toEqual(["I walk the line alone at night", "counting every passing light"]);
  });

  it("pulls lyrics out of an embed script, skipping header and footer", () => {
    const markup = `<div class="rg_embed_header"><a>Powered by Genius</a></div><div class="rg_embed_body"><p>[Verse: Ana]<br>it&#39;s a <a href="#">test</a> line<br><br>[Hook: Ben]<br>second &amp; last</p></div><div class="rg_embed_footer"><div class="song_title">Song</div> Artist</div>`;
    const js = `if (x) {\n  document.write('<link>')\n  document.write(JSON.parse('${JSON.stringify(markup).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'))\n}`;
    const sections = parseEmbed(js.replace("document.write('<link>')", "document.write('rg_embed')"));
    expect(sections).toEqual([
      { singers: ["Ana"], lines: ["it's a test line"] },
      { singers: ["Ben"], lines: ["second & last"] },
    ]);
  });
});

describe("matching singers to timed lines", () => {
  const sections = parseSections(TEXT);
  const timed = [
    "Hello from the other room",
    "I walk the line alone at night",
    "Counting every passing light",
    "We were young and we were free",
    "You and me beneath the tree",
    "Paper planes across the bay",
    "Folding all our fears away",
    "", // instrumental
    "We were young and we were free",
    "You and me beneath the tree",
  ].map((text) => ({ text }));

  it("follows the song in order and keeps unknown lines with the last singer", () => {
    const singers = assignSingers(timed, sections, "Main");
    expect(singers).toEqual([["Ana"], ["Ben"], ["Ben"], ["Ana", "Ben"], ["Ana", "Ben"], ["Ana"], ["Ana"], null, ["Ana", "Ben"], ["Ana", "Ben"]]);
  });

  it("gives each main voice a side, first singer on the left", () => {
    const sides = singerSides(assignSingers(timed, sections, "Main"))!;
    expect(sides.side).toEqual([0, 1, 1, 0, 0, 0, 0, null, 0, 0]);
    expect(sides.name[3]).toBe("Ana & Ben");
  });

  it("leaves solo songs alone", () => {
    expect(singerSides([["Solo"], ["Solo"], null, ["Solo"]])).toBeNull();
  });

  it("plans the chat by singer and only names a sender when it changes", () => {
    const lines = timed.map((l, i) => ({ ...l, startMs: i * 3000, endMs: i * 3000 + 2500 }));
    const voices = singerSides(assignSingers(timed, sections, "Main"))!;
    const plan = planChat(lines, 4, voices);
    expect(plan.map((s) => s?.side ?? null)).toEqual([0, 1, 1, 0, 0, 0, 0, null, 0, 0]);
    expect(plan[0]!.name).toBe("Ana");
    expect(plan[1]!.name).toBe("Ben");
    expect(plan[2]!.name).toBeNull();
    expect(plan[3]!.name).toBe("Ana & Ben");
    expect(plan[5]!.name).toBe("Ana");
    expect(plan[6]!.name).toBeNull();
  });
});

describe("Genius token setting", () => {
  it("keeps clean tokens and drops anything else", () => {
    expect(sanitizeSettings({}).geniusToken).toBe("");
    expect(sanitizeSettings({ geniusToken: "  abc_DEF-123  " }).geniusToken).toBe("abc_DEF-123");
    expect(sanitizeSettings({ geniusToken: "bad token<script>" }).geniusToken).toBe("");
    expect(sanitizeSettings({}).chatSingers).toBe(true);
  });
});

describe("name labels", () => {
  it("shows a name once per stretch of the same singer, however long", () => {
    const lines = Array.from({ length: 8 }, (_, i) => ({ text: `line ${i}`, startMs: i * 3000, endMs: i * 3000 + 2500 }));
    const voices = { side: [1, 1, 1, 1, 1, 0, 0, 0] as Array<0 | 1 | null>, name: ["Mike", "Mike", "Mike", "Mike", "Mike", "Chester", "Chester", "Chester"] };
    const plan = planChat(lines, 2, voices);
    expect(plan.map((s) => s!.name)).toEqual(["Mike", null, null, null, null, "Chester", null, null]);
  });
});

describe("matching across scripts", () => {
  it("gives romanized and Indic-script lines the same sound skeleton", () => {
    expect(skeleton("ਤੇਰੇ ਨਖ਼ਰੇ ਜਵਾਨੀ ਵਾਲ਼ੇ")).toBe(skeleton("Tere nakhre jawani wale"));
    expect(skeleton("दिल तो पागल है")).toBe(skeleton("Dil toh pagal hai"));
  });

  it("matches romanized Genius lyrics to Gurmukhi timed lyrics", () => {
    const sections = parseSections(`[Verse 1: Ana]
Tere nakhre jawani wale
Kariye vi das hun ki kariye

[Verse 2: Ben]
Dil toh pagal hai
Saade dohaan vichkaar teri chupp`);
    const timed = ["ਤੇਰੇ ਨਖ਼ਰੇ ਜਵਾਨੀ ਵਾਲ਼ੇ", "ਕਰੀਏ ਵੀ ਦੱਸ ਹੁਣ ਕੀ ਕਰੀਏ", "ਦਿਲ ਤੋ ਪਾਗਲ ਹੈ", "ਸਾਡੇ ਦੋਹਾਂ ਵਿਚਕਾਰ ਤੇਰੀ ਚੁੱਪ"].map((text) => ({ text }));
    expect(assignSingers(timed, sections, "Main")).toEqual([["Ana"], ["Ana"], ["Ben"], ["Ben"]]);
  });

  it("falls back to line position for scripts it can't compare", () => {
    const sections = parseSections(`[Verse: Ana]
uno
dos

[Verse: Ben]
tres
cuatro`);
    const timed = ["사랑해", "보고 싶어", "어디야", "잘 자"].map((text) => ({ text }));
    expect(assignSingers(timed, sections, "Main")).toEqual([["Ana"], ["Ana"], ["Ben"], ["Ben"]]);
  });
});

describe("group credits", () => {
  it("reads [Chorus: Both] as the two main voices", () => {
    const sections = parseSections(`[Verse 1: Ana]
one two three four
[Verse 2: Ben]
five six seven eight
[Chorus: Both]
nine ten eleven twelve`);
    const timed = ["one two three four", "five six seven eight", "nine ten eleven twelve"].map((text) => ({ text }));
    expect(assignSingers(timed, sections, "Main")).toEqual([["Ana"], ["Ben"], ["Ana", "Ben"]]);
  });
});
