const {test,expect}=require('@playwright/test');
const {boot}=require('./helpers');

async function studio(page){
  await boot(page,'overview');
  await page.locator('#controlCenterBtn').click();
  await page.locator('#controlWorkbenchBtn').click();
  await expect(page.locator('#taskWorkbench')).toBeVisible();
}

const rect=e=>({left:e.left,right:e.right,top:e.top,bottom:e.bottom,width:e.width,height:e.height});

for(const width of [320,390,430,760]){
  test('mobile Config Studio is a full-width list/detail flow at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:844});
    await studio(page);
    const root=page.locator('#taskWorkbench');
    await expect(root).toHaveAttribute('data-screen','list');

    const initial=await page.evaluate(()=>{
      const wb=document.querySelector('#taskWorkbench');
      const r=selector=>wb.querySelector(selector).getBoundingClientRect();
      const style=getComputedStyle(wb.querySelector('.wb-nav'));
      return {
        viewport:innerWidth,
        rootScroll:wb.scrollWidth,
        documentScroll:document.documentElement.scrollWidth,
        layout:r('.wb-layout').toJSON(),
        nav:r('.wb-nav').toJSON(),
        list:r('.wb-lists').toJSON(),
        editorDisplay:getComputedStyle(wb.querySelector('.wb-editor')).display,
        navDirection:style.flexDirection,
        navOverflow:style.overflowX,
        controls:[...wb.querySelectorAll('.wb-top-actions > button')].map(x=>x.getBoundingClientRect().toJSON()),
        listCards:[...wb.querySelectorAll('.wb-list-entry')].slice(0,2).map(x=>x.getBoundingClientRect().toJSON())
      };
    });
    expect(initial.navDirection).toBe('row');
    expect(initial.navOverflow).toBe('auto');
    expect(initial.nav.width).toBeGreaterThanOrEqual(width-2);
    expect(initial.nav.left).toBeGreaterThanOrEqual(-1);
    expect(initial.list.left).toBeGreaterThanOrEqual(-1);
    expect(initial.list.width).toBeGreaterThan(width-28);
    expect(initial.list.right).toBeLessThanOrEqual(width+1);
    expect(initial.editorDisplay).toBe('none');
    expect(initial.controls).toHaveLength(5);
    expect(initial.controls.every(x=>x.height>=44)).toBeTruthy();
    expect(initial.controls.every(x=>x.right<=width+1)).toBeTruthy();
    expect(initial.listCards.every(x=>x.width>width-42)).toBeTruthy();
    expect(initial.rootScroll).toBeLessThanOrEqual(width+1);
    expect(initial.documentScroll).toBeLessThanOrEqual(width+1);

    await root.locator('.wb-list-entry').first().click();
    await expect(root).toHaveAttribute('data-screen','detail');
    await expect(root.locator('[data-wb-back]')).toBeVisible();
    await expect(root.locator('[name="title"]')).toBeVisible();
    const detail=await page.evaluate(()=>{
      const wb=document.querySelector('#taskWorkbench');
      const editor=wb.querySelector('.wb-editor').getBoundingClientRect();
      return {
        editor:editor.toJSON(),
        hiddenList:getComputedStyle(wb.querySelector('.wb-lists')).display,
        width:document.documentElement.scrollWidth
      };
    });
    expect(detail.hiddenList).toBe('none');
    expect(detail.editor.width).toBeGreaterThan(width-28);
    expect(detail.editor.left).toBeGreaterThanOrEqual(-1);
    expect(detail.editor.right).toBeLessThanOrEqual(width+1);
    expect(detail.width).toBeLessThanOrEqual(width+1);

    await root.locator('[name="title"]').fill('手机工作台布局测试 '+width);
    await root.locator('[data-wb-back]').click();
    await expect(root).toHaveAttribute('data-screen','list');
    await expect(root.locator('.wb-list-entry').first()).toContainText('手机工作台布局测试 '+width);
    await root.locator('[data-wb-save]').first().click();
    await expect(root.locator('.wb-feedback')).toContainText('已保存');
    await page.screenshot({path:'test-results/visual/'+test.info().project.name+'/workbench-mobile/'+width+'.png'});
  });
}

test('mobile domain rail scrolls without creating a desktop sidebar',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await studio(page);
  const root=page.locator('#taskWorkbench');
  await root.locator('[data-wb-domain="refs"]').click();
  await expect(root.locator('[data-wb-domain="refs"]')).toHaveAttribute('aria-current','page');
  const dimensions=await page.evaluate(()=>{
    const wb=document.querySelector('#taskWorkbench');
    const nav=wb.querySelector('.wb-nav'),list=wb.querySelector('.wb-lists');
    return {scrollLeft:nav.scrollLeft,scrollWidth:nav.scrollWidth,clientWidth:nav.clientWidth,
      listWidth:list.getBoundingClientRect().width,viewport:innerWidth};
  });
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.scrollLeft).toBeGreaterThan(0);
  expect(dimensions.listWidth).toBeGreaterThan(360);
  await root.locator('[data-wb-domain="tasks"]').click();
  await expect(root.locator('[data-wb-domain="tasks"]')).toHaveAttribute('aria-current','page');
});

test('desktop three-pane Config Studio remains unchanged',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await studio(page);
  const positions=await page.evaluate(()=>{
    const wb=document.querySelector('#taskWorkbench');
    return ['.wb-nav','.wb-lists','.wb-editor'].map(s=>wb.querySelector(s).getBoundingClientRect().toJSON());
  });
  expect(positions[0].right).toBeLessThanOrEqual(positions[1].left+1);
  expect(positions[1].right).toBeLessThanOrEqual(positions[2].left+1);
  expect(positions[2].width).toBeGreaterThan(300);
});
