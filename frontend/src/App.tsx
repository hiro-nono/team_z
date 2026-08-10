import { useState, useEffect } from "react";
import Signin from "./auth/Signin";

export default function App() {
  // ログイン状態を管理（実際の開発では localStorage や Cookie、状態管理ライブラリに置き換えてください）
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // 初回マウント時に認証状態をチェックするロジック（必要に応じて拡張）
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // ログイン成功時のハンドラー
  const handleLoginSuccess = (token: string) => {
    localStorage.setItem("auth_token", token);
    setIsAuthenticated(true);
  };

  // ログアウト時のハンドラー
  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setIsAuthenticated(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
      {!isAuthenticated ? (
        // 未ログイン時：ログイン画面を表示
        <Signin onLoginSuccess={handleLoginSuccess} />
      ) : (
        // ログイン時：メイン画面（ログアウトボタンを配置）
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-800">
            ログイン成功！
          </h1>
          <p className="text-gray-600 mb-6">
            AI Hackathon 2026 チームZ フロントエンドへようこそ
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors font-medium"
          >
            ログアウト
          </button>
        </div>
      )}
    </main>
  );
}