"use strict";

const STORAGE_KEYS = {
  conversations: "blinkel_conversations_v1",
  activeConversation: "blinkel_active_conversation_v1",
  temporaryMode: "blinkel_temporary_mode_v1"
};

const MODEL_INFORMATION = {
  core: {
    name: "Blinkel Core",
    description: "Fast and capable"
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
  recognition: null,
  listening: false
};

const elements = {
  appShell: document.getElementById("appShell"),
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  closeSidebarButton: document.getElementById(
    "closeSidebarButton"
  ),
  openSidebarButton: document.getElementById(
    "openSidebarButton"
  ),
  brandButton: document.getElementById("brandButton"),
  newChatButton: document.getElementById("newChatButton"),
  searchChatsButton: document.getElementById(
    "searchChatsButton"
  ),
  collapseHistoryButton: document.getElementById(
    "collapseHistoryButton"
  ),
  conversationList: document.getElementById(
    "conversationList"
  ),
  emptyHistory: document.getElementById("emptyHistory"),
  accountButton: document.getElementById("accountButton"),
  accountAvatar: document.getElementById("accountAvatar"),
  accountName: document.getElementById("accountName"),
  accountPlan: document.getElementById("accountPlan"),

  modelSelectorButton: document.getElementById(
    "modelSelectorButton"
  ),
  selectedModelName: document.getElementById(
    "selectedModelName"
  ),
  selectedModelDescription: document.getElementById(
    "selectedModelDescription"
  ),
  temporaryChatButton: document.getElementById(
    "temporaryChatButton"
  ),
  shareChatButton: document.getElementById(
    "shareChatButton"
  ),
  signInButton: document.getElementById("signInButton"),

  chatView: document.getElementById("chatView"),
  welcomeView: document.getElementById("welcomeView"),
  messageList: document.getElementById("messageList"),
  scrollBottomButton: document.getElementById(
    "scrollBottomButton"
  ),

  attachmentPreviewList: document.getElementById(
    "attachmentPreviewList"
  ),
  composerForm: document.getElementById("composerForm"),
  messageInput: document.getElementById("messageInput"),
  fileInput: document.getElementById("fileInput"),
  attachFileButton: document.getElementById(
    "attachFileButton"
  ),
  toolsButton: document.getElementById("toolsButton"),
  webSearchButton: document.getElementById(
    "webSearchButton"
  ),
  characterCount: document.getElementById("characterCount"),
  voiceButton: document.getElementById("voiceButton"),
  sendButton: document.getElementById("sendButton"),

  modelModal: document.getElementById("modelModal"),
  closeModelModalButton: document.getElementById(
    "closeModelModalButton"
  ),
  modelOptions: Array.from(
    document.querySelectorAll(".model-option")
  ),

  accountModal: document.getElementById("accountModal"),
  closeAccountModalButton: document.getElementById(
    "closeAccountModalButton"
  ),
  signInTab: document.getElementById("signInTab"),
  createAccountTab: document.getElementById(
    "createAccountTab"
  ),
  signInForm: document.getElementById("signInForm"),
  createAccountForm: document.getElementById(
    "createAccountForm"
  ),
  signInEmail: document.getElementById("signInEmail"),
  signInPassword: document.getElementById("signInPassword"),
  signInMessage: document.getElementById("signInMessage"),
  createDisplayName: document.getElementById(
    "createDisplayName"
  ),
  createEmail: document.getElementById("createEmail"),
  createPassword: document.getElementById("createPassword"),
  createAccountMessage: document.getElementById(
    "createAccountMessage"
  ),

  searchModal: document.getElementById("searchModal"),
  closeSearchModalButton: document.getElementById(
    "closeSearchModalButton"
  ),
  conversationSearchInput: document.getElementById(
    "conversationSearchInput"
  ),
  conversationSearchResults: document.getElementById(
    "conversationSearchResults"
  ),

  shareModal: document.getElementById("shareModal"),
  closeShareModalButton: document.getElementById(
    "closeShareModalButton"
  ),
  createShareLinkButton: document.getElementById(
    "createShareLinkButton"
  ),

  noticeModal: document.getElementById("noticeModal"),
  noticeIcon: document.getElementById("noticeIcon"),
  noticeTitle: document.getElementById("noticeTitle"),
  noticeDescription: document.getElementById(
    "noticeDescription"
  ),
  closeNoticeModalButton: document.getElementById(
    "closeNoticeModalButton"
  ),

  suggestionCards: Array.from(
    document.querySelectorAll(".suggestion-card")
  )
};

function validateElements() {
  Object.entries(elements).forEach(([name, value]) => {
    if (
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0)
    ) {
      throw new Error(`Missing required element: ${name}`);
    }
  });
}

