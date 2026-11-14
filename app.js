"use strict";

const SUPABASE_URL = "https://ebmloajzuvmeykumycjb.supabase.co";
const CHAT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/chat`;

const STORAGE_KEYS = {
  conversations: "blinkel_conversations_v3",
  activeConversation: "blinkel_active_conversation_v3",
  focusMode: "blinkel_focus_mode_v1",
  compactResponses: "blinkel_compact_responses_v1",
  reduceMotion: "blinkel_reduce_motion_v1",
  canvas: "blinkel_canvas_v1",
  project: "blinkel_project_v1"
};

const MODELS = {
  core: {
    name: "Blinkel Core",
    description: "Fast and capable",
    unavailable: false
  },
  reason: {
    name: "Blinkel Reason",
    description: "Deeper reasoning",
    unavailable: true
  },
  vision: {
    name: "Blinkel Vision",
    description: "Visual understanding",
    unavailable: true
  }
};

const FOCUS_MODES = {
  quick: "Fast, concise answers",
  think: "Deeper reasoning for complex problems",
  study: "Step-by-step teaching and practice",
  create: "Original writing and idea development",
  research: "Source-aware research workflow",
  code: "Programming, debugging, and technical work"
};

const state = {
  conversations: [],
  activeConversationId: null,
  selectedModel: "core",
  attachedFiles: [],
  generating: false,
  generationAbortController: null,
  temporaryMode: false,
  webSearchEnabled: false,
  historyCollapsed: false,
  deleteTargetId: null,
  recognition: null,
  listening: false,
  focusMode: localStorage.getItem(STORAGE_KEYS.focusMode) || "quick",
  compactResponses:
    localStorage.getItem(STORAGE_KEYS.compactResponses) === "true",
  reduceMotion:
    localStorage.getItem(STORAGE_KEYS.reduceMotion) === "true",
  project: localStorage.getItem(STORAGE_KEYS.project) || "personal",
  workspaceText: localStorage.getItem(STORAGE_KEYS.canvas) || ""
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
  settingsModal: $("settingsModal"),
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
  createAccountMessage: $("createAccountMessage"),
  commandMenu: $("commandMenu"),
  focusDescription: $("focusDescription"),
  workspacePanel: $("workspacePanel"),
  workspaceEditor: $("workspaceEditor"),
  workspaceTitle: $("workspaceTitle"),
  workspaceStatus: $("workspaceStatus"),
  workspaceCount: $("workspaceCount"),
  projectSelect: $("projectSelect")
};

function createId(prefix) {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return `${prefix}_${randomPart}`;
}

function now() {
  return new Date().toISOString();
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.conversations);
    const parsed = saved ? JSON.parse(saved) : [];

    state.conversations = Array.isArray(parsed)
      ? parsed.filter(
          (conversation) =>
            conversation &&
            typeof conversation.id === "string" &&
            Array.isArray(conversation.messages)
        )
      : [];

    const activeId = localStorage.getItem(STORAGE_KEYS.activeConversation);

    state.activeConversationId = state.conversations.some(
      (conversation) => conversation.id === activeId
    )
      ? activeId
      : null;
  } catch (error) {
    console.error("State load error:", error);
    state.conversations = [];
    state.activeConversationId = null;
  }
}

function saveState() {
  try {
    const persistentConversations = state.conversations.filter(
      (conversation) => !conversation.temporary
    );

    localStorage.setItem(
      STORAGE_KEYS.conversations,
      JSON.stringify(persistentConversations)
    );

    if (state.activeConversationId) {
      localStorage.setItem(
        STORAGE_KEYS.activeConversation,
        state.activeConversationId
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.activeConversation);
    }
  } catch (error) {
    console.error("State save error:", error);
    openNotice(
      "Storage is full",
      "Blinkel could not save more local conversation data.",
      "!"
    );
  }
}

function getActiveConversation() {
  return (
    state.conversations.find(
      (conversation) => conversation.id === state.activeConversationId
    ) || null
  );
}

function createConversation() {
  const timestamp = now();
  const conversation = {
    id: createId("conversation"),
    title: "New chat",
    model: state.selectedModel,
    focusMode: state.focusMode,
    temporary: state.temporaryMode,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: []
  };

  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;
  return conversation;
}

function generateConversationTitle(content) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "New chat";
  }

  return normalized.length > 42
    ? `${normalized.slice(0, 42).trim()}...`
    : normalized;
}

function startNewChat() {
  stopGeneration();
  state.activeConversationId = null;
  state.attachedFiles = [];
  saveState();
  renderApplication();
  closeSidebar();
  requestAnimationFrame(() => elements.messageInput?.focus());
}

function selectConversation(conversationId) {
  const conversation = state.conversations.find(
    (item) => item.id === conversationId
  );

  if (!conversation) {
    return;
  }

  stopGeneration();
  state.activeConversationId = conversation.id;
  state.selectedModel = conversation.model || "core";
  state.focusMode = conversation.focusMode || state.focusMode;
  state.attachedFiles = [];
  saveState();
  renderApplication();
  closeSidebar();
}

function renderApplication() {
  renderModel();
  renderFocusMode();
  renderHistory();
  renderChat();
  renderAttachments();
  renderSettings();
  updateWorkspace();
  updateComposer();
  updateCommandMenu();

  elements.temporaryChatButton?.setAttribute(
    "aria-pressed",
    String(state.temporaryMode)
  );

  elements.webSearchButton?.setAttribute(
    "aria-pressed",
    String(state.webSearchEnabled)
  );
}

function renderModel() {
  const model = MODELS[state.selectedModel] || MODELS.core;

  if (elements.selectedModelName) {
    elements.selectedModelName.textContent = model.name;
  }

  if (elements.selectedModelDescription) {
    elements.selectedModelDescription.textContent = model.description;
  }

  document.querySelectorAll(".model-option").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.model === state.selectedModel
    );
  });
}

function renderFocusMode() {
  document.querySelectorAll(".focus-chip").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.focus === state.focusMode
    );
  });

  if (elements.focusDescription) {
    elements.focusDescription.textContent =
      FOCUS_MODES[state.focusMode] || FOCUS_MODES.quick;
  }
}

function renderHistory() {
  elements.conversationList.replaceChildren();

  const items = [...state.conversations]
    .filter((conversation) => !conversation.temporary)
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() -
        new Date(first.updatedAt).getTime()
    );

  if (state.historyCollapsed || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = state.historyCollapsed
      ? "Recent conversations are hidden."
      : "Your conversations will appear here.";
    elements.conversationList.appendChild(empty);
    return;
  }

  items.forEach((conversation) => {
    const row = document.createElement("div");
    row.className = "conversation-item";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");

    if (conversation.id === state.activeConversationId) {
      row.classList.add("active");
    }

    const icon = document.createElement("span");
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h14v10H9l-4 4V5Z"></path>
      </svg>
    `;

    const title = document.createElement("span");
    title.className = "conversation-item-title";
    title.textContent = conversation.title;

    const remove = document.createElement("button");
    remove.className = "conversation-item-menu";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${conversation.title}`);
    remove.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M9 7V4h6v3M8 7l1 13h6l1-13"></path>
      </svg>
    `;

    row.addEventListener("click", () => {
      selectConversation(conversation.id);
    });

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectConversation(conversation.id);
      }
    });

    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      state.deleteTargetId = conversation.id;
      openDialog(elements.deleteModal);
    });

    row.append(icon, title, remove);
    elements.conversationList.appendChild(row);
  });
}

