#if DEBUG
import Cocoa

final class QAMenu: NSPanel {
    static var shared: QAMenu?
    private static let openSettingsOnLaunchKey = "debug.openSettingsOnLaunch"
    private static let graphEnabledKey = "debug.graphEnabled"
    private let stack = NSStackView()

    static var openSettingsOnLaunch: Bool { UserDefaults.standard.bool(forKey: openSettingsOnLaunchKey) }
    /// Not shown in a lifecycle session, nor with `--qa-no-menu`: automated runs drive the real desktop with
    /// synthetic clicks, and this panel floats over every app on every Space, where the clicks can land on it
    /// instead.
    static var suppressed: Bool { QaLifecycle.enabled || CommandLine.arguments.contains("--qa-no-menu") }
    static var graphEnabled: Bool { UserDefaults.standard.bool(forKey: graphEnabledKey) }

    static func toggleVisibility() {
        guard let panel = shared else { return }
        panel.isVisible ? panel.orderOut(nil) : panel.orderFront(nil)
    }

    init() {
        super.init(contentRect: NSRect(x: 0, y: 0, width: 220, height: 0), styleMask: [.titled, .closable, .miniaturizable, .utilityWindow], backing: .buffered, defer: false)
        level = .floating
        title = "QA Menu"
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        setupContent()
        if !setFrameAutosaveNameSafely("QAMenu") { center() }
    }

    private func setupContent() {
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        stack.addArrangedSubview(topRow())
        stack.addArrangedSubview(graphCheckbox())
        stack.addArrangedSubview(languageDropdown())
        stack.addArrangedSubview(corruptionRow())
        stack.addArrangedSubview(makeButton("Show search hint next session") { SearchDiscoveryHint.shared.showForQA() })
        let container = NSView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: container.leadingAnchor), stack.trailingAnchor.constraint(equalTo: container.trailingAnchor), stack.topAnchor.constraint(equalTo: container.topAnchor), stack.bottomAnchor.constraint(equalTo: container.bottomAnchor)])
        contentView = container
        var size = stack.fittingSize
        size.width += stack.edgeInsets.right
        setContentSize(size)
    }

    private func topRow() -> NSStackView {
        let settings = makeButton("Settings…") { App.showSettingsWindow() }
        let openOnLaunch = NSButton(checkboxWithTitle: "Open on launch", target: nil, action: nil)
        openOnLaunch.state = Self.openSettingsOnLaunch ? .on : .off
        openOnLaunch.onAction = { sender in UserDefaults.standard.set((sender as! NSButton).state == .on, forKey: Self.openSettingsOnLaunchKey) }
        let quit = makeButton("Quit") { App.shared.terminate(nil) }
        let row = NSStackView(views: [settings, openOnLaunch, quit])
        row.orientation = .horizontal
        row.spacing = 8
        return row
    }

    private func graphCheckbox() -> NSButton {
        let checkbox = NSButton(checkboxWithTitle: "Live queue graph", target: nil, action: nil)
        checkbox.state = Self.graphEnabled ? .on : .off
        checkbox.onAction = { sender in
            let enabled = (sender as! NSButton).state == .on
            UserDefaults.standard.set(enabled, forKey: Self.graphEnabledKey)
            DebugMenu.setEnabled(enabled)
        }
        return checkbox
    }

    private func languageDropdown() -> NSPopUpButton {
        let dropdown = NSPopUpButton()
        dropdown.addItems(withTitles: LanguagePreference.allCases.map { $0.localizedString })
        dropdown.selectItem(at: CachedUserDefaults.intFromMacroPref("language", LanguagePreference.allCases))
        dropdown.onAction = { sender in
            let index = (sender as! NSPopUpButton).indexOfSelectedItem
            UserDefaults.standard.set(String(index), forKey: "language")
            CachedUserDefaults.removeFromCache("language")
            if Preferences.language == .systemDefault { UserDefaults.standard.removeObject(forKey: "AppleLanguages") } else { UserDefaults.standard.set([Preferences.language.appleLanguageCode!], forKey: "AppleLanguages") }
            App.restart()
        }
        return dropdown
    }

    private func corruptionRow() -> NSStackView {
        let label = NSTextField(labelWithString: "Settings persistence dialog:")
        label.font = .systemFont(ofSize: 11, weight: .semibold)
        let row = NSStackView(views: [label, makeButton("Symlink") { PreferencesPersistenceCheck.debugShowDialog(symlinked: true) }, makeButton("Unwritable") { PreferencesPersistenceCheck.debugShowDialog(symlinked: false) }])
        row.orientation = .horizontal
        row.spacing = 4
        return row
    }

    private func makeButton(_ title: String, action: @escaping () -> Void) -> NSButton {
        let button = NSButton(title: title, target: nil, action: nil)
        button.controlSize = .small
        button.font = .systemFont(ofSize: 10)
        button.onAction = { _ in action() }
        return button
    }
}
#endif
