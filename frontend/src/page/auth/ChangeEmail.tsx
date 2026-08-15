import React, { useState } from 'react';
import { useAuthHooks } from '../../hooks/auth';

const ChangeEmail: React.FC = () => {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');

  const { updateEmail } = useAuthHooks();

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newEmail) {
      setError('新しいメールアドレスを入力してください。');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError('有効なメールアドレス形式で入力してください。');
      return;
    }

    await updateEmail(newEmail);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black!">メールアドレス変更</h1>
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

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              保存する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangeEmail;