import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FabricImage, getEnv, setEnv } from 'fabric'
import { getEnv as nodeEnv } from 'fabric/node'
import { createStickerCanvas, initializeStickerCanvas, paintQuickSelection, previewQuickSelection, hasQuickSelection, setQuickSelectionAutoErase, setQuickSelectionOptions, invertQuickSelection, deleteSelectedObjects, undo, redo, exportStickerBlob, setEditorTool, updateStickerImageSmoothing } from '../src/index.ts'
import { selectBrushRegion, prepareSelectionColors, selectionRectangles } from '../src/images/quickSelectionPixels.ts'
import { selectionContours } from '../src/images/selectionContours.ts'
setEnv(nodeEnv()); globalThis.document = getEnv().document

test('brush selection follows edges, ignores fine texture, and stays local', () => {
  const width=128,height=80,pixels=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.set(x<64?[190,140,120,255]:[20,25,35,255],(y*width+x)*4)
  // Small freckles must not leave holes in a skin selection.
  for(let y=20;y<60;y+=7)for(let x=20;x<60;x+=7)pixels.set([95,65,50,255],(y*width+x)*4)
  const colors=prepareSelectionColors(pixels,width,height)
  const selected=selectBrushRegion(pixels,colors,width,height,45,40,10,10)
  assert.equal(selected[40*width+45],1)
  assert.equal(selected[41*width+41],1,'small texture is included')
  assert.equal(selected[40*width+70],0,'dark region is separated by its edge')
  assert.equal(selected[40*width],0,'selection cannot flood across the image')
  assert.ok(selected.reduce((a,b)=>a+b)>300)
  pixels[(40*width+45)*4+3]=0
  assert.equal(selectBrushRegion(pixels,colors,width,height,45,40,10,10).some(Boolean),false)
  const mask=new Uint8Array(18);for(let y=0;y<3;y++){mask[y*6]=mask[y*6+1]=1}
  assert.deepEqual(selectionRectangles(mask,6,3),[{x:0,y:0,width:2,height:3}])
})

test('Add, Subtract, Invert and Delete erase pixels while preserving layers and undo/export', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  try {
    const source = document.createElement('canvas'); source.width=source.height=64
    const context=source.getContext('2d'); context.fillStyle='#ff0000';context.fillRect(0,0,32,64);context.fillStyle='#0000ff';context.fillRect(32,0,32,64)
    const image=await initializeStickerCanvas(canvas,source.toDataURL(),{topText:'TOP',bottomText:'BOTTOM'})
    image.set({scaleX:1,scaleY:1});canvas.setActiveObject(image);setEditorTool(canvas,'quick-selection');setQuickSelectionOptions(canvas,'add',16)
    const initialHistory=canvas.history.length
    previewQuickSelection(canvas,image,10,10)
    assert.equal(hasQuickSelection(canvas),false,'hover preview is not committed')
    assert.equal(canvas.history.length,initialHistory,'hover does not write history')
    paintQuickSelection(canvas,image,10,10);assert.equal(hasQuickSelection(canvas),true)
    setQuickSelectionOptions(canvas,'subtract',16);paintQuickSelection(canvas,image,10,10);assert.equal(hasQuickSelection(canvas),false)
    setQuickSelectionOptions(canvas,'add',16);paintQuickSelection(canvas,image,10,10);invertQuickSelection(canvas)
    const count=canvas.getObjects().length
    deleteSelectedObjects(canvas);assert.equal(canvas.getObjects().length,count);assert.equal(hasQuickSelection(canvas),false)
    const readAlpha=image=>{const target=document.createElement('canvas');target.width=target.height=64;const ctx=target.getContext('2d');ctx.drawImage(image.getElement(),0,0);return ctx.getImageData(0,0,64,64).data}
    assert.equal(readAlpha(image)[(10*64+50)*4+3],0);assert.equal(readAlpha(image)[(10*64+10)*4+3],255)
    assert.equal(canvas.history.length,2)
    updateStickerImageSmoothing(canvas,image,25,false);assert.equal(readAlpha(image)[(10*64+50)*4+3],0,'roundness preserves deletion')
    await undo(canvas);let restored=canvas.getObjects().find(o=>o instanceof FabricImage);assert.equal(readAlpha(restored)[(10*64+50)*4+3],255)
    await redo(canvas);restored=canvas.getObjects().find(o=>o instanceof FabricImage);assert.equal(readAlpha(restored)[(10*64+50)*4+3],0)
    assert.ok((await exportStickerBlob(canvas)).size>0)
    canvas.setActiveObject(restored);deleteSelectedObjects(canvas);assert.equal(canvas.getObjects().length,count,'Delete without an area in selection mode never removes the layer')
  } finally { await canvas.dispose() }
})


