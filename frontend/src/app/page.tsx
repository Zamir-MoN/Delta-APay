"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const heroRef = useRef(null);
  
  useEffect(() => {
    // Need to dynamically import gsap or just use standard import
    // But since it's Next.js and client component, it's fine.
    import("gsap").then((gsap) => {
      gsap.default.fromTo(
        ".fade-up",
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: "power3.out" }
      );
    });
  }, []);

  const handleBuy = async () => {
    // In a real app we would pick a product id
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1, productId: "test-product-id" }),
      });
      const data = await res.json();
      
      if (data.error) {
        alert("Server Error: " + data.error);
        return;
      }
      
      if (data.order?.id) {
        router.push(`/checkout/${data.order.id}?qr=${encodeURIComponent(data.qrCode)}&amount=${data.order.amount}&purpose=${data.order.purpose}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error creating order");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] px-4" ref={heroRef}>
      <div className="text-center max-w-3xl fade-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 fade-up text-accent text-sm font-medium">
          <Zap size={16} /> Instant Verification Engine
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
          The Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Payments</span>
        </h1>
        <p className="text-lg md:text-xl text-secondary-text mb-10 max-w-2xl mx-auto">
          Experience seamless, zero-click UPI verification. Scan, pay, and receive your digital products instantly without waiting for manual approval.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button 
            onClick={handleBuy}
            className="group relative px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)]"
          >
            Buy Sample Product - ₹1
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl w-full fade-up">
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
          <ShieldCheck size={40} className="text-success mb-4" />
          <h3 className="text-xl font-bold mb-2">100% Secure</h3>
          <p className="text-secondary-text">Every transaction is uniquely bound to a purpose code and verified automatically.</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
          <Zap size={40} className="text-accent mb-4" />
          <h3 className="text-xl font-bold mb-2">Lightning Fast</h3>
          <p className="text-secondary-text">Less than 5 seconds from payment to product delivery with WebSockets.</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-xl font-bold mb-2">Zero Humans</h3>
          <p className="text-secondary-text">Fully automated engine parses emails and matches orders with 99.9% accuracy.</p>
        </div>
      </div>
    </div>
  );
}
