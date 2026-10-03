import {leadStatuses,temperatures} from './lead-utils.js';
export const field=(key,label,type='text',extra={})=>({key,label,type,...extra});
const loja=()=>field('storeId','Loja','ref',{ref:'stores',required:true});
const vendedor=()=>field('userId','Responsável','ref',{ref:'users'});
const status=(options)=>field('status','Status','select',{options,required:true});
export const modules={
 leads:{title:'Leads',singular:'lead',icon:'◎',description:'Organize os contatos e acompanhe cada oportunidade.',fields:[field('name','Nome','text',{required:true}),field('phone','Telefone','tel',{required:true}),field('email','E-mail','email'),field('source','Origem','select',{options:['WhatsApp','Instagram','Indicação','Loja','Site','Catálogo','Outros']}),field('interest','Interesse / modelo'),status(['Novo','Em atendimento','Proposta','Ganho','Perdido']),loja(),vendedor(),field('notes','Observações','textarea')],columns:['name','phone','interest','status','storeId','userId']},
 users:{title:'Usuários',singular:'usuário',icon:'♙',description:'Cadastre a equipe e vincule cada pessoa à sua loja.',fields:[field('name','Nome','text',{required:true}),field('email','E-mail','email',{required:true}),field('phone','Telefone','tel'),field('role','Função','select',{options:['Administrador','Gestor','Vendedor'],required:true}),loja(),status(['Ativo','Inativo'])],columns:['name','email','role','storeId','status']},
 stores:{title:'Lojas',singular:'loja',icon:'▦',description:'Gerencie as unidades da sua operação.',fields:[field('name','Nome da loja','text',{required:true}),field('document','CNPJ'),field('city','Cidade','text',{required:true}),field('state','UF','text',{required:true,maxLength:2}),field('phone','Telefone','tel'),field('address','Endereço'),status(['Ativa','Inativa'])],columns:['name','city','state','phone','status']},
 vehicles:{title:'Veículos',singular:'veículo',icon:'▤',description:'Controle seu estoque, custos e preços de venda.',fields:[field('name','Marca e modelo','text',{required:true}),field('plate','Placa / identificação','text',{required:true}),field('year','Ano fabricação / modelo','text',{required:true}),field('color','Cor'),loja(),status(['Em avaliação','Em preparação','Disponível']),field('purchase','Valor da compra (R$)','number'),field('debts','Débitos (R$)','number'),field('preparation','Preparação (R$)','number'),field('transfer','Transferência (R$)','number'),field('settlement','Quitação adicional à compra (R$)','number'),field('price','Preço de venda (R$)','number'),field('notes','Observações','textarea')],columns:['name','plate','year','status','storeId','price']},
 assessments:{title:'Avaliações',singular:'avaliação',icon:'⊕',description:'Consultas, checklist e negociação em um único registro.',fields:[field('vehicleId','Veículo','ref',{ref:'vehicles',required:true}),loja(),vendedor(),field('date','Data','date',{required:true}),status(['Pendente','Viável','Inviável']),field('ipva','IPVA (R$)','number'),field('licensing','Licenciamento (R$)','number'),field('fines','Multas (R$)','number'),field('otherDebts','Outros débitos (R$)','number'),field('restrictions','Resultado das consultas','textarea'),field('checklist','Checklist','checklist'),field('purchase','Valor da compra (R$)','number'),field('fipe','Referência FIPE (R$)','number'),field('transfer','Transferência (R$)','number'),field('settlement','Quitação adicional à compra (R$)','number'),field('markup','Acréscimo sobre o custo (%)','number'),field('notes','Observações','textarea')],columns:['vehicleId','date','status','storeId','userId','estimatedPrice']},
 sales:{title:'Vendas',singular:'venda',icon:'↗',description:'Registre as negociações e acompanhe seus resultados.',fields:[field('leadId','Cliente / lead','ref',{ref:'leads',required:true}),field('vehicleId','Veículo','ref',{ref:'vehicles',required:true}),loja(),field('userId','Vendedor','ref',{ref:'users',required:true}),field('date','Data da venda','date',{required:true}),field('amount','Valor da venda (R$)','number',{required:true,positive:true}),field('cost','Custo do veículo (R$)','number'),field('payment','Forma de pagamento','select',{options:['À vista','Financiamento','Consórcio','Misto']}),status(['Em negociação','Concluída','Cancelada']),field('notes','Observações','textarea')],columns:['leadId','vehicleId','date','userId','amount','status']}
};
export const costOf=v=>v.flowVersion===2?Number(v.purchase||0)+Number(v.preparation||0):['purchase','debts','preparation','transfer','settlement'].reduce((s,k)=>s+Number(v[k]||0),0);
export function assessmentTotals(a){const debts=['ipva','licensing','fines','otherDebts'].reduce((s,k)=>s+Number(a[k]||0),0);const preparation=(a.checklist||[]).reduce((s,c)=>s+Number(c.value||0),0);const cost=Number(a.purchase||0)+debts+preparation+Number(a.transfer||0)+Number(a.settlement||0);return {debts,preparation,cost,estimatedPrice:Math.round(cost*(1+Number(a.markup||0)/100)*100)/100}}
export const checkNames=['Motor','Pneus','Freios','Suspensão','Tanque','Carenagem'];

