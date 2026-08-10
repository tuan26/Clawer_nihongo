import { NextResponse } from 'next/server';

// Bộ từ điển tĩnh phong phú phục vụ chế độ Offline / Mock AI
const MOCK_DICTIONARY: Record<string, {
  reading: string;
  meaning_vi: string;
  example_ja: string;
  example_vi: string;
  tags: string[];
  relatedWords: string[];
}> = {
  '認識齟齬': {
    reading: 'にんしきそご',
    meaning_vi: 'Khác biệt trong nhận thức, hiểu sai ý nhau',
    example_ja: '両者の認識齟齬を解消する必要があります。',
    example_vi: 'Cần giải quyết sự khác biệt trong nhận thức giữa hai bên.',
    tags: ['Công việc', 'N1', 'Giao tiếp'],
    relatedWords: ['認識する', '齟齬', '意思疎通']
  },
  '取りまとめる': {
    reading: 'とりまとめる',
    meaning_vi: 'Thu thập, gom lại, sắp xếp gọn gàng, đúc kết',
    example_ja: '来週までに会議の意見を取りまとめる予定です。',
    example_vi: 'Tôi dự kiến sẽ tổng hợp các ý kiến của cuộc họp trước tuần tới.',
    tags: ['Công việc', 'N1'],
    relatedWords: ['まとめる', '収集する', '整理する']
  },
  'あいにく': {
    reading: 'あいにく',
    meaning_vi: 'Không may, thật tiếc là',
    example_ja: 'あいにく本日は担当者が不在にしております。',
    example_vi: 'Thật tiếc là hôm nay người phụ trách của chúng tôi lại vắng mặt.',
    tags: ['Giao tiếp', 'Đời sống'],
    relatedWords: ['残念ながら', '折悪しく']
  },
  '見落とす': {
    reading: 'みおとす',
    meaning_vi: 'Bỏ sót, nhìn sót, không chú ý tới',
    example_ja: 'メールの重要事項を見落としてしまいました。',
    example_vi: 'Tôi đã vô tình bỏ sót một điều khoản quan trọng trong email.',
    tags: ['Công việc', 'N1', 'Đời sống'],
    relatedWords: ['見失う', '見逃す', 'エラー']
  },
  '差し支えない': {
    reading: 'さしつかえない',
    meaning_vi: 'Không có trở ngại, không sao, có thể được',
    example_ja: '差し支えなければ、理由を教えてください。',
    example_vi: 'Nếu không có gì trở ngại, xin vui lòng cho tôi biết lý do.',
    tags: ['Công việc', 'Giao tiếp', 'N1'],
    relatedWords: ['問題ない', '構わない', '大丈夫']
  },
  '意思疎通': {
    reading: 'いしそつう',
    meaning_vi: 'Hiểu nhau, thông tin liên lạc thông suốt',
    example_ja: 'チーム内での意思疎通が不十分だとトラブルの原因になります。',
    example_vi: 'Sự thông hiểu ý kiến trong nội bộ nhóm không đầy đủ sẽ là nguyên nhân gây ra rắc rối.',
    tags: ['Công việc', 'Giao tiếp'],
    relatedWords: ['コミュニケーション', '認識齟齬', '理解']
  },
  '対応方針': {
    reading: 'たいおうほうしん',
    meaning_vi: 'Phương châm đối phó, hướng xử lý, đối sách',
    example_ja: 'この課題に対する当社の対応方針をご説明します。',
    example_vi: 'Tôi xin phép được giải thích phương châm đối phó của công ty chúng tôi đối với vấn đề này.',
    tags: ['Công việc'],
    relatedWords: ['対策', '解決策', '対応策']
  },
  '影響範囲': {
    reading: 'えいきょうはんい',
    meaning_vi: 'Phạm vi ảnh hưởng, mức độ ảnh hưởng',
    example_ja: 'システム変更に伴う影響範囲を調査する。',
    example_vi: 'Điều tra phạm vi ảnh hưởng đi kèm với việc thay đổi hệ thống.',
    tags: ['Công việc', 'N1'],
    relatedWords: ['影響', '及ぼす', '範囲']
  },
  '折り返し': {
    reading: 'おりかえし',
    meaning_vi: 'Gọi lại / phản hồi lại ngay',
    example_ja: '後ほど担当者より折り返しご連絡いたします。',
    example_vi: 'Người phụ trách sẽ liên hệ phản hồi lại cho anh/chị sau.',
    tags: ['Công việc', 'Giao tiếp'],
    relatedWords: ['折り返し電話', '連絡']
  },
  '取り急ぎ': {
    reading: 'とりいそぎ',
    meaning_vi: 'Trước mắt / vội vàng (dùng trong email thông báo nhanh)',
    example_ja: '取り急ぎのご報告まで。',
    example_vi: 'Tôi xin phép gửi báo cáo nhanh trước mắt là như vậy.',
    tags: ['Công việc', 'Giao tiếp'],
    relatedWords: ['まず第一に', '取り急ぎ連絡']
  },
  '念のため': {
    reading: 'ねんのため',
    meaning_vi: 'Để cho chắc chắn, phòng xa',
    example_ja: '念のため、スケジュールを再確認しておきます。',
    example_vi: 'Để cho chắc chắn, tôi sẽ kiểm tra lại lịch trình lần nữa.',
    tags: ['Công việc', 'Giao tiếp'],
    relatedWords: ['確認', '念を入れる']
  },
  '周知': {
    reading: 'しゅうち',
    meaning_vi: 'Thông báo rộng rãi, cho mọi người cùng biết',
    example_ja: '新 rù ru を全社に周知徹底する。',
    example_vi: 'Quán triệt thông báo quy định mới rộng rãi tới toàn công ty.',
    tags: ['Công việc', 'N1'],
    relatedWords: ['周知徹底', 'お知らせ']
  },
  '懸念': {
    reading: 'けねん',
    meaning_vi: 'E ngại, quan ngại, lo lắng',
    example_ja: 'スケジュール遅延の懸念があります。',
    example_vi: 'Có sự quan ngại về việc chậm trễ lịch trình.',
    tags: ['Công việc', 'N1'],
    relatedWords: ['懸念点', '心配', '不安']
  },
  '妥協': {
    reading: 'だきょう',
    meaning_vi: 'Thỏa hiệp, nhượng bộ',
    example_ja: '品質に関しては一切妥協しません。',
    example_vi: 'Về mặt chất lượng, chúng tôi tuyệt đối không thỏa hiệp.',
    tags: ['Công việc', 'N1'],
    relatedWords: ['妥協案', '歩み寄る']
  },
  '考慮': {
    reading: 'こうりょ',
    meaning_vi: 'Xem xét, cân nhắc',
    example_ja: '相手の me rrit mo 考慮して提案する。',
    example_vi: 'Đưa ra đề xuất có cân nhắc đến lợi ích của đối phương.',
    tags: ['Công việc', 'N1'],
    relatedWords: ['考慮に入れる', '検討']
  },
  '慎重': {
    reading: 'しんちょう',
    meaning_vi: 'Thận trọng, cẩn thận',
    example_ja: 'この件は慎重に対応する必要があります。',
    example_vi: 'Vụ việc này cần phải ứng phó một cách thận trọng.',
    tags: ['Công việc', 'N1'],
    relatedWords: ['慎重を期す', '丁寧']
  },
  '根回し': {
    reading: 'ねまわし',
    meaning_vi: 'Vận động hành lang, trao đổi trước với các bên',
    example_ja: '会議をスムーズに進めるために事前に根回しをする。',
    example_vi: 'Trao đổi trước với các bên liên quan để cuộc họp tiến triển mượt mà.',
    tags: ['Công việc', 'N1', 'Giao tiếp'],
    relatedWords: ['事前交渉', '下準備']
  }
};