function renderChat() {
  const conversation = getActiveConversation();
  const hasMessages = Boolean(conversation?.messages.length);

  elements.welcomeView.hidden = hasMessages;
  elements.messageList.hidden = !hasMessages;
  elements.shareChatButton.hidden = !hasMessages;
  elements.messageList.replaceChildren();

  if (!hasMessages) {
    return;
  }

  conversation.messages.forEach((message) => {
    elements.messageList.appendChild(createMessageElement(message));
  });

  requestAnimationFrame(scrollToBottom);
}

function createMessageElement(message) {
  const article = document.createElement("article");
  article.className = `message ${
    message.role === "user" ? "user-message" : "assistant-message"
  }`;

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
    text.innerHTML = `
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
  } else {
    text.textContent = message.content;
  }

  content.append(author, text);

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const attachmentList = document.createElement("div");
    attachmentList.className = "message-actions";

    message.attachments.forEach((attachment) => {
      const item = document.createElement("span");
      item.className = "attachment-preview";
      item.textContent = attachment.name;
      attachmentList.appendChild(item);
    });

    content.appendChild(attachmentList);
  }

  if (message.role === "assistant" && message.status !== "generating") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyButton = createActionButton(
      "Copy response",
      `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>`
    );

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(message.content);
      } catch {
        openNotice(
          "Copy failed",
          "Clipboard access was not available.",
          "!"
        );
      }
    });

    const regenerateButton = createActionButton(
      "Regenerate response",
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v6h-6"></path><path d="M18.5 9A7 7 0 1 0 19 16"></path></svg>`
    );

    regenerateButton.addEventListener("click", () => {
      regenerateResponse(message.id);
    });

    const canvasButton = document.createElement("button");
    canvasButton.className = "message-action-button add-canvas-button";
    canvasButton.type = "button";
    canvasButton.textContent = "Add to Canvas";
    canvasButton.addEventListener("click", () => {
      addToWorkspace(message.content);
    });

    actions.append(copyButton, regenerateButton, canvasButton);
    content.appendChild(actions);
  }

  article.append(avatar, content);
  return article;
}

