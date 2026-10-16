import { expect, test, type Page, type Route } from "@playwright/test";

const memoryKey = "enrailar:sumate:v1";

async function tokenValue(page: Page): Promise<string> {
  const input = page.locator('input[name="cf-turnstile-response"]');
  if (await input.count() === 0) return "";
  return input.inputValue();
}

async function fillVolunteer(page: Page, locale: "es" | "en"): Promise<void> {
  const copy = locale === "es"
    ? {
      intent: "Colaborar",
      name: "Ana Pérez",
      city: "Tandil",
      region: "Buenos Aires",
      profile: "Ingeniería",
      howHelp: "Puedo relevar vías y documentar el estado.",
      consent: "#sumate-consent",
    }
    : {
      intent: "Collaborate",
      name: "Ana Perez",
      city: "Tandil",
      region: "Buenos Aires",
      profile: "Engineering",
      howHelp: "I can survey track and write down what is there.",
      consent: "#sumate-consent",
    };
  await page.locator("form.sumate-form").getByText(copy.intent, { exact: true }).click();
  await page.locator("#sumate-name").fill(copy.name);
  await page.locator("#sumate-email").fill("ana@example.com");
  await page.locator("#sumate-city").fill(copy.city);
  await page.locator("#sumate-region").fill(copy.region);
  await page.locator("#sumate-profile").selectOption({ label: copy.profile });
  await page.locator("#sumate-howHelp").fill(copy.howHelp);
  await page.locator(copy.consent).click();
  await expect.poll(() => tokenValue(page)).not.toBe("");
}

function fulfill(route: Route, status: number): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: status === 202 ? "{}" : JSON.stringify({ error: "unavailable" }),
  });
}

test("el formulario en español guarda la ficha aunque ClickUp no se llame desde el navegador", async ({ page }) => {
  let body = "";
  await page.route("**/v1/sumate", async (route) => {
    body = route.request().postData() ?? "";
    await fulfill(route, 202);
  });
  await page.goto("/es#sumate");
  await page.evaluate((key) => localStorage.removeItem(key), memoryKey);
  await fillVolunteer(page, "es");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("heading", { name: "Ya te anotaste. Pronto nos vamos a contactar." })).toBeVisible();
  await expect(page.locator("form.sumate-form")).toBeHidden();
  const sent = JSON.parse(body) as Record<string, unknown>;
  expect(sent.email).toBe("ana@example.com");
  expect(sent.profile).toBe("ingenieria");
  expect(sent.howHelp).toBe("Puedo relevar vías y documentar el estado.");
  expect(sent.city).toBe("Tandil");
  expect(sent.region).toBe("Buenos Aires");
  expect(sent.name).toBe("Ana Pérez");
});

test("si la API rechaza la ficha, el formulario muestra el error y sigue visible", async ({ page }) => {
  await page.route("**/v1/sumate", (route) => fulfill(route, 500));
  await page.goto("/es#sumate");
  await page.evaluate((key) => localStorage.removeItem(key), memoryKey);
  await fillVolunteer(page, "es");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".status--error")).toHaveText("No se pudo enviar. Revisá los campos.");
  await expect(page.locator("form.sumate-form")).toBeVisible();
});

test("el formulario en inglés muestra perfil, región y cómo ayudar", async ({ page }) => {
  await page.goto("/en#sumate");
  await page.evaluate((key) => localStorage.removeItem(key), memoryKey);
  await page.reload();
  await expect(page.locator("form.sumate-form")).toBeVisible();
  await expect(page.getByText("Region or country", { exact: true })).toBeVisible();
  await expect(page.getByText("How do you want to help", { exact: true })).toBeVisible();
  await expect(page.locator("#sumate-profile")).toBeVisible();
  await expect(page.locator("#sumate-profile option", { hasText: "Engineering" })).toHaveCount(1);
});
