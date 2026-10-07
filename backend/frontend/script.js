const API_URL = "https://finsight-ai.fastapicloud.dev";

let selectedFile = null;


/* =========================================
   BASIC HELPERS
========================================= */

function formatNumber(value) {

    const number = Number(value || 0);

    return number.toLocaleString("en-US", {
        maximumFractionDigits: 2
    });
}


function formatAmount(value) {

    const number = Number(value || 0);

    return number.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================
   SCROLL FUNCTIONS
========================================= */

function scrollToUpload() {

    const uploadSection =
        document.getElementById("upload");

    if (uploadSection) {

        uploadSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

}


function scrollToHowItWorks() {

    const section =
        document.getElementById("how-it-works");

    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

}


/* =========================================
   FILE INPUT
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const fileInput =
            document.getElementById("fileInput");

        const uploadBox =
            document.getElementById("uploadBox");


        if (!fileInput) {
            return;
        }


        fileInput.addEventListener(
            "change",
            function () {

                if (this.files && this.files.length > 0) {

                    selectedFile =
                        this.files[0];

                    showSelectedFile(
                        selectedFile
                    );

                }

            }
        );


        /* =====================================
           DRAG & DROP
        ===================================== */

        if (uploadBox) {

            uploadBox.addEventListener(
                "dragover",
                function (event) {

                    event.preventDefault();

                    uploadBox.classList.add(
                        "drag-active"
                    );

                }
            );


            uploadBox.addEventListener(
                "dragleave",
                function () {

                    uploadBox.classList.remove(
                        "drag-active"
                    );

                }
            );


            uploadBox.addEventListener(
                "drop",
                function (event) {

                    event.preventDefault();

                    uploadBox.classList.remove(
                        "drag-active"
                    );


                    const files =
                        event.dataTransfer.files;


                    if (
                        files &&
                        files.length > 0
                    ) {

                        selectedFile =
                            files[0];

                        showSelectedFile(
                            selectedFile
                        );

                    }

                }
            );

        }

    }
);


/* =========================================
   SHOW SELECTED FILE
========================================= */

function showSelectedFile(file) {

    const uploadBox =
        document.getElementById("uploadBox");


    if (!uploadBox) {
        return;
    }


    let fileInfo =
        uploadBox.querySelector(
            ".selected-file-info"
        );


    if (!fileInfo) {

        fileInfo =
            document.createElement("div");

        fileInfo.className =
            "selected-file-info";

        fileInfo.style.marginTop =
            "18px";

        fileInfo.style.padding =
            "12px 16px";

        fileInfo.style.borderRadius =
            "10px";

        fileInfo.style.background =
            "#f1f8f6";

        fileInfo.style.border =
            "1px solid #d7ebe5";

        fileInfo.style.fontSize =
            "14px";

        uploadBox.appendChild(
            fileInfo
        );

    }


    fileInfo.innerHTML = `
        <strong>Selected file:</strong>
        ${escapeHTML(file.name)}
        <br>
        <small>
            Ready for analysis
        </small>
    `;


    let analyzeButton =
        document.getElementById(
            "analyzeFileButton"
        );


    if (!analyzeButton) {

        analyzeButton =
            document.createElement("button");

        analyzeButton.id =
            "analyzeFileButton";

        analyzeButton.className =
            "primary-button";

        analyzeButton.type =
            "button";

        analyzeButton.style.marginTop =
            "16px";

        analyzeButton.innerHTML =
            `Start Analysis <span>→</span>`;


        analyzeButton.addEventListener(
            "click",
            analyzeFile
        );


        uploadBox.appendChild(
            analyzeButton
        );

    }

}


/* =========================================
   ANALYZE FILE
========================================= */

