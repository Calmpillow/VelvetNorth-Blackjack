// Velvet North Blackjack — WebSocket room-directory edition.
const $=id=>document.getElementById(id), MAX=12, START=250000;
let socket=null,host=false,room="",roomId="",myId="",hostConn=null,conns=new Map(),players=[],phase="lobby",round=0,deck=[],dealer=[],message="Waiting for players…",renderedHands={},reconnectTimer=null,roomRefreshTimer=null;
const CATS=["hair","shirt","hat","glasses","chain","necklace"];
const PALETTES={hair:["#17131b","#39251e","#6b422b","#a56a3e","#d7b17a","#e6d6bb","#6d273b","#263e61","#315b45","#8b6cae"],shirt:["#182b42","#283f35","#713d3c","#6b5939","#44365d","#d7d0c2","#17191c","#376b76","#8a4c6c","#a9a8a0"],hat:["#20262d","#354f47","#8b6b43","#713d3c","#d3c29a","#364c70","#6d526e","#252525","#a65d42","#667b6b"],glasses:["#17191c","#55402d","#9b7947","#49677b","#774c66","#b7a27a","#3e5a4d","#777777","#26334b","#8b4f38"],chain:["#d9bd7b","#bfc7ce","#bd8154","#e4d6b4","#8c9c9a","#c59a55","#d5d5d5","#a77b56","#d9c9a1","#8c8c8c"],necklace:["#d9bd7b","#bfc7ce","#bd8154","#e4d6b4","#8c9c9a","#c59a55","#d5d5d5","#a77b56","#d9c9a1","#8c8c8c"]};
const SKINS=["#f5d4b5","#e9bd98","#d9a47c","#bd805b","#986044","#70452f","#503326","#3b2822"];
const ITEM_WORDS={hair:{male:["Taper","Fade","Crop","Curls","Waves","Locs","Twists","Braids","Quiff","Sweep"],female:["Bob","Pixie","Curls","Waves","Locs","Braids","Twists","Bun","Layers","Ponytail"]},shirt:{male:["Crew tee","Hoodie","Varsity","Knit","Overshirt","Turtleneck","Graphic tee","Bomber","Polo","Jacket"],female:["Fitted tee","Hoodie","Blouse","Knit top","Crop top","Overshirt","Turtleneck","Jacket","Tank top","Cardigan"]},hat:{male:["Snapback","Beanie","Bucket hat","Flat cap","Five-panel","Trucker","Beret","Wide brim","Sport cap","Newsboy"],female:["Beret","Beanie","Bucket hat","Wide brim","Cloche","Headwrap","Baseball cap","Sun hat","Fascinator","Knit cap"]},glasses:{male:["Round frames","Square frames","Aviators","Rimless","Club frames","Sport shades","Wire frames","Wayfarers","Clear frames","Oval frames"],female:["Round frames","Cat-eye","Square frames","Aviators","Rimless","Oversized","Wire frames","Clear frames","Oval frames","Soft rectangle"]},chain:{male:["Rope chain","Cuban link","Figaro chain","Box chain","Curb chain","Snake chain","Bead chain","Cable chain","Twist chain","Link chain"],female:["Fine chain","Rope chain","Cuban link","Figaro chain","Box chain","Snake chain","Bead chain","Cable chain","Twist chain","Link chain"]},necklace:{male:["Pendant","Dog tag","Bar pendant","Coin pendant","Cross-free charm","Stone pendant","Initial charm","Compass charm","Geometric charm","Layered pendant"],female:["Pendant","Pearl strand","Gem pendant","Lariat","Coin pendant","Heart charm","Stone pendant","Initial charm","Floral charm","Layered pendant"]}};
function defaultLook(){return{gender:"male",skin:SKINS[2],hair:0,shirt:0,hat:-1,glasses:-1,chain:-1,necklace:-1}}
function normalizeLook(raw={}){
 const clean={...defaultLook(),...(raw&&typeof raw==="object"?raw:{})};
 clean.gender=clean.gender==="female"?"female":"male";
 clean.skin=SKINS.includes(clean.skin)?clean.skin:defaultLook().skin;
 for(const cat of CATS){const max=99;const n=Number(clean[cat]);clean[cat]=Number.isInteger(n)?Math.max(-1,Math.min(max,n)):defaultLook()[cat];}
 return clean;
}
let myLook=(()=>{try{return normalizeLook(JSON.parse(localStorage.getItem("vn-look")||"{}"))}catch(e){return defaultLook()}})();let activeCategory="hair";
const COLOR_NAMES=["Onyx","Espresso","Chestnut","Copper","Honey","Pearl","Burgundy","Midnight","Forest","Amethyst"];
function catalog(gender,cat){
 const names=ITEM_WORDS[cat][gender],colors=PALETTES[cat];
 const shapeCount=10;
 const count=shapeCount*10;
 return Array.from({length:count},(_,i)=>{
  const colorIndex=i%10,shapeIndex=Math.floor(i/10);
  const shapeName=names[shapeIndex%names.length];
  return {id:i,name:shapeCount===1?`${shapeName} · ${COLOR_NAMES[colorIndex]}`:`${shapeName} · ${COLOR_NAMES[colorIndex]}`,color:colors[colorIndex],variant:shapeIndex,index:i};
 });
}
function avatarSvg(look={}){
 const base=defaultLook(),l={...base,...look};
 const idx=k=>Number.isInteger(Number(l[k]))?Math.max(-1,Math.min(99,Number(l[k]))):base[k];
 const hairEquipped=idx('hair')>=0;const h=Math.max(0,idx('hair')),sh=Math.max(0,idx('shirt')),ha=idx('hat'),gl=idx('glasses'),ch=idx('chain'),ne=idx('necklace');
 const skin=SKINS.includes(l.skin)?l.skin:base.skin;
 const hair=PALETTES.hair[h%10],shirt=PALETTES.shirt[sh%10],hat=ha>=0?PALETTES.hat[ha%10]:null;
 const glass=gl>=0?PALETTES.glasses[gl%10]:null,metal=ch>=0?PALETTES.chain[ch%10]:null,neck=ne>=0?PALETTES.necklace[ne%10]:null;
 const female=l.gender==='female',style=Math.floor(h/10)%10,shirtStyle=Math.floor(sh/10)%10,hatStyle=Math.floor(Math.max(0,ha)/10)%10,glassesStyle=Math.floor(Math.max(0,gl)/10)%10;
 const hairBack=[
  `<path d="M53 108 Q35 25 118 19 Q201 22 185 112 L178 166 Q164 188 151 166 L83 169 Q64 184 51 159Z" fill="${hair}"/>`,
  `<path d="M48 111 Q37 23 118 18 Q194 19 188 107 L176 137 Q164 111 154 105 Q118 84 79 111 L61 145Z" fill="${hair}"/>`,
  `<path d="M46 112 Q39 20 119 18 Q198 20 190 113 L183 177 163 158 149 185 129 160 111 185 91 160 72 179 57 151Z" fill="${hair}"/>`,
  `<path d="M45 112 Q39 18 118 18 Q198 19 191 113 L182 184 164 160 147 188 128 160 108 187 88 160 69 183 55 148Z" fill="${hair}"/>`,
  `<path d="M48 112 Q39 22 118 18 Q195 20 188 112 L178 149 Q158 118 147 111 Q111 91 77 119 L58 150Z" fill="${hair}"/>`,
  `<path d="M47 111 Q40 18 118 18 Q199 20 190 111 L178 163 Q166 184 151 161 L85 163 Q62 181 51 155Z" fill="${hair}"/>`,
  `<path d="M47 108 Q36 18 118 18 Q197 19 190 109 L179 172 163 151 147 176 130 151 112 177 92 151 72 172 55 145Z" fill="${hair}"/>`,
  `<path d="M47 110 Q39 18 118 18 Q197 20 190 110 L177 160 Q161 179 151 154 L85 155 Q62 178 51 151Z" fill="${hair}"/>`,
  `<path d="M48 110 Q39 19 118 18 Q198 20 190 110 L179 150 Q159 126 147 117 Q112 92 78 119 L58 151Z" fill="${hair}"/>`,
  `<path d="M48 109 Q39 18 118 18 Q198 19 190 109 L180 161 164 144 149 167 130 145 110 166 91 145 72 164 56 142Z" fill="${hair}"/>`
 ][style];
 const frontHair=[
  `<path d="M53 91 Q62 28 119 29 Q168 27 183 83 Q155 64 132 69 Q97 52 63 94Z" fill="${hair}"/>`,
  `<path d="M53 88 Q59 29 118 28 Q164 28 183 81 Q153 70 130 75 Q96 58 61 99Z" fill="${hair}"/>`,
  `<path d="M49 93 Q57 27 119 27 Q172 29 186 91 L168 79 155 94 140 78 125 94 108 77 91 96 76 81 61 101Z" fill="${hair}"/>`,
  `<path d="M48 91 Q59 26 119 27 Q173 29 186 91 L169 80 154 96 139 80 123 96 106 80 90 97 74 82 59 101Z" fill="${hair}"/>`,
  `<path d="M53 91 Q59 29 118 28 Q164 27 183 82 Q153 67 132 72 Q95 57 62 98Z" fill="${hair}"/>`,
  `<path d="M52 92 Q61 27 119 27 Q170 28 184 88 Q158 66 132 70 Q100 59 61 96Z" fill="${hair}"/>`,
  `<path d="M49 91 Q59 25 119 27 Q171 27 186 90 L168 81 153 95 137 79 121 96 104 80 88 97 72 82 58 101Z" fill="${hair}"/>`,
  `<path d="M51 91 Q60 27 119 28 Q168 28 184 86 Q155 69 130 74 Q95 55 61 98Z" fill="${hair}"/>`,
  `<path d="M52 91 Q60 28 119 28 Q166 28 184 85 Q155 68 132 73 Q96 56 61 99Z" fill="${hair}"/>`,
  `<path d="M49 91 Q59 26 119 27 Q173 28 186 90 L168 80 152 95 137 79 121 95 104 79 88 96 72 81 58 101Z" fill="${hair}"/>`
 ][style];
 const hairSide=female&&style%3===1?`<path d="M51 81 Q32 126 55 174 Q67 187 75 171 L70 112Z M184 81 Q203 126 181 174 Q168 187 160 171 L166 112Z" fill="${hair}"/>`:'';
 const shirtPaths=[
  `<path d="M61 187 Q69 176 88 174 L119 190 150 174 Q170 177 178 190 L216 258 H20Z" fill="${shirt}"/>`,
  `<path d="M58 185 Q68 175 89 174 L119 191 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><path d="M91 178 L119 204 147 178" fill="none" stroke="#ffffff55" stroke-width="5"/>`,
  `<path d="M59 186 Q70 175 89 174 L119 190 150 174 Q170 176 180 188 L218 258 H18Z" fill="${shirt}"/><path d="M119 191 V258" stroke="#ffffff55" stroke-width="4"/>`,
  `<path d="M58 186 Q69 175 89 174 L119 190 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><path d="M88 176 Q119 215 150 176" fill="none" stroke="#ffffff55" stroke-width="5"/>`,
  `<path d="M58 185 Q68 175 89 174 L119 190 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><path d="M102 179 L119 193 136 179" fill="none" stroke="#d9bd7b" stroke-width="4"/>`,
  `<path d="M58 185 Q68 175 89 174 L119 190 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><path d="M78 210h82 M70 222h98" stroke="#ffffff55" stroke-width="4"/>`,
  `<path d="M58 185 Q68 175 89 174 L119 190 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><circle cx="119" cy="221" r="13" fill="none" stroke="#ffffff66" stroke-width="3"/><path d="M111 221h16 M119 213v16" stroke="#ffffff66" stroke-width="2"/>`,
  `<path d="M58 185 Q68 175 89 174 L119 190 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><path d="M91 178 Q119 194 147 178 L141 193 Q119 207 97 193Z" fill="#ffffff28"/>`,
  `<path d="M58 185 Q68 175 89 174 L119 190 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><path d="M82 187l-12 17 M156 187l12 17" stroke="#ffffff77" stroke-width="4"/>`,
  `<path d="M58 185 Q68 175 89 174 L119 190 150 174 Q171 176 181 188 L218 258 H18Z" fill="${shirt}"/><path d="M105 179v24 M133 179v24 M105 203h28" stroke="#ffffff55" stroke-width="3"/>`
 ][shirtStyle%10];
 const glassesStyles=[
 `<g fill="#18251f22" stroke="${glass}" stroke-width="5"><rect x="65" y="103" width="38" height="27" rx="10"/><rect x="135" y="103" width="38" height="27" rx="10"/><path d="M103 114 Q119 106 135 114" fill="none"/></g>`,
 `<g fill="#18251f30" stroke="${glass}" stroke-width="5"><path d="M63 105 Q83 95 103 108 L99 130 Q80 139 67 126Z M135 108 Q155 95 175 105 L171 126 Q158 139 139 130Z"/><path d="M103 114h32" fill="none"/></g>`,
 `<g fill="none" stroke="${glass}" stroke-width="4"><path d="M64 117 Q82 96 103 117 Q83 139 64 117Z M135 117 Q155 96 174 117 Q155 139 135 117Z M103 117h32"/></g>`,
 `<g fill="none" stroke="${glass}" stroke-width="4"><rect x="66" y="105" width="36" height="25" rx="3"/><rect x="136" y="105" width="36" height="25" rx="3"/><path d="M102 115h34"/></g>`,
 `<g fill="#18251f35" stroke="${glass}" stroke-width="4"><path d="M63 106 Q83 99 103 109 L99 132 Q78 139 67 126Z M135 109 Q155 99 175 106 L171 126 Q160 139 139 132Z"/><path d="M103 115h32"/></g>`,
 `<g fill="${glass}" fill-opacity=".16" stroke="${glass}" stroke-width="3"><path d="M61 107h43l-5 27H68Z M134 107h43l-7 27h-30Z"/><path d="M104 115h30"/></g>`,
 `<g fill="none" stroke="${glass}" stroke-width="3"><circle cx="84" cy="117" r="17"/><circle cx="154" cy="117" r="17"/><path d="M101 117h36"/></g>`,
 `<g fill="#18251f22" stroke="${glass}" stroke-width="4"><path d="M65 106h37v25H65Z M136 106h37v25h-37Z"/><path d="M102 114h34"/></g>`,
 `<g fill="none" stroke="${glass}" stroke-width="4"><path d="M64 118 Q83 100 103 118 M135 118 Q155 100 174 118 M103 118h32"/><path d="M64 118l5 12 M174 118l-5 12"/></g>`,
 `<g fill="${glass}" fill-opacity=".12" stroke="${glass}" stroke-width="4"><ellipse cx="84" cy="117" rx="20" ry="13"/><ellipse cx="154" cy="117" rx="20" ry="13"/><path d="M104 117h30"/></g>`
 ];
 const frames=gl<0?'':glassesStyles[glassesStyle%10];
 const hatStyles=[
 `<path d="M51 72 Q119 20 187 72 L180 86 Q119 65 58 87Z" fill="${hat}" stroke="#ffffff55" stroke-width="3"/><path d="M47 87 Q119 74 191 87 Q181 99 119 99 Q57 99 47 87Z" fill="${hat}"/>`,
 `<path d="M75 57 Q119 30 163 57 L163 83 Q119 70 75 83Z" fill="${hat}"/><path d="M68 80 Q119 69 170 80 L167 91 Q119 84 71 91Z" fill="${hat}"/>`,
 `<path d="M48 83 Q119 63 190 83 L184 96 Q119 84 54 96Z" fill="${hat}"/><path d="M68 77 Q119 27 170 77Z" fill="${hat}"/>`,
 `<path d="M70 65 Q119 37 168 65 L168 87 Q119 75 70 87Z" fill="${hat}"/><path d="M60 88 Q119 78 178 88" stroke="${hat}" stroke-width="12" fill="none"/>`,
 `<path d="M73 64 Q119 27 165 64 L160 89H78Z" fill="${hat}"/><path d="M61 89 Q119 81 177 89" stroke="${hat}" stroke-width="9" fill="none"/>`,
 `<path d="M65 71 Q119 44 173 71 L169 91H69Z" fill="${hat}"/><path d="M65 92h108" stroke="#ffffff55" stroke-width="3"/>`,
 `<path d="M78 52 Q119 29 160 52 L160 87 Q119 76 78 87Z" fill="${hat}"/><path d="M72 87 Q119 77 166 87" stroke="${hat}" stroke-width="9" fill="none"/>`,
 `<path d="M51 80 Q119 57 187 80 L181 94H57Z" fill="${hat}"/><path d="M78 79 Q119 34 160 79" fill="none" stroke="#ffffff55" stroke-width="3"/>`,
 `<path d="M73 60 Q119 33 165 60 L162 91H76Z" fill="${hat}"/><path d="M70 92 Q119 83 168 92" stroke="${hat}" stroke-width="7" fill="none"/>`,
 `<path d="M68 69 Q119 42 170 69 L166 89H72Z" fill="${hat}"/><path d="M59 89 Q119 77 179 89 Q170 99 119 99 Q68 99 59 89Z" fill="${hat}"/>`
 ];
 const hatLayer=ha<0?'':hatStyles[hatStyle%10];
 const chainPaths=["M79 183 Q119 225 159 183","M77 183 Q119 231 161 183","M80 183 Q119 216 158 183","M76 184 Q119 238 162 184","M82 183 Q119 220 156 183","M79 181 Q119 228 159 181","M75 184 Q119 234 163 184","M84 182 Q119 214 154 182","M77 181 Q119 225 161 181","M81 184 Q119 232 157 184"];
 const necklacePaths=["M91 187 Q119 225 147 187","M88 187 Q119 235 150 187","M93 187 Q119 218 145 187","M86 187 Q119 239 152 187","M90 186 Q119 229 148 186","M94 187 Q119 222 144 187","M87 187 Q119 233 151 187","M92 187 Q119 216 146 187","M89 187 Q119 231 149 187","M95 187 Q119 226 143 187"];
 const chainLayer=ch<0?'':`<path d="${chainPaths[Math.floor(ch/10)%10]}" fill="none" stroke="${metal}" stroke-width="${[3,4,5,6,4,7,3,5,6,4][Math.floor(ch/10)%10]}" stroke-linecap="round"/>`;
 const necklaceLayer=ne<0?'':`<path d="${necklacePaths[Math.floor(ne/10)%10]}" fill="none" stroke="${neck}" stroke-width="${[2,3,4,2.5,3.5,2,4,3,2.5,3.5][Math.floor(ne/10)%10]}"/><path d="M119 218 l-8 9 8 10 8-10Z" fill="${neck}" stroke="#fff8" stroke-width="1.5"/>`;
 const genderFace=female?`<path d="M88 150 Q119 166 150 150" fill="none" stroke="#9b5d55" stroke-width="2" opacity=".35"/>`:'';
 return `<svg viewBox="0 0 238 270" role="img" aria-label="Chest-up customizable character" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="skinShade" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".14"/><stop offset="1" stop-color="#2a120b" stop-opacity=".12"/></linearGradient><linearGradient id="shirtShade" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".12"/><stop offset="1" stop-color="#000000" stop-opacity=".18"/></linearGradient></defs>
 <ellipse cx="119" cy="256" rx="94" ry="8" fill="#000" opacity=".15"/>
 ${hairEquipped?hairBack:''}
 <path d="M98 154h42v39q-21 18-42 0Z" fill="${skin}"/>
 ${shirtPaths}<path d="M61 187 Q70 176 89 174 L119 190 150 174 Q169 176 180 188 L216 258 H20Z" fill="url(#shirtShade)"/>
 <path d="M64 195 Q47 207 43 246" stroke="${skin}" stroke-width="16" stroke-linecap="round" fill="none"/><path d="M174 195 Q191 207 195 246" stroke="${skin}" stroke-width="16" stroke-linecap="round" fill="none"/>
 <path d="M119 34 Q164 34 171 91 L165 145 Q156 171 119 177 Q82 171 73 145 L67 91 Q74 34 119 34Z" fill="${skin}"/><path d="M119 34 Q164 34 171 91 L165 145 Q156 171 119 177 Q82 171 73 145 L67 91 Q74 34 119 34Z" fill="url(#skinShade)"/>
 <path d="M82 113 Q96 106 106 113 M132 113 Q143 106 156 113" fill="none" stroke="#38251f" stroke-width="4" stroke-linecap="round"/><ellipse cx="95" cy="126" rx="4.5" ry="5.5" fill="#211b19"/><ellipse cx="144" cy="126" rx="4.5" ry="5.5" fill="#211b19"/><path d="M117 128 l-4 15 7 2" fill="none" stroke="#8e5d4b" stroke-width="2.5" stroke-linecap="round"/><path d="M103 153 Q119 164 135 153" fill="none" stroke="#874b45" stroke-width="3.5" stroke-linecap="round"/>${genderFace}
 ${hairEquipped?hairSide:''}${hairEquipped?frontHair:''}${frames}${hatLayer}${chainLayer}${necklaceLayer}
 <path d="M83 180 Q119 203 155 180" fill="none" stroke="#ffffff55" stroke-width="3"/>
 </svg>`;
}
function avatarMarkup(look,cls=""){return `<div class="avatar-art ${cls}">${avatarSvg(look)}</div>`}
function showLoading(text){const el=$("loadingScreen");if(el){$("loadingText").textContent=text||"Connecting to the table…";el.classList.remove("hidden","loading-out")}}
function hideLoading(){const el=$("loadingScreen");if(el){el.classList.add("loading-out");setTimeout(()=>{if(el.classList.contains("loading-out"))el.classList.add("hidden")},450)}}
function refreshLobbyAvatar(){$("lobbyAvatar").innerHTML=avatarMarkup(myLook);$("lobbyAvatarName").textContent=(myLook.gender==="female"?"Your style, your seat.":"Your look, your seat.")}
function renderCustomizer(){
 document.querySelectorAll(".gender-choice").forEach(b=>b.classList.toggle("selected",b.dataset.gender===myLook.gender));
 $("avatarPreview").innerHTML=avatarSvg(myLook);
 const titles={hair:"Hair styles",shirt:"Clothing",hat:"Hats & headwear",glasses:"Eyewear",chain:"Chains",necklace:"Necklaces"};
 const names=ITEM_WORDS[myLook.gender][activeCategory],shapeCount=10;
 const rawCurrent=Number(myLook[activeCategory]),equipped=Number.isFinite(rawCurrent)&&rawCurrent>=0,current=Math.max(0,rawCurrent||0),shape=Math.floor(current/10),color=current%10;
 $("catalogTitle").textContent=titles[activeCategory]||"Styles";
 $("catalogCount").textContent="100 combinations · ALL FREE";
 document.querySelectorAll("#styleTabs button").forEach(b=>b.classList.toggle("selected",b.dataset.category===activeCategory));
 const glyph={hair:"✦",shirt:"▤",hat:"♧",glasses:"◉",chain:"⛓",necklace:"◇"};
 $("styleCatalog").innerHTML=names.slice(0,shapeCount).map((name,i)=>`<button class="style-item ${equipped&&shape===i?'chosen':''}" data-shape="${i}" title="${name}" aria-label="${name}"><span class="item-swatch ${activeCategory}-swatch" style="--swatch:${PALETTES[activeCategory][color]}"><span>${glyph[activeCategory]}</span></span><small>${name}</small><em>FREE</em></button>`).join("");
 $("styleColors").innerHTML=PALETTES[activeCategory].map((c,i)=>`<button class="style-color ${color===i?'selected':''}" data-color="${i}" style="--swatch:${c}" aria-label="${COLOR_NAMES[i]}" title="${COLOR_NAMES[i]}"></button>`).join("");
 $("skinSwatches").innerHTML=SKINS.map((c,i)=>`<button class="skin-swatch ${myLook.skin===c?'selected':''}" data-skin="${c}" style="--skin:${c}" aria-label="Skin tone ${i+1}" title="Skin tone ${i+1}"></button>`).join("");
 const remove=$("removeStyle");
 remove.disabled=activeCategory==="shirt"&&Number(myLook.shirt)===0;
 remove.textContent=activeCategory==="shirt"?"Reset outfit":activeCategory==="hair"?"Remove hair":Number(myLook[activeCategory])<0?"Already unequipped":"Unequip item";
}
function openCustomizer(){$("customizer").classList.remove("hidden");renderCustomizer()}function closeCustomizer(){$("customizer").classList.add("hidden");refreshLobbyAvatar()}

