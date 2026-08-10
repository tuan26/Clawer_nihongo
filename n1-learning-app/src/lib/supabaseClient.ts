import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Tránh lỗi crash nếu chưa cấu hình biến môi trường
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper kiểm tra xem Supabase đã cấu hình thành công hay chưa
export const isSupabaseConfigured = (): boolean => {
  return !!supabase;
};
