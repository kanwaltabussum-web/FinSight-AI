/* FinSight AI — working file workflows.
   CSV/XLS/XLSX => backend financial analysis.
   PDF/DOCX/PPTX/TXT => backend text extraction/document inspection.
   JPG/JPEG/PNG/WEBP/GIF/BMP => browser OCR text extraction (English-first) and preview.
   OCR text is not silently treated as structured transactions or risk findings. */
const API_URL = "https://finsight-ai.fastapicloud.dev";
let selectedFile = null;
let lastAnalysisData = null;
let lastExportPayload = null;
let activeAnalysisController = null;
let analysisRunId = 0;
let activeUploadMode = "financial";

const FINANCIAL_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "pptx", "txt"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp"]);
let lastImageObjectUrl = null;
const RECORD_TYPE_LABELS = {
  bank_statement: "Bank Statement",
  general_ledger: "General Ledger",
  cash_book: "Cash Book",
  other_financial_data: "Other Financial Transactions"
};

function fileExtension(file) {
  const name = (file && file.name ? file.name : "").toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : "";
}

function suggestRecordTypeFromFilename(file) {
  const name = (file && file.name ? file.name : "").toLowerCase().replace(/[._-]+/g, " ");
  if (/bank|statement|account activity/.test(name)) return {value:"bank_statement", label:"Bank Statement"};
  if (/cash book|petty cash|cash receipts|cash payments/.test(name)) return {value:"cash_book", label:"Cash Book"};
  if (/general ledger|\bgl\b|ledger export|account ledger/.test(name)) return {value:"general_ledger", label:"General Ledger"};
  if (/pos|payment gateway|digital wallet|wallet transactions|erp transaction|transaction export|online payments/.test(name)) return {value:"other_financial_data", label:"Other Financial Transactions"};
  return null;
}

function escapeHTML(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)) return "Not reported";
  return number.toLocaleString("en-US", {minimumFractionDigits:decimals, maximumFractionDigits:decimals});
}
function fmtMoney(value) { return formatNumber(value, 2); }
function setStatus(message, kind = "") {
  const status = document.getElementById("analysisStatus");
  if (!status) return;
  status.className = "analysis-status" + (kind ? " " + kind : "");
  status.textContent = message || "";
}
function setHelp(message) {
  const el = document.getElementById("selectedFileHelp");
  if (el) el.textContent = message;
}
function scrollToUpload() {
  const target = document.getElementById("analyze");
  if (target) target.scrollIntoView({behavior:"smooth", block:"start"});
}
function scrollToHowItWorks() {
  const target = document.getElementById("workspaces");
  if (target) target.scrollIntoView({behavior:"smooth", block:"start"});
}
window.scrollToUpload = scrollToUpload;
window.scrollToHowItWorks = scrollToHowItWorks;


const FINANCIAL_ACCEPT = ".csv,.xls,.xlsx";
const DOCUMENT_IMAGE_ACCEPT = ".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif,.bmp";
const FINANCIAL_TYPES_TEXT = ["CSV", "XLS", "XLSX"];
const DOCUMENT_IMAGE_TYPES_TEXT = ["PDF", "DOCX", "PPTX", "TXT", "JPG/JPEG", "PNG", "WEBP", "GIF", "BMP"];

function updateUploadModeUI(mode) {
  activeUploadMode = mode === "documents" ? "documents" : "financial";
  const financialMode = activeUploadMode === "financial";
  const financialButton = document.getElementById("financialAnalysisModeButton");
  const documentButton = document.getElementById("documentReadingModeButton");
  const fileInput = document.getElementById("fileInput");
  const recordTypeWrapper = document.getElementById("recordTypeWrapper");
  const chooseButton = document.getElementById("chooseFileButton");
  const promptTitle = document.getElementById("uploadPromptTitle");
  const promptHelp = document.getElementById("uploadPromptHelp");
  const fileTypes = document.querySelector("#uploadBox .file-types");
  const selectedState = document.getElementById(financialMode ? "financialModeState" : "documentModeState");
  const otherState = document.getElementById(financialMode ? "documentModeState" : "financialModeState");
  const analyzeButton = document.getElementById("analyzeFileButton");

  if (financialButton) {
    financialButton.classList.toggle("is-selected", financialMode);
    financialButton.setAttribute("aria-pressed", String(financialMode));
  }
  if (documentButton) {
    documentButton.classList.toggle("is-selected", !financialMode);
    documentButton.setAttribute("aria-pressed", String(!financialMode));
  }
  if (selectedState) selectedState.textContent = "✓ Selected workflow";
  if (otherState) otherState.textContent = "Select this workflow";
  if (fileInput) fileInput.accept = financialMode ? FINANCIAL_ACCEPT : DOCUMENT_IMAGE_ACCEPT;
  if (recordTypeWrapper) recordTypeWrapper.hidden = !financialMode;
  if (chooseButton) chooseButton.textContent = financialMode ? "Choose financial file" : "Choose document or image";
  if (promptTitle) promptTitle.textContent = financialMode ? "Drop your financial file here" : "Drop your document or image here";
  if (promptHelp) promptHelp.textContent = financialMode
    ? "Financial Analysis is selected. Choose a CSV, XLS, or XLSX file, or drop it here."
    : "Document & Image Reading is selected. Choose a PDF, DOCX, PPTX, TXT, or common image file, or drop it here.";
  if (fileTypes) {
    const types = financialMode ? FINANCIAL_TYPES_TEXT : DOCUMENT_IMAGE_TYPES_TEXT;
    fileTypes.innerHTML = types.map(type => `<span>${type}</span>`).join("");
  }
  if (analyzeButton && !selectedFile) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = financialMode ? "Analyze financial data →" : "Inspect document or read image →";
  }
}

function clearCurrentAnalysisForWorkflowSwitch() {
  analysisRunId += 1;
  if (activeAnalysisController) {
    activeAnalysisController.abort();
    activeAnalysisController = null;
  }
  selectedFile = null;
  lastAnalysisData = null;
  const fileInput = document.getElementById("fileInput");
  if (fileInput) fileInput.value = "";
  const info = document.querySelector("#uploadBox .file-info");
  if (info) { info.hidden = true; info.textContent = "Choose a file to begin"; }
  const analyzeButton = ensureAnalyzeButton();
  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = activeUploadMode === "financial" ? "Analyze financial data →" : "Inspect document or read image →";
  }
  const results = document.getElementById("resultsContainer");
  if (results) results.replaceChildren();
  if (lastImageObjectUrl) {
    URL.revokeObjectURL(lastImageObjectUrl);
    lastImageObjectUrl = null;
  }
  resetHeroDashboard();
}

function selectUploadMode(mode) {
  const nextMode = mode === "documents" ? "documents" : "financial";
  if (nextMode !== activeUploadMode) {
    updateUploadModeUI(nextMode);
    clearCurrentAnalysisForWorkflowSwitch();
    setHelp(nextMode === "financial"
      ? "Financial Analysis selected. Upload a CSV/XLS/XLSX transaction file."
      : "Document & Image Reading selected. Upload a PDF/DOCX/PPTX/TXT or image file for readable-text extraction and preview.");
    setStatus(nextMode === "financial"
      ? "Financial Analysis is ready. Choose a spreadsheet to start."
      : "Document & Image Reading is ready. Choose a document or image to start.");
  } else {
    updateUploadModeUI(nextMode);
  }
}

