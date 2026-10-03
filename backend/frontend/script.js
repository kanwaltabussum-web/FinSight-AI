const API_URL = "http://127.0.0.1:8000";

const uploadBox = document.getElementById("uploadBox");
const fileInput = document.getElementById("fileInput");

let selectedFile = null;


/* =========================================
   FILE INPUT
========================================= */

fileInput.addEventListener("change", function () {

    if (this.files && this.files.length > 0) {

        selectedFile = this.files[0];

        showSelectedFile(selectedFile);

        analyzeFile();

    }

});


/* =========================================
   UPLOAD BUTTON
========================================= */

const uploadButton =
    uploadBox.querySelector(".upload-button");

if (uploadButton) {

    uploadButton.addEventListener("click", function (event) {

        event.stopPropagation();

        fileInput.click();

    });

}


/* =========================================
   SHOW SELECTED FILE
========================================= */

function showSelectedFile(file) {

    const fileInfo =
        uploadBox.querySelector(".file-info");

    if (fileInfo) {

        fileInfo.textContent =
            `${file.name} selected`;

    }

}


/* =========================================
   DRAG & DROP
========================================= */

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


    if (
        event.dataTransfer.files &&
        event.dataTransfer.files.length > 0
    ) {

        selectedFile =
            event.dataTransfer.files[0];

        showSelectedFile(selectedFile);

        analyzeFile();

    }

});


/* =========================================
   ANALYZE FILE
========================================= */

async function analyzeFile() {

    if (!selectedFile) {

        return;

    }


    const formData = new FormData();

const dataType =
    document.getElementById("dataType").value;

formData.append(
    "file",
    selectedFile
);

formData.append(
    "data_type",
    dataType
);


    try {

        const response = await fetch(
            `${API_URL}/analyze`,
            {
                method: "POST",
                body: formData
            }
        );


        const data =
            await response.json();


        if (!data.success) {

            alert(
                data.error ||
                "Something went wrong while analyzing the file."
            );

            return;

        }


        displayResults(data);


    } catch (error) {

        console.error(error);

        alert(
            "Could not connect to FinSight AI backend. Make sure the backend server is running."
        );

    }

}


/* =========================================
   DISPLAY RESULTS
========================================= */