export const normalizeRole=role=>({'GERENTE CORPORATIVO':'Gerente Regional','GERENTE COMERCIAL':'Gerente de Loja','GERENTE REGIONAL':'Gerente Regional','GERENTE DE LOJA':'Gerente de Loja',...Object.fromEntries(['Administrador','Diretor','Administrativo','Supervisor','Vendedor'].map(name=>[name.toLocaleUpperCase('pt-BR'),name]))})[String(role||'').toLocaleUpperCase('pt-BR')]||role;
export const roles=['Administrador','Diretor','Gerente Regional','Gerente de Loja','Administrativo','Supervisor','Vendedor'];
export const screens=['painel','leads','users','stores','vehicles','assessments','sales','groups','regions','teams','companies'];
const ref=(key,label,target,required=true)=>field(key,label,'ref',{ref:target,required});
modules.companies={title:'Empresa',singular:'empresa',icon:'▣',description:'Dados da sua empresa.',fields:[field('name','Nome da empresa','text',{required:true}),field('document','CNPJ'),field('phone','Telefone'),status(['Ativa','Inativa'])],columns:['name','document','phone','status']};
modules.groups={title:'Grupos',singular:'grupo',icon:'▧',description:'Organize as lojas em grupos de gestão.',fields:[field('name','Nome do grupo','text',{required:true}),status(['Ativo','Inativo'])],columns:['name','status']};
modules.regions={title:'Regiões',singular:'região',icon:'◈',description:'Vincule as regiões ao grupo responsável.',fields:[field('name','Nome da região','text',{required:true}),ref('groupId','Grupo','groups'),status(['Ativa','Inativa'])],columns:['name','groupId','status']};
modules.teams={title:'Equipes',singular:'equipe',icon:'♧',description:'Organize supervisores e vendedores por loja.',fields:[field('name','Nome da equipe','text',{required:true}),loja(),status(['Ativa','Inativa'])],columns:['name','storeId','status']};
modules.stores.fields.splice(1,0,ref('regionId','Região','regions'));
modules.users.fields=[field('name','Nome completo','text',{required:true}),field('email','E-mail de acesso','email',{required:true}),field('cpf','CPF','text',{required:true,maxLength:14}),field('phone','Telefone','tel'),field('role','Cargo','select',{options:roles,required:true}),ref('groupId','Grupo','groups'),ref('regionId','Região','regions'),ref('storeId','Loja de referência','stores'),ref('teamId','Equipe','teams',false),status(['Ativo','Inativo']),field('screens','Telas permitidas','screens')];
modules.users.description='Gerencie pessoas, cargos e acessos dentro do seu alcance.';
modules.users.columns=['name','email','role','storeId','teamId','status'];
export const roleRank=role=>roles.indexOf(normalizeRole(role)==='Administrativo'?'Gerente de Loja':normalizeRole(role));
export const defaultScreens=input=>{const role=normalizeRole(input);if(!roles.includes(role))return [];const excluded={Administrador:[],Diretor:['companies'],'Gerente Regional':['companies','groups'],'Gerente de Loja':['companies','groups','regions'],Administrativo:['companies','groups','regions','leads','painel'],Supervisor:['companies','groups','regions','stores'],Vendedor:['companies','groups','regions','stores','users','teams','sales']};return screens.filter(s=>!['vehicles','assessments'].includes(s)&&!excluded[role].includes(s));};

modules.leads.fields=modules.leads.fields.map(f=>f.key==='status'?{...f,options:leadStatuses}:f);
modules.leads.fields.splice(5,0,field('temperature','Temperatura','select',{options:temperatures,required:true}),field('scheduledAt','Próximo contato — data e hora','datetime-local'));
modules.leads.columns=['name','phone','temperature','status','scheduledAt','situation','userId'];
for(const key of ['stores','companies']){modules[key].fields.push(field('postalCode','CEP','text',{maxLength:9,mask:'cep'}));for(const f of modules[key].fields)if(f.key==='document'){f.mask='cnpj';f.maxLength=18;}}
for(const f of modules.users.fields)if(f.key==='cpf'){f.mask='cpf';f.maxLength=14;}

modules.leads.fields.splice(5,0,field('modality','Modalidade','select',{options:['','Consórcio','À vista','Financiamento','Seminova']}),field('planId','Plano de consórcio','plan'));
modules.leads.columns.splice(2,0,'modality','negotiation');

modules.companies.fields.push(field('administratorIds','Administradoras permitidas','administrators'));

modules.users.fields.splice(1,0,field('nickname','Apelido','text',{maxLength:40}));

