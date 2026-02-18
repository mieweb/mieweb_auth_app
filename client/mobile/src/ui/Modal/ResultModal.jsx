import React, { useEffect, useState, useRef, useCallback } from 'react';

const ResultModal = ({ isOpen, onClose }) => {
  const [phase, setPhase] = useState('hidden'); // hidden → entering → visible → exiting
  const exitTimerRef = useRef(null);
  const dismissTimerRef = useRef(null);

  const startExit = useCallback(() => {
    // Idempotent — only trigger exit once
    if (exitTimerRef.current) return;
    setPhase('exiting');
    exitTimerRef.current = setTimeout(() => onClose(), 250);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      exitTimerRef.current = null;
      setPhase('entering');
      const enterTimer = requestAnimationFrame(() => setPhase('visible'));

      // Auto-dismiss with exit animation
      dismissTimerRef.current = setTimeout(() => startExit(), 2500);

      return () => {
        cancelAnimationFrame(enterTimer);
        clearTimeout(dismissTimerRef.current);
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      };
    } else {
      setPhase('hidden');
    }
  }, [isOpen, startExit]);

  if (!isOpen && phase === 'hidden') return null;

  const isVisible = phase === 'visible';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        isVisible ? 'bg-black/30 backdrop-blur-[3px]' : 'bg-transparent'
      }`}
      onClick={startExit}
    >
      <div
        className={`relative w-56 text-center transition-all duration-300 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Authentication successful"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glass card */}
        <div className="bg-card rounded-3xl px-6 pt-8 pb-6 shadow-2xl">
          {/* Animated check circle with ring pulse */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className={`absolute inset-0 rounded-full bg-emerald-400/20 transition-all duration-700 ${
                isVisible ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
              }`} style={{ width: 56, height: 56 }} />
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <svg
                  className={`w-7 h-7 text-white transition-all duration-500 delay-200 ${
                    isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                  }`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"
                >
                  <path
                    strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                    className={isVisible ? 'animate-draw-check' : ''}
                    style={{ strokeDasharray: 24, strokeDashoffset: isVisible ? 0 : 24 }}
                  />
                </svg>
              </div>
            </div>
          </div>

          <p className="text-[15px] font-semibold text-foreground">
            Authenticated
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            Successfully verified
          </p>

          {/* Auto-dismiss progress bar */}
          <div className="mt-5 h-0.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full bg-emerald-500/50 transition-all ease-linear ${
                isVisible ? 'w-0' : 'w-full'
              }`}
              style={{ transitionDuration: isVisible ? '2500ms' : '0ms', width: isVisible ? '0%' : '100%' }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes draw-check {
          from { stroke-dashoffset: 24; }
          to   { stroke-dashoffset: 0; }
        }
        .animate-draw-check {
          animation: draw-check 0.4s ease-out 0.25s forwards;
          stroke-dashoffset: 24;
        }
      `}</style>
    </div>
  );
};

export default ResultModal;
