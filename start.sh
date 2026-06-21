#!/bin/sh
set -e

# Run Prisma schema push to initialize/sync SQLite DB in the volume mount
npx prisma db push --skip-generate

# Seed the database (runs ts-node prisma/seed.ts)
npx prisma db seed

# Start the Next.js server
exec npm run start
