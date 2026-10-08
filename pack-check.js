/* 语言包校验：node pack-check.js <lang>  （lang ∈ ja|ko|es|fr|de|pt|ru） */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.join(__dirname,'public','i18n');
const lang=process.argv[2];
if(!lang||!/^(ja|ko|es|fr|de|pt|ru)$/.test(lang)){console.error('usage: node pack-check.js <lang>');process.exit(1);}

function load(f){
  const ctx={window:{}};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
  return ctx.window.I18N;
}

const EXPECT={
  ja:{label:'日本語',locale:'ja-JP',og:'ja_JP',latin:false},
  ko:{label:'한국어',locale:'ko-KR',og:'ko_KR',latin:false},
  es:{label:'ES',locale:'es-ES',og:'es_ES',latin:true},
  fr:{label:'FR',locale:'fr-FR',og:'fr_FR',latin:true},
  de:{label:'DE',locale:'de-DE',og:'de_DE',latin:true},
  pt:{label:'PT',locale:'pt-BR',og:'pt_BR',latin:true},
  ru:{label:'RU',locale:'ru-RU',og:'ru_RU',latin:true},
};

let errs=[],I18N;
try{I18N=load(lang+'.js');}catch(e){console.error('SYNTAX ERROR: '+e.message);process.exit(1);}
const tpl=load('_template.js').en, pk=I18N&&I18N[lang];
if(!pk){console.error('FAIL: window.I18N["'+lang+'"] not found');process.exit(1);}

// 元数据
const ex=EXPECT[lang];
if(pk.code!==lang)errs.push('code='+pk.code+' expected '+lang);
for(const k of ['label','locale','og','latin'])if(pk[k]!==ex[k])errs.push(k+'='+JSON.stringify(pk[k])+' expected '+JSON.stringify(ex[k]));
if(!pk.meta)errs.push('meta missing');
else{
  for(const [k,max] of [['desc',300],['ogDesc',300],['twDesc',150]]){
    const v=pk.meta[k]||'';if(!v)errs.push('meta.'+k+' empty');
    if(v.length>max)errs.push('meta.'+k+' length '+v.length+' > '+max);
  }
}

// 结构对比（含占位符一致性）
function cmp(t,p,pre){
  if(typeof t==='string'){
    if(typeof p!=='string'){errs.push(pre+': not a string');return;}
    const tp=(t.match(/\{\w+\}/g)||[]).sort().join(','), pp=(p.match(/\{\w+\}/g)||[]).sort().join(',');
    if(tp!==pp)errs.push(pre+': placeholders differ ('+tp+' vs '+pp+')');
    return;
  }
  if(Array.isArray(t)){
    if(!Array.isArray(p)||p.length!==t.length){errs.push(pre+': array length mismatch');return;}
    t.forEach((v,i)=>cmp(v,p[i],pre+'['+i+']'));return;
  }
  if(t&&typeof t==='object'){
    if(!p||typeof p!=='object'||Array.isArray(p)){errs.push(pre+': not an object');return;}
    for(const k of Object.keys(t)){
      if(!(k in p))errs.push(pre+'.'+k+': missing');
      else cmp(t[k],p[k],pre+'.'+k);
    }
    return;
  }
  if(typeof t==='boolean'&&typeof p!=='boolean')errs.push(pre+': expected boolean');
}
cmp(tpl,pk,'root');

// 牌库完整性
const cards=pk.cards||{};
const tkeys=Object.keys(tpl.cards||{});
if(Object.keys(cards).length!==78)errs.push('cards count='+Object.keys(cards).length+' expected 78');
for(const k of tkeys){
  const c=cards[k];
  if(!c){errs.push('card missing: '+k);continue;}
  for(const f of ['name','kw','kwr','up','rev'])if(!c[f])errs.push(k+'.'+f+' empty');
  for(const f of ['kw','kwr']){
    const n=String(c[f]||'').split('·').length;
    if(n<2||n>4)errs.push(k+'.'+f+': '+n+' segments (need 2-4, sep U+00B7)');
  }
}

if(errs.length){console.error('FAIL ('+errs.length+'):\n'+errs.slice(0,40).map(e=>' - '+e).join('\n'));process.exit(1);}
console.log('PACK OK: '+lang+' ('+Object.keys(cards).length+' cards)');
