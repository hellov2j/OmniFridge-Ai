import { useState, useRef, useCallback, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useGemini } from '../hooks/useGemini';
import { useLocalDetection } from '../hooks/useLocalDetection';
import { CATEGORIES, UNITS, MS_PER_DAY } from '../utils/constants';
import './ScanView.css';

export default function ScanView() {
  const [activeTab, setActiveTab] = useState('webcam');
  const [detectedItems, setDetectedItems] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState(null);
  // Detection mode: 'local' (offline TF.js) or 'cloud' (Gemini API / demo)
  const [detectionMode, setDetectionMode] = useState(() =>
    localStorage.getItem('smartfridge_detection_mode') || 'local'
  );

  // Manual form state
  const [manualForm, setManualForm] = useState({
    name: '', category: 'other', quantity: 1, unit: 'pieces', expiryDate: '',
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const captureRetryRef = useRef(0);

  const { addItem, addItems } = useInventory();
  const { detectFood, detecting: geminiDetecting, error: geminiError, clearError: clearGeminiError } = useGemini();
  const {
    detectFromImage: localDetect,
    detecting: localDetecting,
    modelLoading,
    error: localError,
    clearError: clearLocalError,
    isModelLoaded,
  } = useLocalDetection();

  const detecting = detectionMode === 'local' ? localDetecting : geminiDetecting;
  const error = detectionMode === 'local' ? localError : geminiError;
  const clearError = detectionMode === 'local' ? clearLocalError : clearGeminiError;

  // Persist detection mode
  useEffect(() => {
    localStorage.setItem('smartfridge_detection_mode', detectionMode);
  }, [detectionMode]);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setCapturedImage(null);
      setWebcamActive(true);
      setWebcamError(null);
      clearError();

      // Wait for React to render the <video> element before assigning stream
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (err) {
      console.error('Webcam error:', err);
      setWebcamError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err.name === 'NotFoundError'
            ? 'No camera found. Please connect a camera and try again.'
            : `Camera error: ${err.message}`
      );
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.videoWidth || !video.videoHeight) {
      console.warn('Video not ready yet');
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 100) {
      if (captureRetryRef.current < 5) {
        captureRetryRef.current++;
        setTimeout(() => captureFrame(), 200);
      } else {
        captureRetryRef.current = 0;
        setWebcamError('Failed to capture frame. Please try again.');
      }
      return;
    }
    captureRetryRef.current = 0;

    setCapturedImage(dataUrl);
    stopWebcam();
    handleDetect(dataUrl);
  };

  const handleFileUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      setWebcamError('Image is too large (max 10 MB). Please choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target.result);
      handleDetect(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleDetect = async (imageData) => {
    setDetectedItems([]);
    setSuccessMsg('');
    setWebcamError(null);

    let results;
    if (detectionMode === 'local') {
      results = await localDetect(imageData);
    } else {
      results = await detectFood(imageData);
    }

    if (results && results.length > 0) {
      const items = results.map(r => ({
        name: r.name,
        category: r.category || 'other',
        quantity: 1,
        unit: r.suggestedUnit || 'pieces',
        expiryDate: new Date(Date.now() + (r.estimatedShelfLifeDays || 7) * MS_PER_DAY).toISOString().split('T')[0],
        shelfLife: r.estimatedShelfLifeDays || 7,
        confidence: r.confidence || null,
      }));
      setDetectedItems(items);
    }
  };

  const updateDetectedItem = (index, field, value) => {
    setDetectedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeDetectedItem = (index) => {
    setDetectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const confirmDetectedItems = async () => {
    if (detectedItems.length === 0) return;
    const toAdd = detectedItems.map(({ shelfLife, confidence, ...rest }) => rest);
    await addItems(toAdd);
    setSuccessMsg(`${toAdd.length} item(s) added to your fridge!`);
    setDetectedItems([]);
    setCapturedImage(null);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!manualForm.name.trim()) return;
    await addItem({
      ...manualForm,
      quantity: Number(manualForm.quantity),
      expiryDate: manualForm.expiryDate || new Date(Date.now() + 7 * MS_PER_DAY).toISOString().split('T')[0],
    });
    setSuccessMsg(`${manualForm.name} added to your fridge!`);
    setManualForm({ name: '', category: 'other', quantity: 1, unit: 'pieces', expiryDate: '' });
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <div className="scan-view">
      <h1>Scan & Add Food</h1>
      <p>Detect food items using AI or add them manually</p>

      {/* Detection Mode Selector */}
      {activeTab !== 'manual' && (
        <div className="detection-mode-bar">
          <span className="detection-mode-label">Detection Engine:</span>
          <button
            className={`detection-mode-btn ${detectionMode === 'local' ? 'active' : ''}`}
            onClick={() => { setDetectionMode('local'); clearError(); }}
          >
            🧠 Offline (TF.js)
          </button>
          <button
            className={`detection-mode-btn ${detectionMode === 'cloud' ? 'active' : ''}`}
            onClick={() => { setDetectionMode('cloud'); clearError(); }}
          >
            ☁️ Cloud (Gemini)
          </button>
          {detectionMode === 'local' && (
            <span className="detection-mode-status">
              {modelLoading ? '⏳ Loading model...' : isModelLoaded ? '✅ Model ready' : '📦 Model will load on first scan'}
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="scan-tabs">
        <button className={`scan-tab ${activeTab === 'webcam' ? 'active' : ''}`} onClick={() => { setActiveTab('webcam'); clearError(); }}>
          📷 Webcam
        </button>
        <button className={`scan-tab ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => { setActiveTab('upload'); stopWebcam(); clearError(); }}>
          📁 Upload Image
        </button>
        <button className={`scan-tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => { setActiveTab('manual'); stopWebcam(); clearError(); }}>
          ✏️ Manual Entry
        </button>
      </div>

      {error && (
        <div className="scan-error">⚠️ {error}</div>
      )}

      {webcamError && (
        <div className="scan-error">📷 {webcamError}</div>
      )}

      {successMsg && (
        <div className="scan-success">✅ {successMsg}</div>
      )}

      <div className="scan-content">
        {/* Left: Input Area */}
        <div>
          {activeTab === 'webcam' && (
            <div className="webcam-section glass-panel">
              <div className="webcam-preview">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ display: webcamActive && !capturedImage ? 'block' : 'none' }}
                />
                {webcamActive && !capturedImage && detecting && (
                  <div className="webcam-scanning-ring" />
                )}
                {capturedImage && (
                  <img src={capturedImage} alt="Captured" />
                )}
                {!webcamActive && !capturedImage && (
                  <div className="webcam-preview-placeholder">
                    <span>📷</span>
                    <span>Click Start Camera to begin</span>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="webcam-controls">
                {!webcamActive && !capturedImage && (
                  <button className="btn btn-primary" onClick={startWebcam}>
                    🎥 Start Camera
                  </button>
                )}
                {webcamActive && (
                  <>
                    <button className="btn btn-primary" onClick={captureFrame} disabled={detecting}>
                      📸 Capture & Scan
                    </button>
                    <button className="btn btn-ghost" onClick={stopWebcam}>
                      Stop
                    </button>
                  </>
                )}
                {capturedImage && !detecting && (
                  <button className="btn btn-ghost" onClick={() => { setCapturedImage(null); setDetectedItems([]); }}>
                    🔄 Retake
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              {!capturedImage ? (
                <div
                  className={`upload-zone glass-panel ${dragOver ? 'drag-over' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="upload-zone-icon">📁</div>
                  <div className="upload-zone-text">
                    Drag & drop an image here, or click to browse
                  </div>
                  <div className="upload-zone-hint">
                    Supports JPG, PNG, WebP (max 10 MB)
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e.target.files[0])}
                  />
                </div>
              ) : (
                <div>
                  <div className="upload-preview glass-panel">
                    <img src={capturedImage} alt="Uploaded" />
                  </div>
                  {!detecting && (
                    <button className="btn btn-ghost" onClick={() => { setCapturedImage(null); setDetectedItems([]); }}>
                      🔄 Upload Different Image
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <form className="manual-form glass-panel" onSubmit={handleManualAdd}>
              <h3 style={{ marginBottom: 'var(--space-lg)' }}>✏️ Add Item Manually</h3>
              <div className="manual-form-grid">
                <div className="form-group">
                  <label className="form-label">Item Name</label>
                  <input
                    className="input"
                    placeholder="e.g., Whole Milk"
                    value={manualForm.name}
                    onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="input"
                    value={manualForm.category}
                    onChange={(e) => setManualForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={manualForm.quantity}
                    onChange={(e) => setManualForm(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select
                    className="input"
                    value={manualForm.unit}
                    onChange={(e) => setManualForm(prev => ({ ...prev, unit: e.target.value }))}
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Expiry Date</label>
                  <input
                    className="input"
                    type="date"
                    value={manualForm.expiryDate}
                    onChange={(e) => setManualForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                ➕ Add to Fridge
              </button>
            </form>
          )}
        </div>

        {/* Right: Detected Items */}
        <div className="detected-section glass-panel">
          {detecting || modelLoading ? (
            <div className="detecting-overlay">
              <div className="detecting-spinner" />
              <div className="detecting-text">
                {modelLoading ? 'Loading AI model (~5MB)...' : 'Analyzing image with AI...'}
              </div>
              <div className="detecting-text text-muted" style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                {modelLoading
                  ? 'First load only — cached for next time'
                  : detectionMode === 'local'
                    ? 'Running TensorFlow.js locally'
                    : 'Identifying food items'}
              </div>
            </div>
          ) : detectedItems.length > 0 ? (
            <>
              <h3>🔍 Detected Items ({detectedItems.length})</h3>
              <div className="detected-list">
                {detectedItems.map((item, i) => (
                  <div key={i} className="detected-item">
                    <div className="detected-item-info">
                      <div className="detected-item-name">
                        {item.name}
                        {item.confidence && (
                          <span className="confidence-badge">{item.confidence}%</span>
                        )}
                      </div>
                      <div className="detected-item-meta">
                        <span className="badge badge-category">{item.category}</span>
                        {' · '}~{item.shelfLife} days shelf life
                      </div>
                    </div>
                    <input
                      className="input detected-item-qty"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateDetectedItem(i, 'quantity', Number(e.target.value))}
                    />
                    <button className="detected-item-remove" onClick={() => removeDetectedItem(i)}>✕</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={confirmDetectedItems}>
                ✅ Add {detectedItems.length} Item(s) to Fridge
              </button>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No Items Detected</div>
              <div className="empty-state-text">
                {activeTab === 'manual'
                  ? 'Use the form on the left to add items manually'
                  : 'Capture or upload an image to detect food items'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
