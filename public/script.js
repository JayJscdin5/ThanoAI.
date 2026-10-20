document.addEventListener("DOMContentLoaded", () => {

// Grab the page elements we'll use.
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");

const chatContainer = document.getElementById("chatContainer");
const welcomeScreen = document.getElementById("welcomeScreen");
const chatList = document.getElementById("chatList");

const newChatBtn = document.getElementById("newChatBtn");
const themeSwitch = document.getElementById("themeSwitch");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const topbarActions = document.getElementById("topbarActions");
const motionToggle = document.getElementById("motionToggle");

const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

const attachBtn = document.getElementById("attachBtn");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const imagePreviewImg = document.getElementById("imagePreviewImg");
const clearImageBtn = document.getElementById("clearImageBtn");

const modelName = "gemini-3.1-flash-lite";

let chats = {};
let currentChatId = null;
let selectedImageBase64 = null;
let isSending = false;

console.log("hellotesting");
// Open and close the sidebar.
menuBtn.addEventListener("click", () => sidebar.classList.add("open"));
sidebarCloseBtn.addEventListener("click", () => sidebar.classList.remove("open"));

// Remember the theme and motion settings.
function setTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("theme-dark", isDark);
  document.body.classList.toggle("theme-light", !isDark);
  themeSwitch.setAttribute("aria-checked", String(isDark));
  themeSwitch.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  try { localStorage.setItem("thano-theme", theme); } catch (_) {}
}

let savedTheme = null;
try { savedTheme = localStorage.getItem("thano-theme"); } catch (_) {}
setTheme(savedTheme === "light" ? "light" : "dark");
themeSwitch.addEventListener("click", () => {
  setTheme(document.body.classList.contains("theme-dark") ? "light" : "dark");
});

function closeSettings() {
  settingsPanel.hidden = true;
  settingsBtn.setAttribute("aria-expanded", "false");
}
settingsBtn.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsBtn.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});
document.addEventListener("click", (event) => {
  if (!topbarActions.contains(event.target)) closeSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsPanel.hidden) {
    closeSettings();
    settingsBtn.focus();
  }
});

let savedReduceMotion = null;
try { savedReduceMotion = localStorage.getItem("thano-reduce-motion"); } catch (_) {}
const reduceMotion = savedReduceMotion === null
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : savedReduceMotion === "on";
motionToggle.checked = reduceMotion;
document.body.classList.toggle("reduce-motion", reduceMotion);
motionToggle.addEventListener("change", () => {
  document.body.classList.toggle("reduce-motion", motionToggle.checked);
  try { localStorage.setItem("thano-reduce-motion", motionToggle.checked ? "on" : "off"); } catch (_) {}
});

// Start a fresh chat.
newChatBtn.addEventListener("click", () => {
  createNewChat();
  sidebar.classList.remove("open");
});

function createNewChat() {
  currentChatId = "chat_" + Date.now();
  chats[currentChatId] = [];
  renderChatList();
  renderMessages();
}

// Show the chats in the sidebar.
function renderChatList() {
  chatList.innerHTML = "";

  Object.keys(chats).forEach((id) => {
    const li = document.createElement("li");
    li.classList.add("chat-list-item");
    if (id === currentChatId) li.classList.add("active");

    const title = chats[id][0]
      ? chats[id][0].text.slice(0, 20) + "..."
      : "New Chat";

    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    li.appendChild(titleSpan);

    li.addEventListener("click", () => {
      currentChatId = id;
      renderChatList();
      renderMessages();
      sidebar.classList.remove("open");
    });

    chatList.appendChild(li);
  });
}

// Format replies and put the conversation on screen.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

