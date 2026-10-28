#!/usr/bin/env bash
# Rebuilds vendor/koralabs-helios-0.16.8-2.tgz from source and checks it against
# the integrity locked in yarn.lock since 2024-07-09 (commit 964da4d).
#
# 0.16.8-2 was published by hand from koralabs/helios with its deploy.sh
# (jq rename to @koralabs/helios, jq version set, sed the helios.js banner,
# npm publish). That npm package was later deleted. The published tree is
# koralabs/helios commit 13aa1eb ("Adding Kora workarounds", branch 0.16.8);
# npm pack is byte-deterministic, so the same steps reproduce the same archive.
# See docs/helios-0.16.8-2-provenance.md.
set -euo pipefail

VERSION=0.16.8-2
COMMIT=13aa1eb24ba78caee786681c8b1ffe143d43ce86
EXPECTED=sha512-qAKs3PgZye+vjWM9bZVgqVVJgA3CruVeDoFn6xAoH3us7seofSei3N1364bKTsYHTz+hEtMRcYU4GEtceaJs1A==

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

git -C "$work" init -q src
git -C "$work/src" fetch -q --depth 1 https://github.com/koralabs/helios "$COMMIT"
mkdir "$work/deploy"
git -C "$work/src" archive FETCH_HEAD helios.js helios.d.ts helios-internal.d.ts LICENSE README.md package.json | tar x -C "$work/deploy"

cd "$work/deploy"
jq '.name="@koralabs/helios"' package.json > package.tmp && mv package.tmp package.json
jq --arg version "$VERSION" '.version=$version' package.json > package.tmp && mv package.tmp package.json
sed -i -e "s/\(Version: \+\)[0-9]\{1,2\}.[0-9]\{1,2\}.[0-9]\{1,2\}/\1$VERSION/g" ./helios.js
npm pack --ignore-scripts --silent > /dev/null

actual="sha512-$(openssl dgst -sha512 -binary "koralabs-helios-$VERSION.tgz" | base64 -w0)"
if [[ "$actual" != "$EXPECTED" ]]; then
    echo "integrity mismatch: got $actual, expected $EXPECTED" >&2
    exit 1
fi
mkdir -p "$root/vendor"
cp "koralabs-helios-$VERSION.tgz" "$root/vendor/"
echo "vendor/koralabs-helios-$VERSION.tgz $actual"