test('selection contour preserves holes and makes closed paths for marching ants', () => {
  const ring=new Uint8Array([1,1,1,1,0,1,1,1,1])
  const contours=selectionContours(ring,3,3)
  assert.equal(contours.length,2,'outer perimeter and inner hole are separate')
  let length=0
  for(const contour of contours){
    assert.deepEqual(contour.slice(0,2),contour.slice(-2),'every perimeter is closed')
    for(let i=2;i<contour.length;i+=2){
      const distance=Math.abs(contour[i]-contour[i-2])+Math.abs(contour[i+1]-contour[i-1])
      assert.equal(distance,1,'no bridges across the selection')
      length+=distance
    }
  }
  assert.equal(length,16)
  assert.deepEqual(selectionContours(new Uint8Array(9),3,3),[])
})


test('Auto erase waits for release, forces Add, and preserves one undo step per gesture', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  try {
    const source = document.createElement('canvas'); source.width = source.height = 64
    const context = source.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, 64, 64)
    const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM' })
    image.set({ scaleX: 1, scaleY: 1 }); canvas.setActiveObject(image); setEditorTool(canvas, 'quick-selection')
    setQuickSelectionOptions(canvas, 'subtract', 16); setQuickSelectionAutoErase(canvas, true)
    setQuickSelectionOptions(canvas, 'subtract', 16)
    const initialHistory = canvas.history.length, count = canvas.getObjects().length
    previewQuickSelection(canvas, image, 10, 10); canvas.fire('mouse:up', {})
    assert.equal(image.stickerErasedRegions?.length ?? 0, 0, 'hover and unrelated release do not erase')
    const point = { x: image.getCenterPoint().x - 22, y: image.getCenterPoint().y - 22 }
    const event = { scenePoint: point, e: { button: 0, altKey: true } }
    canvas.fire('mouse:down:before', event); canvas.fire('mouse:down', event)
    assert.equal(hasQuickSelection(canvas), true, 'Subtract and Alt are ignored in Auto erase')
    assert.equal(canvas.history.length, initialHistory, 'painting does not write history')
    canvas.fire('mouse:up', event)
    assert.equal(hasQuickSelection(canvas), false); assert.equal(canvas.getObjects().length, count)
    assert.equal(canvas.history.length, initialHistory + 1)
    const alpha = target => {
      const surface = document.createElement('canvas'); surface.width = surface.height = 64
      const ctx = surface.getContext('2d'); ctx.drawImage(target.getElement(), 0, 0)
      return ctx.getImageData(10, 10, 1, 1).data[3]
    }
    assert.equal(alpha(image), 0)
    await undo(canvas); assert.equal(alpha(canvas.getObjects().find(o => o instanceof FabricImage)), 255)
    await redo(canvas); assert.equal(alpha(canvas.getObjects().find(o => o instanceof FabricImage)), 0)
    const restored = canvas.getObjects().find(o => o instanceof FabricImage); canvas.setActiveObject(restored)
    const secondHistory = canvas.historyIndex
    const secondPoint = { x: restored.getCenterPoint().x + 13, y: restored.getCenterPoint().y + 13 }
    const secondEvent = { scenePoint: secondPoint, e: { button: 0 } }
    canvas.fire('mouse:down:before', secondEvent); canvas.fire('mouse:down', secondEvent); canvas.fire('mouse:up', secondEvent)
    assert.equal(canvas.historyIndex, secondHistory + 1, 'the next gesture reads the edited image and creates its own undo step')
    await undo(canvas)
    const manualImage = canvas.getObjects().find(o => o instanceof FabricImage); canvas.setActiveObject(manualImage)
    setQuickSelectionAutoErase(canvas, false); setQuickSelectionOptions(canvas, 'add', 16)
    paintQuickSelection(canvas, manualImage, 45, 45); canvas.fire('mouse:up', {})
    assert.equal(hasQuickSelection(canvas), true, 'turning off returns to manual selection')
  } finally { await canvas.dispose() }
})
