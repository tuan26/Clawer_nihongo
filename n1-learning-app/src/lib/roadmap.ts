import data from '../data/n1_data.json';
import { addDays, format, differenceInDays } from 'date-fns';

export interface Lesson {
  id: string;
  section_id: string;
  api_id: string;
  title: string;
  type: string;
  order: number;
  url: string;
}

export interface DailyRoadmap {
  date: Date;
  dayIndex: number;
  isReviewDay: boolean;
  isPracticePhase: boolean;
  lessons: {
    courseTitle: string;
    courseId: string;
    lesson: Lesson;
  }[];
}

type Category = 'KANJI' | 'VOCAB' | 'GRAMMAR' | 'READING' | 'LISTENING' | 'EXAM' | 'OTHER';

function getCategory(lesson: Lesson, courseTitle: string): Category {
  const title = (lesson.title + ' ' + courseTitle).toUpperCase();
  if (title.includes('MANTEN') || title.includes('TEST') || title.includes('EXAM')) return 'EXAM';
  if (title.includes('KANJI') || title.includes('CHỮ HÁN')) return 'KANJI';
  if (title.includes('NGHE') || title.includes('CHOUKAI') || title.includes('TRANSCRIPT')) return 'LISTENING';
  if (title.includes('ĐỌC') || title.includes('DOKKAI') || title.includes('BỔ TƯỜNG')) return 'READING';
  if (title.includes('TỪ VỰNG') || title.includes('TANGO') || title.includes('FLASHCARD')) return 'VOCAB';
  if (title.includes('NGỮ PHÁP') || title.includes('BUNPOU') || title.includes('KHO GẠCH')) return 'GRAMMAR';
  if (title.includes('QUIZ')) return 'EXAM';
  return 'OTHER';
}

export function generateRoadmap(): DailyRoadmap[] {
  const startDate = new Date('2026-05-01');
  const learningEndDate = new Date('2026-10-31');
  const finalEndDate = new Date('2026-11-30');
  
  const totalDaysCount = differenceInDays(finalEndDate, startDate) + 1; 

  const courses = data.courses as any[];
  const allLessons = data.lessons as Lesson[];
  const sections = data.sections;

  // Group everything into skill-based buckets
  const buckets: Record<Category, {courseTitle: string, courseId: string, lesson: Lesson}[]> = {
    KANJI: [], VOCAB: [], GRAMMAR: [], READING: [], LISTENING: [], EXAM: [], OTHER: []
  };

  courses.forEach(course => {
    const courseSections = sections.filter(s => s.course_id === course.id).sort((a, b) => a.order - b.order);
    courseSections.forEach(section => {
      const sectionLessons = allLessons.filter(l => l.section_id === section.id).sort((a, b) => a.order - b.order);
      sectionLessons.forEach(l => {
        const cat = getCategory(l, course.title);
        buckets[cat].push({ courseTitle: course.title, courseId: course.id, lesson: l });
      });
    });
  });

  const roadmap: DailyRoadmap[] = [];
  for (let i = 0; i < totalDaysCount; i++) {
    const date = addDays(startDate, i);
    const isLearningPeriod = date <= learningEndDate;
    roadmap.push({
      date,
      dayIndex: i + 1,
      isReviewDay: isLearningPeriod && (i + 1) % 7 === 0,
      isPracticePhase: false,
      lessons: []
    });
  }

  const activeDays = roadmap.filter(d => d.date <= learningEndDate && !d.isReviewDay);
  const totalActiveDays = activeDays.length;

  // Spread each bucket evenly across ALL active days
  Object.keys(buckets).forEach(cat => {
    const queue = buckets[cat as Category];
    if (queue.length === 0) return;

    const lessonsPerDay = queue.length / totalActiveDays;

    activeDays.forEach((day, dayIdx) => {
      const start = Math.round(dayIdx * lessonsPerDay);
      const end = Math.round((dayIdx + 1) * lessonsPerDay);
      for (let i = start; i < end && i < queue.length; i++) {
        day.lessons.push(queue[i]);
      }
    });
  });

  // Re-sort within each day to keep some logical grouping (Vocab -> Kanji -> Grammar -> Reading -> Listening -> Exam)
  const categoryOrder: Record<Category, number> = {
    VOCAB: 0, KANJI: 1, GRAMMAR: 2, READING: 3, LISTENING: 4, EXAM: 5, OTHER: 6
  };

  roadmap.forEach(day => {
    day.lessons.sort((a, b) => {
      const catA = getCategory(a.lesson, a.courseTitle);
      const catB = getCategory(b.lesson, b.courseTitle);
      return categoryOrder[catA] - categoryOrder[catB];
    });
  });

  return roadmap;
}

// --- Lộ trình tập trung Đọc & Nghe (08/06 - 30/11) ---
const FOCUS_CATEGORIES: Category[] = ['READING', 'LISTENING', 'EXAM'];

