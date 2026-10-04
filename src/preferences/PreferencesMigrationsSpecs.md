# PreferencesMigrations — Specs

## Summary

`PreferencesMigrations` stamps `preferencesVersion` with the running KeyTab version the first time KeyTab
launches against an empty preferences domain. It runs once per launch (`migratePreferences()`).

## Behavior & edge cases

- KeyTab preferences live only in the `run.rosie.keytab` domain. KeyTab never reads, imports or migrates
  AltTab's (`com.lwouis.alt-tab-macos`) defaults, so the upstream AltTab schema migrations are not carried.
- A stored `preferencesVersion` is left untouched; there are no KeyTab schema migrations yet.
- `removeCorruptedPreferences()` is a no-op hook kept for the launch sequence.

## Adding a migration

When a KeyTab release changes a stored key or value format, add a version-gated transform here that reads
only KeyTab keys, then add `PreferencesMigrationsTests.swift` pinning each transform's exact input → output
before shipping it. These transforms run against every user's stored settings, and a mistake has no UI signal.
