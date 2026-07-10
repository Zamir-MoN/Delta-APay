"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  
  const qrCode = searchParams.get("qr");
  const amount = searchParams.get("amount");
  const purpose = searchParams.get("purpose");

  const [status, setStatus] = useState<string>("PENDING");
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins

  useEffect(() => {
    if (!orderId) return;

    // Connect to SSE for real-time status updates
    const eventSource = new EventSource(`http://localhost:3001/api/orders/${orderId}/status`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) {
          setStatus(data.status);
          if (data.status === "PAID" || data.status === "EXPIRED" || data.status === "FAILED") {
            eventSource.close();
          }
        }
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [orderId]);

  useEffect(() => {
    if (status !== "PENDING") return;
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setStatus("EXPIRED");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <button 
        onClick={() => router.push('/')}
        className="absolute top-24 left-6 flex items-center gap-2 text-secondary-text hover:text-white transition-colors"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/20 blur-[50px] -z-10 rounded-full" />
        
        <h2 className="text-2xl font-bold text-center mb-6">Complete Payment</h2>
        
        {status === "PENDING" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="bg-white p-4 rounded-xl mb-6">
              {qrCode ? (
                <img src={qrCode} alt="UPI QR Code" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-gray-200 animate-pulse rounded-xl" />
              )}
            </div>
            
            <div className="w-full space-y-4 text-center">
              <div>
                <p className="text-secondary-text text-sm mb-1">Amount to Pay</p>
                <p className="text-3xl font-bold text-white">₹{amount}</p>
              </div>
              
              <div className="glass p-3 rounded-lg flex items-center justify-between">
                <span className="text-sm text-secondary-text">Purpose Code</span>
                <span className="font-mono text-accent font-semibold">{purpose}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-primary font-medium mt-6">
                <Clock size={18} className="animate-pulse" />
                Expires in {formatTime(timeLeft)}
              </div>
              
              <p className="text-xs text-secondary-text mt-4">
                Scan with any UPI app. Do not change the purpose/remarks field.
              </p>
            </div>
          </div>
        )}

        {status === "PAID" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 py-8">
            <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={40} className="text-success" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Payment Successful!</h3>
            <p className="text-secondary-text mb-8">Your product has been delivered to your email.</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-opacity-90 transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {status === "EXPIRED" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 py-8">
            <div className="w-20 h-20 bg-danger/20 rounded-full flex items-center justify-center mb-6">
              <XCircle size={40} className="text-danger" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Payment Expired</h3>
            <p className="text-secondary-text mb-8">This QR code is no longer valid. Please create a new order.</p>
            <button 
              onClick={() => router.push('/')}
              className="w-full py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
