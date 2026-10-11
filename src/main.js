import "./style.css";

const STORAGE_KEY = "shodan-note.deals.v1";
const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
});
const number = new Intl.NumberFormat("ja-JP");
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a24 24 0 0 0 18 0M10 13h4"/>',
  chart: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  trash: '<path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>',
  leaf: '<path d="M20 4C9 2 3 8 6 15s15 7 14-11ZM6 19 16 9"/>',
};
function icon(name, className = "") {
  return `<svg class="icon ${className}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
function newDealId() {
  if (typeof globalThis.crypto.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  // randomUUID requires HTTPS; getRandomValues also works on a LAN development server.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function validDeal(deal) {
  return (
    deal &&
    typeof deal.id === "string" &&
    ["customer", "name", "nextAction", "createdAt", "updatedAt"].every(
      (key) => typeof deal[key] === "string",
    ) &&
    deal.customer.trim() &&
    deal.name.trim() &&
    deal.nextAction.trim() &&
    Number.isSafeInteger(deal.amount) &&
    deal.amount >= 0 &&
    deal.amount <= 999999999999 &&
    Number.isInteger(deal.probability) &&
    deal.probability >= 0 &&
    deal.probability <= 100
  );
}
let deals = [];
let storageReadable = true;
let loadError = "";
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const saved = JSON.parse(raw);
    if (
      saved.version !== 1 ||
      !Array.isArray(saved.deals) ||
      !saved.deals.every(validDeal) ||
      new Set(saved.deals.map((deal) => deal.id)).size !== saved.deals.length
    ) {
      throw new Error("Invalid saved data");
    }
    deals = saved.deals;
  }
} catch {
  storageReadable = false;
  loadError =
    "保存済みの案件を読み込めませんでした。データの上書きを防ぐため、保存を停止しています。ブラウザの保存設定をご確認ください。";
}
let filter = "all";
let query = "";
let sort = "updated";
let editingId = null;
let previousFocus = null;
let toastTimer;

document.querySelector("#app").innerHTML = `
  <aside class="sidebar">
    <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="商談ノート ホーム"><span class="brand-mark">n<span>.</span></span><span>商談ノート<small>SHODAN NOTE</small></span></a>
    <div class="sidebar-section">WORKSPACE</div>
    <div class="nav-item" aria-current="page">${icon("grid")}<span>案件管理</span><span class="nav-dot"></span></div>
    <div class="sidebar-note"><span class="note-icon">${icon("leaf")}</span><p>商談に、次の一歩を。</p><small>日々の小さなアクションが、<br>大きな成果につながります。</small></div>
    <div class="storage-note"><span class="status-dot"></span><span>このブラウザに保存<small>アカウント登録は不要です</small></span></div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div class="mobile-brand"><span class="brand-mark">n<span>.</span></span>商談ノート</div><span class="breadcrumb">ワークスペース <span>/</span> 案件管理</span><div class="topbar-right"><span class="today"></span><span class="avatar" aria-hidden="true">S</span></div></header>
    <main>
      <section class="page-heading"><div><p class="eyebrow">YOUR SALES, SIMPLIFIED</p><h1>案件管理<span class="heading-dot">.</span></h1><p class="subtitle">商談のいまを整理して、次の一歩を明確に。</p></div><button class="button button-primary add-button" data-add>${icon("plus")}案件を追加</button></section>
      <div id="storage-error" class="notice notice-error" role="alert" hidden></div>
      <section class="stats" aria-label="案件の集計">
        <article class="stat-card"><div class="stat-label">登録案件<span class="stat-icon">${icon("briefcase")}</span></div><div class="stat-value"><span id="total-count">0</span><small>件</small></div><p>すべての営業案件</p></article>
        <article class="stat-card"><div class="stat-label">見積総額<span class="stat-icon">${icon("chart")}</span></div><div class="stat-value money" id="total-amount">￥0</div><p>登録案件の見積金額合計</p></article>
        <article class="stat-card stat-featured"><div class="stat-label">受注見込み額<span class="stat-icon">${icon("chart")}</span></div><div class="stat-value money" id="weighted-amount">￥0</div><p>見積金額 × 受注確度の合計</p></article>
        <article class="stat-card"><div class="stat-label">受注案件<span class="stat-icon">${icon("check")}</span></div><div class="stat-value"><span id="won-count">0</span><small>件</small></div><p>受注確度が 100% の案件</p></article>
      </section>
      <div class="content-grid">
        <section class="deals-section" aria-labelledby="list-heading">
          <div class="section-heading"><div><h2 id="list-heading">案件一覧 <span id="list-count" class="count-badge">0</span></h2><p>大切な商談を、ひとつずつ。</p></div></div>
          <div class="list-controls"><label class="search-box">${icon("search")}<input type="search" id="search" aria-label="顧客名・案件名・次回アクションで検索" placeholder="顧客名・案件名で検索" /></label><label class="sort-box"><span class="sr-only">並び順</span><select id="sort"><option value="updated">更新が新しい順</option><option value="amount">見積金額が高い順</option><option value="probability">受注確度が高い順</option></select></label></div>
          <div class="filters" role="group" aria-label="受注状況で絞り込み"><button class="filter active" data-filter="all" aria-pressed="true">すべて <span>0</span></button><button class="filter" data-filter="active" aria-pressed="false">進行中 <span>0</span></button><button class="filter" data-filter="won" aria-pressed="false">受注 <span>0</span></button><button class="filter" data-filter="lost" aria-pressed="false">見送り <span>0</span></button></div>
          <div id="deal-list" class="deal-list"></div>
          <p id="results-summary" class="results-summary" role="status" aria-live="polite"></p>
        </section>
        <aside class="action-panel" aria-labelledby="action-heading"><div class="action-heading"><span class="action-heading-icon">${icon("arrow")}</span><div><p class="eyebrow">NEXT STEP</p><h2 id="action-heading">次のアクション</h2></div></div><p class="action-subtitle">進行中の案件から、次の一手を。</p><div id="action-list"></div><div class="action-footnote">${icon("clock")}最近更新した案件から表示</div></aside>
      </div>
      <footer class="page-footer"><span>ひとつの商談に、ひとつの次の一歩。</span><span>SHODAN NOTE</span></footer>
    </main>
  </div>
  <dialog id="deal-dialog" aria-labelledby="dialog-title"><form id="deal-form">
    <div class="dialog-header"><div><p class="eyebrow">DEAL DETAILS</p><h2 id="dialog-title">新しい案件</h2></div><button type="button" class="icon-button" data-close aria-label="閉じる">${icon("close")}</button></div>
    <p class="form-intro">商談の内容と、次にやることを記録しましょう。</p>
    <div class="form-fields">
      <label class="field">顧客名 <span class="required">必須</span><input id="customer" name="customer" autocomplete="organization" placeholder="例：株式会社グリーン" maxlength="100" required /></label>
      <label class="field">案件名 <span class="required">必須</span><input id="deal-name" name="name" placeholder="例：コーポレートサイト制作" maxlength="160" required /></label>
      <div class="form-row"><label class="field">見積金額 <span class="required">必須</span><div class="amount-input"><span>￥</span><input id="amount" name="amount" type="number" inputmode="numeric" min="0" max="999999999999" step="1" placeholder="500000" required /><span>円</span></div></label><label class="field">受注確度 <span class="required">必須</span><select id="probability" name="probability"><option value="0">0% — 見送り</option><option value="10">10%</option><option value="25">25%</option><option value="50" selected>50%</option><option value="75">75%</option><option value="90">90%</option><option value="100">100% — 受注</option></select></label></div>
      <div class="forecast-hint">${icon("chart")}この案件の受注見込み額 <strong id="form-forecast">￥0</strong></div>
      <label class="field">次回アクション <span class="required">必須</span><textarea id="next-action" name="nextAction" rows="3" maxlength="1000" placeholder="例：提案資料を送付し、来週の打ち合わせ日程を調整する" required></textarea><small>具体的な一歩を書いておくと、次の商談がスムーズに。</small></label>
    </div>
    <p id="form-error" class="notice notice-error" role="alert" hidden></p>
    <div class="dialog-footer"><button type="button" id="delete-deal" class="delete-button" hidden>${icon("trash")}削除</button><div class="form-buttons"><button type="button" class="button button-secondary" data-close>キャンセル</button><button type="submit" id="save-deal" class="button button-primary">${icon("check")}登録する</button></div></div>
  </form></dialog>
  <dialog id="delete-dialog" class="confirm-dialog" aria-labelledby="delete-title"><div class="dialog-header"><h2 id="delete-title">案件を削除しますか？</h2><button class="icon-button" id="cancel-delete-icon" aria-label="削除をキャンセル">${icon("close")}</button></div><p>「<span id="delete-name"></span>」を削除します。この操作は取り消せません。</p><p id="delete-error" class="notice notice-error" role="alert" hidden></p><div class="form-buttons"><button class="button button-secondary" id="cancel-delete">キャンセル</button><button class="button button-danger" id="confirm-delete">削除する</button></div></dialog>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden>${icon("check")}<span></span></div>
`;

document.querySelector(".today").textContent = new Intl.DateTimeFormat(
  "ja-JP",
  { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" },
).format(new Date());
if (loadError) {
  document.querySelector("#storage-error").hidden = false;
  document.querySelector("#storage-error").textContent = loadError;
}

function matchesFilter(deal, selected) {
  return (
    selected === "all" ||
    (selected === "active" && deal.probability > 0 && deal.probability < 100) ||
    (selected === "won" && deal.probability === 100) ||
    (selected === "lost" && deal.probability === 0)
  );
}
function getVisibleDeals() {
  const normalized = query.trim().toLocaleLowerCase("ja-JP");
  return deals
    .filter(
      (deal) =>
        matchesFilter(deal, filter) &&
        (!normalized ||
          [deal.customer, deal.name, deal.nextAction].some((value) =>
            value.toLocaleLowerCase("ja-JP").includes(normalized),
          )),
    )
    .sort((a, b) => {
      if (sort === "amount")
        return b.amount - a.amount || b.updatedAt.localeCompare(a.updatedAt);
      if (sort === "probability")
        return (
          b.probability - a.probability ||
          b.updatedAt.localeCompare(a.updatedAt)
        );
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}
function render() {
  document.querySelector("#total-count").textContent = number.format(
    deals.length,
  );
  document.querySelector("#total-amount").textContent = yen.format(
    deals.reduce((sum, deal) => sum + deal.amount, 0),
  );
  document.querySelector("#weighted-amount").textContent = yen.format(
    deals.reduce(
      (sum, deal) => sum + (deal.amount * deal.probability) / 100,
      0,
    ),
  );
  document.querySelector("#won-count").textContent = number.format(
    deals.filter((deal) => deal.probability === 100).length,
  );
  for (const button of document.querySelectorAll("[data-filter]")) {
    button.classList.toggle("active", button.dataset.filter === filter);
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === filter),
    );
    button.querySelector("span").textContent = deals.filter((deal) =>
      matchesFilter(deal, button.dataset.filter),
    ).length;
  }
  const visible = getVisibleDeals();
  document.querySelector("#list-count").textContent = visible.length;
  document.querySelector("#results-summary").textContent = deals.length
    ? `${deals.length} 件中 ${visible.length} 件を表示`
    : "";
  const list = document.querySelector("#deal-list");
  if (!visible.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-illustration"><span class="empty-ring"></span>${icon(deals.length ? "search" : "briefcase")}<span class="empty-spark">+</span></div><h3>${deals.length ? "条件に合う案件がありません" : "最初の商談を、ここから。"}</h3><p>${deals.length ? "検索ワードや絞り込み条件を変えてみてください。" : "顧客と案件、そして次にやること。<br>記録するだけで、商談が一歩前に進みます。"}</p>${deals.length ? '<button class="button button-secondary" id="reset-filters">条件をリセット</button>' : `<button class="button button-primary" data-add>${icon("plus")}最初の案件を登録</button><button class="sample-button" id="load-samples">まずはサンプルで試す ${icon("arrow")}</button>`}</div>`;
  } else {
    list.innerHTML = visible
      .map((deal) => {
        const state =
          deal.probability === 100
            ? "won"
            : deal.probability === 0
              ? "lost"
              : "active";
        const label = { won: "受注", lost: "見送り", active: "進行中" }[state];
        return `<article class="deal-card" data-id="${escapeHTML(deal.id)}"><div class="deal-top"><div class="customer-monogram" aria-hidden="true">${escapeHTML(Array.from(deal.customer.replace(/^株式会社\s*/, ""))[0] || "客")}</div><div class="deal-title"><p class="customer-name">${escapeHTML(deal.customer)}</p><h3>${escapeHTML(deal.name)}</h3></div><button class="icon-button edit-button" data-edit="${escapeHTML(deal.id)}" aria-label="${escapeHTML(deal.name)}を編集">${icon("edit")}</button></div><div class="deal-numbers"><div><span class="data-label">見積金額</span><strong class="deal-amount">${yen.format(deal.amount)}</strong></div><div class="probability"><div class="probability-label"><span class="data-label">受注確度</span><span class="probability-value ${state}">${deal.probability}<small>%</small></span></div><div class="progress-track"><span class="progress-fill ${state}" style="width:${deal.probability}%"></span></div></div><span class="deal-status ${state}"><span></span>${label}</span></div><div class="deal-next"><span class="next-icon">${icon("arrow")}</span><div><span class="data-label">次回アクション</span><p>${escapeHTML(deal.nextAction)}</p></div></div></article>`;
      })
      .join("");
  }
  const nextDeals = deals
    .filter((deal) => matchesFilter(deal, "active"))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  document.querySelector("#action-list").innerHTML = nextDeals.length
    ? nextDeals
        .map(
          (deal, index) =>
            `<button class="action-item" data-edit="${escapeHTML(deal.id)}"><span class="action-number">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHTML(deal.nextAction)}</strong><small>${escapeHTML(deal.customer)}<span> · </span>${escapeHTML(deal.name)}</small></span>${icon("arrow")}</button>`,
        )
        .join("")
    : '<div class="action-empty"><span class="action-empty-line"></span><p>次のアクションは、<br>案件を登録するとここに。</p><small>受注・見送りの案件は表示されません。</small></div>';
}

