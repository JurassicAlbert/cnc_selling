/**
 * Seed script — structural baseline only.
 *
 * This seeds the rows the application cannot run without: the machine's real
 * limits (D7, confirmed against the TwoTrees TTC6050 manufacturer spec — see
 * docs/HANDOVER.md §9), one placeholder pricing version (D4 — every rate here
 * is `TODO_PRICING` and must never reach a customer), and the first admin
 * account (there is no self-service path to that role; this is it).
 *
 * What this deliberately does NOT seed: categories, products, materials,
 * finishes, designs, preset sizes, installation variants. That is real
 * catalogue content — Polish copy, product photography (D5), and business
 * decisions about what the shop actually sells — not a technical scaffolding
 * task. It belongs to P2 and needs the owner's input, not invented content.
 *
 * Idempotent by design, not by accident:
 *   - MachineSettings is a true singleton, safe to upsert every run — it is
 *     operational config, meant to be correctable without a deploy.
 *   - PricingSettings is append-only (§10.2): nothing is ever edited in
 *     place. Re-running this script must NOT touch an existing rate set, so
 *     it only creates version 1 if no PricingSettings row exists at all.
 *   - The admin User is upserted by email with role forced to ADMIN. That is
 *     the intended behaviour of a bootstrap script, not a bug: if you demote
 *     this account through the panel later, re-running this file will
 *     re-promote it, so re-run it deliberately, not out of habit.
 */

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: requireEnv('DATABASE_URL') });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  await seedMachineSettings();
  await seedPricingSettings();
  await seedFirstAdmin();
}

/**
 * D7, confirmed 2026-08-23 against the TwoTrees TTC6050 spec sheet
 * ("600 x 500 x 100 mm" working area, stated verbatim). `minModuleMm` is the
 * pre-existing 150mm assumption, kept after the owner's own "10mm" answer
 * turned out to describe material thickness, not the module-split floor.
 * `jointAllowanceMm` and `weeklyCapacityMinutes` have no resolved value yet —
 * left at their schema defaults (0) rather than invented.
 */
async function seedMachineSettings(): Promise<void> {
  const settings = await prisma.machineSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      usableWidthMm: 600,
      usableHeightMm: 500,
      minModuleMm: 150,
      maxWorkpieceThicknessMm: 100,
    },
    update: {
      usableWidthMm: 600,
      usableHeightMm: 500,
      minModuleMm: 150,
      maxWorkpieceThicknessMm: 100,
    },
  });
  console.log(
    `MachineSettings: ${settings.usableWidthMm}x${settings.usableHeightMm}mm usable, ` +
      `${settings.minModuleMm}mm min module, ${settings.maxWorkpieceThicknessMm}mm max thickness`,
  );
}

/**
 * D4, resolved 2026-08-23: seed placeholder numbers, clearly marked, so the
 * pricing pipeline is testable end to end before real rates exist. Every
 * value below is invented and MUST be replaced before any price is shown to
 * a customer — that is what `notePl` says, in the one place a future admin
 * screen would actually display it.
 *
 * Only ever creates version 1, and only if no PricingSettings row exists.
 * Once a real rate set is published, this function becomes a no-op forever —
 * versioning happens through the (future) admin pricing screen, never here.
 */
async function seedPricingSettings(): Promise<void> {
  const existing = await prisma.pricingSettings.findFirst();
  if (existing !== null) {
    console.log(`PricingSettings: version ${existing.version} already exists, leaving it alone`);
    return;
  }

  const created = await prisma.pricingSettings.create({
    data: {
      version: 1,
      // TODO_PRICING — every rate below is an invented placeholder (D4).
      machineRateCncGrosze: 15_000, // 150,00 zł/min-equivalent, invented
      machineRateLaserGrosze: 12_000, // 120,00 zł/min-equivalent, invented
      moduleSurchargeGrosze: 4_000, // 40,00 zł per extra module, invented
      packagingTiers: [
        { maxAreaM2: 0.5, maxModules: 1, priceGrosze: 1_500 },
        { maxAreaM2: 2, maxModules: 4, priceGrosze: 4_500 },
        { maxAreaM2: null, maxModules: null, priceGrosze: 9_000 },
      ],
      vatRateBp: 2_300, // 23% — the one number here that IS real (PL standard rate)
      isActive: true,
      publishedAt: new Date(),
      publishedByEmail: 'seed-script',
      notePl:
        'TODO_PRICING: wartości tymczasowe wpisane przez skrypt seed. ' +
        'Nie pokazywać klientowi przed zastąpieniem realnymi stawkami.',
    },
  });
  console.log(`PricingSettings: created version ${created.version} (TODO_PRICING placeholders)`);
}

/**
 * The first ADMIN. Seeded from the project owner's own email so there is an
 * account to sign in with the moment Auth.js is wired up in P0's remaining
 * Next.js work — there is no other path to this role (§16.3).
 */
async function seedFirstAdmin(): Promise<void> {
  const email = requireEnv('SEED_ADMIN_EMAIL');
  const admin = await prisma.user.upsert({
    where: { email },
    create: { email, role: 'ADMIN', name: 'Admin' },
    update: { role: 'ADMIN' },
  });
  console.log(`User: ${admin.email} is ADMIN`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set — check your .env`);
  }
  return value;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
