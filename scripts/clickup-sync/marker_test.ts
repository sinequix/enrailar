import { assertEquals, assertThrows } from "@std/assert";
import { clickupMarker, parseClickupTaskId } from "./marker.ts";

Deno.test("el marcador se escribe y se lee", () => {
  const marker = clickupMarker("86e3nbvhz");
  assertEquals(marker, "<!-- clickup:86e3nbvhz -->");
  assertEquals(parseClickupTaskId(`texto\n\n${marker}\n`), "86e3nbvhz");
});

Deno.test("el parseo acepta espacios adentro del comentario", () => {
  assertEquals(parseClickupTaskId("<!--clickup:abc-->"), "abc");
  assertEquals(parseClickupTaskId("<!--  clickup:abc_1  -->"), "abc_1");
});

Deno.test("un comentario mal formado no es marcador", () => {
  assertEquals(parseClickupTaskId("clickup:abc"), null);
  assertEquals(parseClickupTaskId("<!-- clickup: -->"), null);
  assertEquals(parseClickupTaskId("<!-- clickup:a b -->"), null);
  assertEquals(parseClickupTaskId(""), null);
});

Deno.test("si hay dos marcadores gana el primero", () => {
  const body = `${clickupMarker("uno")}\n${clickupMarker("dos")}`;
  assertEquals(parseClickupTaskId(body), "uno");
});

Deno.test("un id vacío no genera marcador", () => {
  assertThrows(() => clickupMarker("a b"));
  assertThrows(() => clickupMarker(""));
});