modules.leads.fields=modules.leads.fields.filter(f=>f.key!=='interest');
modules.leads.fields.splice(modules.leads.fields.findIndex(f=>f.key==='modality')+1,0,field('category','Categoria','select',{options:['','Moto','Automóvel']}),field('model','Modelo Honda','honda-model'));
modules.vehicles.title='Seminovos';modules.vehicles.singular='seminovo';modules.vehicles.description='Cadastre somente veículos seminovos e acompanhe seu estoque.';
modules.vehicles.fields.splice(1,0,field('category','Categoria','select',{options:['','Moto','Automóvel'],required:true}));
modules.sales.description='Vendas originadas nos leads, com os dados da negociação preservados.';
modules.sales.fields=modules.sales.fields.map(f=>f.key==='vehicleId'?{...f,label:'Seminovo do estoque',required:false}:f);
modules.sales.columns=['leadId','model','modality','date','userId','amount','status'];

modules.assessments.title='Captações';modules.assessments.singular='captação';modules.assessments.description='Avalie propostas de seminovos antes de confirmar a compra.';
modules.assessments.fields=modules.assessments.fields.map(f=>f.key==='vehicleId'?{...f,required:false}:f.key==='status'?{...f,options:['Pendente','Avaliado','Aceito','Recusado']}:f.key==='purchase'?{...f,label:'Sua proposta / compra (R$)'}:f);
modules.assessments.fields.unshift(field('ownerName','Nome do proprietário','text',{required:true,maxLength:120}),field('ownerPhone','WhatsApp do proprietário','tel',{required:true,maxLength:30}),field('model','Marca e modelo','text',{required:true,maxLength:150}),field('plate','Placa','text',{required:true,maxLength:8}),field('category','Categoria','select',{options:['Moto','Automóvel'],required:true}),field('year','Ano fabricação / modelo','text',{required:true,maxLength:9}),field('color','Cor','text',{maxLength:50}),field('mileage','Quilometragem','number'),field('desiredValue','Valor pedido pelo cliente (R$)','number',{required:true,positive:true}));
modules.assessments.columns=['model','ownerName','desiredValue','purchase','status','storeId','userId'];

modules.vehicles.fields.push(field('totalCost','Custo total','computed'),field('saleValue','Valor vendido','computed'),field('grossMargin','Margem bruta','computed'));modules.vehicles.columns=['name','plate','status','storeId','totalCost','price','saleValue','grossMargin'];

for(const cfg of Object.values(modules))for(const f of cfg.fields)if(f.type==='tel'||['phone','ownerPhone'].includes(f.key)){f.type='tel';f.mask='phone';f.maxLength=20;}

modules.assessments.fields.push(field('brand','Marca','text',{maxLength:80}),field('fuel','Combustível','text',{maxLength:60}),field('fipeCode','Código FIPE','text',{maxLength:20}),field('fipeReference','Mês de referência FIPE','text',{maxLength:60}));

modules.assessments.fields.push(field('chassis','Chassi','text',{maxLength:32}));

// Complete sale dossier; new completed sales enforce the core fields server-side.
modules.sales.fields.push(
 field('customerName','Nome completo','text',{maxLength:150}),field('customerPhone','Celular','tel',{mask:'phone',maxLength:20}),field('customerEmail','E-mail','email',{maxLength:200}),field('customerCpf','CPF','text',{mask:'cpf',maxLength:14}),field('customerRg','RG','text',{maxLength:30}),field('birthDate','Nascimento','date'),
 field('color','Cor','text',{maxLength:50}),field('manufacturingYear','Ano de fabricação','text',{maxLength:4}),field('modelYear','Ano do modelo','text',{maxLength:4}),field('saleType','Tipo de venda','text',{maxLength:80}),
 field('postalCode','CEP','text',{mask:'cep',maxLength:9}),field('street','Rua','text',{maxLength:200}),field('streetNumber','Número','text',{maxLength:20}),field('neighborhood','Bairro','text',{maxLength:100}),field('state','UF','select',{options:['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']}),field('city','Cidade','text',{maxLength:100}),
 field('downPayment','Entrada (R$)','number'),field('installmentType','Tipo de parcelamento','text',{maxLength:100}),field('installments','Número de parcelas','number'),field('bank','Banco','text',{maxLength:100}),field('accessories','Acessórios (R$)','number'),field('freight','Frete (R$)','number'),field('registration','Emplacamento','select',{options:['','Sim','Não']}),field('registrationAmount','Valor do emplacamento (R$)','number'),field('vehicleInStore','Veículo em loja','select',{options:['','Sim','Não']})
);
modules.sales.fields.push(field('salePlanId','Plano','text',{maxLength:150}),field('consortiumInstallments','Quantidade de parcelas','number'),field('consortiumInstallment','Valor da parcela (R$)','number'),field('customerDocument','CPF ou CNPJ','text',{maxLength:18}),field('proposalNumber','Proposta','text',{maxLength:50}),field('proposalDigit','Dígito','text',{maxLength:3}),field('quotaType','Tipo de cota','select',{options:['','Nova','Reposição','Transferência','Contemplada','Outra']}));
modules.sales.fields.push(field('saleCode','Código da venda','computed'));