async function analyzeFile() {

    if (!selectedFile) {

        const fileInput =
            document.getElementById(
                "fileInput"
            );


        if (
            fileInput &&
            fileInput.files &&
            fileInput.files.length > 0
        ) {

            selectedFile =
                fileInput.files[0];

        }

    }


    if (!selectedFile) {

        scrollToUpload();

        return;

    }


    const dataTypeElement =
        document.getElementById(
            "dataType"
        );


    const dataType =
        dataTypeElement
            ? dataTypeElement.value
            : "bank_statement";


    const formData =
        new FormData();


    formData.append(
        "file",
        selectedFile
    );


    formData.append(
        "data_type",
        dataType
    );


    setAnalysisLoading(true);


    try {

        const response =
            await fetch(
                `${API_URL}/analyze`,
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            let errorMessage =
                `Analysis failed (${response.status})`;

            try {

                const errorData =
                    await response.json();

                if (errorData.detail) {

                    errorMessage =
                        errorData.detail;

                }

            } catch (error) {
                /* ignore */
            }


            throw new Error(
                errorMessage
            );

        }


        const data =
            await response.json();


        updateHeroDashboard(data);

        displayResults(data);


    } catch (error) {

        console.error(
            "FinSight analysis error:",
            error
        );


        showAnalysisError(
            error.message ||
            "Unable to analyze the file."
        );

    } finally {

        setAnalysisLoading(false);

    }

}


/* =========================================
   LOADING STATE
========================================= */

function setAnalysisLoading(isLoading) {

    const button =
        document.getElementById(
            "analyzeFileButton"
        );


    if (!button) {
        return;
    }


    if (isLoading) {

        button.disabled =
            true;

        button.innerHTML =
            `Analyzing...`;

        button.style.opacity =
            "0.7";

        button.style.cursor =
            "wait";

    } else {

        button.disabled =
            false;

        button.innerHTML =
            `Start Analysis <span>→</span>`;

        button.style.opacity =
            "1";

        button.style.cursor =
            "pointer";

    }

}


/* =========================================
   ERROR
========================================= */

function showAnalysisError(message) {

    let container =
        document.getElementById(
            "resultsContainer"
        );


    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "resultsContainer";

        document.body.appendChild(
            container
        );

    }


    container.innerHTML = `
        <div style="
            margin:40px auto;
            max-width:1100px;
            padding:24px;
            border:1px solid #f1c5cb;
            border-radius:14px;
            background:#fff2f4;
            color:#a52235;
        ">

            <strong>
                Analysis Error
            </strong>

            <p style="margin-bottom:0;">
                ${escapeHTML(message)}
            </p>

        </div>
    `;


    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================================
   UPDATE HERO DASHBOARD
========================================= */

