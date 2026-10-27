/**
 * The Prisma config inside the image, in place of the root one. No imports at
 * all: it is loaded by a CLI living outside the app directory, and neither
 * `dotenv` nor `prisma/config` is in the runtime image — Docker supplies the
 * environment.
 *
 * Keep the schema and migration paths in step with `prisma.config.ts`.
 */
const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

export default config;
