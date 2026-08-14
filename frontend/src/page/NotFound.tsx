import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-black!">ページがありません</h1>
          <p className="text-gray-500 mt-2">
            お探しのページは見つかりませんでした。
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          ホームへ戻る
        </button>
      </div>
    </div>
  );
};

export default NotFound;
