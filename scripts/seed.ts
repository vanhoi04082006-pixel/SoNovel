// SoNovel — seed script (Supabase): tags, 15 series + 43 chapters, demo admin + user.
// Run: bun run prisma/seed.ts
// Requires env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createAdminSupabase } from '../src/lib/supabase-admin'

const TAGS = [
  'hệ thống', 'xuyên không', 'sảng văn', 'ngôn tình', 'kiếm hiệp',
  'tiên hiệp', 'đô thị', 'huyền huyễn', 'đồng nhân', 'dị giới',
  'võng du', 'trọng sinh', 'làm ruộng', 'xây dựng', 'tình cảm',
]

function seriesUuid(i: number): string {
  return `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`
}

function chapterUuid(series: number, order: number): string {
  return `b${String(series).padStart(7, '0')}-0000-4000-8000-${String(order).padStart(12, '0')}`
}

function lorem(n: number): string {
  const base = 'Trong khu vườn phía sau tòa viện, ánh trăng nhạt nhòa chiếu xuống mặt đất. Một bóng người mặc áo xanh đứng lặng im, tay cầm một thanh kiếm dài, kiếm khí lạnh lẽo tỏa ra bốn phía. Gió đêm thổi qua, mang theo hương hoa quế thoang thoảng, khiến tâm trí hắn dần dần bình tĩnh lại. Hắn nhớ lại những năm tháng tu luyện vất vả, nhớ lại những trận chiến sinh tử, nhớ lại những người bạn đã ngã xuống trên con đường tu tiên. Mỗi bước đi đều đầy máu và nước mắt, nhưng hắn không hề hối hận. Bởi vì hắn biết, chỉ có kiên trì tiến tới, mới có thể đạt tới đỉnh phong của đại đạo, mới có thể bảo vệ những người hắn yêu thương. '
  let s = ''
  while (s.length < n) s += base
  return s.slice(0, n)
}

