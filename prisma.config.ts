import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Railway (y el API en runtime) usan DATABASE_URL. Evita DIRECT_URL fija en la imagen Docker (127.0.0.1) en pre-deploy.
  datasource: {
    url: env("DATABASE_URL")
  }
});
