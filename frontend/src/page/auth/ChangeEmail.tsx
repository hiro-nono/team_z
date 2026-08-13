import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuthHooks } from '../../hooks/auth';

const ChangeEmail: React.FC = () => {
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { updateEmail } = useAuthHooks();

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newEmail || !confirmEmail || !password) {
      setError('すべての項目を入力してください。');
      return;
    }

    if (newEmail !== confirmEmail) {
      setError('新しいメールアドレスと確認用メールアドレスが一致しません。');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError('有効なメールアドレス形式で入力してください。');
      return;
    }

    await updateEmail(newEmail);
    setSuccess('確認用メールを送信しました。メール内のリンクから変更を完了してください。');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black!">メールアドレス変更</h1>
          <p className="text-gray-500 mt-2">新しいメールアドレスと現在のパスワードを入力してください</p>
        </div>

        <form onSubmit={handleEmailChange} className="space-y-6">
          <div>
            <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700">
              新しいメールアドレス
            </label>
            <div className="mt-1">
              <input
                id="newEmail"
                name="newEmail"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="new-example@mail.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmEmail" className="block text-sm font-medium text-gray-700">
              新しいメールアドレス（確認）
            </label>
            <div className="mt-1">
              <input
                id="confirmEmail"
                name="confirmEmail"
                type="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="new-example@mail.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              現在のパスワード（本人確認）
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="現在のパスワードを入力"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
              </button>
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

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              変更手続きを開始する
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

export default ChangeEmail;