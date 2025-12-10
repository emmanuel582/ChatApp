import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignupForm from './SignupForm';
import LoginForm from './LoginForm';
import BeginConversation from './BeginConversation';
import ChatDashboard from './ChatDashboard';

import AdminDashboard from './AdminDashboard';
import AdminImpersonation from './AdminImpersonation';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/dashboard" element={<BeginConversation />} />
        <Route path="/profile" element={<ChatDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/chat/:userId" element={<AdminImpersonation />} />
      </Routes>
    </Router>
  )
}

export default App;
