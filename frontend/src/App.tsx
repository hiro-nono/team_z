import { useCSRFTokenQuery } from './hooks/useCsrfTokenQuery'
import Header from './components/Header'
import LandingPage from './page/lp/LandingPage'

function App() {
  // トップページ遷移時にCSRFトークンを取得し、以降のAPIリクエストに適用する
  useCSRFTokenQuery()

  return (
    <>
      <Header />
      <LandingPage />
    </>
  )
}

export default App
