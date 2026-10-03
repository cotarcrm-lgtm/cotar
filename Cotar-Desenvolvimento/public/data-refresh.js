// Merge reads and discard any snapshot started before a confirmed write.
export function createDataRefresh(fetchData,apply){let active=null,revision=0,queued=false;
 const invalidate=()=>{revision++;if(active)queued=true;};
 function refresh({afterWrite=false}={}){if(afterWrite)invalidate();if(active)return active;
  active=(async()=>{let result;do{queued=false;const version=revision;try{result=await fetchData();if(version===revision)apply(result);}catch(error){if(version===revision)throw error;}}while(queued);return result;})().finally(()=>active=null);return active;
 }
 return {refresh,invalidate};
}
