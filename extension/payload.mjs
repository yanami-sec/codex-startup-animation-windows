import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {installRenderer} from './renderer.mjs';
export async function buildInjection(root,{deferStart=false}={}){
  const [html,css,skin,settings,contours,config,animation,avatar,artwork]=await Promise.all([
    'index.html','style.css','extension/wallpaper.css','image-settings.js','assets/contours.js','assets/config.js','animation.js','assets/avatar.jpg','assets/artwork.jpg'
  ].map(name=>readFile(join(root,name))));
  const payload={html:html.toString().replace(/<!doctype[^>]*>/ig,'').replace(/<html[^>]*>|<\/html>/ig,'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/ig,'').replace(/<link\b[^>]*>/ig,'')
    .replace(/<meta\b[^>]*http-equiv[^>]*>/ig,'').replace(/src="assets\/[^"]*"/g,'src=""'),
    deferStart,css:css.toString(),skin:skin.toString(),assets:{avatar:'data:image/jpeg;base64,'+avatar.toString('base64'),artwork:'data:image/jpeg;base64,'+artwork.toString('base64')}};
  // Bind animation globals to the temporary iframe so removing it stops its work.
  const mount=`function(window){const document=window.document,location=window.location,performance=window.performance,indexedDB=window.indexedDB,Image=window.Image,Path2D=window.Path2D,URL=window.URL,module=undefined;const requestAnimationFrame=window.requestAnimationFrame.bind(window),cancelAnimationFrame=window.cancelAnimationFrame.bind(window);\n${settings}\n${contours}\n${config}\n${animation}\n}`;
  return `(${installRenderer.toString()})(${JSON.stringify(payload)},${mount})`;
}