function createId(prefix = "item") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function loadState() {
  try {
    const savedConversations = localStorage.getItem(
      STORAGE_KEYS.conversations
    );

    if (savedConversations) {
      const parsed = JSON.parse(savedConversations);

      if (Array.isArray(parsed)) {
        state.conversations = parsed.filter(
          isValidConversation
        );
      }
    }

    const savedActiveConversation = localStorage.getItem(
      STORAGE_KEYS.activeConversation
    );

    if (
      savedActiveConversation &&
      state.conversations.some(
        (conversation) =>
          conversation.id === savedActiveConversation
      )
    ) {
      state.activeConversationId = savedActiveConversation;
    }

    state.temporaryMode =
      localStorage.getItem(STORAGE_KEYS.temporaryMode) ===
      "true";
  } catch (error) {
    console.error("State load error:", error);

    state.conversations = [];
    state.activeConversationId = null;
    state.temporaryMode = false;
  }
}

function isValidConversation(conversation) {
  return Boolean(
    conversation &&
      typeof conversation.id === "string" &&
      typeof conversation.title === "string" &&
      Array.isArray(conversation.messages)
  );
}

function saveState() {
  try {
    const persistentConversations =
      state.conversations.filter(
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
      localStorage.removeItem(
        STORAGE_KEYS.activeConversation
      );
    }

    localStorage.setItem(
      STORAGE_KEYS.temporaryMode,
      String(state.temporaryMode)
    );
  } catch (error) {
    console.error("State save error:", error);
  }
}

function getActiveConversation() {
  return (
    state.conversations.find(
      (conversation) =>
        conversation.id === state.activeConversationId
    ) || null
  );
}

function createConversation() {
  const now = getCurrentTimestamp();

  const conversation = {
    id: createId("conversation"),
    title: "New chat",
    model: state.selectedModel,
    temporary: state.temporaryMode,
    createdAt: now,
    updatedAt: now,
    messages: []
  };

  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;

  saveState();
  renderApplication();

  return conversation;
}

function startNewChat() {
  stopGeneration();

  state.activeConversationId = null;
  state.attachedFiles = [];

  saveState();
  renderApplication();
  closeSidebar();

  requestAnimationFrame(() => {
    elements.messageInput.focus();
  });
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
  state.attachedFiles = [];

  saveState();
  renderApplication();
  closeSidebar();
}

function deleteConversation(conversationId) {
  const conversation = state.conversations.find(
    (item) => item.id === conversationId
  );

  if (!conversation) {
    return;
  }

  const shouldDelete = window.confirm(
    `Delete "${conversation.title}"?`
  );

  if (!shouldDelete) {
    return;
  }

  stopGeneration();

  state.conversations = state.conversations.filter(
    (item) => item.id !== conversationId
  );

  if (state.activeConversationId === conversationId) {
    state.activeConversationId = null;
  }

  saveState();
  renderApplication();
}

function generateConversationTitle(message) {
  const normalized = String(message)
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "New chat";
  }

  const maximumLength = 42;

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  return `${normalized.slice(0, maximumLength).trim()}...`;
}

