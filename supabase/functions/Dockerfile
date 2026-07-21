# Builds one self-contained, pre-cached edge function image for on-prem/USB
# installs. Each function gets its own image so a school server with no
# internet connection at all can still run account-creation, password-reset,
# and messaging functions — the Deno dependency cache is baked in at build
# time (here, "at home", with internet), not fetched at container start
# (on-site, possibly with no internet).
#
# Build one image per function, e.g.:
#   docker build --build-arg FUNCTION_NAME=send-sms \
#     -f supabase/functions/Dockerfile -t shule-fn-send-sms .
#
# scripts/build-for-school.sh loops over every function and does this
# automatically — you shouldn't normally need to run this by hand.

ARG FUNCTION_NAME
FROM supabase/edge-runtime:v1.74.0
ARG FUNCTION_NAME

COPY supabase/functions/${FUNCTION_NAME} /home/deno/functions/${FUNCTION_NAME}

# Pre-fetch every remote import (deno.land, esm.sh, jsr:) this function needs
# while we still have internet. `|| true` so a build never hard-fails here —
# worst case the function falls back to fetching at first run on-site.
RUN deno cache /home/deno/functions/${FUNCTION_NAME}/index.ts || true
