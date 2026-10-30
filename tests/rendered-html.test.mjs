import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

const assets = {
  fetch: async () => new Response("Not found", { status: 404 }),
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

async function render(pathname = "/", accept = "text/html", protocol = "https", host = "localhost") {
  // A unique query string forces a fresh module instance per request.
  workerUrl.searchParams.set(
    "test",
    `${process.pid}-${Date.now()}-${Math.random()}`,
  );
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`${protocol}://${host}${pathname}`, {
      headers: { accept },
    }),
    { ASSETS: assets },
    executionContext,
  );
}

test("renders the dashboard as the home page", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Dashboard · KC°<\/title>/);
  assert.match(html, /Personal command center/);
  assert.match(html, /Watch archive/);
  assert.match(html, /Pi-hole/);
  assert.match(html, /Every app, one list\./);
  assert.match(html, /Search apps (&amp;|&) notes/);
  assert.match(html, /Wishlist<\/span><strong>12<\/strong>/);
  assert.match(html, /Owned<\/span><strong>05<\/strong>/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("redirects plaintext requests to HTTPS", async () => {
  const response = await render("/", "text/html", "http", "example.com");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://example.com/");
});

test("keeps the watch and notes archive at /archive", async () => {
  const response = await render("/archive");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Watches &amp; Notes · KC°<\/title>/);
  assert.match(html, /Watches, with stories\./);
  assert.match(html, /From the notebook\./);
  assert.match(html, /Swatch Irony Automatic Body &amp; Soul/);
  assert.match(html, /Orient Classic\/Contemporary Day-Date/);
  assert.match(html, /Seiko Prospex Alpinist/);
  assert.match(html, /IWC Portugieser Perpetual Calendar/);
  assert.match(html, /Citizen Promaster Altichron/);
  assert.match(html, /Glycine Airman Vintage The Chief GMT 40/);
  assert.match(html, /Next purchase/);
  assert.match(html, /\/watches\/glycine-airman-vintage-the-chief-gmt-40\.webp/);
  assert.match(html, /Full specification/);
  assert.match(html, /The order I/);
  assert.match(html, /Audemars Piguet Code 11\.59 Starwheel/);
  assert.match(html, /Ultimate goal/);
  assert.equal((html.match(/class="watch-card"/g) ?? []).length, 19);
  assert.equal((html.match(/class="watch-photo"/g) ?? []).length, 19);
  assert.match(html, /href="\/"/);
});

test("reports an unconfigured Pi-hole without failing", async () => {
  const keys = [
    "PIHOLE_URL",
    "PIHOLE_ADMIN_URL",
    "PIHOLE_PASSWORD",
    "PIHOLE_API_TOKEN",
    "PIHOLE_VERSION",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) delete process.env[key];

  try {
    const response = await render("/api/pihole", "application/json");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { configured: false });
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
