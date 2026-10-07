const API_URL = "https://finsight-ai.fastapicloud.dev";

const fileInput = document.getElementById("fileInput");
const uploadArea = document.querySelector(".upload-area");
const fileNameDisplay = document.querySelector(".file-name");
const analyzeButton = document.querySelector(".analyze-button");
const resultsContainer = document.querySelector(".results-container");

let selectedFile = null;


// ======================================================
// FILE SELECTION
// ======================================================

if (fileInput) {
    fileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];

        if (!file) return;

        selectedFile = file;
        showSelectedFile(file);
    });
}


// ======================================================
// DRAG & DROP
// ======================================================

if (uploadArea) {

    uploadArea.addEventListener("dragover", function (event) {
        event.preventDefault();
        uploadArea.classList.add("drag-over");
    });

    uploadArea.addEventListener("dragleave", function () {
        uploadArea.classList.remove("drag-over");
    });

    uploadArea.addEventListener("drop", function (event) {
        event.preventDefault();
        uploadArea.classList.remove("drag-over");

        const file = event.dataTransfer.files[0];

        if (!file) return;

        selectedFile = file;
        showSelectedFile(file);
    });
}


// ======================================================
// SHOW SELECTED FILE
// ======================================================

function showSelectedFile(file) {

    if (fileNameDisplay) {
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.style.display = "block";
    }

    if (uploadArea) {
        uploadArea.classList.add("file-selected");
    }

    console.log("Selected file:", file.name);
}


// ======================================================
// START ANALYSIS
// ======================================================

async function analyzeFile() {

    if (!selectedFile && fileInput && fileInput.files.length > 0) {
        selectedFile = fileInput.files[0];
    }

    if (!selectedFile) {
        alert("Please select an Excel or CSV file first.");
        return;
    }

    console.log("Starting FinSight analysis...");
    console.log("File:", selectedFile.name);

    if (analyzeButton) {
        analyzeButton.disabled = true;
        analyzeButton.textContent = "Analyzing...";
    }

    const dataTypeElement = document.getElementById("dataType");

    const dataType = dataTypeElement
        ? dataTypeElement.value
        : "bank_statement";

    const formData = new FormData();

    formData.append("file", selectedFile);
    formData.append("data_type", dataType);

    try {

        const response = await fetch(`${API_URL}/analyze`, {
            method: "POST",
            body: formData
        });

        console.log("API status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API error:", errorText);
            throw new Error("Analysis failed.");
        }

        const data = await response.json();

        console.log("FinSight analysis response:", data);

        displayResults(data);

    } catch (error) {

        console.error("FinSight analysis error:", error);

        alert(
            "Unable to analyze the file. Please check the file and try again."
        );

    } finally {

        if (analyzeButton) {
            analyzeButton.disabled = false;
            analyzeButton.textContent = "Start Analysis";
        }
    }
}


// ======================================================
// DISPLAY RESULTS
// ======================================================

