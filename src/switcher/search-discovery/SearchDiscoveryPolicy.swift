import Foundation

enum SearchDiscoveryPolicy {
    static let minimumWindows = 8
    static let maximumExposures = 3
    static let cooldown: TimeInterval = 72 * 60 * 60
    static let displayDelay: TimeInterval = 1
    static let navigationQuietPeriod: TimeInterval = 0.5

    struct Context {
        var windowCount = 0
        var enabled = true
        var searchActive = false
        var blockedByOtherUI = false
        var hasShortcut = false

        func isEligible(history: History) -> Bool {
            windowCount >= minimumWindows && enabled
                && !searchActive && !blockedByOtherUI && hasShortcut
                && history.hasSearched == false
        }
    }

    struct History {
        private(set) var hasSearched: Bool?
        private(set) var exposures: Int
        private(set) var lastExposure: Date?

        init(hasSearched: Bool? = nil, exposures: Int = 0, lastExposure: Date? = nil) {
            self.hasSearched = hasSearched
            self.exposures = exposures
            self.lastExposure = lastExposure
        }

        mutating func resolvePreviousSearch(_ used: Bool?) {
            // A late history read must not undo a search made since launch.
            if hasSearched != true { hasSearched = used }
        }

        mutating func recordSearch() { hasSearched = true }

        func canPresent(at now: Date) -> Bool {
            guard exposures >= 0, exposures < maximumExposures else { return false }
            guard let lastExposure else { return exposures == 0 }
            return now.timeIntervalSince(lastExposure) >= cooldown
        }

        mutating func recordExposure(at now: Date) {
            exposures += 1
            lastExposure = now
        }
    }

    final class Opportunity {
        private var scheduled = false
        private var cancelled = false
        var lastNavigationAt: TimeInterval?
        #if DEBUG
        var isPreview = false
        #endif

        var recordsHistory: Bool {
            #if DEBUG
            return !isPreview
            #else
            return true
            #endif
        }

        func isEligible(context: Context, history: History) -> Bool {
            guard recordsHistory else {
                return !context.searchActive && !context.blockedByOtherUI && context.hasShortcut
            }
            return context.isEligible(history: history)
        }

        func schedule() -> Bool {
            guard !scheduled, !cancelled else { return false }
            scheduled = true
            return true
        }

        func cancel() { cancelled = true }

        func isReady(current: Opportunity?, now: TimeInterval) -> Bool {
            guard self === current, scheduled, !cancelled else { return false }
            return lastNavigationAt.map { now - $0 >= navigationQuietPeriod } ?? true
        }
    }

    struct Click {
        private var beganInside = false

        mutating func begin(inside: Bool) -> Bool {
            beganInside = inside
            return inside
        }

        mutating func end(inside: Bool) -> Bool {
            let passToAppKit = beganInside || inside
            beganInside = false
            return passToAppKit
        }
    }

    static func frame(size: CGSize, switcher: CGRect, visibleScreen: CGRect, obstruction: CGRect?) -> CGRect? {
        let safe = visibleScreen.insetBy(dx: 8, dy: 8)
        guard size.width > 0, size.height > 0, size.width <= safe.width, size.height <= safe.height else { return nil }
        let x = min(max(switcher.midX - size.width / 2, safe.minX), safe.maxX - size.width)
        for y in [switcher.maxY + 8, switcher.minY - 8 - size.height] {
            let candidate = CGRect(origin: CGPoint(x: x, y: y), size: size)
            if safe.contains(candidate) && !(obstruction?.intersects(candidate) ?? false) { return candidate }
        }
        return nil
    }
}
