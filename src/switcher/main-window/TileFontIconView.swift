import Cocoa

enum Symbols: String {
    case circledPlusSign = "plus.circle"
    case circledMinusSign = "minus.circle"
    case circledSlashSign = "circle.slash"
    case circledNumber0 = "0.circle"
    case circledNumber10 = "10.circle"
    case circledStar = "star.circle"
    case filledCircledStar = "star.circle.fill"
    case circledInfo = "info.circle"
    case paintpalette
    case command
    case gearshape
    case handRaised = "hand.raised"
    case link
    case arrowTriangleBranch = "arrow.triangle.branch"
    case accessibility
    case display
    case ladybug
    case lightbulb
    case plus
    case minus
    case minusCircleFill = "minus.circle.fill"
    case cursorarrowRays = "cursorarrow.rays"
    case pauseRectangle = "pause.rectangle"
    case magnifyingglass
    case moonphaseWaningGibbousInverse = "moonphase.waning.gibbous.inverse"
    case moonphaseLastQuarterInverse = "moonphase.last.quarter.inverse"
    case moonphaseWaningCrescentInverse = "moonphase.waning.crescent.inverse"
    case sparkles
    case sunMax = "sun.max"
    case moonFill = "moon.fill"
    case laptopcomputer
}

class TileFontIconView: NSView {
    enum Rendering {
        case symbol
        case badge
    }

    struct SymbolCacheKey: Hashable {
        var symbol: String
        var size: CGFloat
        var colorKey: String
    }

    private struct BadgeSizing {
        static let containerFromIconRatio = CGFloat(0.43)
        static let textFromContainerRatio = CGFloat(0.57)
        static let minContainerHeight = CGFloat(11)
        static let minTextHeight = CGFloat(8)
        static let maxTextHeight = CGFloat(18)
        static let horizontalPaddingRatio = CGFloat(0.10)
        static let minHorizontalPadding = CGFloat(2)
        static let appIconsMinRectWidthRatio = CGFloat(1.35)
        static let maxDigits = 4
    }

    private struct BadgeMetrics {
        let containerHeight: CGFloat
        let textHeight: CGFloat
    }

    static var symbolCache = [SymbolCacheKey: NSImage]()

    static func badgeBaseSize(forIconSize iconSize: CGFloat) -> CGFloat {
        max((iconSize * BadgeSizing.containerFromIconRatio).rounded(), BadgeSizing.minContainerHeight)
    }

    private let rendering: Rendering
    private let symbolSize: CGFloat
    private let symbolColor: NSColor
    private let badgeFillColor: NSColor
    private let badgeTextColor: NSColor
    private let badgeFont: NSFont
    private let badgeContainerHeight: CGFloat
    private let badgeHorizontalPadding: CGFloat
    private var text = ""
    private var cachedSymbolImage: NSImage?
    private var cachedBadgeAttributedString: NSAttributedString?
    private var cachedBadgeTextSize = NSSize.zero

    convenience init(symbol: Symbols, tooltip: String? = nil, size: CGFloat = Appearance.fontHeight, color: NSColor = Appearance.fontColor) {
        self.init(rendering: .symbol, initialText: symbol.rawValue, size: size, symbolColor: color, badgeFillColor: .clear, badgeTextColor: .clear)
        toolTip = tooltip
        frame.size = symbolSizeForCurrentText()
    }

    convenience init(badgeSize: CGFloat,
                     fillColor: NSColor = NSColor(srgbRed: 1, green: 0.25, blue: 0.2, alpha: 0.9),
                     textColor: NSColor = .white) {
        self.init(rendering: .badge, initialText: "0", size: badgeSize, symbolColor: .clear, badgeFillColor: fillColor, badgeTextColor: textColor)
        frame.size = badgeFrameSize(textWidth: maxBadgeTextWidth(), text: String(repeating: "8", count: BadgeSizing.maxDigits))
    }

    init(rendering: Rendering,
         initialText: String,
         size: CGFloat,
         symbolColor: NSColor,
         badgeFillColor: NSColor,
         badgeTextColor: NSColor) {
        self.rendering = rendering
        self.symbolSize = size
        self.symbolColor = symbolColor
        self.badgeFillColor = badgeFillColor
        self.badgeTextColor = badgeTextColor
        let badgeMetrics = Self.badgeMetrics(size)
        badgeContainerHeight = badgeMetrics.containerHeight
        badgeHorizontalPadding = Self.badgeHorizontalPadding(badgeMetrics.containerHeight)
        badgeFont = NSFont.systemFont(ofSize: badgeMetrics.textHeight)
        text = initialText
        super.init(frame: .zero)
        cachedSymbolImage = rendering == .symbol ? cachedSymbol(named: initialText) : nil
        if rendering == .badge {
            cachedBadgeAttributedString = badgeAttributedText(initialText)
            cachedBadgeTextSize = cachedBadgeAttributedString!.size()
        }
    }

    required init?(coder: NSCoder) {
        fatalError("Class only supports programmatic initialization")
    }

    override var isOpaque: Bool { false }
    override var intrinsicContentSize: NSSize { frame.size }

    static func warmCaches(symbols: [Symbols], extraStrings: [String] = [], size: CGFloat, color: NSColor) {
        let colorKey = symbolColorKey(color)
        for symbol in symbols.map({ $0.rawValue }) + extraStrings {
            let key = SymbolCacheKey(symbol: symbol, size: size, colorKey: colorKey)
            guard symbolCache[key] == nil else { continue }
            symbolCache[key] = makeSymbolImage(named: symbol, size: size, color: color)
        }
    }

