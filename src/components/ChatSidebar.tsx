'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Transaction, Account } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAlert {
  title: string;
  description: string;
  type: string;
}

interface ChatSidebarProps {
  transactions: Transaction[];
  accounts: Account[];
  isOpen: boolean;
  onToggle: () => void;
  alerts?: ChatAlert[];
  initialQuery?: string;
  onQueryConsumed?: () => void;
  inline?: boolean;
}

export default function ChatSidebar({
  transactions,
  accounts,
  isOpen,
  onToggle,
  alerts,
  initialQuery,
  onQueryConsumed,
  inline = false,
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('runwayai_chat_history');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist chat history (cap at 50)
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('runwayai_chat_history', JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  // Auto-send initialQuery (e.g. from "Ask AI" on a recommendation)
  useEffect(() => {
    if (!initialQuery || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: initialQuery };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    onQueryConsumed?.();

    (async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: initialQuery,
            transactions,
            accounts,
            history: [...messages, userMsg].slice(-10),
            alerts: alerts?.map((a) => ({ title: a.title, description: a.description, type: a.type })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed');
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } catch {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
      } finally {
        setIsLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('runwayai_chat_history');
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          transactions,
          accounts,
          history: updated.slice(-10),
          alerts: alerts?.map((a) => ({ title: a.title, description: a.description, type: a.type })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, transactions, accounts, alerts]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleCopyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const suggestions = [
    'Why is my cash flow dropping?',
    'What are my biggest expenses?',
    'Draft a follow-up for a late invoice',
    'Any subscriptions I should cancel?',
  ];

  // ── Shared panel content ─────────────────────────────────────────────────
  const panel = (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E6] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#0D7C66] text-sm font-bold leading-none">✦</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono">
            Insights
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-lg px-2 py-1 text-[10px] text-[#9B9B9B] transition-colors hover:bg-[#F5F5F3] hover:text-[#6B6B6B]"
            >
              Clear
            </button>
          )}
          {!inline && (
            <button
              onClick={onToggle}
              className="rounded-lg p-1.5 text-[#9B9B9B] transition-colors hover:bg-[#F5F5F3] hover:text-[#1A1A1A]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-xs text-[#9B9B9B] leading-relaxed">
              Ask anything about your finances — I have full access to your transaction data.
            </p>
            <div className="flex flex-col gap-2 mt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="flex items-start gap-2 rounded-full border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2 text-left text-xs text-[#6B6B6B] transition-colors hover:bg-[#F0F0EE] hover:text-[#1A1A1A]"
                >
                  <span className="text-[#0D7C66] shrink-0 mt-px text-[10px]">✦</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-start'} group`}
          >
            {msg.role === 'assistant' && (
              <span className="text-[#0D7C66] text-[10px] mr-2 mt-2.5 shrink-0 leading-none">✦</span>
            )}
            <div
              className={`relative max-w-[88%] text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#E8F5F0] border border-[#0D7C66]/20 rounded-lg rounded-tr-sm px-3 py-2.5 text-[#1A1A1A]'
                  : 'bg-[#F5F5F3] rounded-lg rounded-tl-sm px-3 py-2.5 text-[#1A1A1A]'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => handleCopyMessage(msg.content, i)}
                  className="absolute -bottom-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-white border border-[#E8E8E6] px-2 py-0.5 text-[10px] text-[#9B9B9B] hover:text-[#1A1A1A] shadow-sm"
                >
                  {copiedIdx === i ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start items-start">
            <span className="text-[#0D7C66] text-[10px] mr-2 mt-2.5 shrink-0 leading-none">✦</span>
            <div className="bg-[#F5F5F3] rounded-lg rounded-tl-sm px-3 py-2.5">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9B9B9B] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[#9B9B9B] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[#9B9B9B] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#E8E8E6] px-4 py-4">
        <div className="focus-glow flex items-end gap-2 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2.5 transition-colors focus-within:border-[#0D7C66]/40">
          <span className="text-[#0D7C66] text-[10px] mb-0.5 shrink-0 leading-none">✦</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-[#1A1A1A] placeholder-[#9B9B9B] outline-none"
            style={{ maxHeight: '100px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0D7C66] text-white transition-colors hover:bg-[#0A6B58] disabled:opacity-40 disabled:hover:bg-[#0D7C66]"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[#9B9B9B]">
          GPT-4o · your transaction data
        </p>
      </div>
    </div>
  );

  // ── Inline mode (right panel + mobile overlay) ───────────────────────────
  if (inline) {
    return panel;
  }

  // ── Overlay mode (legacy — kept for compatibility) ───────────────────────
  return (
    <>
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#0D7C66] text-white shadow-lg shadow-[#0D7C66]/30 transition-all hover:bg-[#0A6B58] hover:-translate-y-0.5"
        title={isOpen ? 'Close chat' : 'Ask RunwayAI'}
      >
        {isOpen ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-lg">✦</span>
        )}
      </button>

      <div
        className={`fixed top-0 right-0 z-40 flex h-full w-full max-w-md flex-col border-l border-[#E8E8E6] bg-[#FAFAF8] transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {panel}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={onToggle} />
      )}
    </>
  );
}
