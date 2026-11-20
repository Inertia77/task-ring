const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

for(const width of [320,390,768,1440]){
  test('visual system icon vocabulary and module identities remain usable at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});
    await boot(page,'overview');
    await expect(page.locator('html')).toHaveAttribute('data-build','20261118.visual-language-v4');
    await expect(page.locator('#viewDock [data-view-target="overview"] .trUiIcon')).toBeVisible();
    await expect(page.locator('#viewDock [data-view-target="game"] .trUiIcon')).toBeVisible();
    await expect(page.locator('#viewDock [data-view-target="learning"] .trUiIcon')).toBeVisible();
    expect(await page.locator('#viewDock [data-view-target="overview"] .trUiIcon').innerHTML())
      .not.toBe(await page.locator('#viewDock [data-view-target="learning"] .trUiIcon').innerHTML());
    await expect(page.locator('#commandCenter .commandHero .trHeroIcon .trUiIcon')).toBeVisible();
    await expect(page.locator('#commandCenter .commandMetrics .trMetricLabel .trUiIcon')).toHaveCount(4);
    await expect(page.locator('#commandCenter .commandTaskIdentity .trTaskMeta').first()).toBeVisible();
    await expect(page.locator('#commandCenter .commandGroup .trGroupIcon').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:'test-results/visual/'+test.info().project.name+'/visual-system-v4/'+width+'-overview.png'});
    await view(page,'learning');
    await expect(page.locator('#learningCenter .trHeroIcon .trUiIcon')).toBeVisible();
    await expect(page.locator('#learningCenter .studyTrack .trStudyKicker .trUiIcon')).toHaveCount(2);
    await view(page,'game');
    await expect(page.locator('#gameQuestPanel .gqV6Top .trTitleWithIcon .trUiIcon')).toBeVisible();
    await expect(page.locator('#gameQuestPanel .gqV6BoardTab .trTabName .trUiIcon')).toHaveCount(3);
    await view(page,'fitness');
    await expect(page.locator('#fitnessPanel .fitnessHero h2 .trUiIcon')).toBeVisible();
    await view(page,'time');
    await expect(page.locator('#timePanel .timePanelHeader .trUiIcon').first()).toBeVisible();
    await view(page,'library');
    await expect(page.locator('#refBox .refSummaryIcon .trUiIcon')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('control-center and editor use the same icon family while keeping all actions',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,'overview');
  await page.locator('#controlCenterBtn').click();
  // The compact maintenance panel consolidates one of the original section titles at runtime.
  await expect(page.locator('#controlCenterMenu .trSectionIcon .trUiIcon')).toHaveCount(3);
  await expect(page.locator('#controlCenterMenu .controlUtilityIcon .trUiIcon').first()).toBeVisible();
  await expect(page.locator('#controlCenterMenu .trWorkbenchLaunchIcon .trUiIcon')).toBeVisible();
  await page.locator('#controlWorkbenchBtn').click();
  await expect(page.locator('#taskWorkbench')).toBeVisible();
  await expect(page.locator('#taskWorkbench .wb-nav .trStudioNavIcon .trUiIcon')).toHaveCount(6);
  await expect(page.locator('#taskWorkbench .trSearchIcon .trUiIcon')).toBeVisible();
  await page.locator('#taskWorkbench [data-wb-domain="game"]').click();
  await expect(page.locator('#taskWorkbench [data-wb-domain="game"]')).toHaveAttribute('aria-current','page');
  await page.locator('#taskWorkbench [data-wb-close]').click();
  await expect(page.locator('#taskWorkbench')).toBeHidden();
  await expect(page.locator('#viewDock [data-view-target="overview"]')).toHaveAttribute('aria-current','page');
});

test('More actions and compact page navigation render visible labels as well as icons',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await boot(page,'overview');
  await view(page,'more');
  await expect(page.locator('#commandMore .trMoreIcon .trUiIcon')).toHaveCount(4);
  await expect(page.locator('#commandMore .commandMoreGrid>button')).toHaveCount(4);
  await expect(page.locator('#commandMore [data-workbench-open], #commandMore [data-command-manage]')).toHaveCount(0);
  await expect(page.locator('#commandMore [data-view-target="time"]')).toContainText('时间账本');
  await expect(page.locator('#controlWorkbenchBtn')).toHaveAttribute('data-workbench-open','tasks');
  await expect(page.locator('#commandMore [data-view-target="tasks"]')).toContainText('每日任务');
  await expect(page.locator('#commandMore [data-view-target="weekly"]')).toContainText('周计划');
  await expect(page.locator('#commandMore [data-view-target="library"]')).toContainText('资料库');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('reduced-motion option preserves action focus and status readability',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await boot(page,'overview');
  const required=page.locator('#commandCenter .commandCard').first();
  await expect(required).toBeVisible();
  const title=page.locator('#commandCenter .commandHero h1');
  await expect(title).toContainText('任务总览');
  await page.locator('#controlCenterBtn').focus();
  await expect(page.locator('#controlCenterBtn')).toBeFocused();
  await expect(page.locator('#commandCenter .commandMetrics strong').first()).toBeVisible();
});
