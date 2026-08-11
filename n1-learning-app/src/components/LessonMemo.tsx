'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  NotebookPen,
  ImagePlus,
  Trash2,
  Save,
  X,
  Pencil,
  Loader2,
  CloudOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { getMemo, saveMemo, deleteMemo, lessonKey, LocalMemo } from '../lib/indexedDbHelper';
import { syncLessonData } from '../lib/syncEngine';
import { compressImage, dataUrlBytes, formatBytes, MAX_IMAGES_PER_MEMO } from '../lib/imageHelper';
import { useAuth } from './AuthGuard';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function LessonMemo({ lessonId }: { lessonId: string }) {
  const { user } = useAuth();

  const [memo, setMemo] = useState<LocalMemo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bản nháp khi đang sửa, chỉ ghi vào memo thật lúc bấm Lưu
  const [draftContent, setDraftContent] = useState('');
  const [draftImages, setDraftImages] = useState<string[]>([]);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [processingImage, setProcessingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Nạp memo đã lưu của bài học này
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) return;
      try {
        const saved = await getMemo(user.id, lessonId);
        if (cancelled) return;
        setMemo(saved);
        setDraftContent(saved?.content || '');
        setDraftImages(saved?.images || []);
      } catch (e) {
        console.error('Lỗi khi đọc memo:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, lessonId]);

  const addImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setErrorMsg('');

      const room = MAX_IMAGES_PER_MEMO - draftImages.length;
      if (room <= 0) {
        setErrorMsg(`Mỗi memo chỉ lưu tối đa ${MAX_IMAGES_PER_MEMO} ảnh.`);
        return;
      }

      setProcessingImage(true);
      const accepted: string[] = [];

      for (const file of files.slice(0, room)) {
        try {
          accepted.push(await compressImage(file));
        } catch (e: any) {
          setErrorMsg(e.message || 'Không xử lý được ảnh.');
        }
      }

      if (accepted.length > 0) setDraftImages((prev) => [...prev, ...accepted]);
      if (files.length > room) {
        setErrorMsg(`Chỉ thêm được ${room} ảnh nữa (tối đa ${MAX_IMAGES_PER_MEMO} ảnh mỗi memo).`);
      }
      setProcessingImage(false);
    },
    [draftImages.length]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await addImages(files);
    // Reset để chọn lại đúng file vừa xoá vẫn kích hoạt onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Dán ảnh trực tiếp từ clipboard (Ctrl+V) khi đang gõ ghi chú
  const handlePaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    await addImages(files);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaveState('saving');
    setErrorMsg('');

    const now = new Date().toISOString();
    const updated: LocalMemo = {
      id: lessonKey(user.id, lessonId),
      user_id: user.id,
      lesson_id: lessonId,
      content: draftContent,
      images: draftImages,
      created_at: memo?.created_at || now,
      updated_at: now,
      synced: false,
    };

    try {
      await saveMemo(updated);
      setMemo(updated);
      setIsEditing(false);

      // Lưu local xong là coi như an toàn; đẩy lên cloud ở bước sau, lỗi mạng
      // không được làm mất ghi chú vừa viết.
      setSaveState('saved');
      const res = await syncLessonData(user.id);
      if (!res.success) {
        setSaveState('error');
        setErrorMsg(`Đã lưu trên máy nhưng chưa đồng bộ lên cloud: ${res.message}`);
      } else {
        const fresh = await getMemo(user.id, lessonId);
        if (fresh) setMemo(fresh);
      }
    } catch (e: any) {
      setSaveState('error');
      setErrorMsg(e.message || 'Không lưu được ghi chú.');
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!window.confirm('Xoá toàn bộ ghi chú của bài học này?')) return;

    try {
      // Xoá nội dung nhưng vẫn giữ bản ghi để lần sync sau ghi đè được bản trên cloud.
      const now = new Date().toISOString();
      const emptied: LocalMemo = {
        id: lessonKey(user.id, lessonId),
        user_id: user.id,
        lesson_id: lessonId,
        content: '',
        images: [],
        created_at: memo?.created_at || now,
        updated_at: now,
        synced: false,
      };
      await saveMemo(emptied);
      await syncLessonData(user.id);
      await deleteMemo(user.id, lessonId);

      setMemo(null);
      setDraftContent('');
      setDraftImages([]);
      setIsEditing(false);
      setSaveState('idle');
    } catch (e: any) {
      setErrorMsg(e.message || 'Không xoá được ghi chú.');
    }
  };

  const startEditing = () => {
    setDraftContent(memo?.content || '');
    setDraftImages(memo?.images || []);
    setErrorMsg('');
    setSaveState('idle');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftContent(memo?.content || '');
    setDraftImages(memo?.images || []);
    setErrorMsg('');
    setIsEditing(false);
  };

  if (!user) return null;

  const hasMemo = !!memo && (memo.content.trim().length > 0 || memo.images.length > 0);
  const draftBytes = draftImages.reduce((sum, img) => sum + dataUrlBytes(img), 0);

  return (
    <section className="mt-10 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-4 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2.5">
          <NotebookPen className="w-5 h-5 text-amber-600" />
          <div>
            <h2 className="font-bold text-amber-900">Memo bài học</h2>
            <p className="text-xs text-amber-700/80">Ghi chú riêng của bạn, tự đồng bộ lên cloud</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {memo && !memo.synced && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full"
              title="Đã lưu trên máy, chờ đồng bộ lên cloud"
            >
              <CloudOff className="w-3.5 h-3.5" /> Chờ đồng bộ
            </span>
          )}
          {!isEditing && (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors"
            >
              <Pencil className="w-4 h-4" />
              {hasMemo ? 'Sửa memo' : 'Thêm memo'}
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải ghi chú...
          </div>
        ) : isEditing ? (
          <div className="space-y-4">
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              onPaste={handlePaste}
              rows={7}
              placeholder="Ghi lại điểm ngữ pháp khó, từ mới, lỗi hay sai... (có thể dán thẳng ảnh chụp màn hình bằng Ctrl+V)"
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none text-slate-800 resize-y transition-all"
            />

            {draftImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {draftImages.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Ảnh memo ${idx + 1}`} className="w-full h-32 object-cover" />
                    <button
                      onClick={() => setDraftImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Xoá ảnh này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                      {formatBytes(dataUrlBytes(img))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={processingImage || draftImages.length >= MAX_IMAGES_PER_MEMO}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {processingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {processingImage ? 'Đang nén ảnh...' : 'Thêm ảnh'}
              </button>

              <span className="text-xs text-slate-400">
                {draftImages.length}/{MAX_IMAGES_PER_MEMO} ảnh
                {draftImages.length > 0 && ` • ${formatBytes(draftBytes)}`}
              </span>

              <div className="flex-1" />

              <button
                onClick={cancelEditing}
                className="px-4 py-2.5 text-slate-500 hover:text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
              >
                {saveState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu memo
              </button>
            </div>
          </div>
        ) : hasMemo ? (
          <div className="space-y-5">
            {memo!.content.trim().length > 0 && (
              <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{memo!.content}</p>
            )}

            {memo!.images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {memo!.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPreviewImage(img)}
                    className="rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all"
                    title="Bấm để xem ảnh lớn"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Ảnh memo ${idx + 1}`} className="w-full h-32 object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Cập nhật lần cuối: {new Date(memo!.updated_at).toLocaleString('vi-VN')}
              </span>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xoá memo
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-xl">
            <NotebookPen className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Chưa có ghi chú nào cho bài học này.</p>
            <button
              onClick={startEditing}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors"
            >
              <Pencil className="w-4 h-4" /> Viết memo đầu tiên
            </button>
          </div>
        )}

        {saveState === 'saved' && !errorMsg && !isEditing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Đã lưu và đồng bộ.
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Xem ảnh phóng to */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewImage} alt="Ảnh memo" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-5 right-5 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
}