function formatAssistantReply(value) {
  const lines = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s*\*{3,}\s*/g, "\n\n")
    .replace(/\s+(?=\d+[.)]\s)/g, "\n")
    .split("\n");
  const blocks = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map(formatInlineMarkdown).join(" ")}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      blocks.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      blocks.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const nextListType = numbered ? "ol" : "ul";
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        blocks.push(`<${listType}>`);
      }
      blocks.push(`<li>${formatInlineMarkdown((numbered || bullet)[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return `<div class="formatted-reply">${blocks.join("")}</div>`;
}

function addReplyActions(row, bubble, msg) {
  const actions = document.createElement("div");
  actions.className = "message-actions";

  const makeButton = (label, icon, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "message-action";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
    actions.appendChild(button);
    return action(button);
  };

  for (const [kind, label, icon] of [["like", "Like", "👍"], ["dislike", "Dislike", "👎"]]) {
    makeButton(label, icon, (button) => {
      button.setAttribute("aria-pressed", String(msg.feedback === kind));
      if (msg.feedback === kind) button.classList.add("selected");
      button.addEventListener("click", () => {
        msg.feedback = msg.feedback === kind ? null : kind;
        for (const item of actions.querySelectorAll("button")) {
          const selected = item.dataset.feedback === msg.feedback;
          item.classList.toggle("selected", selected);
          item.setAttribute("aria-pressed", String(selected));
        }
      });
      button.dataset.feedback = kind;
    });
  }

  makeButton("Copy", "⧉", (button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(bubble.innerText.trim());
        button.querySelector("span:last-child").textContent = "Copied";
        window.setTimeout(() => { if (button.isConnected) button.querySelector("span:last-child").textContent = "Copy"; }, 1400);
      } catch (_) {
        button.querySelector("span:last-child").textContent = "Copy failed";
        window.setTimeout(() => { if (button.isConnected) button.querySelector("span:last-child").textContent = "Copy"; }, 1600);
      }
    });
  });
  row.appendChild(actions);
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, document.body.classList.contains("reduce-motion") ? 0 : ms));

async function animateAssistantReply(msg, chatId) {
  const bubble = msg.replyBubble;
  const words = msg.text.match(/\S+\s*/g) || [msg.text];
  msg.isTyping = true;
  msg.revealedText = "";
  bubble.classList.add("is-streaming");

  for (let i = 0; i < words.length; i += 2) {
    if (!bubble.isConnected) break;
    msg.revealedText += words.slice(i, i + 2).join("");
    bubble.innerHTML = formatAssistantReply(msg.revealedText);
    await wait(28);
  }

  msg.isTyping = false;
  msg.revealedText = msg.text;
  if (bubble.isConnected) {
    bubble.classList.remove("is-streaming");
    bubble.innerHTML = formatAssistantReply(msg.text);
  }
  if (chatId === currentChatId) renderMessages();
}

function renderMessages() {
  chatContainer.innerHTML = "";
  const messages = currentChatId ? chats[currentChatId] : [];
  welcomeScreen.classList.toggle("hidden", Boolean(messages && messages.length));
  if (!currentChatId) return;

  chats[currentChatId].forEach((msg) => {
    const row = document.createElement("div");
    row.classList.add("message-row", msg.role);

    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble");

    if (msg.imageBase64) {
      bubble.classList.add("image-bubble");
      const image = document.createElement('img');
      image.src = msg.imageBase64;
      image.alt = 'Uploaded image';
      bubble.appendChild(image);
    } else if (msg.role === "ai") {
      bubble.innerHTML = formatAssistantReply(msg.isTyping ? msg.revealedText : msg.text);
      if (msg.isTyping) bubble.classList.add("is-streaming");
      msg.replyBubble = bubble;
    } else {
      bubble.textContent = msg.text;
    }

    row.appendChild(bubble);
    if (msg.role === "ai" && !msg.isTyping && !msg.text.startsWith("⚠️")) {
      addReplyActions(row, bubble, msg);
    }
    chatContainer.appendChild(row);
  });

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Handle image uploads.
attachBtn.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    selectedImageBase64 = reader.result;
    imagePreviewImg.src = selectedImageBase64;
    imagePreview.style.display = "flex";
  };
  reader.readAsDataURL(file);
});

clearImageBtn.addEventListener("click", () => {
  selectedImageBase64 = null;
  imagePreview.style.display = "none";
  imageInput.value = "";
});

// Show a small indicator while ThanoAI is thinking.
function showTyping() {
  document.getElementById("typing-indicator").classList.remove("hidden");
}

function hideTyping() {
  document.getElementById("typing-indicator").classList.add("hidden");
}

// Add the user's message and send it to the server.
sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  if (isSending) return;
  const text = userInput.value.trim();
  if (!text && !selectedImageBase64) return;

  if (!currentChatId) createNewChat();

  chats[currentChatId].push({
    role: "user",
    text,
    imageBase64: selectedImageBase64
  });

  renderMessages();
  renderChatList();

  const chatId = currentChatId;
  const imageForRequest = selectedImageBase64;
  sendToBackend(text, chats[chatId], imageForRequest, chatId);

  userInput.value = "";
  selectedImageBase64 = null;
  imagePreview.style.display = "none";
}

// Ask the server for a reply.
async function sendToBackend(userText, history, currentImage, chatId) {
  if (isSending) return;
  isSending = true;

  showTyping();

  // Older images stay in the chat, but only the current one goes to the server.
  const sanitizedHistory = history.map(msg => ({
    role: msg.role,
    text: msg.text
  }));

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userText,
        history: sanitizedHistory,
        modelName,
        currentImage
      })
    });

    const data = await response.json();
    hideTyping();

    const assistantMessage = {
      role: "ai",
      text: data.reply || "No response",
      imageBase64: null
    };
    chats[chatId].push(assistantMessage);

    if (chatId === currentChatId) renderMessages();
    renderChatList();
    if (chatId === currentChatId) {
      await animateAssistantReply(assistantMessage, chatId);
    }
  } catch (err) {
    hideTyping();

    chats[chatId].push({
      role: "ai",
      text: "⚠️ Error contacting server."
    });

    renderMessages();
  }

  isSending = false;
}

});






