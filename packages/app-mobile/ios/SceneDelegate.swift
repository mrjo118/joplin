internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  private weak var windowControlsSafeAreaProbe: UIView?

  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options: UIScene.ConnectionOptions
  ) {
    if let shortcutItem = options.shortcutItem {
      RNQuickActionManager.setInitialAction(shortcutItem)
    }
    
    super.scene(scene, willConnectTo: session, options: options)

    // The ordinary safe area does not include iPadOS window controls when they
    // share the top edge with app content. Give React Native the additional top
    // inset that UIKit's corner-adapted margins reserve for those controls.
    if UIDevice.current.userInterfaceIdiom == .pad, #available(iOS 26.0, *),
       let window = self.window {
      let probe = WindowControlsSafeAreaProbe(frame: window.bounds)
      probe.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      probe.isUserInteractionEnabled = false
      window.addSubview(probe)
      window.sendSubviewToBack(probe)
      windowControlsSafeAreaProbe = probe
    }
  }

  @available(iOS 26.0, *)
  func windowScene(
    _ windowScene: UIWindowScene,
    didUpdateEffectiveGeometry previousGeometry: UIWindowScene.Geometry
  ) {
    windowControlsSafeAreaProbe?.setNeedsLayout()
  }
  
  // For react-native-quick-actions support:
  public override func windowScene(
    _ scene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    RNQuickActionManager.onQuickActionPress(shortcutItem, completionHandler: completionHandler)
  }
}

@available(iOS 26.0, *)
private final class WindowControlsSafeAreaProbe: UIView {
  private weak var adjustedViewController: UIViewController?
  private var originalTopInset: CGFloat = 0

  override func layoutSubviews() {
    super.layoutSubviews()
    updateTopInset()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    updateTopInset()
  }

  private func updateTopInset() {
    guard let rootViewController = window?.rootViewController else { return }
    if adjustedViewController !== rootViewController {
      adjustedViewController = rootViewController
      originalTopInset = rootViewController.additionalSafeAreaInsets.top
    }

    // Compare guides on the same view, so ordinary layout margins and the
    // existing status-bar safe area do not become additional padding.
    let adaptedTop = layoutGuide(for: .margins(cornerAdaptation: .vertical)).layoutFrame.minY
    let regularTop = layoutMarginsGuide.layoutFrame.minY
    let extraTop = max(0, adaptedTop - regularTop)
    let requiredTopInset = originalTopInset + extraTop

    if abs(rootViewController.additionalSafeAreaInsets.top - requiredTopInset) > 0.5 {
      rootViewController.additionalSafeAreaInsets.top = requiredTopInset
    }
  }
}
