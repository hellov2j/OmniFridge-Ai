import { useState, useRef, useEffect, useCallback } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useGemini } from '../hooks/useGemini';
import { MS_PER_DAY } from '../utils/constants';
import './VoiceAssistant.css';

const ACTION_ICONS = { add: '➕', consume: '🍽️', remove: '🗑️' };
const ACTION_LABELS = { add: 'Add', consume: 'Consumed', remove: 'Remove' };

export default function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [actions, setActions] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | listening | processing | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const panelRef = useRef(null);

  const { items, addItem, addItems, updateItem, deleteItem, deleteItemAndShop } = useInventory();
  const { parseVoiceCommand, processingVoice, error: geminiError, clearError } = useGemini();

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && !e.target.closest('.voice-fab')) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    clearError();
    setTranscript('');
    setInterimText('');
    setActions([]);
    setStatus('listening');
    setStatusMsg('Listening... speak now');

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      if (final) {
        setTranscript(prev => (prev + ' ' + final).trim());
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText('');
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
      if (event.error === 'no-speech') {
        setStatus('error');
        setStatusMsg('No speech detected. Try again.');
      } else if (event.error === 'not-allowed') {
        setStatus('error');
        setStatusMsg('Microphone permission denied. Allow mic access and try again.');
      } else {
        setStatus('error');
        setStatusMsg(`Speech error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [clearError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  // When transcript finalizes and we stop listening, process it
  const processTranscript = useCallback(async () => {
    stopListening();
    const text = transcript.trim();
    if (!text) {
      setStatus('error');
      setStatusMsg('No speech detected. Try again.');
      return;
    }

    setStatus('processing');
    setStatusMsg('Understanding your command...');

    const result = await parseVoiceCommand(text, items);

    if (!result || result.length === 0) {
      setStatus('error');
      setStatusMsg('Could not understand the command. Try rephrasing.');
      return;
    }

    setActions(result);
    setStatus('done');
    setStatusMsg(`Found ${result.length} action(s). Review & confirm below.`);
  }, [transcript, items, parseVoiceCommand, stopListening]);

  // Execute the confirmed actions
  const executeActions = async () => {
    setStatus('processing');
    setStatusMsg('Updating inventory...');

    let addedCount = 0;
    let consumedCount = 0;
    let removedCount = 0;

    try {
      const itemsToAdd = [];

      for (const action of actions) {
        if (action.action === 'add') {
          itemsToAdd.push({
            name: action.name,
            category: action.category || 'other',
            quantity: action.quantity || 1,
            unit: action.unit || 'pieces',
            expiryDate: new Date(Date.now() + (action.estimatedShelfLifeDays || 7) * MS_PER_DAY)
              .toISOString().split('T')[0],
          });
          addedCount++;
        } else if (action.action === 'consume' || action.action === 'remove') {
          // Find matching item in inventory
          const matchId = action.matchedItemId;
          const matchedItem = matchId
            ? items.find(i => i.id === matchId)
            : items.find(i => i.name.toLowerCase().includes(action.name.toLowerCase()));

          if (matchedItem) {
            const newQty = matchedItem.quantity - (action.quantity || 1);
            if (newQty <= 0) {
              // Fully consumed / removed
              if (action.action === 'consume') {
                await deleteItemAndShop(matchedItem.id, 'consumed');
              } else {
                await deleteItem(matchedItem.id);
              }
            } else {
              await updateItem(matchedItem.id, { quantity: newQty });
            }
            if (action.action === 'consume') consumedCount++;
            else removedCount++;
          } else {
            // No match found — skip but note it
            console.warn(`Voice action: no match for "${action.name}" in inventory`);
          }
        }
      }

      if (itemsToAdd.length > 0) {
        await addItems(itemsToAdd);
      }

      const parts = [];
      if (addedCount) parts.push(`${addedCount} added`);
      if (consumedCount) parts.push(`${consumedCount} consumed`);
      if (removedCount) parts.push(`${removedCount} removed`);

      setStatus('done');
      setStatusMsg(`✅ Done! ${parts.join(', ') || 'No changes made'}.`);
      setActions([]);

      // Auto-close after a bit
      setTimeout(() => {
        setIsOpen(false);
        setStatus('idle');
        setTranscript('');
      }, 3000);
    } catch (err) {
      console.error('Voice action execution error:', err);
      setStatus('error');
      setStatusMsg('Failed to update inventory. Please try again.');
    }
  };

  const removeAction = (index) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setTranscript('');
    setInterimText('');
    setActions([]);
    setStatus('idle');
    setStatusMsg('');
    clearError();
  };

  if (!supported) return null; // Don't render if browser doesn't support

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`voice-fab ${listening ? 'voice-fab-active' : ''} ${isOpen ? 'voice-fab-open' : ''}`}
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            reset();
          } else {
            setIsOpen(false);
            stopListening();
          }
        }}
        title="Voice Command"
      >
        {listening ? (
          <div className="voice-fab-waves">
            <span className="voice-wave" />
            <span className="voice-wave" />
            <span className="voice-wave" />
          </div>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>

      {/* Voice Panel */}
      {isOpen && (
        <div className="voice-panel glass-panel" ref={panelRef}>
          <div className="voice-panel-header">
            <h3>🎙️ Voice Command</h3>
            <button className="voice-panel-close" onClick={() => { setIsOpen(false); stopListening(); }}>✕</button>
          </div>

          {/* Transcript Display */}
          <div className="voice-transcript-area">
            {transcript || interimText ? (
              <div className="voice-transcript">
                <span className="voice-transcript-final">{transcript}</span>
                {interimText && <span className="voice-transcript-interim">{interimText}</span>}
              </div>
            ) : (
              <div className="voice-transcript-placeholder">
                {status === 'listening'
                  ? '🎤 Listening...'
                  : 'Say something like: "I bought two cartons of milk and ate one apple"'}
              </div>
            )}
          </div>

          {/* Status */}
          {statusMsg && (
            <div className={`voice-status voice-status-${status}`}>
              {status === 'processing' && <div className="voice-spinner" />}
              {status === 'listening' && <div className="voice-pulse-dot" />}
              <span>{statusMsg}</span>
            </div>
          )}

          {geminiError && (
            <div className="voice-status voice-status-error">
              <span>⚠️ {geminiError}</span>
            </div>
          )}

          {/* Actions Preview */}
          {actions.length > 0 && (
            <div className="voice-actions-list">
              <div className="voice-actions-title">Parsed Actions:</div>
              {actions.map((a, i) => (
                <div key={i} className={`voice-action-item voice-action-${a.action}`}>
                  <span className="voice-action-icon">{ACTION_ICONS[a.action]}</span>
                  <div className="voice-action-details">
                    <div className="voice-action-name">
                      <span className="voice-action-badge">{ACTION_LABELS[a.action]}</span>
                      {a.name}
                    </div>
                    <div className="voice-action-meta">
                      {a.quantity} {a.unit} · {a.category}
                    </div>
                  </div>
                  <button className="voice-action-remove" onClick={() => removeAction(i)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="voice-controls">
            {status === 'idle' && (
              <button className="btn btn-primary btn-lg voice-mic-btn" onClick={startListening}>
                🎤 Start Talking
              </button>
            )}

            {status === 'listening' && (
              <button className="btn btn-primary btn-lg voice-mic-btn voice-mic-btn-active" onClick={processTranscript}>
                ✅ Done Speaking
              </button>
            )}

            {status === 'processing' && (
              <button className="btn btn-ghost btn-lg voice-mic-btn" disabled>
                ⏳ Processing...
              </button>
            )}

            {status === 'done' && actions.length > 0 && (
              <div className="voice-confirm-row">
                <button className="btn btn-primary" onClick={executeActions}>
                  ✅ Confirm All
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  🔄 Start Over
                </button>
              </div>
            )}

            {status === 'error' && (
              <button className="btn btn-primary btn-lg voice-mic-btn" onClick={() => { reset(); startListening(); }}>
                🎤 Try Again
              </button>
            )}

            {(status === 'done' && actions.length === 0) && (
              <button className="btn btn-primary btn-lg voice-mic-btn" onClick={() => { reset(); startListening(); }}>
                🎤 Try Again
              </button>
            )}
          </div>

          {/* Hint */}
          <div className="voice-hint">
            💡 Try: "I bought 2 liters of milk and 6 eggs" or "I ate the leftover chicken"
          </div>
        </div>
      )}
    </>
  );
}
