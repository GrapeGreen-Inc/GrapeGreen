(function(){
const getEl=id=>document.getElementById(id);
const PROJECT_ID=typeof CFG!=="undefined"?CFG.projectId:"app-iguess-39f2f";
const API_KEY=typeof CFG!=="undefined"?CFG.apiKey:"AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es";
const BASE_DB=`https://googleapis.com{PROJECT_ID}/databases/(default)/documents`;
const USERS_DB=typeof DB!=="undefined"?DB:`${BASE_DB}/users`;
const CODES_DB=typeof GIFT_CODES_DB!=="undefined"?GIFT_CODES_DB:`${BASE_DB}/giftcards`;
const QUERY_KEY=typeof KEY!=="undefined"?KEY:`?key=${API_KEY}`;
const AES_SECRET=`GrapeGreen_AES256_${PROJECT_ID}_VaultKey`;
const STAFF_RANKS=["mod","admin","headadmin","legal"];
const INFINITE_RANKS=["dev","owner"];
const TEN_MINS_MS=600000;
let cvvVisible=false,userCvv="",currentTokens=5,creditBalance=0,cardNumber="USER-0000-0000-0000",earnInterval=null,loadedUser="",selPrice=1.99,selTokens=100,isMicro=false;
const encryptAES256=t=>CryptoJS.AES.encrypt(String(t),AES_SECRET).toString();
function decryptAES256(c){if(!c||typeof c!=="string"||typeof CryptoJS==="undefined")return"";try{return CryptoJS.AES.decrypt(c,AES_SECRET).toString(CryptoJS.enc.Utf8);}catch{return"";}}
function parseFirestoreDoc(d){if(typeof parseDoc==="function")return parseDoc(d);const o={},f=d.fields||{};for(const[k,v]of Object.entries(f))o[k]="stringValue"in v?v.stringValue:"integerValue"in v?Number(v.integerValue):"doubleValue"in v?Number(v.doubleValue):"booleanValue"in v?Boolean(v.booleanValue):null;return o;}
async function fetchUser(u){if(typeof getUser==="function")return await getUser(u);const r=await fetch(`${USERS_DB}/${encodeURIComponent(u)}${QUERY_KEY}`);if(r.status===404)return null;if(!r.ok)throw new Error("read "+r.status);const o=parseFirestoreDoc(await r.json());if(o.deletedAt&&o.purgeAt<Date.now()){fetch(`${USERS_DB}/${encodeURIComponent(u)}${QUERY_KEY}`,{method:"DELETE"});return null;}return o;}
async function patchDoc(db,id,fieldsObj){const m=Object.keys(fieldsObj).map(k=>`updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&"),sep=QUERY_KEY.includes("?")?"&":"?",r=await fetch(`${db}/${encodeURIComponent(id)}${QUERY_KEY}${sep}${m}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({fields:fieldsObj})});if(!r.ok)throw new Error("write "+r.status);}
const updateUserFields=(u,f)=>patchDoc(USERS_DB,u,f);
async function getAllUsedCardNumbers(){const used=new Set();try{const sep=QUERY_KEY.includes("?")?"&":"?",r=await fetch(`${USERS_DB}${QUERY_KEY}${sep}pageSize=1000`);if(!r.ok)return used;for(const doc of((await r.json()).documents||[])){const p=parseFirestoreDoc(doc),dec=p.Card_Num?decryptAES256(p.Card_Num):"";if(dec)used.add(dec.toUpperCase());}}catch{}return used;}
async function generateUniqueCardNumber(u){const prefix=((u||"USER").replace(/[^a-zA-Z0-9]/g,"").toUpperCase()+"USER").slice(0,4),r4=()=>String(Math.floor(1000+Math.random()*9000)),used=await getAllUsedCardNumbers();let c="",a=0;do{c=`${prefix}-${r4()}-${r4()}-${r4()}`;a++;}while(used.has(c)&&a<50);return c;}
const isInfiniteRank=r=>INFINITE_RANKS.includes((r||"").toLowerCase());
const getStartingTokens=r=>isInfiniteRank(r)?Infinity:STAFF_RANKS.includes((r||"user").toLowerCase())?500:5;
const detectUsername=()=>((typeof window.currentUser==="string"?window.currentUser:window.currentUser?.username)||localStorage.getItem("lastUser")||"").trim();
function updateShopUI(){
  const credEl=getEl("gg-credit-balance"),mCard=getEl("gg-micro-card"),mPill=getEl("gg-micro-pill"),mIn=getEl("gg-micro-amount"),mBtn=getEl("gg-micro-select-btn"),mTok=getEl("gg-micro-tokens"),lbl=getEl("gg-selected-label"),pm=getEl("gg-payment-method");
  if(credEl)credEl.textContent=`$${creditBalance.toFixed(2)}`;
  if(mCard&&mPill&&mIn&&mBtn){
    const ok=creditBalance<1.99;
    mCard.classList.toggle("unlocked",ok);
    mPill.textContent=ok?"Unlocked (< $1.99)":"Locked (Balance ≥ $1.99)";
    mIn.disabled=!ok;mBtn.disabled=!ok||creditBalance<0.01;
    if(ok){const max=creditBalance>0?Math.min(1.98,creditBalance):1.98;mIn.max=max.toFixed(2);if(Number(mIn.value)>max)mIn.value=Math.max(0.01,max).toFixed(2);if(mTok)mTok.textContent=Math.round(Number(mIn.value)*100);}
  }
  if(lbl)lbl.textContent=`${selTokens.toLocaleString()} Tokens ($${selPrice.toFixed(2)})`;
  if(pm)pm.textContent=isMicro?"Credit Balance":creditBalance>=selPrice?"Credit Balance / Stripe":"Stripe Checkout";
}

function renderCard(role="user"){
  const balEl=getEl("gg-token-balance"),numEl=getEl("gg-card-number"),cvvEl=getEl("gg-cvv-display"),btn=getEl("gg-cvv-toggle");
  if(balEl)balEl.textContent=isInfiniteRank(role)?"∞":Number(currentTokens).toLocaleString();
  updateShopUI();
  if(numEl)numEl.textContent=cardNumber;
  if(!cvvEl||!btn)return;
  cvvEl.textContent=userCvv&&cvvVisible?userCvv:"***";
  btn.textContent=userCvv&&cvvVisible?"Hide":"Show";
}

async function initCredits(){
  if(typeof CryptoJS==="undefined")return;
  const uname=detectUsername();
  if(!uname){renderCard();return;}
  if(uname===loadedUser)return;
  try{
    const fresh=await fetchUser(uname);
    if(!fresh){renderCard();return;}
    loadedUser=uname;window.currentUser=fresh;
    const role=(fresh.role||"user").toLowerCase(),updates={};
    const exCard=fresh.Card_Num?decryptAES256(fresh.Card_Num):"";
    if(exCard)cardNumber=exCard;else{cardNumber=await generateUniqueCardNumber(fresh.username);updates.Card_Num={stringValue:encryptAES256(cardNumber)};}
    if(fresh.Card_Code){const dec=decryptAES256(fresh.Card_Code);if(dec)userCvv=dec;}
    const decCred=fresh.Credit_Balance?decryptAES256(fresh.Credit_Balance):"";
    if(decCred!==""&&!isNaN(Number(decCred)))creditBalance=Math.max(0,Number(decCred));else{creditBalance=0;updates.Credit_Balance={stringValue:encryptAES256("0.00")};}
    if(isInfiniteRank(role)){currentTokens=Infinity;if(!fresh.Tokens)updates.Tokens={stringValue:encryptAES256("∞")};}
    else{const decTok=fresh.Tokens?decryptAES256(fresh.Tokens):"";if(decTok!==""&&!isNaN(Number(decTok)))currentTokens=Number(decTok);else{currentTokens=getStartingTokens(role);updates.Tokens={stringValue:encryptAES256(String(currentTokens))};}}
    if(Object.keys(updates).length>0)await updateUserFields(fresh.username,updates);
    renderCard(role);
    if(earnInterval)clearInterval(earnInterval);
    earnInterval=setInterval(async()=>{
      const u=detectUsername();
      if(!u||isInfiniteRank(window.currentUser?.role))return;
      currentTokens+=3;renderCard(window.currentUser?.role);
      const st=getEl("gg-earn-status");if(st)st.textContent="Earned +3 tokens for staying active!";
      await updateUserFields(u,{Tokens:{stringValue:encryptAES256(String(currentTokens))}}).catch(console.error);
    },TEN_MINS_MS);
  }catch(err){console.error(err);renderCard();}
}

getEl("gg-redeem-form")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const inp=getEl("gg-redeem-input"),btn=getEl("gg-redeem-btn"),st=getEl("gg-redeem-status"),u=detectUsername(),code=(inp?.value||"").trim();
  if(!u){st.className="gg-redeem-status error";st.textContent="Log in to redeem codes.";return;}
  if(code.length!==16||!code.startsWith("GGgC")){st.className="gg-redeem-status error";st.textContent="Invalid gift card code.";return;}
  btn.disabled=true;st.className="gg-redeem-status";st.textContent="Checking code...";
  try{
    const r=await fetch(`${CODES_DB}/${encodeURIComponent(code)}${QUERY_KEY}`);
    if(!r.ok)throw new Error("Invalid or already redeemed code.");
    const doc=parseFirestoreDoc(await r.json());
    if(doc.used||doc.redeemed)throw new Error("Code already redeemed.");
    const raw=doc.tokens??doc.amount??doc.value??"",worth=Math.floor(Number(typeof raw==="string"?(decryptAES256(raw)||raw):raw));
    if(!worth||worth<=0)throw new Error("Invalid code value.");
    await patchDoc(CODES_DB,code,{used:{booleanValue:true},redeemedBy:{stringValue:u},redeemedAt:{integerValue:String(Date.now())}});
    const role=(window.currentUser?.role||"user").toLowerCase();
    if(!isInfiniteRank(role)){currentTokens+=worth;await updateUserFields(u,{Tokens:{stringValue:encryptAES256(String(currentTokens))}});}
    renderCard(role);if(inp)inp.value="";
    st.className="gg-redeem-status success";st.textContent=`Redeemed +${worth.toLocaleString()} Tokens!`;
  }catch(err){st.className="gg-redeem-status error";st.textContent=err?.message||"Invalid or already redeemed code.";}
  finally{btn.disabled=false;}
});

