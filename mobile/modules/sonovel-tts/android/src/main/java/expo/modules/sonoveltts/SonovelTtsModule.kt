package expo.modules.sonoveltts

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Expo module bridge — lộ ra JS qua `requireNativeModule('SonovelTts')`.
 *
 * Tất cả các AsyncFunction (play/pause/resume/stop/seekTo/setRate/...) xây Intent
 * gửi tới `TtsService` (foreground service). Việc phát TTS thật nằm trong service.
 */
class SonovelTtsModule : Module() {

    companion object {
        @Volatile
        var instance: SonovelTtsModule? = null
    }

    private val ctx: Context
        get() {
            appContext.reactContext?.let { return it }
            appContext.activityProvider?.currentActivity?.let { return it }
            throw IllegalStateException("Không có React context để gửi lệnh TTS")
        }

    private fun sendAction(action: String, extras: Map<String, Any?> = emptyMap()) {
        val context = try {
            ctx
        } catch (e: Throwable) {
            throw IllegalStateException("Không có context để gửi lệnh TTS ($action): ${e.message}")
        }
        val intent = Intent(context, TtsService::class.java).apply {
            this.action = action
            extras.forEach { (k, v) ->
                when (v) {
                    is String -> putExtra(k, v)
                    is Int -> putExtra(k, v)
                    is Long -> putExtra(k, v)
                    is Float -> putExtra(k, v)
                    is Double -> putExtra(k, v.toFloat())
                    is Boolean -> putExtra(k, v)
                    else -> { /* skip */ }
                }
            }
        }
        try {
            ContextCompat.startForegroundService(context, intent)
        } catch (e: Throwable) {
            throw IllegalStateException("Không thể start TTS service ($action): ${e.message}", e)
        }
    }

    override fun definition() = ModuleDefinition {
        Name("SonovelTts")

        OnCreate {
            instance = this@SonovelTtsModule
        }

        OnDestroy {
            instance = null
        }

        Events(
            Events.ON_STATE_CHANGE,
            Events.ON_PROGRESS,
            Events.ON_CHUNK_DONE,
            Events.ON_CHAPTER_END,
            Events.ON_CHAPTER_CHANGE,
            Events.ON_CHAPTER_SEEK,
            Events.ON_SERIES_END,
            Events.ON_ERROR
        )

        AsyncFunction("play") { seriesTitle: String, coverUrl: String, chapterNumber: Int, chapterTitle: String, chapterContent: String, startChar: Int, rate: Double ->
            sendAction(TtsService.ACTION_START, mapOf(
                TtsService.EXTRA_SERIES_TITLE to seriesTitle,
                TtsService.EXTRA_COVER_URL to coverUrl,
                TtsService.EXTRA_CHAPTER_NUMBER to chapterNumber,
                TtsService.EXTRA_CHAPTER_TITLE to chapterTitle,
                TtsService.EXTRA_CHAPTER_CONTENT to chapterContent,
                TtsService.EXTRA_START_CHAR to startChar,
                TtsService.EXTRA_RATE to rate.toFloat()
            ))
            "ok"
        }

        AsyncFunction("playChapter") { chapterNumber: Int, chapterTitle: String, chapterContent: String, startChar: Int ->
            sendAction(TtsService.ACTION_PLAY_CHAPTER, mapOf(
                TtsService.EXTRA_CHAPTER_NUMBER to chapterNumber,
                TtsService.EXTRA_CHAPTER_TITLE to chapterTitle,
                TtsService.EXTRA_CHAPTER_CONTENT to chapterContent,
                TtsService.EXTRA_CHAR_INDEX to startChar
            ))
            "ok"
        }

        AsyncFunction("preloadNext") { chapterNumber: Int, chapterTitle: String, chapterContent: String ->
            sendAction(TtsService.ACTION_PRELOAD_NEXT, mapOf(
                TtsService.EXTRA_CHAPTER_NUMBER to chapterNumber,
                TtsService.EXTRA_CHAPTER_TITLE to chapterTitle,
                TtsService.EXTRA_CHAPTER_CONTENT to chapterContent
            ))
            "ok"
        }

        AsyncFunction("setPlaylist") { chapterIdsJson: String, workerUrl: String ->
            sendAction(TtsService.ACTION_SET_PLAYLIST, mapOf(
                TtsService.EXTRA_PLAYLIST_JSON to chapterIdsJson,
                TtsService.EXTRA_WORKER_URL to workerUrl
            ))
            "ok"
        }

        AsyncFunction("pause") {
            sendAction(TtsService.ACTION_PAUSE)
            "ok"
        }

        AsyncFunction("resume") {
            sendAction(TtsService.ACTION_RESUME)
            "ok"
        }

        AsyncFunction("stop") {
            sendAction(TtsService.ACTION_STOP)
            "ok"
        }

        AsyncFunction("seekTo") { char: Int ->
            sendAction(TtsService.ACTION_SEEK, mapOf(
                TtsService.EXTRA_CHAR_INDEX to char
            ))
            "ok"
        }

        AsyncFunction("setRate") { rate: Double ->
            sendAction(TtsService.ACTION_SET_RATE, mapOf(
                TtsService.EXTRA_RATE to rate.toFloat()
            ))
            "ok"
        }

        AsyncFunction("sleepAfter") { ms: Long ->
            // KHÔNG startForegroundService (tránh crash Android 12+ khi service chưa chạy).
            // Chỉ set timer nếu service đã đang chạy.
            val svc = TtsService.instance
            if (svc != null) {
                Handler(Looper.getMainLooper()).post { svc.setSleepTimer(ms) }
            }
            "ok"
        }

        AsyncFunction("getState") {
            val svc = TtsService.instance
            if (svc != null) svc.snapshotState()
            else mapOf(
                "playing" to false,
                "chapterIndex" to 0,
                "charIndex" to 0,
                "rate" to 1.0,
                "chaptersCount" to 0,
                "seriesTitle" to "",
                "ttsReady" to false,
                "finished" to false,
                "serviceRunning" to false
            )
        }

        AsyncFunction("requestNotificationPermission") {
            val context = appContext.reactContext
            if (context == null) false
            else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) true
            else {
                val granted = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED
                if (!granted) {
                    appContext.currentActivity?.requestPermissions(
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        1001
                    )
                }
                granted
            }
        }
    }
}