export async function POST(request: Request) {
  try {
    const { word, words } = await request.json();
    
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Chế độ phân tích nhiều từ cùng lúc
    if (words && Array.isArray(words)) {
      const results = [];
      for (const w of words) {
        if (!w.trim()) continue;
        const analysis = await analyzeWord(w.trim(), geminiKey, openaiKey);
        results.push(analysis);
      }
      return NextResponse.json({ success: true, data: results });
    }

    // Chế độ phân tích một từ
    if (!word || !word.trim()) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp từ cần phân tích' }, { status: 400 });
    }

    const analysis = await analyzeWord(word.trim(), geminiKey, openaiKey);
    return NextResponse.json({ success: true, data: analysis });

  } catch (error: any) {
    console.error('Lỗi API analyze:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
  }
}

async function analyzeWord(word: string, geminiKey?: string, openaiKey?: string) {
  // 1. Kiểm tra trong bộ từ điển tĩnh trước
  if (MOCK_DICTIONARY[word]) {
    return {
      word,
      ...MOCK_DICTIONARY[word],
      isMock: false
    };
  }

  const promptText = `
  Hãy phân tích từ vựng hoặc cụm từ tiếng Nhật sau: "${word}".
  Hãy trả về một đối tượng JSON duy nhất chứa các thông tin sau (sử dụng ngôn ngữ tiếng Việt để giải thích nghĩa):
  {
    "word": "${word}",
    "reading": "cách đọc chữ Hán bằng Hiragana hoặc Katakana tương ứng",
    "meaning_vi": "nghĩa tiếng Việt chính xác, tự nhiên, ngắn gọn",
    "example_ja": "một câu ví dụ tiếng Nhật thực tế, tự nhiên có chứa từ này",
    "example_vi": "dịch nghĩa câu ví dụ sang tiếng Việt",
    "tags": ["danh sách 1-3 tag phù hợp trong các lựa chọn: 'Công việc', 'N1', 'Giao tiếp', 'Đọc báo', 'Đời sống'"],
    "relatedWords": ["2-3 từ vựng liên quan, đồng nghĩa hoặc trái nghĩa"]
  }
  Chỉ trả về chuỗi JSON thô, không bao gồm ký hiệu markdown \`\`\`json \`\`\`, không giải thích gì thêm ngoài JSON.
  `;

  // 2. Sử dụng OpenAI nếu có Key
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptText }],
          response_format: { type: 'json_object' }
        })
      });

      const resJson = await response.json();
      const content = resJson.choices[0].message.content;
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi khi gọi OpenAI API, chuyển sang mock:', e);
    }
  }

  // 3. Sử dụng Gemini nếu có Key
  if (geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      const resJson = await response.json();
      const content = resJson.candidates[0].content.parts[0].text;
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi khi gọi Gemini API, chuyển sang mock:', e);
    }
  }

  // 4. Fallback về Mock AI
  const cleanWord = word.trim();
  return {
    word: cleanWord,
    reading: 'Đang chờ API Key',
    meaning_vi: `Nghĩa của "${cleanWord}" (Chưa cấu hình API Key trên Server để phân tích tự động)`,
    example_ja: `${cleanWord}を使用します。`,
    example_vi: `Sử dụng từ "${cleanWord}". (Mock)`,
    tags: ['N1'],
    relatedWords: [],
    isMock: true
  };
}