function updateHeroDashboard(data) {

    const transactionCount =
        Number(
            data.transaction_count || 0
        );


    const anomalyCount =
        Number(
            data.anomaly_count || 0
        );


    const highRiskCount =
        Number(
            data.high_risk_count || 0
        );


    const reviewCount =
        Number(
            data.review_count || 0
        );


    const normalCount =
        Number(
            data.normal_count ??
            Math.max(
                transactionCount -
                anomalyCount,
                0
            )
        );


    const transactions =
        Array.isArray(
            data.transactions
        )
            ? data.transactions
            : [];


    /* =====================================
       STATUS
    ===================================== */

    const liveStatus =
        document.querySelector(
            ".live-status"
        );


    if (liveStatus) {

        let statusText =
            "LOW RISK";

        let statusColor =
            "#159b73";


        if (highRiskCount > 0) {

            statusText =
                "HIGH RISK";

            statusColor =
                "#dc3f4f";

        } else if (anomalyCount > 0) {

            statusText =
                "REVIEW REQUIRED";

            statusColor =
                "#d88a21";

        }


        liveStatus.innerHTML = `
            <span
                style="
                    background:${statusColor};
                "
            ></span>

            ${statusText}
        `;


        liveStatus.style.color =
            statusColor;

    }


    /* =====================================
       METRICS
    ===================================== */

    const metricValues =
        document.querySelectorAll(
            ".hero-visual .metric-card strong"
        );


    if (metricValues.length >= 2) {

        metricValues[0].textContent =
            formatNumber(
                transactionCount
            );


        metricValues[1].textContent =
            formatNumber(
                anomalyCount
            );


        metricValues[1].style.color =
            anomalyCount > 0
                ? "#dc3f4f"
                : "#159b73";

    }


    /* =====================================
       PATTERN SUMMARY
    ===================================== */

    const patternValues =
        document.querySelectorAll(
            ".hero-visual .pattern-summary strong"
        );


    if (patternValues.length >= 3) {

        patternValues[0].textContent =
            formatNumber(
                anomalyCount
            );


        patternValues[1].textContent =
            formatNumber(
                normalCount
            );


        patternValues[2].textContent =
            formatNumber(
                transactionCount
            );


        patternValues[0].style.color =
            anomalyCount > 0
                ? "#dc3f4f"
                : "#159b73";

    }


    /* =====================================
       PERIOD
    ===================================== */

    const period =
        document.querySelector(
            ".hero-visual .period"
        );


    if (period) {

        period.textContent =
            `${transactionCount} records analyzed`;

    }


    /* =====================================
       ACTUAL TRANSACTION CHART
    ===================================== */

    updateHeroChart(
        transactions,
        data
    );


    /* =====================================
       RISK ALERT
    ===================================== */

    const riskAlert =
        document.querySelector(
            ".hero-visual .risk-alert"
        );


    if (!riskAlert) {
        return;
    }


    const riskIcon =
        riskAlert.querySelector(
            ".risk-icon"
        );


    const riskTitle =
        riskAlert.querySelector(
            ".risk-text strong"
        );


    const riskSubtitle =
        riskAlert.querySelector(
            ".risk-text span"
        );


    if (highRiskCount > 0) {

        if (riskIcon) {

            riskIcon.textContent =
                "!";

            riskIcon.style.background =
                "#dc3f4f";

            riskIcon.style.color =
                "#ffffff";

        }


        if (riskTitle) {

            riskTitle.textContent =
                `${highRiskCount} high-risk transaction${
                    highRiskCount === 1
                        ? ""
                        : "s"
                } detected`;

            riskTitle.style.color =
                "#dc3f4f";

        }


        if (riskSubtitle) {

            riskSubtitle.textContent =
                "Immediate human review recommended.";

        }


        riskAlert.style.background =
            "#fff0f2";

        riskAlert.style.borderColor =
            "#f1c3ca";


    } else if (anomalyCount > 0) {

        if (riskIcon) {

            riskIcon.textContent =
                "!";

            riskIcon.style.background =
                "#d88a21";

            riskIcon.style.color =
                "#ffffff";

        }


        if (riskTitle) {

            riskTitle.textContent =
                `${anomalyCount} unusual transaction${
                    anomalyCount === 1
                        ? ""
                        : "s"
                } detected`;

            riskTitle.style.color =
                "#d88a21";

        }


        if (riskSubtitle) {

            riskSubtitle.textContent =
                "Review the detected financial pattern.";

        }


        riskAlert.style.background =
            "#fff5e5";

        riskAlert.style.borderColor =
            "#f1dfbd";


    } else {

        if (riskIcon) {

            riskIcon.textContent =
                "✓";

            riskIcon.style.background =
                "#159b73";

            riskIcon.style.color =
                "#ffffff";

        }


        if (riskTitle) {

            riskTitle.textContent =
                "No unusual transactions detected";

            riskTitle.style.color =
                "#159b73";

        }


        if (riskSubtitle) {

            riskSubtitle.textContent =
                "The analyzed records did not trigger the current risk rules.";

        }


        riskAlert.style.background =
            "#eaf8f3";

        riskAlert.style.borderColor =
            "#cce9de";

    }

}


/* =========================================
   HERO CHART
========================================= */

function updateHeroChart(
    transactions,
    data
) {

    const bars =
        document.querySelectorAll(
            ".hero-visual .chart-bars i"
        );


    if (!bars.length) {
        return;
    }


    const transactionList =
        Array.isArray(transactions)
            ? transactions
            : [];


    const amounts =
        transactionList
            .map(
                transaction =>
                    Number(
                        transaction.amount || 0
                    )
            )
            .filter(
                amount =>
                    amount >= 0
            );


    const maxAmount =
        amounts.length
            ? Math.max(...amounts)
            : 1;


    const visibleTransactions =
        transactionList.slice(
            -bars.length
        );


    bars.forEach(
        function (bar, index) {

            const transaction =
                visibleTransactions[index];


            if (!transaction) {

                bar.style.height =
                    "0%";

                bar.classList.remove(
                    "risk-bar"
                );

                return;

            }


            const amount =
                Number(
                    transaction.amount || 0
                );


            let height =
                maxAmount > 0
                    ? (
                        amount /
                        maxAmount
                    ) * 88
                    : 20;


            height =
                Math.max(
                    15,
                    Math.min(
                        92,
                        height
                    )
                );


            bar.style.height =
                `${height}%`;


            const isRisk =
                Boolean(
                    transaction.is_anomaly
                ) ||
                transaction.status ===
                    "High Risk" ||
                transaction.status ===
                    "Review";


            if (isRisk) {

                bar.classList.add(
                    "risk-bar"
                );

            } else {

                bar.classList.remove(
                    "risk-bar"
                );

            }

        }
    );

}


