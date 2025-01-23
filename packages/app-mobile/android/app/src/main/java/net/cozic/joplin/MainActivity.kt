package net.cozic.joplin
import expo.modules.ReactActivityDelegateWrapper

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.database.CursorWindow
import android.app.AlertDialog
import android.os.Bundle

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Joplin"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled))

  override fun onCreate(savedInstanceState: Bundle?) {
      super.onCreate(savedInstanceState)
      try {
          val field = CursorWindow::class.java.getDeclaredField("sCursorWindowSize")
          field.isAccessible = true
          var origResult = field[null]
          field[null] = 1024
          val builder = AlertDialog.Builder(this)
          builder.setMessage("It worked! Old: " + origResult + " New: " + field[null])
          val alertDialog = builder.create()
          alertDialog.show()
      } catch (e: Exception) {
          val builder = AlertDialog.Builder(this)
          builder.setMessage(e.message + " - " + e.cause)
          val alertDialog = builder.create()
          alertDialog.show()
      }
  }
}
