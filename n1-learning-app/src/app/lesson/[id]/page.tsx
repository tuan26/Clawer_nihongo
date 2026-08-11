'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import data from '../../../data/n1_data.json';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, PlayCircle, FileText, LayoutTemplate, HelpCircle, Download, ExternalLink, Volume2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import LessonMemo from '../../../components/LessonMemo';
import { getProgress, saveProgress, lessonKey } from '../../../lib/indexedDbHelper';
import { syncLessonData, migrateLegacyProgress } from '../../../lib/syncEngine';
import { useAuth } from '../../../components/AuthGuard';

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;
  const { user } = useAuth();

  const [completed, setCompleted] = useState(false);

  const lesson = data.lessons.find((l: any) => l.id === lessonId);
  const resource = data.resources.find((r: any) => r.lesson_id === lessonId);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const load = async () => {
      await migrateLegacyProgress(user.id);
      const saved = await getProgress(user.id, lessonId);
      if (!cancelled) setCompleted(!!saved?.completed);
    };

    load().catch((e) => console.error('Lỗi khi đọc tiến độ bài học:', e));
    return () => {
      cancelled = true;
    };
  }, [user, lessonId]);

  const toggleComplete = async () => {
    if (!user) return;

    const next = !completed;
    const now = new Date().toISOString();
    setCompleted(next);

    // Ghi vào IndexedDB trước để trạng thái không mất khi mất mạng,
    // đồng thời vẫn cập nhật localStorage cho phần hiển thị cũ.
    await saveProgress({
      id: lessonKey(user.id, lessonId),
      user_id: user.id,
      lesson_id: lessonId,
      completed: next,
      completed_at: next ? now : null,
      updated_at: now,
      synced: false,
    });

    const saved = localStorage.getItem('n1_completed') || '{}';
    const parsed = JSON.parse(saved);
    parsed[lessonId] = next;
    localStorage.setItem('n1_completed', JSON.stringify(parsed));

    syncLessonData(user.id).catch((e) => console.error('Lỗi đồng bộ tiến độ:', e));
  };

  if (!lesson) {
    return <div className="p-8 text-center text-slate-500">Không tìm thấy bài học!</div>;
  }

  // Handle rendering different types
  const renderContent = () => {
    if (!resource || !resource.raw_data) {
      return (
        <div className="bg-slate-100 p-8 rounded-xl text-center text-slate-500 border border-slate-200">
          Đang tải dữ liệu hoặc chưa có dữ liệu chi tiết cho bài học này.
        </div>
      );
    }

    const { type, raw_data } = resource;

    // Normalize data structure (items array)
    const items = raw_data.items || (Array.isArray(raw_data) ? raw_data : [raw_data]);
    const firstItem = items[0] || {};

    if (type === 'VIDEO') {
      const videoUrl = firstItem.videoUrl;
      if (!videoUrl) return <p className="p-4 text-center text-slate-500">Không tìm thấy link video</p>;
      
      // Convert YouTube URL to embed
      let embedUrl = videoUrl;
      if (videoUrl.includes('youtu.be/')) {
        embedUrl = videoUrl.replace('youtu.be/', 'www.youtube.com/embed/');
      } else if (videoUrl.includes('youtube.com/watch?v=')) {
        embedUrl = videoUrl.replace('watch?v=', 'embed/');
      }

      return (
        <div className="space-y-6">
          <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 bg-black">
            <iframe 
              src={embedUrl} 
              className="w-full h-full" 
              allowFullScreen 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>
          {firstItem.description && (
             <div 
               className="prose prose-slate max-w-none bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
               dangerouslySetInnerHTML={{ __html: firstItem.description }}
             />
          )}
        </div>
      );
    }

    if (type === 'TEXT') {
      const content = firstItem.content || firstItem.description || '';
      if (!content || content === '<p>&nbsp;</p>') {
        return <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">Bài học này không có nội dung văn bản.</div>;
      }
      return (
        <div className="space-y-6">
          <div 
            className="prose prose-slate max-w-none bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200"
            dangerouslySetInnerHTML={{ __html: content }}
          />
          {firstItem.documents?.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" /> Tài liệu đính kèm
              </h3>
              <div className="grid gap-3">
                {firstItem.documents.map((doc: any) => (
                  <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <span className="text-blue-600 font-medium underline">{doc.name}</span>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (type === 'SLIDE') {
      const hasPdfSlide = items.some((s: any) => s.slideUrl?.toLowerCase().endsWith('.pdf'));

      return (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            {hasPdfSlide ? (
              <div className="p-8 text-center bg-blue-50 rounded-xl border-2 border-dashed border-blue-200">
                <div className="bg-white w-16 h-16 rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">Tài liệu Slide (PDF)</h3>
                <p className="text-slate-500 mb-6 text-sm">Nội dung này được lưu dưới dạng PDF. Bạn có thể xem trực tiếp hoặc tải về.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {items.map((s: any, idx: number) => s.slideUrl?.toLowerCase().endsWith('.pdf') && (
                    <a key={idx} href={s.slideUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
                      <Download className="w-5 h-5" /> {items.length > 1 ? `Tải Slide ${idx + 1}` : 'Tải / Xem Slide'}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4">
                {items.map((s: any, idx: number) => (
                  <div key={idx} className="snap-center shrink-0 w-full flex flex-col items-center">
                    <img src={s.slideUrl} alt={`Slide ${idx + 1}`} className="w-full h-auto rounded-lg shadow-sm border" />
                    <p className="mt-2 text-sm text-slate-500 font-medium">Slide {idx + 1} / {items.length}</p>
                  </div>
                ))}
              </div>
            )}
            
            {firstItem.description && (
              <div 
                className="mt-6 prose prose-slate max-w-none pt-6 border-t"
                dangerouslySetInnerHTML={{ __html: firstItem.description }}
              />
            )}
          </div>

          {firstItem.documents?.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" /> Tài liệu đính kèm
              </h3>
              <div className="grid gap-3">
                {firstItem.documents.map((doc: any) => (
                  <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <span className="text-blue-600 font-medium underline">{doc.name}</span>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (type === 'QUIZ') {
      const questions = raw_data.items || raw_data.questionMapping || raw_data.exam?.questionMapping || [];
      return <QuizContainer questions={questions} />;
    }

    if (type === 'FLASH_CARD') {
      const cards = raw_data.items || [];
      return <FlashcardPlayer cards={cards} />;
    }

    return <pre className="bg-slate-800 text-slate-100 p-6 rounded-xl overflow-auto text-sm">{JSON.stringify(raw_data, null, 2)}</pre>;
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 animate-in fade-in duration-500">
      <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Quay lại Lộ trình
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-semibold tracking-wide uppercase mb-3">
            {lesson.type === 'VIDEO' && <PlayCircle className="w-4 h-4" />}
            {lesson.type === 'TEXT' && <FileText className="w-4 h-4" />}
            {lesson.type === 'SLIDE' && <LayoutTemplate className="w-4 h-4" />}
            {lesson.type === 'QUIZ' && <HelpCircle className="w-4 h-4" />}
            {lesson.type === 'FLASH_CARD' && <LayoutTemplate className="w-4 h-4" />}
            {lesson.type}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            {lesson.title}
          </h1>
        </div>
        
        <button
          onClick={toggleComplete}
          title={completed ? 'Bấm để bỏ đánh dấu hoàn thành' : 'Đánh dấu bài học này đã hoàn thành'}
          className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${
            completed
              ? 'bg-green-600 text-white border border-green-700 hover:bg-green-700'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 text-white/90" />
          {completed ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
        </button>
      </div>

      <div className="mt-8">
        {renderContent()}
      </div>

      <LessonMemo lessonId={lessonId} />
    </div>
  );
}

function QuizContainer({ questions }: { questions: any[] }) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showExplains, setShowExplains] = useState<Record<number, boolean>>({});

  const handleSelect = (qIdx: number, optionId: string) => {
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optionId }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-6 py-4 rounded-xl flex items-start gap-4">
        <HelpCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-lg">Bài Tập / Kiểm Tra</h3>
          <p className="opacity-90">Có {questions.length} phần bài tập. Click vào đáp án để kiểm tra nhé!</p>
        </div>
      </div>

      <div className="space-y-8">
        {questions.map((q: any, i: number) => {
          const selectedId = selectedAnswers[i];
          const isAnswered = selectedId !== undefined;

          return (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex gap-4 mb-4">
                <div className="bg-slate-100 text-slate-500 font-bold w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </div>
                <div className="text-lg font-medium text-slate-800 prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: q.content || q.title || '' }} />
              </div>
              
              {q.imageUrl && <img src={q.imageUrl} alt="Question" className="max-w-md w-full rounded-lg mb-4 border border-slate-200" />}

              {/* Multiple Choice Options */}
              {q.options?.length > 0 && (
                <div className="grid gap-3 ml-12">
                  {q.options?.map((opt: any, oIdx: number) => {
                    const isCorrect = q.multipleChoiceAnswers?.some((ans: any) => ans.id === opt.id);
                    const isSelected = selectedId === opt.id;
                    
                    return (
                      <button 
                        key={oIdx} 
                        onClick={() => handleSelect(i, opt.id)}
                        className={clsx(
                          "flex flex-col gap-2 p-4 rounded-xl border transition-all text-left w-full",
                          isSelected 
                            ? (isCorrect ? "bg-green-50 border-green-200 ring-2 ring-green-500/20" : "bg-red-50 border-red-200 ring-2 ring-red-500/20")
                            : "bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={clsx(
                            "w-6 h-6 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center font-bold text-xs",
                            isSelected 
                              ? (isCorrect ? "bg-green-500 border-green-600 text-white" : "bg-red-500 border-red-600 text-white")
                              : "bg-white border-slate-300 text-slate-400"
                          )}>
                            {isSelected ? (isCorrect ? "✓" : "✕") : String.fromCharCode(65 + oIdx)}
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: opt.content }} />
                        </div>
                        {isSelected && (
                          <div className={clsx(
                            "mt-2 text-sm font-bold",
                            isCorrect ? "text-green-600" : "text-red-600"
                          )}>
                            {isCorrect ? "Chính xác!" : "Chưa đúng, hãy thử lại."}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Multiple Choice Horizontal */}
              {q.multipleChoiceHorizontal?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-12">
                  {q.multipleChoiceHorizontal.map((opt: any, oIdx: number) => {
                    const isSelected = selectedId === `h-${oIdx}`;
                    return (
                      <button 
                        key={oIdx} 
                        onClick={() => handleSelect(i, `h-${oIdx}`)}
                        className={clsx(
                          "flex flex-col gap-2 p-4 rounded-xl border transition-all text-left w-full",
                          isSelected 
                            ? (opt.isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")
                            : "bg-slate-50 border-slate-200 hover:bg-blue-50/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={clsx(
                            "w-6 h-6 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center font-bold text-xs",
                            isSelected ? "text-white" : "text-slate-400"
                          )}>
                            {isSelected ? (opt.isCorrect ? "✓" : "✕") : "○"}
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: opt.content }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Matching */}
              {q.type === 'MATCHING' && q.matchingAnswers?.length > 0 && (
                <div className="ml-12 space-y-3">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Đáp án đúng cho phần ghép:</h4>
                    <div className="grid gap-2">
                      {q.matchingAnswers.map((ans: any, aIdx: number) => (
                        <div key={aIdx} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b border-dashed border-slate-200 last:border-0">
                          <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 font-bold text-blue-700 min-w-[120px]">{ans.left}</div>
                          <div className="hidden sm:block text-slate-400">→</div>
                          <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-slate-700 flex-1">{ans.right}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Essay / Instructions Area */}
              {q.type === 'ESSAY' && (
                <div className="ml-12 mt-4 space-y-4">
                  {q.essayAnswers?.map((ans: any, aIdx: number) => (
                    <div key={aIdx} className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                       {ans.description && <div className="prose prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: ans.description }} />}
                       {ans.examUrl && (
                         <a href={ans.examUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all text-sm">
                           <Download className="w-4 h-4" /> Tải file bài làm / Đáp án
                         </a>
                       )}
                    </div>
                  ))}
                </div>
              )}
              
              {q.explain && (
                <div className="mt-6 ml-12">
                  <button 
                    onClick={() => setShowExplains(prev => ({ ...prev, [i]: !prev[i] }))}
                    className="text-yellow-700 font-bold hover:text-yellow-800 flex items-center gap-1 transition-colors"
                  >
                    {showExplains[i] ? "Ẩn giải thích" : "Xem giải thích chi tiết"}
                    <ChevronRight className={clsx("w-4 h-4 transition-transform", showExplains[i] && "rotate-90")} />
                  </button>
                  {showExplains[i] && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-lg p-4 prose prose-sm text-yellow-900 animate-in slide-in-from-top-2 duration-300" dangerouslySetInnerHTML={{ __html: q.explain }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlashcardPlayer({ cards }: { cards: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) return <div>Không có dữ liệu thẻ.</div>;

  const currentCard = cards[currentIndex];

  const nextCard = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const playAudio = (url: string) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.play();
  };

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      {/* Card Wrapper */}
      <div 
        className="relative w-full max-w-md aspect-[4/3] cursor-pointer perspective-1000"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={clsx(
          "w-full h-full relative transition-all duration-500 preserve-3d shadow-xl rounded-3xl",
          isFlipped ? "rotate-y-180" : ""
        )}>
          {/* Front Side */}
          <div className="absolute inset-0 backface-hidden bg-white rounded-3xl flex flex-col items-center justify-center p-8 border-2 border-slate-100">
             <span className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-4">Mặt trước</span>
             <div className="text-5xl md:text-6xl font-bold text-slate-800 text-center" dangerouslySetInnerHTML={{ __html: currentCard.front || currentCard.content || '' }} />
             {currentCard.audioUrl && (
               <button 
                onClick={(e) => { e.stopPropagation(); playAudio(currentCard.audioUrl); }}
                className="mt-8 p-4 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
               >
                 <Volume2 className="w-6 h-6" />
               </button>
             )}
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-800 rounded-3xl flex flex-col items-center justify-center p-8 border-2 border-slate-700">
             <span className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Mặt sau</span>
             <div className="text-2xl md:text-3xl font-medium text-white text-center whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: currentCard.back || currentCard.description || '' }} />
             {currentCard.audioUrl && (
               <button 
                onClick={(e) => { e.stopPropagation(); playAudio(currentCard.audioUrl); }}
                className="mt-8 p-4 bg-slate-700 text-blue-300 rounded-full hover:bg-slate-600 transition-colors"
               >
                 <Volume2 className="w-6 h-6" />
               </button>
             )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button onClick={prevCard} className="p-3 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold text-slate-700">{currentIndex + 1} / {cards.length}</span>
          <span className="text-xs text-slate-400 font-medium uppercase tracking-tighter">Thẻ bài</span>
        </div>

        <button onClick={nextCard} className="p-3 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-colors">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <button 
        onClick={() => { setIsFlipped(false); setCurrentIndex(0); }}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Bắt đầu lại
      </button>

      {/* Instructions */}
      <p className="text-sm text-slate-400 italic">Mẹo: Click vào thẻ để xem mặt sau của từ vựng.</p>
    </div>
  );
}
