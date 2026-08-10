'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Trash2, Edit3, Check, X, Flame, Calendar, ChevronRight, 
  ChevronLeft, User, Lock, Settings, RefreshCw, AlertCircle, ThumbsUp, 
  CheckCircle2, Sparkles, BookOpen, Layers, History, Volume2, Play, Award, HelpCircle
} from 'lucide-react';
import { format, differenceInDays, parseISO, addDays, subDays, isSameDay } from 'date-fns';
import { 
  saveVocabulary, 
  deleteVocabulary, 
  getAllVocabulary, 
  saveReview, 
  getReviewsForVocab, 
  clearAllData,
  LocalVocabulary,
  LocalReview
} from '../lib/indexedDbHelper';
import { syncData, setupAutoSync } from '../lib/syncEngine';
import { useAuth } from './AuthGuard';

// Default user ID khi không đăng nhập
const LOCAL_USER_ID = 'local-user';

export default function VocabManager() {
  // --- States cho Sync ---
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
  const [syncMessage, setSyncMessage] = useState('');

  // --- States cho Dữ liệu Từ Vựng ---
  const [vocabList, setVocabList] = useState<LocalVocabulary[]>([]);
  const [isLoadingVocab, setIsLoadingVocab] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // --- States cho Modals & Views ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVocab, setSelectedVocab] = useState<LocalVocabulary | null>(null);
  const [selectedVocabReviews, setSelectedVocabReviews] = useState<LocalReview[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // --- States Form Thêm mới / Sửa ---
  const [isBulkAdd, setIsBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [formWord, setFormWord] = useState('');
  const [formReading, setFormReading] = useState('');
  const [formMeaning, setFormMeaning] = useState('');
  const [formExampleJa, setFormExampleJa] = useState('');
  const [formExampleVi, setFormExampleVi] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formSource, setFormSource] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [availableTags] = useState(['Công việc', 'N1', 'Giao tiếp', 'Đọc báo', 'Đời sống']);

  // --- States cho Ôn tập (Spaced Repetition Review) ---
  const [showReviewView, setShowReviewView] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<LocalVocabulary[]>([]);
  const [currentReviewIdx, setCurrentReviewIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [reviewCountToday, setReviewCountToday] = useState(0); // Đã ôn hôm nay

  // --- States cho AI Activity (Quiz & Conversation) ---
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [showQuizExplain, setShowQuizExplain] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const [showDialogueModal, setShowDialogueModal] = useState(false);
  const [dialogueData, setDialogueData] = useState<any>(null);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);

  // Lấy User ID hiện tại
  const currentUserId = user?.id || LOCAL_USER_ID;

  // --- 1. SETUP SYNC ENGINE ---
  useEffect(() => {
    if (user) {
      loadLocalData(user.id);
      triggerSync(user.id);
    } else {
      loadLocalData(LOCAL_USER_ID);
      setSyncStatus('offline');
    }
  }, [user]);

  // Lắng nghe auto sync khi có mạng lại
  useEffect(() => {
    if (!currentUserId || currentUserId === LOCAL_USER_ID) return;
    const cleanup = setupAutoSync(currentUserId, () => {
      setSyncStatus('synced');
      loadLocalData(currentUserId);
    });
    return cleanup;
  }, [currentUserId]);

  const loadLocalData = async (userId: string) => {
    setIsLoadingVocab(true);
    try {
      const list = await getAllVocabulary(userId);
      setVocabList(list);
    } catch (e) {
      console.error('Lỗi tải dữ liệu Local:', e);
    } finally {
      setIsLoadingVocab(false);
    }
  };

  const triggerSync = async (userId: string) => {
    if (userId === LOCAL_USER_ID) return;
    setSyncStatus('syncing');
    const result = await syncData(userId);
    if (result.success) {
      setSyncStatus('synced');
      setSyncMessage('Dữ liệu đã được đồng bộ thành công với Cloud!');
      // Load lại dữ liệu sau khi sync
      await loadLocalData(userId);
    } else {
      setSyncStatus('error');
      setSyncMessage(result.message);
    }
  };

  // --- ĐĂNG NHẬP / ĐĂNG KÝ SUPABASE ---
  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất? Dữ liệu local sẽ được xóa sạch (nhưng vẫn an toàn trên Supabase Cloud).')) {
      // Logic Auth đã được quản lý tập trung bởi AuthGuard
      await clearAllData();
      setVocabList([]);
      window.location.reload();
    }
  };

  // --- 2. THỐNG KÊ DASHBOARD & BIỂU ĐỒ ---
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  // Tính Streak (số ngày liên tiếp có thêm từ hoặc ôn từ)
  const streak = useMemo(() => {
    if (vocabList.length === 0) return 0;
    
    // Thu thập tất cả các ngày có thêm từ
    const datesWithVocab = new Set(vocabList.map(v => format(parseISO(v.created_at), 'yyyy-MM-dd')));
    let currentStreak = 0;
    let checkDate = new Date();

    // Kiểm tra xem hôm nay hoặc hôm qua có thêm từ không
    const todayStr = format(checkDate, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(checkDate, 1), 'yyyy-MM-dd');

    if (!datesWithVocab.has(todayStr) && !datesWithVocab.has(yesterdayStr)) {
      return 0;
    }

    // Nếu hôm nay không có nhưng hôm qua có, bắt đầu tính từ hôm qua
    if (!datesWithVocab.has(todayStr) && datesWithVocab.has(yesterdayStr)) {
      checkDate = subDays(checkDate, 1);
    }

    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      if (datesWithVocab.has(dateStr)) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
    return currentStreak;
  }, [vocabList]);

  // Từ cần ôn hôm nay
  const pendingReviews = useMemo(() => {
    return vocabList.filter(v => {
      // Nếu next_review_at bé hơn hoặc bằng ngày hôm nay và trạng thái không phải master hoàn toàn (hoặc vẫn ôn bình thường)
      const nextDateStr = format(parseISO(v.next_review_at), 'yyyy-MM-dd');
      return nextDateStr <= todayStr;
    });
  }, [vocabList, todayStr]);

  // Từ thêm mới trong tháng này
  const addedThisMonth = useMemo(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    return vocabList.filter(v => format(parseISO(v.created_at), 'yyyy-MM') === currentMonth);
  }, [vocabList]);

  // Tiến trình KPI (Mục tiêu 100 từ/tháng)
  const kpiTarget = 100;
  const kpiCount = addedThisMonth.length;
  const kpiPercent = Math.min(100, Math.round((kpiCount / kpiTarget) * 100));

  // Tính KPI chất lượng: >=70% từ mới được ôn ít nhất 2 lần
  const qualityKpi = useMemo(() => {
    if (vocabList.length === 0) return { percent: 0, reviewedTwice: 0, total: 0 };
    // Lấy các từ thêm trong tháng này
    const thisMonthVocabIds = new Set(addedThisMonth.map(v => v.id));
    // Để tính chính xác, ta xem trạng thái của các từ hoặc interval_days của chúng.
    // Nếu interval_days > 0 hoặc trạng thái không phải 'new' (tức là đã được ôn tập ít nhất 1-2 lần),
    // Ở đây ta có thể tính từ trường `status` và `interval_days`: nếu ease_factor thay đổi hoặc interval_days lớn hơn 0
    // Để chuẩn xác, ta kiểm tra xem status !== 'new' (nghĩa là đã ôn ít nhất 1 lần)
    // Và nếu có bảng review_history local thì đếm. Hoặc đơn giản là status !== 'new'.
    // Ở đây ta kiểm tra các từ đã ôn tập (status !== 'new')
    const reviewedCount = addedThisMonth.filter(v => v.status !== 'new').length;
    const percent = kpiCount > 0 ? Math.round((reviewedCount / kpiCount) * 100) : 0;
    return {
      percent,
      reviewedTwice: reviewedCount,
      total: kpiCount
    };
  }, [addedThisMonth, kpiCount]);

  // Tính số từ cần thêm trung bình mỗi ngày
  const averageNeededPerDay = useMemo(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysRemaining = differenceInDays(lastDayOfMonth, today) + 1;
    const remainingWords = Math.max(0, kpiTarget - kpiCount);
    
    if (remainingWords === 0) return 0;
    if (daysRemaining <= 0) return remainingWords;
    return parseFloat((remainingWords / daysRemaining).toFixed(1));
  }, [kpiCount]);

  // Thống kê số từ theo trạng thái học tập
  const statusStats = useMemo(() => {
    const stats = { new: 0, learning: 0, familiar: 0, strong: 0 };
    vocabList.forEach(v => {
      if (stats[v.status] !== undefined) stats[v.status]++;
    });
    return stats;
  }, [vocabList]);

  // Vẽ biểu đồ số từ mới theo ngày (7 ngày gần nhất)
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const count = vocabList.filter(v => format(parseISO(v.created_at), 'yyyy-MM-dd') === dateStr).length;
      data.push({
        label: format(d, 'dd/MM'),
        dateStr,
        count
      });
    }
    return data;
  }, [vocabList]);

  // --- 3. TÌM KIẾM, BỘ LỌC DANH SÁCH TỪ VỰNG ---
  const filteredVocabList = useMemo(() => {
    return vocabList.filter(v => {
      // Filter search
      const matchesSearch = searchQuery.trim() === '' || 
        v.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
        v.meaning_vi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.reading && v.reading.toLowerCase().includes(searchQuery.toLowerCase()));

      // Filter tag
      const matchesTag = selectedTag === 'all' || v.tags.includes(selectedTag);

      // Filter status
      const matchesStatus = selectedStatus === 'all' || v.status === selectedStatus;

      // Filter click biểu đồ ngày
      const matchesDate = !selectedDateFilter || format(parseISO(v.created_at), 'yyyy-MM-dd') === selectedDateFilter;

      return matchesSearch && matchesTag && matchesStatus && matchesDate;
    });
  }, [vocabList, searchQuery, selectedTag, selectedStatus, selectedDateFilter]);

  // Group danh sách từ vựng theo ngày
  const groupedVocabList = useMemo(() => {
    const groups: Record<string, LocalVocabulary[]> = {};
    
    // Sắp xếp từ mới nhất lên đầu
    const sorted = [...filteredVocabList].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    sorted.forEach(item => {
      const dateStr = format(parseISO(item.created_at), 'yyyy-MM-dd');
      let displayDate = dateStr;
      if (dateStr === todayStr) {
        displayDate = 'Hôm nay';
      } else {
        // format sang dd/MM/yyyy
        displayDate = format(parseISO(item.created_at), 'dd/MM/yyyy');
      }

      if (!groups[displayDate]) groups[displayDate] = [];
      groups[displayDate].push(item);
    });

    return Object.entries(groups).map(([date, items]) => ({ date, items }));
  }, [filteredVocabList, todayStr]);

  // --- 4. FORM THÊM MỚI / SỬA TỪ VỰNG ---
  const handleTagToggle = (tag: string) => {
    if (formTags.includes(tag)) {
      setFormTags(formTags.filter(t => t !== tag));
    } else {
      setFormTags([...formTags, tag]);
    }
  };

  const handleOpenAddModal = () => {
    setFormWord('');
    setFormReading('');
    setFormMeaning('');
    setFormExampleJa('');
    setFormExampleVi('');
    setFormTags([]);
    setFormSource('');
    setIsEditing(false);
    setIsBulkAdd(false);
    setBulkText('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (vocab: LocalVocabulary) => {
    setSelectedVocab(vocab);
    setFormWord(vocab.word);
    setFormReading(vocab.reading || '');
    setFormMeaning(vocab.meaning_vi);
    setFormExampleJa(vocab.example_ja || '');
    setFormExampleVi(vocab.example_vi || '');
    setFormTags(vocab.tags || []);
    setFormSource(vocab.source || '');
    setIsEditing(true);
    setShowDetailModal(false); // Đóng modal chi tiết
    setShowAddModal(true); // Mở modal form sửa
  };

  // Gọi API phân tích AI cho 1 từ
  const handleAIAnalyze = async () => {
    if (!formWord.trim()) {
      alert('Vui lòng nhập từ/cụm từ trước khi phân tích!');
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/vocab/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ word: formWord.trim() })
      });
      const json = await response.json();
      if (json.success && json.data) {
        const data = json.data;
        setFormReading(data.reading || '');
        setFormMeaning(data.meaning_vi || '');
        setFormExampleJa(data.example_ja || '');
        setFormExampleVi(data.example_vi || '');
        setFormTags(data.tags || []);
      } else {
        alert(json.error || 'Không thể phân tích từ vựng này.');
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối API phân tích.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit Lưu từ vựng (Thêm hoặc Sửa)
  const handleSaveVocab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWord.trim() || !formMeaning.trim()) {
      alert('Vui lòng nhập đầy đủ Từ và Nghĩa tiếng Việt!');
      return;
    }

    try {
      const nowStr = new Date().toISOString();
      const id = isEditing && selectedVocab ? selectedVocab.id : crypto.randomUUID();
      
      const newVocab: LocalVocabulary = {
        id,
        user_id: currentUserId,
        word: formWord.trim(),
        reading: formReading.trim() || undefined,
        meaning_vi: formMeaning.trim(),
        example_ja: formExampleJa.trim() || undefined,
        example_vi: formExampleVi.trim() || undefined,
        tags: formTags,
        source: formSource.trim() || undefined,
        status: isEditing && selectedVocab ? selectedVocab.status : 'new',
        created_at: isEditing && selectedVocab ? selectedVocab.created_at : nowStr,
        updated_at: nowStr,
        next_review_at: isEditing && selectedVocab ? selectedVocab.next_review_at : nowStr,
        interval_days: isEditing && selectedVocab ? selectedVocab.interval_days : 0,
        ease_factor: isEditing && selectedVocab ? selectedVocab.ease_factor : 2.5,
        synced: false // Cần sync lên Cloud
      };

      await saveVocabulary(newVocab);
      await loadLocalData(currentUserId);
      setShowAddModal(false);

      // Tự động kích hoạt đồng bộ
      triggerSync(currentUserId);

    } catch (e) {
      console.error(e);
      alert('Không thể lưu từ vựng!');
    }
  };

  // Phân tích và thêm từ hàng loạt (Bulk Import)
  const handleBulkImport = async () => {
    const words = bulkText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (words.length === 0) {
      alert('Vui lòng nhập danh sách từ, mỗi từ một dòng!');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/vocab/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ words })
      });
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        const nowStr = new Date().toISOString();
        
        for (const item of json.data) {
          const id = crypto.randomUUID();
          const newVocab: LocalVocabulary = {
            id,
            user_id: currentUserId,
            word: item.word,
            reading: item.reading || undefined,
            meaning_vi: item.meaning_vi || 'Chưa rõ nghĩa',
            example_ja: item.example_ja || undefined,
            example_vi: item.example_vi || undefined,
            tags: item.tags || [],
            source: 'Bulk Import',
            status: 'new',
            created_at: nowStr,
            updated_at: nowStr,
            next_review_at: nowStr,
            interval_days: 0,
            ease_factor: 2.5,
            synced: false
          };
          await saveVocabulary(newVocab);
        }

        await loadLocalData(currentUserId);
        setShowAddModal(false);
        setBulkText('');
        alert(`Đã thêm thành công ${json.data.length} từ vào danh sách!`);
        
        // Tự động sync
        triggerSync(currentUserId);
      } else {
        alert(json.error || 'Lỗi phân tích hàng loạt');
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi hệ thống khi phân tích hàng loạt!');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Xóa từ vựng
  const handleDeleteVocab = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa từ vựng này và toàn bộ lịch sử ôn tập của nó?')) {
      return;
    }

    try {
      // 1. Xóa ở local IndexedDB
      await deleteVocabulary(id);

      // 2. Nếu đã đăng nhập, xóa trên Cloud qua API
      if (currentUserId !== LOCAL_USER_ID) {
        const res = await fetch('/api/vocab/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          console.warn('Không thể xóa trên Cloud ngay lúc này, sẽ đồng bộ lại sau.');
        }
      }

      await loadLocalData(currentUserId);
      setShowDetailModal(false);
      setSelectedVocab(null);
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xóa từ vựng!');
    }
  };

  // Xem chi tiết từ vựng
  const handleOpenDetail = async (vocab: LocalVocabulary) => {
    setSelectedVocab(vocab);
    setIsEditing(false);
    try {
      const history = await getReviewsForVocab(vocab.id);
      setSelectedVocabReviews(history.sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()));
    } catch (e) {
      console.error(e);
    }
    setShowDetailModal(true);
  };

  // --- 5. HỆ THỐNG ÔN TẬP (SPACED REPETITION ACTIVE RECALL) ---
  const handleStartReview = () => {
    if (pendingReviews.length === 0) {
      alert('Hôm nay bạn không có từ nào cần ôn tập! Bạn có thể thêm từ mới.');
      return;
    }
    
    // Trộn ngẫu nhiên danh sách ôn tập hôm nay
    const queue = [...pendingReviews].sort(() => 0.5 - Math.random());
    setReviewQueue(queue);
    setCurrentReviewIdx(0);
    setIsCardFlipped(false);
    setShowReviewView(true);
  };

  // Thuật toán chấm điểm Heuristic Spaced Repetition (Simple Scheduler)
  const handleReviewAnswer = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    const vocab = reviewQueue[currentReviewIdx];
    if (!vocab) return;

    let nextInterval = 0;
    let nextEaseFactor = vocab.ease_factor;
    let nextStatus: 'new' | 'learning' | 'familiar' | 'strong' = vocab.status;

    const currentInterval = vocab.interval_days;

    switch (rating) {
      case 'again':
        nextInterval = 1;
        nextEaseFactor = Math.max(1.3, vocab.ease_factor - 0.2);
        nextStatus = 'learning';
        break;
      case 'hard':
        nextInterval = currentInterval === 0 ? 2 : Math.max(2, Math.round(currentInterval * 1.2));
        nextEaseFactor = Math.max(1.3, vocab.ease_factor - 0.15);
        nextStatus = 'learning';
        break;
      case 'good':
        if (currentInterval === 0) {
          nextInterval = 5;
        } else if (currentInterval === 5) {
          nextInterval = 10;
        } else {
          nextInterval = Math.round(currentInterval * vocab.ease_factor);
        }
        nextStatus = 'familiar';
        break;
      case 'easy':
        if (currentInterval === 0) {
          nextInterval = 14;
        } else {
          nextInterval = Math.round(currentInterval * vocab.ease_factor * 1.3);
        }
        nextEaseFactor = vocab.ease_factor + 0.15;
        nextStatus = 'strong';
        break;
    }

    const now = new Date();
    const nowStr = now.toISOString();
    const nextReviewDateStr = addDays(now, nextInterval).toISOString();

    // 1. Cập nhật từ vựng
    const updatedVocab: LocalVocabulary = {
      ...vocab,
      status: nextStatus,
      interval_days: nextInterval,
      ease_factor: nextEaseFactor,
      next_review_at: nextReviewDateStr,
      updated_at: nowStr,
      synced: false
    };

    // 2. Ghi lịch sử review
    const newReview: LocalReview = {
      id: crypto.randomUUID(),
      vocabulary_id: vocab.id,
      user_id: currentUserId,
      reviewed_at: nowStr,
      rating,
      interval_before: currentInterval,
      interval_after: nextInterval,
      synced: false
    };

    try {
      await saveVocabulary(updatedVocab);
      await saveReview(newReview);
      
      // Tăng số lượng đã ôn hôm nay
      setReviewCountToday(prev => prev + 1);

      // Sang thẻ tiếp theo
      setIsCardFlipped(false);
      
      // Đợi hiệu ứng lật thẻ hoàn tất
      setTimeout(async () => {
        if (currentReviewIdx < reviewQueue.length - 1) {
          setCurrentReviewIdx(prev => prev + 1);
        } else {
          // Hoàn thành toàn bộ queue
          alert('Chúc mừng! Bạn đã hoàn thành tất cả các từ cần ôn tập hôm nay! 🎉');
          setShowReviewView(false);
          await loadLocalData(currentUserId);
          // Sync lên cloud
          triggerSync(currentUserId);
        }
      }, 300);

    } catch (e) {
      console.error(e);
      alert('Không thể lưu kết quả review!');
    }
  };

  // --- 6. AI QUIZ VÀ AI CONVERSATION HỘ TRỢ HỌC SÂU ---
  // Tạo Quiz từ danh sách từ vựng thêm mới hôm nay
  const handleGenerateQuiz = async () => {
    // Lấy các từ thêm hôm nay
    const todayVocabs = vocabList.filter(v => format(parseISO(v.created_at), 'yyyy-MM-dd') === todayStr);
    
    // Nếu hôm nay không có từ mới, lấy ngẫu nhiên 3 từ bất kỳ để ôn tập
    const targetVocabs = todayVocabs.length > 0 ? todayVocabs : vocabList.sort(() => 0.5 - Math.random()).slice(0, 4);

    if (targetVocabs.length === 0) {
      alert('Hệ thống cần ít nhất 1 từ vựng trong danh sách để tạo Quiz!');
      return;
    }

    setIsGeneratingQuiz(true);
    setShowQuizModal(true);
    setQuizQuestions([]);
    setCurrentQuizIdx(0);
    setSelectedQuizAnswer(null);
    setShowQuizExplain(false);
    setQuizScore(0);

    try {
      const response = await fetch('/api/vocab/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabItems: targetVocabs })
      });
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setQuizQuestions(json.data);
      } else {
        alert(json.error || 'Lỗi khi tạo câu hỏi Quiz.');
        setShowQuizModal(false);
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối khi tạo Quiz.');
      setShowQuizModal(false);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSelectQuizAnswer = (idx: number) => {
    if (selectedQuizAnswer !== null) return; // Đã trả lời câu này
    setSelectedQuizAnswer(idx);
    setShowQuizExplain(true);
    
    const currentQuestion = quizQuestions[currentQuizIdx];
    if (idx === currentQuestion.correctIndex) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleNextQuiz = () => {
    setSelectedQuizAnswer(null);
    setShowQuizExplain(false);
    setCurrentQuizIdx(prev => prev + 1);
  };

  // Tạo đoạn hội thoại AI
  const handleGenerateDialogue = async () => {
    const todayVocabs = vocabList.filter(v => format(parseISO(v.created_at), 'yyyy-MM-dd') === todayStr);
    const targetVocabs = todayVocabs.length > 0 ? todayVocabs : vocabList.sort(() => 0.5 - Math.random()).slice(0, 4);

    if (targetVocabs.length === 0) {
      alert('Hệ thống cần ít nhất 1 từ vựng để tạo đoạn hội thoại!');
      return;
    }

    setIsGeneratingDialogue(true);
    setShowDialogueModal(true);
    setDialogueData(null);

    try {
      const response = await fetch('/api/vocab/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabItems: targetVocabs })
      });
      const json = await response.json();
      if (json.success && json.data) {
        setDialogueData(json.data);
      } else {
        alert(json.error || 'Lỗi khi tạo đoạn hội thoại.');
        setShowDialogueModal(false);
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối khi tạo hội thoại.');
      setShowDialogueModal(false);
    } finally {
      setIsGeneratingDialogue(false);
    }
  };

  // Phát phát âm qua SpeechSynthesis API
  const playSpeech = (text: string) => {
    if (typeof window === 'undefined') return;
    const cleanText = text.replace(/<\/?[^>]+(>|$)/g, ""); // Xóa HTML tags nếu có
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ja-JP';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6">
      
      {/* ===== TOP BAR (USER INFO & SYNC STATUS) ===== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-800">
              {user ? user.email : 'Tài khoản Local (Offline)'}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-500' :
                syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' :
                syncStatus === 'error' ? 'bg-red-500' : 'bg-slate-400'
              }`} />
              {syncStatus === 'synced' && 'Đã đồng bộ với Cloud'}
              {syncStatus === 'syncing' && 'Đang đồng bộ dữ liệu...'}
              {syncStatus === 'error' && 'Đồng bộ thất bại'}
              {syncStatus === 'offline' && 'Hoạt động offline'}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {user && (
            <button 
              onClick={() => triggerSync(user.id)}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              Đồng bộ ngay
            </button>
          )}
        </div>
      </div>

      {syncStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{syncMessage}. Vui lòng kiểm tra lại kết nối mạng hoặc credentials.</span>
        </div>
      )}

      {/* ===== DASHBOARD (MỤC TIÊU & STREAK) ===== */}
      {!showReviewView && (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Cột 1: Tiến trình KPI Tháng */}
            <div className="bg-gradient-to-br from-white to-blue-50/20 p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mục tiêu {format(new Date(), 'MM/yyyy')}</span>
                  <Award className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2">100 từ mới</h3>
                <div className="flex justify-between items-end mt-4 mb-1.5 text-xs text-slate-500 font-semibold">
                  <span>Tiến độ: {kpiCount} / {kpiTarget} từ</span>
                  <span>{kpiPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div 
                    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700 shadow-sm"
                    style={{ width: `${kpiPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                {averageNeededPerDay > 0 ? (
                  <span>Cần học: <strong className="text-blue-600 font-extrabold">{averageNeededPerDay}</strong> từ/ngày</span>
                ) : (
                  <span className="text-green-600 font-bold">🎉 Đạt mục tiêu tháng!</span>
                )}
                <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                  {differenceInDays(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), new Date()) + 1} ngày còn lại
                </span>
              </div>
            </div>

            {/* Cột 2: KPI Chất lượng & Ôn tập */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">KPI Chất lượng</span>
                  <History className="w-5 h-5 text-indigo-500" />
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2">Ôn tập ≥ 2 lần</h3>
                <div className="flex justify-between items-end mt-4 mb-1.5 text-xs text-slate-500 font-semibold">
                  <span>Tỉ lệ ôn tập chất lượng:</span>
                  <span className={qualityKpi.percent >= 70 ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
                    {qualityKpi.percent}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-700 shadow-sm ${
                      qualityKpi.percent >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}
                    style={{ width: `${qualityKpi.percent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                <span>Đã ôn: <strong>{qualityKpi.reviewedTwice}</strong> / {qualityKpi.total} từ mới</span>
                <span className="text-[10px] text-slate-400">(Mục tiêu ≥ 70%)</span>
              </div>
            </div>

            {/* Cột 3: Trạng thái & Streak */}
            <div className="bg-gradient-to-br from-white to-amber-50/10 p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Streak hiện tại</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Flame className={`w-8 h-8 ${streak > 0 ? 'text-orange-500 animate-bounce' : 'text-slate-300'}`} />
                    <span className="text-3xl font-extrabold text-slate-900">{streak} ngày</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-medium">Hôm nay đã ôn</div>
                  <div className="text-lg font-bold text-indigo-600">{reviewCountToday} từ</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100" title="Mới thêm">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">New</div>
                  <div className="text-sm font-bold text-slate-700">{statusStats.new}</div>
                </div>
                <div className="bg-blue-50/50 p-1.5 rounded-xl border border-blue-100/50" title="Đang học">
                  <div className="text-[10px] text-blue-500 font-semibold uppercase">Learn</div>
                  <div className="text-sm font-bold text-blue-700">{statusStats.learning}</div>
                </div>
                <div className="bg-teal-50/50 p-1.5 rounded-xl border border-teal-100/50" title="Đã thuộc">
                  <div className="text-[10px] text-teal-600 font-semibold uppercase">Fami</div>
                  <div className="text-sm font-bold text-teal-700">{statusStats.familiar}</div>
                </div>
                <div className="bg-indigo-50/50 p-1.5 rounded-xl border border-indigo-100/50" title="Rất nhớ">
                  <div className="text-[10px] text-indigo-600 font-semibold uppercase">Stro</div>
                  <div className="text-sm font-bold text-indigo-700">{statusStats.strong}</div>
                </div>
              </div>
            </div>

          </div>

          {/* ===== HÀNH ĐỘNG HÀNG NGÀY & BIỂU ĐỒ ===== */}
          <div className="grid md:grid-cols-5 gap-6">
            
            {/* Ôn tập & Thêm mới Actions */}
            <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center gap-4">
              <button 
                onClick={handleStartReview}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-bold transition-all shadow-md shadow-indigo-100 group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm">Ôn tập hôm nay</div>
                    <div className="text-xs text-white/80 font-normal">Cần ôn: {pendingReviews.length} từ</div>
                  </div>
                </div>
                <div className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold group-hover:scale-105 transition-all">
                  Bắt đầu
                </div>
              </button>

              <button 
                onClick={handleOpenAddModal}
                className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/10 text-slate-800 rounded-2xl font-bold transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm">Thêm từ mới</div>
                    <div className="text-xs text-slate-400 font-normal">AI phân tích / Nhập hàng loạt</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Biểu đồ số từ mới theo ngày */}
            <div className="md:col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Số từ mới 7 ngày qua
                </span>
                {selectedDateFilter && (
                  <button 
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Xem tất cả ngày
                  </button>
                )}
              </div>
              
              <div className="flex items-end justify-between h-28 gap-2 pt-2">
                {chartData.map((d, idx) => {
                  const isSelected = selectedDateFilter === d.dateStr;
                  const maxCount = Math.max(...chartData.map(cd => cd.count), 1);
                  const heightPercent = Math.max(10, Math.round((d.count / maxCount) * 80));

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDateFilter(isSelected ? null : d.dateStr)}
                      className="flex-1 flex flex-col items-center gap-2 group"
                    >
                      <div className="w-full bg-slate-50 group-hover:bg-slate-100 rounded-lg h-24 flex items-end relative overflow-hidden transition-all">
                        <div 
                          className={`w-full rounded-t-lg transition-all duration-500 ${
                            isSelected 
                              ? 'bg-gradient-to-t from-blue-600 to-indigo-500' 
                              : 'bg-gradient-to-t from-slate-300 to-slate-400 group-hover:from-blue-400 group-hover:to-indigo-300'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-600 group-hover:scale-110 transition-all">
                          {d.count}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                        {d.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ===== AI PRACTICE WORKSHOP (QUIZ & CONVERSATION) ===== */}
          <div className="bg-gradient-to-r from-blue-50/40 via-indigo-50/20 to-white p-6 rounded-3xl border border-blue-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-100">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-1.5">
                  Xưởng Luyện Tập AI
                </h4>
                <p className="text-sm text-slate-500">
                  Sử dụng các từ vựng của ngày hôm nay để sinh Quiz thông minh hoặc đoạn hội thoại thực tế nhằm học sâu hơn.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleGenerateQuiz}
                className="px-4 py-2.5 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                Luyện Quiz AI
              </button>
              
              <button
                onClick={handleGenerateDialogue}
                className="px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-700 text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Volume2 className="w-4 h-4" />
                Đoạn Hội Thoại AI
              </button>
            </div>
          </div>

          {/* ===== DANH SÁCH TỪ VỰNG & BỘ LỌC ===== */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
            
            {/* Bộ Lọc (Filters) */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between">
              
              {/* Ô tìm kiếm & Trạng thái */}
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm từ vựng, cách đọc hoặc nghĩa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-sm transition-all focus:outline-none"
                  />
                </div>
                
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-sm transition-all focus:outline-none font-semibold text-slate-600"
                >
                  <option value="all">Tất cả Trạng thái</option>
                  <option value="new">🆕 Mới thêm (New)</option>
                  <option value="learning">🟡 Đang học (Learning)</option>
                  <option value="familiar">🟢 Đã thuộc (Familiar)</option>
                  <option value="strong">🔵 Nhớ sâu (Strong)</option>
                </select>
              </div>

              {/* Lọc Tag */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <button
                  onClick={() => setSelectedTag('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedTag === 'all' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Tất cả Tags
                </button>
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedTag === tag 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>

            </div>

            {selectedDateFilter && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex justify-between items-center text-sm text-blue-800">
                <span>Đang xem danh sách từ được thêm vào ngày: <strong>{format(parseISO(selectedDateFilter), 'dd/MM/yyyy')}</strong> ({filteredVocabList.length} từ)</span>
                <button 
                  onClick={() => setSelectedDateFilter(null)}
                  className="bg-white px-2 py-1 rounded-lg text-xs font-bold border border-blue-200 hover:bg-blue-100/50"
                >
                  Đóng lọc ngày
                </button>
              </div>
            )}

            {/* Danh sách từ vựng */}
            {isLoadingVocab ? (
              <div className="p-12 text-center text-slate-400 animate-pulse font-medium">
                Đang tải dữ liệu từ vựng...
              </div>
            ) : groupedVocabList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 border border-dashed rounded-2xl bg-slate-50">
                Không tìm thấy từ vựng nào khớp với bộ lọc.
              </div>
            ) : (
              <div className="space-y-8">
                {groupedVocabList.map(group => (
                  <div key={group.date} className="space-y-3">
                    <h5 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 border-b pb-2 border-slate-100">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {group.date} <span className="text-xs font-semibold text-slate-400">({group.items.length} từ)</span>
                    </h5>
                    
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.items.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleOpenDetail(item)}
                          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden"
                        >
                          {/* Sync status ở góc card */}
                          {!item.synced && (
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" title="Chưa đồng bộ lên Cloud" />
                          )}

                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {item.reading || '...'}
                              </span>
                              
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.status === 'new' ? 'bg-slate-100 text-slate-500' :
                                item.status === 'learning' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                                item.status === 'familiar' ? 'bg-teal-50 text-teal-600 border border-teal-100' :
                                'bg-indigo-50 text-indigo-600 border border-indigo-100'
                              }`}>
                                {item.status === 'new' ? 'NEW' :
                                 item.status === 'learning' ? 'LEARNING' :
                                 item.status === 'familiar' ? 'FAMILIAR' : 'STRONG'}
                              </span>
                            </div>
                            
                            <h4 className="text-xl font-bold text-slate-850 group-hover:text-blue-600 transition-all mt-1">
                              {item.word}
                            </h4>
                            
                            <p className="text-sm text-slate-500 line-clamp-2 mt-1">
                              {item.meaning_vi}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2 text-xs text-slate-400 font-medium">
                            <div className="flex flex-wrap gap-1">
                              {item.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="bg-slate-50 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-450 border border-slate-100">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <span>
                              Ôn: {item.interval_days} ngày
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </>
      )}

      {/* ===== REVIEW SYSTEM (FLASHCARD SCREEN) ===== */}
      {showReviewView && (
        <div className="max-w-xl mx-auto bg-white p-6 md:p-8 rounded-3xl shadow-md border border-slate-200 flex flex-col items-center gap-8 animate-in fade-in duration-300">
          
          <div className="w-full flex justify-between items-center border-b pb-4 border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Ôn tập Hôm nay</h3>
              <p className="text-xs text-slate-400 font-medium">Tiến trình: {currentReviewIdx + 1} / {reviewQueue.length} từ</p>
            </div>
            <button 
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn dừng buổi ôn tập hôm nay? Lịch sử ôn tập hiện tại đã được ghi nhận.')) {
                  setShowReviewView(false);
                  loadLocalData(currentUserId);
                }
              }}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Flashcard wrapper */}
          <div 
            className="w-full aspect-[4/3] relative cursor-pointer perspective-1000"
            onClick={() => setIsCardFlipped(!isCardFlipped)}
          >
            <div className={`w-full h-full relative transition-all duration-500 preserve-3d shadow-xl rounded-3xl ${
              isCardFlipped ? 'rotate-y-180' : ''
            }`}>
              
              {/* Mặt trước card */}
              <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-white to-blue-50/10 rounded-3xl flex flex-col items-center justify-between p-8 border-2 border-slate-100">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full">
                  Mặt trước
                </span>
                
                <div className="text-center space-y-2">
                  <div className="text-5xl font-extrabold text-slate-800">
                    {reviewQueue[currentReviewIdx]?.word}
                  </div>
                  {reviewQueue[currentReviewIdx]?.reading && (
                    <div className="text-lg text-slate-400 font-semibold tracking-wider">
                      {reviewQueue[currentReviewIdx]?.reading}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <button 
                    onClick={(e) => { e.stopPropagation(); playSpeech(reviewQueue[currentReviewIdx]?.word); }}
                    className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full transition-colors mb-2"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-medium italic">Click để xem Nghĩa và Ví dụ</span>
                </div>
              </div>

              {/* Mặt sau card */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-850 rounded-3xl flex flex-col items-center justify-between p-6 md:p-8 border-2 border-slate-700 overflow-y-auto">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-slate-800 px-2.5 py-1 rounded-full">
                  Mặt sau
                </span>

                <div className="text-center space-y-4 w-full">
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase">Nghĩa tiếng Việt</span>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {reviewQueue[currentReviewIdx]?.meaning_vi}
                    </h3>
                  </div>

                  {reviewQueue[currentReviewIdx]?.example_ja && (
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/50 text-left space-y-1 max-w-sm mx-auto">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide block">Ví dụ</span>
                      <div className="text-sm font-semibold text-blue-200">
                        {reviewQueue[currentReviewIdx]?.example_ja}
                      </div>
                      {reviewQueue[currentReviewIdx]?.example_vi && (
                        <div className="text-xs text-slate-400">
                          {reviewQueue[currentReviewIdx]?.example_vi}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); playSpeech(reviewQueue[currentReviewIdx]?.word); }}
                  className="p-3 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-full transition-colors"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

            </div>
          </div>

          {/* Controls - Hiện đáp án hoặc 4 mức chấm điểm */}
          <div className="w-full">
            {!isCardFlipped ? (
              <button
                onClick={() => setIsCardFlipped(true)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-blue-150"
              >
                Hiện đáp án
              </button>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="text-center text-xs font-bold text-slate-450 uppercase tracking-wider">
                  Bạn nhớ từ này ở mức độ nào?
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleReviewAnswer('again')}
                    className="flex flex-col items-center p-2.5 bg-red-50 hover:bg-red-150 border border-red-200/50 text-red-700 rounded-2xl transition-all"
                  >
                    <span className="text-lg">😵</span>
                    <span className="text-xs font-bold mt-1">Quên</span>
                    <span className="text-[9px] text-red-500 mt-0.5">1 ngày</span>
                  </button>
                  <button
                    onClick={() => handleReviewAnswer('hard')}
                    className="flex flex-col items-center p-2.5 bg-amber-50 hover:bg-amber-150 border border-amber-200/50 text-amber-700 rounded-2xl transition-all"
                  >
                    <span className="text-lg">😐</span>
                    <span className="text-xs font-bold mt-1">Khó</span>
                    <span className="text-[9px] text-amber-500 mt-0.5">2 ngày</span>
                  </button>
                  <button
                    onClick={() => handleReviewAnswer('good')}
                    className="flex flex-col items-center p-2.5 bg-emerald-50 hover:bg-emerald-150 border border-emerald-200/50 text-emerald-700 rounded-2xl transition-all"
                  >
                    <span className="text-lg">🙂</span>
                    <span className="text-xs font-bold mt-1">Nhớ</span>
                    <span className="text-[9px] text-emerald-500 mt-0.5">Good</span>
                  </button>
                  <button
                    onClick={() => handleReviewAnswer('easy')}
                    className="flex flex-col items-center p-2.5 bg-indigo-50 hover:bg-indigo-150 border border-indigo-200/50 text-indigo-700 rounded-2xl transition-all"
                  >
                    <span className="text-lg">😎</span>
                    <span className="text-xs font-bold mt-1">Dễ</span>
                    <span className="text-[9px] text-indigo-500 mt-0.5">Easy</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Auth Modal đã được loại bỏ và chuyển sang AuthGuard toàn cục */}

      {/* ===== MODAL: FORM THÊM MỚI / SỬA TỪ VỰNG ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-between items-center border-b pb-3 border-slate-150">
              <h3 className="font-extrabold text-2xl text-slate-800">
                {isEditing ? '✏️ Chỉnh sửa từ vựng' : '＋ Thêm từ mới'}
              </h3>
              {!isEditing && (
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button 
                    onClick={() => setIsBulkAdd(false)}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all ${!isBulkAdd ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    Thêm một từ
                  </button>
                  <button 
                    onClick={() => setIsBulkAdd(true)}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all ${isBulkAdd ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    Nhập hàng loạt
                  </button>
                </div>
              )}
            </div>

            {isBulkAdd ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Danh sách từ (Mỗi từ 1 dòng)</label>
                  <textarea
                    rows={6}
                    placeholder="ví dụ:&#10;認識齟齬&#10;取りまとめる&#10;あいにく"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-400 italic">
                    App sẽ gửi danh sách từ qua OpenAI/Gemini để phân tích tự động (reading, meaning, ví dụ...) và tạo vocab cards ngay lập tức.
                  </p>
                </div>
                <button
                  onClick={handleBulkImport}
                  disabled={isAnalyzing}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  ✨ AI phân tích và lưu từ vựng
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveVocab} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Từ / Cụm từ</label>
                    <input
                      type="text"
                      required
                      placeholder="ví dụ: 認識齟齬"
                      value={formWord}
                      onChange={(e) => setFormWord(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 flex items-end">
                    <button
                      type="button"
                      onClick={handleAIAnalyze}
                      disabled={isAnalyzing}
                      className="w-full py-2.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 text-blue-700 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI Phân tích
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Cách đọc (Furigana / Romaji)</label>
                    <input
                      type="text"
                      placeholder="ví dụ: にんしきそご"
                      value={formReading}
                      onChange={(e) => setFormReading(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nguồn (Ví dụ: Notion, meeting...)</label>
                    <input
                      type="text"
                      placeholder="ví dụ: Business Meeting"
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nghĩa tiếng Việt</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: Khác biệt trong nhận thức"
                    value={formMeaning}
                    onChange={(e) => setFormMeaning(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Câu ví dụ tiếng Nhật</label>
                    <input
                      type="text"
                      placeholder="両者の認識齟齬を解消する必要があります。"
                      value={formExampleJa}
                      onChange={(e) => setFormExampleJa(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nghĩa câu ví dụ</label>
                    <input
                      type="text"
                      placeholder="Cần giải quyết sự khác biệt trong nhận thức giữa hai bên."
                      value={formExampleVi}
                      onChange={(e) => setFormExampleVi(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Phân loại Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nhãn phân loại (Tags)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map(tag => {
                      const isSelected = formTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            isSelected 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-350'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm text-slate-650 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all"
                  >
                    {isEditing ? 'Lưu thay đổi' : '＋ Lưu từ vựng'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ===== MODAL: CHI TIẾT TỪ VỰNG & LỊCH SỬ REVIEW ===== */}
      {showDetailModal && selectedVocab && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
            <button 
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Chi tiết từ */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                {selectedVocab.reading || 'Không có cách đọc'}
              </span>
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-extrabold text-slate-800">
                  {selectedVocab.word}
                </h3>
                <button 
                  onClick={() => playSpeech(selectedVocab.word)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-lg font-bold text-slate-700 pt-1">
                {selectedVocab.meaning_vi}
              </p>
            </div>

            {/* Tags & Source */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phân loại</span>
                <div className="flex flex-wrap gap-1">
                  {selectedVocab.tags?.length > 0 ? (
                    selectedVocab.tags.map(tag => (
                      <span key={tag} className="bg-white px-2 py-0.5 border rounded text-[10px] font-bold text-slate-600">
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Không có tag</span>
                  )}
                </div>
              </div>

              {selectedVocab.source && (
                <div className="text-right space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Nguồn</span>
                  <span className="font-semibold text-slate-600 bg-white border px-2 py-0.5 rounded">
                    {selectedVocab.source}
                  </span>
                </div>
              )}
            </div>

            {/* Ví dụ minh họa */}
            {selectedVocab.example_ja && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Ví dụ</span>
                <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50 space-y-1">
                  <div className="font-semibold text-slate-800 text-base">
                    {selectedVocab.example_ja}
                  </div>
                  {selectedVocab.example_vi && (
                    <div className="text-sm text-slate-500">
                      {selectedVocab.example_vi}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lịch sử ôn tập & thông tin Spaced Repetition */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-455 uppercase tracking-wider flex items-center gap-1">
                <History className="w-4 h-4 text-slate-400" /> Tiến độ & Lịch sử học
              </span>
              
              <div className="grid grid-cols-3 gap-3 text-center border p-4 rounded-2xl bg-white text-xs">
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[9px]">Khoảng cách ôn</div>
                  <div className="text-lg font-bold text-slate-700 mt-0.5">{selectedVocab.interval_days} ngày</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[9px]">Trạng thái</div>
                  <div className="text-lg font-bold text-indigo-600 mt-0.5 uppercase">{selectedVocab.status}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[9px]">Ôn tiếp theo</div>
                  <div className="text-xs font-bold text-slate-700 mt-1">
                    {format(parseISO(selectedVocab.next_review_at), 'dd/MM/yyyy')}
                  </div>
                </div>
              </div>

              {/* Bảng timeline review cũ */}
              {selectedVocabReviews.length > 0 ? (
                <div className="border rounded-2xl overflow-hidden max-h-32 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b font-bold text-slate-500">
                      <tr>
                        <th className="p-2">Ngày ôn</th>
                        <th className="p-2">Đánh giá</th>
                        <th className="p-2 text-right">Khoảng cách</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-600">
                      {selectedVocabReviews.map((rev, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          <td className="p-2">{format(parseISO(rev.reviewed_at), 'dd/MM/yyyy HH:mm')}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              rev.rating === 'again' ? 'bg-red-50 text-red-650' :
                              rev.rating === 'hard' ? 'bg-amber-50 text-amber-650' :
                              rev.rating === 'good' ? 'bg-emerald-50 text-emerald-650' :
                              'bg-indigo-50 text-indigo-650'
                            }`}>
                              {rev.rating.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-2 text-right">{rev.interval_before}d → {rev.interval_after}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Thẻ từ mới được tạo, chưa được ôn tập lần nào.</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4 border-t border-slate-100 justify-between">
              <button
                onClick={() => handleDeleteVocab(selectedVocab.id)}
                className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Xóa từ
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2.5 border hover:bg-slate-50 rounded-xl font-bold text-xs text-slate-600 transition-all"
                >
                  Đóng
                </button>
                <button
                  onClick={() => handleOpenEdit(selectedVocab)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
                >
                  <Edit3 className="w-4 h-4" /> Chỉnh sửa
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===== MODAL: LUYỆN QUIZ AI ===== */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-100 shadow-2xl relative space-y-6">
            <button 
              onClick={() => setShowQuizModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-extrabold text-2xl text-slate-800 flex items-center gap-2 border-b pb-3">
              <BookOpen className="w-6 h-6 text-blue-500" />
              Luyện Tập Quiz AI
            </h3>

            {isGeneratingQuiz ? (
              <div className="p-12 text-center text-slate-450 animate-pulse font-medium space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p>AI đang soạn câu hỏi trắc nghiệm dựa trên các từ vựng của bạn...</p>
              </div>
            ) : quizQuestions.length === 0 ? (
              <p className="p-4 text-center text-slate-500 italic">Không thể tạo quiz. Thử lại sau.</p>
            ) : currentQuizIdx >= quizQuestions.length ? (
              <div className="text-center py-6 space-y-4">
                <span className="text-5xl">🏆</span>
                <h4 className="text-xl font-bold text-slate-800">Hoàn thành Quiz!</h4>
                <p className="text-sm text-slate-500">Điểm số của bạn: <strong className="text-blue-600 text-lg font-extrabold">{quizScore} / {quizQuestions.length}</strong> câu trả lời đúng.</p>
                <button
                  onClick={() => setShowQuizModal(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Đóng Quiz
                </button>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in duration-350">
                <div className="flex justify-between items-center text-xs text-slate-400 font-bold uppercase">
                  <span>Câu hỏi {currentQuizIdx + 1} / {quizQuestions.length}</span>
                  <span>Điểm: {quizScore}</span>
                </div>
                
                <h4 className="font-bold text-slate-800 text-lg leading-relaxed">
                  {quizQuestions[currentQuizIdx].question}
                </h4>

                <div className="grid gap-2.5">
                  {quizQuestions[currentQuizIdx].options.map((opt: string, oIdx: number) => {
                    const isSelected = selectedQuizAnswer === oIdx;
                    const isCorrect = quizQuestions[currentQuizIdx].correctIndex === oIdx;
                    const hasAnswered = selectedQuizAnswer !== null;

                    return (
                      <button
                        key={oIdx}
                        disabled={hasAnswered}
                        onClick={() => handleSelectQuizAnswer(oIdx)}
                        className={`w-full p-4 rounded-xl border text-left text-sm transition-all flex items-start gap-3 ${
                          isSelected
                            ? isCorrect
                              ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-500/10'
                              : 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/10'
                            : hasAnswered && isCorrect
                              ? 'bg-green-50 border-green-300 text-green-700'
                              : 'bg-slate-50 border-slate-200 hover:bg-blue-50/30'
                        }`}
                      >
                        <span className={`w-5.5 h-5.5 rounded-full border flex-shrink-0 flex items-center justify-center font-bold text-xs mt-0.5 ${
                          isSelected
                            ? isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            : hasAnswered && isCorrect
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-slate-400'
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {showQuizExplain && (
                  <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-2xl text-xs text-yellow-800 animate-in slide-in-from-top-2">
                    <span className="font-bold block mb-1">💡 Giải thích:</span>
                    <p className="whitespace-pre-wrap">{quizQuestions[currentQuizIdx].explain}</p>
                  </div>
                )}

                {selectedQuizAnswer !== null && (
                  <button
                    onClick={handleNextQuiz}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    {currentQuizIdx === quizQuestions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}
                  </button>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MODAL: ĐOẠN HỘI THOẠI AI ===== */}
      {showDialogueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full border border-slate-100 shadow-2xl relative space-y-6">
            <button 
              onClick={() => setShowDialogueModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-extrabold text-2xl text-slate-800 flex items-center gap-2 border-b pb-3">
              <Volume2 className="w-6 h-6 text-indigo-500" />
              Đoạn Hội Thoại AI Thực Tế
            </h3>

            {isGeneratingDialogue ? (
              <div className="p-12 text-center text-slate-450 animate-pulse font-medium space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                <p>AI đang viết đoạn hội thoại chứa các từ vựng đã học...</p>
              </div>
            ) : !dialogueData ? (
              <p className="p-4 text-center text-slate-500 italic">Không thể tạo đoạn hội thoại. Thử lại sau.</p>
            ) : (
              <div className="space-y-5 animate-in fade-in duration-350 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">
                    {dialogueData.title}
                  </h4>
                  <p className="text-xs text-slate-400 italic mt-0.5">
                    {dialogueData.context}
                  </p>
                </div>

                <div className="space-y-4">
                  {dialogueData.dialogue.map((line: any, idx: number) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {line.speaker}
                        </span>
                        <button 
                          onClick={() => playSpeech(line.japanese)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Nghe phát âm"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="pl-2 border-l-2 border-slate-200 space-y-0.5">
                        <p 
                          className="font-semibold text-slate-800 text-sm"
                          dangerouslySetInnerHTML={{ __html: line.japanese }}
                        />
                        {line.reading && (
                          <p className="text-[10px] text-slate-400 tracking-wide font-medium">
                            {line.reading}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          {line.vietnamese}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowDialogueModal(false)}
                  className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all"
                >
                  Đóng hội thoại
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
