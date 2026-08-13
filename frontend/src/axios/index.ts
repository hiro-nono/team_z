import axios from 'axios';
// supabaseのインポート元は既存のファイルに合わせて調整してください
import { supabase } from '../supabase'; 

const baseURL = import.meta.env.VITE_API_URL;

// 未ログイン時・401時のリダイレクト処理
const redirectToSignIn = () => {
  const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/signin?redirectTo=${currentPath}`;
};

// ==============================
// privateApi: ログイン必須のAPI
// ==============================
export const privateApi = axios.create({
  baseURL,
});

// リクエストインターセプター：JWTの付与と未ログイン時のリダイレクト
privateApi.interceptors.request.use(
  async (config) => {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      redirectToSignIn();
      // リクエストをキャンセルしてエラーを返す
      return Promise.reject(new Error('Authentication required'));
    }

    config.headers.Authorization = `Bearer ${session.access_token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// レスポンスインターセプター：401エラー時のログアウトとリダイレクト
privateApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await supabase.auth.signOut();
      redirectToSignIn();
    }
    return Promise.reject(error);
  }
);

// ==============================
// publicApi: ログイン任意のAPI
// ==============================
export const publicApi = axios.create({
  baseURL,
});

// リクエストインターセプター：JWTが存在する場合のみ付与
publicApi.interceptors.request.use(
  async (config) => {
    // エラーハンドリングは行わず、セッション情報のみ取得する
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);