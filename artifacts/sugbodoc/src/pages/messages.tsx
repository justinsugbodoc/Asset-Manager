import { useState, useRef, useEffect } from 'react';
import AppShell from '@/components/layout/app-shell';
import { inbox } from '@/data/mock';
import { Send, ChevronLeft, MoreVertical, Image as ImageIcon, MessageSquare } from 'lucide-react';

export default function Messages() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const activeThread = inbox.find(t => t.id === activeThreadId);

  // Initialize messages when thread opens
  useEffect(() => {
    if (activeThread) {
      setMessages(activeThread.messages);
    }
  }, [activeThreadId]);

  // Auto scroll to bottom
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !activeThread) return;

    const newMsg = {
      id: `m_${Date.now()}`,
      sender: 'patient',
      text: inputMsg.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInputMsg('');
    setIsTyping(true);

    // Simulate doctor reply
    setTimeout(() => {
      setIsTyping(false);
      const replyMsg = {
        id: `m_reply_${Date.now()}`,
        sender: 'doctor',
        text: 'Thank you for your message. I will review this and get back to you shortly.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, replyMsg]);
    }, 2000);
  };

  return (
    <AppShell title="Messages">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex h-[calc(100vh-140px)] lg:h-[700px] relative">
        
        {/* Inbox List (Left pane) */}
        <div className={`w-full lg:w-80 border-r border-border flex flex-col absolute lg:relative z-10 bg-card h-full transition-transform duration-300 ${activeThreadId ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}`}>
          <div className="p-4 border-b border-border bg-muted/30">
            <input 
              type="search" 
              placeholder="Search messages..." 
              className="w-full h-10 px-3 bg-background border border-input rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {inbox.map(thread => (
              <button 
                key={thread.id} 
                onClick={() => setActiveThreadId(thread.id)}
                className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex gap-3 ${activeThreadId === thread.id ? 'bg-primary/5 lg:border-l-2 lg:border-primary' : 'border-l-2 border-transparent'}`}
              >
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {thread.doctor.initials}
                  </div>
                  {thread.unread && (
                    <div className="absolute top-0 right-0 h-3 w-3 rounded-full bg-primary border-2 border-card"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className={`font-semibold truncate pr-2 ${thread.unread ? 'text-foreground' : 'text-foreground/80'}`}>{thread.doctor.name}</h4>
                    <span className={`text-xs shrink-0 ${thread.unread ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{thread.timestamp}</span>
                  </div>
                  <p className={`text-sm truncate ${thread.unread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{thread.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area (Right pane) */}
        <div className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-background absolute lg:relative inset-0 z-20 transition-transform duration-300 ${activeThreadId ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} ${!activeThreadId && 'lg:flex'}`}>
          
          {activeThread ? (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b border-border bg-card flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveThreadId(null)}
                    className="lg:hidden h-10 w-10 -ml-2 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {activeThread.doctor.initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{activeThread.doctor.name}</h3>
                    <p className="text-xs text-primary">{activeThread.doctor.specialty}</p>
                  </div>
                </div>
                <button className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-center text-xs text-muted-foreground my-4">
                  <span className="bg-muted px-3 py-1 rounded-full border border-border">Conversation started</span>
                </div>
                
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <MessageSquare className="h-12 w-12 mb-2" />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isDoc = msg.sender === 'doctor';
                    return (
                      <div key={msg.id} className={`flex ${isDoc ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          isDoc 
                            ? 'bg-card border border-border text-foreground rounded-tl-sm' 
                            : 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          <span className={`text-[10px] mt-1.5 block text-right ${isDoc ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                            {msg.time}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                {isTyping && (
                  <div className="flex justify-start animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
                      <div className="flex gap-1.5 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={endOfMessagesRef} className="h-1" />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-card border-t border-border">
                <form onSubmit={handleSend} className="flex gap-2 items-end relative">
                  <button type="button" className="h-12 w-12 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 transition-colors">
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <textarea 
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    placeholder="Type your message..." 
                    className="flex-1 max-h-32 min-h-[48px] py-3 px-4 bg-background border border-input rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
                    rows={1}
                  />
                  <button 
                    type="submit" 
                    disabled={!inputMsg.trim()}
                    className="h-12 w-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Send className="h-5 w-5 ml-1" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="hidden lg:flex h-full flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a doctor from the list to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
