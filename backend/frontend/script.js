const API_URL = "https://finsight-ai.fastapicloud.dev";

const uploadBox = document.getElementById("uploadBox");
const fileInput = document.getElementById("fileInput");

let selectedFile = null;


/* =========================================
   FILE SELECTION
========================================= */

if (fileInput) {
    fileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];

        if (!file) return;

        selectedFile = file;

        showSelectedFile(file);
        analyzeFile();
    });
}


/* =========================================
   UPLOAD BUTTON
========================================= */

const uploadButton = document.querySelector(".upload-button");

if (uploadButton) {
    uploadButton.addEventListener("click", function () {
        fileInput.click();
    });
}


/* =========================================
   DRAG & DROP
========================================= */

if (uploadBox) {

    uploadBox.addEventListener("dragover", function (event) {
        event.preventDefault();

        uploadBox.classList.add("drag-over");
    });

    uploadBox.addEventListener("dragleave", function () {
        uploadBox.classList.remove("drag-over");
    });

    uploadBox.addEventListener("drop", function (event) {
        event.preventDefault();

        uploadBox.classList.remove("drag-over");

        const file = event.dataTransfer.files[0];

        if (!file) return;

        selectedFile = file;

        showSelectedFile(file);
        analyzeFile();
    });
}


/* =========================================
   SHOW SELECTED FILE
========================================= */

function showSelectedFile(file) {

    const fileInfo = document.querySelector(".file-info");

    if (fileInfo) {
        fileInfo.innerHTML = `
            <strong>${escapeHTML(file.name)}</strong>
            &nbsp; • &nbsp;
            ${(file.size / 1024).toFixed(1)} KB
        `;
    }
}


/* =========================================
   ANALYZE FILE
========================================= */

