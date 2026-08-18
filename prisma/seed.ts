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
