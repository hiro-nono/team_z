import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaChevronRight } from 'react-icons/fa';
import { useAuthHooks } from '../../hooks/auth';

const MyPage = () => {
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const { signout } = useAuthHooks();
  const navigate = useNavigate();

  const handleWithdraw = async () => {
    await signout();
    setIsWithdrawModalOpen(false);
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black!">マイページ</h1>
          <p className="text-gray-500 mt-2">アカウントに関する各種設定</p>
        </div>

        <ul className="border border-gray-300 rounded-md divide-y divide-gray-200 overflow-hidden">
          <li>
            <Link
              to="/change-email"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
            >
              メールアドレスの編集
              <FaChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          </li>
          <li>
            <Link
              to="/change-password"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
            >
              パスワードの編集
              <FaChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500 transition-colors"
            >
              退会
              <FaChevronRight className="h-4 w-4 text-red-300" />
            </button>
          </li>
        </ul>
      </div>

      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-black!">退会確認</h2>
              <p className="text-gray-500 mt-2">
                本当に退会しますか？この操作は取り消せません。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                いいえ
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage;
