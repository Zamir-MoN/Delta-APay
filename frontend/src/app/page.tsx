"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Zap, Copy, LogOut } from "lucide-react";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem("adminToken");
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      fetchDashboardData(savedToken);
    }
  }, []);

  const fetchDashboardData = async (authToken: string) => {
    try {
      const [meRes, ordersRes, txRes] = await Promise.all([
        fetch("/api/admin/me", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/admin/orders", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/admin/transactions", { headers: { Authorization: `Bearer ${authToken}` } })
      ]);

      if (!meRes.ok) throw new Error("Unauthorized");
      
      setDashboardData(await meRes.json());
      setOrders(await ordersRes.json());
      setTransactions(await txRes.json());
    } catch (err) {
      handleLogout();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("adminToken", data.token);
        setToken(data.token);
        setIsLoggedIn(true);
        fetchDashboardData(data.token);
      } else {
        alert("Invalid credentials");
      }
    } catch (err) {
      alert("Login failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setIsLoggedIn(false);
    setToken("");
    setDashboardData(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[90vh] px-4">
        <div className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <ShieldCheck size={48} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-8">Admin Portal</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="text" 
                placeholder="Owner ID" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
                required
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-opacity-90 transition-all"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[90vh] px-4 py-12">
      <div className="w-full max-w-6xl space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center glass-panel p-6 rounded-2xl">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-secondary-text">Welcome back, {dashboardData?.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors">
            <LogOut size={18} /> Logout
          </button>
        </div>

        {/* API Key Section */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap size={20} className="text-accent" /> Your Integration API Key
          </h3>
          <div className="flex items-center gap-4">
            <code className="bg-white/5 px-4 py-3 rounded-xl flex-1 border border-white/10 font-mono text-primary truncate">
              {dashboardData?.apiKey || 'Loading...'}
            </code>
            <button 
              onClick={() => copyToClipboard(dashboardData?.apiKey)}
              className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
              title="Copy API Key"
            >
              <Copy size={20} />
            </button>
          </div>
          <p className="text-sm text-secondary-text mt-4">
            Use this key in the <code>x-api-key</code> header to create checkout sessions from your external projects via <code>POST /api/v1/checkout/sessions</code>.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Orders Table */}
          <div className="glass-panel p-6 rounded-2xl overflow-hidden flex flex-col h-[500px]">
            <h3 className="text-xl font-bold mb-4">Recent Orders</h3>
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-secondary-text uppercase bg-white/5 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Date</th>
                    <th className="px-4 py-3">ID / Purpose</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3 rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-secondary-text text-xs whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{order.purpose}</td>
                      <td className="px-4 py-3 font-medium">₹{order.amount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          order.status === 'PAID' ? 'bg-success/20 text-success' : 
                          order.status === 'EXPIRED' ? 'bg-danger/20 text-danger' : 
                          'bg-accent/20 text-accent'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-secondary-text">No orders yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="glass-panel p-6 rounded-2xl overflow-hidden flex flex-col h-[500px]">
            <h3 className="text-xl font-bold mb-4">Parsed Transactions (FamApp)</h3>
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-secondary-text uppercase bg-white/5 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Date</th>
                    <th className="px-4 py-3">UTR</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3 rounded-tr-lg">Sender</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-secondary-text text-xs whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{tx.utr}</td>
                      <td className="px-4 py-3 font-medium">₹{tx.amount}</td>
                      <td className="px-4 py-3 truncate max-w-[150px]">{tx.sender}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-secondary-text">No transactions parsed yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
