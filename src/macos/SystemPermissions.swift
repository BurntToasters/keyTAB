import Cocoa
import ScreenCaptureKit.SCShareableContent

// macOS has some privacy restrictions. The user needs to grant certain permissions, app by app, in System Preferences > Security & Privacy
class SystemPermissions {
    static var preStartupPermissionsPassed = false
    private static var timer: DispatchSourceTimer!
    private static var timerIsFrequent = false
    // After permissions are granted at startup, we listen for `com.apple.accessibility.api`
    // on the distributed notification center to learn about revocation, instead of polling
    // every 5s. The notification name is undocumented by Apple and its firing behaviour across
    // every System Settings action (toggle off, remove from list, etc.) is not reliably
    // characterised in public sources, so we also keep a sparse 60s backstop timer below.
    // Infra requirements: NSDistributedNotificationCenter since 10.15 ignores nil-name
    // observers (we pass a name) and since macOS 15 silently fails for unsigned binaries
    // (KeyTab is Developer ID signed). macOS 13+ has a known bug where `AXIsProcessTrusted`
    // can return stale values right after a toggle; we call `AccessibilityPermission.update()`
    // which re-runs the API rather than caching.
    private static let axRevokeNotificationName = "com.apple.accessibility.api"
    private static var distributedObserver: NSObjectProtocol?

    static func ensurePermissionsAreGranted() {
        timer = DispatchSource.makeTimerSource(queue: BackgroundWork.permissionsCheckOnTimerQueue.strongUnderlyingQueue)
        timer.setEventHandler(handler: checkPermissionsOnTimer)
        setImmediateTimer()
        timer.resume()
    }

    private static func startListeningForDistributedRevoke() {
        guard distributedObserver == nil else { return }
        distributedObserver = DistributedNotificationCenter.default().addObserver(
            forName: Notification.Name(axRevokeNotificationName),
            object: nil,
            queue: nil
        ) { _ in
            BackgroundWork.permissionsCheckOnTimerQueue.addOperation {
                if AccessibilityPermission.update() == .notGranted {
                    Logger.error { "Accessibility permission revoked (distributed notification); restarting" }
                    DispatchQueue.main.async { App.restart() }
                }
            }
        }
    }

    private static func checkPermissionsOnTimer() {
        AccessibilityPermission.update()
        let isPermissionsWindowVisible = PermissionsWindow.shared?.isVisible ?? false
        if !preStartupPermissionsPassed || isPermissionsWindowVisible {
            ScreenRecordingPermission.update()
        }
        Logger.debug { "accessibility:\(AccessibilityPermission.status) screenRecording:\(ScreenRecordingPermission.status)" }
        if !preStartupPermissionsPassed {
            checkPermissionsPreStartup()
        } else {
            checkPermissionsPostStartup()
            if isPermissionsWindowVisible && !timerIsFrequent {
                setFrequentTimer()
            } else if !isPermissionsWindowVisible && timerIsFrequent {
                setInfrequentTimer()
            }
        }
        DispatchQueue.main.async {
            Menubar.refreshPermissionCallout()
            if PermissionsWindow.shared != nil {
                PermissionsWindow.updatePermissionViews()
            }
        }
    }

    private static func checkPermissionsPreStartup() {
        if AccessibilityPermission.status != .notGranted && ScreenRecordingPermission.status != .notGranted {
            DispatchQueue.main.async {
                preStartupPermissionsPassed = true
                PermissionsWindow.shared?.close()
                setInfrequentTimer()
                startListeningForDistributedRevoke()
                App.continueAppLaunchAfterPermissionsAreGranted()
            }
        } else {
            DispatchQueue.main.async {
                App.showPermissionsWindow()
            }
        }
    }

    private static func checkPermissionsPostStartup() {
        if AccessibilityPermission.status == .notGranted {
            Logger.error { "Accessibility permission revoked while KeyTab was running; restarting" }
            DispatchQueue.main.async { App.restart() }
        }
    }

    // Post-startup, with the distributed-notification listener wired up, we only need a sparse
    // backstop poll. The notification's firing behaviour isn't fully characterised, so the 60s
    // timer is the recovery path for cases where it doesn't fire.
    static func setInfrequentTimer() {
        timerIsFrequent = false
        if preStartupPermissionsPassed && distributedObserver != nil {
            timer.schedule(deadline: .now() + 60, repeating: 60, leeway: .seconds(10))
            return
        }
        timer.schedule(deadline: .now() + 5, repeating: 5, leeway: .seconds(1))
    }

    static func setFrequentTimer() {
        timerIsFrequent = true
        timer.schedule(deadline: .now(), repeating: 0.5, leeway: .milliseconds(500))
    }

    private static func setImmediateTimer() {
        timerIsFrequent = false
        timer.schedule(deadline: .now(), repeating: .never, leeway: .never)
    }
}

class AccessibilityPermission {
    static var status = PermissionStatus.notGranted

    @discardableResult
    static func update() -> PermissionStatus {
        status = detect()
        return status
    }

    private static func detect() -> PermissionStatus {
        return AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeRetainedValue(): false] as CFDictionary) ? .granted : .notGranted
    }
}

class ScreenRecordingPermission {
    static var status = PermissionStatus.notGranted

    @discardableResult
    static func update() -> PermissionStatus {
        status = detect()
        return status
    }

    private static func detect() -> PermissionStatus {
        guard !Preferences.screenRecordingPermissionSkipped else {
            return CGPreflightScreenCaptureAccess() ? .granted : .skipped
        }
        return isGrantedOnSomeDisplay() ? .granted : .notGranted
    }

    // workaround: public API CGPreflightScreenCaptureAccess and private API SLSRequestScreenCaptureAccess exist, but
    // their return value is not updated during the app lifetime
    // note: shows the system prompt if there's no permission
    private static func isGrantedOnSomeDisplay() -> Bool {
        checkWithSCShareableContent()
    }

    private static func checkWithSCShareableContent() -> Bool {
        return runWithTimeout { completion in
            SCShareableContent.getExcludingDesktopWindows(true, onScreenWindowsOnly: false) { shareableContent, error in
                // this callback runs on a GCD queue, not on the thread that called getWithCompletionHandler
                if let shareableContent, error == nil {
                    BackgroundWork.screenshotsQueue.addOperation {
                        WindowCaptureScreenshots.cachedSCWindows.withLock { $0 = shareableContent.windows }
                    }
                }
                completion(error != nil ? false : (shareableContent != nil))
            }
        }
    }

    private static func runWithTimeout(_ block: @escaping (@escaping (Bool) -> Void) -> Void) -> Bool {
        let semaphore = DispatchSemaphore(value: 0)
        var result = false
        BackgroundWork.permissionsSystemCallsQueue.addOperation {
            block { r in
                result = r
                semaphore.signal()
            }
        }
        let timeoutResult = semaphore.wait(timeout: .now() + 6)
        if timeoutResult == .timedOut {
            Logger.error { "Screen-recording permission call timed out after 6s" }
            return false
        }
        return result
    }
}
