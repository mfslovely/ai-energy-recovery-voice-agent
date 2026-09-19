const toast = document.getElementById('toast');
const showToast = (msg) => { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); };
const transcript = document.getElementById('transcript');
const handoff = document.getElementById('handoffCard');
const statePill = document.getElementById('statePill');
const signalValue = document.getElementById('signalValue');
const statusText = document.getElementById('statusText');
const customerMeta = document.getElementById('customerMeta');
let escalated = false;
let consented = false;
let browserRecognition;
let journeyState = 'consent';
const extraLeads = [
  ['Arjun Mehta','AM','coral','Postcode','HIGH','Call now'],['Sofia Rossi','SR','blue','Move-in date','MED','Send reminder'],['Noah Williams','NW','mint','Retailer','READY','Continue'],['Emily Chen','EC','violet','Usage estimate','READY','Continue'],['Oliver Smith','OS','blue','Postcode','READY','Call today'],['Grace Lee','GL','coral','Move-in date','MED','Send reminder'],['Ethan Brown','EB','mint','Retailer','READY','Continue'],['Ava Martin','AM','violet','Postcode','READY','Call today'],['William Jones','WJ','blue','Usage estimate','READY','Continue'],['Isla Taylor','IT','coral','Retailer','REVIEW','Check DNC'],['Jack Wilson','JW','mint','Postcode','READY','Call today'],['Mia Davis','MD','violet','Move-in date','READY','Continue'],['Leo Anderson','LA','blue','Retailer','READY','Continue'],['Ruby Thomas','RT','coral','Postcode','MED','Send reminder'],['Henry Moore','HM','mint','Usage estimate','READY','Continue'],['Chloe Jackson','CJ','violet','Move-in date','REVIEW','Check DNC'],['Charlie White','CW','blue','Retailer','READY','Continue'],['Ella Harris','EH','coral','Postcode','READY','Call today'],['James Clark','JC','mint','Usage estimate','READY','Continue'],['Amelia Lewis','AL','violet','Retailer','READY','Continue']
];
const leadList = document.querySelector('.lead-list');
extraLeads.forEach(([name, initials, color, field, priority, action], i) => { const b=document.createElement('button'); b.className='lead'; b.dataset.name=name; b.dataset.id=`EN-${48100-i}`; b.innerHTML=`<span class="avatar ${color}">${initials}</span><span class="lead-info"><strong>${name} <em class="priority ${priority==='HIGH'?'high':priority==='MED'?'medium':priority==='REVIEW'?'review':''}">${priority}</em></strong><small>${field} · ${i+1}d ago</small><small class="action">${action} · ${priority==='HIGH'?'84':priority==='MED'?'61':'72'}% likely</small></span><span class="lead-chevron">›</span>`; leadList.appendChild(b); b.addEventListener('click',()=>{document.querySelectorAll('.lead').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('customerName').innerHTML=`${name} <span class="verified">✓</span>`;document.getElementById('customerMeta').textContent=`Lead ${b.dataset.id} · Energy comparison · 1 field remaining`;showToast(`Loaded ${name}'s recovery journey`)}); });
const greeting = "Hi Priya, I’m Auralis calling from the Energy comparison team. This call is recorded for quality and safety. Is now a good time to continue your comparison? You can ask for a human at any time.";
document.getElementById('startBtn').addEventListener('click', () => {
  transcript.innerHTML = `<div class="turn ai"><span class="turn-label">AURALIS · NOW</span><p>${greeting}</p></div>`;
  statusText.textContent = 'Awaiting consent'; customerMeta.textContent = 'Lead EN-48219 · Energy comparison · Awaiting consent';
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(greeting));
  showToast('Call started — consent is required before collecting details.');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) { browserRecognition = new SpeechRecognition(); browserRecognition.lang='en-AU'; browserRecognition.continuous=true; browserRecognition.interimResults=false; browserRecognition.onresult=e=>{const phrase=e.results[e.results.length-1][0].transcript; sendChat(phrase)}; browserRecognition.onerror=()=>{}; browserRecognition.start(); }
  setTimeout(() => document.getElementById('micBtn').click(), 900);
});

