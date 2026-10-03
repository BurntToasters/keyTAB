import Cocoa

class AboutTab {
    static func initTab() -> NSView {
        makeContentView()
    }

    static func makeContentView(_ fitToContent: Bool = true, _ centerHero: Bool = false) -> NSView {
        let appIcon = LightImageView()
        appIcon.translatesAutoresizingMaskIntoConstraints = false
        let appIconSize = NSSize(width: 128, height: 128)
        appIcon.updateContents(.cgImage(App.appIcon(for: appIconSize)), appIconSize)
        appIcon.fit(128, 128)
        let appText = StackView([
            BoldLabel(App.name),
            NSTextField(wrappingLabelWithString: NSLocalizedString("Version", comment: "") + " \(App.version) (\(App.build))"),
            NSTextField(wrappingLabelWithString: App.licence),
            NSTextField(wrappingLabelWithString: "KeyTab is a modified fork of AltTab v11.8.0 by Louis Pontoise and contributors; KeyTab modifications began August 2026 from AltTab v11.4.4; not affiliated with or endorsed by the upstream project."),
            HyperlinkLabel(NSLocalizedString("Source code", comment: ""), App.repository),
        ], .vertical)
        appText.spacing = GridView.interPadding / 2
        let rowToSeparate = 4
        appText.views[rowToSeparate].topAnchor.constraint(equalTo: appText.views[rowToSeparate - 1].bottomAnchor, constant: GridView.interPadding).isActive = true
        let appInfo = NSStackView(views: [appIcon, appText])
        appIcon.translatesAutoresizingMaskIntoConstraints = false
        appInfo.spacing = GridView.interPadding
        appInfo.alignment = .centerY
        let repositoryButton = makeRepositoryButton()
        let rows = [[appInfo], [repositoryButton]]
        let grid = GridView(rows, 0)
        if centerHero {
            grid.cell(atColumnIndex: 0, rowIndex: 0).xPlacement = .center
        }
        let repositoryCell = grid.cell(atColumnIndex: 0, rowIndex: 1)
        repositoryCell.xPlacement = .center
        if fitToContent {
            grid.fit()
        }
        return grid
    }

    static func makeRepositoryButton() -> NSButton {
        let button = makeButtonWithIcon(NSLocalizedString("KeyTab on GitHub", comment: ""), App.repositoryAction, "link", nil, App.self)
        styleRepositoryButton(button)
        return button
    }

    private static func styleRepositoryButton(_ button: NSButton) {
        button.bezelStyle = .rounded
        button.translatesAutoresizingMaskIntoConstraints = false
    }

    private static func makeButtonWithIcon(_ title: String, _ selector: Selector, _ symbolName: String?, _ color: NSColor? = nil, _ target: AnyObject? = nil) -> NSButton {
        let button = NSButton(title: title, target: target, action: selector)
        if #available(macOS 26.0, *), let symbolName {
            button.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil)
            button.imagePosition = .imageLeading
            if let color {
                button.image = button.image?.withSymbolConfiguration(.init(paletteColors: [color]))
            }
        }
        return button
    }
}

class AboutWindow: NSPanel {
    private static let contentPadding = CGFloat(24)
    static var shared: AboutWindow?
    private var usageTextView: NSTextView!

    override var canBecomeKey: Bool { SecondaryWindows.canBecomeKey }

    convenience init() {
        self.init(contentRect: NSRect(x: 0, y: 0, width: 380, height: 450), styleMask: [.titled, .closable, .fullSizeContentView], backing: .buffered, defer: false)
        setupWindow()
        setupView()
        setFrameAutosaveNameSafely("AboutWindow2")
        Self.shared = self
    }

    override func makeKeyAndOrderFront(_ sender: Any?) {
        updateUsageStats()
        super.makeKeyAndOrderFront(sender)
    }

    private func setupWindow() {
        applySecondaryWindowChrome(String(format: NSLocalizedString("About %@", comment: ""), App.name))
    }

    private func setupView() {
        let scrollView = NSScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.scrollerStyle = .overlay
        let documentView = FlippedView(frame: .zero)
        documentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = documentView
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 30
        stack.translatesAutoresizingMaskIntoConstraints = false
        let aboutView = AboutTab.makeContentView(false, true)
        let columnWidth = frame.width - 2 * Self.contentPadding
        usageTextView = NSTextView.makeReadOnlyMarkdownView(columnWidth)
        let acknowledgmentsView = AcknowledgmentsTab.makeContentView(columnWidth: columnWidth, shouldFit: false, verticallyStacked: true)
        acknowledgmentsView.translatesAutoresizingMaskIntoConstraints = false
        stack.addArrangedSubview(aboutView)
        stack.addArrangedSubview(usageTextView)
        stack.addArrangedSubview(acknowledgmentsView)
        stack.setCustomSpacing(15, after: usageTextView)
        documentView.addSubview(stack)
        contentView = scrollView
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: documentView.topAnchor, constant: Self.contentPadding),
            stack.leadingAnchor.constraint(equalTo: documentView.leadingAnchor, constant: Self.contentPadding),
            stack.trailingAnchor.constraint(equalTo: documentView.trailingAnchor, constant: -Self.contentPadding),
            stack.bottomAnchor.constraint(equalTo: documentView.bottomAnchor, constant: -Self.contentPadding),
            documentView.widthAnchor.constraint(equalTo: scrollView.contentView.widthAnchor),
            aboutView.leadingAnchor.constraint(equalTo: stack.leadingAnchor),
            aboutView.trailingAnchor.constraint(equalTo: stack.trailingAnchor),
            usageTextView.leadingAnchor.constraint(equalTo: stack.leadingAnchor),
            usageTextView.trailingAnchor.constraint(equalTo: stack.trailingAnchor),
            acknowledgmentsView.leadingAnchor.constraint(equalTo: stack.leadingAnchor),
            acknowledgmentsView.trailingAnchor.constraint(equalTo: stack.trailingAnchor),
        ])
    }

    private func updateUsageStats() {
        let now = Date()
        let weekCount = UsageStats.count("triggers", since: now.addingTimeInterval(-7 * 24 * 3600))
        let monthCount = UsageStats.count("triggers", since: now.addingTimeInterval(-30 * 24 * 3600))
        let yearCount = UsageStats.count("triggers", since: now.addingTimeInterval(-365 * 24 * 3600))
        let markdown = "## \(NSLocalizedString("Usage", comment: ""))\n\nYou have used KeyTab:\n\u{2022} **\(weekCount)** times in the past week\n\u{2022} **\(monthCount)** times in the past month\n\u{2022} **\(yearCount)** times in the past year"
        usageTextView.textStorage!.setAttributedString(Markdown.toAttributedString(markdown))
        usageTextView.layoutManager!.ensureLayout(for: usageTextView.textContainer!)
        let usedRect = usageTextView.layoutManager!.usedRect(for: usageTextView.textContainer!)
        usageTextView.invalidateIntrinsicContentSize()
        usageTextView.fit(usedRect.width, usedRect.height)
    }

    override func close() {
        hideAppIfLastWindowIsClosed()
        super.close()
    }
}
