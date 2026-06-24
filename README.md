# 🧊 OmniFridge AI — Project Report

> **An AI-powered smart fridge management system that uses computer vision, natural language processing, and voice interaction to track groceries, prevent food waste, and suggest recipes.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [AI / Machine Learning Models — In Depth](#4-ai--machine-learning-models--in-depth)
5. [Application Features — Detailed Breakdown](#5-application-features--detailed-breakdown)
6. [Database Design](#6-database-design)
7. [State Management](#7-state-management)
8. [Prompt Engineering](#8-prompt-engineering)
9. [File-by-File Reference](#9-file-by-file-reference)
10. [Setup & Installation](#10-setup--installation)

---

## 1. Project Overview

OmniFridge (internally `viraj-smartfridge`) is a single-page web application that transforms a standard browser into an intelligent food inventory management system. It combines **three tiers of AI detection** — from fully offline models to cloud-based LLMs — with a local-first database, voice interaction, barcode scanning, receipt parsing, and AI recipe generation. Every piece of data stays in the user's browser via IndexedDB; no backend server is required.

### Core Problems Solved

| Problem | Solution |
|---|---|
| Forgetting what's in the fridge | Camera-based AI scanning automatically identifies food items |
| Food expiring unnoticed | Real-time expiry tracking with browser notifications and toast alerts |
| Not knowing what to cook | AI recipe suggestions generated from current fridge contents |
| Manual data entry is tedious | Barcode scanning, receipt parsing, and voice commands remove manual work |
| Privacy concerns with cloud AI | Two fully offline detection modes run entirely in the browser |

---

## 2. Technology Stack

### 2.1 Core Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.2.6 | UI framework — functional components with hooks |
| **Vite** | 8.0.12 | Build tool and dev server (HMR, ES module bundling) |
| **Vanilla CSS** | — | Component-scoped stylesheets (no Tailwind, no CSS-in-JS) |

React 19's `StrictMode` is enabled in `main.jsx`, wrapping the entire app to catch side-effect bugs during development. The app uses **no router library** — navigation is handled via a simple `activeView` string state in `AppContent.jsx` and rendered via a `switch` statement.

### 2.2 AI & Machine Learning

| Library | Version | Model | Purpose |
|---|---|---|---|
| **TensorFlow.js** | ^4.22.0 | COCO-SSD (MobileNet V2) | Fast offline object detection |
| **Transformers.js** | ^4.2.0 | CLIP ViT-B/32 | Advanced offline zero-shot classification |
| **Google Generative AI SDK** | ^0.24.1 | Gemini 2.5 Flash/Pro | Cloud-based food analysis, receipt OCR, recipes, voice NLU |

### 2.3 Data & Storage

| Library | Version | Purpose |
|---|---|---|
| **Dexie.js** | ^4.4.2 | Promise-based wrapper around IndexedDB for persistent, offline-capable storage |

### 2.4 Hardware Interfaces

| Library / API | Purpose |
|---|---|
| **html5-qrcode** (^2.3.8) | Barcode scanning from camera or uploaded images |
| **Web Speech API** (browser-native) | Speech-to-text for voice commands |
| **MediaDevices API** (browser-native) | Webcam access with front/rear camera switching |
| **Notifications API** (browser-native) | Browser push notifications for expiry alerts |

### 2.5 External APIs

| API | Purpose |
|---|---|
| **Open Food Facts** (`world.openfoodfacts.org/api/v2`) | Product lookup by barcode — returns name, brand, category, nutrition, Nutri-Score |
| **Google AI Studio** (Gemini) | Cloud AI for image analysis, receipt parsing, recipe generation, voice NLU |

### 2.6 Dev Tooling

| Tool | Purpose |
|---|---|
| ESLint 10 + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` | Code linting |
| `@vitejs/plugin-react` 6.0.1 | Vite plugin for React JSX/fast-refresh |
| `@types/react` + `@types/react-dom` | TypeScript type definitions (for IDE intellisense even in JS) |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│  ┌──────────┐   ┌───────────────────────────────────────┐   │
│  │          │   │           React Application             │   │
│  │ IndexedDB│◄──│                                         │   │
│  │ (Dexie)  │   │  ┌─────────────────────────────────┐   │   │
│  │          │   │  │     InventoryContext (Provider)   │   │   │
│  │ Tables:  │   │  │  ┌──────┐ ┌───────┐ ┌─────────┐│   │   │
│  │ foodItems│   │  │  │items │ │shopping│ │computed ││   │   │
│  │ shopping │   │  │  │state │ │  list  │ │ helpers ││   │   │
│  │  List    │   │  │  └──────┘ └───────┘ └─────────┘│   │   │
│  └──────────┘   │  └────────────────┬────────────────┘   │   │
│                 │                   │ useInventory()       │   │
│                 │   ┌───────────────┼───────────────┐     │   │
│                 │   │               │               │     │   │
│  ┌──────────┐   │ ┌─▼──┐ ┌────┐ ┌──▼───┐ ┌──────┐ │     │   │
│  │ Webcam / │   │ │Scan│ │Inv │ │Dash  │ │Recipe│ │     │   │
│  │ Camera   │──▶│ │View│ │View│ │board │ │View  │ │...  │   │
│  └──────────┘   │ └──┬─┘ └────┘ └──────┘ └──┬───┘ │     │   │
│                 │    │                       │     │     │   │
│                 │    ▼                       ▼     │     │   │
│  ┌──────────────┼─────────────────────────────────┐│     │   │
│  │              AI Detection Hooks                ││     │   │
│  │  ┌──────────────┐ ┌─────────────┐ ┌──────────┐││     │   │
│  │  │useLocal      │ │useAdvanced  │ │useGemini │││     │   │
│  │  │Detection     │ │Detection    │ │          │││     │   │
│  │  │(COCO-SSD)    │ │(CLIP)       │ │(Cloud)   │││     │   │
│  │  └──────────────┘ └─────────────┘ └──────────┘││     │   │
│  └────────────────────────────────────────────────┘│     │   │
│                 └───────────────────────────────────┘     │   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: Scanning an Image

1. **User captures** an image via webcam, file upload, or drag-and-drop
2. Image is converted to a base64 data URL on a hidden `<canvas>`
3. Based on `detectionMode`, one of three hooks is invoked:
   - **Local**: `useLocalDetection.detectFromImage()` → TensorFlow.js COCO-SSD inference
   - **Advanced**: `useAdvancedDetection.detectFromImage()` → Transformers.js CLIP zero-shot classification
   - **Cloud**: `useGemini.detectFood()` → Gemini API multimodal prompt with inline image
4. Each hook returns a normalized array of `{ name, category, estimatedShelfLifeDays, suggestedUnit, confidence }` objects
5. Results are displayed as editable cards in ScanView
6. User reviews/edits detected items (quantity, expiry date, category), then confirms
7. Confirmed items are persisted to IndexedDB via `InventoryContext.addItems()`
8. Dashboard and InventoryView auto-update via React state propagation

---

## 4. AI / Machine Learning Models — In Depth

### 4.1 Tier 1: COCO-SSD with MobileNet V2 (Offline, Fast)

**File:** `src/hooks/useLocalDetection.js`

| Attribute | Detail |
|---|---|
| **Framework** | TensorFlow.js (`@tensorflow/tfjs` + `@tensorflow-models/coco-ssd`) |
| **Base Model** | `mobilenet_v2` (~5 MB larger than `lite_mobilenet_v2`, but dramatically fewer false negatives) |
| **Detection Type** | Single Shot MultiBox Detector (SSD) — outputs bounding boxes + class labels |
| **Inference Location** | 100% in-browser via WebGL backend (no network calls) |
| **Max Detections** | 30 per frame |
| **Confidence Threshold** | 0.4 (balances recall vs. precision) |

**How COCO-SSD Works:**
COCO-SSD is a pre-trained object detection model trained on the COCO (Common Objects in Context) dataset containing 80 object categories. SSD (Single Shot MultiBox Detector) processes the entire image in a single forward pass, making it extremely fast. The MobileNet V2 backbone is a lightweight CNN architecture optimized for mobile/edge devices using depthwise separable convolutions.

**Food Label Mapping:**
COCO only has ~12 food-related classes out of 80 total. The hook maps these to structured food data:

```
banana → { category: 'fruit', shelfLife: 5 days, unit: 'pieces' }
apple  → { category: 'fruit', shelfLife: 14 days, unit: 'pieces' }
pizza  → { category: 'grain', shelfLife: 3 days, unit: 'slices' }
bottle → { category: 'beverage', shelfLife: 30 days, unit: 'bottles' }
...
```

**Deduplication Logic:** If COCO detects the same label multiple times (e.g., three banana bounding boxes), only the highest-confidence prediction is kept via a `Map` keyed by label.

**Noise Filtering:** Utensils and furniture detected by COCO (`spoon`, `knife`, `fork`, `dining table`) are excluded via an `IGNORE_LABELS` set.

---

### 4.2 Tier 2: CLIP ViT-B/32 Zero-Shot Classification (Offline, Deep)

**File:** `src/hooks/useAdvancedDetection.js`

| Attribute | Detail |
|---|---|
| **Framework** | Hugging Face Transformers.js (`@huggingface/transformers`) |
| **Model** | `Xenova/clip-vit-base-patch32` (ONNX-quantized version of OpenAI's CLIP) |
| **Model Size** | ~150 MB (downloaded once, cached in browser storage) |
| **Detection Type** | Zero-shot image classification — no fine-tuning needed |
| **Vocabulary** | 150+ food items across 13 categories |
| **Inference Location** | 100% in-browser via ONNX Runtime (WebAssembly / WebGL) |

**How CLIP Works:**
CLIP (Contrastive Language-Image Pretraining) by OpenAI is a dual-encoder model that learns a shared embedding space for images and text. Given an image and a list of text labels, CLIP computes cosine similarity between the image embedding and each text embedding, producing a probability distribution over all candidate labels via softmax. This allows **zero-shot classification** — the model can classify images into categories it was never explicitly trained on, as long as the categories are described in natural language.

**Why CLIP is Superior to COCO-SSD for Food:**
COCO-SSD can only detect the 80 classes it was trained on. CLIP can match against **any text description**, so the vocabulary is expanded to 150+ entries including:
- 21 fruits (apple, banana, mango, guava, pomegranate…)
- 26 vegetables (tomato, potato, asparagus, beetroot…)
- 12 dairy items (milk carton, paneer, ice cream tub…)
- 9 meats, 4 seafood, 12 grains/bakery, 9 beverages
- 14 condiments, 12 snacks, 15 prepared foods, 6 canned goods, 4 frozen items, 5 herbs

**Anti-Hallucination System:**
CLIP's softmax forces 100% probability distribution across all labels. If someone scans a shoe, CLIP would still assign some food label the highest score. To prevent this, the system uses **non-food absorber labels**:

```javascript
const NON_FOOD_LABELS = [
  'an empty table or countertop',
  'a room with no food visible',
  'a person standing or sitting',
  'furniture in a room',
  'an electronic device or computer screen',
  // ... 10 total
];
```

These labels compete in the softmax. If a non-food label wins, the image is classified as containing no food.

**Multi-Layer Filtering Pipeline:**
1. **Non-food dominance check:** If `bestNonFoodScore > topFoodScore`, return empty results
2. **Dynamic threshold:** Food items must exceed `max(bestNonFoodScore, 0.20, topFoodScore × 0.35)`
3. **Score-gap analysis:** If consecutive food scores drop by more than 2.5× ratio, everything below the gap is treated as noise
4. **Hard cap:** Maximum 5 items returned per scan

---

### 4.3 Tier 3: Google Gemini (Cloud, Multimodal)

**File:** `src/hooks/useGemini.js`

| Attribute | Detail |
|---|---|
| **SDK** | `@google/generative-ai` |
| **Primary Model** | `gemini-2.5-flash` |
| **Fallback Models** | `gemini-2.5-flash-lite` → `gemini-2.5-pro` |
| **Capabilities** | Multimodal (image + text), structured JSON output, long-context |
| **Use Cases** | Food identification, receipt OCR, recipe generation, voice NLU |

**Smart Fallback & Rate Limit Handling:**
The `callWithFallback()` function implements a two-phase retry strategy:

- **Phase 1:** Try each model in order (`flash` → `flash-lite` → `pro`), with a 2-second cooldown between attempts if rate-limited (HTTP 429 / `RESOURCE_EXHAUSTED`)
- **Phase 2:** If all models fail, wait 30 seconds and retry the preferred model once
- **UI Feedback:** The `retryStatus` state is surfaced in the UI so users see messages like "Trying gemini-2.5-flash-lite..." or "All models rate-limited. Waiting 30s..."

**Rate Limit Detection:**
```javascript
function isRateLimitError(err) {
  const msg = (err.message || '') + (err.status || '');
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') 
    || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit');
}
```

**Demo Mode:**
When enabled (default on first load), the hook returns hardcoded mock data instead of making API calls. This allows the entire application to function without an API key for demonstrations and testing.

**JSON Extraction from Gemini Responses:**
Gemini sometimes wraps JSON in markdown code fences. The response cleaning pipeline handles this:
```javascript
let cleaned = text.trim();
const match = cleaned.match(/\[[\s\S]*\]/);  // Extract JSON array
if (match) {
  cleaned = match[0];
} else {
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}
const parsed = JSON.parse(cleaned);
```

---

### 4.4 Barcode Scanning + Open Food Facts API

**File:** `src/hooks/useBarcodeScanner.js`

| Attribute | Detail |
|---|---|
| **Scanner Library** | `html5-qrcode` (Html5Qrcode) |
| **Product API** | Open Food Facts v2 (`world.openfoodfacts.org`) |
| **Data Returned** | Product name, brand, category, quantity, unit, nutrition facts, Nutri-Score, image URL |

**Category Mapping:**
Open Food Facts uses its own taxonomy (e.g., `en:dairy`, `en:beverages`). The hook maps these to the app's internal category system:
```javascript
const CATEGORY_MAP = {
  'en:dairy': 'dairy', 'en:milk': 'dairy', 'en:cheeses': 'dairy',
  'en:meats': 'meat', 'en:fruits': 'fruit', 'en:beverages': 'beverage',
  // ...26 mappings total
};
```

**Quantity Parsing:**
The `parseQuantity()` function extracts numeric values and infers units from strings like `"500ml"`, `"1.5kg"`, `"250g"`:
```javascript
if (str.includes('ml') || str.includes('cl')) return { quantity: num, unit: 'grams' };
if (str.includes('kg')) return { quantity: num, unit: 'kg' };
```

**Nutrition Data Extracted:**
- Calories (kcal per 100g)
- Fat, carbohydrates, protein, sugar (per 100g)
- Nutri-Score grade (A through E)

---

## 5. Application Features — Detailed Breakdown

### 5.1 Dashboard (`DashboardView.jsx`)

The landing page providing a fridge health overview:

- **Quick Action Cards:** Three glassmorphism cards linking to Scan, Recipes, and Inventory views
- **Stat Cards:** Four metric cards showing Total Items, Expiring Soon (≤3 days), Expired, and number of Categories
- **Attention Required Panel:** Lists up to 6 items that are expired or expiring within 3 days, sorted by urgency. Each item shows a color-coded badge (expired/critical/warning/fresh)
- **Recently Added Panel:** Shows the 5 most recent items with a relative timestamp (`timeAgo()` function converts to "Just now", "5m ago", "2h ago", "3d ago")

### 5.2 Scan & Add (`ScanView.jsx` — 1,061 lines)

The largest and most feature-dense component. It is organized into five input tabs:

#### Tab 1: Webcam (Live Camera)
- Accesses device camera via `navigator.mediaDevices.getUserMedia()`
- Supports front/rear camera switching (`facingMode: 'user'` / `'environment'`)
- **Continuous Scanning Mode:** Captures frames at configurable intervals (3s local, 5s cloud, 6s advanced) and runs detection automatically
- Frame capture uses a hidden `<canvas>` to extract base64 JPEG from the `<video>` element
- Retry logic: if `canvas.toDataURL()` returns a blank image (all white pixels check), it retries up to 3 times with 500ms delays

#### Tab 2: Upload (File Input + Drag-and-Drop)
- Standard file picker for images
- Drag-and-drop zone with visual feedback (border color change)
- Files are read via `FileReader.readAsDataURL()` and displayed as a preview

#### Tab 3: Barcode Scanner
- Uses `Html5Qrcode` from the `html5-qrcode` library
- Scans standard retail barcodes (UPC, EAN, etc.)
- On successful scan, calls the Open Food Facts API for product details
- Displays product info card with name, brand, Nutri-Score badge, and nutrition breakdown
- User can adjust quantity before adding to inventory

#### Tab 4: Receipt Parsing
- Upload a photo of a grocery receipt
- Sends the image to Gemini with `RECEIPT_PARSE_PROMPT`
- Gemini extracts item names, quantities, prices, and categories from the receipt text
- Results appear as editable item cards showing parsed price, quantity, and category

#### Tab 5: Manual Entry
- Traditional form with fields for name, category (dropdown), quantity, unit, and expiry date
- Categories use emoji icons from `CATEGORY_ICONS` constant

#### Detection Mode Selector
Three radio-style buttons at the top of the scan area:
- **🔌 Local (Offline):** COCO-SSD — fastest, works offline, limited vocabulary
- **🧠 Advanced (Offline):** CLIP — works offline after first download, 150+ items
- **☁️ Cloud (Gemini):** Most capable, requires API key, reads labels/brands/state

#### Results Display
- Detected items appear as interactive cards
- Each card is editable: name, category (dropdown), quantity (number input), unit (dropdown), expiry date (date picker)
- Users can select/deselect individual items via checkboxes
- "Select All" / "Deselect All" toggle
- "Add Selected to Fridge" button persists chosen items to IndexedDB

### 5.3 Inventory View (`InventoryView.jsx`)

Full-featured inventory management table:

- **Search:** Real-time text filtering on item name and category
- **Category Filter Chips:** Dynamic pill buttons generated from actual stored categories, with item counts
- **Sortable Columns:** Name (alphabetical), Category, Expiry (date), Added Date — click toggles ascending/descending with arrow indicators
- **Expiry Badges:** Color-coded using `getExpiryBadgeClass()`:
  - `badge-expired` (red) — past expiry
  - `badge-critical` (dark red) — expires today or tomorrow
  - `badge-warning` (amber) — expires within 3 days
  - `badge-fresh` (green) — more than 3 days remaining
- **Inline Edit Modal:** Click the edit button to open a modal overlay with fields for name, category, quantity, unit, and expiry date. Closes on Escape key or clicking outside.
- **Smart Delete:** Removing an item prompts the user to also add it to the shopping list (for automatic replenishment tracking). Two-step confirmation:
  1. "Remove & add to shopping list?" → calls `deleteItemAndShop()`
  2. "Just remove without shopping list?" → calls `deleteItem()`
- **Clear All:** Danger button with confirmation dialog

### 5.4 Recipe Suggestions (`RecipesView.jsx`)

- Fetches all non-expired fridge items via `getNonExpiredItems()`
- Sends the ingredient list to Gemini with `RECIPE_SUGGESTION_PROMPT`
- Gemini returns 3 recipes, each with: title, description, difficulty, cook time, servings, ingredients list, step-by-step instructions, and matched fridge ingredients
- **Matched Ingredient Highlighting:** Ingredients that come from the user's fridge are visually highlighted with a distinct badge style
- **Difficulty Badges:** Color-coded (green/amber/red for Easy/Medium/Hard)
- Regenerate button to get new suggestions
- Loading state shows animated dots with retry status feedback

### 5.5 Shopping List (`ShoppingListView.jsx`)

Dual-section layout:

- **To Buy Section:** Unpurchased items with checkbox-style toggle, item source labels (`🍽️ Used up`, `⏰ Expired`, `✏️ Added manually`)
- **Purchased Section:** Struck-through items that can be unmarked
- **Add Form:** Inline expandable form for manual additions (name, quantity, unit)
- **Auto-population:** Items are automatically added when removed/consumed from inventory via `deleteItemAndShop()`
- **Batch Actions:** "Clear Purchased" removes only bought items; "Clear All" empties the list entirely
- **Sidebar Badge:** Shows unpurchased count as a notification badge on the Shopping nav item

### 5.6 Voice Assistant (`VoiceAssistant.jsx`)

A floating action button (FAB) with a slide-up panel:

- **Speech Recognition:** Uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) for real-time speech-to-text with interim results
- **NLU Pipeline:** Transcribed text is sent to Gemini with `VOICE_COMMAND_PROMPT`, which parses natural language into structured actions:
  - `"I bought two cartons of milk"` → `{ action: "add", name: "Milk", quantity: 2, unit: "liters" }`
  - `"I ate one apple"` → `{ action: "consume", name: "Apple", quantity: 1 }` → matches against existing inventory
  - `"Threw away the expired yogurt"` → `{ action: "remove", name: "Yogurt" }` → deletes from inventory
- **Consume Logic:** If consuming reduces quantity to ≤ 0, the item is fully deleted and added to the shopping list via `deleteItemAndShop()`. Otherwise, only the quantity is decremented via `updateItem()`.
- **Action Preview:** Parsed actions are displayed as cards the user can review and remove individually before confirming
- **Browser Support Check:** Component renders nothing if `SpeechRecognition` is not available
- **Auto-close:** Panel closes automatically 3 seconds after successful execution

### 5.7 Settings (`SettingsView.jsx`)

- **Theme Toggle:** Switches between "FrostByte" (dark) and "CrystalFrost" (light) themes via `data-theme` attribute on `<html>`, persisted in `localStorage`
- **Demo Mode:** Toggle that enables mock AI responses — no API key needed, instant results
- **API Key Management:** Password-masked input with show/hide toggle, save button, link to Google AI Studio
- **Model Selection:** Dropdown with three Gemini models (`2.5-flash`, `2.5-flash-lite`, `2.5-pro`) — includes automatic migration of deprecated model names
- **Notifications Toggle:** Requests browser notification permission for expiry alerts
- **Danger Zone:** Clear All Data button with confirmation

### 5.8 Expiry Notification System (`useExpiryChecker.js`)

A custom hook that runs periodic checks:

- **Check Interval:** Every 30 minutes (`CHECK_INTERVAL = 30 * 60 * 1000`)
- **Alert Threshold:** Items expiring within 2 days
- **Deduplication:** Uses a `notifiedRef` (Set) to avoid alerting the same item repeatedly in the same session. Resets when the items array changes.
- **Dual Notification Channels:**
  1. **Browser Notifications:** Native `Notification` API with title "🧊 SmartFridge Alert" and item names
  2. **In-App Toasts:** Callback to `AppContent` which renders colored toast messages (warning for expiring, error for expires-today)
- **Toast System:** Toasts are capped at 5 visible at a time, auto-dismiss after 5 seconds, and use `crypto.randomUUID()` for unique IDs

### 5.9 Sidebar Navigation (`Sidebar.jsx`)

- Five primary nav items: Dashboard, Scan & Add, Inventory, Shopping List, Recipes
- **Dynamic Badges:** Inventory shows a count of expiring + expired items; Shopping shows unpurchased count
- **Theme Toggle Button:** Quick-access light/dark mode switch
- **Settings:** Bottom-pinned navigation item

---

## 6. Database Design

**Engine:** Dexie.js wrapping IndexedDB  
**Database Name:** `SmartFridgeDB`

### Schema Versions

**Version 1** — Initial:
```
foodItems: ++id, name, category, quantity, unit, addedDate, expiryDate, imageUrl
```

**Version 2** — Added shopping list:
```
foodItems: ++id, name, category, quantity, unit, addedDate, expiryDate, imageUrl
shoppingList: ++id, name, category, quantity, unit, addedDate, source, purchased
```

### Table: `foodItems`

| Field | Type | Description |
|---|---|---|
| `id` | Auto-increment | Primary key |
| `name` | String | Display name (e.g., "Fuji Apple", "Amul Butter") |
| `category` | String | One of: dairy, vegetable, fruit, meat, grain, beverage, condiment, snack, seafood, frozen, other |
| `quantity` | Number | Amount in specified unit |
| `unit` | String | One of: pieces, liters, kg, grams, packs, bottles, cans, dozen, bunches, slices |
| `addedDate` | ISO String | Timestamp when item was added |
| `expiryDate` | ISO String | Calculated from addedDate + estimatedShelfLifeDays |
| `imageUrl` | String | Product image URL (from barcode API or empty) |

### Table: `shoppingList`

| Field | Type | Description |
|---|---|---|
| `id` | Auto-increment | Primary key |
| `name` | String | Item name |
| `category` | String | Food category |
| `quantity` | Number | Amount needed |
| `unit` | String | Unit of measurement |
| `addedDate` | ISO String | When added to list |
| `source` | String | Why it was added: `"consumed"`, `"expired"`, or `"manual"` |
| `purchased` | Number (0/1) | Toggle flag for purchased status |

---

## 7. State Management

### 7.1 Global State: InventoryContext

The `InventoryContext` (`src/context/InventoryContext.jsx`) uses React's Context API with `createContext` + `useContext` + `useMemo` to provide a centralized inventory interface to all components.

**Provided Methods:**

| Method | Description |
|---|---|
| `addItem(item)` | Add single item to IndexedDB |
| `addItems(items[])` | Bulk-add items (used by ScanView after detection) |
| `updateItem(id, changes)` | Partial update (used by edit modal, voice consume) |
| `deleteItem(id)` | Remove item without adding to shopping list |
| `deleteItemAndShop(id, reason)` | Remove item AND auto-add to shopping list |
| `clearAll()` | Wipe all food items |
| `getExpiringItems(days)` | Filter items expiring within N days |
| `getExpiredItems()` | Filter items past their expiry date |
| `getItemsByCategory(cat)` | Filter by category |
| `getNonExpiredItems()` | All items still within expiry |
| `getCategories()` | Unique sorted category list |
| `refreshItems()` | Force reload from IndexedDB |

**Shopping List Methods:** `addShoppingItem`, `toggleShoppingItem`, `deleteShoppingItem`, `clearPurchasedItems`, `clearShoppingList`

### 7.2 Local State

Each view manages its own UI state (search queries, sort directions, form inputs, modals) via `useState`. The detection hooks (`useLocalDetection`, `useAdvancedDetection`, `useGemini`) each manage their own `detecting`, `error`, and `modelLoading` states internally.

### 7.3 Persistent Settings (localStorage)

| Key | Values | Default |
|---|---|---|
| `smartfridge_gemini_key` | API key string | `""` |
| `smartfridge_gemini_model` | Model ID | `"gemini-2.5-flash"` |
| `smartfridge_demo_mode` | `"true"` / `"false"` | `"true"` |
| `smartfridge_detection_mode` | `"local"` / `"advanced"` / `"cloud"` | `"local"` |
| `smartfridge_theme` | `"dark"` / `"light"` | `"dark"` |

---

## 8. Prompt Engineering

All AI prompts are centralized in `src/utils/prompts.js`. Each prompt is carefully structured to force strict JSON-only output from Gemini.

### 8.1 Food Detection Prompt (`FOOD_DETECTION_PROMPT`)
- Instructs Gemini to be specific ("Fuji apple" not "apple", include brand names)
- Defines confidence scoring rubric (0.9-1.0 = clear, 0.5-0.69 = ambiguous, below 0.5 = exclude)
- Includes shelf life estimation guidelines per food category
- Handles edge cases: partially visible items, cooked foods, items in containers
- Strict output format: JSON array only, no markdown, no explanation

### 8.2 Recipe Suggestion Prompt (`RECIPE_SUGGESTION_PROMPT`)
- Dynamically injects current fridge contents as a formatted ingredient list
- Allows basic pantry staples (salt, pepper, oil, butter, sugar, flour, garlic, onion, spices) without requiring them in inventory
- Requests 3 recipes with difficulty mix (Easy/Medium/Hard)
- Prioritizes recipes using ingredients expiring soon
- Output format: JSON with title, description, difficulty, cookTime, servings, ingredients, steps, matchedIngredients

### 8.3 Receipt Parse Prompt (`RECEIPT_PARSE_PROMPT`)
- Instructs Gemini to OCR receipt text and extract structured item data
- Handles receipt abbreviations ("AMUL MLK" → "Amul Milk 1L")
- Extracts prices when visible
- Filters out non-food line items (bags, taxes, discounts, totals)

### 8.4 Voice Command Prompt (`VOICE_COMMAND_PROMPT`)
- Dynamically injects the full current inventory with item IDs
- Defines three actions: `add`, `consume`, `remove`
- Maps natural language phrases to actions: "bought/got/picked up" → add; "ate/used/drank" → consume; "threw away/tossed" → remove
- Returns `matchedItemId` for consume/remove actions to enable direct inventory lookup

---

## 9. File-by-File Reference

```
omni-fridge/
├── index.html                          # HTML shell with meta tags, emoji favicon, SEO description
├── package.json                        # Dependencies and scripts (dev, build, lint, preview)
├── vite.config.js                      # Vite config with React plugin
├── eslint.config.js                    # ESLint rules
│
└── src/
    ├── main.jsx                        # React DOM entry point (StrictMode + App render)
    ├── App.jsx                         # Root component wrapping AppContent in InventoryProvider
    ├── AppContent.jsx                  # Layout shell: Sidebar + View router + Toast system + VoiceAssistant
    ├── db.js                           # Dexie database schema (2 versions, 2 tables)
    ├── index.css                       # Global styles: CSS variables, reset, glass panels, badges, toasts
    │
    ├── context/
    │   └── InventoryContext.jsx         # Global state provider for inventory + shopping list CRUD
    │
    ├── hooks/
    │   ├── useLocalDetection.js         # TF.js COCO-SSD hook (offline, 10 food labels)
    │   ├── useAdvancedDetection.js      # Transformers.js CLIP hook (offline, 150+ food labels)
    │   ├── useGemini.js                 # Gemini API hook (cloud, 4 functions, fallback, demo mode)
    │   ├── useBarcodeScanner.js         # Barcode → Open Food Facts API lookup
    │   └── useExpiryChecker.js          # Periodic expiry check with browser + toast notifications
    │
    ├── utils/
    │   ├── constants.js                 # MS_PER_DAY, UNITS array, CATEGORIES array, CATEGORY_ICONS map
    │   ├── expiry.js                    # getDaysUntilExpiry(), getExpiryBadgeClass(), getExpiryLabel()
    │   └── prompts.js                   # 4 structured Gemini prompts (food, recipe, receipt, voice)
    │
    ├── components/
    │   ├── Sidebar.jsx + .css           # Navigation sidebar with dynamic badges and theme toggle
    │   ├── DashboardView.jsx + .css     # Overview: stats, expiring items, recent activity
    │   ├── ScanView.jsx + .css          # 5-tab scanning: webcam, upload, barcode, receipt, manual (1061 lines)
    │   ├── InventoryView.jsx + .css     # Searchable, sortable table with edit modal and smart delete
    │   ├── RecipesView.jsx + .css       # AI recipe cards with ingredient matching
    │   ├── ShoppingListView.jsx + .css  # Checklist with auto-population from consumed/expired items
    │   ├── SettingsView.jsx + .css      # Theme, demo mode, API key, model, notifications, danger zone
    │   └── VoiceAssistant.jsx + .css    # FAB + slide-up panel with speech recognition and NLU
    │
    └── styles/                          # (empty — reserved for shared style modules)
```

---

## 10. Setup & Installation

### Prerequisites
- Node.js (v18+)
- npm

### Install & Run

```bash
# 1. Clone the repository
git clone <repo-url>
cd omni-fridge

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app launches at `http://localhost:5173/`.

### Configuration

1. **Demo Mode (default ON):** Works immediately with simulated AI responses — no API key needed.
2. **Cloud AI:** To use real Gemini features, go to **Settings → Gemini API Key**, paste a key from [Google AI Studio](https://aistudio.google.com/apikey), save, and disable Demo Mode.
3. **Offline Models:** Local (COCO-SSD) and Advanced (CLIP) modes download their models on first use and cache them in the browser permanently.

### Build for Production

```bash
npm run build
npm run preview  # Preview the production build locally
```

---

> **Built with React 19 · Vite 8 · TensorFlow.js · Transformers.js · Google Gemini · Dexie.js · IndexedDB**
