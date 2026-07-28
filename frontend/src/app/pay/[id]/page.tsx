"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [status, setStatus] = useState<string>("PENDING");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'error' | 'success', message: string} | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Fetch Initial Details
    fetch(`/api/orders/${orderId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setOrderDetails(data);
          setStatus(data.status);
        }
      });

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

  useEffect(() => {
    // Handle Auto-redirect on success
    if (status === "PAID" && orderDetails?.redirectUrl) {
      const timer = setTimeout(() => {
        window.location.href = orderDetails.redirectUrl;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, orderDetails]);

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
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e: any) {
        throw new Error(`Status ${res.status}: ${text.substring(0, 100)}`);
      }
      
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

  if (!orderDetails) {
    return <div className="flex min-h-screen items-center justify-center text-secondary-text">Loading payment details...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] px-4 py-12">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm relative overflow-hidden border border-gray-100">
        
        {/* Header - Razorpay Style */}
        <div className="flex justify-center items-center mb-6">
          <div className="text-[#0c47a1] font-extrabold text-2xl tracking-tight flex items-center">
            <span className="text-[#1976d2] italic mr-1 text-3xl leading-none">/</span>
            <span className="text-[#1976d2] italic mr-1.5 text-3xl leading-none">/</span>
            Delta<span className="text-[#1976d2]">Pay</span>
          </div>
        </div>
        
        {status === "PENDING" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            
            <div className="mb-4">
              {orderDetails.qrCode ? (
                <img src={orderDetails.qrCode} alt="UPI QR Code" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 bg-gray-100 animate-pulse rounded-xl" />
              )}
            </div>
            
            {/* Mock UPI App Logos */}
            <div className="flex justify-center items-center gap-5 mb-8 w-full border-b border-gray-100 pb-6">
              {/* Paytm */}
              <div className="text-[#00baf2] font-extrabold text-sm tracking-tighter">Pay<span className="text-[#002970]">tm</span></div>
              {/* GPay */}
              <div className="flex items-center gap-[1px]">
                <span className="text-[#4285F4] font-bold text-sm">G</span>
                <span className="text-[#EA4335] font-bold text-sm">P</span>
                <span className="text-[#FBBC05] font-bold text-sm">a</span>
                <span className="text-[#34A853] font-bold text-sm">y</span>
              </div>
              {/* BHIM */}
              <div className="text-[#F18121] font-bold text-sm tracking-tighter">BHIM</div>
              {/* PhonePe */}
              <div className="bg-[#5f259f] text-white rounded-full w-6 h-6 flex items-center justify-center text-[11px] font-bold">पे</div>
            </div>
            
            <div className="w-full space-y-4 text-center">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">Amount to Pay</p>
                <p className="text-4xl font-extrabold text-gray-900">₹{orderDetails.amount}</p>
              </div>
              
              <div className="mt-8 flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Enter 12-digit UTR Number" 
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1976d2] focus:ring-1 focus:ring-[#1976d2] transition-all font-medium text-center"
                  disabled={submitting}
                />
                
                {feedback && (
                  <div className={`text-sm font-medium ${feedback.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                    {feedback.message}
                  </div>
                )}

                <button 
                  onClick={handleConfirm}
                  disabled={submitting || !utr.trim()}
                  className="w-full py-3.5 bg-[#0c47a1] text-white font-bold rounded-xl hover:bg-[#0a387f] shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {submitting ? "Verifying..." : "Confirm Payment"}
                </button>
              </div>
              
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Scan with any UPI app. Do not change the purpose/remarks field. After payment, enter your UTR above.
              </p>
            </div>
          </div>
        )}

        {status === "PAID" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 py-12">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={48} className="text-green-500" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Successful!</h3>
            {orderDetails.redirectUrl ? (
              <p className="text-gray-500 mb-8 font-medium">Redirecting you back to the app...</p>
            ) : (
              <p className="text-gray-500 mb-8 font-medium">Your payment has been verified.</p>
            )}
            
            {orderDetails.redirectUrl && (
               <button 
                 onClick={() => window.location.href = orderDetails.redirectUrl}
                 className="w-full py-3.5 bg-[#0c47a1] text-white font-bold rounded-xl hover:bg-[#0a387f] shadow-lg transition-all"
               >
                 Continue Now
               </button>
            )}
          </div>
        )}

        {status === "EXPIRED" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 py-12">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <XCircle size={48} className="text-red-500" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Expired</h3>
            <p className="text-gray-500 font-medium">This QR code is no longer valid. Please create a new order.</p>
          </div>
        )}
      </div>
    </div>
  );
}
