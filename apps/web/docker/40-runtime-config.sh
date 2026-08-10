#!/bin/sh
set -eu

: "${LIBTASTE_API_BASE_URL:?LIBTASTE_API_BASE_URL is required}"
: "${LIBTASTE_WEB_CLIENT_ID:?LIBTASTE_WEB_CLIENT_ID is required}"
LIBTASTE_ENVIRONMENT_LABEL="${LIBTASTE_ENVIRONMENT_LABEL:-}"

case "$LIBTASTE_API_BASE_URL" in
  http://*|https://*) ;;
  *) echo "LIBTASTE_API_BASE_URL must be an absolute HTTP(S) URL." >&2; exit 1 ;;
esac

validate_json_value() {
  value="$1"
  name="$2"
  if ! printf '%s' "$value" | grep -Eq '^[[:alnum:] ._:/?&=%+-]+$'; then
    echo "$name contains unsupported characters." >&2
    exit 1
  fi
}

validate_json_value "$LIBTASTE_API_BASE_URL" LIBTASTE_API_BASE_URL
validate_json_value "$LIBTASTE_WEB_CLIENT_ID" LIBTASTE_WEB_CLIENT_ID
if [ -n "$LIBTASTE_ENVIRONMENT_LABEL" ]; then
  validate_json_value "$LIBTASTE_ENVIRONMENT_LABEL" LIBTASTE_ENVIRONMENT_LABEL
fi

{
  printf '{\n  "apiBaseUrl": "%s",\n  "webClientId": "%s"' "$LIBTASTE_API_BASE_URL" "$LIBTASTE_WEB_CLIENT_ID"
  if [ -n "$LIBTASTE_ENVIRONMENT_LABEL" ]; then
    printf ',\n  "environmentLabel": "%s"' "$LIBTASTE_ENVIRONMENT_LABEL"
  fi
  printf '\n}\n'
} > /usr/share/nginx/html/config.json

api_origin="$(printf '%s' "$LIBTASTE_API_BASE_URL" | sed -E 's#^(https?://[^/]+).*$#\1#')"
cat > /etc/nginx/conf.d/runtime-security.conf <<EOF
add_header Content-Security-Policy "default-src 'none'; base-uri 'self'; connect-src 'self' $api_origin; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data: https:; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'; upgrade-insecure-requests" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Permissions-Policy "camera=(), geolocation=(), microphone=(), payment=(), usb=()" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
EOF
