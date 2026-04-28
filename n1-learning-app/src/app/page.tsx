'use client';
// Build Version: 1.0.1 - Optimization and skill-based interleaving

import { useState, useEffect, useMemo } from 'react';
import { generateRoadmap, DailyRoadmap, getCourseStats } from '../lib/roadmap';
import { differenceInDays, format, isSameDay } from 'date-fns';
import { CheckCircle2, PlayCircle, BookOpen, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

export default function Home() {
  const [currentDayStr, setCurrentDayStr] = useState<string>('');
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  const roadmap = useMemo(() => generateRoadmap(), []);
  const stats = useMemo(() => getCourseStats(), []);

  useEffect(() => {
    setMounted(true);
    // Tính toán ngày hiện tại (mặc định lấy theo thời gian thực)
    const today = new Date();
    const startDate = new Date('2026-05-01');
    const endDate = new Date('2026-11-30');
    
    // Load selected day or default to today
    const savedDay = localStorage.getItem('n1_selected_day');
    if (savedDay && roadmap.some(d => format(d.date, 'yyyy-MM-dd') === savedDay)) {
      setCurrentDayStr(savedDay);
    } else {
      let diff = differenceInDays(today, startDate);
      if (diff < 0) diff = 0;
      if (diff > roadmap.length - 1) diff = roadmap.length - 1;
      setCurrentDayStr(format(addDays(startDate, diff), 'yyyy-MM-dd'));
    }

    // Load completed state
    const saved = localStorage.getItem('n1_completed');
    if (saved) {
      setCompletedLessons(JSON.parse(saved));
    }
  }, [roadmap]);

  // Handle date function properly
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  if (!mounted) return <div className="p-8 text-center">Đang tải lộ trình...</div>;

  const currentDayData = roadmap.find(d => format(d.date, 'yyyy-MM-dd') === currentDayStr) || roadmap[0];
  const progressPercent = Math.round((Object.keys(completedLessons).length / roadmap.reduce((acc, d) => acc + d.lessons.length, 0)) * 100) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tiến độ học tập</h1>
          <p className="text-slate-500 mt-1">Hôm nay là Ngày thứ {currentDayData.dayIndex} trong tổng số 214 ngày.</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 md:w-64">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-slate-500">Hoàn thành</span>
            <span className="text-2xl font-bold text-blue-600">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {currentDayData.isReviewDay ? 'Ngày Ôn Tập' : currentDayData.isPracticePhase ? 'Giai đoạn Luyện Đề' : 'Nhiệm vụ hôm nay'}
            </h2>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider mt-0.5">
               {currentDayData.isPracticePhase ? 'Tập trung giải đề & Tổng hợp' : 'Kiến thức nền tảng & Từ vựng'}
            </span>
          </div>
          <div className="text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
            {format(currentDayData.date, 'dd/MM/yyyy')}
          </div>
        </div>
        
        <div className="p-2 sm:p-6 grid gap-4">
          {currentDayData.isReviewDay && (
            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-yellow-800 mb-2">
               <h3 className="font-bold flex items-center gap-2 mb-2">
                 <Search className="w-5 h-5" /> Chủ nhật - Ngày Ôn tập kiến thức
               </h3>
               <p className="text-sm">Hôm nay bạn không có bài mới. Hãy dành thời gian xem lại các từ vựng và ngữ pháp đã học trong 6 ngày vừa qua nhé!</p>
            </div>
          )}
          {currentDayData.lessons.length === 0 && !currentDayData.isReviewDay ? (
            <div className="text-center py-8 text-slate-500">Không có bài học nào trong ngày này.</div>
          ) : (
            currentDayData.lessons.map((item, idx) => {
              const isCompleted = completedLessons[item.lesson.id];
              return (
                <Link 
                  href={`/lesson/${item.lesson.id}`} 
                  key={item.lesson.id + idx}
                  className={clsx(
                    "group flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-md",
                    isCompleted ? "bg-slate-50 border-slate-200" : "bg-white border-blue-100 hover:border-blue-300"
                  )}
                >
                  <div className="mt-1 flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <PlayCircle className="w-6 h-6 text-blue-500 group-hover:text-blue-600 group-hover:scale-110 transition-transform" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                      {item.courseTitle}
                    </div>
                    <h3 className={clsx("font-semibold text-lg line-clamp-2", isCompleted ? "text-slate-600" : "text-slate-900")}>
                      {item.lesson.title}
                    </h3>
                    <div className="mt-2 inline-flex items-center text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      Type: {item.lesson.type}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Tổng quan 4 Khoá Học</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.title} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-800 line-clamp-1" title={s.title}>{s.title}</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">{s.lessonsCount}</p>
              <p className="text-sm text-slate-500">Bài học & Bài tập</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Lịch trình toàn khóa (214 Ngày)</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {roadmap.map(day => {
            const dateStr = format(day.date, 'yyyy-MM-dd');
            const isToday = dateStr === currentDayStr;
            const completedInDay = day.lessons.filter(l => completedLessons[l.lesson.id]).length;
            const totalInDay = day.lessons.length;
            const isAllCompleted = totalInDay > 0 && completedInDay === totalInDay;
            
            return (
              <button
                key={day.dayIndex}
                onClick={() => {
                  setCurrentDayStr(dateStr);
                  localStorage.setItem('n1_selected_day', dateStr);
                }}
                className={clsx(
                  "p-3 rounded-xl border text-left flex flex-col justify-between h-24 transition-all relative overflow-hidden",
                  isToday 
                    ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50 shadow-md transform scale-105 z-10" 
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
                    isToday ? "text-blue-700" : 
                    isAllCompleted ? "text-green-700" : 
                    day.isReviewDay ? "text-yellow-700" :
                    day.isPracticePhase ? "text-purple-700" : "text-slate-400"
                  )}>
                    {day.isReviewDay ? 'Review' : day.isPracticePhase ? 'Exam' : `Ngày ${day.dayIndex}`}
                  </span>
                  {isAllCompleted && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
                <div className="relative z-10">
                  <div className={clsx("text-sm font-bold", isToday ? "text-blue-900" : "text-slate-900")}>
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
    </div>
  );
}
