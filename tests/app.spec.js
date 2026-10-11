import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'shodan-note.deals.v1';
const standardDeal = {
  customer: '株式会社テスト',
  name: '営業管理システムの導入',
  amount: '200000',
  probability: '50',
  nextAction: '金曜日に提案資料を送付する',
};

async function fillDeal(page, fields = {}) {
  const deal = { ...standardDeal, ...fields };
  await page.locator('#customer').fill(deal.customer);
  await page.locator('#deal-name').fill(deal.name);
  await page.locator('#amount').fill(deal.amount);
  await page.locator('#probability').selectOption(deal.probability);
  await page.locator('#next-action').fill(deal.nextAction);
}

async function addDeal(page, fields = {}) {
  await page.locator('.add-button').click();
  await fillDeal(page, fields);
  await page.locator('#save-deal').click();
  await expect(page.locator('#deal-dialog')).not.toBeVisible();
}

async function storedDeals(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.deals ?? [], STORAGE_KEY);
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('案件管理.');
});

test('empty state, sample data, aggregates, and responsive screenshots', async ({ page }, testInfo) => {
  await expect(page.locator('#total-count')).toHaveText('0');
  await expect(page.locator('#deal-list')).toContainText('最初の商談を、ここから。');
  await page.locator('#load-samples').click();
  await expect(page.locator('.deal-card')).toHaveCount(3);
  await expect(page.locator('#total-count')).toHaveText('3');
  await expect(page.locator('#total-amount')).toHaveText('￥2,330,000');
  await expect(page.locator('#weighted-amount')).toHaveText('￥1,690,000');
  await expect(page.locator('#won-count')).toHaveText('1');
  await expect(page.locator('#action-list .action-item')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
  await page.reload();
  await expect(page.locator('.deal-card')).toHaveCount(3);
  await page.screenshot({ path: `/tmp/shodan-note-${testInfo.project.name}.png`, fullPage: true });
});

test('register all five fields, edit all fields, and persist after reload', async ({ page }) => {
  await page.locator('.add-button').click();
  await fillDeal(page);
  await expect(page.locator('#form-forecast')).toHaveText('￥100,000');
  await page.locator('#save-deal').click();
  await expect(page.locator('.deal-card')).toHaveCount(1);
  await expect(page.locator('#deal-list')).toContainText(standardDeal.customer);
  await expect(page.locator('#deal-list')).toContainText(standardDeal.name);
  await expect(page.locator('#deal-list')).toContainText(standardDeal.nextAction);
  await page.locator('.edit-button').click();
  await expect(page.locator('#customer')).toHaveValue(standardDeal.customer);
  await expect(page.locator('#deal-name')).toHaveValue(standardDeal.name);
  await expect(page.locator('#amount')).toHaveValue(standardDeal.amount);
  await expect(page.locator('#probability')).toHaveValue(standardDeal.probability);
  await expect(page.locator('#next-action')).toHaveValue(standardDeal.nextAction);
  const updated = { customer: '青空商事', name: '導入範囲の拡張', amount: '350000', probability: '75', nextAction: '来週に契約条件を確認する' };
  await fillDeal(page, updated);
  await expect(page.locator('#form-forecast')).toHaveText('￥262,500');
  await page.locator('#save-deal').click();
  await page.reload();
  await expect(page.locator('.deal-card')).toHaveCount(1);
  await expect(page.locator('#deal-list')).toContainText(updated.customer);
  await expect(page.locator('#deal-list')).toContainText(updated.name);
  await expect(page.locator('#deal-list')).toContainText(updated.nextAction);
  await expect(page.locator('#total-amount')).toHaveText('￥350,000');
  await expect(page.locator('#weighted-amount')).toHaveText('￥262,500');
  expect(await storedDeals(page)).toEqual([expect.objectContaining({
    customer: updated.customer, name: updated.name, amount: 350000, probability: 75, nextAction: updated.nextAction,
  })]);
});

test('cancel registration and edits, escape closes, and focus returns', async ({ page }) => {
  await page.locator('.add-button').click();
  await fillDeal(page);
  await page.locator('#deal-dialog').getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.deal-card')).toHaveCount(0);
  await expect(page.locator('.add-button')).toBeFocused();
  await addDeal(page);
  const saved = await storedDeals(page);
  await page.locator('.edit-button').click();
  await page.locator('#customer').fill('保存しない顧客');
  await page.keyboard.press('Escape');
  await expect(page.locator('#deal-dialog')).not.toBeVisible();
  await expect(page.locator('.edit-button')).toBeFocused();
  expect(await storedDeals(page)).toEqual(saved);
  await expect(page.locator('#deal-list')).toContainText(standardDeal.customer);
});

test('search customer, deal, and next action; filter 0%, in progress, and 100%', async ({ page }) => {
  await addDeal(page, { customer: 'みどり株式会社', name: '終了案件', amount: '0', probability: '0', nextAction: '見送り理由を記録' });
  await addDeal(page, { customer: 'Blue Corp', name: '継続商談', amount: '100000', probability: '50', nextAction: 'DEMOを実施する' });
  await addDeal(page, { customer: '赤い商事', name: '受注済み案件', amount: '300000', probability: '100', nextAction: '契約書を送付' });
  await expect(page.locator('#total-count')).toHaveText('3');
  await expect(page.locator('#total-amount')).toHaveText('￥400,000');
  await expect(page.locator('#weighted-amount')).toHaveText('￥350,000');
  await expect(page.locator('#won-count')).toHaveText('1');
  for (const [query, name] of [[' blue ', '継続商談'], ['受注済み', '受注済み案件'], ['demo', '継続商談']]) {
    await page.locator('#search').fill(query);
    await expect(page.locator('.deal-card')).toHaveCount(1);
    await expect(page.locator('.deal-card h3')).toHaveText(name);
  }
  await page.locator('#search').fill('存在しない案件');
  await expect(page.locator('#deal-list')).toContainText('条件に合う案件がありません');
  await page.locator('#reset-filters').click();
  await expect(page.locator('.deal-card')).toHaveCount(3);
  for (const [filter, name] of [['lost', '終了案件'], ['active', '継続商談'], ['won', '受注済み案件']]) {
    await page.locator(`[data-filter="${filter}"]`).click();
    await expect(page.locator(`[data-filter="${filter}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.deal-card')).toHaveCount(1);
    await expect(page.locator('.deal-card h3')).toHaveText(name);
    await expect(page.locator('#total-count')).toHaveText('3');
  }
  await expect(page.locator('#action-list .action-item')).toHaveCount(1);
  await expect(page.locator('#action-list')).toContainText('DEMOを実施する');
});

test('sort by amount and probability and open a deal from next actions', async ({ page, isMobile }) => {
  await addDeal(page, { name: '高額案件', amount: '900000', probability: '25' });
  await addDeal(page, { name: '高確度案件', amount: '100000', probability: '90' });
  await page.locator('#sort').selectOption('amount');
  await expect(page.locator('.deal-card h3').first()).toHaveText('高額案件');
  await page.locator('#sort').selectOption('probability');
  await expect(page.locator('.deal-card h3').first()).toHaveText('高確度案件');
  if (isMobile) {
    await expect(page.locator('.action-panel')).not.toBeVisible();
    await page.locator('.edit-button').first().click();
  } else {
    await page.locator('#action-list .action-item').first().click();
  }
  await expect(page.locator('#dialog-title')).toHaveText('案件を編集');
  await expect(page.locator('#deal-name')).toHaveValue('高確度案件');
});

test('delete confirmation can be cancelled; confirmed deletion updates storage and totals', async ({ page }) => {
  await addDeal(page);
  await page.locator('.edit-button').click();
  await page.locator('#delete-deal').click();
  await expect(page.locator('#delete-dialog')).toBeVisible();
  await expect(page.locator('#delete-name')).toHaveText(standardDeal.name);
  await page.locator('#cancel-delete').click();
  await expect(page.locator('#deal-dialog')).toBeVisible();
  await expect(page.locator('.deal-card')).toHaveCount(1);
  await page.locator('#delete-deal').click();
  await page.locator('#confirm-delete').click();
  await expect(page.locator('#delete-dialog')).not.toBeVisible();
  await expect(page.locator('#deal-dialog')).not.toBeVisible();
  await expect(page.locator('.deal-card')).toHaveCount(0);
  await expect(page.locator('#total-count')).toHaveText('0');
  await expect(page.locator('#total-amount')).toHaveText('￥0');
  expect(await storedDeals(page)).toEqual([]);
  await page.reload();
  await expect(page.locator('.deal-card')).toHaveCount(0);
});

test('required, whitespace-only, negative, fractional, and excessive amounts are rejected', async ({ page }) => {
  await page.locator('.add-button').click();
  await page.locator('#save-deal').click();
  await expect(page.locator('#deal-dialog')).toBeVisible();
  expect(await page.locator('#customer').evaluate((input) => input.validity.valueMissing)).toBe(true);
  await fillDeal(page);
  for (const field of ['#customer', '#deal-name', '#next-action']) {
    await page.locator(field).fill('   ');
    await page.locator('#save-deal').click();
    expect(await page.locator(field).evaluate((input) => input.validity.customError)).toBe(true);
    await expect(page.locator('.deal-card')).toHaveCount(0);
    await fillDeal(page);
  }
  for (const amount of ['-1', '1.5', '1000000000000']) {
    await page.locator('#amount').fill(amount);
    await page.locator('#save-deal').click();
    expect(await page.locator('#amount').evaluate((input) => input.checkValidity())).toBe(false);
    await expect(page.locator('#deal-dialog')).toBeVisible();
    await expect(page.locator('.deal-card')).toHaveCount(0);
  }
  await page.locator('#amount').fill('0');
  await page.locator('#save-deal').click();
  await expect(page.locator('.deal-card')).toHaveCount(1);
  expect((await storedDeals(page))[0].amount).toBe(0);
});

test('long text and HTML render safely without horizontal overflow on small screens', async ({ page }) => {
  const injection = '<img src=x onerror="window.__injected=true">';
  const fields = { customer: '顧'.repeat(100), name: '長'.repeat(100) + injection, amount: '999999999999', probability: '100', nextAction: 'x'.repeat(800) + injection };
  await addDeal(page, fields);
  await expect(page.locator('.deal-card h3')).toHaveText(fields.name);
  await expect(page.locator('.deal-next p')).toHaveText(fields.nextAction);
  await expect(page.locator('#deal-list img, #deal-list script')).toHaveCount(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await expectNoHorizontalOverflow(page);
    await page.locator('.edit-button').click();
    await expectNoHorizontalOverflow(page);
    const dialog = await page.locator('#deal-dialog').evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.width);
    await page.locator('#deal-dialog').getByRole('button', { name: 'キャンセル', exact: true }).click();
  }
});

test('storage write failure reports the error, preserves input, and allows retry', async ({ page }) => {
  await page.evaluate(() => {
    window.__originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('Test quota reached', 'QuotaExceededError'); };
  });
  await page.locator('.add-button').click();
  await fillDeal(page);
  await page.locator('#save-deal').click();
  await expect(page.locator('#form-error')).toContainText('保存できませんでした');
  await expect(page.locator('#deal-dialog')).toBeVisible();
  await expect(page.locator('#customer')).toHaveValue(standardDeal.customer);
  await expect(page.locator('#next-action')).toHaveValue(standardDeal.nextAction);
  await expect(page.locator('.deal-card')).toHaveCount(0);
  expect(await storedDeals(page)).toEqual([]);
  await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
  await page.locator('#save-deal').click();
  await expect(page.locator('.deal-card')).toHaveCount(1);
  expect((await storedDeals(page))[0].name).toBe(standardDeal.name);
});

test('corrupt and invalid saved data is preserved and blocks overwriting', async ({ page }) => {
  for (const broken of ['{broken-json', JSON.stringify({ version: 1, deals: [{ id: 'bad', customer: '不正データ' }] })]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: broken });
    await page.reload();
    await expect(page.locator('#storage-error')).toContainText('データの上書きを防ぐため、保存を停止');
    await page.locator('#load-samples').click();
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(broken);
    await page.locator('.add-button').click();
    await fillDeal(page);
    await page.locator('#save-deal').click();
    await expect(page.locator('#form-error')).toContainText('保存済みデータを読み込めない');
    await expect(page.locator('#customer')).toHaveValue(standardDeal.customer);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(broken);
    await page.locator('#deal-dialog').getByRole('button', { name: 'キャンセル', exact: true }).click();
  }
});

test('another tab changing data prevents silent overwrites until reload', async ({ page, context }) => {
  await addDeal(page);
  const otherPage = await context.newPage();
  await otherPage.goto('/');
  await otherPage.locator('.edit-button').click();
  await otherPage.locator('#customer').fill('別タブの更新');
  await otherPage.locator('#save-deal').click();
  await expect(page.locator('#storage-error')).toContainText('別のタブで案件が変更されました');
  await page.locator('.edit-button').click();
  await page.locator('#customer').fill('上書きしない変更');
  await page.locator('#save-deal').click();
  await expect(page.locator('#form-error')).toBeVisible();
  expect((await storedDeals(page))[0].customer).toBe('別タブの更新');
  await page.reload();
  await expect(page.locator('#storage-error')).not.toBeVisible();
  await expect(page.locator('#deal-list')).toContainText('別タブの更新');
  await otherPage.close();
});

test('registration works without crypto.randomUUID on a LAN HTTP connection', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
  });
  await page.reload();
  await addDeal(page);
  const saved = await storedDeals(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  await page.reload();
  await expect(page.locator('.deal-card h3')).toHaveText(standardDeal.name);
});
