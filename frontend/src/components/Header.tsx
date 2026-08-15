import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSignInAlt, FaSignOutAlt, FaFilePdf, FaUserCircle } from 'react-icons/fa';
import { supabase } from '../supabase';
import { useAuthHooks } from '../hooks/auth';

const Header = () => {
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();
  const { signout } = useAuthHooks();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signout();
    navigate('/');
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
      <Link to="/" className="text-xl font-bold text-black!">
        AIおたよりシステム
      </Link>

      {hasSession ? (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/pdf-calendar-go')}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            <FaFilePdf className="h-5 w-5" />
            PDFを読み込む
          </button>
          <button
            type="button"
            onClick={() => navigate('/mypage')}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            <FaUserCircle className="h-5 w-5" />
            マイページ
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            <FaSignOutAlt className="h-5 w-5" />
            ログアウト
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/signin')}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
        >
          <FaSignInAlt className="h-5 w-5" />
          ログイン
        </button>
      )}
    </header>
  );
};

export default Header;
