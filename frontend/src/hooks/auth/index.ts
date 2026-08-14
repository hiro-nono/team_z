import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { publicApi, privateApi } from '../../axios';
import axios from 'axios';
import { toast } from "react-toastify";
import type { AuthError } from "@supabase/supabase-js";
import type { AccountType } from "../../type";

const switchSupabaseErrorHandling = (error: AuthError | null) => {
  if (!error) return;

  let message = "不明なエラーが発生しました。";

  switch (error.message) {
    case "Invalid login credentials":
      message = "メールアドレスまたはパスワードが間違っています。";
      break;
    case "Email not confirmed":
      message = "メールアドレスの確認が完了していません。";
      break;
    case "User already registered":
      message = "このメールアドレスはすでに登録されています。";
      break;
    case "Password should be at least 6 characters":
      message = "パスワードは6文字以上で入力してください。";
      break;
    default:
      message = error.message;
      break;
  }

  // エラー表示
  toast.error(message);
}

// util
const checkSession = async () => {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/signin'
      return;
    }
};
// query
// func
export const getEmail = async () => {
    // sessionの確認
    await checkSession();
    // User情報の取得
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user?.email
}

export const useAuthHooks = () => {
  const navigate = useNavigate();
  // クエリデータ
  const queryClient = useQueryClient()

  // signup
  const signup = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`, // ホーム
      },
    });
    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    if (error || !data.user) {
      return;
    }

    // バックエンドにアカウントを作成する
    try {
      const { data: account } = await publicApi.post<AccountType>('/accounts', {
        auth_id: data.user.id,
      });
      // 退会等で後からアカウントIDを参照できるようSupabaseのユーザーメタデータに保存する
      await supabase.auth.updateUser({ data: { account_id: account.id } });
    } catch {
      toast.error('アカウント情報の作成に失敗しました。');
    }
  };

  // sessionの保存(=>自動ログインに利用)
  const setSession = async (access :string, refresh :string) => {
    await supabase.auth.setSession({
      access_token :access,
      refresh_token :refresh,
    })
  };

  // signin
  const signin = async (email: string, password: string, redirectTo :string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    if (error) {
      return;
    }

    // 元のページに戻る
    navigate(redirectTo);
  };

  // reset-requset
  const resetPasswordRequest = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email, {
      redirectTo: `${window.location.origin}/change-password`, // リダイレクト先パスワード再設定用フロントエンドURL
    });

    // エラーハンドリング
    switchSupabaseErrorHandling(error)
  };

  // update_password
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return;
    }
  };

  // update_email
  const updateEmail = async (email: string) => {
    const { error } = await supabase.auth.updateUser({
      email :email,
    }, {
      emailRedirectTo: `${window.location.origin}/mypage`, // メール検証後のリダイレクト先
    });

    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    if (error) {
      return;
    }
  };

  const signout = async () => {
    const { error } = await supabase.auth.signOut();
    queryClient.clear();

    if (error) {
      return;
    }

    delete axios.defaults.headers.common['Authorization'];
  };

  // withdraw
  const withdrawAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const accountId = user?.user_metadata?.account_id;

    if (accountId) {
      try {
        await privateApi.delete(`/accounts/${accountId}`);
      } catch {
        toast.error('退会処理に失敗しました。');
        return;
      }
    }

    await signout();
  };

  const verifyPassword = async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      return true;
    }

    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    return false
  }

  return {
    signup,
    setSession,
    signin,
    resetPasswordRequest,
    updatePassword,
    updateEmail,
    signout,
    verifyPassword,
    withdrawAccount,
 };
};