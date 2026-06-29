const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");
const nameGroup = document.getElementById("nameGroup");
const confirmGroup = document.getElementById("confirmGroup");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const authSubmit = document.getElementById("authSubmit");
const toggleModeButton = document.getElementById("toggleModeButton");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const togglePasswordButton = document.getElementById("togglePasswordButton");
const authSwitchText = document.getElementById("authSwitchText");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authMessage = document.getElementById("authMessage");
const welcomeName = document.getElementById("welcomeName");
const logoutButton = document.getElementById("logoutButton");
const savedChatsButton = document.getElementById("savedChatsButton");
const saveChatButton = document.getElementById("saveChatButton");
const newChatButton = document.getElementById("newChatButton");
const buyCreditsButton = document.getElementById("buyCreditsButton");
const creditsBadge = document.getElementById("creditsBadge");
const chatStatus = document.getElementById("chatStatus");
const savedChatsModal = document.getElementById("savedChatsModal");
const savedChatsList = document.getElementById("savedChatsList");
const closeSavedChatsButton = document.getElementById("closeSavedChatsButton");
const creditsModal = document.getElementById("creditsModal");
const creditsModalTitle = document.getElementById("creditsModalTitle");
const creditsModalMessage = document.getElementById("creditsModalMessage");
const creditsTimer = document.getElementById("creditsTimer");
const closeCreditsModalButton = document.getElementById("closeCreditsModalButton");

let authMode = "login";
let currentUser = null;
let currentConversation = [];
let currentSessionId = null;
let savedChatSessions = [];
let creditsBalance = 15;
let creditsRefillUntil = null;
let creditsCountdownTimer = null;
const CREDIT_COST_PER_CHAT = 5;
const STARTING_CREDITS = 15;
const REFILL_MS = 60 * 60 * 1000;

function setChatStatus(message) {
  if (!chatStatus) return;
  chatStatus.textContent = message || "";
}

function updateCreditsUI() {
  if (creditsBadge) {
    creditsBadge.textContent = `Credits: ${creditsBalance}`;
  }
}

function getCreditsStorageKey(userEmail) {
  return userEmail ? `bizbuddyCredits:${userEmail.toLowerCase()}` : "bizbuddyCredits";
}

