# OmniFridge (viraj-smartfridge)

OmniFridge is a cutting-edge, AI-powered smart fridge management application built to help users seamlessly track their groceries, manage expiration dates, minimize food waste, and generate recipes based on available ingredients. The application leverages a combination of entirely offline machine learning models and advanced cloud-based LLMs to provide a comprehensive and responsive user experience.

## 🚀 Tech Stack

- **Frontend Framework:** React 19
- **Build Tool:** Vite
- **Styling:** Custom CSS (Modular component-level styling)
- **Local Database:** Dexie.js (A robust wrapper for IndexedDB to handle offline, persistent storage)
- **Barcode Scanning:** `html5-qrcode`

## 🧠 AI & Machine Learning Integrations

OmniFridge features a robust, multi-tier AI scanning and detection system (found in `ScanView.jsx`), allowing users to choose between speed, privacy, and deep analysis.

### 1. Local AI Detection (Basic)
- **Technology:** TensorFlow.js (`@tensorflow/tfjs`) + COCO-SSD (`@tensorflow-models/coco-ssd`)
- **Implementation:** `useLocalDetection.js`
- **Model:** `mobilenet_v2` base model
- **Details:** Runs completely offline in the browser. It provides incredibly fast, privacy-preserving bounding-box detection for common food items and kitchenware. It is highly optimized for devices without active internet connections but is limited to a core vocabulary of items.

### 2. Advanced Local AI Detection (Zero-Shot)
- **Technology:** Transformers.js (`@huggingface/transformers`)
- **Implementation:** `useAdvancedDetection.js`
- **Model:** CLIP (`Xenova/clip-vit-base-patch32`)
- **Details:** Also runs entirely offline after an initial model download (~150MB). It uses zero-shot image classification to detect over 150+ specific food items, fruits, vegetables, and condiments. It includes anti-hallucination filtering by comparing food confidence scores against non-food "absorber" labels (e.g., "a person", "a wall") to ensure high accuracy.

### 3. Cloud AI Analysis & Receipt Parsing
- **Technology:** Google Generative AI SDK (`@google/generative-ai`)
- **Implementation:** `useGemini.js` & `prompts.js`
- **Model:** Gemini 1.5 Flash / Gemini 1.5 Pro
- **Details:** Requires an internet connection and is used for complex tasks. It can deeply analyze the state of food (e.g., "browning bananas"), read and parse complex grocery receipts, and power the smart recipe generation engine by intelligently understanding flavor profiles and ingredient combinations.

## 📂 Project Structure & Features

The application is heavily component-driven, with features mapped to specific views:

### Components (`src/components/`)
- **`DashboardView`:** The landing page providing a quick overview of fridge health, items expiring soon, and total inventory counts.
- **`ScanView`:** The core interface for adding items. It interfaces with the device camera to support Barcode Scanning, Local AI object detection, Advanced CLIP classification, and Cloud-based receipt/image analysis.
- **`InventoryView`:** A detailed list and grid view of all currently stored items, sortable by category and expiration date.
- **`RecipesView`:** Connects with Gemini to suggest meals specifically tailored to the ingredients currently in the user's local database.
- **`ShoppingListView`:** A tracker for depleted items or manual additions for the next grocery run.
- **`VoiceAssistant`:** Allows hands-free interaction with the application, parsing user speech to add items or ask questions about the fridge contents.
- **`SettingsView`:** Controls application preferences, AI model selection, and API key management.

### Hooks (`src/hooks/`)
Contains the isolated logic for hardware and AI interactions:
- `useAdvancedDetection.js`: Manages Transformers.js CLIP model lifecycle.
- `useLocalDetection.js`: Manages TensorFlow.js COCO-SSD model lifecycle.
- `useGemini.js`: Handles Google Generative AI API calls, rate limiting, and fallback logic.
- `useBarcodeScanner.js`: Interfaces with `html5-qrcode` to parse standard retail barcodes.
- `useExpiryChecker.js`: Background logic to calculate days remaining and flag expired items.

### Utilities & Database (`src/utils/` & `src/db.js`)
- **`db.js`:** The Dexie configuration defining the schemas for `inventory`, `shoppingList`, and `recipes`.
- **`prompts.js`:** Structured system prompts sent to Gemini for image analysis, receipt parsing, and recipe generation.
- **`expiry.js`:** Helper functions to standardize shelf-life calculations based on food categories.

## 🛠️ Setup & Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

*(Note: Ensure you configure your Gemini API key in the application settings to unlock Cloud features and Recipe generation).*
