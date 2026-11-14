"use strict";

const STORAGE_KEYS = {
  conversations: "blinkel_conversations_v2",
  activeConversation: "blinkel_active_conversation_v2"
};

const MODELS = {
  core: { name: "Blinkel Core", description: "Fast and capable" },
  reason: { name: "Blinkel Reason", description: "Deeper reasoning", unavailable: true },
  vision: { name: "Blinkel Vision", description: "Visual understanding", unavailable: true }
};

const state = {
  conversations: [],
  activeConversationId: null,
  selectedModel: "core",
  attachedFiles: [],
  generating: false,
  generationTimer: null,
  temporaryMode: false,
  webSearchEnabled: false,
  historyCollapsed: false,
  deleteTargetId: null,
  recognition: null,
  listening: false
};

const $ = (id) => document.getElementById(id);
const elements = {
  appShell: $("appShell"),
  conversationList: $("conversationList"),
  messageList: $("messageList"),
  welcomeView: $("welcomeView"),
  chatView: $("chatView"),
  messageInput: $("messageInput"),
  characterCount: $("characterCount"),
  sendButton: $("sendButton"),
  composerForm: $("composerForm"),
  fileInput: $("fileInput"),
  attachmentPreviewList: $("attachmentPreviewList"),
  selectedModelName: $("selectedModelName"),
  selectedModelDescription: $("selectedModelDescription"),
  modelModal: $("modelModal"),
  accountModal: $("accountModal"),
  searchModal: $("searchModal"),
  shareModal: $("shareModal"),
  noticeModal: $("noticeModal"),
  deleteModal: $("deleteModal"),
  noticeIcon: $("noticeIcon"),
  noticeTitle: $("noticeTitle"),
  noticeDescription: $("noticeDescription"),
  searchInput: $("conversationSearchInput"),
  searchResults: $("conversationSearchResults"),
  webSearchButton: $("webSearchButton"),
  temporaryChatButton: $("temporaryChatButton"),
  shareChatButton: $("shareChatButton"),
  scrollBottomButton: $("scrollBottomButton"),
  signInForm: $("signInForm"),
  createAccountForm: $("createAccountForm"),
  signInMessage: $("signInMessage"),
  createAccountMessage: $("createAccountMessage")
};

function id(prefix) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function now() {
  return new Date().toISOString();
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.conversations) || "[]");
    state.conversations = Array.isArray(parsed) ? parsed.filter((item) => item && item.id && Array.isArray(item.messages)) : [];
    const active = localStorage.getItem(STORAGE_KEYS.activeConversation);
    state.activeConversationId = state.conversations.some((item) => item.id === active) ? active : null;
  } catch (error) {
    console.error("State load error:", error);
    state.conversations = [];
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(state.conversations.filter((item) => !item.temporary)));
    if (state.activeConversationId) localStorage.setItem(STORAGE_KEYS.activeConversation, state.activeConversationId);
    else localStorage.removeItem(STORAGE_KEYS.activeConversation);
  } catch (error) {
    console.error("State save error:", error);
    openNotice("Storage is full", "Blinkel could not save more local conversation data.", "!");
  }
}

function activeConversation() {
  return state.conversations.find((item) => item.id === state.activeConversationId) || null;
}

function createConversation() {
  const timestamp = now();
  const conversation = { id: id("conversation"), title: "New chat", model: state.selectedModel, temporary: state.temporaryMode, createdAt: timestamp, updatedAt: timestamp, messages: [] };
  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;
  return conversation;
}

function newChat() {
  stopGeneration();
  state.activeConversationId = null;
  state.attachedFiles = [];
  saveState();
  render();
  closeSidebar();
  elements.messageInput.focus();
}

function render() {
  renderModel();
  renderHistory();
  renderChat();
  renderAttachments();
  updateComposer();
  elements.temporaryChatButton.setAttribute("aria-pressed", String(state.temporaryMode));
}

function renderModel() {
  const model = MODELS[state.selectedModel] || MODELS.core;
  elements.selectedModelName.textContent = model.name;
  elements.selectedModelDescription.textContent = model.description;
  document.querySelectorAll(".model-option").forEach((button) => button.classList.toggle("active", button.dataset.model === state.selectedModel));
}