function ensureAnalyzeButton() {
  let button = document.getElementById("analyzeFileButton");
  const actions = document.getElementById("uploadActions");
  const box = document.getElementById("uploadBox");
  if (!button) {
    button = document.createElement("button");
    button.id = "analyzeFileButton";
    button.type = "button";
    button.className = "btn btn-primary";
    button.disabled = true;
    button.textContent = activeUploadMode === "financial" ? "Analyze financial data →" : "Inspect document or read image →";
    (actions || box || document.body).appendChild(button);
  }
  if (button.dataset.analyzeBound !== "true") {
    button.dataset.analyzeBound = "true";
    button.addEventListener("click", analyzeFile);
  }
  return button;
}
function showSelectedFile(file) {
  selectedFile = file;
  const box = document.getElementById("uploadBox");
  const info = box && box.querySelector(".file-info");
  const ext = fileExtension(file);
  const inferredMode = FINANCIAL_EXTENSIONS.has(ext) ? "financial" : (DOCUMENT_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext) ? "documents" : activeUploadMode);
  updateUploadModeUI(inferredMode);
  if (info) {
    info.hidden = false;
    info.textContent = `${file.name} · ${formatNumber(file.size / 1024, 1)} KB`;
  }
  const button = ensureAnalyzeButton();
  if (button) {
    button.hidden = false;
    button.disabled = false;
    button.textContent = FINANCIAL_EXTENSIONS.has(ext) ? "Analyze financial data →" : IMAGE_EXTENSIONS.has(ext) ? "Read image text (OCR) →" : DOCUMENT_EXTENSIONS.has(ext) ? "Inspect document →" : "Check supported format →";
  }
  const resetButton = document.getElementById("newAnalysisButton");
  if (resetButton) resetButton.disabled = false;
  if (FINANCIAL_EXTENSIONS.has(ext)) {
    const record = document.getElementById("dataType");
    const recordLabel = RECORD_TYPE_LABELS[record ? record.value : "bank_statement"] || "Bank Statement";
    const filenameSuggestion = suggestRecordTypeFromFilename(file);
    const suggestionText = filenameSuggestion && filenameSuggestion.value !== (record ? record.value : "bank_statement")
      ? ` Filename hint: this name may fit ${filenameSuggestion.label}; please confirm the record type above. This is only a filename-based suggestion.`
      : "";
    setHelp(`${file.name} is ready for transaction analysis as ${recordLabel}. FinSight will report only what the API actually returns.${suggestionText}`);
    setStatus("File selected. Click Analyze financial data to start.");
  } else if (DOCUMENT_EXTENSIONS.has(ext)) {
    setHelp(`${file.name} is a supporting document. Document inspection extracts readable text, estimates the document type and shows a preview. It does not run transaction-level duplicate or risk checks.`);
    setStatus("Document selected. Click Inspect document to read it.");
  } else if (IMAGE_EXTENSIONS.has(ext)) {
    setHelp(`${file.name} is an image. FinSight will attempt English-first OCR and show the extracted text with an image preview. OCR can misread numbers and does not automatically create transaction-level financial analysis.`);
    setStatus("Image selected. Click Read image text (OCR) to extract visible text.");
  } else {
    setHelp("This file can be selected, but it cannot be processed in this version. Use CSV/XLS/XLSX for financial analysis; PDF/DOCX/PPTX/TXT for document text inspection; JPG/JPEG/PNG/WEBP/GIF/BMP for browser-based English-first OCR.");
    setStatus("Unsupported file type.", "error");
  }
}
function initUpload() {
  const fileInput = document.getElementById("fileInput");
  const box = document.getElementById("uploadBox");
  const choose = document.getElementById("chooseFileButton");
  const dataType = document.getElementById("dataType");
  const financialModeButton = document.getElementById("financialAnalysisModeButton");
  const documentModeButton = document.getElementById("documentReadingModeButton");
  if (!fileInput || !box) return;

  if (financialModeButton && financialModeButton.dataset.modeBound !== "true") {
    financialModeButton.dataset.modeBound = "true";
    financialModeButton.addEventListener("click", () => selectUploadMode("financial"));
  }
  if (documentModeButton && documentModeButton.dataset.modeBound !== "true") {
    documentModeButton.dataset.modeBound = "true";
    documentModeButton.addEventListener("click", () => selectUploadMode("documents"));
  }
  updateUploadModeUI(activeUploadMode);
  const analyzeButton = ensureAnalyzeButton();
  if (analyzeButton && !selectedFile) analyzeButton.disabled = true;
  const newAnalysisButton = document.getElementById("newAnalysisButton");
  if (newAnalysisButton && newAnalysisButton.dataset.resetBound !== "true") {
    newAnalysisButton.dataset.resetBound = "true";
    newAnalysisButton.addEventListener("click", resetAnalysis);
  }
  // Explicit visible button; keep the native file input available as a fallback.
  if (choose && choose.dataset.bound !== "true") {
    choose.dataset.bound = "true";
    choose.addEventListener("click", (event) => {
      event.preventDefault();
      fileInput.click();
    });
  }
  if (fileInput.dataset.uploadBound !== "true") {
    fileInput.dataset.uploadBound = "true";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) showSelectedFile(file);
      else {
        selectedFile = null;
        setHelp("No file selected yet. Your dashboard remains empty until you choose and analyze a file.");
        setStatus("");
      }
    });
  }
  if (dataType) dataType.addEventListener("change", () => {
    const currentHint = document.getElementById("recordTypeCurrentHint");
    const descriptions = {
      bank_statement: "Bank Statement: deposits, withdrawals, account activity and bank references.",
      general_ledger: "General Ledger: account-wise entries, journal references, debit/credit values and account codes.",
      cash_book: "Cash Book: cash receipts, payments and balances.",
      other_financial_data: "Other Financial Transactions: transaction-row exports such as POS, payment gateway, digital wallet or ERP transaction data."
    };
    if (currentHint) currentHint.textContent = descriptions[dataType.value] || descriptions.bank_statement;
    if (selectedFile && FINANCIAL_EXTENSIONS.has(fileExtension(selectedFile))) showSelectedFile(selectedFile);
  });
  ["dragover", "dragenter"].forEach(type => box.addEventListener(type, event => {
    event.preventDefault(); box.classList.add("drag-active"); box.classList.add("drag-over");
  }));
  ["dragleave", "dragend"].forEach(type => box.addEventListener(type, () => {
    box.classList.remove("drag-active", "drag-over");
  }));
  box.addEventListener("drop", event => {
    event.preventDefault(); box.classList.remove("drag-active", "drag-over");
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
      try { fileInput.files = event.dataTransfer.files; } catch (_) { /* picker assignment may be blocked; selectedFile still works */ }
      showSelectedFile(event.dataTransfer.files[0]);
    }
  });
}

const TESSERACT_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const PDFJS_SCRIPT_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const browserLibraryLoads = new Map();
let tesseractWorkerPromise = null;
let activeOcrProgressCallback = null;

function loadBrowserLibrary(url, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (browserLibraryLoads.has(url)) return browserLibraryLoads.get(url);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => window[globalName]
      ? resolve(window[globalName])
      : reject(new Error(`The library loaded, but ${globalName} was unavailable.`));
    script.onerror = () => reject(new Error("A required browser reading library could not load. Check your internet connection and retry."));
    document.head.appendChild(script);
  });
  browserLibraryLoads.set(url, promise);
  promise.catch(() => browserLibraryLoads.delete(url));
  return promise;
}

async function getTesseractWorker(progressCallback) {
  activeOcrProgressCallback = progressCallback || null;
  const tesseract = await loadBrowserLibrary(TESSERACT_SCRIPT_URL, "Tesseract");
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = tesseract.createWorker("eng", 1, {
      logger: (message) => {
        if (activeOcrProgressCallback && message && message.status) {
          const progress = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : "";
          activeOcrProgressCallback(`${message.status}${progress}`);
        }
      }
    }).catch((error) => {
      tesseractWorkerPromise = null;
      throw error;
    });
  }
  return tesseractWorkerPromise;
}

function canvasFromImageFile(file) {
  return new Promise((resolve, reject) => {
    if (lastImageObjectUrl) URL.revokeObjectURL(lastImageObjectUrl);
    lastImageObjectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        // Limit very large images to keep browser memory use reasonable.
        const longest = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
        const scale = Math.min(1, 2400 / Math.max(longest, 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Your browser could not prepare this image for text reading.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ canvas, imageUrl: lastImageObjectUrl, width: canvas.width, height: canvas.height });
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("This image could not be opened by your browser. Try saving it as PNG or JPG and upload again."));
    image.src = lastImageObjectUrl;
  });
}

function detectPossibleAmounts(text) {
  const source = String(text || "");
  const patterns = [
    /(?:PKR|Rs\.?|Rupees|USD|US\$|\$|EUR|€|GBP|£)\s*[-:]?\s*\d[\d,]*(?:\.\d{1,2})?/gi,
    /\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b/g,
    /\b\d+\.\d{2}\b/g
  ];
  const found = [];
  const seen = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = String(match[0]).trim().replace(/\s+/g, " ");
      const key = value.toLowerCase();
      if (value && !seen.has(key)) { seen.add(key); found.push(value); }
    }
  }
  return found.slice(0, 100);
}

