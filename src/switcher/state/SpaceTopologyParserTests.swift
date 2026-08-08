import XCTest

final class SpaceTopologyParserTests: XCTestCase {
    func testParsesDisplaysAndResolvesMainIdentifier() {
        let raw = [display("Main", spaces: [4, 7], current: 7), display("external", spaces: [9], current: 9)]
        XCTAssertEqual(SpaceTopologyParser.parse(raw, mainDisplayIdentifier: "internal"), [
            .init(identifier: "internal", spaceIds: [4, 7], currentSpaceId: 7),
            .init(identifier: "external", spaceIds: [9], currentSpaceId: 9),
        ])
    }

    func testRejectsEmptyOrPartiallyMalformedSnapshots() {
        XCTAssertNil(SpaceTopologyParser.parse([], mainDisplayIdentifier: nil))
        let malformed = NSDictionary(dictionary: ["Display Identifier": "Main", "Spaces": [], "Current Space": ["id64": UInt64(1)]])
        XCTAssertNil(SpaceTopologyParser.parse([display("external", spaces: [9], current: 9), malformed], mainDisplayIdentifier: nil))
        XCTAssertNil(SpaceTopologyParser.parse([display("Main", spaces: [1], current: 1)], mainDisplayIdentifier: nil))
        XCTAssertNil(SpaceTopologyParser.parse([display("external", spaces: [1], current: 2)], mainDisplayIdentifier: nil))
    }

    private func display(_ identifier: String, spaces: [UInt64], current: UInt64) -> NSDictionary {
        NSDictionary(dictionary: [
            "Display Identifier": identifier,
            "Spaces": spaces.map { ["id64": $0] },
            "Current Space": ["id64": current],
        ])
    }
}