function renderHistory() {
  elements.conversationList.replaceChildren();
  const items = [...state.conversations].filter((item) => !item.temporary).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (state.historyCollapsed || !items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = state.historyCollapsed ? "Recent conversations are hidden." : "Your conversations will appear here.";
    elements.conversationList.append(empty);
    return;
  }
  items.forEach((conversation) => {
    const button = document.createElement("button");
    button.className = "conversation-item";
    if (conversation.id === state.activeConversationId) button.classList.add("active");
    button.type = "button";
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z"></path></svg><span class="conversation-item-title"></span>`;
    button.querySelector("span").textContent = conversation.title;
    const remove = document.createElement("button");
    remove.className = "conversation-item-menu";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${conversation.title}`);
    remove.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M8 7l1 13h6l1-13"></path></svg>`;
    button.addEventListener("click", () => selectConversation(conversation.id));
    remove.addEventListener("click", (event) => { event.stopPropagation(); state.deleteTargetId = conversation.id; openDialog(elements.deleteModal); });
    button.append(remove);
    elements.conversationList.append(button);
  });
}

function selectConversation(conversationId) {
  if (!state.conversations.some((item) => item.id === conversationId)) return;
  stopGeneration();
  state.activeConversationId = conversationId;
  state.selectedModel = activeConversation()?.model || "core";
  state.attachedFiles = [];
  saveState();
  render();
  closeSidebar();
}

function renderChat() {
  const conversation = activeConversation();
  const hasMessages = Boolean(conversation?.messages.length);
  elements.welcomeView.hidden = hasMessages;
  elements.messageList.hidden = !hasMessages;
  elements.shareChatButton.hidden = !hasMessages;
  elements.messageList.replaceChildren();
  if (!hasMessages) return;
  conversation.messages.forEach((message) => elements.messageList.append(createMessage(message)));
  requestAnimationFrame(scrollBottom);
}

function createMessage(message) {
  const article = document.createElement("article");
  article.className = `message ${message.role === "user" ? "user-message" : "assistant-message"}`;
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = message.role === "user" ? "Y" : "B";
  const content = document.createElement("div");
  content.className = "message-content";
  const author = document.createElement("strong");
  author.className = "message-author";
  author.textContent = message.role === "user" ? "You" : "Blinkel";
  const text = document.createElement("div");
  text.className = "message-text";
  if (message.status === "generating") {
    text.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  } else {
    text.textContent = message.content;
  }
  content.append(author, text);
  if (message.role === "assistant" && message.status !== "generating") {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const copy = document.createElement("button");
    copy.className = "message-action-button";
    copy.type = "button";
    copy.title = "Copy response";
    copy.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>`;
    copy.addEventListener("click", () => navigator.clipboard.writeText(message.content).catch(() => openNotice("Copy failed", "Clipboard access was not available.", "!")));
    actions.append(copy);
    content.append(actions);
  }
  article.append(avatar, content);
  return article;
}

function renderAttachments() {
  elements.attachmentPreviewList.replaceChildren();
  elements.attachmentPreviewList.hidden = !state.attachedFiles.length;
  state.attachedFiles.forEach((file) => {
    const preview = document.createElement("div");
    preview.className = "attachment-preview";
    const name = document.createElement("span");
    name.className = "attachment-preview-name";
    name.textContent = file.name;
    const remove = document.createElement("button");
    remove.className = "attachment-remove-button";
    remove.type = "button";
    remove.textContent = "Ã";
    remove.addEventListener("click", () => { state.attachedFiles = state.attachedFiles.filter((item) => item.id !== file.id); renderAttachments(); updateComposer(); });
    preview.append(name, remove);
    elements.attachmentPreviewList.append(preview);
  });
}

function handleFiles(files) {
  const maxSize = 15 * 1024 * 1024;
  const slots = 5 - state.attachedFiles.length;
  Array.from(files).slice(0, Math.max(0, slots)).forEach((file) => {
    if (file.size > maxSize) { openNotice("File too large", `${file.name} is larger than 15 MB.`, "!"); return; }
    state.attachedFiles.push({ id: id("file"), name: file.name, size: file.size, type: file.type });
  });
  elements.fileInput.value = "";
  renderAttachments();
  updateComposer();
}

function updateComposer() {
  const value = elements.messageInput.value;
  elements.characterCount.textContent = `${value.length} / 12000`;
  elements.sendButton.disabled = state.generating ? false : !(value.trim() || state.attachedFiles.length);
  elements.messageInput.disabled = state.generating;
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
  elements.sendButton.classList.toggle("generating", state.generating);
  elements.sendButton.querySelector(".send-icon").hidden = state.generating;
  elements.sendButton.querySelector(".stop-icon").hidden = !state.generating;
}

function submitMessage(event) {
  event.preventDefault();
  if (state.generating) { stopGeneration(); return; }
  const value = elements.messageInput.value.trim();
  if (!value && !state.attachedFiles.length) return;
  const conversation = activeConversation() || createConversation();
  const userMessage = { id: id("message"), role: "user", content: value || "Please review the attached files.", attachments: state.attachedFiles.map(({name,size,type}) => ({name,size,type})), createdAt: now(), status: "complete" };
  conversation.messages.push(userMessage);
  if (conversation.title === "New chat") conversation.title = userMessage.content.length > 42 ? `${userMessage.content.slice(0, 42).trim()}...` : userMessage.content;
  conversation.updatedAt = now();
  conversation.model = state.selectedModel;
  elements.messageInput.value = "";
  state.attachedFiles = [];
  saveState();
  generateResponse(conversation, userMessage);
}

function generateResponse(conversation, userMessage) {
  state.generating = true;
  const assistant = { id: id("message"), role: "assistant", content: "", createdAt: now(), status: "generating" };
  conversation.messages.push(assistant);
  render();
  state.generationTimer = window.setTimeout(() => {
    assistant.status = "complete";
    assistant.content = `Blinkel's improved interface is ready. The secure AI backend is the next step before real answers can be generated.${state.webSearchEnabled ? " Web search is selected, but it is not connected yet." : ""}${userMessage.attachments?.length ? ` ${userMessage.attachments.length} attachment${userMessage.attachments.length === 1 ? " was" : "s were"} selected, but file analysis is not connected yet.` : ""}`;
    conversation.updatedAt = now();
    state.generating = false;
    state.generationTimer = null;
    saveState();
    render();
  }, 900);
}

