import { assertEquals } from "@std/assert";
import { asStringList, formatPublished, portableTextParagraphs, publicHttpUrl, withBase } from "../src/lib/paths.ts";

Deno.test("el camino público respeta el base de Astro", () => {
  assertEquals(withBase("/"), "/");
  assertEquals(withBase("/", "ypf"), "/ypf");
  assertEquals(withBase("/noticias/"), "/noticias");
  assertEquals(withBase("/noticias/", "ypf"), "/noticias/ypf");
});

Deno.test("la cita solo enlaza https", () => {
  assertEquals(publicHttpUrl("https://www.rionegro.com.ar/energia/"), "https://www.rionegro.com.ar/energia/");
  assertEquals(publicHttpUrl("http://www.rionegro.com.ar/energia/"), undefined);
  assertEquals(publicHttpUrl("javascript:alert(1)"), undefined);
  assertEquals(publicHttpUrl("nota"), undefined);
  assertEquals(publicHttpUrl(""), undefined);
});

Deno.test("el cuerpo portable text sale como párrafos", () => {
  assertEquals(portableTextParagraphs([
    { children: [{ text: "Primera frase." }, { text: " Sigue." }] },
    { children: [{ text: "   " }] },
    { children: [{ text: "Segunda." }] },
  ]), ["Primera frase. Sigue.", "Segunda."]);
  assertEquals(asStringList(["Urquiza", 1, "Mitre"]), ["Urquiza", "Mitre"]);
  assertEquals(formatPublished("2026-10-17T03:30:00.000Z").includes("2026"), true);
});
