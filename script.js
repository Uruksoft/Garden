// إعدادات الربط السحابي - أوروك سوفت (المطور مرتضى حسين)
const MASTER_KEY = "$2a$10$nbgEuYtkGYhyQ4pjfdLqc.jIV4M/3aG9LeSlE90Wg/ssJl87ZkXOi";
const BIN_ID = "694b0e57ae596e708fad20d5";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

let teams = [];
let matchHistory = [];

// 1. جلب البيانات من السحابة (محسن)
async function loadDataFromCloud() {
    try {
        const response = await fetch(`${API_URL}/latest`, {
            method: 'GET',
            headers: { 
                "X-Master-Key": MASTER_KEY,
                "X-Bin-Meta": "false" // لجلب البيانات الصافية فقط
            }
        });
        
        if (!response.ok) throw new Error("فشل الاتصال بالسحابة");
        
        const result = await response.json();
        // التحقق من وجود البيانات بداخل المصفوفة أو الكائن
        teams = result.teams || [];
        matchHistory = result.history || [];
        render();
    } catch (error) {
        console.error("خطأ في جلب البيانات:", error);
        // إذا فشل السحابي، حاول القراءة من المحلي مؤقتاً
        teams = JSON.parse(localStorage.getItem('garden_v6_db')) || [];
        matchHistory = JSON.parse(localStorage.getItem('garden_v6_history')) || [];
        render();
    }
}

// 2. حفظ البيانات في السحابة (محسن)
async function saveDataToCloud() {
    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": MASTER_KEY
            },
            body: JSON.stringify({ teams: teams, history: matchHistory })
        });
        
        if (!response.ok) throw new Error("فشل الحفظ في السحابة");
        
        // حفظ نسخة احتياطية محلية دائماً
        localStorage.setItem('garden_v6_db', JSON.stringify(teams));
        localStorage.setItem('garden_v6_history', JSON.stringify(matchHistory));
        
        render(); 
    } catch (error) {
        console.error("خطأ في الحفظ:", error);
        alert("فشل التحديث أونلاين، سيتم الحفظ محلياً فقط!");
    }
}

// --- باقي الدوال (تأكد من تحديثها لتعمل مع الدوال الجديدة) ---

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
}

function toggleInputs() {
    const type = document.querySelector('input[name="playerType"]:checked').value;
    document.getElementById('p2').style.display = (type === 'team') ? 'block' : 'none';
}

async function handleTeamSubmit() {
    const p1 = document.getElementById('p1').value.trim();
    const p2 = document.getElementById('p2').value.trim();
    const type = document.querySelector('input[name="playerType"]:checked').value;
    const editIndex = parseInt(document.getElementById('editIndex').value);

    if(!p1) return alert("اكتب الاسم!");
    let name = (type === 'team' && p2) ? `${p1} & ${p2}` : p1;

    if(editIndex === -1) {
        teams.push({name, type, play:0, win:0, draw:0, loss:0});
    } else {
        teams[editIndex].name = name;
        teams[editIndex].type = type;
        document.getElementById('editIndex').value = "-1";
        document.getElementById('submitBtn').innerHTML = '<i class="fas fa-plus"></i>';
    }
    await saveDataToCloud();
    document.getElementById('p1').value = ""; document.getElementById('p2').value = "";
}

function checkHeadToHead() {
    const t1 = document.getElementById('t1Select').value;
    const t2 = document.getElementById('t2Select').value;
    const info = document.getElementById('h2h-info');
    if (!t1 || !t2 || t1 === t2) { info.innerHTML = "تحليل المواجهات المباشرة ⚔️"; return; }
    let t1Wins = matchHistory.filter(m => m.w === t1 && m.l === t2).length;
    let t2Wins = matchHistory.filter(m => m.w === t2 && m.l === t1).length;
    info.innerHTML = `المواجهات المباشرة: ${t1} (${t1Wins}) - ${t2} (${t2Wins})`;
}

