import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthHooks } from '../../hooks/auth';

const RequestResetPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { resetPasswordRequest } = useAuthHooks();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('メールアドレスを入力してください。');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('有効なメールアドレスを入力してください。');
      return;
    }

    setIsLoading(true);

    try {
      await resetPasswordRequest(email);
      setSuccess('パスワードリセット用のメールを送信しました。メール内のリンクからパスワードを再設定してください。');
    } catch {
      setError('送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black!">パスワードリセット</h1>
          <p className="text-gray-500 mt-2">
            登録しているメールアドレスを入力してください。<br />
            パスワードをリセットするためのリンクをお送りします。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              登録しているメールアドレス
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="example@mail.com"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-600 text-sm text-center bg-green-50 border border-green-200 rounded-md p-3">
              {success}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '送信中...' : '送信する'}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => navigate(-1)}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
          </div>
        </form>

        <div className="text-center border-t border-gray-200 pt-6">
          <Link
            to="/signin"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            ← ログイン画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RequestResetPasswordForm;
