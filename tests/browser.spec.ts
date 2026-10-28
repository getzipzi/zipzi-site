import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test('static HTTP responses and missing routes have correct status and MIME', async ({ request }) => {
  for (const [route, status, mime] of [
    ['/', 200, 'text/html'],
    ['/robots.txt', 200, 'text/plain'],
    ['/sitemap.xml', 200, 'application/xml'],
    ['/sitemap-index.xml', 200, 'application/xml'],
    ['/does-not-exist', 404, 'text/html'],
    ['/404.html', 404, 'text/html'],
    ['/_astro/missing.js', 404, 'text/html'],
  ] as const) {
    const response = await request.get(route);
    expect(response.status()).toBe(status);
    expect(response.headers()['content-type']).toContain(mime);
    if (status === 404) expect(await response.text()).toContain('PAGE NOT FOUND');
  }
});

test('page has no runtime errors, missing images, overflow, or third-party requests', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)
      )
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(requests.filter((url) => !url.startsWith('http://127.0.0.1:4173/'))).toEqual([]);
  await mkdir('qa/screenshots', { recursive: true });
  await page.screenshot({ path: `qa/screenshots/${testInfo.project.name}-full.png`, fullPage: true });
  await page.screenshot({ path: `qa/screenshots/${testInfo.project.name}-hero.png` });
});

test('navigation works with keyboard, Escape, anchors and viewport changes', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByText('跳转到主要内容')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  const button = page.locator('button[aria-controls="primary-navigation"]');
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeHidden();
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: '编辑器' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await page.getByRole('navigation').getByRole('link', { name: '工作流' }).click();
    await expect(page).toHaveURL(/#workflow$/);
    await expect(page.locator('#workflow')).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(button).toBeHidden();
  } else {
    await page.getByRole('navigation').getByRole('link', { name: '开发者' }).click();
    await expect(page).toHaveURL(/#developers$/);
  }
});

test('FAQ is keyboard-operable and reduced motion disables smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  const summary = page.locator('summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).not.toHaveAttribute('open', '');
});

test('home, expanded navigation, and 404 pass WCAG A/AA automated checks', async ({ page }) => {
  await page.goto('/');
  const scan = async () => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations).toEqual([]);
  };
  await scan();
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole('button', { name: '打开导航' }).click();
    await scan();
  }
  await page.goto('/missing');
  await scan();
});

test('primary content and navigation remain usable without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