function stopGeneration() {
  if (state.generationTimer) window.clearTimeout(state.generationTimer);
  state.generationTimer = null;
  const pending = activeConversation()?.messages.find((item) => item.status === "generating");
  if (pending) { pending.status = "complete"; pending.content = "Generation stopped."; }
  state.generating = false;
  saveState();
  render();
}

function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function closeDialog(dialog) { if (dialog?.open) dialog.close(); }
function openNotice(title, description, icon = "B") { elements.noticeTitle.textContent = title; elements.noticeDescription.textContent = description; elements.noticeIcon.textContent = icon; openDialog(elements.noticeModal); }
function openSidebar() { elements.appShell.classList.add("sidebar-open"); }
function closeSidebar() { elements.appShell.classList.remove("sidebar-open"); }
function scrollBottom() { elements.chatView.scrollTop = elements.chatView.scrollHeight; }

function renderSearch() {
  const query = elements.searchInput.value.trim().toLowerCase();
  elements.searchResults.replaceChildren();
  const results = state.conversations.filter((item) => !item.temporary && (!query || `${item.title} ${item.messages.map((message) => message.content).join(" ")}`.toLowerCase().includes(query)));
  if (!results.length) { const p = document.createElement("p"); p.textContent = query ? "No matching conversations." : "No conversations yet."; elements.searchResults.append(p); return; }
  results.forEach((conversation) => { const button = document.createElement("button"); button.className = "search-result-button"; button.type = "button"; button.textContent = conversation.title; button.addEventListener("click", () => { selectConversation(conversation.id); closeDialog(elements.searchModal); }); elements.searchResults.append(button); });
}

function setAuthMode(mode) {
  const signIn = mode === "signin";
  $("signInTab").classList.toggle("active", signIn);
  $("createAccountTab").classList.toggle("active", !signIn);
  elements.signInForm.hidden = !signIn;
  elements.createAccountForm.hidden = signIn;
  elements.signInMessage.textContent = "";
  elements.createAccountMessage.textContent = "";
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;
  state.recognition = new Recognition();
  state.recognition.interimResults = true;
  state.recognition.lang = "en-US";
  state.recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results).map((result) => result[0].transcript).join("");
    elements.messageInput.value = `${elements.messageInput.value} ${transcript}`.trim();
    updateComposer();
  });
  state.recognition.addEventListener("end", () => { state.listening = false; });
}

