#!/usr/bin/env bash
#
# Ship the current commit to the production server.
#
#   ./scripts/deploy.sh
#
# Configuration comes from the environment (or `.env.deploy`, which is not
# committed):
#
#   DEPLOY_HOST   user@host of the server            (required)
#   DEPLOY_PATH   checkout directory on the server   (default /srv/cnc-selling)
#   DEPLOY_REF    what to deploy                     (default: current commit)
#   DEPLOY_PORT   ssh port                           (default 22)
#
# THERE IS NO SERVER YET. As of 2026-09-16 the owner has not provisioned one,
# so this script is expected to stop at the first check below. That refusal is
# the honest behaviour and is the point: it tells you exactly what is missing
# instead of reporting a success that did not happen.

set -euo pipefail

if [ -f .env.deploy ]; then
  # shellcheck disable=SC1091
  . ./.env.deploy
fi

DEPLOY_PATH="${DEPLOY_PATH:-/srv/cnc-selling}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_REF="${DEPLOY_REF:-$(git rev-parse HEAD)}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mdeploy: %s\033[0m\n' "$1" >&2; exit 1; }

step "Checking where this is going"
if [ -z "${DEPLOY_HOST:-}" ]; then
  cat >&2 <<'EOF'

deploy: DEPLOY_HOST is not set, so there is nowhere to deploy to.

This is the expected state until a server exists. Nothing has been built,
copied or started, and nothing is half-done.

When you have a server, create `.env.deploy` (gitignored) with:

    DEPLOY_HOST=deploy@your-server-address
    DEPLOY_PATH=/srv/cnc-selling

and make sure the server has been prepared once - `docs/DEPLOYMENT.md`
section 2 lists exactly what "prepared" means: Docker, a checkout, and a
`.env.production` that passes `npm run preflight`.
EOF
  exit 1
fi

# A dirty tree is the classic way to deploy something that exists on no
# branch, cannot be reproduced, and does not match the commit you will later
# blame.
if [ -n "$(git status --porcelain)" ]; then
  fail "the working tree has uncommitted changes. Commit or stash them: what ships must be a commit you can return to."
fi

step "Verifying the server is reachable and prepared"
ssh -p "$DEPLOY_PORT" "$DEPLOY_HOST" "test -d '$DEPLOY_PATH/.git'" \
  || fail "no git checkout at $DEPLOY_PATH on $DEPLOY_HOST. See docs/DEPLOYMENT.md section 2."

ssh -p "$DEPLOY_PORT" "$DEPLOY_HOST" "test -f '$DEPLOY_PATH/.env.production'" \
  || fail "no .env.production at $DEPLOY_PATH. The server has no configuration; docs/DEPLOYMENT.md section 3 lists every value."

step "Checking the server's configuration against the manifest"
# Run the preflight with the server's own file, before building anything.
# Catching a missing secret after a five-minute image build is a waste, and
# catching it after the container has already replaced a working one is worse.
ssh -p "$DEPLOY_PORT" "$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && git fetch --quiet origin && git show origin/main:scripts/deploy-env.mjs > /tmp/deploy-env.mjs 2>/dev/null; node scripts/preflight-env.mjs .env.production" \
  || fail "the server's .env.production is incomplete. Nothing was deployed; fix the values it listed and run this again."

step "Deploying $DEPLOY_REF"
ssh -p "$DEPLOY_PORT" "$DEPLOY_HOST" bash -s <<EOF
set -euo pipefail
cd '$DEPLOY_PATH'

git fetch --quiet origin
git checkout --quiet '$DEPLOY_REF'

# --env-file so compose interpolates from the server's configuration rather
# than from whatever the ssh session happens to have in scope.
docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Migrations run in the container's entrypoint, not here, so they happen with
# exactly the schema the new image was built against.
EOF

step "Waiting for the new container to answer"
# A deploy that "succeeded" and left a site returning 502 is the failure mode
# worth spending thirty seconds to rule out.
for attempt in $(seq 1 15); do
  if ssh -p "$DEPLOY_PORT" "$DEPLOY_HOST" "curl -fsS -o /dev/null http://localhost:3000/api/health" 2>/dev/null; then
    printf '\n\033[32mdeploy: %s is live on %s\033[0m\n' "$(git rev-parse --short "$DEPLOY_REF")" "$DEPLOY_HOST"
    exit 0
  fi
  sleep 2
done

fail "the container did not answer /api/health within 30s. It may still be starting; check: ssh $DEPLOY_HOST 'cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml logs --tail=50 app'"
