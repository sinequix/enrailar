import { DOMAIN } from "./stage.ts";

type EmailRule = { emailDomain: string } | { email: string };
type TokenRule = { serviceToken: string };

export type AccessPolicy =
  | { decision: "allow"; include: EmailRule[] }
  | { decision: "non_identity"; include: TokenRule[] };

function splitList(value: string): string[] {
  const items: string[] = [];
  for (const part of value.split(",")) {
    const item = part.trim();
    if (item.length > 0) items.push(item);
  }
  return items;
}

/**
 * Dominio del proyecto, correos de `ACCESS_ALLOWED_EMAILS`, y service tokens
 * de `ACCESS_SERVICE_TOKEN_IDS`. Un token solo entra en una política Service
 * Auth (`non_identity`): Access no lo admite dentro de la política `allow`.
 * La lista vacía no agrega esa política, así un stage sin el entorno no la borra
 * por incluir una regla vacía, y un redeploy con los ids la vuelve a declarar.
 */
export function accessPolicies(extraEmails: string, serviceTokenIds: string): AccessPolicy[] {
  const include: EmailRule[] = [{ emailDomain: DOMAIN }];
  for (const email of splitList(extraEmails)) include.push({ email });
  const policies: AccessPolicy[] = [{ decision: "allow", include }];
  const tokens = splitList(serviceTokenIds).map((id) => ({ serviceToken: id }));
  if (tokens.length > 0) policies.push({ decision: "non_identity", include: tokens });
  return policies;
}
