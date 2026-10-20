// ============================================================
// ai-assistant.js — 游戏内 AI 攻略助手（DOM 覆盖层）
// 右下角「📖 攻略」按钮 → 380×520 聊天弹窗，SSE 流式请求
// ============================================================

import { game } from './state.js';

const API_URL = 'https://fanren-ai-chat.pages.dev/api';
const MAX_HISTORY = 20;

let sessionId = localStorage.getItem('fanren_ai_sid') || ('sid_' + Math.random().toString(36).slice(2, 10));
localStorage.setItem('fanren_ai_sid', sessionId);

export function initAIAssistant() {
  const menu = document.getElementById('menu');

  // 悬浮按钮
  const fab = document.createElement('button');
  fab.textContent = '📖\nai助手';
  fab.style.cssText = `
    position: fixed; right: 16px; bottom: 80px; z-index: 9999;
    width: 64px; height: 64px; border-radius: 50%;
    background: linear-gradient(135deg, #2d5a3d, #4a7c59);
    color: #ffe9a8; font-size: 13px; font-weight: bold;
    border: 2px solid #c9a84c; cursor: pointer;
    box-shadow: 0 4px 16px rgba(45,90,61,0.6);
    animation: breath 2.5s ease-in-out infinite;
  `;

  // 创建style标签注入呼吸动画关键帧
  const style = document.createElement('style');
  style.textContent = `
  @keyframes breath {
    0% {
      transform: scale(1);
      box-shadow: 0 4px 16px rgba(45,90,61,0.6);
    }
    50% {
      transform: scale(1.06);
      box-shadow: 0 6px 24px rgba(45,90,61,0.8);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 4px 16px rgba(45,90,61,0.6);
    }
  }
  `;
  document.head.appendChild(style);

  menu.appendChild(fab);


  // 聊天窗口
  const win = document.createElement('div');
  win.style.cssText = `
    position: fixed; right: 16px; bottom: 160px; z-index: 10000;
    width: 380px; height: 520px; display: none;
    background: rgba(10, 26, 18, 0.95); border-radius: 12px;
    border: 1px solid #8a6d3b; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    flex-direction: column; overflow: hidden;
    font-family: "Microsoft YaHei", sans-serif;
  `;
  win.innerHTML = `
    <div style="padding:10px 14px; background:linear-gradient(135deg,#1a3a28,#2d5a3d); color:#ffe9a8; display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #8a6d3b;">
      <span style="font-weight:bold;">🧙 AI 攻略助手</span>
      <button id="aiClose" style="background:none;border:none;color:#ffe9a8;font-size:18px;cursor:pointer;">✕</button>
    </div>
    <div id="aiMsgList" style="flex:1; overflow-y:auto; padding:12px; color:#e8e0d0; font-size:13px; line-height:1.6;"></div>
    <div style="display:flex; gap:6px; padding:10px; border-top:1px solid #3a5a4a;">
      <input id="aiInput" placeholder="第一关怎么打？" style="flex:1; padding:8px 10px; border-radius:6px; border:1px solid #8a6d3b; background:#0a1a12; color:#ffe9a8; font-size:13px; outline:none;">
      <button id="aiSend" style="padding:8px 14px; border:none; border-radius:6px; background:linear-gradient(135deg,#c9a84c,#e6c870); color:#1a3a28; cursor:pointer; font-weight:bold;">发送</button>
    </div>
  `;
  menu.appendChild(win);

  const msgList = win.querySelector('#aiMsgList');
  const input = win.querySelector('#aiInput');
  const sendBtn = win.querySelector('#aiSend');
  const closeBtn = win.querySelector('#aiClose');

  fab.onclick = () => { win.style.display = win.style.display === 'flex' ? 'none' : 'flex'; };
  closeBtn.onclick = () => { win.style.display = 'none'; };

  // 挂在 #menu 下面，进游戏 menu 整体隐藏时自动消失，回主菜单自动出现，不需要轮询

  // 历史消息：纯内存存，刷新页面自动重置
  let history = [];

  function appendMsg(role, text) {
    const div = document.createElement('div');
    div.style.cssText = role === 'user'
      ? 'margin:8px 0 8px 20px; color:#ffd766; text-align:right; white-space:pre-wrap;'
      : 'margin:8px 20px 8px 0; color:#e8e0d0; white-space:pre-wrap;';
    div.textContent = (role === 'user' ? '🧑‍🎓 ' : '🧙 ') + text;
    msgList.appendChild(div);
    msgList.scrollTop = msgList.scrollHeight;
    history.push({ role, text });
    if (history.length > MAX_HISTORY) {
      history.shift();
      if (msgList.firstChild) msgList.removeChild(msgList.firstChild);
    }
    return div;
  }

  async function ask() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.textContent = '…';

    appendMsg('user', text);
    const botDiv = appendMsg('bot', '');
    // 先显示加载提示，收到第一个片段后自动替换成实际回复
    botDiv.textContent = '🧙 正在思考…';
    botDiv.style.opacity = '0.6';
    let firstChunk = true;

    const timeout = setTimeout(() => {
      botDiv.textContent = '🧙 【超时】服务器响应太慢，请稍后再试';
      botDiv.style.opacity = '1';
      sendBtn.disabled = false; sendBtn.textContent = '发送';
    }, 30000);

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop();
        for (const ev of events) {
          for (const line of ev.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload);
              let c = j.content;
              let piece = '';
              if (typeof c === 'string') piece = c;
              else if (c && typeof c === 'object') {
                piece = c.answer ?? c.text ?? c.content?.text ?? (typeof c.content === 'string' ? c.content : '');
              }
              console.log('收到片段:', JSON.stringify(piece));

              if (piece) {
                if (firstChunk) {
                  botDiv.textContent = '🧙 ';
                  botDiv.style.opacity = '1';
                  firstChunk = false;
                }
                botDiv.textContent += piece;
                msgList.scrollTop = msgList.scrollHeight;
              }
            } catch (e) {
              console.error('AI解析出错:', e);   // 临时
            }
          }
        }
      }
      if (!botDiv.textContent || firstChunk) botDiv.textContent = '🧙 （无回复）';
      botDiv.style.opacity = '1';
    } catch (err) {
      botDiv.textContent = '🧙 【出错】' + (err.message || '网络错误');
      botDiv.style.opacity = '1';
    }
    clearTimeout(timeout);
    sendBtn.disabled = false;
    sendBtn.textContent = '发送';

    // 把最终 bot 回复同步回内存里的历史记录
    const lastBot = history[history.length - 1];
    if (lastBot && lastBot.role === 'bot') {
      lastBot.text = botDiv.textContent.replace(/^🧙\s*/, '');
    }
  }

  sendBtn.onclick = ask;
  input.addEventListener('keydown', e => {
    e.stopPropagation(); // 不冒泡到游戏
    if (e.key === 'Enter') ask();
  });
  // 聚焦时屏蔽游戏键盘监听
  input.addEventListener('focus', () => { game.__aiFocus = true; });
  input.addEventListener('blur', () => { game.__aiFocus = false; });
}
