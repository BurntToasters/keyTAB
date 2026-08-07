import ServiceManagement

enum LoginItem {
    static func applyCurrentPreference() {
        do {
            if Preferences.startAtLogin { try enable() } else { try disable() }
        } catch {
            Logger.error { "Failed to update login item. error:\(error)" }
        }
    }

    private static func enable() throws {
        guard SMAppService.mainApp.status != .enabled else { return }
        try SMAppService.mainApp.register()
    }

    private static func disable() throws {
        guard SMAppService.mainApp.status != .notRegistered else { return }
        try SMAppService.mainApp.unregister()
    }
}
