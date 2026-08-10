import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { vocabItems } = await request.json();
    if (!vocabItems || !Array.isArray(vocabItems) || vocabItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có dữ liệu từ vựng để tạo Quiz' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 1. Sử dụng AI (OpenAI hoặc Gemini) để tạo Quiz chất lượng cao nếu có API Key
    if (openaiKey || geminiKey) {
      const vocabListStr = vocabItems.map(v => `${v.word} (${v.reading}): ${v.meaning_vi}. Ví dụ: ${v.example_ja || ''}`).join('\n');
      
      const promptText = `
      Hãy tạo ra một bộ câu hỏi trắc nghiệm (Quiz) gồm 3-5 câu để kiểm tra khả năng ghi nhớ và sử dụng các từ vựng tiếng Nhật sau đây:
      ${vocabListStr}
      
      Hãy tạo ra các câu hỏi dưới dạng: điền từ thích hợp vào chỗ trống trong câu tiếng Nhật hoặc lựa chọn nghĩa đúng của từ trong ngữ cảnh.
      Trả về một mảng JSON các câu hỏi theo đúng cấu trúc dưới đây (không kèm định dạng markdown hay bất kỳ văn bản giải thích nào khác):
      [
        {
          "question": "Nội dung câu hỏi bằng tiếng Nhật (Ví dụ: 会議の意見を＿＿＿＿＿＿＿ための資料を作成する。)",
          "options": ["đáp án 1", "đáp án 2", "đáp án 3", "đáp án 4"],
          "correctIndex": 0, // số nguyên từ 0 đến 3 chỉ vị trí đáp án đúng
          "explain": "Giải thích chi tiết tại sao chọn đáp án đó bằng tiếng Việt"
        }
      ]
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
          const questions = JSON.parse(content);
          // Đảm bảo là mảng hoặc lấy mảng từ object
          const quizData = Array.isArray(questions) ? questions : (questions.questions || questions.quiz || []);
          return NextResponse.json({ success: true, data: quizData });
        } catch (e) {
          console.error('Lỗi OpenAI Quiz:', e);
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
          const questions = JSON.parse(content);
          const quizData = Array.isArray(questions) ? questions : (questions.questions || questions.quiz || []);
          return NextResponse.json({ success: true, data: quizData });
        } catch (e) {
          console.error('Lỗi Gemini Quiz:', e);
        }
      }
    }

    // 2. Fallback sinh Quiz tĩnh (Offline generator)
    // Cách này cực kỳ hiệu quả: Lấy nghĩa của từ làm đáp án đúng, và lấy ngẫu nhiên nghĩa của từ khác làm đáp án sai.
    const quizData = vocabItems.map((item, idx) => {
      const question = `Ý nghĩa của từ hoặc cụm từ 「${item.word}」 (${item.reading || ''}) là gì?`;
      
      // Tạo danh sách đáp án sai từ các từ khác trong list
      const otherMeanings = vocabItems
        .filter((_, oIdx) => oIdx !== idx)
        .map(v => v.meaning_vi);
        
      // Nếu không đủ từ khác, tự bổ sung đáp án nhiễu
      while (otherMeanings.length < 3) {
        otherMeanings.push('Ý nghĩa khác của từ vựng tiếng Nhật', 'Một đáp án ngẫu nhiên khác', 'Không có đáp án nào đúng');
      }

      // Lấy 3 đáp án nhiễu ngẫu nhiên
      const distractorOptions = otherMeanings.sort(() => 0.5 - Math.random()).slice(0, 3);
      
      // Chèn đáp án đúng vào một vị trí ngẫu nhiên từ 0-3
      const correctIndex = Math.floor(Math.random() * 4);
      const options = [...distractorOptions];
      options.splice(correctIndex, 0, item.meaning_vi);

      return {
        question,
        options,
        correctIndex,
        explain: `Từ 「${item.word}」 có nghĩa là: "${item.meaning_vi}".${item.example_ja ? `\nVí dụ: ${item.example_ja} (${item.example_vi || ''})` : ''}`
      };
    });

    return NextResponse.json({ success: true, data: quizData, isMock: true });

  } catch (error: any) {
    console.error('Lỗi API quiz:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
  }
}
