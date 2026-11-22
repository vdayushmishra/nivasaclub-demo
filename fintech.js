(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const STORAGE_KEY = "nivasaClub.fintechDemo.v1";
  const modal = $("#fintechModal");
  const modalContent = $("#fintechModalContent");
  let modalReturnFocus = null;
  let toastTimer;

  const blankState = () => ({
    role: "tenant",
    scoreDelta: 0,
    mandate: "",
    rewardsPoints: 0,
    cashback: 0,
    depositPaid: 0,
    transactions: [],
    leads: [],
    alert: "",
    gatewayMethod: "upi",
    kycRole: "tenant",
    existingForm: {},
    scoreInputs: {},
    vaultItems: {},
    addOns: {},
    helpers: {}
  });

  function readState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return blankState();
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return blankState();
      const state = { ...blankState(), ...parsed };
      state.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      state.leads = Array.isArray(parsed.leads) ? parsed.leads : [];
      state.existingForm = parsed.existingForm && typeof parsed.existingForm === "object" ? parsed.existingForm : {};
      state.scoreInputs = parsed.scoreInputs && typeof parsed.scoreInputs === "object" ? parsed.scoreInputs : {};
      state.vaultItems = parsed.vaultItems && typeof parsed.vaultItems === "object" ? parsed.vaultItems : {};
      state.addOns = parsed.addOns && typeof parsed.addOns === "object" ? parsed.addOns : {};
      state.helpers = parsed.helpers && typeof parsed.helpers === "object" ? parsed.helpers : {};
      return state;
    } catch (error) {
      console.error("Could not read NivasaClub demo storage:", error);
      return blankState();
    }
  }

  const state = readState();
  const money = value => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
  const plainText = value => String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Could not save NivasaClub demo state:", error);
      showToast("Browser storage unavailable", "Demo changes may not survive refresh.", true);
    }
  }

  function showToast(title, body, warn = false) {
    if (typeof window.showToast === "function") {
      window.showToast(title, body, warn);
      return;
    }
    const box = $("#nivasaToast");
    if (!box) return;
    $("#toastTitle").textContent = title;
    $("#toastBody").textContent = body;
    $("#toastIcon").className = warn ? "fa-solid fa-triangle-exclamation text-xs" : "fa-solid fa-check text-xs";
    box.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.add("hidden"), 4000);
  }

  function openFintechModal(markup) {
    modalReturnFocus = document.activeElement;
    modalContent.innerHTML = markup;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    $("#fintechModalClose").focus();
  }

  function closeFintechModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    if (modalReturnFocus && typeof modalReturnFocus.focus === "function") modalReturnFocus.focus();
  }

  $("#fintechModalClose").addEventListener("click", closeFintechModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeFintechModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) closeFintechModal();
  });

  function getCurrentScore() {
    return Number($("#nivasaScoreNum").textContent) || 300;
  }

  function applyScoreDelta() {
    const scoreNode = $("#nivasaScoreNum");
    const baseScore = Number(scoreNode.textContent) || 300;
    const score = Math.max(300, Math.min(900, baseScore + state.scoreDelta));
    scoreNode.textContent = String(score);
    $("#nivasaScoreBar").style.width = `${Math.round(((score - 300) / 600) * 100)}%`;
    const tier = $("#nivasaTierLabel");
    if (score >= 780) tier.textContent = "Prime Club Tier";
    else if (score >= 700) tier.textContent = "Verified Tier";
    else tier.textContent = "Score Builder Mode";
  }

  function wrapScoreUpdate() {
    if (typeof window.updateAutoPayScore !== "function" || window.updateAutoPayScore.__fintechWrapped) return;
    const original = window.updateAutoPayScore;
    const wrapped = function () {
      original.apply(this, arguments);
      applyScoreDelta();
      persistScoreInputs();
      renderFintech();
    };
    wrapped.__fintechWrapped = true;
    window.updateAutoPayScore = wrapped;
  }

  function setDemoRole(role) {
    state.role = ["tenant", "landlord", "admin"].includes(role) ? role : "tenant";
    const kycRole = state.role === "landlord" ? "landlord" : "tenant";
    state.kycRole = kycRole;
    if (typeof window.switchKycRole === "function") window.switchKycRole(kycRole);
    $$(".demo-role-button").forEach(button => button.classList.toggle("active", button.dataset.demoRole === state.role));
    $("#demoRoleStatus").textContent = `${state.role === "admin" ? "Partner / Admin" : state.role === "landlord" ? "Landlord" : "Tenant"} view · local demo`;
    $("#adminPartnerView").classList.toggle("hidden", state.role !== "admin");
    save();
    renderFintech();
  }
  window.setDemoRole = setDemoRole;

  function currentPaymentMode() {
    if ($("#modeCardBtn").classList.contains("border-2")) return "card";
    if ($("#modeUpiBtn").classList.contains("border-2")) return "upi";
    return "enach";
  }

  function currentRent() {
    return Number($("#monthlyRentInput").value) || 0;
  }

  function currentDeposit() {
    return Number($("#totalDepositInput").value) || 0;
  }

  function nextDepositAmount() {
    const total = currentDeposit();
    if (state.depositPaid < total * 0.15) return Math.round(total * 0.15) - state.depositPaid;
    if (state.depositPaid < total) return total - state.depositPaid;
    return 0;
  }

  function helperPayouts() {
    if (typeof HELPERS !== "undefined") {
      return HELPERS.map(helper => ({
        name: helper.name,
        type: helper.role.split("·")[0].trim(),
        amount: helper.leave ? helper.price - Math.round(helper.price / 30) : helper.price
      }));
    }
    return [{ name: "Helper team", type: "Helper payout", amount: parseInt($("#helperPayoutTotal").textContent.replace(/[^\d]/g, ""), 10) || 0 }];
  }

  function helperTotal() {
    return helperPayouts().reduce((sum, item) => sum + item.amount, 0);
  }

  function selectedMethodName(method) {
    return method === "card" ? "Credit Card Rent Pay" : method === "bank" ? "NetBanking / e-NACH" : "UPI / UPI AutoPay";
  }

  function refreshPaymentSummary() {
    const rent = currentRent();
    const due = nextDepositAmount();
    $("#paymentRentSummary").textContent = money(rent);
    if (!due) {
      $("#depositMilestoneSummary").textContent = "2 of 2 payment stages · paid";
      $("#depositMilestoneDetail").textContent = "Booking + handover amounts simulated";
      $("#depositPayButtonDetail").textContent = "Payment stages complete · no amount due";
    } else if (state.depositPaid > 0) {
      $("#depositMilestoneSummary").textContent = "Stage 02 of 02 · pending";
      $("#depositMilestoneDetail").textContent = `Handover milestone · ${money(due)} remaining`;
      $("#depositPayButtonDetail").textContent = `Handover milestone · ${money(due)}`;
    } else {
      $("#depositMilestoneSummary").textContent = "Stage 01 of 02 · pending";
      $("#depositMilestoneDetail").textContent = `Booking milestone · ${money(due)}`;
      $("#depositPayButtonDetail").textContent = `Booking milestone · ${money(due)}`;
    }
    const mode = currentPaymentMode();
    $("#autoPayMandateSummary").textContent = state.mandate || (mode === "card"
      ? "No AutoPay mandate · card selected"
      : `${mode === "upi" ? "UPI AutoPay" : "e-NACH"} · ready to authorize`);
    $("#rewardsSummary").textContent = `${state.rewardsPoints.toLocaleString("en-IN")} pts · ${money(state.cashback)}`;
    $("#paymentRoleNote").textContent = state.role === "admin"
      ? "Partner/Admin ledger · all demo roles"
      : `${state.role === "landlord" ? "Landlord" : "Tenant"} ledger · demo only`;
    $("#paymentAlert").textContent = state.alert;
    $("#paymentAlert").classList.toggle("hidden", !state.alert);
  }

  function tierForScore(score) {
    if (score >= 780) return { key: "prime", name: "Prime Club Tier", rate: 8.45, range: "8.35%–8.60%", badge: "Prime Club · 780+" };
    if (score >= 700) return { key: "verified", name: "Verified Tier", rate: 9, range: "8.75%–9.25%", badge: "Verified · 700–779" };
    return { key: "builder", name: "Score Builder Mode", rate: 9.75, range: "Build 3–6 months", badge: "Score Builder · below 700" };
  }

  function updateLoanCalculator() {
    const propertyValue = Number($("#propertyValueSlider").value);
    const maxDownPayment = Math.max(0, Math.floor(propertyValue * 0.8 / 250000) * 250000);
    const downSlider = $("#downPaymentSlider");
    downSlider.max = String(maxDownPayment);
    if (Number(downSlider.value) > maxDownPayment) downSlider.value = String(maxDownPayment);
    const downPayment = Number(downSlider.value);
    const principal = Math.max(0, propertyValue - downPayment);
    const tenure = Number($("#tenureSlider").value);
    const tier = tierForScore(getCurrentScore());
    const monthlyRate = tier.rate / 1200;
    const months = tenure * 12;
    const emi = principal === 0 ? 0 : monthlyRate === 0 ? principal / months :
      principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
    $("#propertyValueLabel").textContent = money(propertyValue);
    $("#downPaymentLabel").textContent = money(downPayment);
    $("#tenureLabel").textContent = `${tenure} years`;
    $("#loanRateValue").textContent = `Rate: ${tier.rate.toFixed(2)}% p.a. · ${tier.range}`;
    $("#loanEmiValue").textContent = money(emi);
    $("#loanPrincipalValue").textContent = `Loan principal · ${money(principal)}`;
    $("#currentRentCompare").textContent = money(currentRent());
    $("#rentCompareCopy").textContent = emi > currentRent()
      ? `${money(emi - currentRent())} above current rent / month`
      : `${money(currentRent() - emi)} below current rent / month`;
    $("#bankRateRange").textContent = tier.key === "builder"
      ? "Guide from 9.75% p.a. · up to 30 years"
      : `Indicative ${tier.range} p.a. · up to 30 years`;
    $("#hfcRateRange").textContent = tier.key === "prime"
      ? "Indicative 8.45%–8.75% p.a. · up to 25 years"
      : tier.key === "verified" ? "Indicative 8.90%–9.40% p.a. · up to 25 years"
        : "Guide from 9.95% p.a. · up to 25 years";
    $("#nbfcRateRange").textContent = tier.key === "prime"
      ? "Indicative 8.60%–8.90% p.a. · up to 25 years"
      : tier.key === "verified" ? "Indicative 9.15%–9.75% p.a. · up to 25 years"
        : "Guide from 10.25% p.a. · up to 25 years";
  }

  function updateLoanTier() {
    const score = getCurrentScore();
    const streak = Number($("#onTimeMonthsInput").value) || 0;
    const tier = tierForScore(score);
    $("#loanScoreValue").textContent = String(score);
    $("#loanStreakValue").textContent = `${streak} mo`;
    $("#loanTierBadge").textContent = tier.badge;
    if (state.role === "landlord") {
      $("#loanEligibilityTitle").textContent = `Landlord view · tenant applicant score ${score}.`;
      $("#loanEligibilityCopy").textContent = "The displayed rate tier is a tenant-score simulation. Switch to Tenant to review a pre-filled home-loan callback request.";
    } else if (tier.key === "prime") {
      $("#loanEligibilityTitle").textContent = "Prime Club offers are ready for a partner review.";
      $("#loanEligibilityCopy").textContent = "Indicative rates start around 8.35%–8.60% p.a., with a possible discounted processing-fee voucher and higher LTV review, subject to lender underwriting.";
    } else if (tier.key === "verified") {
      $("#loanEligibilityTitle").textContent = "Your rent track record may strengthen a lender review.";
      $("#loanEligibilityCopy").textContent = "Indicative standard partner rates are 8.75%–9.25% p.a. Eligible rent history may be considered by participating banks / NBFCs.";
    } else {
      $("#loanEligibilityTitle").textContent = "Keep building your rent track record.";
      $("#loanEligibilityCopy").textContent = `A steady 3–6 month on-time AutoPay streak can help work toward the Verified tier. Current streak: ${streak} months.`;
    }
    updateLoanCalculator();
  }

  function updateAdminView() {
    $("#leadCountBadge").textContent = `${state.leads.length} ${state.leads.length === 1 ? "lead" : "leads"}`;
    $("#leadAdminList").innerHTML = state.leads.length
      ? state.leads.slice().reverse().map(lead => `<div class="lead-admin-row"><div><strong>${plainText(lead.name)}</strong><small>${plainText(lead.trackingId)} · ${plainText(lead.partner)}</small></div><div><strong>${plainText(lead.city)}</strong><small>Score ${lead.score} · ${plainText(lead.income)} · ${lead.verifiedDemoKyc ? "demo KYC complete" : "KYC pending"}</small></div><div><strong>${money(lead.loanAmount)}</strong><small>Requested amount</small></div><div class="commission">${money(lead.commission)}<small>Indicative DSA*</small></div></div>`).join("")
      : `<p class="rounded-xl border border-dashed border-emerald-200 bg-white p-5 text-xs text-stone-500">No local leads yet. Use a partner offer card to create a sample callback request.</p>`;
  }

  function renderFintech() {
    refreshPaymentSummary();
    renderLedger();
    updateLoanTier();
    updateAdminView();
    $("#adminPartnerView").classList.toggle("hidden", state.role !== "admin");
    $$(".demo-role-button").forEach(button => button.classList.toggle("active", button.dataset.demoRole === state.role));
    $("#demoRoleStatus").textContent = `${state.role === "admin" ? "Partner / Admin" : state.role === "landlord" ? "Landlord" : "Tenant"} view · local demo`;
  }

  function randomRef(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  let checkout = null;
  function openGateway(type) {
    let amount = 0;
    if (type === "Rent") amount = currentRent();
    if (type === "Deposit") amount = nextDepositAmount();
    if (type === "Helper bills") amount = helperTotal();
    if (amount <= 0) {
      showToast("Nothing due", type === "Deposit" ? "Both payment deposit stages are already complete in this demo." : "Choose a positive amount before checkout.", true);
      return;
    }
    checkout = { type, amount };
    const mode = currentPaymentMode();
    state.gatewayMethod = mode === "card" ? "card" : mode === "enach" ? "bank" : "upi";
    renderGateway();
    save();
  }

  function checkoutFee() {
    return checkout && checkout.type === "Rent" && state.gatewayMethod === "card"
      ? Math.round(checkout.amount * 0.0125) : 0;
  }

  function cardPoints() {
    return checkout && checkout.type === "Rent" && state.gatewayMethod === "card"
      ? Math.floor(checkout.amount / 100) : 0;
  }

  function renderGateway() {
    if (!checkout) return;
    const fee = checkoutFee();
    const points = cardPoints();
    const methodMarkup = state.gatewayMethod === "upi"
      ? `<label for="gatewayUpiId">UPI ID for the demo checkout</label><input id="gatewayUpiId" value="rohan@upi" autocomplete="off"><p>UPI / UPI AutoPay · 0% gateway fee. Mandate setup is simulated; no UPI app will open.</p>`
      : state.gatewayMethod === "card"
        ? `<label for="gatewayCardNumber">Credit card number · demo only</label><input id="gatewayCardNumber" value="•••• •••• •••• 4242" readonly><p>Credit Card Rent Pay · 1.25% rent convenience fee · estimated ${points} reward points.</p>`
        : `<label for="gatewayBankSelect">Choose a sample bank</label><select id="gatewayBankSelect" class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"><option>HDFC Bank · NetBanking</option><option>ICICI Bank · e-NACH</option><option>State Bank of India · NetBanking</option></select><p>NetBanking / e-NACH · 0% gateway fee. Mandate activation is not connected to a bank.</p>`;
    modalContent.innerHTML = `<span class="fintech-kicker">NIVASAPAY · SECURE CHECKOUT SIMULATION</span>
      <h2 id="fintechModalTitle">Pay ${plainText(checkout.type)}</h2>
      <p class="fintech-subtitle">A familiar Indian payment checkout—mock data only; no gateway or payment network is contacted.</p>
      <div class="gateway-amount"><span><small>${plainText(checkout.type)} amount</small><strong>${money(checkout.amount)}</strong></span><span class="gateway-total"><small>Fee ${fee ? money(fee) : "₹0"}</small><strong>Total ${money(checkout.amount + fee)}</strong></span></div>
      <div class="gateway-tabs" role="tablist" aria-label="Payment method">
        <button type="button" class="gateway-tab ${state.gatewayMethod === "upi" ? "active" : ""}" data-gateway-method="upi">UPI / AutoPay<small>0% fee · instant setup</small></button>
        <button type="button" class="gateway-tab ${state.gatewayMethod === "card" ? "active" : ""}" data-gateway-method="card">Credit card rent<small>1.25% fee · rewards</small></button>
        <button type="button" class="gateway-tab ${state.gatewayMethod === "bank" ? "active" : ""}" data-gateway-method="bank">NetBanking / e-NACH<small>0% fee · mandate</small></button>
      </div>
      <div class="gateway-method-panel">${methodMarkup}</div>
      ${fee ? `<div class="fee-line"><span>Convenience fee (1.25%)</span><strong>${money(fee)}</strong></div>` : ""}
      ${points ? `<div class="fee-line"><span>Estimated card rewards</span><strong>${points} pts · ${money(Math.floor(points / 10))} cashback value</strong></div>` : ""}
      <div class="gateway-actions"><button type="button" id="simulatePaymentSuccess" class="gateway-success">✓ Simulate Payment Success</button><button type="button" id="simulatePaymentFailure" class="gateway-failure">↻ Simulate Bounce / Failure</button></div>
      <p class="fintech-modal-note">Test success and failure branches freely. No card details are collected, no funds move, and all transaction references are local demo values.</p>`;
    $$("[data-gateway-method]", modalContent).forEach(button => button.addEventListener("click", () => {
      state.gatewayMethod = button.dataset.gatewayMethod;
      save();
      renderGateway();
    }));
    $("#simulatePaymentSuccess").addEventListener("click", () => finishCheckout(true));
    $("#simulatePaymentFailure").addEventListener("click", () => finishCheckout(false));
    modal.classList.remove("hidden");
  }

  function finishCheckout(success) {
    if (!checkout) return;
    const { type, amount } = checkout;
    const method = selectedMethodName(state.gatewayMethod);
    const fee = success ? checkoutFee() : 0;
    const penalty = success ? 0 : 500;
    const ref = randomRef("NVP");
    const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    const scoreDelta = success ? 10 : -35;
    state.scoreDelta += scoreDelta;
    const entries = type === "Helper bills" && success
      ? helperPayouts().map((helper, index) => ({
          type, label: `${helper.type} payout · ${helper.name}`, amount: helper.amount,
          fee: 0, note: "UPI payout ledger simulation", ref: `${ref}-${index + 1}`
        }))
      : [{ type, label: type === "Deposit" ? "Security deposit milestone" : type, amount, fee, penalty, note: success ? "Demo gateway payment" : "₹500 mock bounce penalty · not charged", ref }];
    entries.forEach((entry, index) => {
      state.transactions.push({
        ...entry,
        method,
        status: success ? "success" : "failed",
        date: timestamp,
        role: state.role === "admin" ? "tenant" : state.role,
        scoreDelta: index === 0 ? scoreDelta : 0,
        receipt: success ? ref : ""
      });
    });
    if (success) {
      if (type === "Deposit") state.depositPaid = Math.min(currentDeposit(), state.depositPaid + amount);
      if (type === "Rent" && state.gatewayMethod === "card") {
        state.rewardsPoints += cardPoints();
        state.cashback += Math.floor(cardPoints() / 10);
      }
      if (state.gatewayMethod === "upi") state.mandate = "UPI AutoPay · simulated";
      if (state.gatewayMethod === "bank") state.mandate = "e-NACH · simulated";
      state.alert = `Payment success simulated · ${ref}. No funds moved; tenant and landlord demo views can see this ledger entry.`;
    } else {
      state.alert = `Payment failed / bounced · ${ref}. A ₹500 mock penalty is logged but not charged; the tenant and landlord demo views show this alert.`;
    }
    save();
    checkout = null;
    closeFintechModal();
    if (typeof window.updateAutoPayScore === "function") window.updateAutoPayScore();
    else { applyScoreDelta(); renderFintech(); }
    if (success) {
      showToast("Demo payment successful", `${ref} recorded. Nivasa Score +10. No money moved.`);
      if (type === "Rent") showReceipt(ref);
    } else {
      showToast("Demo payment bounced", `${ref} recorded. Nivasa Score −35. Tenant and landlord alert shown.`, true);
    }
    renderFintech();
  }

  function showReceipt(ref) {
    const transaction = state.transactions.find(item => item.receipt === ref || item.ref === ref);
    if (!transaction) {
      showToast("Receipt unavailable", "No successful demo transaction was found for this reference.", true);
      return;
    }
    const date = plainText(transaction.date);
    const tenantName = plainText($("#tenantNameInput").value || "Sample Tenant");
    const isRent = transaction.type === "Rent";
    const landlordName = plainText($("#landlordNameInput").value || "Sample Landlord");
    modalContent.innerHTML = `<span class="fintech-kicker">${isRent ? "VIEWABLE GST &amp; RENT RECEIPT" : "PAYMENT RECEIPT"} · DEMO</span><h2 id="fintechModalTitle">Receipt ${plainText(ref)}</h2>
      <article class="receipt-paper" id="receiptPaper"><h3>NivasaClub · ${isRent ? "Rent Receipt" : "Payment Receipt"}</h3><p>Illustrative receipt format · Generated ${date}</p>
        <div class="receipt-data">
          <div class="receipt-row"><span>Receipt / gateway reference</span><strong>${plainText(ref)}</strong></div>
          <div class="receipt-row"><span>${isRent ? "Tenant name" : "Payer role"}</span><strong>${isRent ? tenantName : plainText(transaction.role)}</strong></div>
          ${isRent ? `<div class="receipt-row"><span>Landlord / payee</span><strong>${landlordName}</strong></div><div class="receipt-row"><span>Landlord PAN (masked sample)</span><strong>ABCDE••••F</strong></div><div class="receipt-row"><span>Rent for HRA claim records</span><strong>${money(transaction.amount)}</strong></div>` : `<div class="receipt-row"><span>Payment category</span><strong>${plainText(transaction.label || transaction.type)}</strong></div><div class="receipt-row"><span>Amount</span><strong>${money(transaction.amount)}</strong></div>`}
          <div class="receipt-row"><span>Payment mode / date</span><strong>${plainText(transaction.method)} · ${date}</strong></div>
          ${isRent ? `<div class="receipt-row"><span>GST line</span><strong>Not calculated by this demo</strong></div>` : ""}
          <div class="receipt-row"><span>Payment status</span><strong>Successful · simulation only</strong></div>
        </div>
        <div class="receipt-footer">${isRent ? "Keep this illustrative format with supporting rent-agreement and payment records. HRA eligibility and GST/tax treatment depend on your circumstances and applicable law; confirm with a qualified tax professional." : "This is a mock payment confirmation, not evidence that funds moved."} This receipt is not a tax invoice, proof of a real payment, or a government document.</div>
      </article>
      <div class="receipt-actions"><button type="button" id="printReceipt">Print</button><button type="button" id="downloadReceipt">Download receipt (HTML)</button></div>`;
    modal.classList.remove("hidden");
    $("#printReceipt").addEventListener("click", () => window.print());
    $("#downloadReceipt").addEventListener("click", downloadReceipt);
  }

  function downloadReceipt() {
    const paper = $("#receiptPaper");
    const safeHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><title>NivasaClub demo rent receipt</title><body style="font:14px Arial,sans-serif;max-width:680px;margin:32px auto">${paper.outerHTML}</body></html>`;
    const blob = new Blob([safeHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nivasa-demo-receipt-${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Receipt downloaded", "Illustrative HTML receipt saved locally.");
  }

  function openLeadForm(partner) {
    const tenantName = $("#tenantNameInput").value.trim();
    const landlordName = $("#landlordNameInput").value.trim();
    const applicant = state.role === "landlord" ? landlordName : tenantName;
    const verifiedDemoKyc = state.kycRole === "landlord"
      ? $("#landlordConsentCheck").checked && $("#kycProgressBar").style.width === "100%"
      : $("#tenantConsentCheck").checked && $("#kycProgressBar").style.width === "100%";
    const selectedCity = $("#cityFilter").value;
    const city = selectedCity === "all" ? "Bengaluru" : selectedCity;
    const amount = Math.max(0, Number($("#propertyValueSlider").value) - Number($("#downPaymentSlider").value));
    const score = getCurrentScore();
    modalContent.innerHTML = `<span class="fintech-kicker">PARTNER CALLBACK · LOCAL DEMO</span><h2 id="fintechModalTitle">Check an exact offer</h2>
      <p class="fintech-subtitle">Review the pre-filled details, then create a local callback lead. ${verifiedDemoKyc ? "Name comes from a completed simulated KYC profile." : "Name comes from the editable sample profile; KYC is not marked complete."} Nothing is sent to a lender, NBFC or DSA.</p>
      <form id="leadForm">
        <div class="lead-grid">
          <label>Applicant name<input name="name" required value="${plainText(applicant || "Sample Applicant")}"></label>
          <label>Preferred city<select name="city">${["Bengaluru", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Lucknow"].map(item => `<option ${item === city ? "selected" : ""}>${item}</option>`).join("")}</select></label>
          <label>Household income range<select name="income"><option>Below ₹6 lakh / year</option><option selected>₹6–12 lakh / year</option><option>₹12–24 lakh / year</option><option>Above ₹24 lakh / year</option></select></label>
          <label>Nivasa Score<input name="score" value="${score} / 900" readonly></label>
          <label>Partner<input name="partner" value="${plainText(partner)}" readonly></label>
          <label>Indicative loan request<input name="loanAmount" value="${money(amount)}" readonly></label>
        </div>
        <label class="mt-3 flex items-start gap-2 text-[9px] leading-relaxed text-stone-600"><input name="consent" type="checkbox" required class="mt-0.5 accent-forest-900"><span>I consent to saving this sample callback request in this browser only. This is not consent to share data with a lender or bureau.</span></label>
        <button type="submit" class="lead-submit">Create demo callback request</button>
      </form>
      <p class="fintech-modal-note">Home-loan eligibility, offers and rates remain subject to lender underwriting, verified KYC, affordability checks, explicit consent and applicable RBI guidelines.</p>`;
    modal.classList.remove("hidden");
    $("#leadForm").addEventListener("submit", event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const loanAmount = amount;
      const lead = {
        trackingId: randomRef("NHL"),
        name: String(form.get("name")),
        city: String(form.get("city")),
        income: String(form.get("income")),
        partner: String(form.get("partner")),
        score,
        verifiedDemoKyc,
        loanAmount,
        commission: Math.round(loanAmount * 0.005),
        createdAt: new Date().toISOString()
      };
      state.leads.push(lead);
      save();
      $("#fintechModalContent").innerHTML = `<span class="fintech-kicker">REQUEST LOGGED LOCALLY</span><h2 id="fintechModalTitle">Callback preview created.</h2><div class="lead-success"><strong>Tracking ID:</strong> ${plainText(lead.trackingId)}<br><strong>Partner:</strong> ${plainText(lead.partner)}<br><strong>Indicative DSA commission preview:</strong> ${money(lead.commission)} <small>(0.50% of requested amount; illustrative only)</small><br><br>This lead is stored only in this browser. No partner, agent or lender was notified.</div><button type="button" id="leadDone" class="lead-submit">Done</button>`;
      $("#leadDone").addEventListener("click", closeFintechModal);
      renderAdmin();
    });
  }

  function renderAdmin() {
    $("#leadCountBadge").textContent = `${state.leads.length} ${state.leads.length === 1 ? "lead" : "leads"}`;
    $("#leadAdminList").innerHTML = state.leads.length
      ? state.leads.slice().reverse().map(lead => `<div class="lead-admin-row"><div><strong>${plainText(lead.name)}</strong><small>${plainText(lead.trackingId)} · ${plainText(lead.partner)}</small></div><div><strong>${plainText(lead.city)}</strong><small>Score ${Number(lead.score)} · ${plainText(lead.income)}</small></div><div><strong>${money(lead.loanAmount)}</strong><small>Requested amount</small></div><div class="commission">${money(lead.commission)}<small>Indicative DSA*</small></div></div>`).join("")
      : `<p class="rounded-xl border border-dashed border-emerald-200 bg-white p-5 text-xs text-stone-500">No local leads yet. Use a partner offer card to create a sample callback request.</p>`;
  }

  function collectExistingForm() {
    const ids = ["tenantNameInput", "tenantAgeSelect", "tenantConsentCheck", "tAllAdultsCheck", "tDigiLockerCheck", "tSelfieCheck", "tAntiProxyCheck", "tCoupleCheck", "tIncomeCheck", "tGraphCheck", "tGateCheck", "coupleAgreementSelect", "landlordNameInput", "landlordBankNameInput", "landlordConsentCheck", "lDigiLockerCheck", "lSelfieCheck", "lBillCheck", "lCoupleOptInCheck"];
    ids.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      state.existingForm[id] = element.type === "checkbox" ? element.checked : element.value;
    });
    state.kycRole = typeof activeKycRole === "string" ? activeKycRole : state.kycRole;
  }

  function persistScoreInputs() {
    state.scoreInputs = {
      rent: $("#monthlyRentInput").value,
      onTime: $("#onTimeMonthsInput").value,
      bounces: $("#bounceCountInput").value,
      mode: currentPaymentMode(),
      deposit: $("#totalDepositInput").value
    };
    save();
  }

  function restoreSavedDemo() {
    Object.keys(state.existingForm).forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      if (element.type === "checkbox") element.checked = Boolean(state.existingForm[id]);
      else element.value = String(state.existingForm[id]);
    });
    Object.entries(state.vaultItems).forEach(([id, checked]) => {
      const item = typeof VAULT_ITEMS !== "undefined" && VAULT_ITEMS.find(entry => entry.id === id);
      if (item) item.checked = Boolean(checked);
    });
    Object.entries(state.addOns).forEach(([id, checked]) => {
      const addon = typeof ADDONS !== "undefined" && ADDONS.find(entry => entry.id === id);
      if (addon) addon.checked = Boolean(checked);
    });
    Object.entries(state.helpers).forEach(([id, values]) => {
      const helper = typeof HELPERS !== "undefined" && HELPERS.find(entry => entry.id === id);
      if (helper && values) {
        helper.leave = Boolean(values.leave);
        helper.booked = Boolean(values.booked);
      }
    });
    const inputs = state.scoreInputs;
    if (inputs.rent) $("#monthlyRentInput").value = inputs.rent;
    if (inputs.onTime) $("#onTimeMonthsInput").value = inputs.onTime;
    if (inputs.bounces) $("#bounceCountInput").value = inputs.bounces;
    if (inputs.deposit) $("#totalDepositInput").value = inputs.deposit;
    if (state.kycRole && typeof window.switchKycRole === "function") window.switchKycRole(state.kycRole);
    if (inputs.mode && typeof window.setPaymentMode === "function") window.setPaymentMode(inputs.mode);
    setDemoRole(state.role);
  }

  function attachPersistence() {
    wrapScoreUpdate();
    const originalSetPaymentMode = window.setPaymentMode;
    if (typeof originalSetPaymentMode === "function" && !originalSetPaymentMode.__fintechWrapped) {
      const wrapped = function (mode) {
        originalSetPaymentMode.apply(this, arguments);
        state.scoreInputs.mode = mode;
        save();
        renderFintech();
      };
      wrapped.__fintechWrapped = true;
      window.setPaymentMode = wrapped;
    }
    const originalToggleVault = window.toggleVaultItem;
    if (typeof originalToggleVault === "function" && !originalToggleVault.__fintechWrapped) {
      const wrapped = function (id, checked) {
        originalToggleVault.apply(this, arguments);
        state.vaultItems[id] = Boolean(checked);
        save();
      };
      wrapped.__fintechWrapped = true;
      window.toggleVaultItem = wrapped;
    }
    const originalToggleAddon = window.toggleAddon;
    if (typeof originalToggleAddon === "function" && !originalToggleAddon.__fintechWrapped) {
      const wrapped = function (id, checked) {
        originalToggleAddon.apply(this, arguments);
        state.addOns[id] = Boolean(checked);
        save();
      };
      wrapped.__fintechWrapped = true;
      window.toggleAddon = wrapped;
    }
    const originalToggleHelperLeave = window.toggleHelperLeave;
    if (typeof originalToggleHelperLeave === "function" && !originalToggleHelperLeave.__fintechWrapped) {
      const wrapped = function (id) {
        originalToggleHelperLeave.apply(this, arguments);
        const helper = typeof HELPERS !== "undefined" && HELPERS.find(item => item.id === id);
        if (helper) state.helpers[id] = { leave: helper.leave, booked: helper.booked };
        save();
      };
      wrapped.__fintechWrapped = true;
      window.toggleHelperLeave = wrapped;
    }
    const originalRequestHelper = window.requestHelper;
    if (typeof originalRequestHelper === "function" && !originalRequestHelper.__fintechWrapped) {
      const wrapped = function (id) {
        originalRequestHelper.apply(this, arguments);
        const helper = typeof HELPERS !== "undefined" && HELPERS.find(item => item.id === id);
        if (helper) state.helpers[id] = { leave: helper.leave, booked: helper.booked };
        save();
      };
      wrapped.__fintechWrapped = true;
      window.requestHelper = wrapped;
    }
    const originalEvaluateKyc = window.evaluateKyc;
    if (typeof originalEvaluateKyc === "function" && !originalEvaluateKyc.__fintechWrapped) {
      const wrapped = function () {
        originalEvaluateKyc.apply(this, arguments);
        collectExistingForm();
        save();
      };
      wrapped.__fintechWrapped = true;
      window.evaluateKyc = wrapped;
    }
    ["input", "change"].forEach(eventName => document.addEventListener(eventName, event => {
      const target = event.target;
      if (target.closest("#tenantKycPanel, #landlordKycPanel")) {
        collectExistingForm();
        save();
      }
      if (target.matches("#monthlyRentInput, #onTimeMonthsInput, #bounceCountInput, #totalDepositInput")) {
        persistScoreInputs();
        if (target.matches("#totalDepositInput")) renderFintech();
      }
    }));
  }

  function updateGatewayMethod() {
    const mode = currentPaymentMode();
    state.gatewayMethod = mode === "card" ? "card" : mode === "enach" ? "bank" : "upi";
  }

  function bindPaymentLaunchers() {
    $$(".gateway-launch").forEach(button => button.addEventListener("click", () => openGateway(button.dataset.paymentType)));
    $("#ledgerTypeFilter").addEventListener("change", renderLedger);
    $$("[data-partner]").forEach(button => button.addEventListener("click", () => openLeadForm(button.dataset.partner)));
  }

  function renderLedger() {
    const filter = $("#ledgerTypeFilter").value;
    const entries = state.transactions.filter(transaction => {
      if (state.role !== "admin" && transaction.role !== state.role) return false;
      if (filter === "failure") return transaction.status === "failed";
      if (filter === "all") return true;
      return transaction.type === filter;
    });
    $("#transactionLedgerBody").innerHTML = entries.slice().reverse().map(transaction => `
      <tr class="border-t border-stone-100">
        <td class="px-4 py-3"><strong class="block text-forest-900">${plainText(transaction.ref)}</strong><small class="text-stone-500">${plainText(transaction.date)}</small></td>
        <td class="px-4 py-3"><strong>${plainText(transaction.label || transaction.type)}</strong><small class="block mt-1 text-[9px] text-stone-500">${plainText(transaction.role)} · ${plainText(transaction.note || "")}</small></td>
        <td class="px-4 py-3">${plainText(transaction.method)}</td>
        <td class="px-4 py-3 font-bold">${money(transaction.amount)}${transaction.fee ? `<small class="block text-stone-500">+ ${money(transaction.fee)} fee</small>` : ""}${transaction.penalty ? `<small class="block text-rose-700">${money(transaction.penalty)} penalty · not charged</small>` : ""}</td>
        <td class="px-4 py-3"><span class="ledger-status ${transaction.status}">${transaction.status === "success" ? "Success" : "Failed"}</span><small class="block mt-1 text-[9px] ${transaction.scoreDelta >= 0 ? "text-emerald-700" : "text-rose-700"}">${transaction.scoreDelta > 0 ? "+" : ""}${transaction.scoreDelta} score</small></td>
        <td class="px-4 py-3">${transaction.status === "success" ? `<button type="button" class="receipt-link" data-receipt="${plainText(transaction.receipt || transaction.ref)}">View receipt</button>` : "—"}</td>
      </tr>`).join("");
    $("#ledgerEmpty").classList.toggle("hidden", entries.length > 0);
    $$("[data-receipt]").forEach(button => button.addEventListener("click", () => showReceipt(button.dataset.receipt)));
  }

  function bindLoanControls() {
    ["propertyValueSlider", "downPaymentSlider", "tenureSlider"].forEach(id => {
      $(`#${id}`).addEventListener("input", updateLoanCalculator);
    });
  }

  function resetFintechDemo() {
    const fresh = blankState();
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, fresh);
    const defaults = {
      tenantNameInput: "Rohan Verma", tenantAgeSelect: "26", tenantConsentCheck: false,
      tAllAdultsCheck: true, tDigiLockerCheck: true, tSelfieCheck: true, tAntiProxyCheck: true,
      tCoupleCheck: true, tIncomeCheck: true, tGraphCheck: true, tGateCheck: true, coupleAgreementSelect: "joint",
      landlordNameInput: "Suresh Kulkarni", landlordBankNameInput: "Suresh Kulkarni",
      landlordConsentCheck: false, lDigiLockerCheck: true, lSelfieCheck: true, lBillCheck: true, lCoupleOptInCheck: true
    };
    Object.entries(defaults).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.type === "checkbox" ? input.checked = value : input.value = value;
    });
    $("#monthlyRentInput").value = "24000";
    $("#onTimeMonthsInput").value = "8";
    $("#bounceCountInput").value = "0";
    $("#totalDepositInput").value = "60000";
    if (typeof VAULT_ITEMS !== "undefined") VAULT_ITEMS.forEach(item => {
      item.checked = item.id === "v1" || item.id === "v2";
      item.proof = "";
    });
    if (typeof ADDONS !== "undefined") ADDONS.forEach(item => {
      item.checked = item.id === "a_maid" || item.id === "a_cook";
    });
    if (typeof HELPERS !== "undefined") HELPERS.forEach(helper => {
      helper.leave = false;
      helper.booked = false;
    });
    if (typeof window.setPaymentMode === "function") window.setPaymentMode("enach");
    if (typeof window.switchKycRole === "function") window.switchKycRole("tenant");
    save();
    collectExistingForm();
    renderFintech();
    if (typeof window.evaluateKyc === "function") window.evaluateKyc();
    if (typeof window.renderDepositStages === "function") window.renderDepositStages();
    if (typeof window.renderVaultChecklist === "function") window.renderVaultChecklist();
    if (typeof window.renderAddons === "function") window.renderAddons();
    if (typeof window.renderHelpers === "function") window.renderHelpers();
    showToast("Fintech demo ledger reset", "Local transactions, rewards, and saved leads were cleared.");
  }

  function loadSampleTenant() {
    const values = {
      tenantNameInput: "Rohan Mehta & Priya Sharma", tenantAgeSelect: "26", tenantConsentCheck: true,
      tAllAdultsCheck: true, tDigiLockerCheck: true, tSelfieCheck: true, tAntiProxyCheck: true,
      tCoupleCheck: true, tIncomeCheck: true, tGraphCheck: true, tGateCheck: true, coupleAgreementSelect: "joint"
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.type === "checkbox" ? input.checked = value : input.value = value;
    });
    $("#monthlyRentInput").value = "32000";
    $("#onTimeMonthsInput").value = "12";
    $("#bounceCountInput").value = "0";
    state.scoreDelta = 0;
    state.kycRole = "tenant";
    setDemoRole("tenant");
    if (typeof window.setPaymentMode === "function") window.setPaymentMode("upi");
    if (typeof window.evaluateKyc === "function") window.evaluateKyc();
    collectExistingForm();
    persistScoreInputs();
    renderFintech();
    showToast("Sample tenant loaded", "Rohan & Priya · KYC and rent history are mock data.");
  }

  function loadSampleLandlord() {
    const values = {
      landlordNameInput: "Suresh Kulkarni", landlordBankNameInput: "Suresh Kulkarni",
      landlordConsentCheck: true, lDigiLockerCheck: true, lSelfieCheck: true,
      lBillCheck: true, lCoupleOptInCheck: true
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.type === "checkbox" ? input.checked = value : input.value = value;
    });
    state.kycRole = "landlord";
    setDemoRole("landlord");
    if (typeof window.evaluateKyc === "function") window.evaluateKyc();
    collectExistingForm();
    save();
    showToast("Sample landlord loaded", "Suresh Kulkarni · owner checks are mock data.");
  }

  function initialize() {
    attachPersistence();
    restoreSavedDemo();
    if (state.scoreInputs.mode && typeof window.setPaymentMode === "function") window.setPaymentMode(state.scoreInputs.mode);
    if (typeof window.renderVaultChecklist === "function") window.renderVaultChecklist();
    if (typeof window.renderAddons === "function") window.renderAddons();
    if (typeof window.renderHelpers === "function") window.renderHelpers();
    collectExistingForm();
    bindPaymentLaunchers();
    bindLoanControls();
    renderFintech();
    if (!state.transactions.length && state.depositPaid === 0) save();
  }

  window.resetFintechDemo = resetFintechDemo;
  window.loadSampleTenant = loadSampleTenant;
  window.loadSampleLandlord = loadSampleLandlord;
  document.addEventListener("DOMContentLoaded", initialize);
})();