export function generateFocusRoadmap(): DailyRoadmap[] {
  const startDate = new Date('2026-06-08');
  const learningEndDate = new Date('2026-11-20'); // 10 ngày cuối dành cho luyện đề tổng hợp
  const finalEndDate = new Date('2026-11-30');

  const totalDaysCount = differenceInDays(finalEndDate, startDate) + 1;

  const courses = data.courses as any[];
  const allLessons = data.lessons as Lesson[];
  const sections = data.sections;

  // Chỉ lọc READING, LISTENING, EXAM
  const buckets: Record<string, {courseTitle: string, courseId: string, lesson: Lesson}[]> = {
    READING: [], LISTENING: [], EXAM: []
  };

  courses.forEach(course => {
    const courseSections = sections.filter(s => s.course_id === course.id).sort((a, b) => a.order - b.order);
    courseSections.forEach(section => {
      const sectionLessons = allLessons.filter(l => l.section_id === section.id).sort((a, b) => a.order - b.order);
      sectionLessons.forEach(l => {
        const cat = getCategory(l, course.title);
        if (FOCUS_CATEGORIES.includes(cat)) {
          buckets[cat].push({ courseTitle: course.title, courseId: course.id, lesson: l });
        }
      });
    });
  });

  const roadmap: DailyRoadmap[] = [];
  for (let i = 0; i < totalDaysCount; i++) {
    const date = addDays(startDate, i);
    const isLearningPeriod = date <= learningEndDate;
    const isPractice = date > learningEndDate;
    roadmap.push({
      date,
      dayIndex: i + 1,
      isReviewDay: isLearningPeriod && (i + 1) % 7 === 0,
      isPracticePhase: isPractice,
      lessons: []
    });
  }

  // Phân bổ bài Đọc & Nghe vào ngày học chính
  const activeDays = roadmap.filter(d => d.date <= learningEndDate && !d.isReviewDay);
  const totalActiveDays = activeDays.length;

  ['READING', 'LISTENING'].forEach(cat => {
    const queue = buckets[cat];
    if (queue.length === 0) return;
    const lessonsPerDay = queue.length / totalActiveDays;
    activeDays.forEach((day, dayIdx) => {
      const start = Math.round(dayIdx * lessonsPerDay);
      const end = Math.round((dayIdx + 1) * lessonsPerDay);
      for (let i = start; i < end && i < queue.length; i++) {
        day.lessons.push(queue[i]);
      }
    });
  });

  // Phân bổ bài Thi/Luyện đề: trải đều trên toàn bộ ngày học + giai đoạn luyện đề
  const examQueue = buckets['EXAM'];
  if (examQueue.length > 0) {
    const allExamDays = roadmap.filter(d => !d.isReviewDay);
    const examPerDay = examQueue.length / allExamDays.length;
    allExamDays.forEach((day, dayIdx) => {
      const start = Math.round(dayIdx * examPerDay);
      const end = Math.round((dayIdx + 1) * examPerDay);
      for (let i = start; i < end && i < examQueue.length; i++) {
        day.lessons.push(examQueue[i]);
      }
    });
  }

  // Sắp xếp trong mỗi ngày: Đọc -> Nghe -> Thi
  const focusOrder: Record<string, number> = { READING: 0, LISTENING: 1, EXAM: 2 };
  roadmap.forEach(day => {
    day.lessons.sort((a, b) => {
      const catA = getCategory(a.lesson, a.courseTitle);
      const catB = getCategory(b.lesson, b.courseTitle);
      return (focusOrder[catA] ?? 9) - (focusOrder[catB] ?? 9);
    });
  });

  return roadmap;
}

export { getCategory };

export function getCourseStats() {
    return data.courses.map((c: any) => {
        const cSections = data.sections.filter((s: any) => s.course_id === c.id);
        const cSectionIds = new Set(cSections.map((s: any) => s.id));
        const cLessons = data.lessons.filter((l: any) => cSectionIds.has(l.section_id));
        return {
            title: c.title,
            lessonsCount: cLessons.length
        };
    });
}

export function getFocusStats() {
  const courses = data.courses as any[];
  const allLessons = data.lessons as Lesson[];
  const sections = data.sections;

  const stats = { READING: 0, LISTENING: 0, EXAM: 0 };

  courses.forEach(course => {
    const courseSections = sections.filter(s => s.course_id === course.id);
    courseSections.forEach(section => {
      const sectionLessons = allLessons.filter(l => l.section_id === section.id);
      sectionLessons.forEach(l => {
        const cat = getCategory(l, course.title);
        if (cat === 'READING' || cat === 'LISTENING' || cat === 'EXAM') {
          stats[cat]++;
        }
      });
    });
  });

  return [
    { title: 'Đọc hiểu (Reading)', lessonsCount: stats.READING, icon: '📖' },
    { title: 'Nghe hiểu (Listening)', lessonsCount: stats.LISTENING, icon: '🎧' },
    { title: 'Luyện đề & Thi', lessonsCount: stats.EXAM, icon: '📝' },
  ];
}
