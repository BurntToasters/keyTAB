import Foundation

enum PreferencesMigrations {
    static func removeCorruptedPreferences() {}

    static func migratePreferences() {
        guard UserDefaults.standard.string(forKey: "preferencesVersion") == nil else { return }
        UserDefaults.standard.set(App.version, forKey: "preferencesVersion")
    }
}
