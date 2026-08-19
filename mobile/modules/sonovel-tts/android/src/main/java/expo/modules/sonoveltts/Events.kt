package expo.modules.sonoveltts

/**
 * Định nghĩa tên event dùng cho cả TtsService và SonovelTtsModule.
 */
object Events {
    const val ON_STATE_CHANGE = "onStateChange"
    const val ON_PROGRESS = "onProgress"
    const val ON_CHUNK_DONE = "onChunkDone"
    const val ON_CHAPTER_END = "onChapterEnd"
    const val ON_CHAPTER_CHANGE = "onChapterChange"
    const val ON_SERIES_END = "onSeriesEnd"
    const val ON_ERROR = "onError"
}

/**
 * Thông tin 1 chương: title + content (chính là văn bản TTS sẽ đọc).
 */
data class ChapterInfo(
    val title: String,
    val content: String
)
