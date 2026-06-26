// Shared Hono environment. `userId` is populated by the auth middleware from
// a valid session token; it is undefined for anonymous requests.
export type AppEnv = {
  Variables: {
    userId?: string;
  };
};
