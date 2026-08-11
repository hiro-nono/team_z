import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Signup from './auth/Signup.tsx'
import Signin from './auth/Signin.tsx'
import ChangePassword from './auth/ChangePassword.tsx'
import ChangeEmail from './auth/ChangeEmail.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/change-password" element={<ChangePassword/>} />
        <Route path="/change-email" element={<ChangeEmail/>} />      
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
