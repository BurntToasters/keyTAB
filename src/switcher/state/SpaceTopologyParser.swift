import Foundation

enum SpaceTopologyParser {
    struct Display: Equatable {
        let identifier: String
        let spaceIds: [UInt64]
        let currentSpaceId: UInt64
    }

    static func parse(_ raw: [NSDictionary], mainDisplayIdentifier: String?) -> [Display]? {
        guard !raw.isEmpty else { return nil }
        let displays = raw.compactMap { parseDisplay($0, mainDisplayIdentifier) }
        return displays.count == raw.count ? displays : nil
    }

    private static func parseDisplay(_ raw: NSDictionary, _ mainDisplayIdentifier: String?) -> Display? {
        guard let rawIdentifier = raw["Display Identifier"] as? String,
              let rawSpaces = raw["Spaces"] as? [NSDictionary], !rawSpaces.isEmpty,
              let currentSpace = raw["Current Space"] as? NSDictionary,
              let currentSpaceId = currentSpace["id64"] as? UInt64 else { return nil }
        let spaceIds = rawSpaces.compactMap { $0["id64"] as? UInt64 }
        guard spaceIds.count == rawSpaces.count, spaceIds.contains(currentSpaceId) else { return nil }
        let identifier: String
        if rawIdentifier == "Main" {
            guard let mainDisplayIdentifier else { return nil }
            identifier = mainDisplayIdentifier
        } else {
            identifier = rawIdentifier
        }
        return Display(identifier: identifier, spaceIds: spaceIds, currentSpaceId: currentSpaceId)
    }
}