function persist(nextDeals) {
  if (!storageReadable)
    throw new Error(
      "保存済みデータを読み込めないため、保存できません。ブラウザの保存設定をご確認ください。",
    );
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, deals: nextDeals }),
    );
  } catch {
    throw new Error(
      "保存できませんでした。ブラウザの空き容量や保存設定をご確認ください。入力内容はこの画面に残っています。",
    );
  }
  deals = nextDeals;
  render();
}
function toast(message) {
  clearTimeout(toastTimer);
  const element = document.querySelector("#toast");
  element.querySelector("span").textContent = message;
  element.hidden = false;
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3500);
}
const dialog = document.querySelector("#deal-dialog");
const form = document.querySelector("#deal-form");
const deleteDialog = document.querySelector("#delete-dialog");
function updateForecast() {
  const amount = Number(form.elements.amount.value);
  document.querySelector("#form-forecast").textContent = yen.format(
    Number.isFinite(amount) && amount >= 0
      ? (amount * Number(form.elements.probability.value)) / 100
      : 0,
  );
}
function openForm(id = null) {
  editingId = id;
  const deal = deals.find((item) => item.id === id);
  previousFocus = document.activeElement;
  form.reset();
  document.querySelector("#form-error").hidden = true;
  for (const field of ["customer", "name", "amount", "nextAction"]) {
    form.elements[field].setCustomValidity("");
    if (deal) form.elements[field].value = deal[field];
  }
  if (deal) {
    if (
      !Array.from(form.elements.probability.options).some(
        (option) => Number(option.value) === deal.probability,
      )
    ) {
      form.elements.probability.add(
        new Option(`${deal.probability}%`, String(deal.probability)),
      );
    }
    form.elements.probability.value = String(deal.probability);
  }
  document.querySelector("#dialog-title").textContent = deal
    ? "案件を編集"
    : "新しい案件";
  document.querySelector("#save-deal").innerHTML =
    `${icon("check")}${deal ? "変更を保存" : "登録する"}`;
  document.querySelector("#delete-deal").hidden = !deal;
  updateForecast();
  dialog.showModal();
  document.body.classList.add("dialog-open");
  form.elements.customer.focus();
}
dialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  if (previousFocus?.isConnected) previousFocus.focus();
  else document.querySelector(".add-button").focus();
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  }
});
document.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  const edit = event.target.closest("[data-edit]");
  const close = event.target.closest("[data-close]");
  const filterButton = event.target.closest("[data-filter]");
  if (add) openForm();
  if (edit) openForm(edit.dataset.edit);
  if (close) dialog.close();
  if (filterButton) {
    filter = filterButton.dataset.filter;
    render();
  }
  if (event.target.closest("#reset-filters")) {
    filter = "all";
    query = "";
    document.querySelector("#search").value = "";
    render();
  }
  if (event.target.closest("#load-samples")) loadSamples();
});
document.querySelector("#search").addEventListener("input", (event) => {
  query = event.target.value;
  render();
});
document.querySelector("#sort").addEventListener("change", (event) => {
  sort = event.target.value;
  render();
});
form.addEventListener("input", (event) => {
  if (event.target.setCustomValidity) event.target.setCustomValidity("");
  updateForecast();
});
form.addEventListener("change", updateForecast);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  for (const name of ["customer", "name", "nextAction"]) {
    const input = form.elements[name];
    input.setCustomValidity(
      input.value.trim() ? "" : "空白以外の文字を入力してください。",
    );
  }
  const amount = Number(form.elements.amount.value);
  const probability = Number(form.elements.probability.value);
  form.elements.amount.setCustomValidity(
    Number.isSafeInteger(amount) && amount >= 0 && amount <= 999999999999
      ? ""
      : "見積金額は0〜999,999,999,999円の整数で入力してください。",
  );
  if (!form.reportValidity()) return;
  if (!Number.isInteger(probability) || probability < 0 || probability > 100)
    return;
  const existing = deals.find((deal) => deal.id === editingId);
  const now = new Date().toISOString();
  const deal = {
    id: existing?.id ?? newDealId(),
    customer: form.elements.customer.value.trim(),
    name: form.elements.name.value.trim(),
    amount,
    probability,
    nextAction: form.elements.nextAction.value.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  try {
    persist(
      existing
        ? deals.map((item) => (item.id === deal.id ? deal : item))
        : [...deals, deal],
    );
    dialog.close();
    toast(existing ? "案件を更新しました" : "案件を登録しました");
  } catch (error) {
    document.querySelector("#form-error").textContent = error.message;
    document.querySelector("#form-error").hidden = false;
  }
});
document.querySelector("#delete-deal").addEventListener("click", () => {
  const deal = deals.find((item) => item.id === editingId);
  if (!deal) return;
  document.querySelector("#delete-name").textContent = deal.name;
  document.querySelector("#delete-error").hidden = true;
  deleteDialog.showModal();
  document.querySelector("#cancel-delete").focus();
});
for (const id of ["cancel-delete", "cancel-delete-icon"])
  document
    .querySelector(`#${id}`)
    .addEventListener("click", () => deleteDialog.close());
