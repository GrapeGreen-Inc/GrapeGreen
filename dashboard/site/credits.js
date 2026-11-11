(function(){
const getEl=id=>document.getElementById(id);
const PROJECT_ID=typeof CFG!=="undefined"?CFG.projectId:"app-iguess-39f2f";
const API_KEY=typeof CFG!=="undefined"?CFG.apiKey:"AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es";
const USERS_DB=typeof DB!=="undefined"?DB:`https://googleapis.com{PROJECT_ID}/databases/(default)/documents/users`;
const QUERY_KEY=typeof KEY!=="undefined"?KEY:`?key=${API_KEY}`;
const AES_SECRET=`GrapeGreen_AES256_${PROJECT_ID}_VaultKey`;
const STAFF_RANKS=["mod","admin","headadmin","legal"];
const INFINITE_RANKS=["dev","owner"];
const TEN_MINS_MS=600000;
let cvvVisible=false,userCvv="",currentTokens=5,cardNumber="USER-0000-0000-0000",earnInterval=null,loadedUser="";
function encryptAES256(t){return CryptoJS.AES.encrypt(String(t),AES_SECRET).toString();}
function decryptAES256(c){if(!c||typeof c!=="string"||typeof CryptoJS==="undefined")return"";try{return CryptoJS.AES.decrypt(c,AES_SECRET).toString(CryptoJS.enc.Utf8);}catch{return"";}}
function parseFirestoreDoc(d){if(typeof parseDoc==="function")return parseDoc(d);const o={},f=d.fields||{};for(const[k,v]of Object.entries(f)){if("stringValue"in v)o[k]=v.stringValue;else if("integerValue"in v)o[k]=Number(v.integerValue);else if("doubleValue"in v)o[k]=Number(v.doubleValue);else if("booleanValue"in v)o[k]=Boolean(v.booleanValue);else o[k]=null;}return o;}
async function fetchUser(u){if(typeof getUser==="function")return await getUser(u);const r=await fetch(`${USERS_DB}/${encodeURIComponent(u)}${QUERY_KEY}`);if(r.status===404)return null;if(!r.ok)throw new Error("read "+r.status);const o=parseFirestoreDoc(await r.json());if(o.deletedAt&&o.purgeAt<Date.now()){fetch(`${USERS_DB}/${encodeURIComponent(u)}${QUERY_KEY}`,{method:"DELETE"});return null;}return o;}
async function updateUserFields(u,fieldsObj){const m=Object.keys(fieldsObj).map(k=>`updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");const sep=QUERY_KEY.includes("?")?"&":"?";const r=await fetch(`${USERS_DB}/${encodeURIComponent(u)}${QUERY_KEY}${sep}${m}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({fields:fieldsObj})});if(!r.ok)throw new Error("write "+r.status);}
async function getAllUsedCardNumbers(){const used=new Set();try{const sep=QUERY_KEY.includes("?")?"&":"?";const r=await fetch(`${USERS_DB}${QUERY_KEY}${sep}pageSize=1000`);if(!r.ok)return used;const data=await r.json();for(const doc of(data.documents||[])){const p=parseFirestoreDoc(doc);if(p.Card_Num){const dec=decryptAES256(p.Card_Num);if(dec)used.add(dec.toUpperCase());}}}catch{}return used;}
async function generateUniqueCardNumber(u){const clean=(u||"USER").replace(/[^a-zA-Z0-9]/g,"").toUpperCase();const prefix=(clean+"USER").slice(0,4);const rand4=()=>String(Math.floor(1000+Math.random()*9000));const used=await getAllUsedCardNumbers();let c="",a=0;do{c=`${prefix}-${rand4()}-${rand4()}-${rand4()}`;a++;}while(used.has(c)&&a<50);return c;}
const isInfiniteRank=r=>INFINITE_RANKS.includes((r||"").toLowerCase());
function getStartingTokens(r){const role=(r||"user").toLowerCase();return isInfiniteRank(role)?Infinity:STAFF_RANKS.includes(role)?500:5;}
function detectUsername(){
  if(typeof currentUser!=="undefined"&&currentUser?.username)return currentUser.username;
  if(window.currentUser?.username)return window.currentUser.username;
  if(typeof cur!=="undefined"&&cur?.username)return cur.username;
  if(typeof me!=="undefined"&&me?.username)return me.username;
  for(const store of[localStorage,sessionStorage]){
    for(const k of Object.keys(store)){
      const v=(store.getItem(k)||"").trim();
      if(!v)continue;
      if(v.startsWith("{")){try{const p=JSON.parse(v);if(p?.username)return p.username;}catch{}}
      if(/user|auth|login|session|gg/i.test(k)&&/^[A-Za-z0-9_.-]{2,32}$/.test(v)&&v.toLowerCase()!=="guest")return v;
    }
  }
  for(const id of["whoami","current-user","profile-name","nav-username","user-name","header-username"]){
    const el=getEl(id);
    if(el){const txt=el.textContent.replace(/^@/,"").trim();if(txt&&!/guest|log\s*in/i.test(txt)&&/^[A-Za-z0-9_.-]{2,32}$/.test(txt))return txt;}
  }
  return"";
}
function renderCard(role="user"){const balEl=getEl("gg-token-balance"),numEl=getEl("gg-card-number"),cvvEl=getEl("gg-cvv-display"),btn=getEl("gg-cvv-toggle");if(!balEl)return;balEl.textContent=isInfiniteRank(role)?"∞":String(currentTokens);if(numEl)numEl.textContent=cardNumber;if(!cvvEl||!btn)return;if(!userCvv){cvvEl.textContent="***";btn.textContent="Show";}else{cvvEl.textContent=cvvVisible?userCvv:"***";btn.textContent=cvvVisible?"Hide":"Show";}}
async function initCredits(){
  const uname=detectUsername();
  if(!uname){renderCard();return;}
  if(uname===loadedUser)return;
  try{
    const fresh=await fetchUser(uname);
    if(!fresh){renderCard();return;}
    loadedUser=uname;
    window.currentUser=fresh;
    const role=(fresh.role||"user").toLowerCase();
    const updates={};
    const exCard=fresh.Card_Num?decryptAES256(fresh.Card_Num):"";
    if(exCard)cardNumber=exCard;
    else{cardNumber=await generateUniqueCardNumber(fresh.username);updates.Card_Num={stringValue:encryptAES256(cardNumber)};}
    if(fresh.Card_Code){const dec=decryptAES256(fresh.Card_Code);if(dec)userCvv=dec;}
    if(isInfiniteRank(role)){currentTokens=Infinity;if(!fresh.Tokens)updates.Tokens={stringValue:encryptAES256("∞")};}
    else{const decTok=fresh.Tokens?decryptAES256(fresh.Tokens):"";if(decTok!==""&&!isNaN(Number(decTok)))currentTokens=Number(decTok);else{currentTokens=getStartingTokens(role);updates.Tokens={stringValue:encryptAES256(String(currentTokens))};}}
    if(Object.keys(updates).length>0)await updateUserFields(fresh.username,updates);
    renderCard(role);
    if(earnInterval)clearInterval(earnInterval);
    earnInterval=setInterval(async()=>{
      const u=detectUsername();
      if(!u||isInfiniteRank(window.currentUser?.role))return;
      currentTokens+=3;
      renderCard(window.currentUser?.role);
      const st=getEl("gg-earn-status");
      if(st)st.textContent="Earned +3 tokens for staying active!";
      await updateUserFields(u,{Tokens:{stringValue:encryptAES256(String(currentTokens))}}).catch(console.error);
    },TEN_MINS_MS);
  }catch(err){console.error(err);renderCard();}
}
getEl("gg-cvv-toggle")?.addEventListener("click",()=>{if(!userCvv){getEl("gg-cvv-form")?.classList.remove("hide");return;}cvvVisible=!cvvVisible;renderCard(window.currentUser?.role);});
getEl("gg-cvv-edit-btn")?.addEventListener("click",()=>getEl("gg-cvv-form")?.classList.toggle("hide"));
getEl("gg-cvv-save")?.addEventListener("click",async()=>{const val=(getEl("gg-cvv-input")?.value||"").trim();if(!/^\d{3}$/.test(val)){alert("Enter 3 digits (000-999).");return;}userCvv=val;cvvVisible=true;getEl("gg-cvv-form")?.classList.add("hide");renderCard(window.currentUser?.role);const u=detectUsername();if(u)await updateUserFields(u,{Card_Code:{stringValue:encryptAES256(userCvv)}}).catch(console.error);});
getEl("gg-gift-send")?.addEventListener("click",async()=>{const target=getEl("gg-gift-user")?.value.trim(),amt=Math.floor(Number(getEl("gg-gift-amount")?.value)),msg=getEl("gg-gift-msg"),senderName=detectUsername();if(!senderName){msg.textContent="Log in to send gifts.";return;}if(!target||target.toLowerCase()===senderName.toLowerCase()){msg.textContent="Enter a valid recipient.";return;}if(!amt||amt<10){msg.textContent="Minimum gift is 10 tokens.";return;}const unlim=isInfiniteRank(window.currentUser?.role);if(!unlim&&currentTokens<amt){msg.textContent="Not enough tokens.";return;}try{msg.textContent="Sending...";const rec=await fetchUser(target);if(!rec){msg.textContent="User not found.";return;}const rRole=(rec.role||"user").toLowerCase(),decRec=rec.Tokens?decryptAES256(rec.Tokens):"",rCur=(decRec!==""&&!isNaN(Number(decRec)))?Number(decRec):getStartingTokens(rRole);if(!isInfiniteRank(rRole))await updateUserFields(target,{Tokens:{stringValue:encryptAES256(String(rCur+amt))}});if(!unlim){currentTokens-=amt;await updateUserFields(senderName,{Tokens:{stringValue:encryptAES256(String(currentTokens))}});}renderCard(window.currentUser?.role);msg.textContent=`Sent ${amt} tokens to ${target}!`;if(getEl("gg-gift-amount"))getEl("gg-gift-amount").value="";}catch(e){msg.textContent="Error: "+e.message;}});
window.initCredits=initCredits;
window.addEventListener("DOMContentLoaded",initCredits);
setInterval(()=>{if(!loadedUser&&detectUsername())initCredits();},1500);
})();
