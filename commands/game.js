import { randomUUID } from "crypto";

const html = String.raw`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
html,body{margin:0;padding:0;width:100%;overflow:hidden;background:transparent;font-family:Segoe UI,Arial,sans-serif;touch-action:manipulation}
.game{width:100%;max-width:410px;margin:auto;padding:14px;border-radius:24px;background:linear-gradient(145deg,#090b12,#151925);color:#fff;border:1px solid rgba(255,255,255,.08);box-shadow:0 15px 45px rgba(0,0,0,.35)}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.brand{font-size:23px;font-weight:1000;letter-spacing:-1px}
.badge{padding:6px 10px;border-radius:20px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);font-size:10px;font-weight:900;color:#a5b4fc}
.screen{display:none}
.screen.active{display:block}
.hero{padding:20px 12px;text-align:center;border-radius:20px;background:linear-gradient(145deg,rgba(99,102,241,.16),rgba(168,85,247,.08));border:1px solid rgba(255,255,255,.07)}
.hero-icon{font-size:48px;margin-bottom:5px}
.hero-title{font-size:25px;font-weight:1000}
.hero-text{font-size:11px;color:#9ca3af;margin-top:6px}
.games{display:grid;gap:10px;margin-top:12px}
.game-btn{width:100%;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:15px;text-align:left;color:white;background:#111522;box-shadow:0 5px 0 rgba(0,0,0,.25)}
.game-btn:active,.action:active,.dpad:active{transform:translateY(3px);box-shadow:none}
.game-name{font-size:16px;font-weight:1000}
.game-desc{font-size:10px;color:#8f98aa;margin-top:4px}
.game-arrow{float:right;font-size:20px;margin-top:4px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}
.stat{padding:8px;border-radius:13px;text-align:center;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06)}
.stat-label{font-size:8px;color:#737b8e;font-weight:900}
.stat-value{font-size:15px;font-weight:1000;margin-top:2px}
.board{position:relative;width:100%;aspect-ratio:1;border-radius:19px;overflow:hidden;background:#080b12;border:2px solid rgba(255,255,255,.08);box-shadow:inset 0 0 35px rgba(0,0,0,.5)}
.snake,.food,.obstacle{position:absolute}
.snake{width:5%;height:5%;border-radius:30%;z-index:3}
.snake.head{background:#4ade80;box-shadow:0 0 10px rgba(74,222,128,.7)}
.snake.body{background:#16a34a}
.food{width:5%;height:5%;border-radius:50%;background:#fb7185;box-shadow:0 0 14px rgba(251,113,133,.8);animation:pulse .65s infinite alternate}
.obstacle{width:5%;height:5%;border-radius:5px;background:linear-gradient(145deg,#f97316,#dc2626);box-shadow:0 0 7px rgba(249,115,22,.35)}
@keyframes pulse{from{transform:scale(.72)}to{transform:scale(1)}}
.controls{width:210px;margin:12px auto 4px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:52px 52px 52px;gap:6px}
.dpad{border:1px solid rgba(255,255,255,.08);border-radius:14px;background:linear-gradient(145deg,#252b3a,#151923);color:#fff;font-size:21px;font-weight:1000;box-shadow:0 4px 0 #080a0f}
.up{grid-column:2;grid-row:1}.left{grid-column:1;grid-row:2}.center{grid-column:2;grid-row:2;font-size:15px}.right{grid-column:3;grid-row:2}.down{grid-column:2;grid-row:3}
.message{padding:9px;margin-top:9px;border-radius:12px;text-align:center;background:rgba(255,255,255,.045);color:#a7afbf;font-size:10px;font-weight:800}
.top-actions{display:flex;gap:7px;margin-bottom:10px}
.action{flex:1;border:1px solid rgba(255,255,255,.08);background:#111522;color:#fff;border-radius:12px;padding:9px;font-size:10px;font-weight:900}
.overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,7,12,.88);backdrop-filter:blur(8px);border-radius:19px}
.panel{width:100%;padding:20px;border-radius:19px;text-align:center;background:#121622;border:1px solid rgba(255,255,255,.09);box-shadow:0 15px 40px rgba(0,0,0,.5)}
.panel-icon{font-size:40px}
.panel-title{font-size:23px;font-weight:1000;margin-top:5px}
.panel-text{font-size:10px;color:#8992a5;margin-top:5px}
.panel-buttons{display:grid;gap:8px;margin-top:15px}
.mode{border:0;border-radius:13px;padding:12px;color:#fff;font-size:12px;font-weight:1000;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.classic{background:#4f46e5}.wni{background:linear-gradient(135deg,#dc2626,#f97316)}
.restart{background:#7c3aed}
.hidden{display:none!important}
</style>
</head>
<body>
<div class="game">

<div class="header">
<div class="brand">🎮 GAME CENTER</div>
<div class="badge">PONTA</div>
</div>

<div id="home" class="screen active">
<div class="hero">
<div class="hero-icon">🕹️</div>
<div class="hero-title">Pilih Game</div>
<div class="hero-text">Main santai atau uji refleks kamu, Senpai.</div>
</div>

<div class="games">
<button class="game-btn" onclick="openSnake()">
<span class="game-arrow">›</span>
<div class="game-name">🐍 Snake</div>
<div class="game-desc">Makan makanan, tumbuh panjang dan hindari rintangan.</div>
</button>
</div>
</div>

<div id="snakeScreen" class="screen">
<div class="top-actions">
<button class="action" onclick="backHome()">‹ GAME</button>
<button class="action" onclick="showSnakeModes()">↻ MODE</button>
</div>

<div class="stats">
<div class="stat"><div class="stat-label">SCORE</div><div class="stat-value" id="snakeScore">0</div></div>
<div class="stat"><div class="stat-label">BEST</div><div class="stat-value" id="snakeBest">0</div></div>
<div class="stat"><div class="stat-label">LEVEL</div><div class="stat-value" id="snakeLevel">1</div></div>
</div>

<div class="board" id="snakeBoard">
<div class="overlay" id="snakeOverlay">
<div class="panel">
<div class="panel-icon">🐍</div>
<div class="panel-title">Pilih Mode</div>
<div class="panel-text">Tentukan arena sebelum mulai.</div>
<div class="panel-buttons">
<button class="mode classic" onclick="startSnake('classic')">🎮 KLASIK</button>
<button class="mode wni" onclick="startSnake('wni')">🇮🇩 WNI • BANYAK RINTANGAN</button>
</div>
</div>
</div>
</div>

<div class="controls">
<button class="dpad up" onclick="snakeDirection('up')">▲</button>
<button class="dpad left" onclick="snakeDirection('left')">◀</button>
<button class="dpad center" onclick="pauseSnake()">Ⅱ</button>
<button class="dpad right" onclick="snakeDirection('right')">▶</button>
<button class="dpad down" onclick="snakeDirection('down')">▼</button>
</div>

<div class="message" id="snakeMessage">Pilih mode Snake untuk mulai.</div>
</div>

</div>

<script>
var audioCtx=null;

function sound(type){
try{
if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
if(audioCtx.state==='suspended')audioCtx.resume();
var o=audioCtx.createOscillator();
var g=audioCtx.createGain();
var d={
click:[280,.045,'square'],
eat:[600,.12,'sine'],
bad:[150,.12,'sawtooth'],
good:[760,.14,'sine'],
win:[900,.2,'sine']
};
var x=d[type]||d.click;
o.type=x[2];
o.frequency.value=x[0];
g.gain.setValueAtTime(x[1],audioCtx.currentTime);
g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.15);
o.connect(g);
g.connect(audioCtx.destination);
o.start();
o.stop(audioCtx.currentTime+.16);
}catch(e){}
}

function screen(id){
document.querySelectorAll('.screen').forEach(function(x){x.classList.remove('active')});
document.getElementById(id).classList.add('active');
}

function openSnake(){
sound('click');
screen('snakeScreen');
showSnakeModes();
}

function backHome(){
sound('click');
clearInterval(snakeTimer);
snakeRunning=false;
screen('home');
}

var snake=[];
var snakeFood={x:10,y:10};
var snakeObstacles=[];
var snakeDir={x:1,y:0};
var snakeNext={x:1,y:0};
var snakeTimer=null;
var snakeScoreValue=0;
var snakeLevelValue=1;
var snakeRunning=false;
var snakePaused=false;
var snakeMode='classic';

var snakeBestValue=Number(localStorage.getItem('pontaSnakeBest')||0);
document.getElementById('snakeBest').innerText=snakeBestValue;

function snakePos(el,x,y){
el.style.left=(x/20*100)+'%';
el.style.top=(y/20*100)+'%';
}

function snakeOccupied(x,y){
for(var i=0;i<snake.length;i++){
if(snake[i].x===x&&snake[i].y===y)return true;
}
for(var j=0;j<snakeObstacles.length;j++){
if(snakeObstacles[j].x===x&&snakeObstacles[j].y===y)return true;
}
return false;
}

function snakeFree(){
var p;
var tries=0;
do{
p={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};
tries++;
if(tries>1000)return{x:19,y:19};
}while(
snakeOccupied(p.x,p.y)||
(snake.length&&Math.abs(p.x-snake[0].x)<3&&Math.abs(p.y-snake[0].y)<3)
);
return p;
}

function createSnakeObstacles(){
snakeObstacles=[];
if(snakeMode!=='wni')return;

var count=65;
var tries=0;

while(snakeObstacles.length<count&&tries<500){
tries++;
var p={
x:Math.floor(Math.random()*20),
y:Math.floor(Math.random()*20)
};

if(
Math.abs(p.x-9)<5&&
Math.abs(p.y-10)<5
)continue;

if(!snakeOccupied(p.x,p.y)){
snakeObstacles.push(p);
}
}
}

function drawSnake(){
var board=document.getElementById('snakeBoard');

board.querySelectorAll('.snake,.food,.obstacle').forEach(function(e){e.remove()});

snakeObstacles.forEach(function(o){
var el=document.createElement('div');
el.className='obstacle';
snakePos(el,o.x,o.y);
board.appendChild(el);
});

snake.forEach(function(s,i){
var el=document.createElement('div');
el.className='snake '+(i===0?'head':'body');
snakePos(el,s.x,s.y);
board.appendChild(el);
});

var food=document.createElement('div');
food.className='food';
snakePos(food,snakeFood.x,snakeFood.y);
board.appendChild(food);
}

function startSnake(mode){
sound('click');

snakeMode=mode;
snakeScoreValue=0;
snakeLevelValue=1;
snakeDir={x:1,y:0};
snakeNext={x:1,y:0};
snakePaused=false;

snake=[
{x:9,y:10},
{x:8,y:10},
{x:7,y:10}
];

createSnakeObstacles();
snakeFood=snakeFree();
snakeRunning=true;

document.getElementById('snakeOverlay').classList.add('hidden');

document.getElementById('snakeMessage').innerText=
mode==='wni'
?'🇮🇩 Mode WNI aktif! Hindari banyak rintangan!'
:'🎮 Mode Klasik dimulai!';

updateSnakeStats();
drawSnake();

clearInterval(snakeTimer);
snakeTimer=setInterval(snakeTick,snakeSpeed());
}

function snakeSpeed(){
return Math.max(
snakeMode==='wni'?65:75,
160-(snakeLevelValue*7)
);
}

function updateSnakeStats(){
document.getElementById('snakeScore').innerText=snakeScoreValue;
document.getElementById('snakeBest').innerText=snakeBestValue;
document.getElementById('snakeLevel').innerText=snakeLevelValue;
}

function snakeCollision(h){
if(h.x<0||h.x>=20||h.y<0||h.y>=20)return true;

for(var i=1;i<snake.length;i++){
if(snake[i].x===h.x&&snake[i].y===h.y)return true;
}

for(var j=0;j<snakeObstacles.length;j++){
if(snakeObstacles[j].x===h.x&&snakeObstacles[j].y===h.y)return true;
}

return false;
}

function snakeTick(){
if(!snakeRunning||snakePaused)return;

snakeDir=snakeNext;

var head={
x:snake[0].x+snakeDir.x,
y:snake[0].y+snakeDir.y
};

if(snakeCollision(head)){
snakeEnd();
return;
}

snake.unshift(head);

if(head.x===snakeFood.x&&head.y===snakeFood.y){

snakeScoreValue+=snakeMode==='wni'?20:10;
sound('eat');

snakeFood=snakeFree();

var old=snakeLevelValue;
snakeLevelValue=Math.floor(snakeScoreValue/50)+1;

if(snakeLevelValue>old){
sound('good');
document.getElementById('snakeMessage').innerText='🔥 LEVEL UP!';
clearInterval(snakeTimer);
snakeTimer=setInterval(snakeTick,snakeSpeed());
}else{
document.getElementById('snakeMessage').innerText='🍎 Mantap! Score bertambah.';
}

if(snakeScoreValue>snakeBestValue){
snakeBestValue=snakeScoreValue;
localStorage.setItem('pontaSnakeBest',String(snakeBestValue));
}

}else{
snake.pop();
}

updateSnakeStats();
drawSnake();
}

function snakeEnd(){
snakeRunning=false;
clearInterval(snakeTimer);
sound('bad');

if(snakeScoreValue>snakeBestValue){
snakeBestValue=snakeScoreValue;
localStorage.setItem('pontaSnakeBest',String(snakeBestValue));
}

updateSnakeStats();

var ov=document.getElementById('snakeOverlay');
ov.innerHTML=
'<div class="panel">'+
'<div class="panel-icon">💥</div>'+
'<div class="panel-title">GAME OVER</div>'+
'<div class="panel-text">Score kamu: '+snakeScoreValue+'</div>'+
'<div class="panel-buttons">'+
'<button class="mode restart" onclick="startSnake(\''+snakeMode+'\')">🔄 COBA LAGI</button>'+
'<button class="mode classic" onclick="showSnakeModes()">🎮 GANTI MODE</button>'+
'</div>'+
'</div>';

ov.classList.remove('hidden');
document.getElementById('snakeMessage').innerText='Game over! Coba pecahkan best score 😎';
}

function showSnakeModes(){
clearInterval(snakeTimer);
snakeRunning=false;

var ov=document.getElementById('snakeOverlay');

ov.innerHTML=
'<div class="panel">'+
'<div class="panel-icon">🐍</div>'+
'<div class="panel-title">Pilih Mode</div>'+
'<div class="panel-text">Pilih arena Snake kamu.</div>'+
'<div class="panel-buttons">'+
'<button class="mode classic" onclick="startSnake(\'classic\')">🎮 KLASIK</button>'+
'<button class="mode wni" onclick="startSnake(\'wni\')">🇮🇩 WNI • BANYAK RINTANGAN</button>'+
'</div>'+
'</div>';

ov.classList.remove('hidden');
}

function snakeDirection(dir){
if(!snakeRunning)return;

var d;

if(dir==='up')d={x:0,y:-1};
if(dir==='down')d={x:0,y:1};
if(dir==='left')d={x:-1,y:0};
if(dir==='right')d={x:1,y:0};

if(!d)return;

if(d.x===-snakeDir.x&&d.y===-snakeDir.y)return;

snakeNext=d;
sound('click');
}

function pauseSnake(){
if(!snakeRunning)return;

snakePaused=!snakePaused;
sound('click');

document.getElementById('snakeMessage').innerText=
snakePaused?'⏸️ Game dijeda':'▶️ Lanjut bermain!';
}

document.addEventListener('keydown',function(e){
var key={
ArrowUp:'up',
ArrowDown:'down',
ArrowLeft:'left',
ArrowRight:'right',
w:'up',
W:'up',
s:'down',
S:'down',
a:'left',
A:'left',
d:'right',
D:'right'
};

if(key[e.key]){
e.preventDefault();
snakeDirection(key[e.key]);
}

if(e.key===' '){
e.preventDefault();
pauseSnake();
}
});

var startX=0;
var startY=0;

document.getElementById('snakeBoard').addEventListener('touchstart',function(e){
if(!snakeRunning)return;
var t=e.touches[0];
startX=t.clientX;
startY=t.clientY;
},{passive:true});

document.getElementById('snakeBoard').addEventListener('touchend',function(e){
if(!snakeRunning)return;
var t=e.changedTouches[0];
var dx=t.clientX-startX;
var dy=t.clientY-startY;

if(Math.abs(dx)<25&&Math.abs(dy)<25)return;

if(Math.abs(dx)>Math.abs(dy)){
snakeDirection(dx>0?'right':'left');
}else{
snakeDirection(dy>0?'down':'up');
}
},{passive:true});
</script>
</body>
</html>
`;