document.querySelectorAll(".gg-bundle-card").forEach(c=>c.addEventListener("click",()=>{
  document.querySelectorAll(".gg-bundle-card").forEach(x=>x.classList.remove("active"));
  c.classList.add("active");isMicro=false;selPrice=Number(c.dataset.price)||1.99;selTokens=Number(c.dataset.tokens)||100;updateShopUI();
}));

getEl("gg-micro-amount")?.addEventListener("input",e=>{
  const max=creditBalance>0?Math.min(1.98,creditBalance):1.98,val=Math.max(0.01,Math.min(max,Number(e.target.value)||0.01));
  if(getEl("gg-micro-tokens"))getEl("gg-micro-tokens").textContent=Math.round(val*100);
});

getEl("gg-micro-select-btn")?.addEventListener("click",async()=>{
  const u=detectUsername(),st=getEl("gg-redeem-status"),amt=Number((Number(getEl("gg-micro-amount")?.value)||0).toFixed(2));
  if(!u||creditBalance>=1.99||amt<0.01||amt>1.98||amt>creditBalance)return;
  const add=Math.round(amt*100),role=(window.currentUser?.role||"user").toLowerCase();
  document.querySelectorAll(".gg-bundle-card").forEach(x=>x.classList.remove("active"));
  isMicro=true;selPrice=amt;selTokens=add;
  try{
    creditBalance=Number((creditBalance-amt).toFixed(2));
    const upd={Credit_Balance:{stringValue:encryptAES256(creditBalance.toFixed(2))}};
    if(!isInfiniteRank(role)){currentTokens+=add;upd.Tokens={stringValue:encryptAES256(String(currentTokens))};}
    await updateUserFields(u,upd);renderCard(role);
    if(st){st.className="gg-redeem-status success";st.textContent=`Converted $${amt.toFixed(2)} credit into +${add} Tokens!`;}
  }catch(e){if(st){st.className="gg-redeem-status error";st.textContent="Error: "+e.message;}}
});

