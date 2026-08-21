// SoNovel — parse tên file chương khi nhập hàng loạt.
// Quy ước: "Chương 1_ Khởi Đầu Mới.txt"
//   - orderNo = số trong "Chương N" (nếu có)
//   - title   = phần sau "Chương N" (bỏ tiền tố), "_" → " "
//   Ví dụ: "Chương 1_ Khởi Đầu Mới.txt" → orderNo 1, title "Khởi Đầu Mới"
//          "Chương 3.txt"               → orderNo 3, title "Chương 3"

export type ParsedChapterFilename = {
  orderNo: number | null
  title: string
}

export function parseChapterFilename(filename: string): ParsedChapterFilename {
  const base = filename.replace(/\.txt$/i, '').trim()
  const m = base.match(/^Chương\s*(\d+)\s*[:_\-]?\s*(.*)$/i)
  const orderNo = m ? parseInt(m[1], 10) : null
  const rawTitle = m && m[2] ? m[2] : base
  return { orderNo, title: normalizeTitle(rawTitle || base) }
}

function normalizeTitle(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

// Sắp xếp tên file theo thứ tự tự nhiên ("Chương 2" trước "Chương 10")
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' })
}
