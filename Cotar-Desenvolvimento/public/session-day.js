// Return to authentication at midnight in Bahia, including suspended tabs.
const day=86400000,offset=10800000,deadline=(Math.floor((Date.now()-offset)/day)+1)*day+offset;
let expired=false;
function checkDay(){if(!expired&&Date.now()>=deadline){expired=true;location.reload();}}
setTimeout(checkDay,Math.max(0,deadline-Date.now()));
window.addEventListener('focus',checkDay);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
