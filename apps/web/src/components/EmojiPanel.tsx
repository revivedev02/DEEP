import { useState, useMemo } from 'react';

/* ── Curated emoji set ────────────────────────────────────────────────────── */
const CATEGORIES = [
  {
    label: 'Smileys',
    icon: '😊',
    emojis: [
      '😀','😂','🤣','😅','😉','😊','😍','🤩','😘','🥰',
      '😋','😛','😜','🤪','🤑','🤗','🤔','🤨','😐','😒',
      '🙄','😬','😔','😪','😴','😷','🤒','😵','🤯','😎',
      '🥸','😕','😮','😲','🥺','😢','😭','😱','😤','😡',
      '🤬','😈','💀','☠️','🙈','🙉','🙊','😼','🐱','👻',
    ],
  },
  {
    label: 'Hands',
    icon: '👍',
    emojis: [
      '👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉',
      '👆','👇','☝️','✋','🖐️','🤚','👋','🤜','🤛','👊',
      '✊','🤝','🙌','👏','🙏','💪','🦾','✍️','💅','🫶',
    ],
  },
  {
    label: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '💕','💞','💓','💗','💖','💘','💝','✨','🔥','💥',
      '⭐','🌟','💫','🎉','🎊','🎈','🏆','💯','✅','❌',
      '⚡','💎','🎯','🏅','🥇','🔑','♾️','🌈',
    ],
  },
  {
    label: 'Objects',
    icon: '🎮',
    emojis: [
      '💻','📱','🖥️','⌨️','📷','🎥','📺','🎮','🕹️','🎲',
      '🎵','🎶','🎸','🎤','📚','📝','💡','🔋','💰','🎁',
      '🛒','🏠','🚗','✈️','🚀','🌍','☕','🍕','🍔','🍜',
      '🍣','🍺','🥂','🍭','🍩','🎂','🍿','🌮','🥗','🫖',
    ],
  },
] as const;

interface EmojiPanelProps {
  onInsert: (emoji: string) => void;
}

export function EmojiPanel({ onInsert }: EmojiPanelProps) {
  const [tab, setTab]       = useState(0);
  const [query, setQuery]   = useState('');

  // Flat list of all emojis for search
  const allEmojis = useMemo(() => CATEGORIES.flatMap(c => c.emojis), []);

  const displayEmojis = query.trim()
    ? allEmojis.filter(e => e.includes(query.trim()))
    : CATEGORIES[tab].emojis;

  return (
    <div
      className="emoji-panel"
      // Stop mousedown from blurring the textarea
      onMouseDown={e => e.preventDefault()}
    >
      {/* Search */}
      <div className="emoji-panel-search">
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="emoji-search-input"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Category tabs — hidden during search */}
      {!query && (
        <div className="emoji-tabs">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              className={`emoji-tab ${tab === i ? 'active' : ''}`}
              onClick={() => setTab(i)}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="emoji-grid">
        {displayEmojis.length > 0 ? (
          displayEmojis.map(emoji => (
            <button
              key={emoji}
              className="emoji-btn"
              onClick={() => onInsert(emoji)}
              title={emoji}
            >
              {emoji}
            </button>
          ))
        ) : (
          <p className="text-xs text-text-muted col-span-full text-center py-4">
            No results
          </p>
        )}
      </div>
    </div>
  );
}
