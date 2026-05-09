package com.delycartapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "delycart"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    createNotificationChannels()
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return

    val high = NotificationChannel(
      "delycart_high",
      "Orders & Alerts",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Order updates, delivery alerts"
      enableVibration(true)
    }

    val default = NotificationChannel(
      "delycart_default",
      "General",
      NotificationManager.IMPORTANCE_DEFAULT
    ).apply {
      description = "General notifications"
    }

    manager.createNotificationChannel(high)
    manager.createNotificationChannel(default)
  }
}
