import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, invalidateCache } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await authAPI.login(username, password);
    const { access_token, refresh_token } = response.data;
    localStorage.setItem('token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);

    // Decode role from JWT payload instead of making a second request
    const payload = JSON.parse(atob(access_token.split('.')[1]));
    const userData = { username: payload.sub, role: payload.role };
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = async () => {
    try {
      // Call backend logout to revoke refresh token
      await authAPI.logout();
    } catch (error) {
      // Even if logout fails, clear local storage
      console.error('Logout error:', error);
    }
    
    // Clear local storage and state
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    invalidateCache();
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isLabour: user?.role === 'labour',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