async function inspectImageWithOCR(file) {
  setStatus("Loading OCR reader for the image… This requires an internet connection on the first run.");
  const prepared = await canvasFromImageFile(file);
  const worker = await getTesseractWorker((progress) => setStatus(`Reading image text: ${progress}`));
  const result = await worker.recognize(prepared.canvas);
  const text = String(result && result.data && result.data.text || "").trim();
  const words = text.match(/\b[\w'-]+\b/g) || [];
  return {
    success: true,
    filename: file.name,
    file_type: fileExtension(file),
    detected_document_type: "Image text (OCR)",
    explanation: text
      ? "FinSight used browser-based English-first OCR to read visible text from this image. OCR may misread amounts, dates, handwriting or non-English content; verify the extracted text against the original image. This is text extraction, not transaction-level risk analysis."
      : "The OCR reader did not detect readable text in this image. Try a clearer, well-lit image with straight text, or upload a text-based PDF/Excel file.",
    word_count: words.length,
    character_count: text.length,
    page_count: null,
    slide_count: null,
    paragraph_count: null,
    image_count: 1,
    detected_amounts: detectPossibleAmounts(text),
    statistics: { file_size_kb: Math.round(file.size / 1024 * 10) / 10, image_count: 1, image_width: prepared.width, image_height: prepared.height, word_count: words.length, character_count: text.length },
    notes: ["Image formats supported: JPG/JPEG, PNG, WEBP, GIF (first frame), BMP.", "OCR uses the English model and may be less accurate for Urdu or other languages.", "Extracted text is not automatically transformed into financial transaction rows. For duplicate/risk analysis, use a structured CSV/XLS/XLSX file or manually review/structure the extracted text."],
    text_preview: text.slice(0, 8000),
    text_truncated: text.length > 8000,
    source_preview_url: prepared.imageUrl,
    processing_note: "Browser-side OCR text extraction only; no transaction risk score or duplicate analysis was calculated from the image."
  };
}

async function inspectScannedPdfWithOCR(file) {
  const pdfjs = await loadBrowserLibrary(PDFJS_SCRIPT_URL, "pdfjsLib");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageLimit = Math.min(pdf.numPages, 10);
  const worker = await getTesseractWorker((progress) => setStatus(`Reading scanned PDF text: ${progress}`));
  const extractedPages = [];
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    setStatus(`Reading scanned PDF page ${pageNumber} of ${pageLimit} with OCR…`);
    const page = await pdf.getPage(pageNumber);
    const firstViewport = page.getViewport({ scale: 1.35 });
    const scale = Math.min(1.35, 2200 / Math.max(firstViewport.width, firstViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    await page.render({ canvasContext: context, viewport }).promise;
    const result = await worker.recognize(canvas);
    const pageText = String(result && result.data && result.data.text || "").trim();
    extractedPages.push(`[Page ${pageNumber}]\n${pageText}`);
    page.cleanup();
  }
  const text = extractedPages.join("\n\n").trim();
  const words = text.match(/\b[\w'-]+\b/g) || [];
  const notes = [
    `This PDF had no selectable text, so browser OCR was attempted on the first ${pageLimit} of ${pdf.numPages} page(s).`,
    "OCR is English-first and can misread financial numbers, dates, columns or non-English text. Verify extracted content with the original document.",
    "OCR text does not itself become transaction rows, and duplicate/risk analysis has not been run on this PDF."
  ];
  if (pdf.numPages > pageLimit) notes.push(`Only the first ${pageLimit} pages were OCR processed in the browser to control memory and waiting time. Split a larger PDF into smaller files to inspect remaining pages.`);
  return {
    success: true,
    filename: file.name,
    file_type: "pdf",
    detected_document_type: "Scanned PDF (OCR text)",
    explanation: text
      ? "No selectable PDF text was available; FinSight rendered pages in your browser and used English-first OCR. Please verify the text, especially financial amounts and dates."
      : "No readable text was detected by OCR. The PDF may have low resolution, handwriting or non-English content.",
    word_count: words.length,
    character_count: text.length,
    page_count: pdf.numPages,
    statistics: { file_size_kb: Math.round(file.size / 1024 * 10) / 10, pdf_pages: pdf.numPages, ocr_pages_processed: pageLimit, word_count: words.length, character_count: text.length },
    notes,
    text_preview: text.slice(0, 8000),
    text_truncated: text.length > 8000,
    processing_note: "Browser-side OCR text extraction only; no transaction-level financial analysis was calculated from OCR text."
  };
}

async function analyzeFile() {
  if (!selectedFile) {
    const input = document.getElementById("fileInput");
    if (input && input.files && input.files[0]) selectedFile = input.files[0];
  }
  if (!selectedFile) {
    setStatus("Please choose a file first.", "error");
    scrollToUpload();
    return;
  }

  const runId = ++analysisRunId;
  const requestFile = selectedFile;
  const ext = fileExtension(requestFile);
  const financial = FINANCIAL_EXTENSIONS.has(ext);
  const documentFile = DOCUMENT_EXTENSIONS.has(ext);
  const imageFile = IMAGE_EXTENSIONS.has(ext);
  const button = ensureAnalyzeButton();
  let controller = null;

  if (!financial && !documentFile && !imageFile) {
    const message = "Unsupported file type. Use CSV/XLS/XLSX for transaction analysis; PDF/DOCX/PPTX/TXT for document inspection; or JPG/JPEG/PNG/WEBP/GIF/BMP for OCR text extraction.";
    setStatus(message, "error");
    renderError(message);
    return;
  }

  const actionLabel = financial ? "Analyze financial data →" : imageFile ? "Read image text (OCR) →" : "Inspect document →";
  if (button) {
    button.disabled = true;
    button.textContent = financial ? "Analyzing financial data…" : imageFile ? "Reading image text…" : "Inspecting document…";
  }

  try {
    let data;
    if (imageFile) {
      data = await inspectImageWithOCR(requestFile);
      if (runId !== analysisRunId || selectedFile !== requestFile) return;
      displayDocumentResults(data);
      setStatus("Image OCR complete. Review the extracted text carefully; transaction-level risk and duplicate analysis was not run on the image.", "success");
    } else if (financial) {
      setStatus("Uploading file and analyzing transaction rows…");
      const form = new FormData();
      form.append("file", requestFile);
      const typeSelect = document.getElementById("dataType");
      form.append("data_type", typeSelect && typeSelect.value ? typeSelect.value : "bank_statement");
      controller = new AbortController();
      activeAnalysisController = controller;
      const response = await fetch(`${API_URL}/analyze`, { method: "POST", body: form, signal: controller.signal });
      if (runId !== analysisRunId || selectedFile !== requestFile) return;
      let responseData = {};
      try { responseData = await response.json(); } catch (_) { responseData = {}; }
      if (!response.ok || responseData.success === false) {
        throw new Error(responseData.detail || responseData.error || `Analysis request failed (${response.status}).`);
      }
      data = responseData;
      lastAnalysisData = data;
      displayFinancialResults(data, requestFile.name, typeSelect && typeSelect.value ? typeSelect.value : "bank_statement");
      updateHeroDashboard(data);
      setStatus("Analysis complete. Review counts, mapped columns, duplicate candidates, unusual-value signals and transaction rows below.", "success");
    } else {
      setStatus("Uploading document and extracting readable text…");
      const form = new FormData();
      form.append("file", requestFile);
      controller = new AbortController();
      activeAnalysisController = controller;
      const response = await fetch(`${API_URL}/document/inspect`, { method: "POST", body: form, signal: controller.signal });
      if (runId !== analysisRunId || selectedFile !== requestFile) return;
      try { data = await response.json(); } catch (_) { data = {}; }
      if (response.status === 404) {
        throw new Error("Document reading is not enabled on the live API yet (404). Install/register backend/document_routes.py, then redeploy/restart the backend.");
      }
      if (response.status === 405) {
        throw new Error("The live API returned Method Not Allowed (405) for POST /document/inspect. The deployed backend route/method does not match this website. Register the POST document router in backend/main.py, redeploy the backend, then retry. Local Swagger success alone does not update the live API.");
      }
      if (!response.ok || data.success === false) {
        throw new Error(data.detail || data.error || `Document inspection failed (${response.status}).`);
      }
      // If a PDF contains no selectable text, try browser-side OCR on up to 10 pages.
      if (ext === "pdf" && !String(data.text_preview || data.extracted_text || "").trim()) {
        try {
          setStatus("No selectable text found in this PDF. Trying browser OCR on up to 10 pages…");
          data = await inspectScannedPdfWithOCR(requestFile);
        } catch (ocrError) {
          data.notes = Array.isArray(data.notes) ? data.notes : [];
          data.notes.push(`Browser OCR could not run: ${ocrError.message || "OCR library unavailable"}. You can still inspect this PDF, but scanned pages need a working internet connection for OCR.`);
          data.explanation = data.explanation || "The PDF was received but no selectable text was found.";
        }
      }
      if (runId !== analysisRunId || selectedFile !== requestFile) return;
      displayDocumentResults(data);
      setStatus("Document inspection complete. Review extracted text and any OCR notes; no transaction-level risk analysis was run on the document.", "success");
    }
    if (runId !== analysisRunId || selectedFile !== requestFile) return;
    const out = document.getElementById("resultsContainer");
    if (out) out.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error && error.name === "AbortError") return;
    if (runId !== analysisRunId || selectedFile !== requestFile) return;
    console.error("FinSight upload error:", error);
    const message = error.message || "Could not connect to the analysis service.";
    setStatus(message, "error");
    renderError(message);
  } finally {
    if (activeAnalysisController === controller) activeAnalysisController = null;
    if (runId === analysisRunId && selectedFile === requestFile && button) {
      button.disabled = false;
      button.textContent = actionLabel;
    }
  }
}
window.analyzeFile = analyzeFile;


function resetHeroDashboard() {
  const visual = document.querySelector(".hero-visual");
  if (!visual) return;
  const metrics = visual.querySelectorAll(".metric-card strong");
  if (metrics[0]) metrics[0].textContent = "—";
  if (metrics[1]) metrics[1].textContent = "—";

  const live = visual.querySelector(".live-status");
  if (live) {
    live.innerHTML = "<span></span> AWAITING FILE";
    live.classList.add("waiting-status");
    live.style.color = "";
    const dot = live.querySelector("span");
    if (dot) dot.style.background = "";
  }

  const alert = visual.querySelector(".risk-alert");
  if (alert) {
    alert.classList.add("waiting-alert");
    const icon = alert.querySelector(".risk-icon");
    const title = alert.querySelector(".risk-text strong");
    const detail = alert.querySelector(".risk-text span");
    if (icon) icon.textContent = "i";
    if (title) title.textContent = "No file analyzed yet";
    if (detail) detail.textContent = "Upload a statement to see real results here.";
  }

  const period = visual.querySelector(".period");
  if (period) period.textContent = "Waiting for file";
  const patternTitle = visual.querySelector(".pattern-title");
  if (patternTitle) patternTitle.textContent = "Pattern overview · No file yet";
  visual.querySelectorAll(".pattern-summary strong").forEach(node => { node.textContent = "—"; });

  const chart = visual.querySelector(".chart-bars");
  if (chart) {
    chart.classList.add("empty-chart");
    chart.setAttribute("aria-label", "No transaction data yet");
    chart.setAttribute("aria-hidden", "true");
    chart.querySelectorAll("i").forEach(bar => {
      bar.style.height = "0%";
      bar.style.background = "";
    });
  }
  window.finSightRobotMood = "normal";
  if (typeof window.setFinSightRobotMood === "function") window.setFinSightRobotMood("normal");
}

function resetAnalysis() {
  // Invalidate/abort an in-flight request so old results cannot return after reset.
  analysisRunId += 1;
  if (activeAnalysisController) {
    activeAnalysisController.abort();
    activeAnalysisController = null;
  }
  selectedFile = null;
  lastAnalysisData = null;

  const input = document.getElementById("fileInput");
  if (input) input.value = "";
  const info = document.querySelector("#uploadBox .file-info");
  if (info) {
    info.textContent = "Choose a file to begin";
    info.hidden = true;
  }
  const analyzeButton = ensureAnalyzeButton();
  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = activeUploadMode === "financial" ? "Analyze financial data →" : "Inspect document or read image →";
  }
  const resetButton = document.getElementById("newAnalysisButton");
  if (resetButton) resetButton.disabled = false;

  if (lastImageObjectUrl) {
    URL.revokeObjectURL(lastImageObjectUrl);
    lastImageObjectUrl = null;
  }
  const results = document.getElementById("resultsContainer");
  if (results) results.replaceChildren();

  setHelp("No file selected yet. Your dashboard remains empty until you choose and analyze a file.");
  setStatus("Ready for a new analysis. Choose a file to begin.");
  resetHeroDashboard();
  const analyzeSection = document.getElementById("analyze");
  if (analyzeSection) analyzeSection.scrollIntoView({behavior:"smooth", block:"start"});
}
window.resetAnalysis = resetAnalysis;

function addOutputStyles() {
  if (document.getElementById("finsightDynamicOutputStyles")) return;
  const style = document.createElement("style");
  style.id = "finsightDynamicOutputStyles";
  style.textContent = `
    .finsight-output{color:#edf1ff;margin-top:25px}.finsight-output .out-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:19px;border:1px solid rgba(180,191,255,.16);border-radius:16px;background:rgba(20,26,53,.78);margin-bottom:14px}.finsight-output h3{margin:0 0 5px;font-size:16px}.finsight-output p{color:#aab5d2;font-size:11px;line-height:1.7;margin:0}.out-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:30px;font-weight:800;font-size:10px;border:1px solid transparent}.out-badge:before{content:"";display:block;width:6px;height:6px;border-radius:50%;background:currentColor}.out-badge.normal,.status-normal{color:#70dfb7!important;background:rgba(51,190,139,.12)!important;border-color:rgba(112,223,183,.25)!important}.out-badge.review,.status-review{color:#ffca72!important;background:rgba(217,143,35,.13)!important;border-color:rgba(255,202,114,.25)!important}.out-badge.high,.status-high{color:#ff899a!important;background:rgba(218,63,90,.13)!important;border-color:rgba(255,137,154,.25)!important}.status-duplicate{color:#c7a8ff!important;background:rgba(154,107,255,.15)!important;border-color:rgba(199,168,255,.28)!important}.out-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}.out-metric{border:1px solid rgba(180,191,255,.13);border-radius:13px;padding:15px;background:rgba(17,21,44,.64);min-width:0}.out-metric small{display:block;color:#8c98bb;font-size:9px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}.out-metric strong{display:block;font-size:20px;overflow-wrap:anywhere}.out-metric p{margin-top:4px;font-size:10px}.out-block{border:1px solid rgba(180,191,255,.13);border-radius:15px;padding:17px;margin-top:13px;background:rgba(17,21,44,.52)}.out-block h4{margin:0 0 12px;font-size:13px}.out-table-wrap{width:100%;overflow-x:auto}.out-table{width:100%;border-collapse:collapse;min-width:720px;font-size:10px}.out-table th,.out-table td{text-align:left;padding:10px 9px;border-bottom:1px solid rgba(180,191,255,.10);vertical-align:top}.out-table th{color:#8c98bb;text-transform:uppercase;font-size:8px;letter-spacing:.09em}.out-pill{display:inline-block;padding:4px 7px;margin:2px 3px 2px 0;border-radius:20px;border:1px solid transparent;white-space:nowrap;font-size:9px;font-weight:800}.out-empty{border:1px dashed rgba(180,191,255,.22);padding:22px;border-radius:13px;color:#aab5d2;font-size:11px;line-height:1.7}.out-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.out-kv{padding:12px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid rgba(180,191,255,.09);min-width:0;overflow-wrap:anywhere}.out-kv small{color:#8c98bb;display:block;font-size:9px;margin-bottom:5px}.out-kv strong{font-size:11px}.out-preview{white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;background:rgba(4,7,18,.35);border-radius:10px;border:1px solid rgba(180,191,255,.1);padding:14px;color:#cad4ed;font-size:10px;line-height:1.8}.out-count-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.out-count{padding:12px;border-radius:11px;border:1px solid rgba(180,191,255,.11);background:rgba(255,255,255,.025)}.out-count strong{display:block;font-size:18px}.out-count small{font-size:9px;color:#9ba7c8}.out-hint{margin-top:10px!important;padding:10px 12px;border-left:2px solid #85bdf8;background:rgba(122,167,255,.06);border-radius:0 8px 8px 0}.out-bullets{margin:10px 0 0 18px;color:#aab5d2;font-size:11px;line-height:1.8}@media(max-width:750px){.out-metrics,.out-count-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.out-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  document.head.appendChild(style);
}
function resultContainer() {
  let el = document.getElementById("resultsContainer");
  if (!el) {
    const section = document.getElementById("analyze") || document.querySelector("main") || document.body;
    el = document.createElement("div"); el.id = "resultsContainer"; section.appendChild(el);
  }
  addOutputStyles();
  el.replaceChildren();
  return el;
}
function renderError(message) {
  const el = resultContainer();
  el.innerHTML = `<div class="finsight-output"><div class="out-block"><h4>Unable to process this file</h4><p>${escapeHTML(message)}</p><p class="out-hint">Financial analysis requires CSV/XLS/XLSX. PDF/DOCX/PPTX/TXT inspection requires the document-reading route. JPG/JPEG/PNG/WEBP/GIF/BMP use browser-based English-first OCR; scanned PDFs also attempt browser OCR when no selectable text is found.</p></div></div>`;
}

function displayImagePreview(file) {
  const el = resultContainer();
  if (lastImageObjectUrl) URL.revokeObjectURL(lastImageObjectUrl);
  lastImageObjectUrl = URL.createObjectURL(file);
  const sizeKB = (file.size / 1024).toLocaleString("en-US", { maximumFractionDigits: 1 });
  el.innerHTML = `<div class="finsight-output"><div class="out-head"><div><h3>Image preview — ${escapeHTML(file.name)}</h3><p>FinSight will attempt browser-based, English-first OCR to extract visible text. OCR can misread financial values and does not itself create transaction rows or risk results.</p></div><span class="out-badge review">PREVIEW ONLY</span></div><div class="out-block"><p><strong>File:</strong> ${escapeHTML(file.name)} &nbsp; <strong>Size:</strong> ${escapeHTML(sizeKB)} KB &nbsp; <strong>Type:</strong> ${escapeHTML(file.type || fileExtension(file).toUpperCase())}</p><div style="margin-top:16px;display:flex;justify-content:center;background:rgba(4,7,18,.35);padding:16px;border-radius:12px"><img id="finsightImagePreview" alt="Preview of uploaded image" style="display:block;max-width:100%;max-height:620px;object-fit:contain;border-radius:8px" /></div></div><div class="out-block"><h4>What happens next?</h4><p>If this image contains a bank statement or invoice, use a text-based PDF or CSV/XLS/XLSX file for analysis. OCR text is a reading aid only; transaction analysis still requires structured CSV/XLS/XLSX rows.</p></div></div>`;
  const img = el.querySelector("#finsightImagePreview");
  if (img) img.src = lastImageObjectUrl;
}

function duplicateDetails(transactions, api) {
  const rows = Array.isArray(transactions) ? transactions : [];
  const invoiceGroups = new Map();
  rows.forEach((r, i) => {
    const v = String(r && r.invoice_id != null ? r.invoice_id : "").trim().toLowerCase();
    if (v && !["not available","unknown","none","nan","null","-"].includes(v)) {
      if (!invoiceGroups.has(v)) invoiceGroups.set(v, []);
      invoiceGroups.get(v).push(i);
    }
  });
  const duplicateRowIndexes = new Set();
  const duplicateInvoiceRefs = new Set();
  for (const [key, indexes] of invoiceGroups.entries()) {
    if (indexes.length > 1) {
      duplicateInvoiceRefs.add(key);
      indexes.forEach(i => duplicateRowIndexes.add(i));
    }
  }
  // If no usable invoice field repeats, look for exact transaction fingerprints (candidate only).
  const fingerprintGroups = new Map();
  rows.forEach((r, i) => {
    if (duplicateRowIndexes.has(i) || !r || typeof r !== "object") return;
    const date = String(r.date || "").trim().toLowerCase();
    const amount = r.amount === null || r.amount === undefined ? "" : String(Number(r.amount));
    const description = String(r.description || "").trim().toLowerCase().replace(/\s+/g," ");
    if (!date || !amount || !description || ["not available","unknown","nan"].includes(description)) return;
    const key = [date, amount, description].join("|" );
    if (!fingerprintGroups.has(key)) fingerprintGroups.set(key, []);
    fingerprintGroups.get(key).push(i);
  });
  for (const indexes of fingerprintGroups.values()) {
    if (indexes.length > 1) indexes.forEach(i => duplicateRowIndexes.add(i));
  }
  let apiInvoicePatterns = api.duplicate_invoice_patterns;
  if (apiInvoicePatterns === undefined && api.pattern_summary) apiInvoicePatterns = api.pattern_summary.duplicate_invoice_patterns;
  const reported = apiInvoicePatterns === undefined || apiInvoicePatterns === null ? null : Number(apiInvoicePatterns);
  const invoiceCount = Number.isFinite(reported) ? reported : duplicateInvoiceRefs.size;
  return {duplicateRowIndexes, invoiceCount, duplicateRows:duplicateRowIndexes.size, invoiceRefs:[...duplicateInvoiceRefs]};
}
function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function statusLabel(status) {
  const v = String(status || "Normal").toLowerCase();
  if (/high|critical/.test(v)) return {label:"High risk", cls:"high"};
  if (/review|unusual|anomal/.test(v)) return {label:"Unusual / Review", cls:"review"};
  return {label:"Normal", cls:"normal"};
}
function updateHeroDashboard(data) {
  const total = safeNumber(data.transaction_count);
  const anomalies = safeNumber(data.anomaly_count);
  const high = safeNumber(data.high_risk_count);
  const review = safeNumber(data.review_count);
  const normal = safeNumber(data.normal_count);
  // Give the main 3D robot a matching digital expression after actual analysis results return.
  const robotMood = high !== null && high > 0 ? "high" : review !== null && review > 0 ? "review" : "normal";
  window.finSightRobotMood = robotMood;
  if (typeof window.setFinSightRobotMood === "function") window.setFinSightRobotMood(robotMood);
  const visual = document.querySelector(".hero-visual");
  if (!visual) return;
  const cards = visual.querySelectorAll(".metric-card strong");
  if (cards[0]) cards[0].textContent = total === null ? "—" : formatNumber(total);
  if (cards[1]) cards[1].textContent = anomalies === null ? "—" : formatNumber(anomalies);
  const label = high !== null && high > 0 ? "HIGH RISK" : review !== null && review > 0 ? "REVIEW REQUIRED" : "LOW RISK";
  const live = visual.querySelector(".live-status");
  if (live) {
    live.innerHTML = `<span></span>${label}`;
    live.classList.remove("waiting-status");
    live.style.color = high > 0 ? "#ff899a" : review > 0 ? "#ffca72" : "#70dfb7";
    const dot = live.querySelector("span"); if (dot) dot.style.background = "currentColor";
  }
  const title = visual.querySelector(".risk-text strong");
  const subtitle = visual.querySelector(".risk-text span");
  const alert = visual.querySelector(".risk-alert");
  if (title) title.textContent = high > 0 ? `${formatNumber(high)} high-risk record(s) need attention` : review > 0 ? `${formatNumber(review)} record(s) need review` : `${formatNumber(total)} record(s) analyzed; no current risk rule triggered`;
  if (subtitle) subtitle.textContent = "These are rule-based signals from the uploaded file, not proof of fraud.";
  if (alert) alert.classList.remove("waiting-alert");
  const period = visual.querySelector(".period");
  if (period) period.textContent = total === null ? "Analysis complete" : `${formatNumber(total)} records analyzed`;
  const pattern = visual.querySelectorAll(".pattern-summary strong");
  if (pattern[0]) pattern[0].textContent = review === null ? "—" : formatNumber(review);
  if (pattern[1]) pattern[1].textContent = normal === null ? "—" : formatNumber(normal);
  if (pattern[2]) pattern[2].textContent = total === null ? "—" : formatNumber(total);
  const summaryTitle = visual.querySelector(".pattern-title"); if (summaryTitle) summaryTitle.textContent = "Pattern overview · Actual uploaded file";
  const bars = visual.querySelectorAll(".chart-bars i");
  const tx = Array.isArray(data.transactions) ? data.transactions : [];
  const amounts = tx.map(x => safeNumber(x.amount)).filter(x => x !== null && x >= 0);
  const max = Math.max(1, ...amounts);
  bars.forEach((bar,i) => {
    const row = tx.slice(-bars.length)[i];
    if (!row || row.amount === null || row.amount === undefined) { bar.style.height = "0%"; return; }
    bar.style.height = `${Math.max(5,Math.min(92,(Number(row.amount)/max)*92))}%`;
    bar.style.background = /high/i.test(String(row.status || "")) ? "#ff899a" : /review|unusual/i.test(String(row.status || "")) ? "#ffca72" : "#70dfb7";
  });
  const chart = visual.querySelector(".chart-bars"); if (chart) chart.classList.remove("empty-chart");
}

function displayFinancialResults(data, fileName, recordType) {
  const el = resultContainer();
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const anomalies = Array.isArray(data.anomalies) ? data.anomalies : [];
  const mappings = data.column_mapping && typeof data.column_mapping === "object" ? data.column_mapping : {};
  const dup = duplicateDetails(transactions, data);
  const total = safeNumber(data.transaction_count) ?? transactions.length;
  const amountMapped = Boolean(mappings.amount || mappings.debit || mappings.credit);
  const amountTotal = amountMapped ? formatNumber(data.total_amount,2) : "Not available";
  const amountAverage = amountMapped ? formatNumber(data.average_amount,2) : "Not available";
  const high = safeNumber(data.high_risk_count) ?? transactions.filter(r => /high/i.test(String(r.status || ""))).length;
  const review = safeNumber(data.review_count) ?? transactions.filter(r => /review|unusual|anomal/i.test(String(r.status || ""))).length;
  const normal = safeNumber(data.normal_count) ?? transactions.filter(r => !/high|review|unusual|anomal/i.test(String(r.status || ""))).length;
  const anomalyCount = safeNumber(data.anomaly_count);
  const overall = high > 0 ? {label:"HIGH RISK",cls:"high"} : review > 0 ? {label:"REVIEW REQUIRED",cls:"review"} : {label:"NO CURRENT RISK RULE TRIGGERED",cls:"normal"};
  const rows = transactions.slice(0,300).map((row,index) => {
    const base = statusLabel(row.status);
    const badges = [`<span class="out-pill status-${base.cls}">${base.label}</span>`];
    if (dup.duplicateRowIndexes.has(index)) badges.push('<span class="out-pill status-duplicate">Duplicate candidate</span>');
    if (row.is_anomaly) badges.push('<span class="out-pill status-review">Unusual amount</span>');
    return `<tr><td>${escapeHTML(row.transaction_id || `Row ${index+1}`)}</td><td>${escapeHTML(row.date || "—")}</td><td>${row.amount === null || row.amount === undefined ? "Not available" : formatNumber(row.amount,2)}</td><td>${badges.join(" ")}</td><td>${escapeHTML(row.invoice_id || "—")}</td><td>${escapeHTML(row.description || "—")}</td></tr>`;
  }).join("");
  const anomalyCards = anomalies.length ? anomalies.slice(0,60).map((a,i) => `<div class="out-kv"><small>Finding ${i+1} · ${escapeHTML(a.risk_level || "Review")}</small><strong>${escapeHTML(a.transaction_id || "Transaction")}</strong><p style="margin-top:6px">Amount: ${a.amount === undefined ? "Not reported" : formatNumber(a.amount,2)}</p><p style="margin-top:6px">${escapeHTML(a.explanation || a.reason || "Check this record against source documents.")}</p></div>`).join("") : `<div class="out-empty">No unusual-amount findings were returned by the current analysis rules. This does not guarantee that every transaction is error-free.</div>`;
  const mappingItems = Object.entries(mappings).map(([k,v]) => `<div class="out-kv"><small>${escapeHTML(k.replaceAll("_"," "))}</small><strong>${v === null || v === undefined ? "Not mapped" : escapeHTML(v)}</strong></div>`).join("");
  el.innerHTML = `<div class="finsight-output">
    <div class="export-actions" aria-label="Download analysis report"><strong>Download results:</strong><button type="button" class="btn btn-ghost" data-export-format="pdf">PDF report</button><button type="button" class="btn btn-ghost" data-export-format="xlsx">Excel (.xlsx)</button><button type="button" class="btn btn-ghost" data-export-format="csv">CSV</button><button type="button" class="btn btn-ghost" data-export-format="txt">Text (.txt)</button></div>
    <div class="out-head"><div><h3>Analysis results — ${escapeHTML(fileName)}</h3><p>${escapeHTML(RECORD_TYPE_LABELS[recordType] || recordType)} · returned by FinSight AI backend. Check counts and mapped columns before relying on these findings.</p></div><span class="out-badge ${overall.cls}">${overall.label}</span></div>
    <div class="out-metrics">
      <div class="out-metric"><small>Total transaction rows</small><strong>${formatNumber(total)}</strong><p>Rows reported as analyzed</p></div>
      <div class="out-metric"><small>Total amount</small><strong>${amountTotal}</strong><p>${amountMapped ? "Sum of recognized amount values" : "No amount/debit/credit field recognized"}</p></div>
      <div class="out-metric"><small>Average amount</small><strong>${amountAverage}</strong><p>Average of recognized amount values</p></div>
      <div class="out-metric"><small>Unusual amount signals</small><strong>${anomalyCount === null ? "Not reported" : formatNumber(anomalyCount)}</strong><p>These are rule-based candidates for review</p></div>
    </div>
    <div class="out-block"><h4>Color-coded results</h4><div class="out-count-grid"><div class="out-count"><strong style="color:#70dfb7">${formatNumber(normal)}</strong><small>Green · Normal records</small></div><div class="out-count"><strong style="color:#ffca72">${formatNumber(review)}</strong><small>Amber · Review / unusual</small></div><div class="out-count"><strong style="color:#ff899a">${formatNumber(high)}</strong><small>Red · High risk</small></div><div class="out-count"><strong style="color:#c7a8ff">${formatNumber(dup.duplicateRows)}</strong><small>Purple · Duplicate candidate rows</small></div></div><p class="out-hint">Duplicate invoice references reported by API: <strong>${data.duplicate_invoice_patterns === undefined ? "Not reported" : formatNumber(data.duplicate_invoice_patterns)}</strong>. The purple row markers also look for repeated invoice IDs or exact date+amount+description matches in returned transaction rows; verify these candidates manually. Counts in separate categories may overlap when a record has more than one signal.</p></div>
    <div class="out-block"><h4>What was mapped from your file?</h4>${mappingItems ? `<div class="out-grid">${mappingItems}</div>` : `<div class="out-empty">The API did not return column-mapping information.</div>`}</div>
    <div class="out-block"><h4>Transaction-level results (${formatNumber(transactions.length)} rows returned${transactions.length > 300 ? "; showing first 300" : ""})</h4>${rows ? `<div class="out-table-wrap"><table class="out-table"><thead><tr><th>Transaction ID</th><th>Date</th><th>Amount</th><th>Status / flags</th><th>Invoice</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="out-empty">The API returned summary values but no transaction-level rows.</div>`}</div>
    <div class="out-block"><h4>Unusual transaction explanations</h4>${anomalyCards}</div>
    <div class="out-block"><h4>What this analysis does — and does not — mean</h4><p>FinSight counts returned rows, summarizes recognized money columns, compares amounts against a simple statistical threshold, and reports repeat invoice patterns if invoice IDs are available. It does not automatically prove fraud, determine whether an expense is legitimate, or detect every possible duplicate. A bank statement without invoice IDs may need a transaction-reference/date/amount duplicate rule tailored to that format.</p></div>
  </div>`;
  lastExportPayload = { kind: "financial", fileName: fileName || "financial-analysis", data, recordType: recordType || "Financial analysis" };
}
function displayDocumentResults(data) {
  const el = resultContainer();
  const text = String(data.text_preview || data.extracted_text || "").trim();
  const stats = data.statistics && typeof data.statistics === "object" ? data.statistics : {};
  const file = data.filename || (selectedFile && selectedFile.name) || "Document";
  const kind = data.detected_document_type || data.document_type || "Not identified";
  const countCards = Object.entries(stats).map(([k,v]) => `<div class="out-kv"><small>${escapeHTML(k.replaceAll("_"," "))}</small><strong>${escapeHTML(v)}</strong></div>`).join("");
  const notes = Array.isArray(data.notes) ? data.notes : (data.note ? [data.note] : []);
  const hasImagePreview = Boolean(data.source_preview_url);
  const isImageResult = IMAGE_EXTENSIONS.has(String(data.file_type || "").toLowerCase());
  const countValue = isImageResult ? (data.image_count ?? stats.image_count ?? 1) : (data.page_count ?? data.slide_count ?? data.paragraph_count ?? "");
  const countLabel = isImageResult ? "Images" : "Pages / slides / paragraphs";
  const detectedAmounts = Array.isArray(data.detected_amounts) ? data.detected_amounts : [];
  const processing = String(data.processing_note || "Readable-text extraction only; no transaction-level financial analysis was run.");
  el.innerHTML = `<div class="finsight-output">
    <div class="export-actions" aria-label="Download extracted document results"><strong>Download results:</strong><button type="button" class="btn btn-ghost" data-export-format="pdf">PDF report</button><button type="button" class="btn btn-ghost" data-export-format="xlsx">Excel (.xlsx)</button><button type="button" class="btn btn-ghost" data-export-format="csv">CSV</button><button type="button" class="btn btn-ghost" data-export-format="txt">Text (.txt)</button></div>
    <div class="out-head"><div><h3>File inspection — ${escapeHTML(file)}</h3><p>${escapeHTML(processing)}</p></div><span class="out-badge review">DOCUMENT / OCR REVIEW</span></div>
    <div class="out-metrics">
      <div class="out-metric"><small>Estimated file type</small><strong>${escapeHTML(kind)}</strong><p>Rule-based label, verify original</p></div>
      <div class="out-metric"><small>Words extracted</small><strong>${formatNumber(data.word_count ?? stats.word_count)}</strong><p>Based on readable text</p></div>
      <div class="out-metric"><small>Characters extracted</small><strong>${formatNumber(data.character_count ?? stats.character_count)}</strong><p>Text available for inspection</p></div>
      <div class="out-metric"><small>${escapeHTML(countLabel)}</small><strong>${formatNumber(countValue)}</strong><p>${isImageResult ? "Uploaded image count" : "Depends on file type"}</p></div>
    </div>
    ${countCards ? `<div class="out-block"><h4>File details</h4><div class="out-grid">${countCards}</div></div>` : ""}
    ${isImageResult ? `<div class="out-block"><h4>Possible amounts detected (OCR)</h4>${detectedAmounts.length ? `<p class="out-hint">These are possible amount-like values found in the extracted text. Please verify every value against the original image.</p><div class="out-grid">${detectedAmounts.map((amount, i) => `<div class="out-kv"><small>Candidate ${i + 1}</small><strong>${escapeHTML(amount)}</strong></div>`).join("")}</div>` : `<div class="out-empty">No obvious amount format was detected in the OCR text. The amount may be blurry, handwritten, or written in an unsupported format.</div>`}</div>` : ""}
    ${hasImagePreview ? `<div class="out-block"><h4>Original image preview</h4><img id="finsightOcrSourcePreview" alt="Uploaded image for OCR review" style="display:block;max-width:100%;max-height:560px;object-fit:contain;margin:auto;border-radius:10px" /></div>` : ""}
    <div class="out-block"><h4>What was done?</h4><p>${escapeHTML(data.explanation || "FinSight extracted readable text for you to inspect.")}</p>${notes.map(n=>`<p class="out-hint">${escapeHTML(n)}</p>`).join("")}</div>
    <div class="out-block"><h4>Extracted text preview</h4>${text ? `<div class="out-preview">${escapeHTML(text)}${data.text_truncated ? "\n\n[Preview shortened. Not all extracted text is shown.]" : ""}</div><button type="button" class="btn btn-ghost" id="downloadExtractedTextButton" style="margin-top:12px">Download extracted text (.txt)</button>` : `<div class="out-empty">No readable text was extracted. Check the notes above. This could be an image-only file, low-quality scan or an unsupported language/layout.</div>`}</div>
    <div class="out-block"><h4>Need transaction and risk analysis?</h4><p>CSV/XLS/XLSX files can run the Phase 1 transaction analyser. OCR/document text is not automatically converted to structured transaction rows because column/amount recognition can be unreliable. For reliable duplicate and risk checks, use a structured spreadsheet or review and structure the extracted text first.</p></div>
  </div>`;
  // Save the document/OCR payload for the four report-download buttons.
  // Without this assignment, document downloads fail even though the buttons render.
  lastExportPayload = {
    kind: "document",
    fileName: file,
    data,
    text,
    detectedAmounts,
    kindLabel: kind
  };
  if (hasImagePreview) {
    const img = el.querySelector("#finsightOcrSourcePreview");
    if (img) img.src = data.source_preview_url;
  }
  
const downloadButton = el.querySelector("#downloadExtractedTextButton");

if (downloadButton) {
  downloadButton.textContent = "Choose Download Format";

  downloadButton.addEventListener("click", () => {
    const choice = window.prompt(
      "Choose download format:\n" +
      "1 = PDF\n" +
      "2 = TXT\n" +
      "3 = Excel (.xlsx)\n" +
      "4 = CSV\n\n" +
      "Enter 1, 2, 3, or 4:"
    );

    const formats = {
      "1": "pdf",
      "2": "txt",
      "3": "xlsx",
      "4": "csv"
    };

    const format = formats[(choice || "").trim()];

    if (!format) {
      if (choice !== null) {
        setStatus("Invalid choice. Please enter 1, 2, 3, or 4.", "error");
      }
      return;
    }

    if (format === "txt") {
      const blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        `${file.replace(/\.[^.]+$/, "") || "extracted-text"}_extracted.txt`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    downloadReport(format);
  });
  lastExportPayload = { kind: "document", fileName: file, data, text, detectedAmounts, kindLabel: kind };
}
}

function exportSafeName(name) {
  return String(name || "finsight-report").replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "finsight-report";
}
function exportRows(payload) {
  const data = payload && payload.data ? payload.data : {};
  if (payload.kind === "financial") {
    const tx = Array.isArray(data.transactions) ? data.transactions : [];
    return tx.length ? tx.map((r, i) => ({
      transaction_id: r.transaction_id ?? r.id ?? `Row ${i + 1}`,
      date: r.date ?? "",
      amount: r.amount ?? "",
      status: r.status ?? "",
      invoice_id: r.invoice_id ?? "",
      description: r.description ?? r.narration ?? r.details ?? "",
      duplicate_candidate: Boolean(r.is_duplicate),
      unusual_amount: Boolean(r.is_anomaly)
    })) : [{ metric: "Transaction count", value: data.transaction_count ?? 0 }, { metric: "Total amount", value: data.total_amount ?? "Not available" }, { metric: "Average amount", value: data.average_amount ?? "Not available" }, { metric: "High risk count", value: data.high_risk_count ?? 0 }, { metric: "Review count", value: data.review_count ?? 0 }];
  }
  const amounts = Array.isArray(payload.detectedAmounts) ? payload.detectedAmounts : [];
  return amounts.length ? amounts.map((amount, i) => ({ item: i + 1, possible_amount: amount, verification: "Verify against original file" })) : [{ item: 1, extracted_text: payload.text || "No readable text extracted" }];
}
function exportReportText(payload) {
  const data = payload.data || {};
  const lines = ["FinSight AI — Downloadable Results", `File: ${payload.fileName || "Unknown file"}`, `Generated: ${new Date().toLocaleString()}`, `Workflow: ${payload.kind === "financial" ? "Financial analysis" : "Document / image text extraction"}`, ""];
  if (payload.kind === "financial") {
    lines.push(`Transaction count: ${data.transaction_count ?? (Array.isArray(data.transactions) ? data.transactions.length : "Not reported")}`);
    lines.push(`Total amount: ${data.total_amount ?? "Not available"}`);
    lines.push(`Average amount: ${data.average_amount ?? "Not available"}`);
    lines.push(`High risk count: ${data.high_risk_count ?? "Not reported"}`);
    lines.push(`Review count: ${data.review_count ?? "Not reported"}`, "", "Transaction rows:");
    const rows = exportRows(payload);
    rows.forEach((r, i) => lines.push(`${i+1}. ${Object.entries(r).map(([k,v])=>`${k}: ${v}`).join(" | ")}`));
    lines.push("", "Note: Flags are review indicators, not proof of fraud or wrongdoing.");
  } else {
    lines.push(`Detected document type: ${payload.kindLabel || data.detected_document_type || "Not identified"}`);
    lines.push(`Pages / slides / paragraphs / images: ${data.image_count ?? data.page_count ?? data.slide_count ?? data.paragraph_count ?? "Not reported"}`);
    lines.push("Possible amounts (verify manually):", ...(payload.detectedAmounts || []).map(a=>`- ${a}`), "", "Extracted text:", payload.text || "No readable text was extracted.", "", "Note: OCR may misread digits. Verify values against the original file.");
  }
  return lines.join("\n");
}
function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadFirstAvailableLibrary(urls, globalName) {
  if (window[globalName]) return window[globalName];
  let lastError = null;
  for (const url of urls) {
    try { return await loadBrowserLibrary(url, globalName); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error(`${globalName} could not be loaded.`);
}
async function downloadReport(format) {
  const payload = lastExportPayload;
  if (!payload) { setStatus("Run an analysis or document inspection before downloading results.", "error"); return; }
  const base = exportSafeName(payload.fileName);
  const rows = exportRows(payload);
  if (format === "txt") { downloadBlob(exportReportText(payload), "text/plain;charset=utf-8", `${base}_finsight_report.txt`); return; }
  if (format === "csv") {
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map(cell).join(","), ...rows.map(r => cols.map(k => cell(r[k])).join(","))].join("\r\n");
    downloadBlob("\uFEFF" + csv, "text/csv;charset=utf-8", `${base}_finsight_results.csv`); return;
  }
  if (format === "xlsx") {
    let XLSX = window.XLSX;
    if (!XLSX) {
      setStatus("Loading Excel export…");
      try {
        XLSX = await loadFirstAvailableLibrary([
          "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
          "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"
        ], "XLSX");
      } catch (_) {
        setStatus("Excel export could not load. Please check internet access, or download CSV instead.", "error");
        return;
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), payload.kind === "financial" ? "Transactions" : "Extracted Results");
    const summary = payload.kind === "financial" ? [
      { Metric: "Source file", Value: payload.fileName }, { Metric: "Transaction count", Value: payload.data.transaction_count ?? rows.length },
      { Metric: "Total amount", Value: payload.data.total_amount ?? "Not available" }, { Metric: "Average amount", Value: payload.data.average_amount ?? "Not available" },
      { Metric: "High risk count", Value: payload.data.high_risk_count ?? "Not reported" }, { Metric: "Review count", Value: payload.data.review_count ?? "Not reported" }
    ] : [{ Metric: "Source file", Value: payload.fileName }, { Metric: "Workflow", Value: "Document / image text extraction" }, { Metric: "Extracted characters", Value: (payload.text || "").length }, { Metric: "Possible amounts", Value: (payload.detectedAmounts || []).join(" | ") }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.writeFile(wb, `${base}_finsight_results.xlsx`); return;
  }
  if (format === "pdf") {
    let JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) {
      setStatus("Loading PDF report generator…");
      try {
        const jspdf = await loadFirstAvailableLibrary([
          "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
          "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js"
        ], "jspdf");
        JsPDF = jspdf.jsPDF;
      } catch (_) {
        setStatus("PDF export could not load. Please check internet access; CSV and TXT exports do not need the PDF library.", "error");
        return;
      }
    }
    const pdf = new JsPDF({ unit: "pt", format: "a4" });
    const margin = 42, width = pdf.internal.pageSize.getWidth() - margin * 2;
    let y = 48;
    const write = (line, size=10, gap=14) => {
      pdf.setFontSize(size);
      const chunks = pdf.splitTextToSize(String(line), width);
      for (const chunk of chunks) { if (y > pdf.internal.pageSize.getHeight() - 42) { pdf.addPage(); y = 48; } pdf.text(chunk, margin, y); y += gap; }
    };
    write("FinSight AI — Results Report", 16, 22); write(`File: ${payload.fileName || "Unknown file"}`, 10); write(`Generated: ${new Date().toLocaleString()}`, 9); write(`Workflow: ${payload.kind === "financial" ? "Financial analysis" : "Document / image text extraction"}`, 9, 18);
    if (payload.kind === "financial") {
      write(`Transaction count: ${payload.data.transaction_count ?? rows.length}`); write(`Total amount: ${payload.data.total_amount ?? "Not available"}`); write(`Average amount: ${payload.data.average_amount ?? "Not available"}`); write(`High risk count: ${payload.data.high_risk_count ?? "Not reported"}`); write(`Review count: ${payload.data.review_count ?? "Not reported"}`, 10, 18);
      write("Transaction rows", 12, 18); rows.slice(0, 250).forEach((r,i)=>write(`${i+1}. ${Object.entries(r).map(([k,v])=>`${k}: ${v}`).join(" | ")}`, 8, 11));
      if (rows.length > 250) write(`PDF limited to first 250 rows; export Excel/CSV for all returned rows.`, 9, 14);
      write("Review indicators are not proof of fraud or wrongdoing.", 9, 14);
    } else {
      write(`Detected document type: ${payload.kindLabel || "Not identified"}`); write(`Possible amounts: ${(payload.detectedAmounts || []).join(", ") || "None detected"}`, 10, 16); write("Extracted text", 12, 18); write(payload.text || "No readable text was extracted.", 9, 12); write("OCR may misread digits. Verify all values against the original file.", 9, 14);
    }
    pdf.save(`${base}_finsight_report.pdf`);
  }
}
function initResultExports() {
  const container = document.getElementById("resultsContainer");
  if (!container || container.dataset.exportsBound === "true") return;
  container.dataset.exportsBound = "true";
  container.addEventListener("click", event => {
    const button = event.target.closest("[data-export-format]");
    if (button) downloadReport(button.dataset.exportFormat);
  });
}

function initFeedbackForm() {
  const form = document.getElementById("feedbackForm");
  const status = document.getElementById("feedbackStatus");
  const button = document.getElementById("feedbackSubmit");
  if (!form || !status || form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      contact_email: String(formData.get("contact_email") || "").trim(),
      category: String(formData.get("category") || "General feedback"),
      rating: Number(formData.get("rating") || 3),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "")
    };
    if (payload.message.length < 8) {
      status.className = "feedback-status error";
      status.textContent = "Please enter at least 8 characters so we can understand your feedback.";
      return;
    }

    status.className = "feedback-status";
    status.textContent = "Sending feedback securely…";
    if (button) { button.disabled = true; button.textContent = "Sending…"; }
    try {
      const response = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      let result = {};
      try { result = await response.json(); } catch (_) { /* non-JSON API response */ }
      if (!response.ok || result.success === false) {
        throw new Error(result.detail || result.error || `Feedback service returned ${response.status}.`);
      }
      status.className = "feedback-status success";
      status.textContent = result.message || "Thank you. Your feedback was received.";
      form.reset();
    } catch (error) {
      console.error("FinSight feedback error:", error);
      status.className = "feedback-status error";
      status.textContent = "Feedback could not be sent because the feedback service is not available. Please try again later.";
    } finally {
      if (button) { button.disabled = false; button.textContent = "Send feedback ↗"; }
    }
  });
}

// Global file-picker helpers are intentionally exposed for the page buttons.
window.showSelectedFile = showSelectedFile;
function initializeFinSightPage() {
  initUpload();
  initFeedbackForm();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeFinSightPage, { once: true });
} else {
  initializeFinSightPage();
}


if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initResultExports); else initResultExports();
