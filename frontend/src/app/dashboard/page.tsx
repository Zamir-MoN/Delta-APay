export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass p-6 rounded-2xl">
            <h3 className="text-secondary-text mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold text-success">₹0.00</p>
          </div>
          <div className="glass p-6 rounded-2xl">
            <h3 className="text-secondary-text mb-2">Pending Orders</h3>
            <p className="text-3xl font-bold text-accent">0</p>
          </div>
          <div className="glass p-6 rounded-2xl">
            <h3 className="text-secondary-text mb-2">Completed Orders</h3>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
        </div>
        
        <p className="text-secondary-text">More features like Order logs and User management will be added here soon.</p>
      </div>
    </div>
  );
}