document.querySelector("#confirm-delete").addEventListener("click", () => {
  try {
    persist(deals.filter((deal) => deal.id !== editingId));
    deleteDialog.close();
    dialog.close();
    toast("案件を削除しました");
  } catch (error) {
    document.querySelector("#delete-error").textContent = error.message;
    document.querySelector("#delete-error").hidden = false;
  }
});
function loadSamples() {
  if (deals.length) return;
  const now = new Date().toISOString();
  const samples = [
    {
      customer: "株式会社グリーン",
      name: "コーポレートサイトのリニューアル",
      amount: 1200000,
      probability: 75,
      nextAction: "提案資料を送付し、次回の打ち合わせ日程を調整する",
    },
    {
      customer: "青葉デザイン事務所",
      name: "営業支援ツールの導入",
      amount: 680000,
      probability: 50,
      nextAction: "担当者にデモ環境の感想をヒアリングする",
    },
    {
      customer: "合同会社つむぎ",
      name: "ブランドサイト制作",
      amount: 450000,
      probability: 100,
      nextAction: "キックオフの準備と制作スケジュールの共有",
    },
  ].map((deal) => ({
    ...deal,
    id: newDealId(),
    createdAt: now,
    updatedAt: now,
  }));
  try {
    persist(samples);
    toast("サンプル案件を登録しました。編集・削除してお試しください");
  } catch (error) {
    document.querySelector("#storage-error").textContent = error.message;
    document.querySelector("#storage-error").hidden = false;
  }
}
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  // Avoid silently overwriting changes made in another tab.
  storageReadable = false;
  const notice = document.querySelector("#storage-error");
  notice.textContent =
    "別のタブで案件が変更されました。最新の内容を読み込むため、このページを再読み込みしてください。保存は一時停止しています。";
  notice.hidden = false;
});
render();
