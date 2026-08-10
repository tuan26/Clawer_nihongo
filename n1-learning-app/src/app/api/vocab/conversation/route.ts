import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { vocabItems } = await request.json();
    if (!vocabItems || !Array.isArray(vocabItems) || vocabItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có dữ liệu từ vựng để tạo đoạn hội thoại' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 1. Sử dụng AI (OpenAI hoặc Gemini) nếu có API Key
    if (openaiKey || geminiKey) {
      const vocabListStr = vocabItems.map(v => `${v.word} (${v.reading}): ${v.meaning_vi}`).join('\n');
      
      const promptText = `
      Hãy tạo một đoạn hội thoại ngắn, tự nhiên (khoảng 4-6 câu thoại) giữa 2 người đồng nghiệp hoặc bạn bè bằng tiếng Nhật có sử dụng các từ vựng sau đây để người học biết cách áp dụng chúng vào thực tế:
      ${vocabListStr}
      
      Yêu cầu kết quả trả về là một đối tượng JSON duy nhất có cấu trúc như sau (không kèm định dạng markdown hay bất kỳ văn bản giải thích nào khác):
      {
        "title": "Tiêu đề đoạn hội thoại bằng tiếng Việt (ví dụ: Trao đổi về lỗi trong dự án)",
        "context": "Mô tả bối cảnh ngắn bằng tiếng Việt",
        "dialogue": [
          {
            "speaker": "Tên nhân vật (ví dụ: Tanaka)",
            "japanese": "Câu thoại bằng tiếng Nhật (in đậm các từ vựng trong danh sách trên nếu xuất hiện)",
            "reading": "Cách đọc câu thoại bằng Hiragana hoặc Romaji",
            "vietnamese": "Dịch nghĩa câu thoại sang tiếng Việt"
          }
        ]
      }
      Chỉ trả về JSON thô.
      `;

      // Gọi OpenAI
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
          return NextResponse.json({ success: true, data: JSON.parse(content) });
        } catch (e) {
          console.error('Lỗi OpenAI Conversation:', e);
        }
      }

      // Gọi Gemini
      if (geminiKey) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          });
          const resJson = await response.json();
          const content = resJson.candidates[0].content.parts[0].text;
          return NextResponse.json({ success: true, data: JSON.parse(content) });
        } catch (e) {
          console.error('Lỗi Gemini Conversation:', e);
        }
      }
    }

    // 2. Fallback đoạn hội thoại mock chất lượng cao (Offline template)
    // Tạo hội thoại ghép từ các ví dụ thực tế của các từ vựng
    const lines = vocabItems.map((item, idx) => {
      const speakers = ['Tanaka', 'Yamada'];
      const speaker = speakers[idx % 2];
      return {
        speaker,
        japanese: item.example_ja || `${item.word}について話しましょう。`,
        reading: item.reading || '',
        vietnamese: item.example_vi || `Chúng ta hãy nói về ${item.word}.`
      };
    });

    const mockData = {
      title: 'Trao đổi từ vựng trong ngày (Chế độ Offline)',
      context: 'Cuộc trò chuyện ngắn sử dụng các từ vựng bạn vừa học hôm nay.',
      dialogue: lines
    };

    return NextResponse.json({ success: true, data: mockData, isMock: true });

  } catch (error: any) {
    console.error('Lỗi API conversation:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
  }
}