const SERIES = [
  {
    title: 'Trường Sinh Chi Lộ', author: 'Ngạo Thiên', status: 'published',
    description: 'Một thiếu niên bình thường vô tình nhặt được cuốn cổ thư, từ đó bước lên con đường tu tiên đầy chông gai. Hắn sẽ đối mặt với ma đạo, tiên môn, và bí ẩn về nguồn gốc của chính mình.',
    genres: ['Tiên Hiệp', 'Huyền Huyễn'], tags: ['tu tiên', 'trọng sinh', 'sảng văn'],
    chapters: [
      { title: 'Chương 1: Cổ thư kỳ lạ', content: lorem(3500) },
      { title: 'Chương 2: Bước đầu tu luyện', content: lorem(4200) },
      { title: 'Chương 3: Sơ nhập tiên môn', content: lorem(3900) },
    ],
  },
  {
    title: 'Đô Thị Tuyệt Phẩm Y Tiên', author: 'Diệp Hàn', status: 'published',
    description: 'Trở về thành phố với y thuật cổ truyền siêu phàm, chàng trai trẻ phải đối mặt với quyền quý, ân oán, và những mối tình đầy sóng gió.',
    genres: ['Đô Thị', 'Ngôn Tình'], tags: ['đô thị', 'ngôn tình', 'trọng sinh'],
    chapters: [
      { title: 'Chương 1: Trở về thành phố', content: lorem(3200) },
      { title: 'Chương 2: Cứu người trên phố', content: lorem(4500) },
      { title: 'Chương 3: Gặp lại cố nhân', content: lorem(3800) },
    ],
  },
  {
    title: 'Vạn Cổ Thần Vương', author: 'Mộng Thần', status: 'published',
    description: 'Kiếp trước là đế tôn uy chấn vạn giới, kiếp này trọng sinh làm phế vật thiên tài. Hắn sẽ một bước một bước lấy lại tất cả, đạp tiên ma, phá thần phật.',
    genres: ['Huyền Huyễn', 'Dị Giới'], tags: ['trọng sinh', 'sảng văn', 'huyền huyễn'],
    chapters: [
      { title: 'Chương 1: Trọng sinh phế vật', content: lorem(3600) },
      { title: 'Chương 2: Thức tỉnh huyết mạch', content: lorem(4100) },
    ],
  },
  {
    title: 'Phàm Nhân Tu Tiên Chi Lộ', author: 'Vong Ngữ', status: 'published',
    description: 'Một thiếu niên xuất thân nông thôn, tư chất bình thường, nhưng nhờ kiên trì và cơ duyên mà bước từng bước trên con đường tu tiên đầy chông gai. Câu chuyện kinh điển về phàm nhân tu tiên.',
    genres: ['Tiên Hiệp', 'Huyền Huyễn'], tags: ['tu tiên', 'phàm nhân', 'cơ duyên'],
    chapters: [
      { title: 'Chương 1: Thiếu niên nông thôn', content: lorem(3800) },
      { title: 'Chương 2: Linh căn thử nghiệm', content: lorem(4400) },
      { title: 'Chương 3: Bái nhập tiên môn', content: lorem(3600) },
    ],
  },
  {
    title: 'Kiếm Lai', author: 'Phong Hỏa Hí Chư Hầu', status: 'published',
    description: 'Thiếu niên Trần Bình An mang kiếm đi nghìn dặm, từ trấn nhỏ đến thiên hạ. Một câu chuyện kiếm hiệp đầy thi vị, nhân tình thế thái, và kiếm ý thâm trầm.',
    genres: ['Kiếm Hiệp', 'Tiên Hiệp'], tags: ['kiếm hiệp', 'thi vị', 'nhân tình'],
    chapters: [
      { title: 'Chương 1: Trần Bình An', content: lorem(3400) },
      { title: 'Chương 2: Luyện kiếm', content: lorem(4200) },
      { title: 'Chương 3: Xuất trấn', content: lorem(3900) },
    ],
  },
  {
    title: 'Đấu Phá Thương Khung', author: 'Thiên Tằm Thổ Đậu', status: 'completed',
    description: 'Tiêu Viêm thiên tài sa bại, bị hôn phu thoái hôn. Nhờ được Dược Lão chỉ đạo, hắn một bước một bước lấy lại vinh quang, đỉnh phong đấu khí đại lục.',
    genres: ['Huyền Huyễn', 'Dị Giới'], tags: ['sảng văn', 'đấu khí', 'trọng sinh'],
    chapters: [
      { title: 'Chương 1: Thoái hôn', content: lorem(3700) },
      { title: 'Chương 2: Dược Lão', content: lorem(4300) },
      { title: 'Chương 3: Luyện dược', content: lorem(3800) },
    ],
  },
  {
    title: 'Ngôn Tình: Năm Tháng Yêu Anh', author: 'Mặc Bảo Phi Bảo', status: 'published',
    description: 'Câu chuyện tình yêu ngọt ngào đầy nước mắt của hai người trẻ từ xa cách đến đoàn tụ. Một tác phẩm ngôn tình đô thị lãng mạn, nhẹ nhàng mà sâu lắng.',
    genres: ['Ngôn Tình', 'Đô Thị'], tags: ['ngôn tình', 'tình cảm', 'đô thị'],
    chapters: [
      { title: 'Chương 1: Gặp lại sau bao năm', content: lorem(3200) },
      { title: 'Chương 2: Lời hứa năm xưa', content: lorem(3500) },
    ],
  },
  {
    title: 'Tu Chân Tứ Niên', author: 'Đường Miêu', status: 'published',
    description: 'Bốn năm tu tiên, từ phàm nhân đến kim đan. Một câu chuyện tu tiên hiện đại, khoa học và thực tế, không sảng văn thái quá.',
    genres: ['Tiên Hiệp', 'Đô Thị'], tags: ['tu tiên', 'hiện đại', 'khoa học'],
    chapters: [
      { title: 'Chương 1: Khởi đầu tu tiên', content: lorem(3700) },
      { title: 'Chương 2: Luyện khí kỳ', content: lorem(4200) },
      { title: 'Chương 3: Động thiên phúc địa', content: lorem(3900) },
    ],
  },
  {
    title: 'Linh Vũ Thiên Hạ', author: 'Vũ Phong', status: 'published',
    description: 'Thiếu niên bị diệt môn, mang theo bí mật huyết mạch, một bước một bước trở thành đỉnh cấp cường giả. Linh võ song tu, thiên hạ vô địch.',
    genres: ['Huyền Huyễn', 'Tiên Hiệp'], tags: ['linh võ', 'trọng sinh', 'sảng văn'],
    chapters: [
      { title: 'Chương 1: Diệt môn', content: lorem(3600) },
      { title: 'Chương 2: Huyết mạch thức tỉnh', content: lorem(4400) },
      { title: 'Chương 3: Song tu linh võ', content: lorem(3800) },
    ],
  },
  {
    title: 'Đại Chúa Tể', author: 'Thiên Tằm Thổ Đậu', status: 'published',
    description: 'Trong vạn giới linh lực quay trở về, thiếu niên từ thế tục bước vào đại thế. Muốn bảo vệ người yêu, phải trở thành đại chúa tể.',
    genres: ['Huyền Huyễn', 'Dị Giới'], tags: ['huyền huyễn', 'sảng văn', 'tu luyện'],
    chapters: [
      { title: 'Chương 1: Linh lực quay về', content: lorem(3800) },
      { title: 'Chương 2: Bước vào đại thế', content: lorem(4500) },
      { title: 'Chương 3: Thánh tử tranh phong', content: lorem(3700) },
    ],
  },
  {
    title: 'Toàn Chức Cao Thủ', author: 'Hồ Điệp Lam', status: 'published',
    description: 'Cao thủ game bị sa thải, trở lại game vinh quang năm xưa. Một câu chuyện esports nhiệt huyết, chiến thuật và tình huynh đệ.',
    genres: ['Võng Du', 'Đô Thị'], tags: ['võng du', 'esports', 'nhiệt huyết'],
    chapters: [
      { title: 'Chương 1: Bị sa thải', content: lorem(3400) },
      { title: 'Chương 2: Trở lại game', content: lorem(4100) },
      { title: 'Chương 3: Tổ đội mới', content: lorem(3800) },
    ],
  },
  {
    title: 'Quỷ Bí Chi Chủ', author: 'Ái Tiềm Thủy Đích Ô Tặc', status: 'completed',
    description: 'Thanh niên xuyên không đến thế giới hơi nước và cơ khí, thức tỉnh năng lực siêu phàm. Một câu chuyện huyền bí, tôn giáo, và lý trí.',
    genres: ['Huyền Huyễn', 'Dị Giới'], tags: ['huyền bí', 'hơi nước', 'lý trí'],
    chapters: [
      { title: 'Chương 1: Thức tỉnh', content: lorem(3900) },
      { title: 'Chương 2: Đường phố London', content: lorem(4300) },
      { title: 'Chương 3: Bí ẩn tổ chức', content: lorem(3600) },
    ],
  },
  {
    title: 'Tiên Nghịch', author: 'Nhĩ Căn', status: 'published',
    description: 'Một thiếu niên bình thường bước vào tiên đạo, trải qua muôn vàn khổ nạn. Câu chuyện về đạo tâm, kiên trì, và nghịch thiên cải mệnh.',
    genres: ['Tiên Hiệp', 'Huyền Huyễn'], tags: ['tu tiên', 'nghịch thiên', 'đạo tâm'],
    chapters: [
      { title: 'Chương 1: Thiếu niên Vương Lâm', content: lorem(3700) },
      { title: 'Chương 2: Bái sư', content: lorem(4400) },
      { title: 'Chương 3: Sơ nhập tu đạo', content: lorem(3900) },
    ],
  },
  {
    title: 'Thâm Uyên Minh Chủ', author: 'Ái Tiềm Thủy Đích Ô Tặc', status: 'published',
    description: 'Thế giới quái vật hoành hành, con người tìm đường sống sót. Một thiếu niên bất ngờ trở thành minh chủ của thâm uyên, lãnh đạo muôn loài.',
    genres: ['Huyền Huyễn', 'Dị Giới'], tags: ['thâm uyên', 'quái vật', 'lãnh đạo'],
    chapters: [
      { title: 'Chương 1: Truyền thừa bất ngờ', content: lorem(3800) },
      { title: 'Chương 2: Minh chủ tương lai', content: lorem(4200) },
      { title: 'Chương 3: Liên minh muôn loài', content: lorem(3700) },
    ],
  },
  {
    title: 'Hạo Nhiên Chính Khí', author: 'Ngạo Vô Thường', status: 'published',
    description: 'Một thư sinh mang hạo nhiên chính khí, dùng bút mực chiến đấu với yêu ma. Câu chuyện kiếm hiệp mang đậm văn hóa thư pháp và nho giáo.',
    genres: ['Kiếm Hiệp', 'Huyền Huyễn'], tags: ['thư sinh', 'hạo nhiên', 'nho giáo'],
    chapters: [
      { title: 'Chương 1: Thư sinh nghèo', content: lorem(3500) },
      { title: 'Chương 2: Hạo nhiên chính khí', content: lorem(4100) },
      { title: 'Chương 3: Bút mạch trừ yêu', content: lorem(3800) },
    ],
  },
]

