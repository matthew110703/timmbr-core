#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dumpCandidates = [
  process.argv[2],
  resolve(process.cwd(), '../infra/backups/timmbr-neon.dump'),
  resolve(process.cwd(), 'infra/backups/timmbr-neon.dump'),
  resolve(process.cwd(), 'backups/timmbr-neon.dump'),
].filter(Boolean);

const dumpPath = dumpCandidates.find((path) => existsSync(path));

if (!dumpPath) {
  console.error('❌ Could not locate timmbr-neon.dump.');
  console.error('Checked locations:');
  dumpCandidates.forEach((loc) => console.error(`  - ${loc}`));
  console.error('\nUsage: node scripts/restore-neon-dump.mjs [path-to-dump]');
  process.exit(1);
}

console.log(`📦 Found database dump: ${dumpPath}`);
console.log('🚀 Restoring into Docker container "timmbr-postgres" (database: timmbr_dev)...');

const pgRestore = spawn(
  'docker',
  [
    'exec',
    '-i',
    'timmbr-postgres',
    'pg_restore',
    '-U',
    'timmbr',
    '-d',
    'timmbr_dev',
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
  ],
  {
    stdio: ['pipe', 'inherit', 'inherit'],
  },
);

const stream = createReadStream(dumpPath);
stream.pipe(pgRestore.stdin);

pgRestore.on('close', (code) => {
  // pg_restore exits with 1 if there were non-fatal warnings (e.g. drop if exists when clean)
  if (code === 0 || code === 1) {
    console.log('✅ PostgreSQL database restored successfully from dump!');
    console.log('🔄 Applying any pending Prisma migrations...');

    const migrate = spawn('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      shell: true,
    });

    migrate.on('close', (migrateCode) => {
      if (migrateCode === 0) {
        console.log('✅ Database schema is fully up-to-date!');
        process.exit(0);
      } else {
        console.error(`❌ Migration failed with code ${migrateCode}`);
        process.exit(migrateCode || 1);
      }
    });
  } else {
    console.error(`❌ pg_restore failed with exit code ${code}`);
    process.exit(code);
  }
});

pgRestore.on('error', (err) => {
  console.error('❌ Error executing docker command:', err.message);
  process.exit(1);
});

