import "hono";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    jwtPayload: {
      id: string;
      username: string;
      role: string;
      [key: string]: any;
    };
  }
}
