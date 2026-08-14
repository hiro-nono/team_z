import { useCSRFTokenQuery } from './hooks/useCsrfTokenQuery'

function App() {
  // トップページ遷移時にCSRFトークンを取得し、以降のAPIリクエストに適用する
  useCSRFTokenQuery()

  return (
    <>
      App
    </>
  )
}

export default App