function formatTimeLeft(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function saveCreditsState() {
  if (!currentUser?.email) return;
  const payload = {
    balance: creditsBalance,
    refillUntil: creditsRefillUntil
  };
  localStorage.setItem(getCreditsStorageKey(currentUser.email), JSON.stringify(payload));
}

function closeCreditsModal() {
  if (!creditsModal) return;
  creditsModal.classList.add("hidden");
}

function showCreditsModal(message, showTimer = false) {
  if (!creditsModal || !creditsModalTitle || !creditsModalMessage) return;
  creditsModalTitle.textContent = showTimer ? "Credits refill" : "Credits update";
  creditsModalMessage.textContent = message;
  if (creditsTimer) {
    creditsTimer.textContent = showTimer ? "" : "";
  }
  creditsModal.classList.remove("hidden");
}

function startCreditsRefillTimer() {
  if (creditsCountdownTimer) {
    clearInterval(creditsCountdownTimer);
    creditsCountdownTimer = null;
  }

  if (!creditsRefillUntil || creditsBalance > 0) {
    return;
  }

  showCreditsModal("Your credits refill in 1 hour", true);

  const tick = () => {
    const remaining = creditsRefillUntil - Date.now();
    if (creditsTimer) {
      creditsTimer.textContent = remaining > 0 ? formatTimeLeft(remaining) : "Refilled";
    }

    if (remaining <= 0) {
      creditsBalance = STARTING_CREDITS;
      creditsRefillUntil = null;
      saveCreditsState();
      updateCreditsUI();
      if (creditsCountdownTimer) {
        clearInterval(creditsCountdownTimer);
        creditsCountdownTimer = null;
      }
      closeCreditsModal();
      setChatStatus("Your credits have been refilled.");
    }
  };

  tick();
  creditsCountdownTimer = setInterval(tick, 1000);
}

function loadCreditsBalance() {
  if (!currentUser?.email) {
    creditsBalance = STARTING_CREDITS;
    creditsRefillUntil = null;
    updateCreditsUI();
    return;
  }

  const storedCredits = localStorage.getItem(getCreditsStorageKey(currentUser.email));

  if (!storedCredits) {
    creditsBalance = STARTING_CREDITS;
    creditsRefillUntil = null;
  } else {
    try {
      const parsed = JSON.parse(storedCredits);
      if (typeof parsed === "number") {
        creditsBalance = Number(parsed) || STARTING_CREDITS;
        creditsRefillUntil = null;
      } else {
        creditsBalance = Number(parsed?.balance) || STARTING_CREDITS;
        creditsRefillUntil = parsed?.refillUntil || null;
      }
    } catch {
      creditsBalance = STARTING_CREDITS;
      creditsRefillUntil = null;
    }
  }

  if (creditsBalance <= 0 && creditsRefillUntil && creditsRefillUntil <= Date.now()) {
    creditsBalance = STARTING_CREDITS;
    creditsRefillUntil = null;
  }

  saveCreditsState();
  updateCreditsUI();
  if (creditsBalance <= 0) {
    startCreditsRefillTimer();
  }
}

function appendMessage(text, type = "bot") {
  if (!chatMessages) return;

  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function usePrompt(text) {
  if (!userInput) return;

  userInput.value = text;
  userInput.focus();
}

function setMessage(text, type = "error") {
  if (!authMessage) return;

  authMessage.textContent = text;
  authMessage.className = `auth-message ${type}`;
}

function clearMessage() {
  if (!authMessage) return;

  authMessage.textContent = "";
  authMessage.className = "auth-message";
}

function setAuthMode(mode) {
  authMode = mode;

  if (forgotPasswordButton) {
    forgotPasswordButton.classList.toggle("hidden", mode !== "login");
  }

  if (nameGroup) {
    nameGroup.classList.toggle("hidden", mode !== "register");
  }

  if (confirmGroup) {
    confirmGroup.classList.toggle("hidden", mode !== "register");
  }

  if (authSubmit) {
    authSubmit.textContent = mode === "login" ? "Log in" : "Create account";
  }

  if (authTitle) {
    authTitle.textContent = mode === "login" ? "Welcome back" : "Create your account";
  }

  if (authSubtitle) {
    authSubtitle.textContent = mode === "login"
      ? "Sign in to continue to BizBuddy AI."
      : "Create an account to unlock BizBuddy AI.";
  }

  if (authSwitchText) {
    authSwitchText.textContent = mode === "login" ? "New here?" : "Already have an account?";
  }

  if (toggleModeButton) {
    toggleModeButton.textContent = mode === "login" ? "Create an account" : "Log in";
  }

  clearMessage();
}

function getConversationStorageKey(userEmail) {
  return userEmail ? `bizbuddyChats:${userEmail.toLowerCase()}` : "bizbuddyChats";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function generateChatTitle(messages) {
  const firstUserMessage = (messages || []).find((message) => message.role === "user");
  const rawText = firstUserMessage?.text || "";
  const cleaned = rawText.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "New chat";
  }

  return cleaned.length > 30 ? `${cleaned.slice(0, 30)}...` : cleaned;
}

function isMeaningfulChat(messages) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const userMessages = safeMessages.filter((message) => message.role === "user" && (message.text || "").trim());
  return userMessages.length > 0;
}

function getSavedChatSessions(userEmail = currentUser?.email) {
  if (!userEmail) {
    return [];
  }

  const storageKey = getConversationStorageKey(userEmail);
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      if (parsed.length && parsed[0] && Array.isArray(parsed[0].messages)) {
        return parsed
          .filter((session) => isMeaningfulChat(session.messages || []))
          .map((session) => ({
            id: session.id || `chat-${Date.now()}`,
            title: session.title || generateChatTitle(session.messages || []),
            messages: Array.isArray(session.messages) ? session.messages : [],
            updatedAt: session.updatedAt || new Date().toISOString()
          }));
      }

      const meaningfulConversation = isMeaningfulChat(parsed) ? parsed : [];
      return meaningfulConversation.length > 0 ? [{
        id: `chat-${Date.now()}`,
        title: generateChatTitle(parsed),
        messages: Array.isArray(parsed) ? parsed : [],
        updatedAt: new Date().toISOString()
      }] : [];
    }
  } catch {
    return [];
  }

  return [];
}

