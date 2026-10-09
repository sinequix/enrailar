# Política de seguridad

## Reportar una vulnerabilidad

No abras un issue público para una vulnerabilidad.

Usá los [avisos privados de seguridad](https://github.com/sinequix/enrailar/security/advisories/new) de GitHub. Si no podés, escribinos a [hola@enrailar.com](mailto:hola@enrailar.com). Incluí qué componentes afecta, cómo reproducirlo y el impacto que ves. No incluyas datos de personas ni secretos en el reporte.

Vamos a confirmar la recepción, evaluar el impacto y coordinar un arreglo antes de hablar del detalle en público.

## Alcance

Entran el código de este repositorio y la configuración de despliegue que vive acá. Quedan afuera servicios de terceros y la infraestructura de cuentas que todavía no está provisionada.

## Versiones

La línea soportada es `main`.

## Secretos

El escaneo de secretos de GitHub y el workflow de gitleaks buscan credenciales en el historial. Si encontrás un secreto commiteado, reportalo por esta vía y asumí que hay que rotarlo: borrarlo del último commit no alcanza.
