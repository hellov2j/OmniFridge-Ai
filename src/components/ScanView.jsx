import { useState, useRef, useCallback, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useGemini } from '../hooks/useGemini';
import { useLocalDetection } from '../hooks/useLocalDetection';
import { useAdvancedDetection } from '../hooks/useAdvancedDetection';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { CATEGORIES, UNITS, MS_PER_DAY } from '../utils/constants';
import { Html5Qrcode } from 'html5-qrcode';
import './ScanView.css';

// Scan intervals in ms — local TF.js is fast; cloud needs more time
const SCAN_INTERVAL_LOCAL = 3000;
const SCAN_INTERVAL_ADVANCED = 6000;
const SCAN_INTERVAL_CLOUD = 5000;

export default function ScanView() {
  const [activeTab, setActiveTab] = useState('webcam');
  const [detectedItems, setDetectedItems] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  // Continuous scanning state
  const [continuousScan, setContinuousScan] = useState(true);
  const [scanPaused, setScanPaused] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [webcamError, setWebcamError] = useState(null);
  // Detection mode: 'local' (offline TF.js) or 'cloud' (Gemini API / demo)
  const [detectionMode, setDetectionMode] = useState(() =>
    localStorage.getItem('smartfridge_detection_mode') || 'local'
  );

  // Barcode scanner state
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const barcodeReaderRef = useRef(null);
  const barcodeContainerRef = useRef(null);

  // Manual form state
  const [manualForm, setManualForm] = useState({
    name: '', category: 'other', quantity: 1, unit: 'pieces', expiryDate: '',
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const receiptInputRef = useRef(null);
  const canvasRef = useRef(null);
  const captureRetryRef = useRef(0);
  const scanIntervalRef = useRef(null);
  const isScanningRef = useRef(false); // guard against overlapping scans

  const { addItem, addItems } = useInventory();
  const {
    detectFood,
    parseReceipt,
    detecting: geminiDetecting,
    parsingReceipt,
    error: geminiError,
    retryStatus: geminiRetryStatus,
    clearError: clearGeminiError,
  } = useGemini();
  const {
    detectFromImage: localDetect,
    detecting: localDetecting,
    modelLoading,
    error: localError,
    clearError: clearLocalError,
    isModelLoaded,
  } = useLocalDetection();
  const {
    detectFromImage: advancedDetect,
    detecting: advancedDetecting,
    modelLoading: advancedModelLoading,
    loadProgress: advancedLoadProgress,
    error: advancedError,
    clearError: clearAdvancedError,
    isModelLoaded: isAdvancedModelLoaded,
  } = useAdvancedDetection();
  const {
    product: barcodeProduct,
    loading: barcodeLoading,
    error: barcodeError,
    lookupBarcode,
    clearProduct,
  } = useBarcodeScanner();

  const detecting = detectionMode === 'local' ? localDetecting
    : detectionMode === 'advanced' ? advancedDetecting
    : geminiDetecting;
  const error = detectionMode === 'local' ? localError
    : detectionMode === 'advanced' ? advancedError
    : geminiError;
  const clearError = detectionMode === 'local' ? clearLocalError
    : detectionMode === 'advanced' ? clearAdvancedError
    : clearGeminiError;

  // Persist detection mode
  useEffect(() => {
    localStorage.setItem('smartfridge_detection_mode', detectionMode);
  }, [detectionMode]);

  // Cleanup webcam + continuous scan on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      stopBarcodeScanner();
    };
  }, []);

  // Stop barcode scanner when switching tabs
  useEffect(() => {
    if (activeTab !== 'barcode') {
      stopBarcodeScanner();
    }
  }, [activeTab]);

  const startWebcam = async (facing) => {
    const mode = facing || facingMode;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: mode }
      });
      streamRef.current = stream;
      setCapturedImage(null);
      setWebcamActive(true);
      setWebcamError(null);
      setScanCount(0);
      setLastScanTime(null);
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
    // Stop continuous scanning
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    stopWebcam();
    await new Promise(r => setTimeout(r, 200));
    startWebcam(newMode);
  };

  // Grab a frame from the video without stopping the camera
  const grabFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 100) return null;
    return dataUrl;
  }, []);

  // Merge newly detected items into existing list (no duplicates by name)
  const mergeDetectedItems = useCallback((existing, newItems) => {
    const merged = [...existing];
    for (const item of newItems) {
      const existingIdx = merged.findIndex(
        e => e.name.toLowerCase() === item.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        // Update confidence if the new detection is higher
        if (item.confidence && (!merged[existingIdx].confidence || item.confidence > merged[existingIdx].confidence)) {
          merged[existingIdx] = { ...merged[existingIdx], confidence: item.confidence };
        }
      } else {
        merged.push(item);
      }
    }
    return merged;
  }, []);

  // Run one cycle of continuous detection
  const runContinuousScan = useCallback(async () => {
    if (isScanningRef.current) return; // skip if previous scan still running
    isScanningRef.current = true;

    try {
      const frame = grabFrame();
      if (!frame) return;

      let results;
      if (detectionMode === 'local') {
        results = await localDetect(frame);
      } else if (detectionMode === 'advanced') {
        results = await advancedDetect(frame);
      } else {
        results = await detectFood(frame);
      }

      if (results && results.length > 0) {
        const items = results.map(r => ({
          name: r.name,
          category: r.category || 'other',
          quantity: r.quantity || 1,
          unit: r.suggestedUnit || 'pieces',
          expiryDate: new Date(Date.now() + (r.estimatedShelfLifeDays || 7) * MS_PER_DAY).toISOString().split('T')[0],
          shelfLife: r.estimatedShelfLifeDays || 7,
          confidence: r.confidence ? Math.round(r.confidence * 100) : (r.confidence === undefined ? null : r.confidence),
        }));
        setDetectedItems(prev => mergeDetectedItems(prev, items));
      }

      setScanCount(c => c + 1);
      setLastScanTime(new Date());
    } finally {
      isScanningRef.current = false;
    }
  }, [grabFrame, mergeDetectedItems, detectionMode, localDetect, advancedDetect, detectFood]);

  // Start / stop the continuous scan interval when webcam and toggle state change
  useEffect(() => {
    if (webcamActive && continuousScan && !scanPaused && activeTab === 'webcam') {
      // Clear any existing interval
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

      const interval = detectionMode === 'local' ? SCAN_INTERVAL_LOCAL
        : detectionMode === 'advanced' ? SCAN_INTERVAL_ADVANCED
        : SCAN_INTERVAL_CLOUD;

      // Fire one scan immediately after a short delay for camera warmup
      const warmupTimer = setTimeout(() => {
        runContinuousScan();
      }, 1500);

      scanIntervalRef.current = setInterval(runContinuousScan, interval);

      return () => {
        clearTimeout(warmupTimer);
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
      };
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    }
  }, [webcamActive, continuousScan, scanPaused, activeTab, detectionMode, runContinuousScan]);

  // Legacy single-capture (kept as fallback when continuous mode is off)
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

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

  const handleReceiptUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      setWebcamError('Image is too large (max 10 MB). Please choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target.result);
      handleReceiptParse(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (activeTab === 'receipt') {
      handleReceiptUpload(file);
    } else {
      handleFileUpload(file);
    }
  };

  const handleDetect = async (imageData) => {
    setDetectedItems([]);
    setSuccessMsg('');
    setWebcamError(null);

    let results;
    if (detectionMode === 'local') {
      results = await localDetect(imageData);
    } else if (detectionMode === 'advanced') {
      results = await advancedDetect(imageData);
    } else {
      results = await detectFood(imageData);
    }

    if (results && results.length > 0) {
      const items = results.map(r => ({
        name: r.name,
        category: r.category || 'other',
        quantity: r.quantity || 1,
        unit: r.suggestedUnit || 'pieces',
        expiryDate: new Date(Date.now() + (r.estimatedShelfLifeDays || 7) * MS_PER_DAY).toISOString().split('T')[0],
        shelfLife: r.estimatedShelfLifeDays || 7,
        confidence: r.confidence ? Math.round(r.confidence * 100) : (r.confidence === undefined ? null : r.confidence),
      }));
      setDetectedItems(items);
    }
  };

  const handleReceiptParse = async (imageData) => {
    setDetectedItems([]);
    setSuccessMsg('');
    setWebcamError(null);

    const results = await parseReceipt(imageData);

    if (results && results.length > 0) {
      const items = results.map(r => ({
        name: r.name,
        category: r.category || 'other',
        quantity: r.quantity || 1,
        unit: r.unit || 'pieces',
        expiryDate: new Date(Date.now() + (r.estimatedShelfLifeDays || 7) * MS_PER_DAY).toISOString().split('T')[0],
        shelfLife: r.estimatedShelfLifeDays || 7,
        price: r.price || null,
      }));
      setDetectedItems(items);
    }
  };

  // ── Barcode Scanner ─────────────────────────────────────────────────

  const startBarcodeScanner = async () => {
    try {
      setWebcamError(null);
      setBarcodeScanning(true);

      // Wait for React to render the #barcode-reader div
      await new Promise(r => setTimeout(r, 50));

      const readerId = 'barcode-reader';
      const scanner = new Html5Qrcode(readerId);
      barcodeReaderRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.5,
      };

      const onScan = async (decodedText) => {
        if (barcodeReaderRef.current) {
          try { await barcodeReaderRef.current.stop(); } catch(e){}
        }
        setBarcodeScanning(false);
        lookupBarcode(decodedText);
      };

      try {
        await scanner.start({ facingMode: 'environment' }, config, onScan, () => {});
      } catch (err) {
        console.warn('Environment camera failed, trying user camera...', err);
        await scanner.start({ facingMode: 'user' }, config, onScan, () => {});
      }
    } catch (err) {
      console.error('Barcode scanner error:', err);
      setBarcodeScanning(false);
      setWebcamError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied for barcode scanner.'
          : `Barcode scanner error: ${err?.message || err}`
      );
    }
  };

  const stopBarcodeScanner = async () => {
    if (barcodeReaderRef.current) {
      try {
        await barcodeReaderRef.current.stop();
        await barcodeReaderRef.current.clear();
      } catch (e) {
        // Ignore errors during cleanup
      }
      barcodeReaderRef.current = null;
    }
    setBarcodeScanning(false);
  };

  const addBarcodeProduct = async () => {
    if (!barcodeProduct) return;
    await addItem({
      name: barcodeProduct.brand
        ? `${barcodeProduct.name} (${barcodeProduct.brand})`
        : barcodeProduct.name,
      category: barcodeProduct.category,
      quantity: barcodeProduct.quantity,
      unit: barcodeProduct.unit,
      expiryDate: new Date(Date.now() + 7 * MS_PER_DAY).toISOString().split('T')[0],
      imageUrl: barcodeProduct.imageUrl || '',
    });
    setSuccessMsg(`${barcodeProduct.name} added to your fridge!`);
    clearProduct();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // ── Common handlers ─────────────────────────────────────────────────

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
    const toAdd = detectedItems.map(({ shelfLife, confidence, price, ...rest }) => rest);
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

  const isProcessing = detecting || parsingReceipt || modelLoading || advancedModelLoading;

  return (
    <div className="scan-view">
      <h1>Scan & Add Food</h1>
      <p>Detect food items using AI, scan barcodes, receipts, or add manually</p>

      {/* Detection Mode Selector */}
      {(activeTab === 'webcam' || activeTab === 'upload') && (
        <div className="detection-mode-bar">
          <span className="detection-mode-label">Detection Engine:</span>
          <button
            className={`detection-mode-btn ${detectionMode === 'local' ? 'active' : ''}`}
            onClick={() => { setDetectionMode('local'); clearError(); }}
            title="Fast, lightweight — detects ~14 food types"
          >
            🧠 Basic (TF.js)
          </button>
          <button
            className={`detection-mode-btn ${detectionMode === 'advanced' ? 'active' : ''}`}
            onClick={() => { setDetectionMode('advanced'); clearError(); }}
            title="CLIP AI — identifies 150+ food items offline"
          >
            🔬 Advanced (CLIP)
          </button>
          <button
            className={`detection-mode-btn ${detectionMode === 'cloud' ? 'active' : ''}`}
            onClick={() => { setDetectionMode('cloud'); clearError(); }}
            title="Most accurate — requires API key & internet"
          >
            ☁️ Cloud (Gemini)
          </button>
          {detectionMode === 'local' && (
            <span className="detection-mode-status">
              {modelLoading ? '⏳ Loading model...' : isModelLoaded ? '✅ Model ready' : '📦 Model will load on first scan'}
            </span>
          )}
          {detectionMode === 'advanced' && (
            <span className="detection-mode-status">
              {advancedModelLoading
                ? `⏳ Downloading model... ${advancedLoadProgress}%`
                : isAdvancedModelLoaded
                  ? '✅ CLIP ready (150+ items)'
                  : '📦 ~150 MB download on first use (cached after)'}
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
          📁 Upload
        </button>
        <button className={`scan-tab ${activeTab === 'receipt' ? 'active' : ''}`} onClick={() => { setActiveTab('receipt'); stopWebcam(); clearError(); }}>
          🧾 Receipt
        </button>
        <button className={`scan-tab ${activeTab === 'barcode' ? 'active' : ''}`} onClick={() => { setActiveTab('barcode'); stopWebcam(); clearError(); }}>
          📊 Barcode
        </button>
        <button className={`scan-tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => { setActiveTab('manual'); stopWebcam(); clearError(); }}>
          ✏️ Manual
        </button>
      </div>

      {error && (
        <div className="scan-error">⚠️ {error}</div>
      )}

      {webcamError && (
        <div className="scan-error">📷 {webcamError}</div>
      )}

      {barcodeError && (
        <div className="scan-error">📊 {barcodeError}</div>
      )}

      {successMsg && (
        <div className="scan-success">✅ {successMsg}</div>
      )}

      <div className="scan-content">
        {/* Left: Input Area */}
        <div>
          {activeTab === 'webcam' && (
            <div className="webcam-section glass-panel">
              <div className={`webcam-preview ${webcamActive && continuousScan && !scanPaused ? 'continuous-active' : ''}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ display: webcamActive && !capturedImage ? 'block' : 'none' }}
                />
                {webcamActive && !capturedImage && continuousScan && !scanPaused && (
                  <div className="webcam-scanning-ring continuous" />
                )}
                {webcamActive && !capturedImage && detecting && (
                  <div className="webcam-scan-flash" />
                )}
                {webcamActive && !capturedImage && continuousScan && !scanPaused && (
                  <div className="webcam-live-badge">
                    <span className="live-dot" />
                    LIVE TRACKING
                  </div>
                )}
                {webcamActive && !capturedImage && scanCount > 0 && (
                  <div className="webcam-scan-counter">
                    🔍 {scanCount} scan{scanCount !== 1 ? 's' : ''}
                    {lastScanTime && (
                      <span className="scan-time"> · {lastScanTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    )}
                  </div>
                )}
                {capturedImage && (
                  <img src={capturedImage} alt="Captured" />
                )}
                {!webcamActive && !capturedImage && (
                  <div className="webcam-preview-placeholder">
                    <span>📷</span>
                    <span>Click Start Camera to begin live tracking</span>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Continuous scan toggle */}
              {webcamActive && (
                <div className="continuous-scan-bar">
                  <label className="continuous-toggle">
                    <input
                      type="checkbox"
                      checked={continuousScan}
                      onChange={(e) => { setContinuousScan(e.target.checked); setScanPaused(false); }}
                    />
                    <span className="toggle-slider" />
                    <span className="toggle-label">Continuous Tracking</span>
                  </label>
                  {continuousScan && (
                    <button
                      className={`btn btn-sm ${scanPaused ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setScanPaused(p => !p)}
                    >
                      {scanPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                  )}
                  <span className="scan-interval-hint">
                    {continuousScan
                      ? `Scanning every ${detectionMode === 'local' ? '3' : detectionMode === 'advanced' ? '6' : '5'}s`
                      : 'Manual capture mode'}
                  </span>
                </div>
              )}

              <div className="webcam-controls">
                {!webcamActive && !capturedImage && (
                  <button className="btn btn-primary" onClick={startWebcam}>
                    🎥 Start Camera
                  </button>
                )}
                {webcamActive && (
                  <>
                    {!continuousScan && (
                      <button className="btn btn-primary" onClick={captureFrame} disabled={detecting}>
                        📸 Capture & Scan
                      </button>
                    )}
                    {continuousScan && (
                      <button className="btn btn-primary" onClick={() => { setDetectedItems([]); setScanCount(0); }}>
                        🗑️ Clear Results
                      </button>
                    )}
                    <button className="btn btn-ghost btn-switch-camera" onClick={switchCamera} title="Switch Camera">
                      🔄 Flip
                    </button>
                    <button className="btn btn-ghost" onClick={stopWebcam}>
                      ⏹ Stop
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

          {/* Receipt Tab */}
          {activeTab === 'receipt' && (
            <div>
              {!capturedImage ? (
                <div
                  className={`upload-zone glass-panel ${dragOver ? 'drag-over' : ''}`}
                  onClick={() => receiptInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="upload-zone-icon">🧾</div>
                  <div className="upload-zone-text">
                    Upload a grocery receipt photo
                  </div>
                  <div className="upload-zone-hint">
                    AI will parse all items, quantities, and prices automatically
                  </div>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleReceiptUpload(e.target.files[0])}
                  />
                </div>
              ) : (
                <div>
                  <div className="upload-preview glass-panel">
                    <img src={capturedImage} alt="Receipt" />
                  </div>
                  {!parsingReceipt && (
                    <button className="btn btn-ghost" onClick={() => { setCapturedImage(null); setDetectedItems([]); }}>
                      🔄 Upload Different Receipt
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Barcode Tab */}
          {activeTab === 'barcode' && (
            <div className="barcode-section glass-panel">
              <div className="barcode-scanner-area">
                {!barcodeScanning && !barcodeProduct && (
                  <div className="webcam-preview-placeholder">
                    <span>📊</span>
                    <span>Click Start Scanner to scan a barcode</span>
                  </div>
                )}
                <div id="barcode-reader" style={{ width: '100%', display: barcodeScanning ? 'block' : 'none' }}></div>
              </div>

              <div className="webcam-controls">
                {!barcodeScanning && !barcodeProduct && (
                  <button className="btn btn-primary" onClick={startBarcodeScanner}>
                    📊 Start Scanner
                  </button>
                )}
                {barcodeScanning && (
                  <button className="btn btn-ghost" onClick={stopBarcodeScanner}>
                    Stop Scanner
                  </button>
                )}
              </div>

              {/* Barcode Product Result */}
              {barcodeLoading && (
                <div className="barcode-loading">
                  <div className="detecting-spinner" />
                  <span>Looking up product...</span>
                </div>
              )}

              {barcodeProduct && (
                <div className="barcode-product-card">
                  <div className="barcode-product-header">
                    {barcodeProduct.imageUrl && (
                      <img
                        src={barcodeProduct.imageUrl}
                        alt={barcodeProduct.name}
                        className="barcode-product-image"
                      />
                    )}
                    <div className="barcode-product-info">
                      <div className="barcode-product-name">{barcodeProduct.name}</div>
                      {barcodeProduct.brand && (
                        <div className="barcode-product-brand">{barcodeProduct.brand}</div>
                      )}
                      <div className="barcode-product-meta">
                        <span className="badge badge-category">{barcodeProduct.category}</span>
                        <span>{barcodeProduct.quantity} {barcodeProduct.unit}</span>
                        {barcodeProduct.nutriScore && (
                          <span className={`nutri-score nutri-score-${barcodeProduct.nutriScore}`}>
                            Nutri-Score {barcodeProduct.nutriScore.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nutrition info */}
                  {barcodeProduct.nutrition.calories && (
                    <div className="barcode-nutrition">
                      <div className="barcode-nutrition-title">Nutrition (per 100g)</div>
                      <div className="barcode-nutrition-grid">
                        {barcodeProduct.nutrition.calories && (
                          <div className="barcode-nutrition-item">
                            <span className="barcode-nutrition-value">{Math.round(barcodeProduct.nutrition.calories)}</span>
                            <span className="barcode-nutrition-label">kcal</span>
                          </div>
                        )}
                        {barcodeProduct.nutrition.protein != null && (
                          <div className="barcode-nutrition-item">
                            <span className="barcode-nutrition-value">{barcodeProduct.nutrition.protein}g</span>
                            <span className="barcode-nutrition-label">Protein</span>
                          </div>
                        )}
                        {barcodeProduct.nutrition.carbs != null && (
                          <div className="barcode-nutrition-item">
                            <span className="barcode-nutrition-value">{barcodeProduct.nutrition.carbs}g</span>
                            <span className="barcode-nutrition-label">Carbs</span>
                          </div>
                        )}
                        {barcodeProduct.nutrition.fat != null && (
                          <div className="barcode-nutrition-item">
                            <span className="barcode-nutrition-value">{barcodeProduct.nutrition.fat}g</span>
                            <span className="barcode-nutrition-label">Fat</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="barcode-product-actions">
                    <button className="btn btn-primary" onClick={addBarcodeProduct}>
                      ✅ Add to Fridge
                    </button>
                    <button className="btn btn-ghost" onClick={() => { clearProduct(); startBarcodeScanner(); }}>
                      🔄 Scan Another
                    </button>
                  </div>
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

        {/* Right: Detected Items (not shown for barcode/manual tabs) */}
        {activeTab !== 'barcode' && (
          <div className="detected-section glass-panel">
            {/* Show full spinner overlay ONLY for one-shot operations (model load, receipt parse, single capture).
                During continuous webcam scanning, items stay visible with a small inline indicator. */}
            {isProcessing && !(webcamActive && continuousScan && detectedItems.length > 0) ? (
            <div className="detecting-overlay">
                <div className="detecting-spinner" />
                <div className="detecting-text">
                  {modelLoading
                    ? 'Loading AI model (~5MB)...'
                    : advancedModelLoading
                      ? `Loading CLIP model... ${advancedLoadProgress}%`
                      : parsingReceipt
                        ? 'Parsing receipt items...'
                        : (detectionMode === 'cloud' && geminiRetryStatus)
                          ? geminiRetryStatus
                          : 'Analyzing image with AI...'}
                </div>
                <div className="detecting-text text-muted" style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                  {modelLoading
                    ? 'First load only — cached for next time'
                    : advancedModelLoading
                      ? 'First download only — cached in browser after'
                      : parsingReceipt
                        ? 'Extracting items, quantities, and prices'
                        : (detectionMode === 'cloud' && geminiRetryStatus)
                          ? 'Auto-switching models to avoid rate limits'
                          : detectionMode === 'local'
                            ? 'Running TensorFlow.js locally'
                            : detectionMode === 'advanced'
                              ? 'Running CLIP classification'
                              : 'Identifying food items'}
                </div>
              </div>
            ) : detectedItems.length > 0 ? (
              <>
                <h3>
                  🔍 Detected Items ({detectedItems.length})
                  {webcamActive && continuousScan && detecting && (
                    <span className="inline-scanning-badge">
                      <span className="detecting-spinner" style={{ width: 14, height: 14 }} />
                      scanning…
                    </span>
                  )}
                </h3>
                <div className="detected-list">
                  {detectedItems.map((item, i) => (
                    <div key={i} className="detected-item">
                      <div className="detected-item-info">
                        <div className="detected-item-name">
                          {item.name}
                          {item.confidence && (
                            <span className="confidence-badge">{item.confidence}%</span>
                          )}
                          {item.price != null && item.price > 0 && (
                            <span className="price-badge">₹{item.price}</span>
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
                    : activeTab === 'receipt'
                      ? 'Upload a receipt image to extract all items at once'
                      : 'Capture or upload an image to detect food items'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
