import axios from "axios";
import type { CsrfTokenType } from "../type";
import { supabase } from "../supabase";

export const useError = () => {
    //csrfの取得
    const getCsrfToken = async () => {
        const { data } = await axios.get<CsrfTokenType>(
            `${import.meta.env.VITE_API_URL}/csrf-token`
        )
        axios.defaults.headers.common["X-CSRF-Token"] = data.csrf_token
    };

    //エラー
    const switchErrorHandling = async (status: number | undefined, msg: string) => {
        switch (msg) {
            case "invalid csrf token":
                //csrf
                getCsrfToken()
                return
            case "this account is currently suspended":
                // ログアウト
                await supabase.auth.signOut();
                // ホームへ
                window.location.href = "/"
                return
            case "admin privileges are required to perform this action":
                // ログアウト
                await supabase.auth.signOut();
                // ホームへ
                window.location.href = "/"
                return
        }
        switch (status) {
            case 401:
                // ログアウト
                await supabase.auth.signOut();
                // ログイン画面へ
                window.location.href = `/signin?redirectTo=${encodeURIComponent(window.location.pathname)}`
                break
        }
    }

    return { switchErrorHandling }
};