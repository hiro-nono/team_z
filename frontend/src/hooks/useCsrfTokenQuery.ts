import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { CsrfTokenType } from "../types/accountType";
import { privateApi, publicApi } from "../axios";

// query
// url
const fetchToken = async (): Promise<CsrfTokenType> => {
  const response = await axios.get(`${import.meta.env.VITE_API_URL}/csrf`, {
    withCredentials: true,
  });

  const token = response.data.csrf_token;
  // CSRFトークンを全axiosリクエストに適用
  publicApi.defaults.withCredentials = true;
  publicApi.defaults.headers.common['X-CSRF-Token'] = token;
  // カスタムaxiosにも設定
  privateApi.defaults.withCredentials = true;
  privateApi.defaults.headers.common['X-CSRF-Token'] = token;

  return token;
}
// func
export const useCSRFTokenQuery =  () => useQuery<CsrfTokenType, Error, CsrfTokenType, ["csrf_token"]>({
  queryKey :["csrf_token"],
  queryFn :fetchToken,
  enabled :true, //クエリの有効化
  retry :false,  //エラー時のリトライを無効化
});

