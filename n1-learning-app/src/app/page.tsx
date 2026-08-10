'use client';
// Build Version: 2.0.0 - Dual roadmap with Focus Reading & Listening tab

import { useState, useEffect, useMemo } from 'react';
import { generateRoadmap, generateFocusRoadmap, DailyRoadmap, getCourseStats, getFocusStats, getCategory } from '../lib/roadmap';
import { differenceInDays, format } from 'date-fns';
import { CheckCircle2, PlayCircle, BookOpen, Search, Headphones, BookOpenCheck, FileText } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import VocabManager from '../components/VocabManager';

type TabType = 'all' | 'focus' | 'vocab';

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  READING: { label: '📖 Đọc', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  LISTENING: { label: '🎧 Nghe', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  EXAM: { label: '📝 Thi', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  GRAMMAR: { label: '✏️ Ngữ pháp', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  VOCAB: { label: '📚 Từ vựng', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  KANJI: { label: '🈶 Kanji', color: 'bg-red-100 text-red-700 border-red-200' },
  OTHER: { label: '📁 Khác', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentDayStrAll, setCurrentDayStrAll] = useState<string>('');
  const [currentDayStrFocus, setCurrentDayStrFocus] = useState<string>('');
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  const roadmapAll = useMemo(() => generateRoadmap(), []);
  const roadmapFocus = useMemo(() => generateFocusRoadmap(), []);
  const statsAll = useMemo(() => getCourseStats(), []);
  const statsFocus = useMemo(() => getFocusStats(), []);

  // Helper
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const initDayStr = (roadmap: DailyRoadmap[], startDateStr: string, storageKey: string): string => {
    const saved = localStorage.getItem(storageKey);
    if (saved && roadmap.some(d => format(d.date, 'yyyy-MM-dd') === saved)) {
      return saved;
    }
    const today = new Date();
    const startDate = new Date(startDateStr);
    let diff = differenceInDays(today, startDate);
    if (diff < 0) diff = 0;
    if (diff > roadmap.length - 1) diff = roadmap.length - 1;
    return format(addDays(startDate, diff), 'yyyy-MM-dd');
  };

  useEffect(() => {
    setMounted(true);

    // Load active tab
    const savedTab = localStorage.getItem('n1_active_tab') as TabType | null;
    if (savedTab === 'all' || savedTab === 'focus' || savedTab === 'vocab') setActiveTab(savedTab);

    // Load selected days independently
    setCurrentDayStrAll(initDayStr(roadmapAll, '2026-05-01', 'n1_selected_day_all'));
    setCurrentDayStrFocus(initDayStr(roadmapFocus, '2026-06-08', 'n1_selected_day_focus'));

    // Load completed state
    const saved = localStorage.getItem('n1_completed');
    if (saved) setCompletedLessons(JSON.parse(saved));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return <div className="p-8 text-center text-slate-400 animate-pulse text-lg">Đang tải lộ trình...</div>;

  // Derived state based on active tab
  const isFocus = activeTab === 'focus';
  const isVocab = activeTab === 'vocab';
  const roadmap = isFocus ? roadmapFocus : roadmapAll;
  const currentDayStr = isFocus ? currentDayStrFocus : currentDayStrAll;
  const setCurrentDayStr = isFocus ? setCurrentDayStrFocus : setCurrentDayStrAll;
  const storageKeyDay = isFocus ? 'n1_selected_day_focus' : 'n1_selected_day_all';
  const stats = isFocus ? statsFocus : statsAll;

  const currentDayData = roadmap.find(d => format(d.date, 'yyyy-MM-dd') === currentDayStr) || roadmap[0];
  const totalLessonsInRoadmap = roadmap.reduce((acc, d) => acc + d.lessons.length, 0);
  const completedInRoadmap = roadmap.reduce((acc, d) => acc + d.lessons.filter(l => completedLessons[l.lesson.id]).length, 0);
  const progressPercent = totalLessonsInRoadmap > 0 ? Math.round((completedInRoadmap / totalLessonsInRoadmap) * 100) : 0;

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    localStorage.setItem('n1_active_tab', tab);
  };

  const handleSelectDay = (dateStr: string) => {
    setCurrentDayStr(dateStr);
    localStorage.setItem(storageKeyDay, dateStr);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ===== TAB SWITCHER ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2">
        <div className="flex gap-1.5">
          <button
            id="tab-all"
            onClick={() => handleTabSwitch('all')}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300",
              activeTab === 'all'
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Lộ trình Toàn diện</span>
            <span className="sm:hidden">Toàn diện</span>
            <span className={clsx(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
            )}>01/05 – 30/11</span>
          </button>
          <button
            id="tab-focus"
            onClick={() => handleTabSwitch('focus')}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300",
              activeTab === 'focus'
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <Headphones className="w-4 h-4" />
            <span className="hidden sm:inline">Đọc & Nghe Chuyên sâu</span>
            <span className="sm:hidden">Đọc & Nghe</span>
            <span className={clsx(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'focus' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
            )}>08/06 – 30/11</span>
          </button>
          <button
            id="tab-vocab"
            onClick={() => handleTabSwitch('vocab')}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300",
              activeTab === 'vocab'
                ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-200"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <BookOpenCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Từ vựng của tôi</span>
            <span className="sm:hidden">Từ vựng</span>
            <span className={clsx(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              activeTab === 'vocab' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
            )}>KPI 100 từ</span>
          </button>
        </div>
      </div>

      {/* ===== NỘI DUNG TỪNG TAB ===== */}
      {isVocab ? (
        <VocabManager />
      ) : (
        <>
          {/* ===== HEADER + PROGRESS ===== */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {isFocus ? 'Đọc & Nghe Chuyên sâu' : 'Tiến độ học tập'}
              </h1>
              <p className="text-slate-500 mt-1">
                Hôm nay là Ngày thứ {currentDayData.dayIndex} trong tổng số {roadmap.length} ngày.
                {isFocus && <span className="ml-1 text-emerald-600 font-medium">• Tập trung Đọc, Nghe & Luyện đề</span>}
              </p>
            </div>
            <div className={clsx(
              "p-4 rounded-xl shadow-sm border md:w-64",
              isFocus ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"
            )}>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-slate-500">Hoàn thành</span>
                <span className={clsx("text-2xl font-bold", isFocus ? "text-emerald-600" : "text-blue-600")}>{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className={clsx("h-2.5 rounded-full transition-all duration-500", isFocus ? "bg-emerald-500" : "bg-blue-600")}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5">{completedInRoadmap} / {totalLessonsInRoadmap} bài</div>
            </div>
          </header>

          {/* ===== NHIỆM VỤ HÔM NAY ===== */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className={clsx(
              "border-b px-6 py-4 flex items-center justify-between",
              isFocus ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"
            )}>
              <div className="flex flex-col">
                <h2 className={clsx("text-xl font-bold flex items-center gap-2", isFocus ? "text-emerald-900" : "text-blue-900")}>
                  {isFocus ? <Headphones className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                  {currentDayData.isReviewDay ? 'Ngày Ôn Tập' : currentDayData.isPracticePhase ? 'Giai đoạn Luyện Đề' : 'Nhiệm vụ hôm nay'}
                </h2>
                <span className={clsx("text-xs font-semibold uppercase tracking-wider mt-0.5", isFocus ? "text-emerald-600" : "text-blue-600")}>
                   {isFocus
                     ? (currentDayData.isPracticePhase ? 'Tổng lực luyện đề cuối cùng' : 'Tập trung Đọc hiểu & Nghe hiểu')
                     : (currentDayData.isPracticePhase ? 'Tập trung giải đề & Tổng hợp' : 'Kiến thức nền tảng & Từ vựng')
                   }
                </span>
              </div>
              <div className={clsx(
                "text-sm font-medium px-3 py-1 rounded-full",
                isFocus ? "text-emerald-700 bg-emerald-100" : "text-blue-700 bg-blue-100"
              )}>
                {format(currentDayData.date, 'dd/MM/yyyy')}
              </div>
            </div>
            
            <div className="p-2 sm:p-6 grid gap-4">
              {currentDayData.isReviewDay && (
                <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-yellow-800 mb-2">
                   <h3 className="font-bold flex items-center gap-2 mb-2">
                     <Search className="w-5 h-5" /> Ngày Ôn tập kiến thức
                   </h3>
                   <p className="text-sm">
                     {isFocus
                       ? 'Hôm nay bạn không có bài mới. Hãy dành thời gian ôn lại các bài Đọc và Nghe đã học trong tuần vừa qua!'
                       : 'Hôm nay bạn không có bài mới. Hãy dành thời gian xem lại các từ vựng và ngữ pháp đã học trong 6 ngày vừa qua nhé!'
                     }
                   </p>
                </div>
              )}
              {currentDayData.lessons.length === 0 && !currentDayData.isReviewDay ? (
                <div className="text-center py-8 text-slate-500">Không có bài học nào trong ngày này.</div>
              ) : (
                currentDayData.lessons.map((item, idx) => {
                  const isCompleted = completedLessons[item.lesson.id];
                  const cat = getCategory(item.lesson, item.courseTitle);
                  const badge = CATEGORY_BADGE[cat] || CATEGORY_BADGE['OTHER'];
                  return (
                    <Link 
                      href={`/lesson/${item.lesson.id}`} 
                      key={item.lesson.id + idx}
                      className={clsx(
                        "group flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-md",
                        isCompleted
                          ? "bg-slate-50 border-slate-200"
                          : isFocus
                            ? "bg-white border-emerald-100 hover:border-emerald-300"
                            : "bg-white border-blue-100 hover:border-blue-300"
                      )}
                    >
                      <div className="mt-1 flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <PlayCircle className={clsx(
                            "w-6 h-6 group-hover:scale-110 transition-transform",
                            isFocus ? "text-emerald-500 group-hover:text-emerald-600" : "text-blue-500 group-hover:text-blue-600"
                          )} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {item.courseTitle}
                          </span>
                          <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", badge.color)}>
                            {badge.label}
                          </span>
                        </div>
                        <h3 className={clsx("font-semibold text-lg line-clamp-2", isCompleted ? "text-slate-600" : "text-slate-900")}>
                          {item.lesson.title}
                        </h3>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          {/* ===== THỐNG KÊ ===== */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {isFocus ? 'Tổng quan Kỹ năng' : 'Tổng quan 4 Khoá Học'}
            </h2>
            <div className={clsx("grid gap-4", isFocus ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
              {stats.map((s: any) => (
                <div key={s.title} className={clsx(
                  "p-5 rounded-xl border shadow-sm",
                  isFocus ? "bg-gradient-to-br from-white to-emerald-50 border-emerald-100" : "bg-white border-slate-200"
                )}>
                  <h3 className="font-semibold text-slate-800 line-clamp-1 flex items-center gap-2" title={s.title}>
                    {s.icon && <span className="text-lg">{s.icon}</span>}
                    {s.title}
                  </h3>
                  <p className={clsx("text-3xl font-bold mt-2", isFocus ? "text-emerald-600" : "text-blue-600")}>{s.lessonsCount}</p>
                  <p className="text-sm text-slate-500">Bài học & Bài tập</p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== LỊCH TRÌNH TOÀN KHÓA ===== */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {isFocus ? `Lịch trình Đọc & Nghe (${roadmap.length} Ngày)` : `Lịch trình toàn khóa (${roadmap.length} Ngày)`}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {roadmap.map(day => {
                const dateStr = format(day.date, 'yyyy-MM-dd');
                const isSelected = dateStr === currentDayStr;
                const completedInDay = day.lessons.filter(l => completedLessons[l.lesson.id]).length;
                const totalInDay = day.lessons.length;
                const isAllCompleted = totalInDay > 0 && completedInDay === totalInDay;
                
                return (
                  <button
                    key={day.dayIndex}
                    onClick={() => handleSelectDay(dateStr)}
                    className={clsx(
                      "p-3 rounded-xl border text-left flex flex-col justify-between h-24 transition-all relative overflow-hidden",
                      isSelected 
                        ? isFocus
                          ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 shadow-md transform scale-105 z-10"
                          : "ring-2 ring-blue-500 border-blue-500 bg-blue-50 shadow-md transform scale-105 z-10" 
                        : isAllCompleted 
                          ? "bg-green-50 border-green-200 hover:bg-green-100" 
                          : day.isReviewDay
                            ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                            : day.isPracticePhase
                              ? "bg-purple-50 border-purple-100 hover:bg-purple-100"
                              : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"
                    )}
                  >
                    {day.isPracticePhase && <div className="absolute top-0 right-0 w-2 h-full bg-purple-200 opacity-30" />}
                    <div className="flex justify-between items-start w-full relative z-10">
                      <span className={clsx("text-[10px] font-bold uppercase", 
                        isSelected ? (isFocus ? "text-emerald-700" : "text-blue-700") : 
                        isAllCompleted ? "text-green-700" : 
                        day.isReviewDay ? "text-yellow-700" :
                        day.isPracticePhase ? "text-purple-700" : "text-slate-400"
                      )}>
                        {day.isReviewDay ? 'Review' : day.isPracticePhase ? 'Luyện đề' : `Ngày ${day.dayIndex}`}
                      </span>
                      {isAllCompleted && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
                    <div className="relative z-10">
                      <div className={clsx("text-sm font-bold", isSelected ? (isFocus ? "text-emerald-900" : "text-blue-900") : "text-slate-900")}>
                        {format(day.date, 'dd/MM')}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {totalInDay} bài
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
