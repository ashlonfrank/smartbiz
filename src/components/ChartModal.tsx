'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ChatMessage = { role: 'user' | 'ai'; text: string };

function ThinkingIndicator({ section }: { section?: string }) {
  const messages: Record<string, string> = {
    'Cash Cycle & Quarter Forecast': 'Reading your cash cycle',
    'Growth Projection': 'Reviewing growth trajectory',
    'Transactions': 'Going through your transactions',
    'Spending by Category': 'Reviewing your spending patterns',
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-start gap-3 p-3 rounded-lg bg-[#F5F5F3] max-w-[80%]"
    >
      <span className="text-[#0D7C66] text-sm mt-0.5 shrink-0 animate-shimmer">✦</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-[#9B9B9B]">{messages[section || ''] ?? 'Reviewing your financials'}</span>
        <span className="flex gap-0.5 items-center">
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </motion.div>
  );
}

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  legend: React.ReactNode;
  children: React.ReactNode;
  questions?: React.ReactNode;
  chatMessages?: ChatMessage[];
  onAskInline?: (question: string) => void;
}

export function ChartModal({
  isOpen, onClose, title, subtitle, legend,
  children, questions, chatMessages = [], onAskInline,
}: ChartModalProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const handleSubmit = () => {
    const val = inputVal.trim();
    if (!val || !onAskInline) return;
    onAskInline(val);
    setInputVal('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pt-16 pb-6 sm:px-6 sm:pt-20 sm:pb-8 md:px-10 md:pt-20 md:pb-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-5xl max-h-[80vh] bg-white rounded-xl shadow-2xl border border-[#E8E8E6] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 md:px-8 py-4 border-b border-[#E8E8E6] shrink-0">
              <div>
                <h2 className="text-sm uppercase tracking-widest text-[#6B6B6B] font-semibold font-mono">{title}</h2>
                <p className="text-xs text-[#9B9B9B] mt-1">{subtitle}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 text-[10px]">{legend}</div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F0F0EE] transition-colors text-[#9B9B9B] hover:text-[#1A1A1A]">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 md:px-8 py-6" style={{ height: chatMessages.length > 0 ? '45vh' : '55vh' }}>
                {children}
              </div>

              {chatMessages.length > 0 && (
                <div className="px-6 md:px-8 border-t border-[#E8E8E6]">
                  <div className="py-4 space-y-3 max-h-[30vh] overflow-y-auto scrollbar-hide">
                    {chatMessages.map((msg, idx) =>
                      msg.role === 'user' ? (
                        <motion.div key={idx} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex justify-end">
                          <div className="bg-[#E8F5F0] border border-[#0D7C66]/20 rounded-lg rounded-tr-sm p-3 max-w-[60%]">
                            <p className="text-sm text-[#1A1A1A]">{msg.text}</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex items-start gap-3 p-3 rounded-lg bg-[#F5F5F3] max-w-[80%]">
                          <span className="text-[#0D7C66] text-sm mt-0.5 shrink-0">✦</span>
                          <p className="text-sm text-[#1A1A1A] leading-relaxed">{msg.text}</p>
                        </motion.div>
                      )
                    )}
                    <AnimatePresence>
                      {chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user' && (
                        <ThinkingIndicator section={title} />
                      )}
                    </AnimatePresence>
                    <div ref={chatEndRef} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 md:px-8 py-4 border-t border-[#E8E8E6] shrink-0">
              {questions}
              {onAskInline && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 bg-[#F5F5F3] rounded-lg px-3 py-2.5 border border-[#E8E8E6] max-w-lg focus-within:border-[#0D7C66]/50 transition-colors focus-glow">
                    <span className="text-[#0D7C66] text-xs shrink-0">✦</span>
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder="Ask a follow-up..."
                      className="w-full bg-transparent text-xs text-[#1A1A1A] placeholder:text-[#9B9B9B] focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