function renderApplication() {
  renderTemporaryMode();
  renderSelectedModel();
  renderConversationList();
  renderChat();
  renderAttachments();
  updateComposer();
}

function renderTemporaryMode() {
  elements.temporaryChatButton.style.color =
    state.temporaryMode ? "var(--cyan-light)" : "";

  elements.temporaryChatButton.style.background =
    state.temporaryMode
      ? "rgba(32, 217, 236, 0.1)"
      : "";

  elements.temporaryChatButton.setAttribute(
    "aria-pressed",
    String(state.temporaryMode)
  );
}

function renderSelectedModel() {
  const information =
    MODEL_INFORMATION[state.selectedModel] ||
    MODEL_INFORMATION.core;

  elements.selectedModelName.textContent = information.name;
  elements.selectedModelDescription.textContent =
    information.description;

  elements.modelOptions.forEach((option) => {
    option.classList.toggle(
      "active",
      option.dataset.model === state.selectedModel
    );
  });
}

function renderConversationList() {
  elements.conversationList.replaceChildren();

  const savedConversations = state.conversations.filter(
    (conversation) => !conversation.temporary
  );

  if (
    state.historyCollapsed ||
    savedConversations.length === 0
  ) {
    const message = document.createElement("p");
    message.className = "empty-history";

    message.textContent = state.historyCollapsed
      ? "Recent conversations are hidden."
      : "Your conversations will appear here.";

    elements.conversationList.appendChild(message);
    return;
  }

  savedConversations
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() -
        new Date(first.updatedAt).getTime()
    )
    .forEach((conversation) => {
      elements.conversationList.appendChild(
        createConversationListItem(conversation)
      );
    });
}

function createConversationListItem(conversation) {
  const wrapper = document.createElement("div");
  wrapper.className = "conversation-item";

  if (conversation.id === state.activeConversationId) {
    wrapper.classList.add("active");
  }

  wrapper.setAttribute("role", "button");
  wrapper.setAttribute("tabindex", "0");

  const icon = document.createElement("span");
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v10H9l-4 4V5Z"></path>
    </svg>
  `;

  const title = document.createElement("span");
  title.className = "conversation-item-title";
  title.textContent = conversation.title;

  const menuButton = document.createElement("button");
  menuButton.className = "conversation-item-menu";
  menuButton.type = "button";
  menuButton.title = "Delete conversation";
  menuButton.setAttribute(
    "aria-label",
    `Delete ${conversation.title}`
  );

  menuButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M8 7l1 13h6l1-13"></path>
    </svg>
  `;

  wrapper.addEventListener("click", () => {
    selectConversation(conversation.id);
  });

  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectConversation(conversation.id);
    }
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteConversation(conversation.id);
  });

  wrapper.append(icon, title, menuButton);

  return wrapper;
}

function renderChat() {
  const conversation = getActiveConversation();
  const hasMessages =
    conversation && conversation.messages.length > 0;

  elements.welcomeView.hidden = hasMessages;
  elements.messageList.hidden = !hasMessages;
  elements.shareChatButton.hidden = !hasMessages;

  if (!hasMessages) {
    elements.messageList.replaceChildren();
    return;
  }

  elements.messageList.replaceChildren();

  conversation.messages.forEach((message) => {
    elements.messageList.appendChild(
      createMessageElement(message)
    );
  });

  requestAnimationFrame(scrollToBottom);
}

function createMessageElement(message) {
  const article = document.createElement("article");

  article.className =
    message.role === "user"
      ? "message user-message"
      : "message assistant-message";

  article.dataset.messageId = message.id;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = message.role === "user" ? "Y" : "B";

  const content = document.createElement("div");
  content.className = "message-content";

  const author = document.createElement("strong");
  author.className = "message-author";
  author.textContent =
    message.role === "user" ? "You" : "Blinkel";

  const text = document.createElement("div");
  text.className = "message-text";

  if (message.status === "generating") {
    text.appendChild(createTypingIndicator());
  } else {
    text.textContent = message.content;
  }

  content.append(author, text);

  if (
    Array.isArray(message.attachments) &&
    message.attachments.length > 0
  ) {
    content.appendChild(
      createMessageAttachmentList(message.attachments)
    );
  }

  if (
    message.role === "assistant" &&
    message.status !== "generating"
  ) {
    content.appendChild(createMessageActions(message));
  }

  article.append(avatar, content);

  return article;
}

function createTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";

  for (let index = 0; index < 3; index += 1) {
    indicator.appendChild(document.createElement("span"));
  }

  return indicator;
}

function createMessageAttachmentList(attachments) {
  const list = document.createElement("div");
  list.className = "message-actions";

  attachments.forEach((attachment) => {
    const item = document.createElement("span");
    item.className = "attachment-preview";
    item.textContent = attachment.name;
    list.appendChild(item);
  });

  return list;
}

function createMessageActions(message) {
  const actions = document.createElement("div");
  actions.className = "message-actions";

  const copyButton = document.createElement("button");
  copyButton.className = "message-action-button";
  copyButton.type = "button";
  copyButton.title = "Copy response";
  copyButton.setAttribute("aria-label", "Copy response");

  copyButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2"></rect>
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path>
    </svg>
  `;

  copyButton.addEventListener("click", async () => {
    await copyText(message.content);

    copyButton.title = "Copied";

    window.setTimeout(() => {
      copyButton.title = "Copy response";
    }, 1500);
  });

  const regenerateButton = document.createElement("button");
  regenerateButton.className = "message-action-button";
  regenerateButton.type = "button";
  regenerateButton.title = "Regenerate response";
  regenerateButton.setAttribute(
    "aria-label",
    "Regenerate response"
  );

  regenerateButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6v6h-6"></path>
      <path d="M18.5 9A7 7 0 1 0 19 16"></path>
    </svg>
  `;

  regenerateButton.addEventListener("click", () => {
    regenerateResponse(message.id);
  });

  actions.append(copyButton, regenerateButton);

  return actions;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (error) {
    console.error("Clipboard error:", error);

    openNotice(
      "Copy failed",
      "The browser did not allow clipboard access.",
      "!"
    );
  }
}

function renderAttachments() {
  elements.attachmentPreviewList.replaceChildren();

  if (state.attachedFiles.length === 0) {
    elements.attachmentPreviewList.hidden = true;
    return;
  }

  elements.attachmentPreviewList.hidden = false;

  state.attachedFiles.forEach((file) => {
    const preview = document.createElement("div");
    preview.className = "attachment-preview";

    const name = document.createElement("span");
    name.className = "attachment-preview-name";
    name.textContent = file.name;
    name.title = file.name;

    const removeButton = document.createElement("button");
    removeButton.className = "attachment-remove-button";
    removeButton.type = "button";
    removeButton.setAttribute(
      "aria-label",
      `Remove ${file.name}`
    );
    removeButton.textContent = "×";

    removeButton.addEventListener("click", () => {
      state.attachedFiles = state.attachedFiles.filter(
        (item) => item.id !== file.id
      );

      renderAttachments();
      updateComposer();
    });

    preview.append(name, removeButton);
    elements.attachmentPreviewList.appendChild(preview);
  });
}

