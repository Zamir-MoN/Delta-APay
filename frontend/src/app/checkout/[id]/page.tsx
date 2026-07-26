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
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'error' | 'success', message: string} | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Connect to SSE for real-time status updates
    const eventSource = new EventSource(`/api/orders/${orderId}/status`);
    
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

  // Fallback Polling (in case Next.js Proxy buffers SSE)
  useEffect(() => {
    if (!orderId || status !== "PENDING") return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== status) {
            setStatus(data.status);
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId, status]);

  const handleConfirm = async () => {
    if (!utr.trim()) {
      setFeedback({ type: 'error', message: "Please enter a valid UTR or UPI Transfer ID" });
      return;
    }
    
    setSubmitting(true);
    setFeedback(null);
    
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: utr.trim() }),
      });
      const data = await res.json();
      
      if (data.error === 'Order is no longer pending') {
        // Force a status check
        const statusRes = await fetch(`/api/orders/${orderId}`);
        const statusData = await statusRes.json();
        if (statusData.status) setStatus(statusData.status);
      } else if (data.error) {
        setFeedback({ type: 'error', message: data.error });
      } else if (data.pending) {
        setFeedback({ type: 'success', message: "UTR submitted. Waiting for bank confirmation..." });
      } else {
        // Will be picked up by SSE
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Crash: ${err.message || String(err)}` });
    } finally {
      setSubmitting(false);
    }
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
              
              <div className="mt-6 flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Enter UTR / UPI Transfer ID" 
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors"
                  disabled={submitting}
                />
                
                {feedback && (
                  <div className={`text-sm ${feedback.type === 'error' ? 'text-danger' : 'text-success'}`}>
                    {feedback.message}
                  </div>
                )}

                <button 
                  onClick={handleConfirm}
                  disabled={submitting || !utr.trim()}
                  className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Verifying..." : "Confirm Payment"}
                </button>
              </div>
              
              <p className="text-xs text-secondary-text mt-4">
                Scan with any UPI app. Do not change the purpose/remarks field. After payment, enter your 12-digit UTR above.
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