async function saveMatch() {
    const t1Name = document.getElementById('t1Select').value;
    const t2Name = document.getElementById('t2Select').value;
    const res = document.querySelector('input[name="matchRes"]:checked').value;

    if(!t1Name || !t2Name || t1Name === t2Name) return alert("اختار الخصوم!");

    let t1 = teams.find(t => t.name === t1Name);
    let t2 = teams.find(t => t.name === t2Name);

    t1.play++; t2.play++;
    if(res === 'win') { 
        t1.win++; t2.loss++; 
        matchHistory.push({w: t1Name, l: t2Name});
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } else if(res === 'draw') { 
        t1.draw++; t2.draw++; 
        matchHistory.push({w: "تعادل", t1: t1Name, t2: t2Name});
    } else { 
        t1.loss++; t2.win++; 
        matchHistory.push({w: t2Name, l: t1Name});
    }
    
    await saveDataToCloud();
    sendTelegram(t1Name, t2Name, res);
}

function render() {
    const list = document.getElementById('leaderboard-ui');
    const s1 = document.getElementById('t1Select');
    const s2 = document.getElementById('t2Select');
    if (!list || !s1 || !s2) return;

    s1.innerHTML = s2.innerHTML = '<option value="">اختار منافس</option>';
    let tableHTML = `<table class="custom-table"><thead><tr><th>ت</th><th style="text-align:right;">المنافس</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>إدارة</th></tr></thead><tbody>`;

    const sorted = [...teams].sort((a,b) => b.win - a.win);
    sorted.forEach((t, i) => {
        const originalIndex = teams.findIndex(x => x.name === t.name);
        s1.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        s2.innerHTML += `<option value="${t.name}">${t.name}</option>`;
        const isKing = (i === 0 && t.win > 0);

        let lastMatchInfo = "";
        const myMatches = matchHistory.filter(m => m.w === t.name || m.l === t.name || m.t1 === t.name || m.t2 === t.name);
        if (myMatches.length > 0) {
            const last = myMatches[myMatches.length - 1];
            if (last.w === "تعادل") lastMatchInfo = `<span class="last-match-hint">آخر مواجهة: تعادل</span>`;
            else if (last.w === t.name) lastMatchInfo = `<span class="last-match-hint">آخر مواجهة: فاز على ${last.l}</span>`;
            else lastMatchInfo = `<span class="last-match-hint">آخر مواجهة: خسر من ${last.w}</span>`;
        }

        tableHTML += `<tr class="table-row ${isKing ? 'king-row' : ''}">
            <td>${isKing ? '👑' : i+1}</td>
            <td style="text-align:right; font-weight:bold;">${t.name}${lastMatchInfo}</td>
            <td>${t.play}</td><td class="val-win">${t.win}</td><td class="val-draw">${t.draw}</td><td class="val-loss">${t.loss}</td>
            <td><i class="fas fa-edit edit" onclick="editTeam(${originalIndex})"></i><i class="fas fa-trash del" onclick="deleteTeam(${originalIndex})"></i></td>
        </tr>`;
    });
    list.innerHTML = tableHTML + `</tbody></table>`;
}

function editTeam(i) {
    const t = teams[i];
    document.getElementById('p1').value = t.name.split(' & ')[0];
    document.getElementById('p2').value = t.name.split(' & ')[1] || "";
    document.getElementById('editIndex').value = i;
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-check"></i>';
}

async function deleteTeam(i) { if(confirm("حذف؟")) { teams.splice(i, 1); await saveDataToCloud(); } }

async function sendTelegram(t1, t2, res) {
    const token = "8174747468:AAHj8vKg0x8sHrRu90jhDlLANV1MrF5i7xU";
    const chatId = "-1003353598396";
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    let action = res === 'win' ? '✅ غلب' : res === 'draw' ? '🤝 تعادل وية' : '❌ خسر من';
    let msg = `🏟️ نـتيجة مـباراة جـديدة\n───────\n👤 ${t1}\n${action}\n👤 ${t2}\n───────\n📅 ${dateStr}\n⏰ ${timeStr}\n📍 بطولة الحديقة`;
    fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`);
}

setInterval(() => { 
    const dateEl = document.getElementById('date-display');
    if(dateEl) dateEl.innerText = new Date().toLocaleString('ar-EG'); 
}, 1000);

// تشغيل عند فتح الصفحة
loadDataFromCloud();