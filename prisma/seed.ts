// SoNovel — seed script: tags, 3 series + 8 chapters, demo admin + user
// Run: bun run prisma/seed.ts

import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'
import { recalcSeriesWordCount, chapterWordCount } from '../src/lib/sonovel'

const TAGS = [
  'hệ thống', 'xuyên không', 'sảng văn', 'ngôn tình', 'kiếm hiệp',
  'tiên hiệp', 'đô thị', 'huyền huyễn', 'đồng nhân', 'dị giới',
  'võng du', 'trọng sinh', 'làm ruộng', 'xây dựng', 'tình cảm',
]

const GENRES = ['Tiên Hiệp', 'Kiếm Hiệp', 'Ngôn Tình', 'Đô Thị', 'Huyền Huyễn', 'Dị Giới', 'Sảng Văn', 'Trọng Sinh']

function lorem(n: number): string {
  const base = 'Trong khu vườn phía sau tòa viện, ánh trăng nhạt nhòa chiếu xuống mặt đất. Một bóng người mặc áo xanh đứng lặng im, tay cầm một thanh kiếm dài, kiếm khí lạnh lẽo tỏa ra bốn phía. Gió đêm thổi qua, mang theo hương hoa quế thoang thoảng, khiến tâm trí hắn dần dần bình tĩnh lại. Hắn nhớ lại những năm tháng tu luyện vất vả, nhớ lại những trận chiến sinh tử, nhớ lại những người bạn đã ngã xuống trên con đường tu tiên. Mỗi bước đi đều đầy máu và nước mắt, nhưng hắn không hề hối hận. Bởi vì hắn biết, chỉ có kiên trì tiến tới, mới có thể đạt tới đỉnh phong của đại đạo, mới có thể bảo vệ những người hắn yêu thương. '
  let s = ''
  while (s.length < n) s += base
  return s.slice(0, n)
}

