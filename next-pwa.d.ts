declare module "next-pwa" {
  import type { NextConfig } from "next";
  function withPWA(options: Record<string, unknown>): (config: NextConfig) => NextConfig;
  export default withPWA;
}