function setupEvents() {
  $("openSidebarButton").addEventListener("click", openSidebar);
  $("closeSidebarButton").addEventListener("click", closeSidebar);
  $("sidebarOverlay").addEventListener("click", closeSidebar);
  $("brandButton").addEventListener("click", newChat);
  $("newChatButton").addEventListener("click", newChat);
  $("collapseHistoryButton").addEventListener("click", () => { state.historyCollapsed = !state.historyCollapsed; $("collapseHistoryButton").setAttribute("aria-expanded", String(!state.historyCollapsed)); renderHistory(); });
  $("searchChatsButton").addEventListener("click", () => { elements.searchInput.value = ""; renderSearch(); openDialog(elements.searchModal); });
  $("accountButton").addEventListener("click", () => { setAuthMode("signin"); openDialog(elements.accountModal); });
  $("signInButton").addEventListener("click", () => { setAuthMode("signin"); openDialog(elements.accountModal); });
  $("modelSelectorButton").addEventListener("click", () => openDialog(elements.modelModal));
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeDialog($(button.dataset.close))));
  document.querySelectorAll(".model-option").forEach((button) => button.addEventListener("click", () => { const model = MODELS[button.dataset.model]; if (model.unavailable) { closeDialog(elements.modelModal); openNotice(`${model.name} is coming later`, "This model is not available in the current prototype.", button.dataset.model[0].toUpperCase()); return; } state.selectedModel = button.dataset.model; closeDialog(elements.modelModal); renderModel(); }));
  document.querySelectorAll(".suggestion-card").forEach((card) => card.addEventListener("click", () => { elements.messageInput.value = card.dataset.prompt || ""; updateComposer(); elements.messageInput.focus(); }));
  elements.composerForm.addEventListener("submit", submitMessage);
  elements.messageInput.addEventListener("input", updateComposer);
  elements.messageInput.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); elements.composerForm.requestSubmit(); } });
  $("attachFileButton").addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", () => handleFiles(elements.fileInput.files));
  elements.webSearchButton.addEventListener("click", () => { state.webSearchEnabled = !state.webSearchEnabled; elements.webSearchButton.setAttribute("aria-pressed", String(state.webSearchEnabled)); });
  $("toolsButton").addEventListener("click", () => openNotice("Blinkel tools", "Search, image generation, document analysis, and code tools will be connected later.", "+"));
  elements.temporaryChatButton.addEventListener("click", () => { state.temporaryMode = !state.temporaryMode; newChat(); openNotice(state.temporaryMode ? "Temporary chat enabled" : "Temporary chat disabled", state.temporaryMode ? "New temporary chats will not be saved to local storage." : "New chats will be saved in this browser.", "T"); });
  elements.shareChatButton.addEventListener("click", () => openDialog(elements.shareModal));
  $("createShareLinkButton").addEventListener("click", () => { closeDialog(elements.shareModal); openNotice("Sharing is coming later", "A secure backend is required before share links can be created.", "S"); });
  elements.searchInput.addEventListener("input", renderSearch);
  $("confirmDeleteButton").addEventListener("click", () => { state.conversations = state.conversations.filter((item) => item.id !== state.deleteTargetId); if (state.activeConversationId === state.deleteTargetId) state.activeConversationId = null; state.deleteTargetId = null; closeDialog(elements.deleteModal); saveState(); render(); });
  $("signInTab").addEventListener("click", () => setAuthMode("signin"));
  $("createAccountTab").addEventListener("click", () => setAuthMode("create"));
  elements.signInForm.addEventListener("submit", (event) => { event.preventDefault(); elements.signInMessage.textContent = "Account services are not connected yet."; });
  elements.createAccountForm.addEventListener("submit", (event) => { event.preventDefault(); elements.createAccountMessage.textContent = "Account services are not connected yet."; });
  elements.scrollBottomButton.addEventListener("click", scrollBottom);
  elements.chatView.addEventListener("scroll", () => { const distance = elements.chatView.scrollHeight - elements.chatView.scrollTop - elements.chatView.clientHeight; elements.scrollBottomButton.hidden = distance < 180; });
  $("voiceButton").addEventListener("click", () => { if (!state.recognition) { openNotice("Voice input unavailable", "This browser does not support speech recognition.", "V"); return; } if (state.listening) state.recognition.stop(); else { state.listening = true; state.recognition.start(); } });
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeSidebar(); });
}

function initialize() {
  loadState();
  setupVoice();
  setupEvents();
  render();
}

initialize();
