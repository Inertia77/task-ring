const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

for(const width of [390,1024,1440,1920]){
  test('GAME header keeps icon actions and separate text rows at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});
    await boot(page,'overview');
    await view(page,'game');

    const header=page.locator('#gameQuestPanel .gqV6Top');
    const manual=header.locator('[data-manual-time-entry="gamequest"]');
    const edit=header.locator('[data-open-game-editor]');
    await expect(header).toBeVisible();
    await expect(manual).toContainText('补记');
    await expect(edit).toContainText('编辑任务');
    await expect(manual.locator('.gameCommandIcon .trUiIcon')).toHaveCount(1);
    await expect(edit.locator('.gameCommandIcon .trUiIcon')).toHaveCount(1);
    await expect(header).not.toContainText('${taskUiIcon');
    await expect(header).not.toContainText('undefined');

    const boxes=await header.evaluate(el=>{
      const rect=selector=>el.querySelector(selector).getBoundingClientRect();
      const title=rect('.gameQuestTopTitle > strong');
      const description=rect('.gameQuestTopTitle > em');
      const side=rect('.gameQuestHeroSide');
      const panel=el.getBoundingClientRect();
      const actionBoxes=[...el.querySelectorAll('.gameQuestHeroSide > *')].map(x=>x.getBoundingClientRect());
      return {
        title:{top:title.top,bottom:title.bottom,left:title.left,right:title.right},
        description:{top:description.top,bottom:description.bottom,left:description.left,right:description.right},
        side:{left:side.left,right:side.right,top:side.top},
        panel:{left:panel.left,right:panel.right},
        actions:actionBoxes.map(x=>({left:x.left,right:x.right,width:x.width})),
        doc:document.documentElement.scrollWidth,
        viewport:innerWidth
      };
    });
    if(width>=901){
      expect(boxes.title.bottom,'desktop title must sit above description').toBeLessThanOrEqual(boxes.description.top+1);
      expect(boxes.description.right).toBeLessThanOrEqual(boxes.panel.right+1);
    }
    expect(boxes.actions.every(x=>x.width>=40&&x.right<=boxes.panel.right+1)).toBeTruthy();
    if(width>=1101)expect(boxes.title.right).toBeLessThanOrEqual(boxes.side.left+1);
    expect(boxes.doc).toBeLessThanOrEqual(boxes.viewport+1);

    await page.locator('[data-gqv6-board="weekly"]').click();
    await expect(header.locator('[data-open-game-editor] .gameCommandIcon .trUiIcon')).toHaveCount(1);
    await expect(header).not.toContainText('${taskUiIcon');
  });
}
