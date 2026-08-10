import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Signin: React.FC = () => {
  // ログイン種別を管理するステート ('student' | 'parent' | 'teacher')
  const [loginType, setLoginType] = useState<'student' | 'parent' | 'teacher'>('student');
  const navigate = useNavigate();

  const handleLogin = () => {
    console.log('ログイン処理実行:', loginType);
    // TODO: バックエンドのAPI連携や画面遷移の処理をここに記述
    // 例: navigate('/home');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* ログインカード */}
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8">
        {/* タイトル */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">AIおたよりシステム</h1>
          <p className="text-gray-500">システムへログインします</p>
        </div>

        {/* ユーザー種別の切り替えタブ */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4" aria-label="Tabs">
            {[
              { id: 'student', name: '生徒' },
              { id: 'parent', name: '保護者' },
              { id: 'teacher', name: '先生' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLoginType(tab.id as any)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  loginType === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* フォーム入力エリア */}
        <div className="space-y-6">
          {/* ID入力 */}
          <div>
            <label htmlFor="id" className="block text-sm font-medium text-gray-700">
              ID {loginType === 'student' ? '(学籍番号)' : loginType === 'parent' ? '(メールアドレス)' : '(職員ID)'}
            </label>
            <div className="mt-1">
              <input
                id="id"
                name="id"
                type="text"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="IDを入力してください"
              />
            </div>
          </div>

          {/* パスワード入力 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>
          
          {/* エラーメッセージ表示エリア（失敗時のみ表示させる場合はhiddenを外す） */}
          <div className="text-red-600 text-sm text-center hidden">
             IDまたはパスワードが間違っています。
          </div>

          {/* ログインボタン */}
          <div>
            <button
              type="button"
              onClick={handleLogin}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              ログインする
            </button>
          </div>
        </div>

        {/* サインアップへのリンク */}
        <div className="text-center border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">
            アカウントをお持ちでない方はこちら
          </p>
          <Link
            to="/signup"
            className="mt-3 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            新規登録（サインアップ）
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signin;