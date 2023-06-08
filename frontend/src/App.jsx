import { useEffect, useState } from 'react';
import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Header from './components/Header';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const response = await fetch(`/api/user/login`, { method: 'GET' });
      const responseJson = await response.json();
      if (responseJson.user) {
        setUser(responseJson.user);
      }
    }

    getUser();
  }, []);

  return (
    <main>
      <BrowserRouter>
        <Header user={user} setUserCallback={setUser} />
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/login' element={<LoginForm setUserCallback={setUser} />} />
          <Route path='register' element={<RegisterForm setUserCallback={setUser} />} />
          <Route path='/chat' element={<Chat userData={user} />} />
        </Routes >
      </BrowserRouter >
    </main >
  );
}

export default App;
