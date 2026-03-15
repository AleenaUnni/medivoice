import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("medivoice_token");
    const savedUser = localStorage.getItem("medivoice_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch("http://localhost:8000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Invalid email or password");
    const data = await res.json();
    localStorage.setItem("medivoice_token", data.access_token);
    localStorage.setItem(
      "medivoice_user",
      JSON.stringify({
        email: data.email,
        name: data.name,
        role: data.role,
      }),
    );
    setToken(data.access_token);
    setUser({ email: data.email, name: data.name, role: data.role });
    return data;
  };

  const register = async (email, password, name, role) => {
    const res = await fetch("http://localhost:8000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role }),
    });
    if (!res.ok) throw new Error("Registration failed");
    const data = await res.json();
    localStorage.setItem("medivoice_token", data.access_token);
    localStorage.setItem(
      "medivoice_user",
      JSON.stringify({
        email: data.email,
        name: data.name,
        role: data.role,
      }),
    );
    setToken(data.access_token);
    setUser({ email: data.email, name: data.name, role: data.role });
    return data;
  };

  const logout = () => {
    localStorage.removeItem("medivoice_token");
    localStorage.removeItem("medivoice_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

