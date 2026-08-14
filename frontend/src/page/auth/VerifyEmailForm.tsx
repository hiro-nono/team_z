import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaPaperPlane } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { supabase } from '../../supabase';

const VerifyEmailForm: React.FC = () => {
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // react-routerのstateでemailを受け取る
  const { state } = useLocation();
  const email = state?.email;

  const resendEmail = async () => {
    setIsLoading(true);

    try {
      await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${import.meta.env.VITE_API_URL}/create-account`,
        },
      });
      setSent(true);
    } catch {
      toast.error('再送信に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black!">確認メールを送信しました</h1>
          <p className="text-gray-500 mt-2">
            入力いただいたメールアドレス宛に確認リンクを送信しました。<br />
            メール内のリンクをクリックしてアカウントを有効化してください。
          </p>
        </div>

        <div className="space-y-6">
          <button
            type="button"
            disabled={isLoading}
            onClick={resendEmail}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPaperPlane className="h-4 w-4" />
            {isLoading ? '再送信中...' : sent ? '再送信しました' : '確認メールを再送信'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            届かない場合は、迷惑メールフォルダもご確認ください。
          </p>
        </div>

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

export default VerifyEmailForm;
