// Prisma 7 reads the datasource URL from here, not from schema.prisma, and no
// longer loads .env automatically — hence the explicit dotenv import.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // `seed` is deliberately absent: there is no seed script yet, and pointing
    // at a file that does not exist would fail confusingly. It arrives in P2,
    // together with the catalogue data it inserts.
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
