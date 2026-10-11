-- Método con el que se abrió la sesión. No reescribe filas anteriores: queda NULL.
ALTER TABLE "session" ADD COLUMN "authMethod" TEXT;
