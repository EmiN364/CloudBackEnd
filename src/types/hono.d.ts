import type { JWTPayload } from "jose";

declare module "hono" {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}
