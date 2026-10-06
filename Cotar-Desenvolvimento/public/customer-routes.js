const storePattern='([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
export function customerStaticRoute(path){
 const manifest=path.match(new RegExp('^/cliente/'+storePattern+'/manifest.webmanifest$'));
 if(manifest)return {manifest:{id:'/cliente/'+manifest[1],name:'Winner · Meu atendimento',short_name:'Winner',lang:'pt-BR',start_url:'/cliente/'+manifest[1],scope:'/cliente/',display:'standalone',theme_color:'#b91625',background_color:'#f7f6f3',icons:[{src:'/winner-icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'/winner-icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}};
 if(new RegExp('^/cliente/'+storePattern+'/?$').test(path))return {asset:'/customer.html'};
 return null;
}