function handleSelectedFiles(files) {
  const maximumFileSize = 15 * 1024 * 1024;
  const maximumFiles = 5;

  const availableSlots =
    maximumFiles - state.attachedFiles.length;

  if (availableSlots <= 0) {
    openNotice(
      "Attachment limit",
      "You can attach up to five files to one message.",
      "!"
    );

    return;
  }

  Array.from(files)
    .slice(0, availableSlots)
    .forEach((file) => {
      if (file.size > maximumFileSize) {
        openNotice(
          "File too large",
          `${file.name} is larger than 15 MB.`,
          "!"
        );

        return;
      }

      state.attachedFiles.push({
        id: createId("file"),
        file,
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

  elements.characterCount.textContent =
    `${value.length} / 12000`;

  const canSend =
    value.trim().length > 0 ||
    state.attachedFiles.length > 0;

  elements.sendButton.disabled =
    state.generating ? false : !canSend;

  elements.messageInput.disabled = state.generating;
  elements.attachFileButton.disabled = state.generating;

  elements.messageInput.style.height = "auto";

  elements.messageInput.style.height =
    `${Math.min(
      elements.messageInput.scrollHeight,
      200
    )}px`;

  const sendIcon =
    elements.sendButton.querySelector(".send-icon");

  const stopIcon =
    elements.sendButton.querySelector(".stop-icon");

  elements.sendButton.classList.toggle(
    "generating",
    state.generating
  );

  if (sendIcon) {
    sendIcon.hidden = state.generating;
  }

  if (stopIcon) {
    stopIcon.hidden = !state.generating;
  }

  elements.sendButton.setAttribute(
    "aria-label",
    state.generating
      ? "Stop generating"
      : "Send message"
  );
}

function submitMessage(event) {
  event.preventDefault();

  if (state.generating) {
    stopGeneration();
    return;
  }

  const content = elements.messageInput.value.trim();

  if (!content && state.attachedFiles.length === 0) {
    return;
  }

  let conversation = getActiveConversation();

  if (!conversation) {
    conversation = createConversation();
  }

  const attachments = state.attachedFiles.map((item) => ({
    id: item.id,
    name: item.name,
    size: item.size,
    type: item.type
  }));

  const userMessage = {
    id: createId("message"),
    role: "user",
    content:
      content ||
      "Please review the attached file or files.",
    attachments,
    createdAt: getCurrentTimestamp(),
    status: "complete"
  };

  conversation.messages.push(userMessage);

  if (conversation.title === "New chat") {
    conversation.title = generateConversationTitle(
      userMessage.content
    );
  }

  conversation.updatedAt = getCurrentTimestamp();
  conversation.model = state.selectedModel;

  elements.messageInput.value = "";
  state.attachedFiles = [];

  saveState();
  renderApplication();

  generateAssistantResponse(conversation, userMessage);
}

function generateAssistantResponse(
  conversation,
  userMessage
) {
  state.generating = true;

  const assistantMessage = {
    id: createId("message"),
    role: "assistant",
    content: "",
    attachments: [],
    createdAt: getCurrentTimestamp(),
    status: "generating"
  };

  conversation.messages.push(assistantMessage);
  conversation.updatedAt = getCurrentTimestamp();

  saveState();
  renderApplication();

  state.generationTimer = window.setTimeout(() => {
    const activeConversation = state.conversations.find(
      (item) => item.id === conversation.id
    );

    if (!activeConversation) {
      stopGeneration();
      return;
    }

    const message = activeConversation.messages.find(
      (item) => item.id === assistantMessage.id
    );

    if (!message) {
      stopGeneration();
      return;
    }

    message.content = createPrototypeResponse(userMessage);
    message.status = "complete";

    activeConversation.updatedAt = getCurrentTimestamp();

    state.generating = false;
    state.generationTimer = null;

    saveState();
    renderApplication();
  }, 1200);
}

function createPrototypeResponse(userMessage) {
  const attachmentCount =
    userMessage.attachments?.length || 0;

  const searchText = state.webSearchEnabled
    ? " Web search is selected, but live search is not connected yet."
    : "";

  const attachmentText =
    attachmentCount > 0
      ? ` I can see that ${attachmentCount} attachment${attachmentCount === 1 ? " was" : "s were"} selected, but file analysis is not connected yet.`
      : "";

  return (
    "Blinkel's interface is working correctly. " +
    "The next step is connecting this chat to a secure server-side AI API. " +
    "Your message was saved locally in this browser." +
    attachmentText +
    searchText
  );
}

function stopGeneration() {
  if (state.generationTimer) {
    window.clearTimeout(state.generationTimer);
    state.generationTimer = null;
  }

  const conversation = getActiveConversation();

  if (conversation) {
    const generatingMessage = conversation.messages.find(
      (message) => message.status === "generating"
    );

    if (generatingMessage) {
      generatingMessage.status = "complete";
      generatingMessage.content =
        "Generation stopped by the user.";
    }

    conversation.updatedAt = getCurrentTimestamp();
  }

  state.generating = false;

  saveState();
  renderApplication();
}

function regenerateResponse(messageId) {
  if (state.generating) {
    return;
  }

  const conversation = getActiveConversation();

  if (!conversation) {
    return;
  }

  const messageIndex = conversation.messages.findIndex(
    (message) => message.id === messageId
  );

  if (messageIndex === -1) {
    return;
  }

  let userMessage = null;

  for (
    let index = messageIndex - 1;
    index >= 0;
    index -= 1
  ) {
    if (conversation.messages[index].role === "user") {
      userMessage = conversation.messages[index];
      break;
    }
  }

  if (!userMessage) {
    return;
  }

  conversation.messages.splice(messageIndex, 1);
  saveState();
  renderApplication();

  generateAssistantResponse(conversation, userMessage);
}

function toggleWebSearch() {
  state.webSearchEnabled = !state.webSearchEnabled;

  elements.webSearchButton.classList.toggle(
    "active",
    state.webSearchEnabled
  );

  elements.webSearchButton.setAttribute(
    "aria-pressed",
    String(state.webSearchEnabled)
  );
}

function toggleTemporaryMode() {
  state.temporaryMode = !state.temporaryMode;

  startNewChat();
  saveState();
  renderApplication();

  openNotice(
    state.temporaryMode
      ? "Temporary chat enabled"
      : "Temporary chat disabled",
    state.temporaryMode
      ? "Temporary conversations will not be saved after this browser session."
      : "New conversations will be saved in this browser.",
    "T"
  );
}

function openSidebar() {
  elements.appShell.classList.add("sidebar-open");
}

function closeSidebar() {
  elements.appShell.classList.remove("sidebar-open");
}

function scrollToBottom() {
  elements.chatView.scrollTop =
    elements.chatView.scrollHeight;
}

function handleChatScroll() {
  const distanceFromBottom =
    elements.chatView.scrollHeight -
    elements.chatView.scrollTop -
    elements.chatView.clientHeight;

  elements.scrollBottomButton.hidden =
    distanceFromBottom < 180;
}

function openDialog(dialog) {
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  }
}

function openModelModal() {
  renderSelectedModel();
  openDialog(elements.modelModal);
}

function selectModel(modelKey) {
  const information = MODEL_INFORMATION[modelKey];

  if (!information) {
    return;
  }

  if (information.unavailable) {
    openNotice(
      `${information.name} is coming later`,
      "This model is not available in the current Blinkel prototype.",
      modelKey === "reason" ? "R" : "V"
    );

    return;
  }

  state.selectedModel = modelKey;

  const conversation = getActiveConversation();

  if (conversation) {
    conversation.model = modelKey;
    conversation.updatedAt = getCurrentTimestamp();
  }

  saveState();
  renderSelectedModel();
  closeDialog(elements.modelModal);
}

function setAuthMode(mode) {
  const signingIn = mode === "signin";

  elements.signInTab.classList.toggle(
    "active",
    signingIn
  );

  elements.createAccountTab.classList.toggle(
    "active",
    !signingIn
  );

  elements.signInForm.hidden = !signingIn;
  elements.createAccountForm.hidden = signingIn;

  setFormMessage(elements.signInMessage, "");
  setFormMessage(elements.createAccountMessage, "");
}

function setFormMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function handlePrototypeSignIn(event) {
  event.preventDefault();

  setFormMessage(
    elements.signInMessage,
    "Account services are not connected yet."
  );
}

function handlePrototypeAccountCreation(event) {
  event.preventDefault();

  setFormMessage(
    elements.createAccountMessage,
    "Account services are not connected yet."
  );
}

function openSearchModal() {
  elements.conversationSearchInput.value = "";
  renderSearchResults("");
  openDialog(elements.searchModal);

  requestAnimationFrame(() => {
    elements.conversationSearchInput.focus();
  });
}

function renderSearchResults(query) {
  elements.conversationSearchResults.replaceChildren();

  const normalizedQuery = query.trim().toLowerCase();

  const matches = state.conversations.filter(
    (conversation) => {
      if (conversation.temporary) {
        return false;
      }

      const searchableText = [
        conversation.title,
        ...conversation.messages.map(
          (message) => message.content
        )
      ]
        .join(" ")
        .toLowerCase();

      return (
        !normalizedQuery ||
        searchableText.includes(normalizedQuery)
      );
    }
  );

  if (matches.length === 0) {
    const message = document.createElement("p");
    message.textContent = normalizedQuery
      ? "No matching conversations."
      : "No conversations yet.";

    elements.conversationSearchResults.appendChild(message);
    return;
  }

  matches.forEach((conversation) => {
    const button = document.createElement("button");
    button.className = "search-result-button";
    button.type = "button";
    button.textContent = conversation.title;

    button.addEventListener("click", () => {
      selectConversation(conversation.id);
      closeDialog(elements.searchModal);
    });

    elements.conversationSearchResults.appendChild(button);
  });
}

function createShareLink() {
  openNotice(
    "Sharing is not connected",
    "Shared conversation links will be added after the Blinkel backend and database are connected.",
    "S"
  );

  closeDialog(elements.shareModal);
}

function openNotice(
  title,
  description,
  icon = "B"
) {
  elements.noticeTitle.textContent = title;
  elements.noticeDescription.textContent = description;
  elements.noticeIcon.textContent = icon;

  openDialog(elements.noticeModal);
}

function handleToolsButton() {
  openNotice(
    "Blinkel tools",
    "Web search, image generation, document analysis, code execution, and other tools will be added after the AI backend is connected.",
    "+"
  );
}

function setupVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    state.recognition = null;
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang =
    document.documentElement.lang || "en";

  recognition.addEventListener("start", () => {
    state.listening = true;
    elements.voiceButton.style.color = "var(--cyan-light)";
    elements.voiceButton.title = "Listening";
  });

  recognition.addEventListener("result", (event) => {
    let transcript = "";

    for (
      let index = event.resultIndex;
      index < event.results.length;
      index += 1
    ) {
      transcript += event.results[index][0].transcript;
    }

    elements.messageInput.value = transcript.trim();
    updateComposer();
  });

  recognition.addEventListener("end", () => {
    state.listening = false;
    elements.voiceButton.style.color = "";
    elements.voiceButton.title = "Voice input";
  });

  recognition.addEventListener("error", (event) => {
    console.error("Voice recognition error:", event.error);

    state.listening = false;
    elements.voiceButton.style.color = "";
    elements.voiceButton.title = "Voice input";

    openNotice(
      "Voice input unavailable",
      "The browser could not use speech recognition.",
      "!"
    );
  });

  state.recognition = recognition;
}

function toggleVoiceRecognition() {
  if (!state.recognition) {
    openNotice(
      "Voice input unavailable",
      "This browser does not support the speech recognition feature used by this prototype.",
      "V"
    );

    return;
  }

  if (state.listening) {
    state.recognition.stop();
    return;
  }

  try {
    state.recognition.start();
  } catch (error) {
    console.error("Voice recognition start error:", error);
  }
}

function setupEvents() {
  elements.openSidebarButton.addEventListener(
    "click",
    openSidebar
  );

  elements.closeSidebarButton.addEventListener(
    "click",
    closeSidebar
  );

  elements.sidebarOverlay.addEventListener(
    "click",
    closeSidebar
  );

  elements.brandButton.addEventListener(
    "click",
    startNewChat
  );

  elements.newChatButton.addEventListener(
    "click",
    startNewChat
  );

  elements.searchChatsButton.addEventListener(
    "click",
    openSearchModal
  );

  elements.collapseHistoryButton.addEventListener(
    "click",
    () => {
      state.historyCollapsed = !state.historyCollapsed;
      renderConversationList();
    }
  );

  elements.accountButton.addEventListener(
    "click",
    () => {
      setAuthMode("signin");
      openDialog(elements.accountModal);
    }
  );

  elements.signInButton.addEventListener(
    "click",
    () => {
      setAuthMode("signin");
      openDialog(elements.accountModal);
    }
  );

  elements.modelSelectorButton.addEventListener(
    "click",
    openModelModal
  );

  elements.closeModelModalButton.addEventListener(
    "click",
    () => {
      closeDialog(elements.modelModal);
    }
  );

  elements.modelOptions.forEach((option) => {
    option.addEventListener("click", () => {
      selectModel(option.dataset.model);
    });
  });

  elements.temporaryChatButton.addEventListener(
    "click",
    toggleTemporaryMode
  );

  elements.shareChatButton.addEventListener(
    "click",
    () => {
      openDialog(elements.shareModal);
    }
  );

  elements.scrollBottomButton.addEventListener(
    "click",
    scrollToBottom
  );

  elements.chatView.addEventListener(
    "scroll",
    handleChatScroll
  );

  elements.composerForm.addEventListener(
    "submit",
    submitMessage
  );

  elements.messageInput.addEventListener(
    "input",
    updateComposer
  );

  elements.messageInput.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        elements.composerForm.requestSubmit();
      }
    }
  );

  elements.attachFileButton.addEventListener(
    "click",
    () => {
      elements.fileInput.click();
    }
  );

  elements.fileInput.addEventListener(
    "change",
    () => {
      handleSelectedFiles(elements.fileInput.files);
    }
  );

  elements.toolsButton.addEventListener(
    "click",
    handleToolsButton
  );

  elements.webSearchButton.addEventListener(
    "click",
    toggleWebSearch
  );

  elements.voiceButton.addEventListener(
    "click",
    toggleVoiceRecognition
  );

  elements.suggestionCards.forEach((card) => {
    card.addEventListener("click", () => {
      elements.messageInput.value =
        card.dataset.prompt || "";

      updateComposer();
      elements.messageInput.focus();
    });
  });

  elements.closeAccountModalButton.addEventListener(
    "click",
    () => {
      closeDialog(elements.accountModal);
    }
  );

  elements.signInTab.addEventListener(
    "click",
    () => {
      setAuthMode("signin");
    }
  );

  elements.createAccountTab.addEventListener(
    "click",
    () => {
      setAuthMode("create");
    }
  );

  elements.signInForm.addEventListener(
    "submit",
    handlePrototypeSignIn
  );

  elements.createAccountForm.addEventListener(
    "submit",
    handlePrototypeAccountCreation
  );

  elements.closeSearchModalButton.addEventListener(
    "click",
    () => {
      closeDialog(elements.searchModal);
    }
  );

  elements.conversationSearchInput.addEventListener(
    "input",
    () => {
      renderSearchResults(
        elements.conversationSearchInput.value
      );
    }
  );

  elements.closeShareModalButton.addEventListener(
    "click",
    () => {
      closeDialog(elements.shareModal);
    }
  );

  elements.createShareLinkButton.addEventListener(
    "click",
    createShareLink
  );

  elements.closeNoticeModalButton.addEventListener(
    "click",
    () => {
      closeDialog(elements.noticeModal);
    }
  );

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      closeSidebar();
    }
  });

  window.addEventListener("beforeunload", saveState);
}

function initialize() {
  validateElements();
  loadState();
  setupEvents();
  setupVoiceRecognition();
  renderApplication();
}

initialize();
