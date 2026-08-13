import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

//stale_time
//キャッシュの有効期限(=>期限切れで再取得が行われる)

//private
//1min
export const PrivateStaleTime = 1000 * 60 * 1;
//public
//1hours
export const PublicStaleTime = 1000 * 60 * 60;

//gc_time
//未使用のクエリデータがキャッシュから削除される時間

//private
//5min
export const PrivateGcTime = 1000 * 60 * 5;
//public
//30min
export const PublicGcTime = 1000 * 60 *30;