"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle, ArrowLeft, X, Hexagon } from "lucide-react";

interface OrderDetails {
  status: string;
  amount: number;
  purpose: string;
  qrCode: string;
  upiUri?: string;
  redirectUrl?: string;
}

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [status, setStatus] = useState<string>("PENDING");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'error' | 'success', message: string} | null>(null);

  useEffect(() => {
    // Enable transparent background globally for the payment page so it can be embedded cleanly
    document.body.classList.add('transparent-bg');

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
      document.body.classList.remove('transparent-bg');
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
      const redirectUrl = orderDetails.redirectUrl;
      const timer = setTimeout(() => {
        window.location.href = redirectUrl;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, orderDetails]);

  useEffect(() => {
    // Intercept back button to prompt cancellation with a custom UI modal (since mobile browsers block native confirm inside popstate)
    if (status !== "PENDING") return;

    // Push a dummy state so there's something to pop
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (status === "PENDING") {
        // Trap the user again immediately by pushing state
        window.history.pushState(null, '', window.location.href);
        // Show our custom UI dialog instead of blocked window.confirm
        setShowCancelDialog(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [status, orderId]);

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

  const handleCancel = async () => {
    // Hide the dialog if it was open
    setShowCancelDialog(false);
    
    try {
      setSubmitting(true);
      await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      // The SSE will automatically pick up the EXPIRED status
      
      // If we got here via the back button dialog, let them go back
      if (showCancelDialog) {
        window.history.back();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to cancel payment' });
      setSubmitting(false);
    }
  };

  const promptCancel = () => {
    setShowCancelDialog(true);
  };

  if (!orderDetails) {
    return <div className="flex min-h-screen items-center justify-center text-secondary-text">Loading payment details...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-6 bg-transparent">
      <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-sm relative overflow-hidden border border-gray-200">
        
        {/* Custom Cancel Dialog Modal */}
        {showCancelDialog && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100">
              <XCircle size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Cancel Payment?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Are you sure you want to cancel this transaction? The order will be marked as expired.</p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                No, Keep it
              </button>
              <button 
                onClick={handleCancel}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-sm shadow-[0_4px_14px_rgba(239,68,68,0.3)]"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        )}

        {status === "PENDING" && (
          <button 
            onClick={promptCancel}
            className="absolute top-5 right-5 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 hover:bg-red-50 p-2 rounded-full z-10"
            title="Cancel Payment"
          >
            <X size={20} />
          </button>
        )}

        {/* Header - Premium Style */}
        <div className="flex justify-center items-center mb-5">
          <div className="font-extrabold text-2xl tracking-tight flex items-center text-gray-900 gap-1.5">
            <Hexagon size={28} className="text-amber-500 fill-amber-400 animate-bounce" />
            <span>Bee<span className="text-amber-500 font-medium">Pay</span></span>
          </div>
        </div>
        
        {status === "PENDING" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            
            {/* QR Code with soft shadow */}
            <div className="mb-4 p-2 bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.04)]">
              {orderDetails.qrCode ? (
                <img src={orderDetails.qrCode} alt="UPI QR Code" className="w-44 h-44 rounded-xl object-contain" />
              ) : (
                <div className="w-44 h-44 bg-gray-50 animate-pulse rounded-xl" />
              )}
            </div>

            {/* UPI App Logos Image */}
            <div className="flex justify-center items-center mb-4 w-full border-b border-gray-100/80 pb-4 mt-2">
              <img src="/UPI-apps2.jpg" alt="Supported UPI Apps" className="w-full h-auto max-h-16 object-contain" />
            </div>
            
            <div className="w-full space-y-3 text-center">
              <div>
                <p className="text-gray-400 text-[10px] font-bold mb-0.5 uppercase tracking-widest">Amount to Pay</p>
                <p className="text-3xl font-black text-gray-900 tracking-tight">₹{orderDetails.amount}</p>
              </div>
              
              <div className="mt-4 flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Enter 12-digit UTR" 
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold text-center tracking-widest shadow-inner text-sm"
                  disabled={submitting}
                />
                
                {feedback && (
                  <div className={`text-xs font-medium leading-tight ${feedback.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                    {feedback.message}
                  </div>
                )}

                <button 
                  onClick={handleConfirm}
                  disabled={submitting || !utr.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-[0_8px_20px_rgba(37,99,235,0.2)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
                >
                  {submitting ? "Verifying..." : "Confirm Payment"}
                </button>
              </div>
              
              <p className="text-[10px] text-gray-400 mt-3 leading-tight font-medium px-2">
                Scan with any UPI app. Do not change the purpose/remarks field. After payment, enter your UTR above.
              </p>
            </div>
          </div>
        )}

        {status === "PAID" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 py-12">
            <div className="mb-6">
              <svg className="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="success-circle" cx="26" cy="26" r="25" fill="none"/>
                <path className="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
              </svg>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Successful!</h3>
            {orderDetails.redirectUrl ? (
              <p className="text-gray-500 mb-8 font-medium">Redirecting you back to the app...</p>
            ) : (
              <p className="text-gray-500 mb-8 font-medium">Your payment has been verified securely.</p>
            )}
            
            {orderDetails.redirectUrl && (
               <button 
                 onClick={() => window.location.href = orderDetails.redirectUrl as string}
                 className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-[0_8px_20px_rgba(37,99,235,0.2)] transition-all active:scale-[0.98]"
               >
                 Continue Now
               </button>
            )}
          </div>
        )}

        {status === "EXPIRED" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 py-12">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-100">
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
