import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Signup() {
  const navigate = useNavigate();
  
  // フォームの状態管理
  const [role, setRole] = useState<'student' | 'parent' | 'teacher'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [name, setName] = useState('');
  const [nameKana, setNameKana] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 簡易バリデーション
    if (password !== passwordConfirmation) {
      setError('パスワードが一致しません。');
      return;
    }
    setError('');

    // 送信データの構築（バックエンドのGo/Ginへ送るJSONのイメージ）
    const signupData = {
      role,
      email,
      password,
      name,
      name_kana: nameKana,
    };

    console.log('送信データ:', signupData);
    // TODO: 後ほどバックエンドへのAPIリクエスト（fetch / axios）を実装
    
    alert('登録処理（仮）を実行しました！');
    navigate('/signin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            新規アカウント登録
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* ロール選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ロール（役割）を選択
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['student', 'parent', 'teacher'] as const).map((r) => {
                const labelMap = { student: '生徒', parent: '保護者', teacher: '先生' };
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`py-2 px-4 text-sm font-medium rounded-md border ${
                      role === r
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {labelMap[r]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="example@email.com"
              />
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-sm font-medium text-gray-700">パスワード</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            {/* パスワード確認 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">パスワード（確認）</label>
              <input
                type="password"
                required
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            {/* 氏名（漢字） */}
            <div>
              <label className="block text-sm font-medium text-gray-700">氏名（漢字）</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="山田 花子"
              />
              <p className="mt-1 text-xs text-gray-500">※特殊な漢字で入力が難しい場合は一般的な漢字や別名で代用可能です</p>
            </div>

            {/* 氏名（カナ） */}
            <div>
              <label className="block text-sm font-medium text-gray-700">氏名（カナ）</label>
              <input
                type="text"
                required
                value={nameKana}
                onChange={(e) => setNameKana(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="ヤマダ ハナコ"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              登録する
            </button>
          </div>

          <div className="text-center text-sm">
            <a href="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
              すでにアカウントをお持ちの方はこちら（ログイン）
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}