'use client';

import { motion } from 'framer-motion';

interface ContextualQuestionsProps {
  questions: string[];
  onAsk: (question: string) => void;
}

export function ContextualQuestions({ questions, onAsk }: ContextualQuestionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
      {questions.map((question, idx) => (
        <motion.button
          key={idx}
          onClick={() => onAsk(question)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05, duration: 0.2, ease: 'easeOut' }}
          className="group whitespace-nowrap px-3 py-1.5 rounded-full bg-[#F5F5F3] border border-[#E8E8E6] text-xs text-[#6B6B6B] hover:bg-[#F0F0EE] hover:text-[#1A1A1A] hover:border-[#E8E8E6] active:opacity-80 transition-all flex items-center gap-1.5"
        >
          <span className="text-[#0D7C66] text-xs group-hover:text-[#0A6B58] transition-colors">✦</span>
          {question}
        </motion.button>
      ))}
    </div>
  );
}
