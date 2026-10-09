export function httpServerHandler(_options: { port: number }): { fetch(request: Request): Promise<Response> } {
  return {
    fetch() {
      return Promise.reject(new Error("cloudflare:node solo existe dentro del Worker"));
    },
  };
}
