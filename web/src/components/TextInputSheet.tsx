import { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Sheet } from './Sheet';
import { useStore } from '../store';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function TextInputSheet({ open, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const mode = useStore((s) => s.mode);

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };

  const placeholder = mode === 'somm'
    ? 'Tell me what you are having.'
    : 'A bottle name, a producer, anything.';

  return (
    <Sheet open={open} onClose={onClose} compact>
      <div className="tinp">
        <p className="t-label tinp__label">
          {mode === 'somm' ? 'Pocket Somm · text' : 'Reverse Scan · text'}
        </p>
        <TextareaAutosize
          minRows={3}
          maxRows={8}
          className="tinp__area"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
        />
        <div className="tinp__actions">
          <button className="btn-tertiary" onClick={onClose} type="button">Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!text.trim()} type="button">Pour</button>
        </div>
        <style>{`
          .tinp { padding: 4px; }
          .tinp__label { margin-bottom: 12px; }
          .tinp__area {
            width: 100%;
            background: var(--midnight);
            color: var(--parchment);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 16px;
            font: italic 18px/1.55 var(--font-rowan);
            resize: none;
            transition: border-color 180ms var(--ease-standard);
          }
          .tinp__area:focus-visible {
            border-color: var(--ember);
            box-shadow: 0 0 0 1px var(--ember);
            outline: none;
          }
          .tinp__area::placeholder {
            color: color-mix(in oklch, var(--bone) 50%, transparent);
            font-style: italic;
          }
          .tinp__actions {
            display: flex; justify-content: space-between; align-items: center;
            margin-top: 16px;
          }
        `}</style>
      </div>
    </Sheet>
  );
}
