package expo.modules.sonoveltts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import java.util.Locale

/**
 * Foreground service chuyên phát TTS bằng Android system TextToSpeech engine.
 *
 * Đặc điểm cốt lõi (đã xử lý các bug §8.5):
 *  - foregroundServiceType = mediaPlayback (chạy nền khi khóa màn hình).
 *  - MediaSession + Notification với 4 action: prev / play-pause / next / stop.
 *  - Watchdog WATCHDOG_MS=2000: nếu speak() trả OK nhưng engine không gọi onStart
 *    → retry MAX_RETRY=2 → re-init engine → onErrorInternal.
 *  - Init timeout INIT_TIMEOUT_MS=6000: nếu engine không gọi onInit → tự onError.
 *  - speakSeq tăng dần + currentUtteranceId guard: callback lạc/trùng bị bỏ qua.
 *  - onStateChange 'playing' chỉ emit từ onStart THẬT.
 *  - onResume (notification play) dùng SETTLE_MS=200 trễ sau stop().
 *  - playFrom khi !ttsReady → chain qua ensureTts (không bao giờ return im lặng).
 */
class TtsService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val ACTION_START = "com.sonovel.app.action.START"
        const val ACTION_PAUSE = "com.sonovel.app.action.PAUSE"
        const val ACTION_RESUME = "com.sonovel.app.action.RESUME"
        const val ACTION_STOP = "com.sonovel.app.action.STOP"
        const val ACTION_NEXT = "com.sonovel.app.action.NEXT"
        const val ACTION_PREV = "com.sonovel.app.action.PREV"
        const val ACTION_SEEK = "com.sonovel.app.action.SEEK"
        const val ACTION_PLAY_CHAPTER = "com.sonovel.app.action.PLAY_CHAPTER"
        const val ACTION_SET_RATE = "com.sonovel.app.action.SET_RATE"

        const val EXTRA_SERIES_TITLE = "seriesTitle"
        const val EXTRA_COVER_URL = "coverUrl"
        const val EXTRA_CHAPTER_NUMBER = "chapterNumber"
        const val EXTRA_CHAPTER_TITLE = "chapterTitle"
        const val EXTRA_CHAPTER_CONTENT = "chapterContent"
        const val EXTRA_START_CHAR = "startCharIndex"
        const val EXTRA_RATE = "rate"
        const val EXTRA_CHAR_INDEX = "charIndex"

        const val SETTLE_MS = 200L
        const val WATCHDOG_MS = 2000L
        const val INIT_TIMEOUT_MS = 6000L
        const val MAX_RETRY = 2
        // Watchdog riêng cho utterance tiêu đề — engine OEM hay nuốt speak(QUEUE_FLUSH)
        // ngay sau khi chương trước vừa kết thúc → nếu không có watchdog này thì
        // không bao giờ có onStart/onDone → im lặng vĩnh viễn (bug auto-next).
        const val TITLE_WATCHDOG_MS = 3000L

        const val TAG = "SoNovelTTS"

        const val CHANNEL_ID = "sonovel_tts_channel"
        const val NOTIF_ID = 0x7f01

        @Volatile
        var instance: TtsService? = null
    }

    // --- TTS engine state ---
    private var tts: TextToSpeech? = null
    @Volatile private var ttsReady = false
    private var pendingPlay: (() -> Unit)? = null

    // --- Playback state ---
    private var chapterTitle = ""
    private var chapterContent = ""
    @Volatile private var chapterIndex = 0
    @Volatile private var charIndex = 0
    @Volatile private var chunkIndex = 0
    private var chunks: List<String> = emptyList()
    @Volatile private var rate = 1.0f
    @Volatile private var playing = false
    @Volatile private var engineStarted = false
    // Bật true ngay sau khi 1 chương phát xong (finishChapter) — JS dùng polling
    // getState() để nhận diện "hết chương" kể cả khi event ON_CHAPTER_END bị drop.
    @Volatile private var finished = false
    private var seriesTitle = ""
    private var coverUrl = ""
    private var announceTitle = false

    // --- Utterance tracking ---
    @Volatile private var currentUtteranceId: String? = null
    private var speakSeq = 0
    @Volatile private var pendingTargetChar = 0
    private var retryCount = 0

    // --- Title utterance tracking (fix auto-next) ---
    @Volatile private var titleStarted = false
    private var titleWatchdogRunnable: Runnable? = null
    private var titleRetry = 0

    // --- Handlers ---
    private val main = Handler(Looper.getMainLooper())
    private var watchdogRunnable: Runnable? = null
    private var initTimeoutRunnable: Runnable? = null
    private var settleRunnable: Runnable? = null
    private var sleepRunnable: Runnable? = null

    // --- Notification / MediaSession / Audio focus ---
    private var notificationManager: NotificationManager? = null
    private var audioManager: AudioManager? = null
    private var mediaSession: MediaSessionCompat? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var afChangeListener: AudioManager.OnAudioFocusChangeListener? = null
    private var channelCreated = false

    // -------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        instance = this
        notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        ensureChannel()
        setupMediaSession()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        when (action) {
            ACTION_START -> handleStartAction(intent)
            ACTION_PLAY_CHAPTER -> handlePlayChapterAction(intent)
            ACTION_PAUSE -> onPause()
            ACTION_RESUME -> onResume()
            ACTION_STOP -> onStop(true)
            ACTION_NEXT -> emitChapterSeek(1)
            ACTION_PREV -> emitChapterSeek(-1)
            ACTION_SEEK -> {
                val ch = intent?.getIntExtra(EXTRA_CHAR_INDEX, 0) ?: 0
                ensureTts { playFrom(ch) }
            }
            ACTION_SET_RATE -> {
                val r = intent?.getFloatExtra(EXTRA_RATE, 1.0f) ?: 1.0f
                this.rate = r
                try { tts?.setSpeechRate(r) } catch (_: Throwable) {}
            }
            else -> { /* no-op */ }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelWatchdog()
        cancelInitTimeout()
        cancelSleepTimer()
        try { tts?.stop() } catch (_: Throwable) {}
        try { tts?.shutdown() } catch (_: Throwable) {}
        tts = null
        ttsReady = false
        pendingPlay = null
        releaseAudioFocus()
        try { mediaSession?.release() } catch (_: Throwable) {}
        mediaSession = null
        instance = null
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // -------------------------------------------------------------------
    // ACTION handlers
    // -------------------------------------------------------------------

    private fun handleStartAction(intent: Intent) {
        val seriesTitle = intent.getStringExtra(EXTRA_SERIES_TITLE) ?: ""
        val coverUrl = intent.getStringExtra(EXTRA_COVER_URL) ?: ""
        val chapterNumber = intent.getIntExtra(EXTRA_CHAPTER_NUMBER, 1)
        val title = intent.getStringExtra(EXTRA_CHAPTER_TITLE) ?: ""
        val content = intent.getStringExtra(EXTRA_CHAPTER_CONTENT) ?: ""
        val startChar = intent.getIntExtra(EXTRA_START_CHAR, 0)
        val rate = intent.getFloatExtra(EXTRA_RATE, 1.0f)

        this.seriesTitle = seriesTitle
        this.coverUrl = coverUrl
        this.chapterTitle = title
        this.chapterContent = content
        this.chapterIndex = maxOf(chapterNumber - 1, 0)
        this.charIndex = startChar
        this.announceTitle = (startChar == 0)
        this.rate = rate
        this.retryCount = 0
        this.titleRetry = 0
        this.finished = false

        startForegroundNow()
        requestAudioFocus()
        updateMediaMetadata()
        ensureTts { playFrom(charIndex) }
    }

    private fun handlePlayChapterAction(intent: Intent) {
        val chapterNumber = intent.getIntExtra(EXTRA_CHAPTER_NUMBER, 1)
        val title = intent.getStringExtra(EXTRA_CHAPTER_TITLE) ?: ""
        val content = intent.getStringExtra(EXTRA_CHAPTER_CONTENT) ?: ""
        val ch = intent.getIntExtra(EXTRA_CHAR_INDEX, 0)
        this.chapterTitle = title
        this.chapterContent = content
        this.chapterIndex = maxOf(chapterNumber - 1, 0)
        this.charIndex = ch
        this.announceTitle = (ch == 0)
        this.retryCount = 0
        this.titleRetry = 0
        this.finished = false
        Log.d(TAG, "PLAY_CHAPTER nhận: chapter=${chapterIndex + 1}, chars=${content.length}, startChar=$ch")
        updateMediaMetadata()
        // FIX auto-next: trễ SETTLE_MS trước khi speak — engine OEM hay nuốt
        // speak(QUEUE_FLUSH) gọi ngay sau khi utterance chương trước vừa kết thúc.
        main.postDelayed({ ensureTts { playFrom(ch) } }, SETTLE_MS)
    }

    // -------------------------------------------------------------------
    // Foreground + Notification
    // -------------------------------------------------------------------

    private fun ensureChannel() {
        if (channelCreated) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "SoNovel — Đọc truyện",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Thông báo điều khiển nghe truyện SoNovel"
                setShowBadge(false)
            }
            notificationManager?.createNotificationChannel(ch)
        }
        channelCreated = true
    }

    private fun startForegroundNow() {
        ensureChannel()
        val notif = buildNotification(playing)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIF_ID, notif)
            }
        } catch (_: SecurityException) {
            // Thiếu permission FOREGROUND_SERVICE_MEDIA_PLAYBACK trên Android 14+
            emitError(10, "Thiếu quyền FOREGROUND_SERVICE_MEDIA_PLAYBACK")
        } catch (_: Throwable) {
            emitError(11, "Không thể startForeground()")
        }
    }

    private fun buildNotification(isPlaying: Boolean): Notification {
        val title = seriesTitle.ifEmpty { "SoNovel" }
        val text = if (chapterContent.isBlank()) "Đang chuẩn bị…"
                   else "Chương ${chapterIndex + 1}. $chapterTitle"

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        // Tap notification → mở app
        try {
            val launch = packageManager.getLaunchIntentForPackage(packageName)
            if (launch != null) {
                val contentPi = PendingIntent.getActivity(
                    this, 0, launch,
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    else PendingIntent.FLAG_UPDATE_CURRENT
                )
                builder.setContentIntent(contentPi)
            }
        } catch (_: Throwable) {}

        builder.addAction(android.R.drawable.ic_media_previous, "Trước",
            buildAction(ACTION_PREV, 1))
        val playPauseAction = if (isPlaying) ACTION_PAUSE else ACTION_RESUME
        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (isPlaying) "Tạm dừng" else "Phát"
        builder.addAction(playPauseIcon, playPauseLabel, buildAction(playPauseAction, 2))
        builder.addAction(android.R.drawable.ic_media_next, "Sau", buildAction(ACTION_NEXT, 3))
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dừng",
            buildAction(ACTION_STOP, 4))

        try {
            mediaSession?.sessionToken?.let { token ->
                builder.setStyle(MediaStyle()
                    .setMediaSession(token)
                    .setShowActionsInCompactView(0, 1, 2))
            }
        } catch (_: Throwable) {}

        return builder.build()
    }

    private fun buildAction(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, TtsService::class.java).apply { this.action = action }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getService(this, requestCode, intent, flags)
    }

    private fun updateNotification() {
        try {
            notificationManager?.notify(NOTIF_ID, buildNotification(playing))
        } catch (_: Throwable) {}
    }

    // -------------------------------------------------------------------
    // MediaSession
    // -------------------------------------------------------------------

    private fun setupMediaSession() {
        try {
            val session = MediaSessionCompat(this, "SoNovelTts")
            session.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            session.setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { sendServiceAction(ACTION_RESUME) }
                override fun onPause() { sendServiceAction(ACTION_PAUSE) }
                override fun onSkipToNext() { sendServiceAction(ACTION_NEXT) }
                override fun onSkipToPrevious() { sendServiceAction(ACTION_PREV) }
                override fun onStop() { sendServiceAction(ACTION_STOP) }
            })
            session.isActive = true
            mediaSession = session
        } catch (_: Throwable) {}
    }

    private fun updateMediaMetadata() {
        try {
            val title = if (chapterContent.isBlank()) seriesTitle
                else "Chương ${chapterIndex + 1}. $chapterTitle"
            val md = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, seriesTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "SoNovel")
                .build()
            mediaSession?.setMetadata(md)
            mediaSession?.setPlaybackState(buildPlaybackState())
        } catch (_: Throwable) {}
    }

    private fun buildPlaybackState(): PlaybackStateCompat {
        val state = if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        return PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, rate)
            .build()
    }

    private fun sendServiceAction(action: String) {
        try {
            val intent = Intent(this, TtsService::class.java).apply { this.action = action }
            startService(intent)
        } catch (_: Throwable) {}
    }

    // -------------------------------------------------------------------
    // Audio focus
    // -------------------------------------------------------------------

    private fun requestAudioFocus() {
        try {
            if (afChangeListener == null) {
                afChangeListener = AudioManager.OnAudioFocusChangeListener { change ->
                    when (change) {
                        AudioManager.AUDIOFOCUS_LOSS -> { stopSelf() }
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> onPause()
                        AudioManager.AUDIOFOCUS_GAIN -> onResume()
                    }
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener(afChangeListener!!)
                    .build()
                audioFocusRequest = req
                audioManager?.requestAudioFocus(req)
            } else {
                @Suppress("DEPRECATION")
                audioManager?.requestAudioFocus(
                    afChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
                )
            }
        } catch (_: Throwable) {}
    }

    private fun releaseAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager?.abandonAudioFocus(afChangeListener)
            }
        } catch (_: Throwable) {}
    }

    // -------------------------------------------------------------------
    // TTS init
    // -------------------------------------------------------------------

    private fun initTts() {
        try { tts?.shutdown() } catch (_: Throwable) {}
        tts = null
        ttsReady = false
        tts = TextToSpeech(this, this)
        cancelInitTimeout()
        initTimeoutRunnable = Runnable {
            if (!ttsReady) {
                emitError(0, "TTS engine không khởi động được (init timeout)")
                try { tts?.shutdown() } catch (_: Throwable) {}
                tts = null
                pendingPlay = null
            }
        }
        main.postDelayed(initTimeoutRunnable!!, INIT_TIMEOUT_MS)
    }

    override fun onInit(status: Int) {
        cancelInitTimeout()
        if (status != TextToSpeech.SUCCESS) {
            ttsReady = false
            try { tts?.shutdown() } catch (_: Throwable) {}
            tts = null
            pendingPlay = null
            emitError(0, "TTS engine báo lỗi khởi tạo")
            return
        }
        val engine = tts ?: run {
            ttsReady = false
            return
        }
        ttsReady = true
        engine.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        val res = engine.setLanguage(Locale("vi", "VN"))
        if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
            try { engine.setLanguage(Locale.getDefault()) } catch (_: Throwable) {}
            emitError(1, "Thiếu giọng tiếng Việt")
        }
        try { engine.setSpeechRate(rate) } catch (_: Throwable) {}
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) { handleOnStart(utteranceId) }
            override fun onRangeStart(utteranceId: String?, start: Int, end: Int, frame: Int) {
                handleOnRangeStart(utteranceId, start, end)
            }
            override fun onDone(utteranceId: String?) { handleOnDone(utteranceId) }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) { handleOnError(utteranceId, -1) }
            override fun onError(utteranceId: String?, errorCode: Int) {
                handleOnError(utteranceId, errorCode)
            }
        })
        pendingPlay?.invoke()
        pendingPlay = null
    }

    private fun ensureTts(then: () -> Unit) {
        if (ttsReady && tts != null) {
            then()
            return
        }
        // Chưa ready — lưu pendingPlay, nếu tts==null thì init mới
        pendingPlay = then
        if (tts == null) initTts()
    }

    private fun cancelInitTimeout() {
        initTimeoutRunnable?.let { main.removeCallbacks(it) }
        initTimeoutRunnable = null
    }

    // -------------------------------------------------------------------
    // Play flow
    // -------------------------------------------------------------------

    private fun playFrom(targetChar: Int) {
        if (!ttsReady || tts == null) {
            // KHÔNG return im lặng — chain qua ensureTts để watchdog không mất dấu.
            ensureTts { playFrom(targetChar) }
            return
        }
        cancelWatchdog()
        val engine = tts ?: return
        if (chapterContent.isBlank()) {
            emitError(2, "Không có nội dung chương để phát")
            return
        }
        val content = chapterContent
        val clamped = targetChar.coerceIn(0, content.length)
        pendingTargetChar = clamped
        engineStarted = false

        chunks = TtsChunker.chunk(content)
        if (chunks.isEmpty()) {
            finishChapter()
            return
        }
        val idx = TtsChunker.findChunkIndex(chunks, clamped)
        chunkIndex = if (idx >= 0) idx else 0

        // Đọc tiêu đề "Chương N. Title" nếu bắt đầu chương.
        // FIX: KHÔNG queue chunk cùng lúc với title — đợi title onDone rồi mới speakNextChunk().
        // Lý do: queue chunk trước làm currentUtteranceId = chunkId, watchdog arm ngay →
        // nếu title phát >2s thì watchdog fire sai (chunk chưa onStart) → retry/re-init → error 12s.
        if (announceTitle && clamped == 0) {
            val title = "Chương ${chapterIndex + 1}. $chapterTitle"
            val titleId = "sonovel_title_${chapterIndex}_${++speakSeq}"
            val titleParams = Bundle().apply {
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, titleId)
            }
            // currentUtteranceId giữ = titleId để handleOnStart/handleOnDone của title match.
            currentUtteranceId = titleId
            titleStarted = false
            Log.d(TAG, "playFrom: speak title id=$titleId")
            try {
                val ok = engine.speak(title, TextToSpeech.QUEUE_FLUSH, titleParams, titleId)
                if (ok != TextToSpeech.SUCCESS) {
                    // Engine từ chối speak tiêu đề → bỏ qua title, phát thẳng nội dung
                    Log.w(TAG, "speak(title) bị từ chối (ok=$ok) → bỏ qua title")
                    announceTitle = false
                    retryCount = 0
                    speakNextChunk()
                    return
                }
            } catch (t: Throwable) {
                emitError(3, "Không gọi được speak() tiêu đề: ${t.message}")
                return
            }
            // FIX auto-next: arm watchdog cho title — nếu engine nuốt utterance này
            // (không bao giờ onStart/onDone) thì retry 1 lần rồi bỏ qua title.
            armTitleWatchdog(titleId)
            // chunk đầu sẽ được speakNextChunk() gọi từ handleOnDone(titleId)
            return
        }

        val chunkId = "sonovel_${chapterIndex}_${chunkIndex}_${++speakSeq}"
        currentUtteranceId = chunkId
        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, chunkId)
        }
        try {
            val ok = engine.speak(chunks[chunkIndex], TextToSpeech.QUEUE_FLUSH, params, chunkId)
            if (ok != TextToSpeech.SUCCESS) {
                handleEngineSpeakFailure()
                return
            }
        } catch (t: Throwable) {
            emitError(3, "Không gọi được speak(): ${t.message}")
            return
        }
        armWatchdog(chunkId)
    }

    private fun speakNextChunk() {
        val engine = tts ?: return
        if (chunkIndex !in chunks.indices) return
        val chunkId = "sonovel_${chapterIndex}_${chunkIndex}_${++speakSeq}"
        currentUtteranceId = chunkId
        engineStarted = false
        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, chunkId)
        }
        try {
            val ok = engine.speak(chunks[chunkIndex], TextToSpeech.QUEUE_FLUSH, params, chunkId)
            if (ok != TextToSpeech.SUCCESS) {
                handleEngineSpeakFailure()
                return
            }
        } catch (t: Throwable) {
            emitError(3, "speak(): ${t.message}")
            return
        }
        armWatchdog(chunkId)
    }

    private fun armWatchdog(expectedId: String) {
        cancelWatchdog()
        watchdogRunnable = Runnable {
            if (currentUtteranceId == expectedId && !engineStarted) {
                if (retryCount < MAX_RETRY) {
                    retryCount++
                    ensureTts { playFrom(pendingTargetChar) }
                } else {
                    retryCount = 0
                    try { tts?.shutdown() } catch (_: Throwable) {}
                    tts = null
                    ttsReady = false
                    // Re-init engine; init-timeout sẽ báo lỗi nếu vẫn treo
                    ensureTts { playFrom(pendingTargetChar) }
                    // Safety: nếu re-init vẫn không onStart sau 2*WATCHDOG_MS → onError
                    main.postDelayed({
                        if (currentUtteranceId == expectedId && !engineStarted) {
                            onErrorInternal("Engine TTS không phản hồi sau re-init")
                        }
                    }, WATCHDOG_MS * 2)
                }
            }
        }
        main.postDelayed(watchdogRunnable!!, WATCHDOG_MS)
    }

    private fun cancelWatchdog() {
        watchdogRunnable?.let { main.removeCallbacks(it) }
        watchdogRunnable = null
    }

    // -------------------------------------------------------------------
    // Title watchdog — fix auto-next: engine OEM hay nuốt speak(QUEUE_FLUSH)
    // của utterance tiêu đề khi gọi ngay sau khi chương trước vừa kết thúc.
    // Không có onStart/onDone → không bao giờ sang chunk nội dung → im lặng vĩnh viễn.
    // Chiến lược: sau TITLE_WATCHDOG_MS nếu title chưa onStart → retry 1 lần
    // (kèm SETTLE_MS) → vẫn im lặng thì BỎ QUA tiêu đề, phát thẳng chunk.
    // -------------------------------------------------------------------

    private fun armTitleWatchdog(expectedId: String) {
        cancelTitleWatchdog()
        titleWatchdogRunnable = Runnable {
            if (currentUtteranceId == expectedId && !titleStarted) {
                if (titleRetry < 1) {
                    titleRetry++
                    Log.w(TAG, "Title không onStart sau ${TITLE_WATCHDOG_MS}ms → thử phát lại (retry=$titleRetry)")
                    main.postDelayed({
                        if (currentUtteranceId == expectedId && !titleStarted) {
                            val engine = tts
                            if (engine == null) { skipTitleAndPlay(); return@postDelayed }
                            try {
                                val ok = engine.speak(
                                    "Chương ${chapterIndex + 1}. $chapterTitle",
                                    TextToSpeech.QUEUE_FLUSH,
                                    Bundle().apply { putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, expectedId) },
                                    expectedId
                                )
                                if (ok == TextToSpeech.SUCCESS) {
                                    armTitleWatchdog(expectedId)
                                } else {
                                    skipTitleAndPlay()
                                }
                            } catch (_: Throwable) {
                                skipTitleAndPlay()
                            }
                        }
                    }, SETTLE_MS)
                } else {
                    skipTitleAndPlay()
                }
            }
        }
        main.postDelayed(titleWatchdogRunnable!!, TITLE_WATCHDOG_MS)
    }

    private fun skipTitleAndPlay() {
        Log.w(TAG, "Bỏ qua tiêu đề bị nuốt → phát thẳng nội dung chương")
        cancelTitleWatchdog()
        announceTitle = false
        titleRetry = 0
        retryCount = 0
        speakNextChunk()
    }

    private fun cancelTitleWatchdog() {
        titleWatchdogRunnable?.let { main.removeCallbacks(it) }
        titleWatchdogRunnable = null
    }

    private fun handleEngineSpeakFailure() {
        if (retryCount < MAX_RETRY) {
            retryCount++
            main.postDelayed({ ensureTts { playFrom(pendingTargetChar) } }, SETTLE_MS)
        } else {
            onErrorInternal("TTS engine trả lỗi speak() quá nhiều lần")
        }
    }

    private fun onErrorInternal(message: String) {
        playing = false
        cancelWatchdog()
        updateNotification()
        updateMediaMetadata()
        emitError(99, message)
    }

    // -------------------------------------------------------------------
    // Utterance callbacks (đã guard)
    // -------------------------------------------------------------------

    private fun handleOnStart(utteranceId: String?) {
        if (utteranceId == null) return
        if (utteranceId != currentUtteranceId) return
        if (utteranceId.startsWith("sonovel_title_")) {
            // Tiêu đề bắt đầu phát — hủy title watchdog, emit progress với charIndex=0
            // để JS clear busy (tránh nút play xoay trong lúc title đang đọc).
            Log.d(TAG, "onStart(title) id=$utteranceId")
            titleStarted = true
            cancelTitleWatchdog()
            // FIX độ trễ icon pause/play: giọng đã kêu (đang đọc tiêu đề) = ĐANG PHÁT.
            // Trước đây chỉ báo playing đến khi chunk nội dung đầu tiên onStart
            // (~1-2s sau khi tiêu đề đọc xong) → icon đứng ở play rất lâu.
            playing = true
            emit(Events.ON_PROGRESS, mapOf(
                "chapterIndex" to chapterIndex,
                "charIndex" to 0,
                "charLength" to chapterContent.length,
                "fraction" to 0f
            ))
            emit(Events.ON_STATE_CHANGE, mapOf("state" to "playing"))
            updateNotification()
            updateMediaMetadata()
            return
        }
        retryCount = 0
        engineStarted = true
        playing = true
        cancelWatchdog()
        emit(Events.ON_STATE_CHANGE, mapOf("state" to "playing"))
        updateNotification()
        updateMediaMetadata()
    }

    private fun handleOnRangeStart(utteranceId: String?, start: Int, end: Int) {
        if (utteranceId == null) return
        if (utteranceId != currentUtteranceId) return
        if (utteranceId.startsWith("sonovel_title_")) return
        val offset = TtsChunker.chunkOffset(chunks, chunkIndex)
        val ci = offset + start
        charIndex = ci
        val contentLen = chapterContent.length
        val frac = if (contentLen > 0) ci.toFloat() / contentLen else 0f
        emit(Events.ON_PROGRESS, mapOf(
            "chapterIndex" to chapterIndex,
            "charIndex" to ci,
            "charLength" to contentLen,
            "fraction" to frac
        ))
    }

    private fun handleOnDone(utteranceId: String?) {
        if (utteranceId == null) return
        if (utteranceId != currentUtteranceId) return
        if (utteranceId.startsWith("sonovel_title_")) {
            // Tiêu đề đọc xong → phát chunk đầu (không queue trước để tránh watchdog fire sai).
            // Reset announceTitle để chapter tiếp theo vẫn announce.
            Log.d(TAG, "onDone(title) id=$utteranceId")
            cancelTitleWatchdog()
            announceTitle = false
            speakNextChunk()
            return
        }
        emit(Events.ON_CHUNK_DONE, mapOf(
            "chapterIndex" to chapterIndex,
            "chunkIndex" to chunkIndex
        ))
        val offset = TtsChunker.chunkOffset(chunks, chunkIndex)
        charIndex = offset + (if (chunkIndex in chunks.indices) chunks[chunkIndex].length else 0)
        chunkIndex++
        if (chunkIndex < chunks.size) {
            speakNextChunk()
        } else {
            finishChapter()
        }
    }

    private fun handleOnError(utteranceId: String?, errorCode: Int) {
        if (utteranceId == null) return
        if (utteranceId != currentUtteranceId) return
        if (utteranceId.startsWith("sonovel_title_")) return
        emitError(errorCode, "TTS engine lỗi utterance (code=$errorCode)")
    }

    // -------------------------------------------------------------------
    // Chapter navigation
    // -------------------------------------------------------------------

    /**
     * Hết chương — emit ON_CHAPTER_END rồi DỪNG (không tự nhảy chương).
     * JS (tts.ts) là nơi điều phối: lắng nghe chapterEnd → tăng index →
     * gửi lại nội dung chương kế tiếp qua ACTION_PLAY_CHAPTER.
     */
    private fun finishChapter() {
        playing = false
        cancelWatchdog()
        announceTitle = true
        charIndex = 0
        chunkIndex = 0
        finished = true
        updateNotification()
        updateMediaMetadata()
        Log.d(TAG, "finishChapter: chương ${chapterIndex + 1} kết thúc → emit ON_CHAPTER_END")
        emit(Events.ON_CHAPTER_END, mapOf("chapterIndex" to chapterIndex))
    }

    /**
     * Nút next/prev từ notification/media session — native không còn giữ list chương,
     * nên chỉ báo hướng cho JS (onChapterSeek); JS sẽ gửi lại nội dung chương mới.
     */
    private fun emitChapterSeek(direction: Int) {
        try { tts?.stop() } catch (_: Throwable) {}
        playing = false
        engineStarted = false
        cancelWatchdog()
        emit(Events.ON_CHAPTER_SEEK, mapOf("direction" to direction))
    }

    // -------------------------------------------------------------------
    // Pause / Resume / Stop
    // -------------------------------------------------------------------

    fun onPause() {
        playing = false
        engineStarted = false
        cancelWatchdog()
        try { tts?.stop() } catch (_: Throwable) {}
        emit(Events.ON_STATE_CHANGE, mapOf("state" to "paused"))
        updateNotification()
        updateMediaMetadata()
    }

    fun onResume() {
        // SETTLE_MS=200 trễ sau stop() — Android TTS hay "nuốt" speak() ngay sau stop().
        settleRunnable?.let { main.removeCallbacks(it) }
        settleRunnable = Runnable {
            if (!playing) {
                ensureTts { playFrom(charIndex) }
            }
        }
        main.postDelayed(settleRunnable!!, SETTLE_MS)
    }

    fun onStop(stopService: Boolean) {
        playing = false
        engineStarted = false
        cancelWatchdog()
        cancelSleepTimer()
        try { tts?.stop() } catch (_: Throwable) {}
        emit(Events.ON_STATE_CHANGE, mapOf("state" to "stopped"))
        updateMediaMetadata()
        releaseAudioFocus()
        if (stopService) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
            } catch (_: Throwable) {}
            stopSelf()
        }
    }

    // -------------------------------------------------------------------
    // Sleep timer — dừng phát sau N ms kể cả khi app đã bị kill/ra nền.
    // JS vẫn giữ bộ đếm riêng cho UI; native là lớp an toàn.
    // -------------------------------------------------------------------

    fun setSleepTimer(ms: Long) {
        cancelSleepTimer()
        if (ms <= 0) return
        sleepRunnable = Runnable {
            sleepRunnable = null
            onStop(true)
        }
        main.postDelayed(sleepRunnable!!, ms)
    }

    private fun cancelSleepTimer() {
        sleepRunnable?.let { main.removeCallbacks(it) }
        sleepRunnable = null
    }

    // -------------------------------------------------------------------
    // State snapshot (for getState() AsyncFunction)
    // -------------------------------------------------------------------

    fun snapshotState(): Map<String, Any?> {
        val contentLen = chapterContent.length
        val orderNo = chapterIndex + 1
        return mapOf(
            "playing" to playing,
            "chapterIndex" to chapterIndex,
            "charIndex" to charIndex,
            "charLength" to contentLen,
            "chapterTitle" to chapterTitle,
            "orderNo" to orderNo,
            "rate" to rate.toDouble(),
            "chaptersCount" to 1,
            "seriesTitle" to seriesTitle,
            "ttsReady" to ttsReady,
            "finished" to finished,
            "serviceRunning" to true
        )
    }

    // -------------------------------------------------------------------
    // Emit helpers
    // -------------------------------------------------------------------

    private fun emit(eventName: String, params: Map<String, Any?>) {
        val module = SonovelTtsModule.instance ?: return
        try {
            module.sendEvent(eventName, params)
        } catch (_: Throwable) {}
    }

    private fun emitError(code: Int, message: String) {
        playing = false
        cancelWatchdog()
        emit(Events.ON_ERROR, mapOf("code" to code, "message" to message))
    }
}
