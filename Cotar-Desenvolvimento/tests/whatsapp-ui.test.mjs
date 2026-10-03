import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountWhatsApp} from '../public/whatsapp.js';
test('WhatsApp setup saves typed credentials and shows webhook without exposing saved token',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'});globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;
 const root=document.querySelector('#root'),calls=[],config={configured:false,enabled:false,accountSid:'',from:'',mode:'sandbox',canConfigure:true};
 const api=async(path,options)=>{calls.push([path,options]);if(options)return {...config,configured:true,webhook:'https://example.test/api/whatsapp/webhook/key'};return config;};
 const dispose=mountWhatsApp(root,{api,toast:()=>{},leads:[]});await new Promise(r=>setTimeout(r,0));
 const form=root.querySelector('#wa-config');form.querySelector('[name=accountSid]').value='AC'+'a'.repeat(32);form.querySelector('[name=authToken]').value='b'.repeat(32);form.querySelector('[name=from]').value='+14155238886';form.querySelector('[name=enabled]').checked=true;
 form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));
 const body=JSON.parse(calls.find(c=>c[1])?.[1].body);assert.equal(body.authToken,'b'.repeat(32));assert.equal(body.enabled,true);assert.equal(root.querySelector('[name=authToken]').value,'');assert.ok(root.textContent.includes('Webhook'));dispose();dom.window.close();
});