function createActionButton(label, iconHtml) {
  const button = document.createElement("button");
  button.className = "message-action-button";
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = iconHtml;
  return button;
}

function renderAttachments() {
  elements.attachmentPreviewList.replaceChildren();
  elements.attachmentPreviewList.hidden =
    state.attachedFiles.length === 0;

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
    remove.setAttribute("aria-label", `Remove ${file.name}`);

    remove.addEventListener("click", () => {
      state.attachedFiles = state.attachedFiles.filter(
        (item) => item.id !== file.id
      );
      renderAttachments();
      updateComposer();
    });

    preview.append(name, remove);
    elements.attachmentPreviewList.appendChild(preview);
  });
}

function handleFiles(files) {
  const maximumSize = 15 * 1024 * 1024;
  const availableSlots = 5 - state.attachedFiles.length;

  Array.from(files)
    .slice(0, Math.max(0, availableSlots))
    .forEach((file) => {
      if (file.size > maximumSize) {
        openNotice(
          "File too large",
          `${file.name} is larger than 15 MB.`,
          "!"
        );
        return;
      }

      state.attachedFiles.push({
        id: createId("file"),
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream"
      });
    });

  elements.fileInput.value = "";
  renderAttachments();
  updateComposer();
}

function updateComposer() {
  const value = elements.messageInput.value;

  elements.characterCount.textContent = `${value.length} / 12000`;
  elements.sendButton.disabled = state.generating
    ? false
    : !(value.trim() || state.attachedFiles.length);

  elements.messageInput.disabled = state.generating;
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(
    elements.messageInput.scrollHeight,
    200
  )}px`;

  elements.sendButton.classList.toggle("generating", state.generating);

  const sendIcon = elements.sendButton.querySelector(".send-icon");
  const stopIcon = elements.sendButton.querySelector(".stop-icon");

  if (sendIcon) {
    sendIcon.hidden = state.generating;
  }

  if (stopIcon) {
    stopIcon.hidden = !state.generating;
  }
}

function submitMessage(event) {
  event.preventDefault();

  if (state.generating) {
    stopGeneration();
    return;
  }

  const value = elements.messageInput.value.trim();

  if (!value && state.attachedFiles.length === 0) {
    return;
  }

  const conversation = getActiveConversation() || createConversation();
  const userMessage = {
    id: createId("message"),
    role: "user",
    content: value || "Please review the attached files.",
    attachments: state.attachedFiles.map(({ name, size, type }) => ({
      name,
      size,
      type
    })),
    createdAt: now(),
    status: "complete"
  };

  conversation.messages.push(userMessage);
  conversation.title =
    conversation.title === "New chat"
      ? generateConversationTitle(userMessage.content)
      : conversation.title;
  conversation.updatedAt = now();
  conversation.model = state.selectedModel;
  conversation.focusMode = state.focusMode;

  elements.messageInput.value = "";
  state.attachedFiles = [];
  saveState();
  generateResponse(conversation);
}

async function generateResponse(conversation) {
  state.generating = true;
  state.generationAbortController = new AbortController();

  const assistantMessage = {
    id: createId("message"),
    role: "assistant",
    content: "",
    createdAt: now(),
    status: "generating"
  };

  conversation.messages.push(assistantMessage);
  conversation.updatedAt = now();
  saveState();
  renderApplication();

  const messages = conversation.messages
    .filter(
      (message) =>
        message.id !== assistantMessage.id &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  try {
    const response = await fetch(CHAT_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: JSON.stringify({
        messages,
        focusMode: state.focusMode,
        webSearch: state.webSearchEnabled
      }),
      signal: state.generationAbortController.signal
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        responseText || "Blinkel received an invalid server response."
      );
    }

    if (!response.ok) {
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : "Blinkel could not generate a response."
      );
    }

    if (typeof data.response !== "string" || !data.response.trim()) {
      throw new Error("Blinkel received an empty AI response.");
    }

    assistantMessage.content = data.response.trim();
    assistantMessage.status = "complete";
    assistantMessage.metadata = {
      model: data.model || "Blinkel Core",
      providerModel: data.providerModel || null,
      focusMode: data.focusMode || state.focusMode,
      webSearchUsed: data.webSearchUsed === true
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      assistantMessage.content = "Generation stopped.";
      assistantMessage.status = "stopped";
    } else {
      console.error("Blinkel response error:", error);
      assistantMessage.content =
        error instanceof Error
          ? `Blinkel error: ${error.message}`
          : "Blinkel could not generate a response.";
      assistantMessage.status = "error";
    }
  } finally {
    conversation.updatedAt = now();
    state.generating = false;
    state.generationAbortController = null;
    saveState();
    renderApplication();
  }
}

function stopGeneration() {
  if (state.generationAbortController) {
    state.generationAbortController.abort();
  }
}

function regenerateResponse(messageId) {
  if (state.generating) {
    return;
  }

  const conversation = getActiveConversation();

  if (!conversation) {
    return;
  }

  const assistantIndex = conversation.messages.findIndex(
    (message) => message.id === messageId
  );

  if (assistantIndex === -1) {
    return;
  }

  let hasEarlierUserMessage = false;

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (conversation.messages[index].role === "user") {
      hasEarlierUserMessage = true;
      break;
    }
  }

  if (!hasEarlierUserMessage) {
    return;
  }

  conversation.messages.splice(assistantIndex, 1);
  saveState();
  generateResponse(conversation);
}

function openDialog(dialog) {
  if (dialog && !dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(dialog) {
  if (dialog?.open) {
    dialog.close();
  }
}

function openNotice(title, description, icon = "B") {
  elements.noticeTitle.textContent = title;
  elements.noticeDescription.textContent = description;
  elements.noticeIcon.textContent = icon;
  openDialog(elements.noticeModal);
}

function openSidebar() {
  elements.appShell.classList.add("sidebar-open");
}

function closeSidebar() {
  elements.appShell.classList.remove("sidebar-open");
}

function scrollToBottom() {
  elements.chatView.scrollTop = elements.chatView.scrollHeight;
}

function renderSearchResults() {
  const query = elements.searchInput.value.trim().toLowerCase();
  elements.searchResults.replaceChildren();

  const results = state.conversations.filter((conversation) => {
    if (conversation.temporary) {
      return false;
    }

    const searchableText = [
      conversation.title,
      ...conversation.messages.map((message) => message.content)
    ]
      .join(" ")
      .toLowerCase();

    return !query || searchableText.includes(query);
  });

  if (results.length === 0) {
    const message = document.createElement("p");
    message.textContent = query
      ? "No matching conversations."
      : "No conversations yet.";
    elements.searchResults.appendChild(message);
    return;
  }

  results.forEach((conversation) => {
    const button = document.createElement("button");
    button.className = "search-result-button";
    button.type = "button";
    button.textContent = conversation.title;
    button.addEventListener("click", () => {
      selectConversation(conversation.id);
      closeDialog(elements.searchModal);
    });
    elements.searchResults.appendChild(button);
  });
}

function openSearchModal() {
  elements.searchInput.value = "";
  renderSearchResults();
  openDialog(elements.searchModal);
  requestAnimationFrame(() => elements.searchInput.focus());
}

function setAuthMode(mode) {
  const isSignIn = mode === "signin";

  $("signInTab")?.classList.toggle("active", isSignIn);
  $("createAccountTab")?.classList.toggle("active", !isSignIn);
  elements.signInForm.hidden = !isSignIn;
  elements.createAccountForm.hidden = isSignIn;
  elements.signInMessage.textContent = "";
  elements.createAccountMessage.textContent = "";
}

function updateCommandMenu() {
  if (!elements.commandMenu) {
    return;
  }

  const value = elements.messageInput.value.trimStart();
  elements.commandMenu.hidden = !(
    value === "/" || /^\/[a-z]*$/i.test(value)
  );
}

function renderSettings() {
  const compactToggle = $("compactResponsesToggle");
  const motionToggle = $("reduceMotionToggle");

  if (compactToggle) {
    compactToggle.checked = state.compactResponses;
  }

  if (motionToggle) {
    motionToggle.checked = state.reduceMotion;
  }

  document.body.classList.toggle("reduce-motion", state.reduceMotion);
}

function exportConversationData() {
  const exportData = {
    product: "Blinkel",
    version: "0.5",
    exportedAt: now(),
    conversations: state.conversations.filter(
      (conversation) => !conversation.temporary
    )
  };

  downloadTextFile(
    `blinkel-export-${now().slice(0, 10)}.json`,
    JSON.stringify(exportData, null, 2),
    "application/json"
  );
}

function clearAllBlinkelData() {
  if (!window.confirm("Delete every locally saved Blinkel conversation?")) {
    return;
  }

  stopGeneration();
  state.conversations = [];
  state.activeConversationId = null;
  state.attachedFiles = [];
  localStorage.removeItem(STORAGE_KEYS.conversations);
  localStorage.removeItem(STORAGE_KEYS.activeConversation);
  closeDialog(elements.settingsModal);
  renderApplication();
  openNotice(
    "Local data cleared",
    "All conversations saved in this browser were removed.",
    "â"
  );
}

function downloadTextFile(fileName, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openWorkspace() {
  if (!elements.workspacePanel) {
    return;
  }

  elements.workspacePanel.hidden = false;
  document.body.classList.add("workspace-open");
  updateWorkspace();
  requestAnimationFrame(() => elements.workspaceEditor?.focus());
}

function closeWorkspace() {
  if (!elements.workspacePanel) {
    return;
  }

  elements.workspacePanel.hidden = true;
  document.body.classList.remove("workspace-open");
}

function updateWorkspace() {
  if (!elements.workspaceEditor) {
    return;
  }

  if (elements.workspaceEditor.value !== state.workspaceText) {
    elements.workspaceEditor.value = state.workspaceText;
  }

  if (elements.workspaceCount) {
    elements.workspaceCount.textContent =
      `${state.workspaceText.length} characters`;
  }

  if (elements.workspaceStatus) {
    elements.workspaceStatus.textContent = "Saved locally";
  }

  if (elements.workspaceTitle) {
    elements.workspaceTitle.textContent =
      `${state.project.charAt(0).toUpperCase()}${state.project.slice(1)} canvas`;
  }

  if (elements.projectSelect) {
    elements.projectSelect.value = state.project;
  }
}

function saveWorkspace(value) {
  state.workspaceText = value;
  localStorage.setItem(STORAGE_KEYS.canvas, value);
  updateWorkspace();
}

function addToWorkspace(text) {
  const cleaned = String(text || "").trim();

  if (!cleaned) {
    return;
  }

  const separator = state.workspaceText.trim() ? "\n\n---\n\n" : "";
  saveWorkspace(`${state.workspaceText}${separator}${cleaned}`);
  openWorkspace();
}

function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.interimResults = true;
  state.recognition.lang = "en-US";

  state.recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join("");

    elements.messageInput.value =
      `${elements.messageInput.value} ${transcript}`.trim();
    updateComposer();
  });

  state.recognition.addEventListener("end", () => {
    state.listening = false;
  });
}

function setupEvents() {
  $("openSidebarButton")?.addEventListener("click", openSidebar);
  $("closeSidebarButton")?.addEventListener("click", closeSidebar);
  $("sidebarOverlay")?.addEventListener("click", closeSidebar);
  $("brandButton")?.addEventListener("click", startNewChat);
  $("newChatButton")?.addEventListener("click", startNewChat);

  $("collapseHistoryButton")?.addEventListener("click", () => {
    state.historyCollapsed = !state.historyCollapsed;
    $("collapseHistoryButton").setAttribute(
      "aria-expanded",
      String(!state.historyCollapsed)
    );
    renderHistory();
  });

  $("searchChatsButton")?.addEventListener("click", openSearchModal);

  $("accountButton")?.addEventListener("click", () => {
    setAuthMode("signin");
    openDialog(elements.accountModal);
  });

  $("signInButton")?.addEventListener("click", () => {
    setAuthMode("signin");
    openDialog(elements.accountModal);
  });

  $("modelSelectorButton")?.addEventListener("click", () => {
    openDialog(elements.modelModal);
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      closeDialog($(button.dataset.close));
    });
  });

  document.querySelectorAll(".model-option").forEach((button) => {
    button.addEventListener("click", () => {
      const model = MODELS[button.dataset.model];

      if (!model) {
        return;
      }

      if (model.unavailable) {
        closeDialog(elements.modelModal);
        openNotice(
          `${model.name} is coming later`,
          "This model is not available in the current Blinkel version.",
          button.dataset.model.charAt(0).toUpperCase()
        );
        return;
      }

      state.selectedModel = button.dataset.model;
      closeDialog(elements.modelModal);
      renderModel();
    });
  });

  document.querySelectorAll(".focus-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusMode = button.dataset.focus;
      localStorage.setItem(STORAGE_KEYS.focusMode, state.focusMode);
      renderFocusMode();
    });
  });

  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      elements.messageInput.value = card.dataset.prompt || "";
      updateComposer();
      elements.messageInput.focus();
    });
  });

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.messageInput.value = button.dataset.command || "";
      elements.commandMenu.hidden = true;
      updateComposer();
      elements.messageInput.focus();
    });
  });

  elements.composerForm.addEventListener("submit", submitMessage);
  elements.messageInput.addEventListener("input", () => {
    updateComposer();
    updateCommandMenu();
  });

  elements.messageInput.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      elements.composerForm.requestSubmit();
    }
  });

  $("attachFileButton")?.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener("change", () => {
    handleFiles(elements.fileInput.files);
  });

  elements.webSearchButton.addEventListener("click", () => {
    state.webSearchEnabled = !state.webSearchEnabled;
    elements.webSearchButton.setAttribute(
      "aria-pressed",
      String(state.webSearchEnabled)
    );
  });

  $("toolsButton")?.addEventListener("click", () => {
    openNotice(
      "Blinkel tools",
      "Live web search, image generation, and file analysis will be connected later.",
      "+"
    );
  });

  elements.temporaryChatButton.addEventListener("click", () => {
    state.temporaryMode = !state.temporaryMode;
    startNewChat();
    openNotice(
      state.temporaryMode
        ? "Temporary chat enabled"
        : "Temporary chat disabled",
      state.temporaryMode
        ? "New temporary chats will not be saved to local storage."
        : "New chats will be saved in this browser.",
      "T"
    );
  });

  elements.shareChatButton.addEventListener("click", () => {
    openDialog(elements.shareModal);
  });

  $("createShareLinkButton")?.addEventListener("click", () => {
    closeDialog(elements.shareModal);
    openNotice(
      "Sharing is coming later",
      "Cloud sharing will be enabled after Blinkel accounts are connected.",
      "S"
    );
  });

  elements.searchInput.addEventListener("input", renderSearchResults);

  $("confirmDeleteButton")?.addEventListener("click", () => {
    state.conversations = state.conversations.filter(
      (conversation) => conversation.id !== state.deleteTargetId
    );

    if (state.activeConversationId === state.deleteTargetId) {
      state.activeConversationId = null;
    }

    state.deleteTargetId = null;
    closeDialog(elements.deleteModal);
    saveState();
    renderApplication();
  });

  $("signInTab")?.addEventListener("click", () => {
    setAuthMode("signin");
  });

  $("createAccountTab")?.addEventListener("click", () => {
    setAuthMode("create");
  });

  elements.signInForm.addEventListener("submit", (event) => {
    event.preventDefault();
    elements.signInMessage.textContent =
      "Account services are not connected yet.";
  });

  elements.createAccountForm.addEventListener("submit", (event) => {
    event.preventDefault();
    elements.createAccountMessage.textContent =
      "Account services are not connected yet.";
  });

  elements.scrollBottomButton.addEventListener("click", scrollToBottom);

  elements.chatView.addEventListener("scroll", () => {
    const distance =
      elements.chatView.scrollHeight -
      elements.chatView.scrollTop -
      elements.chatView.clientHeight;

    elements.scrollBottomButton.hidden = distance < 180;
  });

  $("voiceButton")?.addEventListener("click", () => {
    if (!state.recognition) {
      openNotice(
        "Voice input unavailable",
        "This browser does not support speech recognition.",
        "V"
      );
      return;
    }

    if (state.listening) {
      state.recognition.stop();
    } else {
      state.listening = true;
      state.recognition.start();
    }
  });

  $("settingsButton")?.addEventListener("click", () => {
    openDialog(elements.settingsModal);
  });

  $("compactResponsesToggle")?.addEventListener("change", (event) => {
    state.compactResponses = event.target.checked;
    localStorage.setItem(
      STORAGE_KEYS.compactResponses,
      String(state.compactResponses)
    );
  });

  $("reduceMotionToggle")?.addEventListener("change", (event) => {
    state.reduceMotion = event.target.checked;
    localStorage.setItem(
      STORAGE_KEYS.reduceMotion,
      String(state.reduceMotion)
    );
    renderSettings();
  });

  $("exportDataButton")?.addEventListener("click", exportConversationData);
  $("clearDataButton")?.addEventListener("click", clearAllBlinkelData);

  $("openWorkspaceButton")?.addEventListener("click", openWorkspace);
  $("closeWorkspaceButton")?.addEventListener("click", closeWorkspace);

  $("downloadWorkspaceButton")?.addEventListener("click", () => {
    downloadTextFile(
      `blinkel-${state.project}-canvas.md`,
      state.workspaceText,
      "text/markdown"
    );
  });

  elements.workspaceEditor?.addEventListener("input", (event) => {
    saveWorkspace(event.target.value);
  });

  $("clearWorkspaceButton")?.addEventListener("click", () => {
    if (window.confirm("Clear the entire Blinkel Canvas?")) {
      saveWorkspace("");
    }
  });

  elements.projectSelect?.addEventListener("change", () => {
    state.project = elements.projectSelect.value;
    localStorage.setItem(STORAGE_KEYS.project, state.project);
    updateWorkspace();
  });

  document.querySelectorAll("[data-workspace-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const additions = {
        heading: "\n## Heading\n",
        bullet: "\n- Item\n",
        divider: "\n---\n"
      };

      const addition = additions[button.dataset.workspaceAction] || "";
      const editor = elements.workspaceEditor;
      const start = editor.selectionStart;
      const nextValue = `${editor.value.slice(0, start)}${addition}${editor.value.slice(editor.selectionEnd)}`;

      saveWorkspace(nextValue);
      editor.focus();
      editor.selectionStart = editor.selectionEnd = start + addition.length;
    });
  });

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearchModal();
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "o"
    ) {
      event.preventDefault();
      startNewChat();
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "c"
    ) {
      event.preventDefault();
      openWorkspace();
    }

    if (event.key === "Escape") {
      if (elements.commandMenu) {
        elements.commandMenu.hidden = true;
      }

      if (elements.workspacePanel && !elements.workspacePanel.hidden) {
        closeWorkspace();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      closeSidebar();
    }
  });
}

function initialize() {
  loadState();
  setupVoiceRecognition();
  setupEvents();
  renderApplication();
}

initialize();
