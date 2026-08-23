#!/usr/bin/env bash

set -exu

fileDirectory="resources/l10n"
stringsFile="$fileDirectory/Localizable.strings"

rm -f "$stringsFile"
# generate fresh Localizable.strings
find src -name '*.swift' -print0 | xargs -0 genstrings -a -o "$fileDirectory"
# convert to utf8
iconv -f UTF-16LE -t UTF-8 "$stringsFile" > "$stringsFile.tmp"
mv "$stringsFile.tmp" "$stringsFile"
file "$stringsFile"
# remove the BOM if there is one to be deterministic; iconv may add a BOM or not, depending on the platform
sed $'1s/\xef\xbb\xbf//' < "$stringsFile" > "$stringsFile.tmp"
mv "$stringsFile.tmp" "$stringsFile"
file "$stringsFile"