async function analyzeFile() {

    if (!selectedFile) return;

    const dataTypeElement = document.getElementById("dataType");

    const dataType = dataTypeElement
        ? dataTypeElement.value
        : "bank_statement";

    const resultsContainer =
        document.getElementById("resultsContainer");

    if (resultsContainer) {

        resultsContainer.innerHTML = `
            <div class="analysis-loading"
                 style="
                    max-width:1050px;
                    margin:30px auto;
                    padding:30px;
                    text-align:center;
                    background:white;
                    border:1px solid #e3e9f1;
                    border-radius:18px;
                 ">
                <div style="
                    font-size:28px;
                    margin-bottom:10px;
                ">✦</div>

                <strong style="
                    display:block;
                    color:#10243e;
                    font-size:16px;
                    margin-bottom:5px;
                ">
                    Analyzing your financial data...
                </strong>

                <span style="
                    color:#718096;
                    font-size:11px;
                ">
                    Detecting patterns, anomalies and risk signals
                </span>
            </div>
        `;
    }

    const formData = new FormData();

    formData.append("file", selectedFile);
    formData.append("data_type", dataType);

    try {

        const response = await fetch(
            `${API_URL}/analyze`,
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {

            let errorMessage =
                "Unable to analyze the file.";

            try {
                const errorData = await response.json();

                if (errorData.detail) {
                    errorMessage = errorData.detail;
                }
            } catch (_) {}

            throw new Error(errorMessage);
        }

        const data = await response.json();

        displayResults(data);

    } catch (error) {

        console.error(error);

        if (resultsContainer) {

            resultsContainer.innerHTML = `
                <div style="
                    max-width:1050px;
                    margin:30px auto;
                    padding:22px;
                    background:#fff0f2;
                    border:1px solid #f1c3ca;
                    border-radius:16px;
                    color:#b92d3d;
                ">
                    <strong style="display:block;margin-bottom:5px;">
                        Analysis failed
                    </strong>

                    <span style="font-size:11px;">
                        ${escapeHTML(error.message)}
                    </span>
                </div>
            `;
        }
    }
}


/* =========================================
   DISPLAY RESULTS
========================================= */

function displayResults(data) {

    let resultsContainer =
        document.getElementById("resultsContainer");

    if (!resultsContainer) {

        resultsContainer = document.createElement("div");

        resultsContainer.id = "resultsContainer";

        const uploadSection =
            document.querySelector(".upload-section");

        if (uploadSection) {
            uploadSection.appendChild(resultsContainer);
        } else {
            document.body.appendChild(resultsContainer);
        }
    }

    resultsContainer.innerHTML = "";


    /* -----------------------------------------
       BASIC VALUES
    ----------------------------------------- */

    const transactionCount =
        Number(data.transaction_count || 0);

    const totalAmount =
        Number(data.total_amount || 0);

    const averageAmount =
        Number(data.average_amount || 0);

    const anomalyCount =
        Number(data.anomaly_count || 0);

    const highRiskCount =
        Number(data.high_risk_count || 0);

    const reviewCount =
        Number(data.review_count || 0);


    /* -----------------------------------------
       RESULT TITLE
    ----------------------------------------- */

    const titleSection =
        document.createElement("div");

    titleSection.style.cssText = `
        max-width:1050px;
        margin:35px auto 15px;
    `;

    titleSection.innerHTML = `

        <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:15px;
            flex-wrap:wrap;
        ">

            <div>

                <span style="
                    display:block;
                    color:#2f6fed;
                    font-size:9px;
                    font-weight:800;
                    letter-spacing:1px;
                    margin-bottom:4px;
                ">
                    ANALYSIS COMPLETE
                </span>

                <h2 style="
                    color:#10243e;
                    font-size:25px;
                    margin:0;
                    letter-spacing:-.8px;
                ">
                    Financial Intelligence Report
                </h2>

                <p style="
                    color:#718096;
                    font-size:10px;
                    margin-top:4px;
                ">
                    ${escapeHTML(data.filename || selectedFile?.name || "Uploaded file")}
                </p>

            </div>

            <div style="
                padding:8px 13px;
                border-radius:20px;
                background:#eaf8f3;
                color:#159b73;
                font-size:9px;
                font-weight:800;
            ">
                ANALYSIS READY
            </div>

        </div>
    `;

    resultsContainer.appendChild(titleSection);


    /* =========================================
       SUMMARY CARDS
    ========================================= */

    const summary =
        document.createElement("div");

    summary.className = "analysis-results";

    summary.innerHTML = `

        <div>
            <strong>${formatNumber(transactionCount)}</strong>
            <span>Transactions</span>
        </div>

        <div>
            <strong>${formatNumber(totalAmount)}</strong>
            <span>Total Amount</span>
        </div>

        <div>
            <strong>${formatNumber(averageAmount)}</strong>
            <span>Average Amount</span>
        </div>

        <div>
            <strong class="unusual-count-number">
                ${formatNumber(anomalyCount)}
            </strong>
            <span>Unusual Transactions</span>
        </div>

    `;

    resultsContainer.appendChild(summary);


    /* =========================================
       PATTERN ANALYSIS
    ========================================= */

    const patternSection =
        document.createElement("div");

    patternSection.className =
        "column-mapping-section";

    patternSection.innerHTML = `

        <div style="
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:15px;
            margin-bottom:20px;
        ">

            <div>

                <span style="
                    display:block;
                    color:#2f6fed;
                    font-size:8px;
                    font-weight:800;
                    letter-spacing:1px;
                    margin-bottom:4px;
                ">
                    PATTERN ANALYZER
                </span>

                <h3 style="margin-bottom:3px;">
                    Transaction Risk Pattern
                </h3>

                <p style="
                    color:#718096;
                    font-size:10px;
                ">
                    Visual overview of detected transaction activity
                </p>

            </div>

            <div style="
                padding:7px 10px;
                border-radius:8px;
                background:${anomalyCount > 0 ? "#fff0f2" : "#eaf8f3"};
                color:${anomalyCount > 0 ? "#dc3f4f" : "#159b73"};
                font-size:8px;
                font-weight:800;
                white-space:nowrap;
            ">
                ${anomalyCount > 0
                    ? `${anomalyCount} DETECTION${anomalyCount > 1 ? "S" : ""}`
                    : "NO DETECTIONS"}
            </div>

        </div>

        <div class="dynamic-pattern-chart">

            <div class="pattern-y-axis">
                <span>High</span>
                <span>Medium</span>
                <span>Low</span>
                <span>Normal</span>
            </div>

            <div class="pattern-chart-area">

                <div class="pattern-grid-line line-high"></div>
                <div class="pattern-grid-line line-medium"></div>
                <div class="pattern-grid-line line-low"></div>

                <div class="dynamic-bars">
                    ${buildPatternBars(data)}
                </div>

            </div>

        </div>

        <div style="
            display:flex;
            align-items:center;
            justify-content:center;
            gap:20px;
            margin-top:17px;
            flex-wrap:wrap;
        ">

            <span style="
                display:flex;
                align-items:center;
                gap:6px;
                color:#718096;
                font-size:9px;
            ">
                <i style="
                    width:9px;
                    height:9px;
                    border-radius:3px;
                    background:#4c86ed;
                    display:block;
                "></i>
                Normal activity
            </span>

            <span style="
                display:flex;
                align-items:center;
                gap:6px;
                color:#718096;
                font-size:9px;
            ">
                <i style="
                    width:9px;
                    height:9px;
                    border-radius:3px;
                    background:#dc3f4f;
                    display:block;
                "></i>
                Detected risk
            </span>

        </div>
    `;

    resultsContainer.appendChild(patternSection);


    /* =========================================
       DETECTION STATUS
    ========================================= */

    const statusSection =
        document.createElement("div");

    statusSection.style.cssText = `
        max-width:1050px;
        margin:20px auto;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:12px;
    `;

    statusSection.innerHTML = `

        <div style="
            padding:17px;
            background:${highRiskCount > 0 ? "#fff0f2" : "#f8fafc"};
            border:1px solid ${highRiskCount > 0 ? "#f1c3ca" : "#e3e9f1"};
            border-radius:14px;
        ">
            <span style="
                display:block;
                color:#8a97a7;
                font-size:8px;
                font-weight:800;
                letter-spacing:.7px;
                margin-bottom:5px;
            ">
                HIGH RISK
            </span>

            <strong style="
                color:${highRiskCount > 0 ? "#dc3f4f" : "#10243e"};
                font-size:24px;
            ">
                ${highRiskCount}
            </strong>
        </div>


        <div style="
            padding:17px;
            background:${reviewCount > 0 ? "#fff5e5" : "#f8fafc"};
            border:1px solid ${reviewCount > 0 ? "#f1dfbd" : "#e3e9f1"};
            border-radius:14px;
        ">
            <span style="
                display:block;
                color:#8a97a7;
                font-size:8px;
                font-weight:800;
                letter-spacing:.7px;
                margin-bottom:5px;
            ">
                REVIEW
            </span>

            <strong style="
                color:${reviewCount > 0 ? "#d88a21" : "#10243e"};
                font-size:24px;
            ">
                ${reviewCount}
            </strong>
        </div>


        <div style="
            padding:17px;
            background:#eaf8f3;
            border:1px solid #cce9de;
            border-radius:14px;
        ">
            <span style="
                display:block;
                color:#718096;
                font-size:8px;
                font-weight:800;
                letter-spacing:.7px;
                margin-bottom:5px;
            ">
                NORMAL
            </span>

            <strong style="
                color:#159b73;
                font-size:24px;
            ">
                ${Math.max(transactionCount - anomalyCount, 0)}
            </strong>
        </div>

    `;

    resultsContainer.appendChild(statusSection);


    /* =========================================
       COLUMN MAPPING
    ========================================= */

    const mappingSection =
        document.createElement("div");

    mappingSection.className =
        "column-mapping-section";

    mappingSection.innerHTML = `
        <h3>Detected Column Mapping</h3>

        <div class="column-mapping-grid">
            ${buildMappingHTML(data.column_mapping || {})}
        </div>
    `;

    resultsContainer.appendChild(mappingSection);


    /* =========================================
       ANOMALIES
    ========================================= */

    const anomalySection =
        document.createElement("div");

    anomalySection.className =
        "anomaly-section";


    if (anomalyCount > 0) {

        anomalySection.innerHTML = `

            <div class="anomaly-header">

                <div class="anomaly-icon">
                    !
                </div>

                <div>

                    <strong>
                        ${anomalyCount}
                        unusual transaction${anomalyCount > 1 ? "s" : ""}
                        detected
                    </strong>

                    <span>
                        These records deserve human review.
                    </span>

                </div>

            </div>
        `;


        const anomalies =
            Array.isArray(data.anomalies)
                ? data.anomalies
                : [];


        anomalies.forEach((anomaly, index) => {

            const card =
                document.createElement("div");

            card.className = "anomaly-card";


            const riskScore =
                Number(
                    anomaly.risk_score ||
                    anomaly.risk_signal_score ||
                    0
                );


            const riskLevel =
                anomaly.risk_level ||
                (riskScore >= 60
                    ? "High Review"
                    : "Review");


            const isHighRisk =
                riskScore >= 60;


            const riskColor =
                isHighRisk
                    ? "#dc3f4f"
                    : "#d88a21";


            const riskBackground =
                isHighRisk
                    ? "#fff0f2"
                    : "#fff5e5";


            card.innerHTML = `

                <div class="anomaly-card-top">

                    <div>

                        <span>
                            TRANSACTION
                        </span>

                        <strong>
                            ${escapeHTML(
                                anomaly.transaction_id ||
                                anomaly.id ||
                                `ANOMALY ${index + 1}`
                            )}
                        </strong>

                    </div>

                    <div>

                        <span>
                            AMOUNT
                        </span>

                        <strong>
                            ${formatNumber(
                                anomaly.amount || 0
                            )}
                        </strong>

                    </div>

                </div>


                <div class="risk-score-box"
                     style="
                        background:${riskBackground};
                        border-color:${isHighRisk ? "#f2d0d5" : "#f1dfbd"};
                     ">

                    <div>

                        <span>
                            RISK SIGNAL SCORE
                        </span>

                        <strong style="
                            color:${riskColor};
                        ">
                            ${riskScore}
                        </strong>

                    </div>

                    <div class="risk-level"
                         style="
                            color:${riskColor};
                            background:${isHighRisk ? "#ffdfe3" : "#ffebc7"};
                         ">
                        ${escapeHTML(riskLevel)}
                    </div>

                </div>


                <div class="connected-records">

                    <div class="connected-title">
                        <span class="connected-icon">🔗</span>
                        <strong>Connected Records</strong>
                    </div>

                    <div class="connected-grid">

                        <div class="connected-item">

                            <span>INVOICE</span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.invoice_id ||
                                    "—"
                                )}
                            </strong>

                        </div>

                        <div class="connected-item">

                            <span>SUPPLIER</span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.supplier_id ||
                                    "—"
                                )}
                            </strong>

                        </div>

                        <div class="connected-item">

                            <span>CATEGORY</span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.category ||
                                    "—"
                                )}
                            </strong>

                        </div>

                        <div class="connected-item">

                            <span>PAYMENT</span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.payment_method ||
                                    "—"
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div class="ai-explanation">

                    <div class="ai-explanation-title">

                        <span class="ai-icon">
                            ✦
                        </span>

                        <strong>
                            Why was this flagged?
                        </strong>

                    </div>

                    <p>
                        ${escapeHTML(
                            anomaly.explanation ||
                            anomaly.reason ||
                            "This transaction shows an unusual financial pattern and should be reviewed."
                        )}
                    </p>

                </div>


                <div class="risk-reasons">

                    <strong>
                        RISK SIGNAL
                    </strong>

                    <ul>

                        <li>
                            ${escapeHTML(
                                anomaly.reason ||
                                "Unusual transaction amount"
                            )}
                        </li>

                    </ul>

                </div>


                ${
                    anomaly.threshold !== undefined
                    ? `
                        <p>
                            <strong>
                                Detection threshold:
                            </strong>

                            ${formatNumber(
                                anomaly.threshold
                            )}
                        </p>
                    `
                    : ""
                }


                <small>
                    Human review recommended before taking action.
                </small>

            `;

            anomalySection.appendChild(card);
        });


        const reviewNote =
            document.createElement("div");

        reviewNote.className =
            "review-note";

        reviewNote.innerHTML = `
            <strong>Human review recommended:</strong>
            Automated detection identifies unusual patterns;
            final decisions should be made by a qualified reviewer.
        `;

        resultsContainer.appendChild(anomalySection);
        resultsContainer.appendChild(reviewNote);

    } else {

        anomalySection.innerHTML = `

            <div class="no-anomaly">

                <span>
                    ✓
                </span>

                <div>

                    <strong>
                        No unusual transactions detected
                    </strong>

                    <small>
                        The analyzed records did not trigger the current anomaly detection rules.
                    </small>

                </div>

            </div>
        `;

        resultsContainer.appendChild(anomalySection);
    }


    /* =========================================
       ANALYZE ANOTHER FILE
    ========================================= */

    const anotherButton =
        document.createElement("button");

    anotherButton.className =
        "primary-button";

    anotherButton.innerHTML =
        `Analyze Another File <span>↗</span>`;

    anotherButton.addEventListener(
        "click",
        function () {

            selectedFile = null;

            fileInput.value = "";

            const fileInfo =
                document.querySelector(".file-info");

            if (fileInfo) {
                fileInfo.textContent =
                    "CSV, XLSX or XLS";
            }

            resultsContainer.innerHTML = "";

            const uploadSection =
                document.querySelector(".upload-section");

            if (uploadSection) {
                uploadSection.scrollIntoView({
                    behavior: "smooth"
                });
            }
        }
    );

    resultsContainer.appendChild(anotherButton);


    /* =========================================
       SCROLL TO RESULTS
    ========================================= */

    setTimeout(() => {

        resultsContainer.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }, 200);
}


/* =========================================
   BUILD PATTERN BARS
========================================= */

function buildPatternBars(data) {

    const anomalies =
        Array.isArray(data.anomalies)
            ? data.anomalies
            : [];

    const transactionCount =
        Number(data.transaction_count || 0);

    const anomalyCount =
        Number(data.anomaly_count || 0);

    /*
       If backend gives anomaly amounts,
       use them to create visually meaningful bars.
    */

    const anomalyAmounts =
        anomalies
            .map(item => Number(item.amount || 0))
            .filter(amount => amount > 0);


    const normalCount =
        Math.max(transactionCount - anomalyCount, 0);


    /*
       Create a representative distribution.
       Red bars correspond to detected anomalies.
    */

    const normalHeights = [
        35, 48, 42, 57, 46, 64, 51, 43
    ];

    let html = "";


    normalHeights.forEach((height, index) => {

        html += `
            <div
                class="pattern-bar normal-pattern-bar"
                style="height:${height}%"
                title="Normal transaction activity"
            >
                <span></span>
            </div>
        `;
    });


    /*
       Add red bars for detected anomalies.
    */

    anomalyAmounts.forEach((amount, index) => {

        let height = 72;

        if (data.average_amount) {

            const ratio =
                amount /
                Number(data.average_amount);

            height =
                Math.min(
                    95,
                    Math.max(
                        65,
                        55 + ratio * 8
                    )
                );
        }

        html += `
            <div
                class="pattern-bar risk-pattern-bar"
                style="height:${height}%"
                title="Detected unusual transaction: ${formatNumber(amount)}"
            >
                <span></span>
            </div>
        `;
    });


    /*
       If no anomaly exists,
       add a few normal bars so chart never looks empty.
    */

    if (html === "") {

        [
            31,
            43,
            37,
            52,
            45,
            58,
            41,
            48,
            36,
            55
        ].forEach(height => {

            html += `
                <div
                    class="pattern-bar normal-pattern-bar"
                    style="height:${height}%"
                    title="Normal transaction activity"
                >
                    <span></span>
                </div>
            `;
        });
    }


    return html;
}


/* =========================================
   BUILD COLUMN MAPPING
========================================= */

function buildMappingHTML(mapping) {

    const fields = [
        ["Date", "date"],
        ["Transaction ID", "transaction_id"],
        ["Amount", "amount"],
        ["Debit", "debit"],
        ["Credit", "credit"],
        ["Description", "description"],
        ["Invoice ID", "invoice_id"],
        ["Supplier ID", "supplier_id"],
        ["Category", "category"],
        ["Payment Method", "payment_method"]
    ];


    return fields.map(([label, key]) => {

        const value =
            mapping[key] ||
            "Not detected";


        const detected =
            value !== "Not detected";


        return `
            <div class="column-mapping-item">

                <span>
                    ${label}
                </span>

                <strong style="
                    color:${detected ? "#10243e" : "#9aa5b3"};
                ">
                    ${escapeHTML(value)}
                </strong>

            </div>
        `;

    }).join("");
}


/* =========================================
   FORMAT NUMBERS
========================================= */

function formatNumber(value) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 2
        }
    );
}


