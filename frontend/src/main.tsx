import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import Signin from './page/auth/Signin.tsx'
import Signup from './page/auth/Signup.tsx'
import ChangePassword from './page/auth/ChangePassword.tsx'
import ChangeEmail from './page/auth/ChangeEmail.tsx'
import RequestResetPasswordForm from './page/auth/RequestResetPasswordForm.tsx'
import VerifyEmailForm from './page/auth/VerifyEmailForm.tsx'
import Mypage from './page/mypage/MyPage.tsx'
import LandingPage from './page/lp/LandingPage.tsx'
import NotFound from './page/NotFound.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/forgot-password" element={<RequestResetPasswordForm />} />
          <Route path="/verify-email" element={<VerifyEmailForm />} />
          <Route path="/change-password" element={<ChangePassword/>} />
          <Route path="/change-email" element={<ChangeEmail/>} />
          <Route path="/mypage" element={<Mypage/>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