async function upsertDemoUsers(admin: ReturnType<typeof createAdminSupabase>) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error('Không liệt kê được users: ' + error.message)
  const existing = data.users

  const ensure = async (email: string, password: string, role: 'admin' | 'user') => {
    let u = existing.find((x) => x.email === email)
    if (!u) {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (created.error) throw new Error('Không tạo được ' + email + ': ' + created.error.message)
      u = created.data.user
    }
    const { error: profileErr } = await admin.from('profiles').upsert({ id: u!.id, role })
    if (profileErr) throw new Error('Không set role cho ' + email + ': ' + profileErr.message)
    return u
  }

  const a = await ensure('admin@sonovel.app', 'admin123', 'admin')
  const u = await ensure('user@sonovel.app', 'user123', 'user')
  console.log('  admin:', a.email, '| user:', u.email)
}

async function main() {
  const admin = createAdminSupabase()

  console.log('→ Seeding tags...')
  for (const name of TAGS) {
    const { error } = await admin.from('tags').upsert({ name }, { onConflict: 'name' })
    if (error) console.warn('  tag "' + name + '" skipped:', error.message)
  }

  console.log('→ Seeding demo users...')
  await upsertDemoUsers(admin)

  console.log('→ Seeding 15 series + chapters...')
  let chapterCount = 0
  for (let i = 0; i < SERIES.length; i++) {
    const s = SERIES[i]
    const id = seriesUuid(i + 1)
    const { error: seriesErr } = await admin.from('series').upsert({
      id,
      title: s.title,
      author: s.author,
      description: s.description,
      cover_url: '',
      status: s.status,
      genres: s.genres,
      tags: s.tags,
      word_count: 0,
    }, { onConflict: 'id' })
    if (seriesErr) {
      console.warn('  ✗ series "' + s.title + '":', seriesErr.message)
      continue
    }

    for (let o = 0; o < s.chapters.length; o++) {
      const c = s.chapters[o]
      const { error: chErr } = await admin.from('chapters').upsert({
        id: chapterUuid(i + 1, o + 1),
        series_id: id,
        order_no: o + 1,
        title: c.title,
        content: c.content,
        status: 'published',
        published_at: new Date().toISOString(),
        word_count: Math.floor(c.content.length / 5),
      }, { onConflict: 'id' })
      if (chErr) console.warn('  ✗ chapter "' + c.title + '":', chErr.message)
      else chapterCount++
    }
    // trigger chapters_sync_word_count đã tự cập nhật; gọi lại để chắc chắn
    await admin.rpc('recalc_series_word_count', { p_series: id })
    console.log('  ✓', s.title)
  }

  console.log(`✅ Seed done. ${SERIES.length} series, ${chapterCount} chapters.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
