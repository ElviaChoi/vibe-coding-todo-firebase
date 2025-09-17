import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  update,
  remove,
  query,
  orderByChild,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMWHrcID5Fie8CjjZbkZV80S8UcCf8IAo",
  authDomain: "siyoung-todo-backend.firebaseapp.com",
  databaseURL:
    "https://siyoung-todo-backend-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "siyoung-todo-backend",
  storageBucket: "siyoung-todo-backend.firebasestorage.app",
  messagingSenderId: "15193455071",
  appId: "1:15193455071:web:73b283008f75a412be6c6a",
};

let db;
let todosRef;
try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  todosRef = ref(db, "todos");
  console.log("Firebase Realtime Database 초기화 시도 완료");
} catch (error) {
  console.error("Firebase Realtime Database 초기화 실패:", error);
  alert("Firebase 연결에 실패했습니다. 앱을 사용할 수 없습니다.");
}

class TodoApp {
  constructor(db) {
    this.todos = [];
    this.currentFilter = "all";
    this.editingId = null;
    this.db = db;
    this.todosRef = todosRef;

    this.init();
  }

  async init() {
    console.log("TodoApp 초기화 시작");
    this.bindEvents();
    this.listenForTodos();
    console.log("TodoApp 초기화 완료");
  }

  listenForTodos() {
    onValue(
      query(this.todosRef, orderByChild("createdAt")),
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.todos = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          this.todos.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          console.log(
            `Firebase Realtime Database에서 할일 로드 완료: ${this.todos.length}개`
          );
          this.showMessage(
            "Firebase Realtime Database와 성공적으로 연결되었습니다.",
            "success"
          );
        } else {
          this.todos = [];
          console.log("Firebase Realtime Database에 할일이 없습니다.");
        }
        this.render();
        this.updateStats();
      },
      (error) => {
        console.error("할일 로드 오류:", error);
        this.showMessage(
          "Firebase 연결 실패. Realtime Database 보안 규칙을 확인하세요.",
          "error"
        );
      }
    );
  }

  bindEvents() {
    document
      .getElementById("addBtn")
      .addEventListener("click", () => this.addTodo());
    document.getElementById("todoInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addTodo();
    });

    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.setFilter(e.target.dataset.filter)
      );
    });

    const editModal = document.getElementById("editModal");
    document
      .getElementById("closeModal")
      .addEventListener("click", () => this.closeModal());
    document
      .getElementById("cancelEdit")
      .addEventListener("click", () => this.closeModal());
    document
      .getElementById("saveEdit")
      .addEventListener("click", () => this.saveEdit());
    document.getElementById("editInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.saveEdit();
    });
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) this.closeModal();
    });
  }

  async addTodo() {
    const todoInput = document.getElementById("todoInput");
    const text = todoInput.value.trim();

    if (text === "") {
      this.showMessage("할일을 입력해주세요!", "warning");
      return;
    }

    const todoData = {
      text: text,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    try {
      await push(this.todosRef, todoData);
      todoInput.value = "";
      this.showMessage("할일이 추가되었습니다!", "success");
    } catch (error) {
      console.error("할일 추가 오류:", error);
      this.showMessage("할일 추가 실패. 연결을 확인하세요.", "error");
    }
  }

  async toggleTodo(id) {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) return;

    try {
      const todoItemRef = ref(this.db, `todos/${id}`);
      await update(todoItemRef, { completed: !todo.completed });
    } catch (error) {
      console.error("할일 상태 업데이트 오류:", error);
      this.showMessage("상태 업데이트 실패", "error");
    }
  }

  editTodo(id) {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      this.editingId = id;
      const editInput = document.getElementById("editInput");
      editInput.value = todo.text;
      this.showModal();
      editInput.focus();
      editInput.select();
    }
  }

  async saveEdit() {
    const newText = document.getElementById("editInput").value.trim();
    if (newText === "") {
      this.showMessage("수정할 내용을 입력해주세요!", "warning");
      return;
    }

    const todo = this.todos.find((t) => t.id === this.editingId);
    if (!todo) return;

    const saveBtn = document.getElementById("saveEdit");
    const cancelBtn = document.getElementById("cancelEdit");

    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';

    try {
      const todoItemRef = ref(this.db, `todos/${this.editingId}`);
      await update(todoItemRef, { text: newText });

      this.closeModal();
      this.showMessage("할일이 수정되었습니다!", "success");
    } catch (error) {
      console.error("할일 수정 오류:", error);
      this.showMessage(
        "할일 수정 실패. Realtime Database 보안 규칙을 확인하세요.",
        "error"
      );
    } finally {
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      saveBtn.innerHTML = "저장";
    }
  }

  async deleteTodo(id) {
    if (confirm("정말로 이 할일을 삭제하시겠습니까?")) {
      try {
        const todoItemRef = ref(this.db, `todos/${id}`);
        await remove(todoItemRef);
        this.showMessage("할일이 삭제되었습니다!", "info");
      } catch (error) {
        console.error("할일 삭제 오류:", error);
        this.showMessage("할일 삭제 실패", "error");
      }
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === filter);
    });
    this.render();
  }

  getFilteredTodos() {
    switch (this.currentFilter) {
      case "pending":
        return this.todos.filter((todo) => !todo.completed);
      case "completed":
        return this.todos.filter((todo) => todo.completed);
      default:
        return this.todos;
    }
  }

  render() {
    const todoList = document.getElementById("todoList");
    const emptyState = document.getElementById("emptyState");
    const filteredTodos = this.getFilteredTodos();

    emptyState.style.display = filteredTodos.length === 0 ? "block" : "none";
    todoList.style.display = filteredTodos.length > 0 ? "block" : "none";

    todoList.innerHTML = filteredTodos
      .map(
        (todo) => `
            <div class="todo-item ${
              todo.completed ? "completed" : ""
            }" data-id="${todo.id}">
                <input type="checkbox" class="todo-checkbox" ${
                  todo.completed ? "checked" : ""
                }>
                <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                <div class="todo-actions">
                    <button class="edit-btn" title="수정"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" title="삭제"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `
      )
      .join("");

    todoList.querySelectorAll(".todo-item").forEach((item) => {
      item
        .querySelector(".todo-checkbox")
        .addEventListener("change", () => this.toggleTodo(item.dataset.id));
      item
        .querySelector(".edit-btn")
        .addEventListener("click", () => this.editTodo(item.dataset.id));
      item
        .querySelector(".delete-btn")
        .addEventListener("click", () => this.deleteTodo(item.dataset.id));
    });
  }

  updateStats() {
    document.getElementById("totalCount").textContent = this.todos.length;
    document.getElementById("pendingCount").textContent = this.todos.filter(
      (t) => !t.completed
    ).length;
    document.getElementById("completedCount").textContent = this.todos.filter(
      (t) => t.completed
    ).length;
  }

  showModal() {
    document.getElementById("editModal").classList.add("show");
    document.body.style.overflow = "hidden";
  }

  closeModal() {
    document.getElementById("editModal").classList.remove("show");
    document.body.style.overflow = "auto";
    this.editingId = null;
    document.getElementById("editInput").value = "";
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showMessage(message, type = "info") {
    const existingMessage = document.querySelector(".toast-message");
    if (existingMessage) existingMessage.remove();

    const toast = document.createElement("div");
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `<div class="toast-content"><i class="fas fa-${this.getIconForType(
      type
    )}"></i><span>${message}</span></div>`;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  getIconForType(type) {
    return (
      {
        success: "check-circle",
        warning: "exclamation-triangle",
        error: "times-circle",
        info: "info-circle",
      }[type] || "info-circle"
    );
  }
}

const style = document.createElement("style");
style.textContent = `
    .toast-message { position: fixed; top: 20px; right: 20px; background: #17a2b8; color: white; padding: 15px 20px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); z-index: 10000; animation: slideInRight 0.3s ease; max-width: 300px; }
    .toast-message.toast-success { background: #28a745; }
    .toast-message.toast-warning { background: #ffc107; }
    .toast-message.toast-error { background: #dc3545; }
    .toast-message.toast-info { background: #17a2b8; }
    .toast-content { display: flex; align-items: center; gap: 10px; }
    @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", () => {
  if (db) {
    window.todoApp = new TodoApp(db);
  } else {
    console.error(
      "Realtime Database가 초기화되지 않아 앱을 시작할 수 없습니다."
    );
  }
});