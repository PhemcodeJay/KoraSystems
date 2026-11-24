#!/usr/bin/env bash
set -euo pipefail

echo "🛠️  KoraSystems – Development environment setup"

# Ensure corepack is enabled (pnpm shim)
if ! corepack enable 2>/dev/null; then
  echo "⚠️  corepack could not be enabled; ensure pnpm is on PATH."
fi

# Install exact pnpm version (pinned in root package.json)
corepack prepare pnpm@9.15.9 --activate

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Verify workspace packages are linked
echo "� conferencing workspace packages..."
pnpm check:deps

# (Optional) Generate Prisma client if not already done
if [ ! -d "packages/database/node_modules/.prisma/client" ]; then
  echo "⚙️  Generating Prisma client..."
  pnpm --filter @kora/database db:generate
fi

echo "✅ Setup complete. Run \`pnpm dev\` to start the platform."