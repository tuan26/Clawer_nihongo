-- CÂU LỆNH SQL KHỞI TẠO DATABASE TRÊN SUPABASE SQL EDITOR
-- Hãy copy toàn bộ nội dung dưới đây và chạy trong SQL Editor của Supabase.

-- 1. Tạo bảng từ vựng (vocabulary)
CREATE TABLE IF NOT EXISTS public.vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    reading TEXT,
    meaning_vi TEXT NOT NULL,
    example_ja TEXT,
    example_vi TEXT,
    tags TEXT[] DEFAULT '{}',
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'familiar', 'strong')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    interval_days INTEGER DEFAULT 0,
    ease_factor NUMERIC DEFAULT 2.5
);

-- 2. Tạo bảng lưu lịch sử review (vocabulary_reviews)
CREATE TABLE IF NOT EXISTS public.vocabulary_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vocabulary_id UUID NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
    interval_before INTEGER NOT NULL,
    interval_after INTEGER NOT NULL
);

-- 3. Tạo index để tối ưu hóa truy vấn
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON public.vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_next_review_at ON public.vocabulary(next_review_at);
CREATE INDEX IF NOT EXISTS idx_vocabulary_reviews_vocab_id ON public.vocabulary_reviews(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_reviews_user_id ON public.vocabulary_reviews(user_id);

-- 4. Kích hoạt Row Level Security (RLS)
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_reviews ENABLE ROW LEVEL SECURITY;

-- 5. Tạo các chính sách bảo mật (Security Policies) cho bảng vocabulary
CREATE POLICY "Users can create their own vocabulary" 
ON public.vocabulary FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own vocabulary" 
ON public.vocabulary FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocabulary" 
ON public.vocabulary FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vocabulary" 
ON public.vocabulary FOR DELETE 
USING (auth.uid() = user_id);

-- 6. Tạo các chính sách bảo mật (Security Policies) cho bảng vocabulary_reviews
CREATE POLICY "Users can create their own reviews" 
ON public.vocabulary_reviews FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reviews" 
ON public.vocabulary_reviews FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
ON public.vocabulary_reviews FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
ON public.vocabulary_reviews FOR DELETE 
USING (auth.uid() = user_id);
