// mutate
// func
export const useAuthHooks = () => {
  const navigate = useNavigate();
  // クエリデータ
  const queryClient = useQueryClient()

  // signup
  const signup = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${import.meta.env.VITE_API_URL}${URLS.CREATE_ACCOUNT}`, // メール検証後のリダイレクト先
      },
    });
    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    if (error) {
      return;
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
      redirectTo: `${import.meta.env.VITE_URL}${URLS.RESET_PASSWORD}`, // リダイレクト先パスワード再設定用フロントエンドURL
    });

    // エラーハンドリング
    switchSupabaseErrorHandling(error)
  };

  // update_password
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password :password });

    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    if (error) {
      return;
    }
  };

  // update_email
  const updateEmail = async (email: string) => {
    const { error } = await supabase.auth.updateUser({
      email :email,
    }, {
      emailRedirectTo: `${import.meta.env.VITE_API_URL}${URLS.EDIT_EMAIL}`, // メール検証後のリダイレクト先
    });

    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    if (error) {
      return;
    }
  };

  // signout
  const signout = async () => {
    const { error } = await supabase.auth.signOut();
    // すべてのキャッシュを削除
    queryClient.clear();

    // エラーハンドリング
    switchSupabaseErrorHandling(error)

    if (error) {
      return;
    }

    // アクセストークンをヘッダーから削除
    delete axios.defaults.headers.common["Authorization"];;
  };

  // 退会処理前のユーザー認証
  const verifyPassword = async (email :string, password :string) :Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      return true
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
 };
};