/* =========================================
   ESCAPE HTML
========================================= */

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
   DYNAMIC PATTERN CHART CSS
========================================= */

const patternChartCSS = document.createElement("style");

patternChartCSS.textContent = `

    .dynamic-pattern-chart {
        height:220px;
        display:flex;
        gap:12px;
        margin-top:10px;
    }

    .pattern-y-axis {
        width:42px;
        height:100%;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        padding:5px 0 18px;
    }

    .pattern-y-axis span {
        color:#9aa5b3;
        font-size:8px;
        font-weight:600;
        text-align:right;
    }

    .pattern-chart-area {
        flex:1;
        position:relative;
        height:100%;
        border-left:1px solid #e1e7ee;
        border-bottom:1px solid #e1e7ee;
        overflow:hidden;
        background:
            linear-gradient(
                to bottom,
                rgba(47,111,237,.015),
                rgba(47,111,237,.035)
            );
    }

    .pattern-grid-line {
        position:absolute;
        left:0;
        right:0;
        border-top:1px dashed #e3e9f1;
        z-index:1;
    }

    .line-high {
        top:20%;
    }

    .line-medium {
        top:45%;
    }

    .line-low {
        top:70%;
    }

    .dynamic-bars {
        position:absolute;
        left:12px;
        right:12px;
        bottom:0;
        top:0;

        display:flex;
        align-items:flex-end;
        gap:9px;

        z-index:3;
    }

    .pattern-bar {
        flex:1;
        min-width:8px;
        max-width:42px;

        border-radius:5px 5px 2px 2px;

        position:relative;

        transition:
            transform .25s ease,
            opacity .25s ease;
    }

    .normal-pattern-bar {
        background:
            linear-gradient(
                to top,
                #b9d2fb,
                #4c86ed
            );

        box-shadow:
            0 4px 10px rgba(47,111,237,.12);
    }

    .risk-pattern-bar {
        background:
            linear-gradient(
                to top,
                #dc3f4f,
                #f47b88
            );

        box-shadow:
            0 5px 12px rgba(220,63,79,.20);
    }

    .pattern-bar:hover {
        transform:scaleY(1.04);
        opacity:.88;
    }

    .risk-pattern-bar::after {
        content:"!";
        position:absolute;
        top:-17px;
        left:50%;
        transform:translateX(-50%);

        width:13px;
        height:13px;

        display:flex;
        align-items:center;
        justify-content:center;

        border-radius:50%;

        background:#dc3f4f;
        color:white;

        font-size:7px;
        font-weight:800;
    }

    @media(max-width:700px) {

        .dynamic-pattern-chart {
            height:190px;
        }

        .dynamic-bars {
            gap:5px;
            left:7px;
            right:7px;
        }

        .pattern-bar {
            min-width:5px;
        }
    }

`;

document.head.appendChild(patternChartCSS);


/* =========================================
   TOP START ANALYSIS BUTTON
========================================= */

const startButtons =
    document.querySelectorAll(
        ".nav-button, .start-analysis-button"
    );

startButtons.forEach(button => {

    button.addEventListener("click", function (event) {

        const uploadSection =
            document.querySelector(".upload-section");

        if (uploadSection) {

            event.preventDefault();

            uploadSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

    });

});