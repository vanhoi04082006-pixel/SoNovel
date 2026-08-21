-- =====================================================================
-- SoNovel — D1 seed (port từ supabase/schema.sql §5.6)
-- =====================================================================

-- 15 tag mặc định
INSERT INTO tags (id, name) VALUES
  ('90000000-0000-0000-0000-000000000001', 'hệ thống'),
  ('90000000-0000-0000-0000-000000000002', 'xuyên không'),
  ('90000000-0000-0000-0000-000000000003', 'sảng văn'),
  ('90000000-0000-0000-0000-000000000004', 'ngôn tình'),
  ('90000000-0000-0000-0000-000000000005', 'kiếm hiệp'),
  ('90000000-0000-0000-0000-000000000006', 'tiên hiệp'),
  ('90000000-0000-0000-0000-000000000007', 'đô thị'),
  ('90000000-0000-0000-0000-000000000008', 'huyền huyễn'),
  ('90000000-0000-0000-0000-000000000009', 'đồng nhân'),
  ('90000000-0000-0000-0000-000000000010', 'dị giới'),
  ('90000000-0000-0000-0000-000000000011', 'võng du'),
  ('90000000-0000-0000-0000-000000000012', 'trọng sinh'),
  ('90000000-0000-0000-0000-000000000013', 'làm ruộng'),
  ('90000000-0000-0000-0000-000000000014', 'xây dựng'),
  ('90000000-0000-0000-0000-000000000015', 'tình cảm')
ON CONFLICT (name) DO NOTHING;

-- 3 bộ truyện mẫu (genres/tags là JSON array)
INSERT INTO series (id, title, author, description, cover_url, status, genres, tags, word_count) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Hệ Thống Toàn Năng', 'Nguyễn Văn A',
   'Câu chuyện về một thanh niên vô tình nhận được hệ thống toàn năng, từ đó cuộc đời thay đổi hoàn toàn. Hành trình từ kẻ vô danh trở thành đỉnh phong.',
   '', 'published', '["huyền huyễn","xuyên không"]', '["hệ thống","sảng văn"]', 0),
  ('00000000-0000-0000-0000-000000000002', 'Tiên Đế Trọng Sinh', 'Trần Thị B',
   'Tiên đế bị phản bội, trọng sinh trở về tuổi 16, mang theo ký ức tiền kiếp lập lại con đường tu tiên. Lần này sẽ không để lịch sử lặp lại.',
   '', 'published', '["tiên hiệp","huyền huyễn"]', '["trọng sinh","tiên hiệp"]', 0),
  ('00000000-0000-0000-0000-000000000003', 'Nông Môn Phú Thê', 'Lê Văn C',
   'Cô gái hiện đại xuyên về thời cổ đại làm con dâu nông môn, dùng tri thức y học và nấu ăn để làm giàu cho gia đình. Câu chuyện ấm áp về tình thân và nỗ lực.',
   '', 'published', '["ngôn tình","đô thị"]', '["xuyên không","làm ruộng","ngôn tình"]', 0)
ON CONFLICT (id) DO NOTHING;

-- 8 chương mẫu
INSERT INTO chapters (id, series_id, order_no, title, content, status, published_at, word_count) VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1,
   'Chương 1: Hệ Thống Giáng Lâm',
   'Trần Minh đang ngồi trong phòng trọ chật hẹp, bỗng nhiên một tiếng điện tử vang lên trong đầu: "Hệ thống toàn năng đã kích hoạt". Cậu ta mở tròn mắt, không hiểu chuyện gì đang xảy ra. Trên không trung hiện lên một bảng thông tin màu xanh lục, liệt kê các nhiệm vụ và phần thưởng. Cuộc đời cậu đã bước sang một trang mới.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 2,
   'Chương 2: Nhiệm Vụ Đầu Tiên',
   '"Nhiệm vụ: Đi dạo 1000 bước. Phần thưởng: 100 điểm kinh nghiệm." Trần Minh mỉm cười, đây đúng là cơ hội để thay đổi cuộc đời. Cậu xách giày bước ra ngoài, lòng háo hức khó tả. Mỗi bước đi, mỗi hy vọng mới mở ra trước mắt. Thành phố về đêm nhộn nhịp hơn cậu tưởng.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 3,
   'Chương 3: Cửa Hệ Thống',
   'Sau khi hoàn thành nhiệm vụ, Trần Minh mở được cửa hàng hệ thống. Đủ mọi loại vật phẩm: từ thuốc tăng lực, sách kỹ năng, đến vũ khí thần kỳ. Tuy nhiên giá đều tính bằng điểm kinh nghiệm, thứ mà cậu chưa có nhiều. Cậu quyết định tập trung làm nhiệm vụ để tích lũy.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0),
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 1,
   'Chương 1: Trọng Sinh',
   'Tiên đế Lâm Phong mở mắt, nhận ra mình đã trở lại tuổi mười sáu. Ký ức tiền kiếp còn nguyên vẹn: bị đệ tử phản bội, bị bạn bè hãm hại, mất cả tu vi và tánh mệnh. Lần này, hắn sẽ không để lịch sử lặp lại. Hắn nắm chặt tay, ánh mắt lạnh như băng.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 2,
   'Chương 2: Luyện Khí',
   'Lâm Phong bắt đầu tu luyện lại từ đầu. Với kinh nghiệm tiên đế, hắn tránh được mọi sai lầm phổ thông mà đệ tử mới thường mắc phải. Chỉ trong ba ngày, đã đạt tới cảnh giới luyện khí tầng chín, tốc độ mà thiên tài tông môn cũng phải kinh ngạc. Sư phụ hắn không khỏi nghi ngờ.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0),
  ('22222222-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 3,
   'Chương 3: Báo Thù',
   'Trở lại tông môn, Lâm Phong gặp lại kẻ đã phản bội mình kiếp trước. Hắn không vội, chỉ mỉm cười lạnh. Cuộc trả thù này, hắn đã lên kế hoạch từ kiếp trước, từng bước một sẽ khiến kẻ thù phải trả giá đắt. Hắn bước đi thong thả, lòng dạ sắt đá.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0),
  ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 1,
   'Chương 1: Xuyên Không',
   'Lê Thu Hà mở mắt, thấy mình nằm trên một chiếc giường gỗ cũ kỹ, xung quanh là vách đất và mái tranh. Cô kinh ngạc nhận ra: mình đã xuyên không về thời cổ đại, trở thành cô dâu mới về nhà nông môn họ Trần. Tiếng gà gáy bên ngoài báo hiệu một ngày mới bắt đầu.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0),
  ('33333333-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 2,
   'Chương 2: Khởi Đầu Mới',
   'Nhà họ Trần nghèo nhưng ấm áp. Chồng cô, Trần Văn Đức, hiền lành chất phác, chăm chỉ làm ruộng. Thu Hà quyết định dùng kiến thức y học và nấu ăn hiện đại để cải thiện cuộc sống, dần dần làm giàu cho gia đình. Bữa tối đầu tiên cô nấu khiến cả nhà phải trầm trồ.',
   'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 0)
ON CONFLICT (id) DO NOTHING;

-- Tính word_count cho chapters (giống trigger recalc trong Postgres)
UPDATE chapters SET word_count = length(content) / 5 WHERE word_count = 0;

-- Tính lại series.word_count = tổng word_count chương published
UPDATE series SET word_count = COALESCE((
  SELECT SUM(word_count) FROM chapters WHERE series_id = series.id AND status = 'published'
), 0);