const suits=["♠","♥","♦","♣"],ranks=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const fmt=n=>{n=Number(n||0);if(n>=1e12)return(n/1e12).toFixed(n%1e12===0?0:2).replace(/\.?0+$/,"")+"T";if(n>=1e9)return(n/1e9).toFixed(n%1e9===0?0:2).replace(/\.?0+$/,"")+"B";if(n>=1e6)return(n/1e6).toFixed(n%1e6===0?0:2).replace(/\.?0+$/,"")+"M";if(n>=1e3)return(n/1e3).toFixed(n%1e3===0?0:1).replace(/\.?0+$/,"")+"K";return Math.floor(n).toLocaleString("en-US")};
const exact=n=>Number(n||0).toLocaleString("en-US");
const CHIP_DENOMS=[1000000,500000,100000,50000,10000,5000,1000,500,100,25,5,1];
function chipMarkup(amount,limit=5){let left=Math.max(0,Math.floor(Number(amount)||0)),out=[];for(const d of CHIP_DENOMS){if(left>=d){const count=Math.floor(left/d);left-=count*d;const label=d>=1e6?(d/1e6)+"M":d>=1000?(d/1000)+"K":String(d),color=d>=500000?"gold":d>=50000?"black":d>=5000?"green":d>=500?"blue":d>=25?"red":"gold";for(let i=0;i<Math.min(count,limit-out.length);i++)out.push(`<span class="poker-chip ${color}" title="${exact(d)} chip">${label}</span>`);if(out.length>=limit)break}}if(left>0&&out.length<limit)out.push('<span class="poker-chip gold" title="Remaining chips">+</span>');return `<span class="chip-stack">${out.join("")}</span>`}
function say(s){$("notice").textContent=s;$("notice").classList.remove("hidden");clearTimeout(window.noticeTimer);window.noticeTimer=setTimeout(()=>$("notice").classList.add("hidden"),3200)}
function safeName(s){return String(s||"Guest").trim().slice(0,18)||"Guest"}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function makeDeck(){let d=[];for(let k=0;k<6;k++)for(let suit of suits)for(let rank of ranks)d.push({suit,rank,red:suit==="♥"||suit==="♦"});for(let i=d.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d}
function val(hand){let t=0,a=0;for(const c of hand){if(c.rank==="A"){t+=11;a++}else t+=["K","Q","J"].includes(c.rank)?10:Number(c.rank)}while(t>21&&a){t-=10;a--}return t}
function card(c,back=false){return back?'<div class="playing-card back"></div>':`<div class="playing-card ${c.red?'red':''}"><span>${c.rank}${c.suit}</span><span class="pip">${c.suit}</span><span class="corner-bottom">${c.rank}</span></div>`}
function snapshot(){return{room,phase,round,message,players:players.map(p=>({...p,look:p.look||defaultLook()})),dealer:phase==="playing"?dealer.slice(0,1):dealer,hidden:phase==="playing"}}
function broadcast(){if(host){const snap=snapshot();render(snap);for(const c of conns.values())if(c.open)c.send({type:"state",state:snap})}}
function sendHost(type,data={}){if(host)handleHost(myId,type,data);else if(hostConn&&hostConn.open)hostConn.send({type:"action",action:type,data})}
function render(s){if(!s)return;$("roundNo").textContent=s.round;$("roomLabel").textContent=s.room;$("playerCount").textContent=`${s.players.length} / ${MAX} SEATS`;$("tableMessage").textContent=s.message;$("dealerCards").innerHTML=(s.dealer||[]).map(c=>card(c)).join("")+(s.hidden?card(null,true):"");$("dealerTotal").textContent=s.hidden?"":(s.dealer.length?`DEALER · ${val(s.dealer)}`:"");
 $("playersGrid").innerHTML=s.players.map(p=>{const hand=p.hand||[],total=hand.length?val(hand):"",isMe=p.id===myId,active=p.status==="playing";return `<article class="player-seat ${isMe?'me':''} ${active?'active':''}"><div class="player-head">${avatarMarkup(p.look||defaultLook(),"seat-avatar")}<div class="seat-name">${esc(p.name)}${isMe?'<div class="you-tag">YOU</div>':''}</div></div><div class="seat-chips" title="${exact(p.chips)} chips">${fmt(p.chips)} chips</div><div class="bet-line">${p.bet?chipMarkup(p.bet,3)+`<span title="${exact(p.bet)} chips">${fmt(p.bet)} bet</span>`:"NO BET"}</div><div class="seat-cards">${hand.map(c=>card(c)).join("")}</div><div class="seat-total">${total?`TOTAL ${total}`:""}</div><div class="seat-status ${esc(p.status)}">${esc(p.status)}</div></article>`}).join("");
 const pot=s.players.reduce((sum,p)=>sum+(Number(p.bet)||0),0);$("potChips").innerHTML=pot?chipMarkup(pot,7):"";$("potTotal").textContent=fmt(pot);$("potTotal").title=exact(pot)+" chips";
 const me=s.players.find(p=>p.id===myId);if(me){$("myBalance").textContent=fmt(me.chips);$("myBalance").title=exact(me.chips)+" chips";const betOk=["betting","settled"].includes(s.phase)&&me.bet===0;$("betBtn").disabled=!betOk||me.chips<1;const playing=s.phase==="playing"&&me.status==="playing";$("hitBtn").disabled=!playing;$("standBtn").disabled=!playing;$("doubleBtn").disabled=!(playing&&me.hand.length===2&&me.chips>=me.bet);$("startBtn").disabled=!host||!["betting","settled"].includes(s.phase)||!s.players.some(p=>p.bet>0);$("startBtn").textContent=s.phase==="settled"?"Next round":"Deal cards"}}
function player(id){return players.find(p=>p.id===id)}
function settle(){while(val(dealer)<17)dealer.push(deck.pop());const dt=val(dealer);for(const p of players){if(!p.bet)continue;let v=val(p.hand);if(p.natural&&dt!==21){p.chips+=Math.floor(p.bet*2.5);p.status="blackjack"}else if(v>21)p.status="bust";else if(dt>21||v>dt){p.chips+=p.bet*2;p.status="won"}else if(v===dt)p.chips+=p.bet,p.status="push";else p.status="lost"}phase="settled";message=dt>21?"The dealer busts. Winning hands collect.":dt===21?"Dealer has 21. The table is settled.":"The hand is complete. Collect your chips and place your next bet.";broadcast()}
function done(){return players.filter(p=>p.bet>0).every(p=>["stand","bust","blackjack"].includes(p.status))}
function startRound(){if(!host||!["betting","settled"].includes(phase)||!players.some(p=>p.bet>0))return;if(phase==="settled"){players.forEach(p=>{p.bet=0;p.hand=[];p.status="waiting";p.natural=false});dealer=[]}if(players.some(p=>p.bet===0)){message="Waiting on every player to place a bet before the deal.";broadcast();return}phase="playing";round++;deck=makeDeck();dealer=[deck.pop(),deck.pop()];players.forEach(p=>{p.hand=[deck.pop(),deck.pop()];p.status="playing";p.natural=val(p.hand)===21;if(p.natural)p.status="blackjack"});message="The cards are dealt. Your move.";if(players.every(p=>p.status==="blackjack"))settle();else broadcast()}
function handleHost(id,action,data){const p=player(id);if(!p)return;if(action==="bet"){if(!["betting","settled"].includes(phase)||p.bet)return;let n=Number(data.amount);if(!Number.isSafeInteger(n)||n<1||n>p.chips)return;if(phase==="settled"){phase="betting";dealer=[];players.forEach(x=>{x.bet=0;x.hand=[];x.status="waiting";x.natural=false})}p.chips-=n;p.bet=n;p.status="ready";message="Bets are on the felt. Waiting for the rest of the table.";broadcast()}
 else if(action==="hit"&&phase==="playing"&&p.status==="playing"){p.hand.push(deck.pop());if(val(p.hand)>21)p.status="bust";else if(val(p.hand)===21)p.status="stand";message=p.status==="bust"?p.name+" busts.":p.name+" draws a card.";if(done())settle();else broadcast()}
 else if(action==="stand"&&phase==="playing"&&p.status==="playing"){p.status="stand";message=p.name+" stands.";if(done())settle();else broadcast()}
 else if(action==="double"&&phase==="playing"&&p.status==="playing"&&p.hand.length===2&&p.chips>=p.bet){p.chips-=p.bet;p.bet*=2;p.hand.push(deck.pop());p.status=val(p.hand)>21?"bust":"stand";message=p.name+" doubles down.";if(done())settle();else broadcast()}}
function enterGame(){hideLoading();$("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("roomLabel").textContent=room;$("connectionStatus").textContent=host?"HOST · TABLE CONTROLLER":"CONNECTED TO HOST"}
function wsUrl(){const configured=(window.VN_CONFIG&&window.VN_CONFIG.websocketUrl)||"";if(configured)return configured; if(location.protocol==="https:")return "wss://"+location.host+"/ws";return "ws://"+location.hostname+":8787/ws"}
function connectSocket(onReady){if(socket&&socket.readyState===WebSocket.OPEN){onReady();return}if(socket&&socket.readyState===WebSocket.CONNECTING){socket.addEventListener("open",onReady,{once:true});return}try{socket=new WebSocket(wsUrl())}catch(e){hideLoading();say("Could not open the multiplayer connection. Check the server address.");return}socket.addEventListener("open",()=>{if(onReady)onReady()},{once:true});socket.addEventListener("message",ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}handleServerMessage(m)});socket.addEventListener("error",()=>{hideLoading();say("Multiplayer server connection failed. Please try again.")});socket.addEventListener("close",()=>{if(host){say("Server connection lost. Your table is offline until you reconnect.")}else if(hostConn){say("Connection to the table was interrupted.");hideLoading()}})}
function sendSocket(payload){if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));else say("Not connected to the multiplayer server.")}
function handleServerMessage(m){if(m.type==="registered"){roomId=m.roomId;room=m.roomCode;myId=m.hostId;players=[{id:myId,name:safeName($("playerName").value),look:myLook,chips:START,bet:0,hand:[],status:"waiting",natural:false}];phase="betting";message=m.private?"Your private table is open. Share its code and password with invited friends.":"Your table is open. Friends can find it in the live directory or join with its code.";enterGame();broadcast();loadRooms();return}
 if(m.type==="joined"){roomId=m.roomId;room=m.roomCode;myId=m.playerId;host=false;hostConn={open:true,send:payload=>sendSocket({type:"action",action:payload.action,data:payload.data||{}})};enterGame();render(m.state);return}
 if(m.type==="peer-message"&&host){let c=conns.get(m.peerId);if(!c){c={peer:m.peerId,open:true,send:data=>sendSocket({type:"to-peer",peerId:m.peerId,payload:data}),close:()=>sendSocket({type:"disconnect-peer",peerId:m.peerId})};c.on=(event,fn)=>{c["on"+event]=fn};conns.set(m.peerId,c);if(c.onopen)c.onopen()}if(m.payload&&m.payload.type==="hello"){if(players.length>=MAX){c.send({type:"error",message:"This table is full (12 players maximum)."});return}let name=safeName(m.payload.name);if(players.some(p=>p.name.toLowerCase()===name.toLowerCase()))name=name.slice(0,14)+" "+(players.length+1);players.push({id:m.peerId,name,look:normalizeLook(m.payload.look),chips:START,bet:0,hand:[],status:"waiting",natural:false});c.send({type:"welcome",id:m.peerId,state:snapshot()});message=name+" joined the table.";broadcast()}else if(m.payload&&m.payload.type==="action")handleHost(m.peerId,m.payload.action,m.payload.data||{});return}
 if(m.type==="peer-left"&&host){conns.delete(m.peerId);const p=player(m.peerId);if(p){players=players.filter(x=>x.id!==m.peerId);message=p.name+" left the table.";broadcast()}return}
 if(m.type==="peer-data"&&!host){const data=m.payload;if(data.type==="welcome"){myId=data.id;render(data.state)}else if(data.type==="state")render(data.state);else if(data.type==="error")say(data.message);return}
 if(m.type==="state"&&!host){render(m.state);return}
 if(m.type==="error"){hideLoading();if(!roomId){host=false;hostConn=null;}say(m.message||"The server rejected that request.");return}
 if(m.type==="rooms"){renderRooms(m.rooms||[]);return}
 if(m.type==="pong")return;
}
function hostTable(){room=$("roomCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12);if(!room)room="VN"+Math.random().toString(36).slice(2,7).toUpperCase();const isPrivate=$("privateRoom").checked,password=$("roomPassword").value;if(isPrivate&&password.length<4)return say("Choose a private-room password with at least 4 characters.");showLoading("Opening your table on the multiplayer network…");host=true;connectSocket(()=>sendSocket({type:"host",roomCode:room,name:safeName($("playerName").value),private:isPrivate,password}));}
function joinTable(){room=$("roomCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12);if(!room)return say("Enter a room code or choose a public table below.");showLoading("Finding your table…");host=false;connectSocket(()=>sendSocket({type:"join",roomCode:room,name:safeName($("playerName").value),look:myLook,password:$("roomPassword").value}));}
function joinListedRoom(id){roomId=id;showLoading("Joining the selected table…");host=false;connectSocket(()=>sendSocket({type:"join",roomId:id,name:safeName($("playerName").value),look:myLook,password:$("roomPassword").value}));}
async function loadRooms(){try{const url=(window.VN_CONFIG&&window.VN_CONFIG.httpUrl)||((location.protocol==="https:"?"https://":"http://")+location.hostname+":"+(window.VN_CONFIG&&window.VN_CONFIG.httpPort||8787));const r=await fetch(url+"/api/rooms",{cache:"no-store"});if(!r.ok)throw Error("directory unavailable");const data=await r.json();renderRooms(data.rooms||[])}catch(e){$("roomList").innerHTML='<p class="directory-empty">Live directory is unavailable. You can still join by room code once the server is online.</p>'}}
function renderRooms(rooms){const el=$("roomList");if(!el)return;const open=rooms.filter(r=>!r.private&&r.players<r.maxPlayers);if(!open.length){el.innerHTML='<p class="directory-empty">No public tables are open right now. Create one and invite your friends.</p>';return}el.innerHTML=open.map(r=>`<div class="room-row"><div><b>${esc(r.name||"Velvet North Table")}</b><small>${esc(r.roomCode)} · ${r.players}/${r.maxPlayers} players</small></div><button class="btn btn-gold" data-room-id="${esc(r.id)}">Join</button></div>`).join("");el.querySelectorAll("[data-room-id]").forEach(b=>b.addEventListener("click",()=>joinListedRoom(b.dataset.roomId)))}

$("hostBtn").onclick=hostTable;$("joinBtn").onclick=joinTable;$("refreshRooms").onclick=loadRooms;$("betBtn").onclick=()=>sendHost("bet",{amount:Number($("betAmount").value)});$("hitBtn").onclick=()=>sendHost("hit");$("standBtn").onclick=()=>sendHost("stand");$("doubleBtn").onclick=()=>sendHost("double");$("startBtn").onclick=startRound;$("copyRoom").onclick=async()=>{try{await navigator.clipboard.writeText(room);say("Room code copied. Share it with the game link.")}catch(e){say("Share this room code: "+room)}};

$("customizeBtn").onclick=openCustomizer;$("closeCustomizer").onclick=closeCustomizer;$("customizer").addEventListener("click",e=>{if(e.target.id==="customizer")closeCustomizer()});
document.querySelectorAll(".gender-choice").forEach(b=>b.onclick=()=>{myLook.gender=b.dataset.gender;renderCustomizer()});
document.querySelectorAll("#styleTabs button").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;renderCustomizer()});
$("styleCatalog").addEventListener("click",e=>{const b=e.target.closest("[data-shape]");if(!b)return;const old=Math.max(0,Number(myLook[activeCategory])||0);myLook[activeCategory]=Number(b.dataset.shape)*10+(old%10);renderCustomizer()});
$("styleColors").addEventListener("click",e=>{const b=e.target.closest("[data-color]");if(!b)return;const old=Math.max(0,Number(myLook[activeCategory])||0);myLook[activeCategory]=Math.floor(old/10)*10+Number(b.dataset.color);renderCustomizer()});
$("removeStyle").onclick=()=>{
 if(activeCategory==="shirt"){
  myLook.shirt=0;
  say("Your starter outfit has been restored.");
 }else if(activeCategory==="hair"){
  myLook.hair=-1;
  say("Hair removed. Choose a style to equip it again.");
 }else{
  myLook[activeCategory]=-1;
  say("Item unequipped.");
 }
 renderCustomizer();
};
$("skinSwatches").addEventListener("click",e=>{const b=e.target.closest("[data-skin]");if(!b)return;myLook.skin=b.dataset.skin;renderCustomizer()});
$("randomLook").onclick=()=>{myLook.skin=SKINS[Math.floor(Math.random()*SKINS.length)];for(const c of CATS){const max=100;myLook[c]=Math.floor(Math.random()*max)}renderCustomizer()};
$("saveLook").onclick=()=>{myLook=normalizeLook(myLook);localStorage.setItem("vn-look",JSON.stringify(myLook));refreshLobbyAvatar();closeCustomizer();say("Your character style is saved on this device.")};
refreshLobbyAvatar();loadRooms();roomRefreshTimer=setInterval(loadRooms,15000);setInterval(()=>{if(socket&&socket.readyState===WebSocket.OPEN)sendSocket({type:"ping"})},20000);setTimeout(hideLoading,950);

window.addEventListener("pagehide",()=>{if(socket&&socket.readyState===WebSocket.OPEN)socket.close(1000,"page closed")});
