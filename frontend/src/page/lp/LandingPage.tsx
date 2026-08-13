import { FaFileAlt, FaArrowRight, FaCalendarAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <section className="h-125 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl font-bold text-black! mb-4">AIおたよりシステム</h1>

        <div className="flex items-center justify-center gap-4 mb-6 text-blue-600">
          <FaFileAlt className="h-10 w-10" />
          <FaArrowRight className="h-6 w-6 text-gray-400" />
          <FaCalendarAlt className="h-10 w-10" />
        </div>

        <p className="text-lg font-medium text-gray-700 max-w-md">
          学校から配布されるPDFをもとに、
          <br />
          Googleカレンダーへ自動登録。
        </p>
        <p className="text-gray-500 mt-2 max-w-md">
          行事や持ち物の予定を見落とさない、忙しい保護者のためのおたより管理サービスです。
        </p>
      </section>

      <section className="flex items-center justify-center px-4 pb-16">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md space-y-6 text-center">
          <h2 className="text-xl font-bold text-black!">料金プラン</h2>

          <div>
            <span className="text-4xl font-bold text-gray-900">¥500</span>
            <span className="text-gray-500"> / 月</span>
          </div>

          <Link
            to="/signup"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            始める
          </Link>
        </div>
      </section>
    </div>
  );
}