function displayResults(data) {

    if (!resultsContainer) {
        console.error("Results container not found.");
        return;
    }

    const transactionCount = Number(data.transaction_count || 0);
    const totalAmount = Number(data.total_amount || 0);
    const averageAmount = Number(data.average_amount || 0);

    const anomalyCount = Number(data.anomaly_count || 0);
    const highRiskCount = Number(data.high_risk_count || 0);
    const reviewCount = Number(data.review_count || 0);

    const normalCount = Math.max(
        transactionCount - anomalyCount,
        0
    );

    let riskStatus = "LOW RISK";
    let riskClass = "risk-low";

    if (highRiskCount > 0) {
        riskStatus = "HIGH RISK";
        riskClass = "risk-high";
    } else if (anomalyCount > 0 || reviewCount > 0) {
        riskStatus = "REVIEW REQUIRED";
        riskClass = "risk-review";
    }


    // ==================================================
    // RISK OVERVIEW
    // ==================================================

    let html = `

        <section class="risk-overview">

            <div class="risk-overview-header">

                <div>
                    <span class="section-label">RISK OVERVIEW</span>
                    <h2>Analysis Complete</h2>
                </div>

                <div class="risk-status ${riskClass}">
                    ${riskStatus}
                </div>

            </div>


            <div class="risk-summary-grid">

                <div class="risk-summary-card">

                    <span class="risk-card-label">
                        TRANSACTIONS
                    </span>

                    <strong>
                        ${transactionCount}
                    </strong>

                    <small>
                        Records analyzed
                    </small>

                </div>


                <div class="risk-summary-card">

                    <span class="risk-card-label">
                        RISK SIGNALS
                    </span>

                    <strong>
                        ${anomalyCount}
                    </strong>

                    <small>
                        Require review
                    </small>

                </div>


                <div class="risk-summary-card">

                    <span class="risk-card-label">
                        TOTAL AMOUNT
                    </span>

                    <strong>
                        ${formatNumber(totalAmount)}
                    </strong>

                    <small>
                        Total transaction value
                    </small>

                </div>


                <div class="risk-summary-card">

                    <span class="risk-card-label">
                        AVERAGE
                    </span>

                    <strong>
                        ${formatNumber(averageAmount)}
                    </strong>

                    <small>
                        Average transaction
                    </small>

                </div>

            </div>


            <div class="transaction-activity">

                <div class="activity-header">

                    <div>
                        <span class="section-label">
                            TRANSACTION ACTIVITY
                        </span>

                        <h3>Pattern Analysis</h3>
                    </div>

                </div>


                <div class="pattern-chart">

                    ${buildPatternBars(data)}

                </div>


                <div class="pattern-counts">

                    <div class="pattern-count unusual">

                        <strong>${anomalyCount}</strong>

                        <span>Unusual</span>

                    </div>


                    <div class="pattern-count normal">

                        <strong>${normalCount}</strong>

                        <span>Normal</span>

                    </div>


                    <div class="pattern-count total">

                        <strong>${transactionCount}</strong>

                        <span>Total</span>

                    </div>

                </div>

            </div>

        </section>


        <section class="analysis-report">

            <div class="report-header">

                <div>

                    <span class="section-label">
                        FINANCIAL INTELLIGENCE REPORT
                    </span>

                    <h2>Analysis Results</h2>

                </div>

            </div>


            <div class="analysis-summary">

                <div>
                    <span>File</span>
                    <strong>${escapeHtml(data.filename || selectedFile.name)}</strong>
                </div>

                <div>
                    <span>Record Type</span>
                    <strong>${escapeHtml(data.record_type || "Financial Records")}</strong>
                </div>

                <div>
                    <span>Status</span>
                    <strong class="${riskClass}">
                        ${riskStatus}
                    </strong>
                </div>

            </div>


            ${buildDetectionCards(
                anomalyCount,
                highRiskCount,
                reviewCount,
                normalCount
            )}


            ${buildColumnMapping(data.column_mapping)}


            ${buildAnomalies(data.anomalies)}

        </section>


        <button
            class="analyze-another-button"
            onclick="resetAnalysis()"
        >
            Analyze Another File
        </button>

    `;


    resultsContainer.innerHTML = html;

    resultsContainer.style.display = "block";

    resultsContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ======================================================
// PATTERN ANALYZER
// ======================================================

function buildPatternBars(data) {

    const transactionCount = Number(data.transaction_count || 0);
    const anomalyCount = Number(data.anomaly_count || 0);

    if (transactionCount === 0) {
        return `
            <div class="no-pattern-data">
                No transaction data available
            </div>
        `;
    }


    const anomalies = Array.isArray(data.anomalies)
        ? data.anomalies
        : [];


    const bars = [];

    for (let i = 0; i < transactionCount; i++) {

        const anomaly = anomalies.find(
            item => Number(item.index) === i
        );

        if (anomaly) {

            bars.push(`
                <div
                    class="pattern-bar anomaly-bar"
                    style="height:85%;"
                    title="Unusual transaction"
                ></div>
            `);

        } else {

            const heights = [32, 42, 48, 38, 55, 45, 52];

            const height =
                heights[i % heights.length];

            bars.push(`
                <div
                    class="pattern-bar normal-bar"
                    style="height:${height}%;"
                    title="Normal transaction"
                ></div>
            `);
        }
    }


    return `
        <div class="pattern-bars">
            ${bars.join("")}
        </div>
    `;
}


// ======================================================
// DETECTION CARDS
// ======================================================

function buildDetectionCards(
    anomalyCount,
    highRiskCount,
    reviewCount,
    normalCount
) {

    return `

        <div class="detection-grid">

            <div class="detection-card high-risk">

                <span>HIGH RISK</span>

                <strong>
                    ${highRiskCount}
                </strong>

                <small>
                    Immediate attention
                </small>

            </div>


            <div class="detection-card review-risk">

                <span>REVIEW</span>

                <strong>
                    ${reviewCount}
                </strong>

                <small>
                    Requires review
                </small>

            </div>


            <div class="detection-card normal-risk">

                <span>NORMAL</span>

                <strong>
                    ${normalCount}
                </strong>

                <small>
                    No major signal
                </small>

            </div>

        </div>

    `;
}


// ======================================================
// COLUMN MAPPING
// ======================================================

function buildColumnMapping(mapping) {

    if (!mapping) return "";

    let rows = "";

    Object.entries(mapping).forEach(([key, value]) => {

        rows += `

            <div class="mapping-row">

                <span>
                    ${escapeHtml(formatLabel(key))}
                </span>

                <strong>
                    ${escapeHtml(value || "Not detected")}
                </strong>

            </div>

        `;
    });


    return `

        <div class="column-mapping">

            <div class="mapping-header">

                <span class="section-label">
                    COLUMN MAPPING
                </span>

                <h3>Detected Financial Fields</h3>

            </div>

            <div class="mapping-list">
                ${rows}
            </div>

        </div>

    `;
}


// ======================================================
// ANOMALIES
// ======================================================

function buildAnomalies(anomalies) {

    if (!Array.isArray(anomalies) || anomalies.length === 0) {

        return `

            <div class="no-anomalies">

                <strong>
                    No unusual transactions detected
                </strong>

                <span>
                    The uploaded records did not trigger
                    the current anomaly rules.
                </span>

            </div>

        `;
    }


    let cards = "";


    anomalies.forEach((item, index) => {

        const amount = Number(
            item.amount || 0
        );

        const riskScore = Number(
            item.risk_score || 0
        );

        const riskLevel =
            item.risk_level ||
            (riskScore >= 60
                ? "High Review"
                : "Review");


        cards += `

            <div class="anomaly-card">

                <div class="anomaly-top">

                    <div>

                        <span class="anomaly-label">
                            UNUSUAL TRANSACTION
                        </span>

                        <h3>
                            ${escapeHtml(
                                item.transaction_id ||
                                `Transaction ${index + 1}`
                            )}
                        </h3>

                    </div>

                    <div class="risk-score ${getRiskClass(riskScore)}">

                        <strong>
                            ${riskScore}
                        </strong>

                        <span>
                            Risk Score
                        </span>

                    </div>

                </div>


                <div class="anomaly-details">

                    <div>
                        <span>Amount</span>
                        <strong>
                            ${formatNumber(amount)}
                        </strong>
                    </div>

                    <div>
                        <span>Risk Level</span>
                        <strong>
                            ${escapeHtml(riskLevel)}
                        </strong>
                    </div>

                    <div>
                        <span>Invoice</span>
                        <strong>
                            ${escapeHtml(item.invoice_id || "—")}
                        </strong>
                    </div>

                    <div>
                        <span>Supplier</span>
                        <strong>
                            ${escapeHtml(item.supplier_id || "—")}
                        </strong>
                    </div>

                    <div>
                        <span>Category</span>
                        <strong>
                            ${escapeHtml(item.category || "—")}
                        </strong>
                    </div>

                    <div>
                        <span>Payment</span>
                        <strong>
                            ${escapeHtml(item.payment_method || "—")}
                        </strong>
                    </div>

                </div>


                <div class="anomaly-explanation">

                    ${escapeHtml(
                        item.explanation ||
                        "This transaction requires review."
                    )}

                </div>

            </div>

        `;
    });


    return `

        <div class="anomalies-section">

            <div class="anomalies-header">

                <span class="section-label">
                    RISK DETECTION
                </span>

                <h3>
                    Unusual Transactions
                </h3>

            </div>

            ${cards}

        </div>

    `;
}


// ======================================================
// RESET
// ======================================================

function resetAnalysis() {

    selectedFile = null;

    if (fileInput) {
        fileInput.value = "";
    }

    if (fileNameDisplay) {
        fileNameDisplay.textContent = "";
        fileNameDisplay.style.display = "none";
    }

    if (uploadArea) {
        uploadArea.classList.remove("file-selected");
    }

    if (resultsContainer) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
    }

    scrollToUpload();
}


// ======================================================
// SCROLL TO UPLOAD
// ======================================================

function scrollToUpload() {

    const uploadSection =
        document.querySelector(".upload-section") ||
        document.querySelector(".upload-area") ||
        document.getElementById("fileInput");

    if (uploadSection) {

        uploadSection.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    }
}


// ======================================================
// HELPERS
// ======================================================

function formatNumber(number) {

    return Number(number || 0).toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 2
        }
    );
}


function formatLabel(value) {

    return String(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );
}


function getRiskClass(score) {

    if (score >= 60) {
        return "risk-score-high";
    }

    if (score >= 30) {
        return "risk-score-review";
    }

    return "risk-score-low";
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ======================================================
// MAKE FUNCTIONS AVAILABLE TO HTML onclick
// ======================================================

window.analyzeFile = analyzeFile;
window.resetAnalysis = resetAnalysis;
window.scrollToUpload = scrollToUpload;