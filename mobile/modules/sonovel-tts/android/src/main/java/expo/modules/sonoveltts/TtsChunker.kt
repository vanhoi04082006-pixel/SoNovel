package expo.modules.sonoveltts

import java.util.regex.Pattern

/**
 * Chia nội dung chương thành các chunk ~900 ký tự tại biên câu/đoạn.
 * Mỗi chunk là một utterance riêng — Android TTS có giới hạn độ dài utterance
 * thực tế ~4000 ký tự, nhưng ~900 là sweet spot: progress mịn + không bị lạc.
 */
object TtsChunker {
    private const val TARGET = 900
    private const val MAX = 1400

    private val SENTENCE_END = Pattern.compile("[.!?…。！？]")
    private const val NEWLINE = '\n'

    /**
     * Chia text thành danh sách chunk. Mỗi chunk là 1 chuỗi ngắn ~TARGET ký tự,
     * được cắt tại dấu câu hoặc xuống dòng gần TARGET nhất.
     */
    fun chunk(content: String): List<String> {
        if (content.isBlank()) return emptyList()
        val out = ArrayList<String>()
        val src = content.replace("\r\n", "\n").replace("\r", "\n")
        val n = src.length
        var i = 0
        while (i < n) {
            if (i + TARGET >= n) {
                val tail = src.substring(i).trim()
                if (tail.isNotEmpty()) out.add(tail)
                break
            }
            var cut = -1
            // 1) Tìm dấu câu gần TARGET nhất (trong [TARGET-150, TARGET+150])
            val lo = maxOf(i, i + TARGET - 150)
            val hi = minOf(n - 1, i + TARGET + 150)
            for (j in hi downTo lo) {
                val c = src[j]
                if (SENTENCE_END.matcher(c.toString()).find() || c == NEWLINE) {
                    cut = j + 1
                    break
                }
            }
            if (cut <= i) {
                // 2) Fallback: tìm newline tiếp theo trong khoảng MAX
                val nl = src.indexOf('\n', i + 1)
                if (nl in (i + 1)..(i + MAX)) {
                    cut = nl + 1
                } else {
                    // 3) Fallback: cắt cứng tại MAX
                    cut = minOf(i + MAX, n)
                }
            }
            val piece = src.substring(i, cut).trim()
            if (piece.isNotEmpty()) out.add(piece)
            i = cut
        }
        return out
    }

    /**
     * Tìm index chunk chứa charIndex toàn cục (tính từ đầu content).
     * Trả về -1 nếu không tìm (charIndex ngoài range).
     */
    fun findChunkIndex(chunks: List<String>, charIndex: Int): Int {
        if (chunks.isEmpty()) return -1
        var acc = 0
        for ((idx, c) in chunks.withIndex()) {
            val next = acc + c.length
            if (charIndex < next) return idx
            acc = next
        }
        return chunks.lastIndex
    }

    /**
     * Tổng số ký tự của các chunk trước `chunkIdx` (offset đầu chunk).
     */
    fun chunkOffset(chunks: List<String>, chunkIdx: Int): Int {
        if (chunkIdx <= 0) return 0
        var acc = 0
        val n = minOf(chunkIdx, chunks.size)
        for (i in 0 until n) acc += chunks[i].length
        return acc
    }
}
