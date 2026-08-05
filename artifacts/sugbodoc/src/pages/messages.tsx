import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '@/components/layout/app-shell';
import { getCurrentSessionUser } from '@/hooks/use-auth';
import {
  serverMarkMessagesRead,
  serverMessageConversations,
  serverMessages,
  serverSendMessage,
  type ServerMessage,
  type ServerMessageConversation,
} from '@/lib/server';
import { ChevronLeft, MessageSquare, MoreVertical, Send } from 'lucide-react';

const cardClass = 'rounded-2xl border border-border bg-card shadow-sm';
const formatTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  : '';

export default function Messages() {
  const session = getCurrentSessionUser();
  const [threads, setThreads] = useState<ServerMessageConversation[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const activeThread = threads.find(thread => thread.id === activeThreadId) ?? null;
  const isPatient = session?.role === 'Patient';
  const getThreadDisplay = (thread: ServerMessageConversation) => ({
    name: isPatient ? 'SugboDoc Admin' : thread.patientName,
    initials: isPatient ? 'SD' : thread.patientInitials,
    detail: isPatient ? 'SugboDoc care team' : thread.patientEmail,
  });
  const filteredThreads = useMemo(
    () => threads.filter(thread => {
      const display = getThreadDisplay(thread);
      return `${display.name} ${display.detail} ${thread.lastMessage?.body ?? ''}`.toLowerCase().includes(search.toLowerCase());
    }),
    [threads, search, isPatient],
  );

  const refreshThreads = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await serverMessageConversations();
      setThreads(response.conversations);
      if (!activeThreadId && response.conversations[0]) setActiveThreadId(response.conversations[0].id);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load messages.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const refreshMessages = async (conversationId: string, showLoading = false) => {
    if (showLoading) setLoadingMessages(true);
    try {
      const response = await serverMessages(conversationId);
      setMessages(response.messages);
      await serverMarkMessagesRead(conversationId);
      setThreads(current => current.map(thread => thread.id === conversationId ? { ...thread, unreadCount: 0, lastMessage: response.messages.at(-1) ?? null } : thread));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this conversation.');
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    void refreshThreads(true);
    const interval = window.setInterval(() => void refreshThreads(), 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    void refreshMessages(activeThreadId, true);
    const interval = window.setInterval(() => void refreshMessages(activeThreadId), 5000);
    return () => window.clearInterval(interval);
  }, [activeThreadId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputMsg.trim() || !activeThreadId || sending) return;
    setSending(true);
    try {
      const response = await serverSendMessage(activeThreadId, inputMsg.trim());
      setMessages(current => [...current, response.message]);
      setInputMsg('');
      await refreshThreads();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send this message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="Messages">
      <div className={`${cardClass} relative flex h-[calc(100vh-140px)] overflow-hidden lg:h-[700px]`}>
        <div className={`absolute z-10 flex h-full w-full flex-col bg-card transition-transform duration-300 lg:relative lg:w-80 lg:translate-x-0 ${activeThreadId ? '-translate-x-full' : 'translate-x-0'}`}>
          <div className="border-b border-border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Secure care messaging</p>
            <input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search conversations..." className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </div>
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {loading ? <div className="space-y-3 p-4">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
              : filteredThreads.map(thread => (
                <button key={thread.id} onClick={() => setActiveThreadId(thread.id)} className={`flex w-full gap-3 border-l-2 p-4 text-left transition hover:bg-muted/50 ${activeThreadId === thread.id ? 'border-primary bg-primary/5' : 'border-transparent'}`}>
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{getThreadDisplay(thread).initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2"><h4 className="truncate font-semibold">{getThreadDisplay(thread).name}</h4>{thread.unreadCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{thread.unreadCount}</span>}</div>
                    <p className={`truncate text-sm ${thread.unreadCount ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{thread.lastMessage?.body ?? 'No messages yet — start the conversation.'}</p>
                  </div>
                </button>
              ))}
            {!loading && !filteredThreads.length && <div className="p-6 text-center text-sm text-muted-foreground">No conversations found.</div>}
          </div>
        </div>

        <div className={`absolute inset-0 z-20 flex flex-1 flex-col bg-slate-50/50 transition-transform duration-300 dark:bg-background lg:relative lg:inset-auto lg:z-0 lg:translate-x-0 ${activeThreadId ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          {activeThread ? <>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveThreadId(null)} className="rounded-full p-2 text-muted-foreground hover:bg-muted lg:hidden"><ChevronLeft className="h-5 w-5" /></button>
                 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{getThreadDisplay(activeThread).initials}</div>
                 <div><h3 className="text-sm font-bold">{getThreadDisplay(activeThread).name}</h3><p className="text-xs text-primary">{getThreadDisplay(activeThread).detail}</p></div>
              </div>
              <MoreVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="my-2 text-center text-xs text-muted-foreground"><span className="rounded-full border border-border bg-muted px-3 py-1">Database-backed conversation</span></div>
              {loadingMessages ? <div className="space-y-3"><div className="h-12 w-2/3 animate-pulse rounded-2xl bg-muted" /><div className="ml-auto h-12 w-2/3 animate-pulse rounded-2xl bg-muted" /></div>
                : messages.length ? messages.map(message => {
                  const mine = message.senderId === session?.id;
                  return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm border border-border bg-card text-foreground'}`}><p className="whitespace-pre-wrap leading-relaxed">{message.body}</p><span className={`mt-1.5 block text-right text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{formatTime(message.createdAt)}</span></div></div>;
                }) : <div className="flex h-full flex-col items-center justify-center text-muted-foreground"><MessageSquare className="mb-2 h-12 w-12 opacity-30" /><p>No messages yet</p><p className="text-xs">Send a message to the SugboDoc care team.</p></div>}
              <div ref={endOfMessagesRef} />
            </div>
            {error && <p className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>}
            <form onSubmit={handleSend} className="flex gap-2 border-t border-border bg-card p-4">
              <textarea value={inputMsg} onChange={event => setInputMsg(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(event); } }} placeholder="Type your message..." className="min-h-[48px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" rows={1} />
              <button type="submit" disabled={!inputMsg.trim() || sending} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Send className="ml-1 h-5 w-5" /></button>
            </form>
          </> : <div className="hidden h-full flex-col items-center justify-center text-muted-foreground lg:flex"><MessageSquare className="mb-4 h-16 w-16 opacity-20" /><p className="text-lg font-medium">Select a conversation</p><p className="text-sm">Your messages are shared securely with the SugboDoc care team.</p></div>}
        </div>
      </div>
    </AppShell>
  );
}