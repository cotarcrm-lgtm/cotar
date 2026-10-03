const management=new URLSearchParams(location.search).get('area')==='gestao',loginPath=management?'/gestao.html':'/login',apiPrefix=management?'/api/management':'/api';
let token=location.hash.slice(1);history.replaceState(null,'',location.pathname+location.search);
const form=document.querySelector('#recover');
const resetMode=/^[a-f0-9]{64}$/.test(token);
if(!resetMode){
  document.querySelector('h1').textContent='Esqueceu sua senha?';
  document.querySelector('#recovery-description').textContent=token?'O link é inválido. Solicite um novo link pelo e-mail cadastrado.':'Informe o e-mail cadastrado para receber um link de recuperação.';
  form.innerHTML='<label>E-mail cadastrado<input name="email" type="email" autocomplete="email" maxlength="254" required></label><button class="primary">Enviar link de recuperação</button><p id="feedback" role="status"></p><p><a href="'+loginPath+'">Voltar ao login</a></p>';
}
form.onsubmit=async e=>{
  e.preventDefault();const feedback=document.querySelector('#feedback');
  if(resetMode&&form.elements.password.value!==form.elements.confirmation.value){feedback.textContent='As senhas precisam ser iguais.';return;}
  const button=form.querySelector('button'),label=button.textContent;button.disabled=true;button.textContent=resetMode?'Salvando…':'Enviando…';feedback.textContent='';
  try{
    const body=resetMode?{token,password:form.elements.password.value}:{email:form.elements.email.value};
    const r=await fetch(apiPrefix+(resetMode?'/recover':'/request-password-reset'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
    const b=await r.json();if(!r.ok)throw Error(b.error||'Não foi possível concluir. Tente novamente.');
    if(!resetMode){feedback.textContent=b.message;return;}
    form.reset();token='';form.replaceChildren();const message=document.createElement('p');message.textContent='Senha atualizada. Suas sessões anteriores foram encerradas.';const link=document.createElement('a');link.href=loginPath;link.className='button primary';link.textContent=management?'Entrar na gestão':'Entrar no CRM';form.append(message,link);
  }catch(err){feedback.textContent=err.message;}finally{button.disabled=false;button.textContent=label;}
};
