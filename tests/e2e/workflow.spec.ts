import { expect, test, type Page } from "@playwright/test";

/**
 * The proposal's Figure 1 workflow, end to end, using the Albums category
 * (Deezer needs no API key). Requires network access to api.deezer.com.
 */
const run = Date.now().toString(36);
const alice = { username: `alice_${run}`, email: `alice_${run}@example.test`, password: "tiermade-e2e-pass" };
const bob = { username: `bob_${run}`, email: `bob_${run}@example.test`, password: "tiermade-e2e-pass" };

async function signUp(page: Page, u: typeof alice) {
  await page.goto("/signup");
  await page.getByLabel("Username").fill(u.username);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function createList(page: Page, title: string, format: "Ranked list" | "Tier list") {
  await page.getByRole("link", { name: "New list" }).first().click();
  await page.getByRole("button", { name: "Albums" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: new RegExp(format) }).click();
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
}

async function addAlbum(page: Page, query: string) {
  const search = page.getByRole("searchbox", { name: "Search Albums" });
  await search.fill(query);
  const first = page.getByRole("list", { name: "Search results" }).getByRole("button").first();
  await expect(first).toBeEnabled();
  await first.click();
  await expect(first).toBeDisabled(); // now "already on your list"
}

test("create, rank, befriend, share and compare", async ({ browser }) => {
  // Alice builds a ranked list
  const a = await (await browser.newContext()).newPage();
  await signUp(a, alice);
  await createList(a, "Alice's albums", "Ranked list");
  // New lists open in grid view; this flow uses the list view's drag handles.
  await a.getByRole("button", { name: "List", exact: true }).click();
  for (const q of ["in rainbows radiohead", "discovery daft punk", "blonde frank ocean"]) await addAlbum(a, q);
  // Ranked lists also render empty slots; count only the rows holding an item.
  const rows = a
    .getByRole("list", { name: "Ranked items" })
    .getByRole("listitem")
    .filter({ has: a.getByRole("button", { name: /Drag to reorder/ }) });
  await expect(rows).toHaveCount(3);

  // Reorder with the keyboard: move #3 onto slot #1 (the others shift down), then confirm it persisted
  const lastHandle = a.getByRole("button", { name: /Drag to reorder Blonde/ });
  await lastHandle.focus();
  await a.keyboard.press("Space");
  await a.keyboard.press("ArrowUp");
  await a.keyboard.press("ArrowUp");
  await a.keyboard.press("Space");
  await a.waitForResponse((r) => r.url().includes("/order") && r.ok());
  await a.reload();
  await expect(rows.first()).toContainText("Blonde");
  const aliceListUrl = a.url();

  // Bob builds a tier list and sends Alice a request
  const b = await (await browser.newContext()).newPage();
  await signUp(b, bob);
  await createList(b, "Bob's tiers", "Tier list");
  for (const q of ["in rainbows radiohead", "abbey road beatles"]) await addAlbum(b, q);
  await b.goto("/friends");
  await b.getByLabel("Username").fill(alice.username);
  await b.getByRole("button", { name: "Send" }).click();
  await expect(b.getByText("Sent requests")).toBeVisible();

  // Alice accepts and opens the comparison from her own list
  await a.goto("/friends");
  await a.getByRole("button", { name: "Accept" }).click();
  await expect(a.getByText(`@${bob.username}`)).toBeVisible();
  await a.goto(aliceListUrl);
  await a.getByRole("button", { name: "Compare" }).click();
  await a.getByRole("link", { name: /Bob's tiers/ }).click();
  await expect(a).toHaveURL(/\/compare\?a=.+&b=.+/);
  await expect(a.getByText(/\d+%/).first()).toBeVisible();
  await expect(a.getByText("In common")).toBeVisible();
});