async function main() {
  console.log('→ Seeding tags...')
  for (const name of TAGS) {
    await db.tag.upsert({ where: { name }, update: {}, create: { name } })
  }

  console.log('→ Seeding demo users...')
  const adminPass = hashPassword('admin123')
  const userPass = hashPassword('user123')
  const admin = await db.profile.upsert({
    where: { email: 'admin@sonovel.app' },
    update: { role: 'admin', passwordHash: adminPass },
    create: { id: 'admin-demo', email: 'admin@sonovel.app', role: 'admin', passwordHash: adminPass },
  })
  const user = await db.profile.upsert({
    where: { email: 'user@sonovel.app' },
    update: { passwordHash: userPass },
    create: { id: 'user-demo', email: 'user@sonovel.app', role: 'user', passwordHash: userPass },
  })
  console.log('  admin:', admin.email, '| user:', user.email)

  console.log('→ Seeding 3 series + 8 chapters...')
  const seriesData = [
    {
      id: 'series-0001',
      title: 'Trường Sinh Chi Lộ',
      author: 'Ngạo Thiên',
      description: 'Một thiếu niên bình thường vô tình nhặt được cuốn cổ thư, từ đó bước lên con đường tu tiên đầy chông gai. Hắn sẽ đối mặt với ma đạo, tiên môn, và bí ẩn về nguồn gốc của chính mình.',
      coverUrl: '',
      status: 'published',
      genres: ['Tiên Hiệp', 'Huyền Huyễn'],
      tags: ['tu tiên', 'trọng sinh', 'sảng văn'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Cổ thư kỳ lạ', content: lorem(3500), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Bước đầu tu luyện', content: lorem(4200), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Sơ nhập tiên môn', content: lorem(3900), status: 'published' },
      ],
    },
    {
      id: 'series-0002',
      title: 'Đô Thị Tuyệt Phẩm Y Tiên',
      author: 'Diệp Hàn',
      description: 'Trở về thành phố với y thuật cổ truyền siêu phàm, chàng trai trẻ phải đối mặt với quyền quý, ân oán, và những mối tình đầy sóng gió.',
      coverUrl: '',
      status: 'published',
      genres: ['Đô Thị', 'Ngôn Tình'],
      tags: ['đô thị', 'ngôn tình', 'trọng sinh'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Trở về thành phố', content: lorem(3200), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Cứu người trên phố', content: lorem(4500), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Gặp lại cố nhân', content: lorem(3800), status: 'published' },
      ],
    },
    {
      id: 'series-0003',
      title: 'Vạn Cổ Thần Vương',
      author: 'Mộng Thần',
      description: 'Kiếp trước là đế tôn uy chấn vạn giới, kiếp này trọng sinh làm phế vật thiên tài. Hắn sẽ một bước một bước lấy lại tất cả, đạp tiên ma, phá thần phật.',
      coverUrl: '',
      status: 'published',
      genres: ['Huyền Huyễn', 'Dị Giới'],
      tags: ['trọng sinh', 'sảng văn', 'huyền huyễn'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Trọng sinh phế vật', content: lorem(3600), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Thức tỉnh huyết mạch', content: lorem(4100), status: 'published' },
      ],
    },
    {
      id: 'series-0004',
      title: 'Phàm Nhân Tu Tiên Chi Lộ',
      author: 'Vong Ngữ',
      description: 'Một thiếu niên xuất thân nông thôn, tư chất bình thường, nhưng nhờ kiên trì và cơ duyên mà bước từng bước trên con đường tu tiên đầy chông gai. Câu chuyện kinh điển về phàm nhân tu tiên.',
      coverUrl: '',
      status: 'published',
      genres: ['Tiên Hiệp', 'Huyền Huyễn'],
      tags: ['tu tiên', 'phàm nhân', 'cơ duyên'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Thiếu niên nông thôn', content: lorem(3800), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Linh căn thử nghiệm', content: lorem(4400), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Bái nhập tiên môn', content: lorem(3600), status: 'published' },
      ],
    },
    {
      id: 'series-0005',
      title: 'Kiếm Lai',
      author: 'Phong Hỏa Hí Chư Hầu',
      description: 'Thiếu niên Trần Bình An mang kiếm đi nghìn dặm, từ trấn nhỏ đến thiên hạ. Một câu chuyện kiếm hiệp đầy thi vị, nhân tình thế thái, và kiếm ý thâm trầm.',
      coverUrl: '',
      status: 'published',
      genres: ['Kiếm Hiệp', 'Tiên Hiệp'],
      tags: ['kiếm hiệp', 'thi vị', 'nhân tình'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Trần Bình An', content: lorem(3400), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Luyện kiếm', content: lorem(4200), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Xuất trấn', content: lorem(3900), status: 'published' },
      ],
    },
    {
      id: 'series-0006',
      title: 'Đấu Phá Thương Khung',
      author: 'Thiên Tằm Thổ Đậu',
      description: 'Tiêu Viêm thiên tài sa bại, bị hôn phu thoái hôn. Nhờ được Dược Lão chỉ đạo, hắn một bước một bước lấy lại vinh quang, đỉnh phong đấu khí đại lục.',
      coverUrl: '',
      status: 'completed',
      genres: ['Huyền Huyễn', 'Dị Giới'],
      tags: ['sảng văn', 'đấu khí', 'trọng sinh'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Thoái hôn', content: lorem(3700), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Dược Lão', content: lorem(4300), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Luyện dược', content: lorem(3800), status: 'published' },
      ],
    },
    {
      id: 'series-0007',
      title: 'Ngôn Tình: Năm Tháng Yêu Anh',
      author: 'Mặc Bảo Phi Bảo',
      description: 'Câu chuyện tình yêu ngọt ngào đầy nước mắt của hai người trẻ từ xa cách đến đoàn tụ. Một tác phẩm ngôn tình đô thị lãng mạn, nhẹ nhàng mà sâu lắng.',
      coverUrl: '',
      status: 'published',
      genres: ['Ngôn Tình', 'Đô Thị'],
      tags: ['ngôn tình', 'tình cảm', 'đô thị'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Gặp lại sau bao năm', content: lorem(3200), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Lời hứa năm xưa', content: lorem(3500), status: 'published' },
      ],
    },
    {
      id: 'series-0008',
      title: 'Tu Chân Tứ Niên',
      author: 'Đường Miêu',
      description: 'Bốn năm tu tiên, từ phàm nhân đến kim đan. Một câu chuyện tu tiên hiện đại, khoa học và thực tế, không sảng văn thái quá.',
      coverUrl: '',
      status: 'published',
      genres: ['Tiên Hiệp', 'Đô Thị'],
      tags: ['tu tiên', 'hiện đại', 'khoa học'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Khởi đầu tu tiên', content: lorem(3700), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Luyện khí kỳ', content: lorem(4200), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Động thiên phúc địa', content: lorem(3900), status: 'published' },
      ],
    },
    {
      id: 'series-0009',
      title: 'Linh Vũ Thiên Hạ',
      author: 'Vũ Phong',
      description: 'Thiếu niên bị diệt môn, mang theo bí mật huyết mạch, một bước một bước trở thành đỉnh cấp cường giả. Linh võ song tu, thiên hạ vô địch.',
      coverUrl: '',
      status: 'published',
      genres: ['Huyền Huyễn', 'Tiên Hiệp'],
      tags: ['linh võ', 'trọng sinh', 'sảng văn'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Diệt môn', content: lorem(3600), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Huyết mạch thức tỉnh', content: lorem(4400), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Song tu linh võ', content: lorem(3800), status: 'published' },
      ],
    },
    {
      id: 'series-0010',
      title: 'Đại Chúa Tể',
      author: 'Thiên Tằm Thổ Đậu',
      description: 'Trong vạn giới linh lực quay trở về, thiếu niên từ thế tục bước vào đại thế. Muốn bảo vệ người yêu, phải trở thành đại chúa tể.',
      coverUrl: '',
      status: 'published',
      genres: ['Huyền Huyễn', 'Dị Giới'],
      tags: ['huyền huyễn', 'sảng văn', 'tu luyện'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Linh lực quay về', content: lorem(3800), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Bước vào đại thế', content: lorem(4500), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Thánh tử tranh phong', content: lorem(3700), status: 'published' },
      ],
    },
    {
      id: 'series-0011',
      title: 'Toàn Chức Cao Thủ',
      author: 'Hồ Điệp Lam',
      description: 'Cao thủ game bị sa thải, trở lại game vinh quang năm xưa. Một câu chuyện esports nhiệt huyết, chiến thuật và tình huynh đệ.',
      coverUrl: '',
      status: 'published',
      genres: ['Võng Du', 'Đô Thị'],
      tags: ['võng du', 'esports', 'nhiệt huyết'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Bị sa thải', content: lorem(3400), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Trở lại game', content: lorem(4100), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Tổ đội mới', content: lorem(3800), status: 'published' },
      ],
    },
    {
      id: 'series-0012',
      title: 'Quỷ Bí Chi Chủ',
      author: 'Ái Tiềm Thủy Đích Ô Tặc',
      description: 'Thanh niên xuyên không đến thế giới hơi nước và cơ khí, thức tỉnh năng lực siêu phàm. Một câu chuyện huyền bí, tôn giáo, và lý trí.',
      coverUrl: '',
      status: 'completed',
      genres: ['Huyền Huyễn', 'Dị Giới'],
      tags: ['huyền bí', 'hơi nước', 'lý trí'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Thức tỉnh', content: lorem(3900), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Đường phố London', content: lorem(4300), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Bí ẩn tổ chức', content: lorem(3600), status: 'published' },
      ],
    },
    {
      id: 'series-0013',
      title: 'Tiên Nghịch',
      author: 'Nhĩ Căn',
      description: 'Một thiếu niên bình thường bước vào tiên đạo, trải qua muôn vàn khổ nạn. Câu chuyện về đạo tâm, kiên trì, và nghịch thiên cải mệnh.',
      coverUrl: '',
      status: 'published',
      genres: ['Tiên Hiệp', 'Huyền Huyễn'],
      tags: ['tu tiên', 'nghịch thiên', 'đạo tâm'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Thiếu niên Vương Lâm', content: lorem(3700), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Bái sư', content: lorem(4400), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Sơ nhập tu đạo', content: lorem(3900), status: 'published' },
      ],
    },
    {
      id: 'series-0014',
      title: 'Thâm Uyên Minh Chủ',
      author: 'Ái Tiềm Thủy Đích Ô Tặc',
      description: 'Thế giới quái vật hoành hành, con người tìm đường sống sót. Một thiếu niên bất ngờ trở thành minh chủ của thâm uyên, lãnh đạo muôn loài.',
      coverUrl: '',
      status: 'published',
      genres: ['Huyền Huyễn', 'Dị Giới'],
      tags: ['thâm uyên', 'quái vật', 'lãnh đạo'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Truyền thừa bất ngờ', content: lorem(3800), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Minh chủ tương lai', content: lorem(4200), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Liên minh muôn loài', content: lorem(3700), status: 'published' },
      ],
    },
    {
      id: 'series-0015',
      title: 'Hạo Nhiên Chính Khí',
      author: 'Ngạo Vô Thường',
      description: 'Một thư sinh mang hạo nhiên chính khí, dùng bút mực chiến đấu với yêu ma. Câu chuyện kiếm hiệp mang đậm văn hóa thư pháp và nho giáo.',
      coverUrl: '',
      status: 'published',
      genres: ['Kiếm Hiệp', 'Huyền Huyễn'],
      tags: ['thư sinh', 'hạo nhiên', 'nho giáo'],
      chapters: [
        { orderNo: 1, title: 'Chương 1: Thư sinh nghèo', content: lorem(3500), status: 'published' },
        { orderNo: 2, title: 'Chương 2: Hạo nhiên chính khí', content: lorem(4100), status: 'published' },
        { orderNo: 3, title: 'Chương 3: Bút mạch trừ yêu', content: lorem(3800), status: 'published' },
      ],
    },
  ]

  for (const s of seriesData) {
    const { chapters, genres, tags, ...rest } = s
    await db.series.upsert({
      where: { id: s.id },
      update: {
        ...rest,
        genres: JSON.stringify(genres),
        tags: JSON.stringify(tags),
      },
      create: {
        ...rest,
        id: s.id,
        genres: JSON.stringify(genres),
        tags: JSON.stringify(tags),
      },
    })
    for (const c of chapters) {
      await db.chapter.upsert({
        where: { seriesId_orderNo: { seriesId: s.id, orderNo: c.orderNo } },
        update: {
          title: c.title,
          content: c.content,
          status: c.status,
          wordCount: chapterWordCount(c.content),
          publishedAt: c.status === 'published' ? new Date() : null,
        },
        create: {
          seriesId: s.id,
          orderNo: c.orderNo,
          title: c.title,
          content: c.content,
          status: c.status,
          wordCount: chapterWordCount(c.content),
          publishedAt: c.status === 'published' ? new Date() : null,
        },
      })
    }
    await recalcSeriesWordCount(s.id)
    console.log('  ✓', s.title)
  }

  console.log('✅ Seed done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