document.querySelectorAll('.lead').forEach((lead) => lead.addEventListener('click', () => {
  document.querySelectorAll('.lead').forEach(x => x.classList.remove('active')); lead.classList.add('active');
  document.getElementById('customerName').innerHTML = `${lead.dataset.name} <span class="verified">✓</span>`;
  customerMeta.textContent = `Lead ${lead.dataset.id} · Energy comparison · 1 field remaining`;
  showToast(`Loaded ${lead.dataset.name}'s recovery journey`);
}));

function runFrustration() {
  if (escalated) return;
  const turn = document.createElement('div'); turn.className = 'turn customer'; turn.innerHTML = '<span class="turn-label">PRIYA · 10:41:02</span><p class="highlight" style="background:#fff0ec;color:#a94e40">Look, I\'ve already told three of you my details. I\'m done with this — stop calling me.</p>';
  transcript.appendChild(turn); transcript.scrollTop = transcript.scrollHeight;
  fetch('http://localhost:8000/api/conversation/analyse', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({lead_id:'EN-48219', text:"I've already told three of you my details. I'm done with this — stop calling me."})}).catch(()=>null);
  setTimeout(() => {
    const ai = document.createElement('div'); ai.className = 'turn ai'; ai.innerHTML = '<span class="turn-label">AURALIS · 10:41:05</span><p>I hear you, Priya. I\'ll stop the automated call now and connect you with a person so you don\'t have to repeat anything.</p>'; transcript.appendChild(ai); transcript.scrollTop = transcript.scrollHeight;
    escalated = true; statePill.textContent = 'HANDOFF NOW'; statePill.className = 'state-pill alert'; signalValue.textContent = 'Frustration / DNC request'; statusText.textContent = 'Human handoff'; handoff.classList.add('alert'); handoff.querySelector('strong').textContent = 'HANDOFF IN PROGRESS'; handoff.querySelector('p').textContent = 'Reason: explicit do-not-call request · context attached'; customerMeta.textContent = 'Lead EN-48219 · Escalating with context';
    fetch('http://localhost:8000/api/handoff', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({lead_id:'EN-48219', text:"I've already told three of you my details. I'm done with this — stop calling me."})}).catch(()=>null);
    showToast('Safety boundary triggered — human handoff created');
  }, 650);
}
document.getElementById('frustrationBtn').addEventListener('click', runFrustration);
function saveTurn(role, text) { const key='auralis-conversation-EN-48219'; const turns=JSON.parse(localStorage.getItem(key)||'[]'); turns.push({role,text,timestamp:new Date().toISOString()}); localStorage.setItem(key, JSON.stringify(turns)); fetch('http://localhost:8000/api/conversations/EN-48219',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,text})}).catch(()=>{}); }
async function sendChat(text) {
  if (!text.trim()) return;
  const turn=document.createElement('div'); turn.className='turn customer'; turn.innerHTML=`<span class="turn-label">CUSTOMER · NOW</span><p class="highlight">${text}</p>`; transcript.appendChild(turn); saveTurn('customer', text);
  let a={next:'continue',safety:{}}; try{a=await fetch('http://localhost:8000/api/conversation/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead_id:'EN-48219',text})}).then(r=>r.json())}catch(_){ }
  const lower=text.toLowerCase();
  if (/^(no|no thanks|no thank you|not interested|not now|i don't want to)/.test(lower.trim())) { const reply="No problem, thanks for your time. I’ll record that you declined and end the call now."; const ai=document.createElement('div'); ai.className='turn ai'; ai.innerHTML=`<span class="turn-label">AURALIS · NOW</span><p>${reply}</p>`; transcript.appendChild(ai); window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply)); if(browserRecognition) browserRecognition.stop(); showToast('Customer declined — call ended respectfully.'); return; }
  let reason=a.safety?.reason; if(!reason&&/stop calling|dont call|don't call|do not call|call me again|do not contact/.test(lower))reason='DNC request'; if(!reason&&/cheapest|recommend|best plan|advice/.test(lower))reason='Off-script request'; if(!reason&&/understand|confused|what do you mean|asking again/.test(lower))reason='Confusion / low confidence'; const needs=a.next==='handoff'||reason;
  if (!needs && journeyState==='consent' && /\b(yes|yeah|okay|ok|sure|continue)\b/.test(lower)) journeyState='postcode';
  const detectedPostcode = a.fields?.postcode || /^\d{4}$/.test(text.trim());
  if (!needs && journeyState==='postcode' && detectedPostcode) { journeyState='move_in_date'; document.getElementById('postcodeValue').textContent=detectedPostcode; document.getElementById('postcodeField').classList.remove('pending'); document.getElementById('postcodeField').querySelector('.field-dot').outerHTML='<span class="field-check">✓</span>'; document.getElementById('journeyCount').textContent='1 / 2'; document.getElementById('journeyProgress').style.width='50%'; }
  if (!needs && journeyState==='move_in_date' && !detectedPostcode && text.trim().length>0) { journeyState='complete'; document.getElementById('moveDateValue').textContent=text.trim(); document.getElementById('moveDateField').classList.remove('pending'); document.getElementById('moveDateField').querySelector('.field-dot').outerHTML='<span class="field-check">✓</span>'; document.getElementById('journeyCount').textContent='2 / 2'; document.getElementById('journeyProgress').style.width='100%'; document.getElementById('nextActionValue').textContent='SUBMIT JOURNEY'; document.getElementById('nextActionDetail').textContent='All recovery fields captured · ready for sandbox'; document.getElementById('customerMeta').textContent='Lead EN-48219 · Energy comparison · Journey ready to submit'; document.getElementById('statusText').textContent='Journey complete'; }
  const reply=needs?`I understand, and I’m sorry this has been frustrating. I’ll stop the automated call and connect you with a person now. You won’t need to repeat anything.`:journeyState==='consent'?`Thanks. Please say yes when you’re ready to continue, or say human if you would prefer a person.`:journeyState==='postcode'?`Thanks. What postcode should we use for the property?`:journeyState==='move_in_date'?`Thank you, I have your postcode. What is your move-in date for the property?`:`Thanks, I’ve captured that. The Energy journey is ready to submit.`; const ai=document.createElement('div'); ai.className='turn ai'; ai.innerHTML=`<span class="turn-label">AURALIS · NOW</span><p>${reply}</p>`; transcript.appendChild(ai); saveTurn('assistant', reply); transcript.scrollTop=transcript.scrollHeight; window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply)); if(needs){statePill.textContent='HANDOFF NOW';statePill.className='state-pill alert';signalValue.textContent=reason||'Safety signal detected';handoff.classList.add('alert');handoff.querySelector('strong').textContent='HUMAN HANDOFF REQUIRED';handoff.querySelector('p').textContent=`Reason: ${reason||'Safety signal detected'} · context attached`;showToast(`Escalating: ${reason||'Safety signal detected'}`)}
}
document.getElementById('sendChat').addEventListener('click',()=>{const i=document.getElementById('chatInput');sendChat(i.value);i.value=''}); document.getElementById('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('sendChat').click()}); document.querySelectorAll('.quick-examples button').forEach(b=>b.addEventListener('click',()=>sendChat(b.dataset.chat)));
document.getElementById('endBtn').addEventListener('click', () => { if(browserRecognition) browserRecognition.stop(); showToast('Call ended safely. Journey saved to review queue.'); });
document.querySelectorAll('.judge-buttons button').forEach(b => b.addEventListener('click', () => sendChat(b.dataset.chat)));
document.getElementById('submitJourney').addEventListener('click',()=>{const nmi=document.getElementById('nmi').value.trim(), usage=document.getElementById('usage').value, consent=document.getElementById('privacyConsent').checked; if(!/^\d{11}$/.test(nmi)){showToast('Enter a test NMI with 11 digits');return} if(!usage){showToast('Select a usage source');return} if(!consent){showToast('Consent is required before submission');return} const savings=Math.floor(420+Math.random()*280); document.getElementById('savingsResult').innerHTML=`<strong>JOURNEY RECOVERED</strong><span>Estimated annual saving against reference price: <b>$${savings}</b></span><small>Test payload accepted · DMO/VDO comparison simulated · no product advice given</small>`; document.getElementById('nextActionValue').textContent='RECOVERED'; document.getElementById('nextActionDetail').textContent='All Energy fields captured · sandbox payload accepted'; document.getElementById('statusText').textContent='Journey submitted'; showToast('Energy journey submitted successfully');});
document.addEventListener('click', e => { const lead=e.target.closest('.lead'); if(!lead) return; journeyState='consent'; escalated=false; consented=false; document.getElementById('journeyCount').textContent='0 / 2'; document.getElementById('postcodeValue').textContent='Awaiting'; document.getElementById('postcodeField').classList.add('pending'); document.getElementById('postcodeField').querySelector('.field-check')?.replaceWith(Object.assign(document.createElement('span'),{className:'field-dot'})); document.getElementById('moveDateValue').textContent='Awaiting'; document.getElementById('moveDateField').classList.add('pending'); document.getElementById('journeyProgress').style.width='0%'; document.getElementById('customerMeta').textContent=`Lead ${lead.dataset.id} · Energy comparison · Awaiting consent`; });
let recorder, chunks = [];
document.getElementById('micBtn').addEventListener('click', async () => {
  const button = document.getElementById('micBtn');
  if (!navigator.mediaDevices?.getUserMedia) { showToast('Microphone is not available in this browser.'); return; }
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); button.innerHTML = '<span>◉</span> Listening automatically';
      const blob = new Blob(chunks, {type:'audio/webm'}); const form = new FormData(); form.append('audio', blob, 'turn.webm');
      showToast('Transcribing with Faster-Whisper…');
      try {
        const res = await fetch('http://localhost:8000/api/speech/transcribe', {method:'POST', body:form});
        const data = await res.json(); if (!data.text) throw new Error('No speech detected');
        const turn = document.createElement('div'); turn.className = 'turn customer'; turn.innerHTML = `<span class="turn-label">YOU · NOW</span><p class="highlight">${data.text}</p>`; transcript.appendChild(turn);
        const analysis = await fetch('http://localhost:8000/api/conversation/analyse', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead_id:'EN-48219',text:data.text})}).then(r=>r.json());
        const reply = analysis.next === 'handoff' ? "I hear you. I will stop the automated call and connect you with a person. You will not need to repeat your details." : (analysis.next === 'move_in_date' ? "Thank you, I have your postcode. What is your move in date for the property?" : "Thanks. What postcode should we use for the property?");
        const ai = document.createElement('div'); ai.className = 'turn ai'; ai.innerHTML = `<span class="turn-label">AURALIS · NOW</span><p>${reply}</p>`; transcript.appendChild(ai); transcript.scrollTop = transcript.scrollHeight;
        // Piper is used when available; browser speech keeps the demo audible without setup.
        try { const audio = await fetch('http://localhost:8000/api/speech/synthesize', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:reply})}); if (audio.ok) { const info = await audio.json(); if (info.audio_url) new Audio(info.audio_url).play(); else window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply)); } else throw new Error('Piper unavailable'); } catch (_) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply)); }
        if (analysis.next === 'handoff') runFrustration(); else showToast('Auralis replied — listen for the next Energy question.');
      } catch (e) { showToast('Speech service unavailable — use the scenario button for the demo.'); }
    };
    recorder.start(); button.innerHTML = '<span>■</span> Stop recording'; statusText.textContent = 'Listening to caller'; showToast('Listening… speak naturally, then press again to stop.');
  } catch (e) { showToast('Microphone permission was not granted.'); }
});