    func setText(_ text: String) {
        guard text.count <= 4 && rendering == .badge else { setFilledStar(); return }
        replaceTextIfNeeded(text)
    }

    func setStar() {
        setStarLike(false)
    }

    func setFilledStar() {
        setStarLike(true)
    }

    override func draw(_ dirtyRect: NSRect) {
        rendering == .badge ? drawBadge() : drawSymbol()
    }

    private func setStarLike(_ filled: Bool) {
        let star = rendering == .badge ? "" : (filled ? Symbols.filledCircledStar.rawValue : Symbols.circledStar.rawValue)
        replaceTextIfNeeded(star)
    }

    private func replaceTextIfNeeded(_ newText: String) {
        guard newText != text else { return }
        text = newText
        if rendering == .symbol {
            cachedSymbolImage = cachedSymbol(named: newText)
            frame.size = symbolSizeForCurrentText()
            invalidateIntrinsicContentSize()
        } else {
            cachedBadgeAttributedString = badgeAttributedText(newText)
            cachedBadgeTextSize = cachedBadgeAttributedString!.size()
        }
        needsDisplay = true
    }

    private func drawSymbol() {
        guard let cachedSymbolImage else { return }
        cachedSymbolImage.draw(at: .zero, from: .zero, operation: .sourceOver, fraction: 1)
    }

    private func drawBadge() {
        let badgeRect = anchoredBadgeRect()
        let innerPath = NSBezierPath(roundedRect: badgeRect, xRadius: badgeRect.height / 2, yRadius: badgeRect.height / 2)
        badgeFillColor.setFill()
        innerPath.fill()
        guard let cachedBadgeAttributedString else { return }
        let textSize = cachedBadgeTextSize
        cachedBadgeAttributedString.draw(at: NSPoint(x: badgeRect.midX - textSize.width / 2, y: badgeRect.midY - textSize.height / 2))
    }

    private func anchoredBadgeRect() -> NSRect {
        let size = badgeFrameSize(textWidth: cachedBadgeTextSize.width, text: text)
        return NSRect(x: (frame.width - size.width).rounded(), y: 0, width: size.width, height: size.height)
    }

    private func symbolSizeForCurrentText() -> NSSize {
        cachedSymbolImage?.size ?? .zero
    }

    private func badgeFrameSize(textWidth: CGFloat, text: String) -> NSSize {
        let height = badgeContainerHeight
        var width = max(height, textWidth + badgeHorizontalPadding * 2)
        if Preferences.effectiveAppearanceStyle(SwitcherSession.activeShortcutIndex) == .appIcons, text.count > 1 {
            width = max(width, (height * BadgeSizing.appIconsMinRectWidthRatio).rounded(.up))
        }
        return NSSize(width: ceil(width), height: ceil(height))
    }

    private func badgeAttributedText(_ value: String) -> NSAttributedString {
        NSAttributedString(string: value, attributes: [.font: badgeFont, .foregroundColor: badgeTextColor])
    }

    private func badgeTextWidth(_ value: String) -> CGFloat {
        NSAttributedString(string: value, attributes: [.font: badgeFont]).size().width
    }

    private static func badgeHorizontalPadding(_ height: CGFloat) -> CGFloat {
        max(BadgeSizing.minHorizontalPadding, (height * BadgeSizing.horizontalPaddingRatio).rounded())
    }

    private func maxBadgeTextWidth() -> CGFloat {
        badgeTextWidth(String(repeating: "8", count: BadgeSizing.maxDigits))
    }

    private static func badgeMetrics(_ size: CGFloat) -> BadgeMetrics {
        let rawContainerHeight = max(BadgeSizing.minContainerHeight, size.rounded())
        let textHeight = badgeTextHeight(fromRawContainerHeight: rawContainerHeight)
        let compactContainerHeight = (textHeight / BadgeSizing.textFromContainerRatio).rounded(.up)
        return BadgeMetrics(containerHeight: max(BadgeSizing.minContainerHeight, min(rawContainerHeight, compactContainerHeight)), textHeight: textHeight)
    }

    private static func badgeTextHeight(fromRawContainerHeight rawContainerHeight: CGFloat) -> CGFloat {
        min(max((rawContainerHeight * BadgeSizing.textFromContainerRatio).rounded(), BadgeSizing.minTextHeight), BadgeSizing.maxTextHeight)
    }

    private func cachedSymbol(named value: String) -> NSImage {
        let key = SymbolCacheKey(symbol: value, size: symbolSize, colorKey: Self.symbolColorKey(symbolColor))
        if let cached = Self.symbolCache[key] { return cached }
        let cached = Self.makeSymbolImage(named: value, size: symbolSize, color: symbolColor)
        Self.symbolCache[key] = cached
        return cached
    }

    static func makeSymbolImage(named name: String, size: CGFloat, color: NSColor) -> NSImage {
        let base = NSImage(systemSymbolName: name, accessibilityDescription: nil) ?? NSImage(systemSymbolName: "questionmark.circle", accessibilityDescription: nil)!
        let configuration = NSImage.SymbolConfiguration(pointSize: (size * 0.85).rounded(), weight: .regular)
        return (base.withSymbolConfiguration(configuration) ?? base).tinted(color)
    }

    static func symbolColorKey(_ color: NSColor) -> String {
        (color.usingColorSpace(.deviceRGB) ?? color).description
    }
}
