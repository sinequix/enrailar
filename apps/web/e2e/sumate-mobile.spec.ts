import { expect, test, type Page } from "@playwright/test";

const memoryKey = "enrailar:sumate:v1";

async function tokenValue(page: Page): Promise<string> {
  const input = page.locator('input[name="cf-turnstile-response"]');
  if (await input.count() === 0) return "";
  return input.inputValue();
}

test("el widget carga en la primera visita desde un iPhone", async ({ page }) => {
  await page.goto("/es#sumate");
  await expect.poll(() => tokenValue(page)).not.toBe("");
});

test("al reabrir la ficha guardada, Turnstile vuelve a montarse", async ({ page }) => {
  await page.goto("/es#sumate");
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      at: new Date().toISOString(),
      intents: ["hackatrain"],
      newsletter: false,
    }));
  }, memoryKey);
  await page.reload();
  await expect(page.locator("form.sumate-form")).toBeHidden();
  await page.waitForFunction(() => typeof (window as { turnstile?: unknown }).turnstile === "object");
  await page.getByRole("button", { name: "Enviar otro mensaje" }).click();
  await expect(page.locator("form.sumate-form")).toBeVisible();
  await expect.poll(() => tokenValue(page)).not.toBe("");
});
