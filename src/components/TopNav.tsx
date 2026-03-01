'use client';

import { useEffect, useState, useRef } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account } from '@/lib/types';

interface TopNavProps {
  accounts?: Account[];
  onGenerateReport?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onDisconnect?: () => void;
}

export function TopNav({ accounts = [], onGenerateReport, onExportCSV, onExportPDF, onDisconnect }: TopNavProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) setIsAccountDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const primaryAccount = accounts[0];
  const accountLabel = primaryAccount
    ? `${primaryAccount.name} ••${primaryAccount.account_id.slice(-4)}`
    : 'No account';

  return (
    <header className="w-full bg-[#FAFAF8] border-b border-[#E8E8E6] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#1A1A1A] text-sm tracking-tight">RunwayAI</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Account selector */}
          <div className="hidden sm:flex items-center gap-2 relative" ref={accountDropdownRef}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <button
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
              className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
            >
              <span>{accountLabel}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {accounts.length > 0 && (
              <span className="text-xs text-[#9B9B9B]">· Synced just now</span>
            )}

            <AnimatePresence>
              {isAccountDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2 w-48 bg-white border border-[#E8E8E6] rounded-lg shadow-xl overflow-hidden z-50 py-1"
                >
                  {accounts.map((a) => (
                    <div key={a.account_id} className="px-4 py-2 text-xs text-[#1A1A1A] border-b border-[#F5F5F3] last:border-0">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-[#9B9B9B]">{a.balances.current != null ? `$${a.balances.current.toLocaleString()}` : '—'}</div>
                    </div>
                  ))}
                  <button
                    onClick={() => { setIsAccountDropdownOpen(false); onDisconnect?.(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400/70" />
                    Disconnect
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Export dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1A1A1A] bg-[#F5F5F3] hover:bg-[#F0F0EE] border border-[#E8E8E6] rounded-md transition-colors"
            >
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 bg-white border border-[#E8E8E6] rounded-lg shadow-xl overflow-hidden z-50 py-1"
                >
                  <button
                    onClick={() => { setIsDropdownOpen(false); onExportCSV?.(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#1A1A1A] hover:bg-[#F5F5F3] transition-colors text-left"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#6B6B6B]" />
                    Download CSV
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); onExportPDF?.(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#1A1A1A] hover:bg-[#F5F5F3] transition-colors text-left"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#6B6B6B]" />
                    Download PDF Report
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); onGenerateReport?.(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#0D7C66] hover:bg-[#E8F5F0] transition-colors text-left"
                  >
                    <span className="text-[#0D7C66] text-sm w-3.5 text-center">✦</span>
                    Loan Readiness Report
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