function displayResults(data) {

    const uploadSection =
        document.querySelector(".upload-section");


    const oldResults =
        document.getElementById(
            "resultsContainer"
        );


    if (oldResults) {

        oldResults.remove();

    }


    const resultsContainer =
        document.createElement("div");


    resultsContainer.id =
        "resultsContainer";


    /* =====================================
       SUMMARY CARDS
    ===================================== */

    const analysisResults =
        document.createElement("div");


    analysisResults.className =
        "analysis-results";


    analysisResults.innerHTML = `

        <div>

            <strong>
                ${data.transaction_count}
            </strong>

            <span>
                Transactions
            </span>

        </div>


        <div>

            <strong>
                ${formatNumber(data.total_amount)}
            </strong>

            <span>
                Total Amount
            </span>

        </div>


        <div>

            <strong>
                ${formatNumber(data.average_amount)}
            </strong>

            <span>
                Average Amount
            </span>

        </div>


        <div>

            <strong class="unusual-count-number">
                ${data.anomaly_count}
            </strong>

            <span>
                Unusual Transactions
            </span>

        </div>

    `;


    resultsContainer.appendChild(
        analysisResults
    );
const mappingSection =
    document.createElement("div");

mappingSection.className =
    "column-mapping-section";

const mappingTitle =
    document.createElement("h3");

mappingTitle.textContent =
    "Detected Column Mapping";

mappingSection.appendChild(
    mappingTitle
);

const mappingGrid =
    document.createElement("div");

mappingGrid.className =
    "column-mapping-grid";

const mappingLabels = {
    date: "Date",
    transaction_id: "Transaction ID",
    amount: "Amount",
    debit: "Debit",
    credit: "Credit",
    description: "Description",
    invoice_id: "Invoice ID",
    supplier_id: "Supplier ID",
    category: "Category",
    payment_method: "Payment Method"
};

if (data.column_mapping) {

    Object.keys(mappingLabels).forEach(
        function (key) {

            const item =
                document.createElement("div");

            item.className =
                "column-mapping-item";

            const detected =
                data.column_mapping[key];

            item.innerHTML = `
                <span>
                    ${mappingLabels[key]}
                </span>

                <strong>
                    ${
                        detected
                        ? escapeHTML(detected)
                        : "Not detected"
                    }
                </strong>
            `;

            mappingGrid.appendChild(item);
        }
    );
}

mappingSection.appendChild(
    mappingGrid
);

resultsContainer.appendChild(
    mappingSection
);


    /* =====================================
       ANOMALIES
    ===================================== */

    const anomalySection =
        document.createElement("div");


    anomalySection.className =
        "anomaly-section";


    if (
        data.anomaly_count &&
        data.anomaly_count > 0
    ) {


        const anomalyHeader =
            document.createElement("div");


        anomalyHeader.className =
            "anomaly-header";


        anomalyHeader.innerHTML = `

            <div class="anomaly-icon">
                !
            </div>

            <div>

                <strong>
                    ${data.anomaly_count}
                    unusual transaction
                    ${data.anomaly_count === 1 ? "" : "s"}
                    detected
                </strong>

                <span>
                    These records deserve human review.
                </span>

            </div>

        `;


        anomalySection.appendChild(
            anomalyHeader
        );


        /* =================================
           EACH ANOMALY
        ================================= */

        data.anomalies.forEach(
            function (anomaly) {


                const anomalyCard =
                    document.createElement("div");


                anomalyCard.className =
                    "anomaly-card";


                /* =========================
                   TRANSACTION + AMOUNT
                ========================= */

                const cardTop =
                    document.createElement("div");


                cardTop.className =
                    "anomaly-card-top";


                cardTop.innerHTML = `

                    <div>

                        <span>
                            TRANSACTION
                        </span>

                        <strong>
                            ${escapeHTML(
                                anomaly.transaction_id
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            AMOUNT
                        </span>

                        <strong>
                            ${formatNumber(
                                anomaly.amount
                            )}
                        </strong>

                    </div>

                `;


                anomalyCard.appendChild(
                    cardTop
                );


                /* =========================
                   RISK SCORE
                ========================= */

                const riskScore =
                    document.createElement("div");


                riskScore.className =
                    "risk-score-box";


                riskScore.innerHTML = `

                    <div>

                        <span>
                            RISK SIGNAL SCORE
                        </span>

                        <strong>
                            ${anomaly.risk_score}
                        </strong>

                    </div>


                    <div class="risk-level">

                        ${escapeHTML(
                            anomaly.risk_level
                        )}

                    </div>

                `;


                anomalyCard.appendChild(
                    riskScore
                );


                /* =========================
                   CONNECTED RECORDS
                ========================= */

                const connected =
                    document.createElement("div");


                connected.className =
                    "connected-records";


                connected.innerHTML = `

                    <div class="connected-title">

                        <span class="connected-icon">
                            🔗
                        </span>

                        <strong>
                            Connected Records
                        </strong>

                    </div>


                    <div class="connected-grid">


                        <div class="connected-item">

                            <span>
                                INVOICE
                            </span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.invoice_id
                                )}
                            </strong>

                        </div>


                        <div class="connected-item">

                            <span>
                                SUPPLIER
                            </span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.supplier_id
                                )}
                            </strong>

                        </div>


                        <div class="connected-item">

                            <span>
                                CATEGORY
                            </span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.category
                                )}
                            </strong>

                        </div>


                        <div class="connected-item">

                            <span>
                                PAYMENT
                            </span>

                            <strong>
                                ${escapeHTML(
                                    anomaly.payment_method
                                )}
                            </strong>

                        </div>


                    </div>

                `;


                anomalyCard.appendChild(
                    connected
                );


                /* =========================
                   EXPLANATION
                ========================= */

                const explanation =
                    document.createElement("div");


                explanation.className =
                    "ai-explanation";


                explanation.innerHTML = `

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
                            anomaly.explanation
                        )}
                    </p>

                `;


                anomalyCard.appendChild(
                    explanation
                );


                /* =========================
                   RISK REASONS
                ========================= */

                if (
                    anomaly.risk_reasons &&
                    anomaly.risk_reasons.length > 0
                ) {


                    const reasons =
                        document.createElement("div");


                    reasons.className =
                        "risk-reasons";


                    let reasonsHTML = "";


                    anomaly.risk_reasons.forEach(
                        function (reason) {

                            reasonsHTML += `
                                <li>
                                    ${escapeHTML(reason)}
                                </li>
                            `;

                        }
                    );


                    reasons.innerHTML = `

                        <strong>
                            Signals detected
                        </strong>

                        <ul>
                            ${reasonsHTML}
                        </ul>

                    `;


                    anomalyCard.appendChild(
                        reasons
                    );

                }


                /* =========================
                   REASON
                ========================= */

                const reason =
                    document.createElement("p");


                reason.textContent =
                    anomaly.reason;


                anomalyCard.appendChild(
                    reason
                );


                /* =========================
                   THRESHOLD
                ========================= */

                const threshold =
                    document.createElement("small");


                threshold.textContent =
                    `Detection threshold: ${formatNumber(
                        anomaly.threshold
                    )}`;


                anomalyCard.appendChild(
                    threshold
                );


                anomalySection.appendChild(
                    anomalyCard
                );

            }
        );


        /* =================================
           HUMAN REVIEW
        ================================= */

        const reviewNote =
            document.createElement("div");


        reviewNote.className =
            "review-note";


        reviewNote.innerHTML = `

            <strong>
                Human review remains in control.
            </strong>

            <span>
                A risk signal indicates an unusual
                pattern; it is not proof of fraud.
            </span>

        `;


        resultsContainer.appendChild(
            anomalySection
        );


        resultsContainer.appendChild(
            reviewNote
        );


    } else {


        /* =================================
           NO ANOMALY
        ================================= */

        const noAnomaly =
            document.createElement("div");


        noAnomaly.className =
            "no-anomaly";


        noAnomaly.innerHTML = `

            <span>
                ✓
            </span>

            <div>

                <strong>
                    No unusual transactions detected
                </strong>

                <small>
                    The uploaded records did not cross
                    the current anomaly detection threshold.
                </small>

            </div>

        `;


        resultsContainer.appendChild(
            noAnomaly
        );

    }


    /* =====================================
       ANALYZE ANOTHER FILE
    ===================================== */

    const anotherButton =
        document.createElement("button");


    anotherButton.className =
        "primary-button";


    anotherButton.style.display =
        "block";


    anotherButton.style.margin =
        "25px auto 0";


    anotherButton.textContent =
        "Analyze Another File →";


    anotherButton.addEventListener(
        "click",
        function () {

            selectedFile = null;

            fileInput.value = "";


            const fileInfo =
                uploadBox.querySelector(
                    ".file-info"
                );


            if (fileInfo) {

                fileInfo.textContent =
                    "CSV or Excel files supported";

            }


            const oldResults =
                document.getElementById(
                    "resultsContainer"
                );


            if (oldResults) {

                oldResults.remove();

            }


            uploadSection.scrollIntoView({
                behavior: "smooth"
            });

        }
    );


    resultsContainer.appendChild(
        anotherButton
    );


    /* =====================================
       ADD TO PAGE
    ===================================== */

    uploadSection.appendChild(
        resultsContainer
    );


    /* =====================================
       SCROLL
    ===================================== */

    setTimeout(
        function () {

            resultsContainer.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        },
        200
    );

}


/* =========================================
   NUMBER FORMAT
========================================= */

function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {

        return "0";

    }


    return Number(value).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );

}


/* =========================================
   HTML ESCAPE
========================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}