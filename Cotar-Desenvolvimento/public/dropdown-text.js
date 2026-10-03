// Normalize visible option labels, preserving identifiers and implicit values.
export function normalizeDropdownText(root) {
 const options=[];
 if(root?.matches?.('option,[role="option"]'))options.push(root);
 options.push(...(root?.querySelectorAll?.('option,[role="option"]')||[]));
 for(const option of options){
  if(option.tagName==='OPTION'){
   const text=option.textContent,upper=text.toLocaleUpperCase('pt-BR');
   if(text!==upper){if(!option.hasAttribute('value'))option.setAttribute('value',option.value);option.textContent=upper;}
   if(option.hasAttribute('label')){const label=option.getAttribute('label');if(label!==label.toLocaleUpperCase('pt-BR'))option.setAttribute('label',label.toLocaleUpperCase('pt-BR'));}
  }else{
   const walker=option.ownerDocument.createTreeWalker(option,4);let node;
   while((node=walker.nextNode())){const text=node.textContent,upper=text.toLocaleUpperCase('pt-BR');if(text!==upper)node.textContent=upper;}
  }
 }
 for(const group of [...(root?.matches?.('optgroup[label]')?[root]:[]),...(root?.querySelectorAll?.('optgroup[label]')||[])]){const label=group.label;if(label!==label.toLocaleUpperCase('pt-BR'))group.label=label.toLocaleUpperCase('pt-BR');}
}
if(typeof document!=='undefined'){
 normalizeDropdownText(document);
 const observer=new MutationObserver(changes=>{
  for(const change of changes){
   if(change.type==='characterData')normalizeDropdownText(change.target.parentElement?.closest('option,[role="option"]'));
   else if(change.type==='attributes')normalizeDropdownText(change.target);
   else for(const node of change.addedNodes){if(node.nodeType===1)normalizeDropdownText(node);else if(node.nodeType===3)normalizeDropdownText(node.parentElement?.closest('option,[role="option"]'));}
  }
 });
 observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['label']});
}
