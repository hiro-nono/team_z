import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // TODO: 登録成功時の画面遷移に使用
  // const navigate = useNavigate();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // --- バリデーション ---

    // 全項目が入力されているか
    if (!email || !password || !confirmPassword) {
      setError('すべての項目を入力してください。');
      return;
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('有効なメールアドレスを入力してください。');
      return;
    }

    // パスワードの長さチェック（8文字以上）
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください。');
      return;
    }

    // パスワード一致チェック
    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    console.log('新規登録処理実行:', { email, password });
    // TODO: バックエンドのAPI連携や画面遷移の処理をここに記述
    // 例: navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* 新規登録カード */}
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8">
        {/* タイトル */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">AIおたよりシステム</h1>
          <p className="text-gray-500 mt-2">新規アカウントを作成</p>
        </div>

        {/* フォーム入力エリア */}
        <form onSubmit={handleSignup} className="space-y-6">
          {/* メールアドレス入力 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="example@mail.com"
              />
            </div>
          </div>

          {/* パスワード入力 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="8文字以上で入力"
              />
              {/* パスワード表示/非表示トグル */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  /* 非表示アイコン（目に斜線） */
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* 表示アイコン（目） */
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {/* パスワード条件のヒント */}
            <p className="mt-1 text-xs text-gray-400">※ 8文字以上で設定してください</p>
          </div>

          {/* パスワード確認入力 */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              パスワード（確認）
            </label>
            <div className="mt-1 relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="もう一度パスワードを入力"
              />
              {/* パスワード確認の表示/非表示トグル */}
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  /* 非表示アイコン（目に斜線） */
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* 表示アイコン（目） */
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* エラーメッセージ表示エリア */}
          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {/* 新規登録ボタン */}
          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              アカウントを作成する
            </button>
          </div>
        </form>

        {/* ログインへのリンク */}
        <div className="text-center border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">
            すでにアカウントをお持ちの方はこちら
          </p>
          <Link
            to="/signin"
            className="mt-3 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            ログインへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
