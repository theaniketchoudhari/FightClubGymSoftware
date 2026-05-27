import React, { useState, useRef, useEffect } from 'react';
import { getFitnessAdvice } from '../services/gemini';
import { Member } from '../types';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion } from 'motion/react';

export default function AIChatbot({ memberData }: { memberData: Member }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: `Hi ${memberData.name.split(' ')[0]}! I'm your Fight Club AI Coach. How can I help you reach your fitness goals today?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const context = `Member: ${memberData.name}, Plan: ${memberData.planName}, Status: ${memberData.status}. Goals: General fitness.`;
      const advice = await getFitnessAdvice(userMsg, context);
      setMessages(prev => [...prev, { role: 'ai', content: advice || "I'm sorry, I couldn't process that. Let's try again!" }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: "Oops, something went wrong. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 bg-white/50 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-900">AI Personal Trainer</h3>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Online</span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {messages.map((msg, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white font-medium rounded-tr-none shadow-md shadow-blue-100' 
                : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'
            }`}>
              <div className="prose prose-sm max-w-none">
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-xs text-slate-400">Coach is thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your coach anything..."
            className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 pl-6 pr-14 focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-lg shadow-blue-200"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-3 flex items-center justify-center gap-1 font-bold uppercase tracking-widest">
          <Sparkles className="w-3 h-3 text-blue-500" />
          Powered by Fight Club AI Intelligence
        </p>
      </div>
    </div>
  );
}