/* =========================================
   DISPLAY RESULTS
========================================= */

function displayResults(data) {

    let container =
        document.getElementById(
            "resultsContainer"
        );


    if (!container) {

        container =
            document.createElement("section");

        container.id =
            "resultsContainer";


        container.style.maxWidth =
            "1180px";

        container.style.margin =
            "50px auto";

        container.style.padding =
            "0 24px";


        const main =
            document.querySelector("main");


        if (main) {

            main.appendChild(
                container
            );

        } else {

            document.body.appendChild(
                container
            );

        }

    }


    const transactionCount =
        Number(
            data.transaction_count || 0
        );


    const anomalyCount =
        Number(
            data.anomaly_count || 0
        );


    const highRiskCount =
        Number(
            data.high_risk_count || 0
        );


    const reviewCount =
        Number(
            data.review_count || 0
        );


    const normalCount =
        Number(
            data.normal_count ??
            Math.max(
                transactionCount -
                anomalyCount,
                0
            )
        );


    const totalAmount =
        Number(
            data.total_amount || 0
        );


    const averageAmount =
        Number(
            data.average_amount || 0
        );


    const overallRisk =
        data.overall_risk ||
        (
            highRiskCount > 0
                ? "HIGH RISK"
                : anomalyCount > 0
                    ? "REVIEW REQUIRED"
                    : "LOW RISK"
        );


    const transactions =
        Array.isArray(
            data.transactions
        )
            ? data.transactions
            : [];


    const anomalies =
        Array.isArray(
            data.anomalies
        )
            ? data.anomalies
            : [];


    const mappings =
        data.mappings || {};


    let statusClass =
        "low";


    if (highRiskCount > 0) {

        statusClass =
            "high";

    } else if (anomalyCount > 0) {

        statusClass =
            "review";

    }


    container.innerHTML = `

        <div class="finsight-results">

            <style>

                .finsight-results {
                    font-family: inherit;
                    margin-top: 30px;
                }

                .results-header {
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:20px;
                    margin-bottom:24px;
                    padding:24px;
                    border-radius:16px;
                    background:#f8fbfa;
                    border:1px solid #e1ebe8;
                }

                .results-header h2 {
                    margin:0 0 6px 0;
                }

                .results-header p {
                    margin:0;
                    opacity:.7;
                }

                .overall-badge {
                    padding:12px 18px;
                    border-radius:30px;
                    font-weight:700;
                    font-size:13px;
                    letter-spacing:.04em;
                }

                .overall-badge.low {
                    background:#e8f7f1;
                    color:#128463;
                }

                .overall-badge.review {
                    background:#fff2dc;
                    color:#b66d0a;
                }

                .overall-badge.high {
                    background:#ffe8ec;
                    color:#c52d43;
                }

                .result-grid {
                    display:grid;
                    grid-template-columns:
                        repeat(4, minmax(0, 1fr));
                    gap:16px;
                    margin-bottom:22px;
                }

                .result-card {
                    padding:20px;
                    border-radius:14px;
                    background:white;
                    border:1px solid #e3ebe8;
                }

                .result-card-label {
                    display:block;
                    font-size:11px;
                    letter-spacing:.08em;
                    opacity:.6;
                    margin-bottom:8px;
                }

                .result-card strong {
                    display:block;
                    font-size:26px;
                    margin-bottom:5px;
                }

                .result-card small {
                    opacity:.6;
                }

                .result-section {
                    margin-top:22px;
                    padding:24px;
                    border-radius:16px;
                    background:white;
                    border:1px solid #e3ebe8;
                }

                .result-section h3 {
                    margin-top:0;
                }

                .risk-overview-grid {
                    display:grid;
                    grid-template-columns:
                        repeat(3, minmax(0, 1fr));
                    gap:14px;
                }

                .risk-box {
                    padding:18px;
                    border-radius:12px;
                    background:#f8faf9;
                }

                .risk-box strong {
                    display:block;
                    font-size:24px;
                    margin-bottom:4px;
                }

                .risk-high {
                    color:#c52d43;
                }

                .risk-review {
                    color:#b66d0a;
                }

                .risk-normal {
                    color:#128463;
                }

                .pattern-chart {
                    display:flex;
                    align-items:flex-end;
                    gap:6px;
                    height:230px;
                    padding:20px 10px 10px;
                    border-left:1px solid #dfe8e4;
                    border-bottom:1px solid #dfe8e4;
                    overflow:hidden;
                }

                .pattern-column {
                    flex:1;
                    min-width:8px;
                    height:100%;
                    display:flex;
                    align-items:flex-end;
                }

                .pattern-bar {
                    width:100%;
                    min-height:4px;
                    border-radius:5px 5px 0 0;
                    background:#8fbfaf;
                    transition:.3s;
                }

                .pattern-bar.risk {
                    background:#dc3f4f;
                }

                .pattern-bar.review {
                    background:#d88a21;
                }

                .transaction-table {
                    width:100%;
                    border-collapse:collapse;
                    font-size:13px;
                }

                .transaction-table th,
                .transaction-table td {
                    padding:12px 10px;
                    border-bottom:1px solid #edf1ef;
                    text-align:left;
                }

                .transaction-table th {
                    font-size:11px;
                    text-transform:uppercase;
                    letter-spacing:.06em;
                    opacity:.6;
                }

                .status-pill {
                    display:inline-block;
                    padding:5px 9px;
                    border-radius:20px;
                    font-size:11px;
                    font-weight:700;
                }

                .status-normal {
                    background:#e8f7f1;
                    color:#128463;
                }

                .status-review {
                    background:#fff2dc;
                    color:#b66d0a;
                }

                .status-high {
                    background:#ffe8ec;
                    color:#c52d43;
                }

                .anomaly-item {
                    padding:16px;
                    margin-top:12px;
                    border-radius:12px;
                    background:#fff6f7;
                    border:1px solid #f3d5da;
                }

                .anomaly-item strong {
                    color:#c52d43;
                }

                .mapping-grid {
                    display:grid;
                    grid-template-columns:
                        repeat(2, minmax(0, 1fr));
                    gap:10px;
                }

                .mapping-item {
                    padding:12px;
                    background:#f8faf9;
                    border-radius:9px;
                }

                .mapping-item span {
                    display:block;
                    font-size:11px;
                    opacity:.55;
                    margin-bottom:3px;
                }

                .empty-result {
                    padding:30px;
                    text-align:center;
                    opacity:.65;
                }

                @media(max-width:800px) {

                    .result-grid {
                        grid-template-columns:
                            repeat(2, minmax(0, 1fr));
                    }

                    .risk-overview-grid {
                        grid-template-columns:1fr;
                    }

                    .results-header {
                        flex-direction:column;
                        align-items:flex-start;
                    }

                    .transaction-table {
                        display:block;
                        overflow-x:auto;
                    }

                }

            </style>


            <div class="results-header">

                <div>

                    <h2>
                        Financial Analysis Results
                    </h2>

                    <p>
                        ${transactionCount}
                        transaction records analyzed
                    </p>

                </div>


                <div class="overall-badge ${statusClass}">
                    ${escapeHTML(overallRisk)}
                </div>

            </div>


            <div class="result-grid">

                <div class="result-card">

                    <span class="result-card-label">
                        TRANSACTIONS
                    </span>

                    <strong>
                        ${formatNumber(transactionCount)}
                    </strong>

                    <small>
                        Records analyzed
                    </small>

                </div>


                <div class="result-card">

                    <span class="result-card-label">
                        TOTAL AMOUNT
                    </span>

                    <strong>
                        ${formatAmount(totalAmount)}
                    </strong>

                    <small>
                        Combined transaction value
                    </small>

                </div>


                <div class="result-card">

                    <span class="result-card-label">
                        RISK SIGNALS
                    </span>

                    <strong class="${
                        anomalyCount > 0
                            ? "risk-high"
                            : "risk-normal"
                    }">

                        ${formatNumber(anomalyCount)}

                    </strong>

                    <small>
                        Transactions requiring review
                    </small>

                </div>


                <div class="result-card">

                    <span class="result-card-label">
                        AVERAGE TRANSACTION
                    </span>

                    <strong>
                        ${formatAmount(averageAmount)}
                    </strong>

                    <small>
                        Average record value
                    </small>

                </div>

            </div>


            <!-- RISK OVERVIEW -->

            <div class="result-section">

                <h3>
                    Risk Analysis
                </h3>

                <p>
                    Risk signals identified from the analyzed
                    financial records.
                </p>


                <div class="risk-overview-grid">

                    <div class="risk-box">

                        <strong class="risk-high">
                            ${formatNumber(highRiskCount)}
                        </strong>

                        <span>
                            High Risk
                        </span>

                    </div>


                    <div class="risk-box">

                        <strong class="risk-review">
                            ${formatNumber(reviewCount)}
                        </strong>

                        <span>
                            Review Required
                        </span>

                    </div>


                    <div class="risk-box">

                        <strong class="risk-normal">
                            ${formatNumber(normalCount)}
                        </strong>

                        <span>
                            Normal
                        </span>

                    </div>

                </div>

            </div>


            <!-- PATTERN ANALYZER -->

            <div class="result-section">

                <h3>
                    Pattern Analyzer
                </h3>

                <p>
                    Transaction-by-transaction activity.
                    Red bars indicate high-risk signals,
                    orange bars indicate review signals.
                </p>


                ${
                    transactions.length > 0
                        ? buildPatternChart(
                            transactions
                        )
                        : `
                            <div class="empty-result">
                                No transaction data available.
                            </div>
                          `
                }

            </div>


            <!-- TRANSACTION ANALYSIS -->

            <div class="result-section">

                <h3>
                    Transaction Analysis
                </h3>


                ${
                    transactions.length > 0
                        ? buildTransactionTable(
                            transactions
                        )
                        : `
                            <div class="empty-result">
                                No transaction records available.
                            </div>
                          `
                }

            </div>


            <!-- DETECTION STATUS -->

            <div class="result-section">

                <h3>
                    Detection Status
                </h3>

                <p>
                    ${formatNumber(anomalyCount)}
                    unusual transaction${
                        anomalyCount === 1
                            ? ""
                            : "s"
                    }
                    detected from
                    ${formatNumber(transactionCount)}
                    total records.
                </p>

            </div>


            <!-- COLUMN MAPPING -->

            <div class="result-section">

                <h3>
                    Column Mapping
                </h3>


                ${
                    Object.keys(mappings).length > 0
                        ? buildMappingGrid(
                            mappings
                        )
                        : `
                            <div class="empty-result">
                                No column mapping information available.
                            </div>
                          `
                }

            </div>


            <!-- ANOMALIES -->

            <div class="result-section">

                <h3>
                    Detected Anomalies
                </h3>


                ${
                    anomalies.length > 0
                        ? buildAnomalies(
                            anomalies
                        )
                        : `
                            <div class="empty-result">
                                No unusual transactions detected.
                            </div>
                          `
                }

            </div>


            <div style="
                text-align:center;
                margin:30px 0 10px;
            ">

                <button
                    class="secondary-button"
                    onclick="scrollToUpload()"
                >
                    Analyze Another File
                </button>

            </div>


        </div>
    `;


    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================================
   BUILD PATTERN CHART
========================================= */

function buildPatternChart(
    transactions
) {

    if (!transactions.length) {

        return `
            <div class="empty-result">
                No transaction data available.
            </div>
        `;

    }


    const amounts =
        transactions.map(
            transaction =>
                Number(
                    transaction.amount || 0
                )
        );


    const maxAmount =
        Math.max(
            ...amounts,
            1
        );


    const bars =
        transactions.map(
            function (
                transaction,
                index
            ) {

                const amount =
                    Number(
                        transaction.amount || 0
                    );


                let height =
                    (
                        amount /
                        maxAmount
                    ) * 100;


                height =
                    Math.max(
                        5,
                        Math.min(
                            100,
                            height
                        )
                    );


                let className =
                    "pattern-bar";


                if (
                    transaction.status ===
                    "High Risk" ||
                    transaction.is_anomaly
                ) {

                    className +=
                        " risk";

                } else if (
                    transaction.status ===
                    "Review"
                ) {

                    className +=
                        " review";

                }


                return `

                    <div
                        class="pattern-column"
                        title="Transaction ${
                            escapeHTML(
                                transaction.transaction_id ||
                                index + 1
                            )
                        } — Amount: ${
                            formatAmount(
                                amount
                            )
                        } — Status: ${
                            escapeHTML(
                                transaction.status ||
                                "Normal"
                            )
                        }"
                    >

                        <div
                            class="${className}"
                            style="
                                height:${height}%;
                            "
                        ></div>

                    </div>

                `;

            }
        )
        .join("");


    return `

        <div
            class="pattern-chart"
        >

            ${bars}

        </div>

    `;

}


/* =========================================
   BUILD TRANSACTION TABLE
========================================= */

function buildTransactionTable(
    transactions
) {

    const rows =
        transactions
            .slice(0, 100)
            .map(
                function (
                    transaction,
                    index
                ) {

                    let status =
                        transaction.status ||
                        "Normal";


                    let statusClass =
                        "status-normal";


                    if (
                        status ===
                        "High Risk"
                    ) {

                        statusClass =
                            "status-high";

                    } else if (
                        status ===
                        "Review"
                    ) {

                        statusClass =
                            "status-review";

                    }


                    return `

                        <tr>

                            <td>
                                ${
                                    escapeHTML(
                                        transaction.transaction_id ||
                                        `Row ${index + 1}`
                                    )
                                }
                            </td>


                            <td>
                                ${
                                    escapeHTML(
                                        transaction.date ||
                                        "—"
                                    )
                                }
                            </td>


                            <td>
                                ${
                                    formatAmount(
                                        transaction.amount
                                    )
                                }
                            </td>


                            <td>

                                <span
                                    class="status-pill ${statusClass}"
                                >

                                    ${
                                        escapeHTML(
                                            status
                                        )
                                    }

                                </span>

                            </td>


                            <td>
                                ${
                                    Number(
                                        transaction.risk_score ||
                                        0
                                    )
                                }
                            </td>


                            <td>
                                ${
                                    escapeHTML(
                                        transaction.description ||
                                        "—"
                                    )
                                }
                            </td>

                        </tr>

                    `;

                }
            )
            .join("");


    return `

        <div style="overflow-x:auto;">

            <table class="transaction-table">

                <thead>

                    <tr>

                        <th>
                            Transaction ID
                        </th>

                        <th>
                            Date
                        </th>

                        <th>
                            Amount
                        </th>

                        <th>
                            Status
                        </th>

                        <th>
                            Risk Score
                        </th>

                        <th>
                            Description
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${rows}

                </tbody>

            </table>

        </div>

    `;

}


/* =========================================
   BUILD MAPPING GRID
========================================= */

function buildMappingGrid(
    mappings
) {

    return `

        <div class="mapping-grid">

            ${
                Object.entries(
                    mappings
                )
                .map(
                    function (
                        [
                            key,
                            value
                        ]
                    ) {

                        return `

                            <div
                                class="mapping-item"
                            >

                                <span>
                                    ${
                                        escapeHTML(
                                            key
                                        )
                                    }
                                </span>

                                <strong>
                                    ${
                                        escapeHTML(
                                            value
                                        )
                                    }
                                </strong>

                            </div>

                        `;

                    }
                )
                .join("")
            }

        </div>

    `;

}


/* =========================================
   BUILD ANOMALIES
========================================= */

function buildAnomalies(
    anomalies
) {

    return anomalies
        .map(
            function (
                anomaly,
                index
            ) {

                return `

                    <div
                        class="anomaly-item"
                    >

                        <strong>
                            Risk Signal #${
                                index + 1
                            }
                        </strong>


                        <p>

                            Transaction:
                            <strong>
                                ${
                                    escapeHTML(
                                        anomaly.transaction_id ||
                                        "Unknown"
                                    )
                                }
                            </strong>

                        </p>


                        <p>

                            Amount:
                            <strong>
                                ${
                                    formatAmount(
                                        anomaly.amount
                                    )
                                }
                            </strong>

                        </p>


                        ${
                            anomaly.reason
                                ? `
                                    <p>
                                        ${escapeHTML(
                                            anomaly.reason
                                        )}
                                    </p>
                                  `
                                : ""
                        }


                        ${
                            anomaly.explanation
                                ? `
                                    <p>
                                        ${escapeHTML(
                                            anomaly.explanation
                                        )}
                                    </p>
                                  `
                                : ""
                        }

                    </div>

                `;

            }
        )
        .join("");

}


/* =========================================
   NAV BUTTONS
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const navButtons =
            document.querySelectorAll(
                ".nav-button, .start-analysis-button"
            );


        navButtons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        if (
                            selectedFile
                        ) {

                            analyzeFile();

                        } else {

                            scrollToUpload();

                        }

                    }
                );

            }
        );

    }
);


/* =========================================
   GLOBAL FUNCTIONS
========================================= */

window.analyzeFile =
    analyzeFile;


window.scrollToUpload =
    scrollToUpload;


window.scrollToHowItWorks =
    scrollToHowItWorks;