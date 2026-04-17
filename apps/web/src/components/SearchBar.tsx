import { useState, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { LazyAvatar } from '@/components/LazyAvatar';
import type { ChatMessage } from '@/store/useChatStore';
import { shortTime } from './messageUtils';

interface SearchBarProps {
  messages: ChatMessage[];
  currentUserId: string;
  onClose: () => void;
  onJump: (id: string) => void;
}

export function SearchBar({ messages, onClose, onJump }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return messages.filter(m => m.content.toLowerCase().includes(q)).slice(0, 20);
  }, [query, messages]);

  function highlight(text: string, q: string) {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="relative">
      <div className="search-bar">
        <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="Search messages in this channel…"
          className="flex-1 bg-transparent text-sm text-text-normal placeholder:text-text-muted outline-none"
        />
        {query && (
          <span className="text-xs text-text-muted mr-1">{results.length} result{results.length !== 1 ? 's' : ''}</span>
        )}
        <button onClick={onClose} className="text-text-muted hover:text-text-normal transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {results.length > 0 && (
        <div className="search-results">
          {results.map(msg => (
            <div
              key={msg.id}
              className="search-result-item"
              onClick={() => { onJump(msg.id); onClose(); }}
            >
              <LazyAvatar name={msg.user.displayName} avatarUrl={msg.user.avatarUrl} size={8} />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-text-normal">{msg.user.displayName}</span>
                  <span className="text-xs text-text-muted">{shortTime(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-text-muted truncate">
                  {highlight(msg.content, query.trim())}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && (
        <div className="search-results">
          <div className="px-4 py-6 text-center text-sm text-text-muted">No messages match &ldquo;{query}&rdquo;</div>
        </div>
      )}
    </div>
  );
}