getEl("gg-cvv-toggle")?.addEventListener("click",()=>{if(!userCvv){getEl("gg-cvv-form")?.classList.remove("hide");return;}cvvVisible=!cvvVisible;renderCard(window.currentUser?.role);});
getEl("gg-cvv-edit-btn")?.addEventListener("click",()=>getEl("gg-cvv-form")?.classList.toggle("hide"));
getEl("gg-cvv-save")?.addEventListener("click",async()=>{const val=(getEl("gg-cvv-input")?.value||"").trim();if(!/^\d{3}$/.test(val)){alert("Enter 3 digits (000-999).");return;}userCvv=val;cvvVisible=true;getEl("gg-cvv-form")?.classList.add("hide");renderCard(window.currentUser?.role);const u=detectUsername();if(u)await updateUserFields(u,{Card_Code:{stringValue:encryptAES256(userCvv)}}).catch(console.error);});
getEl("gg-gift-send")?.addEventListener("click",async()=>{const target=getEl("gg-gift-user")?.value.trim(),amt=Math.floor(Number(getEl("gg-gift-amount")?.value)),msg=getEl("gg-gift-msg"),senderName=detectUsername();if(!senderName){msg.textContent="Log in to send gifts.";return;}if(!target||target.toLowerCase()===senderName.toLowerCase()){msg.textContent="Enter a valid recipient.";return;}if(!amt||amt<10){msg.textContent="Minimum gift is 10 tokens.";return;}const unlim=isInfiniteRank(window.currentUser?.role);if(!unlim&&currentTokens<amt){msg.textContent="Not enough tokens.";return;}try{msg.textContent="Sending...";const rec=await fetchUser(target);if(!rec){msg.textContent="User not found.";return;}const rRole=(rec.role||"user").toLowerCase(),decRec=rec.Tokens?decryptAES256(rec.Tokens):"",rCur=(decRec!==""&&!isNaN(Number(decRec)))?Number(decRec):getStartingTokens(rRole);if(!isInfiniteRank(rRole))await updateUserFields(target,{Tokens:{stringValue:encryptAES256(String(rCur+amt))}});if(!unlim){currentTokens-=amt;await updateUserFields(senderName,{Tokens:{stringValue:encryptAES256(String(currentTokens))}});}renderCard(window.currentUser?.role);msg.textContent=`Sent ${amt} tokens to ${target}!`;if(getEl("gg-gift-amount"))getEl("gg-gift-amount").value="";}catch(e){msg.textContent="Error: "+e.message;}});
window.initCredits=initCredits;
window.addEventListener("DOMContentLoaded",initCredits);
setInterval(()=>{const u=detectUsername();if(u&&u!==loadedUser)initCredits();},1000);
})();
