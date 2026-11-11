import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test('browser tab and social titles preserve the filed website name without duplicate suffixes', async ({ page }) => {
  for (const [route, title] of [
    ['/', 'Zipzi 2D — Open Source Live2D Cubism Editor Alternative'],
    ['/missing-title-check', 'Page not found | Zipzi 2D'],
  ]) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
  }
});

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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Zipzi 2D');
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
  await page.goto('/zh-cn/');
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
    await page.getByRole('navigation').getByRole('link', { name: 'AI 协作' }).click();
    await expect(page).toHaveURL(/#developers$/);
    await expect(page.locator('#developers')).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(button).toBeHidden();
  } else {
    await page.getByRole('navigation').getByRole('link', { name: 'AI 协作' }).click();
    await expect(page).toHaveURL(/#developers$/);
  }
});

test('FAQ is keyboard-operable and reduced motion disables smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  const summary = page.locator('.faq-list summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.faq-list details').first()).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(page.locator('.faq-list details').first()).not.toHaveAttribute('open', '');
});

test('home, expanded navigation, and 404 pass WCAG A/AA automated checks', async ({ page }) => {
  await page.goto('/zh-cn/');
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

test('right-side GitHub text link and all download actions navigate to the requested public pages', async ({
  page,
}) => {
  const repository = 'https://github.com/getzipzi/zipzi-2d';
  const releases = `${repository}/releases`;
  await page.route(`${repository}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Navigation target</h1>' })
  );
  await page.goto('/zh-cn/');
  const github = page.getByRole('link', { name: 'Zipzi 2D GitHub 项目', exact: true });
  expect((await page.locator('.site-header').boundingBox())!.height).toBeLessThanOrEqual(81);
  if ((page.viewportSize()?.width ?? 0) < 768) await page.locator('.menu-toggle').click();
  await expect(github).toBeVisible();
  await expect(github).toHaveText('GitHub');
  await expect(github.locator('svg')).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const box = await github.boundingBox();
    expect(box!.x).toBeGreaterThan((page.viewportSize()?.width ?? 0) / 2);
    expect(box!.y).toBeLessThan(80);
  }
  await github.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(repository);
  await page.goto('/zh-cn/');
  const downloads = page.getByRole('link', { name: /下载/ });
  await expect(downloads).toHaveCount(3);
  for (const download of await downloads.all()) {
    await expect(download).toHaveAttribute('href', releases);
    await expect(download).toBeVisible();
    await download.focus();
    await expect(download).toBeFocused();
  }
  await downloads.first().click();
  await expect(page).toHaveURL(releases);
});

test('new editor screenshot keeps its full frame and a readable full-size destination', async ({ page, request }) => {
  await page.goto('/zh-cn/');
  const screenshot = page.getByRole('img', { name: /猫模型图层/ });
  await expect(screenshot).toBeVisible();
  expect(
    await screenshot.evaluate((image) => {
      const rect = image.getBoundingClientRect();
      return Math.abs(rect.width / rect.height - 2204 / 1486) < 0.01;
    })
  ).toBe(true);
  const original = page.getByRole('link', { name: '查看完整的 Zipzi 编辑器截图（新标签页）' });
  await expect(original).toHaveAttribute('href', '/media/editor-screenshot.jpg');
  const response = await request.get('/media/editor-screenshot.jpg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/jpeg');
  const release = page.locator('#release');
  await expect(release).toContainText('GitHub Releases');
  await expect(release).not.toContainText(/v?\d+\.\d+\.\d+|\d{4}-\d{2}-\d{2}|发布于/);
});

test('navigation and footer render the same reviewed SVG logo without the old raster source', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#zipzi-brand-artwork')).toHaveCount(1);
  const marks = page.locator('.brand-icon');
  await expect(marks).toHaveCount(2);
  for (const mark of await marks.all()) {
    await expect(mark).toBeVisible();
    await expect(mark.locator('use')).toHaveAttribute('href', '#zipzi-brand-artwork');
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(
      await mark.evaluate((svg) => {
        const drawing = (svg as SVGSVGElement).getBBox();
        return drawing.width > 400 && drawing.height > 450;
      })
    ).toBe(true);
  }
  await expect(page.locator('.brand img, .footer-brand img')).toHaveCount(0);
  const wordmarks = page.locator('.brand-wordmark');
  await expect(wordmarks).toHaveCount(2);
  for (const wordmark of await wordmarks.all()) {
    await expect(wordmark).toBeVisible();
    await expect(wordmark).toHaveAttribute('viewBox', '0 0 720 310');
    expect(await wordmark.locator('path').count()).toBe(5);
  }
  await page.locator('.brand .brand-icon').screenshot({ path: `qa/screenshots/${testInfo.project.name}-logo.png` });
  await page.locator('.site-footer').screenshot({ path: `qa/screenshots/${testInfo.project.name}-footer.png` });
});

for (const [prefix, lang, hero, errorTitle] of [
  ['zh-cn', 'zh-CN', '开源二维建模与动画。', '页面未找到'],
  ['ja', 'ja', 'オープンソースの2Dモデリングとアニメーション。', 'ページが見つかりません'],
  ['zh-tw', 'zh-TW', '開源二維建模與動畫。', '找不到頁面'],
  ['ko', 'ko', '오픈 소스 2D 모델링과 애니메이션.', '페이지를 찾을 수 없습니다'],
]) {
  test(`${prefix}: translated content, language switching, error routing and accessibility`, async ({ page }) => {
    const response = await page.goto(`/${prefix}/`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('h1')).toContainText(hero);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://zipzi2d.com/${prefix}/`);
    await expect(page.locator('link[rel="alternate"]')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    const toggle = page.locator('.menu-toggle');
    if ((page.viewportSize()?.width ?? 0) < 768) {
      await toggle.click();
      await expect(toggle).not.toHaveAttribute('aria-label', /[开关]导航/);
    }
    const picker = page.locator('.language-switch');
    await picker.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(picker).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(picker).not.toHaveAttribute('open');
    await picker.locator('summary').click();
    await page.evaluate(() => history.replaceState(null, '', '#developers'));
    await picker.locator('a[lang="zh-CN"]').click();
    await expect(page).toHaveURL(/\/zh-cn\/#developers$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    const missing = await page.goto(`/${prefix}/missing-page`);
    expect(missing?.status()).toBe(404);
    await expect(page).toHaveTitle(`${errorTitle} | Zipzi 2D`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await page.screenshot({ path: `qa/screenshots/${prefix}-404.png`, fullPage: true });
      await page.goto(`/${prefix}/`);
      await page.screenshot({ path: `qa/screenshots/${prefix}-home.png`, fullPage: true });
    }
  });
}

test('English is the main site and legacy English links preserve anchors', async ({ page }) => {
  await page.goto('/en/#developers');
  await expect(page).toHaveURL('http://127.0.0.1:4173/#developers');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://zipzi2d.com/');
});