function saveSavedChatSessions(sessions, userEmail = currentUser?.email) {
  if (!userEmail) return;

  const storageKey = getConversationStorageKey(userEmail);
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

function persistConversation(createIfMissing = true) {
  if (!currentUser?.email) return;

  const sessions = getSavedChatSessions(currentUser.email);

  if (currentSessionId) {
    const existingSession = sessions.find((session) => session.id === currentSessionId);
    if (existingSession) {
      existingSession.messages = currentConversation;
      existingSession.title = generateChatTitle(currentConversation);
      existingSession.updatedAt = new Date().toISOString();
      saveSavedChatSessions(sessions, currentUser.email);
      return;
    }
  }

  if (!createIfMissing) {
    return;
  }

  const newSession = {
    id: currentSessionId || `chat-${Date.now()}`,
    title: generateChatTitle(currentConversation),
    messages: currentConversation,
    updatedAt: new Date().toISOString()
  };

  currentSessionId = newSession.id;
  sessions.push(newSession);
  saveSavedChatSessions(sessions, currentUser.email);
}

function loadConversation() {
  if (!currentUser?.email) {
    currentConversation = [];
    return;
  }

  savedChatSessions = getSavedChatSessions(currentUser.email);

  if (savedChatSessions.length > 0) {
    const latestSession = savedChatSessions[savedChatSessions.length - 1];
    currentSessionId = latestSession.id;
    currentConversation = Array.isArray(latestSession.messages) ? latestSession.messages : [];
  } else {
    currentSessionId = null;
    currentConversation = [
      {
        role: "bot",
        text: "Welcome! Ask me about a business idea, pricing, startup strategy, or marketing."
      }
    ];
  }

  renderConversation(currentConversation);
}

function renderConversation(messages) {
  if (!chatMessages) return;

  chatMessages.innerHTML = "";
  const safeMessages = Array.isArray(messages) ? messages : [];

  safeMessages.forEach((message) => {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${message.role === "user" ? "user" : "bot"}`;
    messageElement.textContent = message.text || "";
    chatMessages.appendChild(messageElement);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatChatTime(value) {
  if (!value) return "Just now";

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderSavedChatsModal() {
  if (!savedChatsList) return;

  const sessions = getSavedChatSessions(currentUser?.email);
  savedChatSessions = sessions;

  if (!sessions.length) {
    savedChatsList.innerHTML = '<div class="empty-state">No saved chats yet.</div>';
    return;
  }

  savedChatsList.innerHTML = "";
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  sortedSessions.forEach((session) => {
    const button = document.createElement("button");
    button.className = "saved-chat-item";

    const previewMessages = Array.isArray(session.messages) ? session.messages : [];
    const lastMessage = previewMessages[previewMessages.length - 1]?.text || "No preview available";

    button.innerHTML = `
      <div class="saved-chat-title">${escapeHtml(session.title || "Untitled chat")}</div>
      <div class="saved-chat-preview">${escapeHtml(lastMessage.length > 80 ? `${lastMessage.slice(0, 80)}...` : lastMessage)}</div>
      <div class="saved-chat-meta">${escapeHtml(formatChatTime(session.updatedAt))}</div>
    `;

    button.addEventListener("click", () => {
      currentSessionId = session.id;
      currentConversation = Array.isArray(session.messages) ? session.messages : [];
      renderConversation(currentConversation);
      setChatStatus("Loaded saved chat.");
      closeSavedChatsModal();
    });

    savedChatsList.appendChild(button);
  });
}

function openSavedChatsModal() {
  if (!savedChatsModal) return;
  renderSavedChatsModal();
  savedChatsModal.classList.remove("hidden");
}

function closeSavedChatsModal() {
  if (!savedChatsModal) return;
  savedChatsModal.classList.add("hidden");
}

function saveCurrentChat() {
  if (!currentUser?.email) {
    setChatStatus("Sign in to save your chat.");
    return;
  }

  persistConversation(true);
  setChatStatus("Chat saved locally.");
}

function loadSavedChats() {
  if (!currentUser?.email) {
    setChatStatus("Sign in to view saved chats.");
    return;
  }

  openSavedChatsModal();
}

function startNewChat() {
  currentSessionId = null;
  currentConversation = [
    {
      role: "bot",
      text: "Welcome! Ask me about a business idea, pricing, startup strategy, or marketing."
    }
  ];
  renderConversation(currentConversation);
  setChatStatus("Started a fresh conversation.");
}

function showApp(user) {
  currentUser = normalizeUser(user);

  if (authScreen) {
    authScreen.classList.add("hidden");
  }

  if (appShell) {
    appShell.classList.remove("hidden");
  }

  if (welcomeName) {
    const displayName = currentUser?.name || currentUser?.email?.split("@")[0] || "there";
    welcomeName.textContent = displayName;
  }

  localStorage.setItem("bizbuddyUser", JSON.stringify(currentUser));
  loadCreditsBalance();
  loadConversation();
  setChatStatus("");
}

function showAuth() {
  if (authScreen) {
    authScreen.classList.remove("hidden");
  }

  if (appShell) {
    appShell.classList.add("hidden");
  }
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem("bizbuddyUsers");
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  const normalizedUsers = (users || [])
    .filter(Boolean)
    .map((user) => ({
      id: user.id || Date.now().toString(),
      name: user.name || "",
      email: (user.email || "").toLowerCase().trim(),
      password: user.password || ""
    }));

  localStorage.setItem("bizbuddyUsers", JSON.stringify(normalizedUsers));
  return normalizedUsers;
}

function normalizeUser(user) {
  return {
    id: user?.id || Date.now().toString(),
    name: user?.name || "",
    email: (user?.email || "").toLowerCase().trim(),
    password: user?.password || ""
  };
}

function handleForgotPassword() {
  const email = emailInput?.value?.trim().toLowerCase() || "";

  if (!email) {
    setMessage("Enter your email to recover your password.");
    return;
  }

  const users = getStoredUsers();
  const user = users.find((storedUser) => (storedUser.email || "").toLowerCase() === email);

  if (!user) {
    setMessage("No account was found for that email.", "error");
    return;
  }

  setMessage(`Your password is: ${user.password || "(no password stored)"}`, "success");
}

function togglePasswordVisibility() {
  if (!passwordInput || !togglePasswordButton) return;

  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePasswordButton.textContent = isPassword ? "🙈" : "👁";
  togglePasswordButton.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
}

function handleAuthSubmit(event) {
  event.preventDefault();

  const name = nameInput?.value?.trim() || "";
  const email = emailInput?.value?.trim().toLowerCase() || "";
  const password = passwordInput?.value || "";
  const confirmPassword = confirmPasswordInput?.value || "";

  if (!email || !password) {
    setMessage("Please provide both your email and password.");
    return;
  }

  const users = saveUsers(getStoredUsers());

  if (authMode === "register") {
    if (!name) {
      setMessage("Please add your full name to create an account.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password should be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match. Please try again.");
      return;
    }

    if (users.some((user) => user.email === email)) {
      setMessage("An account with that email already exists.");
      return;
    }

    const newUser = normalizeUser({
      id: Date.now().toString(),
      name,
      email,
      password
    });

    users.push(newUser);
    saveUsers(users);
    showApp(newUser);
    setMessage("Account created successfully.", "success");
    authForm.reset();
    return;
  }

  const existingUser = users.find((user) => {
    const storedUser = normalizeUser(user);
    return storedUser.email === email && storedUser.password === password;
  });

  if (!existingUser) {
    setMessage("We could not find that account. Please try again or create one.");
    return;
  }

  showApp(normalizeUser(existingUser));
  authForm.reset();
}

function handleBuyCredits() {
  showCreditsModal("Coming Soon");
  setChatStatus("Credits purchases are coming soon.");
}

async function sendMessage() {
  if (!userInput || !sendButton || !chatMessages) return;

  const input = userInput.value.trim();

  if (!input) {
    setChatStatus("Please type a message first.");
    return;
  }

  if (creditsBalance < CREDIT_COST_PER_CHAT) {
    creditsBalance = 0;
    creditsRefillUntil = Date.now() + REFILL_MS;
    saveCreditsState();
    updateCreditsUI();
    startCreditsRefillTimer();
    setChatStatus("Your credits refill in 1 hour.");
    return;
  }

  creditsBalance -= CREDIT_COST_PER_CHAT;
  saveCreditsState();
  updateCreditsUI();
  if (creditsBalance <= 0) {
    creditsRefillUntil = Date.now() + REFILL_MS;
    saveCreditsState();
    startCreditsRefillTimer();
  }

  currentConversation.push({ role: "user", text: input });
  currentConversation.push({ role: "bot", text: "Thinking..." });
  renderConversation(currentConversation);
  persistConversation();
  userInput.value = "";
  sendButton.disabled = true;

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: input })
    });

    const data = await response.json();
    const lastBotMessage = currentConversation[currentConversation.length - 1];
    if (lastBotMessage) {
      lastBotMessage.text = data.reply || "No response received.";
    }
    persistConversation();
    renderConversation(currentConversation);
  } catch (error) {
    const lastBotMessage = currentConversation[currentConversation.length - 1];
    if (lastBotMessage) {
      lastBotMessage.text = "Unable to reach the server.";
    }
    persistConversation();
    renderConversation(currentConversation);
  } finally {
    sendButton.disabled = false;
    userInput.focus();
  }
}

if (userInput) {
  userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  });
}

if (authForm) {
  authForm.addEventListener("submit", handleAuthSubmit);
}

if (toggleModeButton) {
  toggleModeButton.addEventListener("click", () => {
    setAuthMode(authMode === "login" ? "register" : "login");
  });
}

if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener("click", handleForgotPassword);
}

if (togglePasswordButton) {
  togglePasswordButton.addEventListener("click", togglePasswordVisibility);
}

if (savedChatsButton) {
  savedChatsButton.addEventListener("click", loadSavedChats);
}

if (saveChatButton) {
  saveChatButton.addEventListener("click", saveCurrentChat);
}

if (closeSavedChatsButton) {
  closeSavedChatsButton.addEventListener("click", closeSavedChatsModal);
}

if (closeCreditsModalButton) {
  closeCreditsModalButton.addEventListener("click", closeCreditsModal);
}

if (creditsModal) {
  creditsModal.addEventListener("click", (event) => {
    if (event.target === creditsModal) {
      closeCreditsModal();
    }
  });
}

if (savedChatsModal) {
  savedChatsModal.addEventListener("click", (event) => {
    if (event.target === savedChatsModal) {
      closeSavedChatsModal();
    }
  });
}

if (newChatButton) {
  newChatButton.addEventListener("click", startNewChat);
}

if (buyCreditsButton) {
  buyCreditsButton.addEventListener("click", handleBuyCredits);
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("bizbuddyUser");
    authForm?.reset();
    setAuthMode("login");
    showAuth();
  });
}

const savedUser = JSON.parse(localStorage.getItem("bizbuddyUser") || "null");
if (savedUser) {
  showApp(savedUser);
} else {
  showAuth();
  setAuthMode("login");
}