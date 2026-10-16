import * as Config from "effect/Config";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

/**
 * El token de ClickUp es el único secreto del Worker para el CRM.
 * Si no está, el deploy sigue: la ficha se guarda y queda para reintento.
 */
export function optionalSecret(name: string) {
  return Config.String(name).pipe(
    Config.option,
    Config.map((value) => Redacted.make(Option.isSome(value) ? value.value.trim() : "")),
  );
}