export default {
    name: "game",
    aliases: ["snake", "yuegame"],
    category: "game",
    description: "Mainkan mini game snake interaktif langsung di WhatsApp",
    usage: "!game",
    async handler({ message, sock, prefix }) {
        try {
            const responseId = randomUUID();

            await sock.relayMessage(
                message.chat,
                {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2,
                        botMetadata: {
                            botResponseId: responseId
                        }
                    },
                    botForwardedMessage: {
                        message: {
                            richResponseMessage: {
                                messageType: 1,
                                submessages: [
                                    {
                                        messageType: 2,
                                        messageText: "Game Center"
                                    }
                                ],
                                unifiedResponse: {
                                    data: Buffer.from(
                                        JSON.stringify({
                                            response_id: responseId,
                                            sections: [
                                                {
                                                    view_model: {
                                                        primitive: {
                                                            __typename: "GenAIaeacdsnwHtmlPrimitive",
                                                            payload: html,
                                                            trusted_sources: []
                                                        },
                                                        __typename: "GenAISingleLayoutViewModel"
                                                    }
                                                }
                                            ]
                                        })
                                    ).toString("base64")
                                },
                                contextInfo: {
                                    forwardingScore: 1,
                                    isForwarded: true,
                                    forwardedAiBotMessageInfo: {
                                        botJid: "867051314767696@bot"
                                    },
                                    forwardOrigin: 4
                                }
                            }
                        }
                    }
                },
                {
                    messageId: responseId
                }
            );
        } catch (error) {
            console.error("[ERROR GAME]", error);
            await message.reply(`❌ Gagal meluncurkan game. Pastikan aplikasi WhatsApp mendukung pesan interaktif.`);
        }
    }
};
