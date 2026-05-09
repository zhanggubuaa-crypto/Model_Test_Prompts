/* =========================================
   アプリケーション本体
   ========================================= */

// ============================================
// 初期データ生成
// ============================================

function createDefaultData() {
  const now = new Date().toISOString();

  // カラム定義
  const columnsData = {
    todo: {
      id: 'todo',
      name: 'ToDo',
      wipLimit: null,
      cards: ['card-1', 'card-2'],
      order: 0
    },
    inprogress: {
      id: 'inprogress',
      name: '進行中',
      wipLimit: 5,
      cards: ['card-3'],
      order: 1
    },
    review: {
      id: 'review',
      name: 'レビュー',
      wipLimit: null,
      cards: [],
      order: 2
    },
    done: {
      id: 'done',
      name: '完了',
      wipLimit: null,
      cards: [],
      order: 3
    }
  };

  // カードデータ（デフォルトのサンプルデータ）
  const cardsData = {
    'card-1': {
      id: 'card-1',
      title: 'プロジェクトのセットアップ',
      description: 'Gitリポジトリの初期化と開発環境の構築\n- Node.jsのインストール\n- VS Code設定\n- デザインシステムの決定',
      dueDate: null,
      priority: 'high',
      tags: ['setup', 'planning'],
      assignee: '太郎',
      checklist: [
        { id: 'task-1-1', text: 'リポジトリ作成', completed: true },
        { id: 'task-1-2', text: 'package.json設定', completed: false },
        { id: 'task-1-3', text: 'ESLint設定', completed: false }
      ],
      comments: [
        { id: 'comment-1', author: '太郎', text: '开始しました', createdAt: now }
      ],
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    'card-2': {
      id: 'card-2',
      title: 'UIデザインの作成',
      description: 'カンバンボードの基本的なUIデザイン\n- カラム構成\n- カードのスタイリング\n- レスポンシブ対応',
      dueDate: addDays(7),
      priority: 'medium',
      tags: ['design', 'ui'],
      assignee: '花子',
      checklist: [],
      comments: [],
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    'card-3': {
      id: 'card-3',
      title: 'HTML構造の実装',
      description: 'HTMLの基本構造を実装する\n- ヘッダー\n- メインエリア\n- モーダル',
      dueDate: addDays(3),
      priority: 'urgent',
      tags: ['development', 'frontend'],
      assignee: '次郎',
      checklist: [
        { id: 'task-3-1', text: 'ヘッダー実装', completed: true },
        { id: 'task-3-2', text: 'フィルターバー実装', completed: true }
      ],
      comments: [],
      archived: false,
      createdAt: now,
      updatedAt: now
    }
  };

  // デフォルトボード
  const defaultBoard = {
    id: 'default',
    name: 'My Board',
    columns: ['todo', 'inprogress', 'review', 'done'],
    columnsData: columnsData,
    cardsData: cardsData,
    order: 0
  };

  return {
    boards: {
      'default': defaultBoard
    },
    activeBoard: 'default',
    theme: 'light',
    undoStack: [],
    undoIndex: -1
  };
}

// 未来の日付を計算（デフォルトの期日設定用）
function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// ============================================
// データ管理クラス
// ============================================

class DataManager {
  constructor() {
    this.state = createDefaultData();
    this.loadFromStorage();
  }

  // 保存から読み込み
  loadFromStorage() {
    const saved = Storage.load();
    if (saved) {
      this.state = saved;
    }
  }

  // 状態を保存
  save() {
    Storage.save(this.state);
  }

  // カード追加
  addCard(cardData) {
    this.pushUndoState();

    const board = this.state.boards[this.state.activeBoard];
    const cardId = Storage.generateId('card');

    const newCard = {
      id: cardId,
      title: cardData.title,
      description: cardData.description || '',
      dueDate: cardData.dueDate || null,
      priority: cardData.priority || 'medium',
      tags: this.parseTags(cardData.tags || ''),
      assignee: cardData.assignee || null,
      checklist: [],
      comments: [],
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    board.cardsData[cardId] = newCard;

    // 指定されたカラムの末尾に追加（デフォルトは最初のカラム）
    const columnId = cardData.columnId || board.columns[0];
    if (board.columnsData[columnId]) {
      board.columnsData[columnId].cards.push(cardId);

      // WIP制限チェック
      const wipStatus = this.checkWipLimit(columnId);
      if (!wipStatus.ok) {
        this.showWipWarning(board.columnsData[columnId].name, wipStatus.count, wipStatus.limit);
      }
    }

    this.save();
    return newCard;
  }

  // カード更新
  updateCard(cardId, updates) {
    this.pushUndoState();
    const board = this.state.boards[this.state.activeBoard];

    if (board.cardsData[cardId]) {
      if (updates.tags) {
        updates.tags = this.parseTags(updates.tags);
      }
      updates.updatedAt = new Date().toISOString();

      board.cardsData[cardId] = {
        ...board.cardsData[cardId],
        ...updates
      };
      this.save();
      return board.cardsData[cardId];
    }

    return null;
  }

  // カード削除
  deleteCard(cardId) {
    const board = this.state.boards[this.state.activeBoard];

    // カードをすべてのカラムから削除
    for (const colId of board.columns) {
      const col = board.columnsData[colId];
      const index = col.cards.indexOf(cardId);
      if (index > -1) {
        col.cards.splice(index, 1);
      }
    }

    delete board.cardsData[cardId];
    this.save();
  }

  // カード移動
  moveCard(cardId, fromColumnId, toColumnId, insertIndex) {
    const board = this.state.boards[this.state.activeBoard];

    // 元のカラムから削除
    const fromCol = board.columnsData[fromColumnId];
    const cardIndex = fromCol.cards.indexOf(cardId);
    if (cardIndex > -1) {
      fromCol.cards.splice(cardIndex, 1);
    }

    // 新しいカラムに挿入
    const toCol = board.columnsData[toColumnId];
    const targetIndex = insertIndex !== undefined ? insertIndex : toCol.cards.length;

    if (targetIndex >= 0 && targetIndex <= toCol.cards.length) {
      toCol.cards.splice(targetIndex, 0, cardId);
      this.save();

      // 新しいカラムのWIP制限チェック
      const wipStatus = this.checkWipLimit(toColumnId);
      if (!wipStatus.ok) {
        this.showWipWarning(toCol.name, wipStatus.count, wipStatus.limit);
      }

      return true;
    }

    // 元に戻す
    fromCol.cards.splice(cardIndex, 0, cardId);
    return false;
  }

  // カードのアーカイブ/復元
  toggleArchive(cardId) {
    this.pushUndoState();
    const board = this.state.boards[this.state.activeBoard];
    if (board.cardsData[cardId]) {
      board.cardsData[cardId].archived = !board.cardsData[cardId].archived;
      board.cardsData[cardId].updatedAt = new Date().toISOString();
      this.save();
      return board.cardsData[cardId].archived;
    }
    return false;
  }

  // カラム追加
  addColumn(name) {
    this.pushUndoState();
    const board = this.state.boards[this.state.activeBoard];
    const columnId = Storage.generateId('col');

    const newColumn = {
      id: columnId,
      name: name || '新しいカラム',
      wipLimit: null,
      cards: [],
      order: board.columns.length
    };

    board.columnsData[columnId] = newColumn;
    board.columns.push(columnId);
    this.save();

    return newColumn;
  }

  // カラム更新
  updateColumn(columnId, updates) {
    this.pushUndoState();
    const board = this.state.boards[this.state.activeBoard];

    if (board.columnsData[columnId]) {
      board.columnsData[columnId] = {
        ...board.columnsData[columnId],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return board.columnsData[columnId];
    }

    return null;
  }

  // カラム削除
  deleteColumn(columnId) {
    this.pushUndoState();
    const board = this.state.boards[this.state.activeBoard];
    const index = board.columns.indexOf(columnId);

    if (index > -1) {
      // カラム内のカードも削除
      const column = board.columnsData[columnId];
      column.cards.forEach(cardId => {
        delete board.cardsData[cardId];
      });

      delete board.columnsData[columnId];
      board.columns.splice(index, 1);
      this.save();
      return true;
    }

    return false;
  }

  // カラム並び替え
  reorderColumns(order) {
    const board = this.state.boards[this.state.activeBoard];
    board.columns = order;
    this.save();
  }

  // カード数取得
  getCardCount(columnId) {
    const board = this.state.boards[this.state.activeBoard];
    const column = board.columnsData[columnId];
    if (!column) return 0;
    return column.cards.filter(cardId => !board.cardsData[cardId].archived).length;
  }

  // WIP制限チェック
  checkWipLimit(columnId) {
    const board = this.state.boards[this.state.activeBoard];
    const column = board.columnsData[columnId];

    if (!column.wipLimit) return { ok: true, limit: null, count: 0 };

    const count = column.cards.filter(cardId => !board.cardsData[cardId].archived).length;

    return {
      ok: count <= column.wipLimit,
      limit: column.wipLimit,
      count: count,
      overBy: Math.max(0, count - column.wipLimit)
    };
  }

  // WIP警告ポップアップを表示
  showWipWarning(columnName, count, limit) {
    const popup = document.createElement('div');
    popup.className = 'wip-warning-popup show';
    popup.innerHTML = `
      <h4>WIP制限超過!</h4>
      <p>「${columnName}」に${limit}件の制限を超えています (現在: ${count}件)</p>
    `;
    document.body.appendChild(popup);

    // 3秒後に削除
    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 300);
    }, 3000);
  }

  // タグの文字列を配列に変換
  parseTags(tagString) {
    if (!tagString || typeof tagString !== 'string') return [];
    return tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }

  // タグの一覧を取得
  getAllTags() {
    const board = this.state.boards[this.state.activeBoard];
    const tags = new Set();

    Object.values(board.cardsData).forEach(card => {
      card.tags.forEach(tag => tags.add(tag));
    });

    return Array.from(tags).sort();
  }

  // 優先度の色クラスを取得
  getPriorityClass(priority) {
    const classes = {
      urgent: 'urgent',
      high: 'high',
      medium: 'medium',
      low: 'low'
    };
    return classes[priority] || 'medium';
  }

  // 優先度のラベルを取得
  getPriorityLabel(priority) {
    const labels = {
      urgent: '緊急',
      high: '高',
      medium: '中',
      low: '低'
    };
    return labels[priority] || priority;
  }

  // 優先度の色を取得
  getPriorityColor(priority) {
    const colors = {
      urgent: '#f25f4c',
      high: '#eeb534',
      medium: '#70c4be',
      low: '#54a2ff'
    };
    return colors[priority] || '#70c4be';
  }

  // ボード追加
  addBoard(name) {
    const boardId = Storage.generateId('board');
    const columnsData = {};
    const columns = ['todo', 'inprogress', 'review', 'done'];

    columns.forEach((colName, index) => {
      columnsData[colName] = {
        id: colName,
        name: colName === 'todo' ? 'ToDo' : colName === 'inprogress' ? '進行中' :
              colName === 'review' ? 'レビュー' : '完了',
        wipLimit: null,
        cards: [],
        order: index
      };
    });

    const newBoard = {
      id: boardId,
      name: name || '新しいボード',
      columns: columns,
      columnsData: columnsData,
      cardsData: {},
      order: Object.keys(this.state.boards).length
    };

    this.state.boards[boardId] = newBoard;
    this.state.activeBoard = boardId;
    this.save();

    return newBoard;
  }

  // ボード削除
  deleteBoard(boardId) {
    if (Object.keys(this.state.boards).length <= 1) {
      return { success: false, message: '少なくとも1つのボードが必要です' };
    }

    delete this.state.boards[boardId];

    if (this.state.activeBoard === boardId) {
      const remainingBoards = Object.keys(this.state.boards);
      this.state.activeBoard = remainingBoards[0];
    }

    this.save();
    return { success: true };
  }

  // テーマ切替
  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    this.save();
    return this.state.theme;
  }

  // アンドゥ関連
  pushUndoState() {
    // undoStackのサイズを制限（最新100件のみ）
    const maxStack = 100;
    if (this.state.undoStack.length >= maxStack) {
      this.state.undoStack = this.state.undoStack.slice(1);
    }
    const currentState = JSON.stringify(this.state);
    this.state.undoStack = this.state.undoStack.slice(0, this.state.undoIndex + 1);
    this.state.undoStack.push(currentState);
    this.state.undoIndex = this.state.undoStack.length - 1;
  }

  undo() {
    if (this.state.undoIndex > 0) {
      this.state.undoIndex--;
      this.state = JSON.parse(this.state.undoStack[this.state.undoIndex]);
      this.save();
      updateUndoRedoButtons();
      return true;
    }
    return false;
  }

  redo() {
    if (this.state.undoIndex < this.state.undoStack.length - 1) {
      this.state.undoIndex++;
      this.state = JSON.parse(this.state.undoStack[this.state.undoIndex]);
      this.save();
      updateUndoRedoButtons();
      return true;
    }
    return false;
  }

  // 期限の状態を取得
  getDueDateStatus(dueDate) {
    if (!dueDate) return 'none';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 7) return 'week';
    return 'future';
  }

  // 絞り込みされたカードを取得
  getFilteredCards(filters) {
    const board = this.state.boards[this.state.activeBoard];
    let cardIds = [...board.columnsData[filters.columnId]?.cards || board.columns.flatMap(colId => board.columnsData[colId].cards)];

    // アーカイブ済みは除く（フィルターオプションで制御可能）
    cardIds = cardIds.filter(id => !board.cardsData[id].archived);

    // テキスト検索
    if (filters.text) {
      const searchLower = filters.text.toLowerCase();
      cardIds = cardIds.filter(id => {
        const card = board.cardsData[id];
        return (
          card.title.toLowerCase().includes(searchLower) ||
          (card.description && card.description.toLowerCase().includes(searchLower)) ||
          card.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
          (card.assignee && card.assignee.toLowerCase().includes(searchLower))
        );
      });
    }

    // 優先度フィルター
    if (filters.priority && filters.priority !== 'all') {
      cardIds = cardIds.filter(id => board.cardsData[id].priority === filters.priority);
    }

    // 期日フィルター
    if (filters.dueDate && filters.dueDate !== 'all') {
      cardIds = cardIds.filter(id => {
        const card = board.cardsData[id];
        if (!card.dueDate) return filters.dueDate === 'none';
        const status = this.getDueDateStatus(card.dueDate);
        if (filters.dueDate === 'today') return status === 'today';
        if (filters.dueDate === 'week') return ['today', 'tomorrow', 'week'].includes(status);
        if (filters.dueDate === 'overdue') return status === 'overdue';
        return true;
      });
    }

    // タグフィルター
    if (filters.tags && filters.tags.length > 0) {
      cardIds = cardIds.filter(id => {
        const card = board.cardsData[id];
        return filters.tags.some(tag => card.tags.includes(tag));
      });
    }

    return cardIds.map(id => board.cardsData[id]);
  }
}

// ============================================
// UI操作クラス
// ============================================

class UIManager {
  constructor(dataManager) {
    this.dm = dataManager;
    this.filters = {
      text: '',
      priority: 'all',
      dueDate: 'all',
      tags: []
    };
    this.currentEditCard = null;
    this.currentColumnBeingEdited = null;
  }

  // フィルターオブジェクトの作成
  createFilterObject() {
    return { ...this.filters };
  }

  // 現在のフィルター状態を取得
  getCurrentFilters() {
    return {
      text: this.filters.text,
      priority: this.filters.priority,
      dueDate: this.filters.dueDate,
      tags: [...this.filters.tags]
    };
  }

  // フィルター適用
  applyFilters(cardIds) {
    const cardIdsSet = new Set(cardIds);
    const board = this.dm.state.boards[this.dm.state.activeBoard];
    let filteredIds = [...cardIdsSet];

    // テキスト検索
    if (this.filters.text) {
      const searchLower = this.filters.text.toLowerCase();
      filteredIds = filteredIds.filter(id => {
        const card = board.cardsData[id];
        if (!card) return false;
        return (
          card.title.toLowerCase().includes(searchLower) ||
          (card.description && card.description.toLowerCase().includes(searchLower)) ||
          card.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
          (card.assignee && card.assignee.toLowerCase().includes(searchLower))
        );
      });
    }

    // 優先度フィルター
    if (this.filters.priority !== 'all') {
      filteredIds = filteredIds.filter(id => board.cardsData[id].priority === this.filters.priority);
    }

    // 期日フィルター
    if (this.filters.dueDate !== 'all') {
      filteredIds = filteredIds.filter(id => {
        const card = board.cardsData[id];
        if (!card.dueDate) return false;
        const status = this.dm.getDueDateStatus(card.dueDate);
        if (this.filters.dueDate === 'today') return status === 'today';
        if (this.filters.dueDate === 'week') return ['today', 'tomorrow', 'week'].includes(status);
        if (this.filters.dueDate === 'overdue') return status === 'overdue';
        return true;
      });
    }

    // タグフィルター（複数選択時はOR条件）
    if (this.filters.tags.length > 0) {
      filteredIds = filteredIds.filter(id => {
        const card = board.cardsData[id];
        return this.filters.tags.some(tag => card.tags.includes(tag));
      });
    }

    return filteredIds;
  }

  // カードHTMLを生成
  generateCardHTML(card, columnId) {
    const priority = this.dm.getPriorityLabel(card.priority);
    const priorityClass = this.dm.getPriorityClass(card.priority);
    const dueStatus = card.dueDate ? this.dm.getDueDateStatus(card.dueDate) : 'none';
    const tagColors = ['card-tag-1', 'card-tag-2', 'card-tag-3', 'card-tag-4', 'card-tag-5', 'card-tag-6', 'card-tag-7'];

    // チェックリストの進捗
    const totalTasks = card.checklist.length;
    const completedTasks = card.checklist.filter(t => t.completed).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // タグのHTML（配列でない場合は空配列として扱う）
    const tagsArray = Array.isArray(card.tags) ? card.tags : [];
    const tagsHtml = tagsArray.slice(0, 5).map((tag, i) => {
      const colorClass = tagColors[i % tagColors.length];
      return `<span class="card-tag ${colorClass}">${this.escapeHtml(tag)}</span>`;
    }).join('');

    const moreTags = tagsArray.length > 5 ? `<span class="card-tag card-tag-7">+${tagsArray.length - 5}</span>` : '';

    // コメント数
    const commentsCount = card.comments.length;

    // チェックリストのHTML（カード内編集可能）
    const checklistHtml = card.checklist.map((task, index) => `
      <div class="checklist-item ${task.completed ? 'completed' : ''}" data-checklist-index="${index}">
        <input type="checkbox" class="checklist-checkbox" ${task.completed ? 'checked' : ''}>
        <span class="checklist-item-text">${this.escapeHtml(task.text)}</span>
        <button class="btn-small checklist-item-remove" title="削除">×</button>
      </div>
    `).join('');

    const assigneeAvatar = card.assignee ? this.generateAvatar(card.assignee) : '';

    return `
      <div class="card card-${priorityClass}" data-card-id="${card.id}" data-column-id="${columnId}" draggable="true">
        <div class="card-header">
          <div class="card-title-editable" contenteditable="true">${this.escapeHtml(card.title)}</div>
          <div class="card-actions-top">
            <button class="btn-icon card-edit-btn" title="編集">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="card-content-view">
          ${card.description ? `<div class="card-content markdown">${this.convertMarkdownToHtml(card.description)}</div>` : ''}
          <div class="card-meta">
            ${card.dueDate ? `<div class="card-meta-item due-date ${dueStatus}" title="期日: ${card.dueDate}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              ${card.dueDate}
            </div>` : ''}
            <div class="card-meta-item priority" title="優先度: ${priority}">
              <span class="card-priority ${priorityClass}"></span>
              ${priority}
            </div>
            ${assigneeAvatar ? `<div class="card-assignee" title="担当者: ${card.assignee}">
              ${assigneeAvatar}
              ${this.escapeHtml(card.assignee)}
            </div>` : ''}
          </div>
          ${card.tags.length > 0 ? `<div class="card-tags">${tagsHtml}${moreTags}</div>` : ''}
          ${card.checklist.length > 0 ? `
            <div class="card-checklist">
              <div class="checklist-container">
                ${checklistHtml}
              </div>
              <div class="checklist-footer">
                <button class="btn-small checklist-add-btn" title="項目を追加">+ 追加</button>
                <div class="checklist-progress">${completedTasks}/${totalTasks}</div>
              </div>
            </div>
          ` : ''}
          ${card.comments.length > 0 ? `
            <div class="card-comments">
              <div class="card-comments-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <span>${commentsCount}件</span>
              </div>
              <div class="card-comments-list">
                ${card.comments.slice(-3).reverse().map(comment => `
                  <div class="comment-item">
                    <span class="comment-author">${this.escapeHtml(comment.author || 'Unknown')}</span>
                    <span class="comment-text">${this.escapeHtml(comment.text)}</span>
                    <span class="comment-date">${formatDate(comment.createdAt)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // カラムHTMLを生成
  generateColumnHTML(columnId) {
    const board = this.dm.state.boards[this.dm.state.activeBoard];
    const column = board.columnsData[columnId];
    const cards = column.cards.map(cardId => board.cardsData[cardId]).filter(c => !c.archived);
    const cardCount = cards.length;
    const wipStatus = this.dm.checkWipLimit(columnId);
    const wipWarning = !wipStatus.ok;

    return `
      <div class="board-column ${wipWarning ? 'column-wip-warning' : ''}" data-column-id="${columnId}" draggable="true">
        <div class="column-header">
          <div class="column-title-wrapper">
            <div class="column-title-editable active" contenteditable="true">${this.escapeHtml(column.name)}</div>
            <div class="column-title">${this.escapeHtml(column.name)}</div>
            <div class="column-badge">${cardCount}</div>
          </div>
          <div class="column-actions">
            <button class="btn-icon" title="カラムを並び替え">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="9" x2="19" y2="9"></line>
                <line x1="5" y1="15" x2="19" y2="15"></line>
              </svg>
            </button>
            <button class="btn-icon column-rename-btn" title="名前を変更">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon btn-danger column-delete-btn" title="カラムを削除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="column-body" data-column-id="${columnId}">
          ${cards.map(card => this.generateCardHTML(card, columnId)).join('')}
        </div>
        <div class="column-footer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>新規カード</span>
        </div>
      </div>
    `;
  }

  // マークダウンをHTMLに変換（簡易版）
  convertMarkdownToHtml(text) {
    if (!text) return '';

    let html = text
      .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>$2')
      .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>$2')
      .replace(/# (.*?)(\n|$)/g, '<h1>$1</h1>$2')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');

    return html;
  }

  // テキストのHTMLエスケープ
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // アバターを生成
  generateAvatar(text) {
    if (!text) return '';
    const initials = text.substring(0, 2).toUpperCase();
    const colors = ['#0079bf', '#61bd4f', '#f25f4c', '#eeb534', '#54a2ff', '#9b59b6', '#e67e22'];
    const color = colors[text.length % colors.length];
    return `<span class="card-assignee-avatar" style="background-color: ${color}">${this.escapeHtml(initials)}</span>`;
  }

  // キーボードショートカットの表示
  showKeyboardShortcuts() {
    document.getElementById('shortcuts-help').classList.add('show');
    setTimeout(() => {
      document.getElementById('shortcuts-help').classList.remove('show');
    }, 5000);
  }
}

// グローバルインスタンス
const dm = new DataManager();
const ui = new UIManager(dm);

// ============================================
// パフォーマンス最適化: 大量カード対応
// ============================================

// レンダリングの遅延実行（大量カード时の快適性向上）
let renderTimeoutId = null;
function debouncedRender() {
  if (renderTimeoutId) {
    clearTimeout(renderTimeoutId);
  }
  renderTimeoutId = setTimeout(() => {
    renderBoard();
    updateTagFilters();
  }, 50);
}

// フィルター処理の高速化
function applyFiltersFast(cardIds) {
  const filters = ui.getCurrentFilters();
  const cardIdsSet = new Set(cardIds);
  const board = dm.state.boards[dm.state.activeBoard];
  let filteredIds = [...cardIdsSet];

  // テキスト検索（高速版）
  if (filters.text) {
    const searchLower = filters.text.toLowerCase();
    filteredIds = filteredIds.filter(id => {
      const card = board.cardsData[id];
      if (!card) return false;
      return (
        card.title.toLowerCase().includes(searchLower) ||
        (card.description && card.description.toLowerCase().includes(searchLower)) ||
        card.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        (card.assignee && card.assignee.toLowerCase().includes(searchLower))
      );
    });
  }

  // 優先度フィルター
  if (filters.priority !== 'all') {
    filteredIds = filteredIds.filter(id => board.cardsData[id].priority === filters.priority);
  }

  // 期日フィルター
  if (filters.dueDate !== 'all') {
    filteredIds = filteredIds.filter(id => {
      const card = board.cardsData[id];
      if (!card.dueDate) return false;
      const status = dm.getDueDateStatus(card.dueDate);
      if (filters.dueDate === 'today') return status === 'today';
      if (filters.dueDate === 'week') return ['today', 'tomorrow', 'week'].includes(status);
      if (filters.dueDate === 'overdue') return status === 'overdue';
      return true;
    });
  }

  // タグフィルター（複数選択時はOR条件）
  if (filters.tags.length > 0) {
    filteredIds = filteredIds.filter(id => {
      const card = board.cardsData[id];
      return filters.tags.some(tag => card.tags.includes(tag));
    });
  }

  return filteredIds;
}

// ============================================
// 初期化処理
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // テーマの適用
  if (dm.state.theme === 'dark') {
    document.body.classList.add('dark-theme');
  }

  // ボードセレクターの初期化
  renderBoardSelector();

  // タグフィルターの初期化
  updateTagFilters();

  // ボードの描画
  renderBoard();

  // ドラッグ＆ドロップの初期化
  initDragDrop();

  // イベントリスナーの設定
  setupEventListeners();
});

// ドラッグ＆ドロップの初期化
function initDragDrop() {
  const kanbanBoard = document.getElementById('kanban-board');

  // カラムのドラッグ設定
  kanbanBoard.addEventListener('dragstart', (e) => {
    const header = e.target.closest('.column-header');
    if (header) {
      const column = header.closest('.board-column');
      if (column) {
        column.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', column.dataset.columnId);
      }
    }
  });

  // カラムのドロップ設定
  kanbanBoard.addEventListener('dragover', (e) => {
    e.preventDefault();
    const column = e.target.closest('.board-column');
    if (column && !column.classList.contains('dragging')) {
      column.classList.add('drag-column-highlight');
    }
  });

  kanbanBoard.addEventListener('dragleave', (e) => {
    const column = e.target.closest('.board-column');
    if (column) {
      column.classList.remove('drag-column-highlight');
    }
  });

  kanbanBoard.addEventListener('drop', (e) => {
    e.preventDefault();
    const column = e.target.closest('.board-column');
    if (column && !column.classList.contains('dragging')) {
      column.classList.remove('drag-column-highlight');
    }
  });

  // カラムヘッダーのドロップ処理（並び替え）
  document.querySelectorAll('.column-header').forEach(header => {
    header.addEventListener('dragstart', (e) => {
      const column = header.closest('.board-column');
      if (column) {
        column.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', column.dataset.columnId);
      }
    });

    header.addEventListener('dragover', (e) => {
      e.preventDefault();
      const column = header.closest('.board-column');
      if (column && !column.classList.contains('dragging')) {
        column.classList.add('drag-column-highlight');
      }
    });

    header.addEventListener('dragleave', (e) => {
      const column = header.closest('.board-column');
      if (column) {
        column.classList.remove('drag-column-highlight');
      }
    });

    header.addEventListener('drop', (e) => {
      e.preventDefault();
      const column = header.closest('.board-column');
      if (column && !column.classList.contains('dragging')) {
        column.classList.remove('drag-column-highlight');
      }
    });

    header.addEventListener('dragend', (e) => {
      const column = e.target.closest('.board-column');
      if (column) {
        column.classList.remove('dragging');
        document.querySelectorAll('.drag-column-highlight').forEach(el => {
          el.classList.remove('drag-column-highlight');
        });
      }
    });
  });

  // カードのドラッグ設定
  document.getElementById('kanban-board').addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.classList.contains('card-filtered')) {
      card.classList.add('dragging');
      const cardId = card.dataset.cardId;
      const sourceColumnId = card.dataset.columnId;

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        cardId: cardId,
        sourceColumnId: sourceColumnId
      }));

      // カスタムゴースト画像の作成
      const cardRect = card.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = cardRect.width;
      canvas.height = cardRect.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const priorityClass = card.className.match(/priority-\w+/)?.[0] || 'priority-medium';
      const colors = {
        'priority-urgent': '#f25f4c',
        'priority-high': '#eeb534',
        'priority-medium': '#70c4be',
        'priority-low': '#54a2ff'
      };
      ctx.strokeStyle = colors[priorityClass] || '#70c4be';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      if (card.setDragImage) {
        card.setDragImage(canvas, canvas.width / 2, 0);
      }

      // ドラッグ開始時にハイライトをクリア
      document.querySelectorAll('.drag-highlight').forEach(el => el.remove());
    }
  });

  // カードのドロップ設定
  document.querySelectorAll('.column-body').forEach(columnBody => {
    columnBody.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      highlightDropZone(columnBody, e);
    });

    columnBody.addEventListener('dragleave', (e) => {
      if (!columnBody.contains(e.relatedTarget)) {
        clearDropZoneHighlights();
      }
    });

    columnBody.addEventListener('drop', (e) => {
      e.preventDefault();
      clearDropZoneHighlights();

      const draggedCard = document.querySelector('.card.dragging');
      if (!draggedCard) return;

      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const cardId = data.cardId;
      const sourceColumnId = data.sourceColumnId;
      const targetColumnId = columnBody.dataset.columnId;

      // 挿入位置を取得
      const insertIndex = getDropInsertIndex(columnBody, e.clientY);

      // 同じカラム内での移動
      if (sourceColumnId === targetColumnId) {
        reorderCardsWithinColumn(cardId, sourceColumnId, insertIndex);
      } else {
        // 異なるカラムへの移動
        moveCardToColumn(cardId, sourceColumnId, targetColumnId, insertIndex);
      }

      draggedCard.classList.remove('dragging');
      renderBoard();
      updateTagFilters();
    });
  });

  // カラムの並び替え
  kanbanBoard.addEventListener('drop', (e) => {
    e.preventDefault();

    // カラムの並び替え
    const draggedColumn = document.querySelector('.board-column.dragging');
    const targetColumn = e.target.closest('.board-column');

    if (draggedColumn && targetColumn && draggedColumn !== targetColumn) {
      const sourceColumnId = draggedColumn.dataset.columnId;
      const targetColumnId = targetColumn.dataset.columnId;

      reorderColumns(sourceColumnId, targetColumnId);
      draggedColumn.classList.remove('dragging');
      renderBoard();
    }
  });

  // カラムヘッダーのドラッグ終了
  document.querySelectorAll('.column-header').forEach(header => {
    header.addEventListener('dragend', (e) => {
      document.querySelectorAll('.board-column').forEach(col => {
        col.classList.remove('dragging');
      });
      document.querySelectorAll('.drag-column-highlight').forEach(el => {
        el.classList.remove('drag-column-highlight');
      });
    });
  });

  // 初期状態でアンドゥ/リドゥボタンの状態を更新
  updateUndoRedoButtons();
}

// アンドゥ/リドゥボタンの状態更新
function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const undoStack = dm.state.undoStack;
  const undoIndex = dm.state.undoIndex;

  undoBtn.disabled = undoIndex <= 0;
  redoBtn.disabled = undoIndex >= undoStack.length - 1;
}

// ドロップ時の挿入位置を計算
function getDropInsertIndex(columnBody, mouseY) {
  const cards = Array.from(columnBody.querySelectorAll('.card:not(.dragging)'));
  let insertIndex = cards.length;

  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const center = rect.top + rect.height / 2;

    if (mouseY < center) {
      insertIndex = i;
      break;
    }
  }

  return insertIndex;
}

// ドロップハイライト
function highlightDropZone(columnBody, e) {
  clearDropZoneHighlights();

  const cards = Array.from(columnBody.querySelectorAll('.card:not(.dragging)'));
  const mouseY = e.clientY;

  let insertIndex = cards.length;

  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const center = rect.top + rect.height / 2;

    if (mouseY < center) {
      insertIndex = i;
      break;
    }
  }

  const highlight = document.createElement('div');
  highlight.className = 'drag-highlight';
  highlight.dataset.insertIndex = insertIndex;

  if (insertIndex < cards.length) {
    columnBody.insertBefore(highlight, cards[insertIndex]);
  } else {
    columnBody.appendChild(highlight);
  }
}

// ドロップハイライトをクリア
function clearDropZoneHighlights() {
  const highlights = document.querySelectorAll('.drag-highlight');
  highlights.forEach(el => el.remove());
}

// ボードの描画
function renderBoard() {
  const board = dm.state.boards[dm.state.activeBoard];
  const kanbanBoard = document.getElementById('kanban-board');
  kanbanBoard.innerHTML = board.columns.map(colId => ui.generateColumnHTML(colId)).join('');

  // カラムヘッダーの編集機能の設定
  document.querySelectorAll('.column-title-editable').forEach(el => {
    el.addEventListener('blur', (e) => {
      const columnId = e.target.closest('.board-column').dataset.columnId;
      dm.updateColumn(columnId, { name: e.target.innerText });
    });
  });

  // 新規カードボタンの設定
  document.querySelectorAll('.column-footer').forEach(btn => {
    btn.addEventListener('click', () => {
      const columnId = btn.closest('.board-column').dataset.columnId;
      openNewCardModal(columnId);
    });
  });

  // カラム操作ボタンの設定
  document.querySelectorAll('.column-rename-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const columnId = btn.closest('.board-column').dataset.columnId;
      renameColumn(columnId);
    });
  });

  document.querySelectorAll('.column-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const columnId = btn.closest('.board-column').dataset.columnId;
      deleteColumn(columnId);
    });
  });

  // フィルターのリセット
  applyAllFilters();
}

// カラムの名前変更
function renameColumn(columnId) {
  const board = dm.state.boards[dm.state.activeBoard];
  const column = board.columnsData[columnId];
  const newName = prompt('カラムの新しい名前を入力してください:', column.name);
  if (newName !== null && newName.trim() !== '') {
    dm.updateColumn(columnId, { name: newName.trim() });
    renderBoard();
  }
}

// カラムの削除
function deleteColumn(columnId) {
  const board = dm.state.boards[dm.state.activeBoard];
  const column = board.columnsData[columnId];

  if (confirm(`カラム「${column.name}」とその中の${column.cards.length}個のカードを削除しますか？`)) {
    if (dm.deleteColumn(columnId)) {
      renderBoard();
      resetFilters();
    }
  }
}

// 新規カラムの追加
function addNewColumn() {
  const name = prompt('新しいカラムの名前を入力してください:', '新しいカラム');
  if (name) {
    dm.addColumn(name);
    renderBoard();
  }
}

// フィルターの適用
function applyAllFilters() {
  const filters = ui.getCurrentFilters();
  const cardIds = Object.keys(dm.state.boards[dm.state.activeBoard].cardsData);

  const filteredCardIds = applyFiltersFast(cardIds);
  const filteredCardIdsSet = new Set(filteredCardIds);

  // フィルターに一致しないカードは非表示にする
  document.querySelectorAll('.card').forEach(card => {
    if (!filteredCardIdsSet.has(card.dataset.cardId)) {
      card.style.display = 'none';
    } else {
      card.style.display = 'block';
    }
  });
}

// フィルターのリセット
function resetFilters() {
  ui.filters.text = '';
  ui.filters.priority = 'all';
  ui.filters.dueDate = 'all';
  ui.filters.tags = [];

  document.getElementById('search-input').value = '';
  document.querySelectorAll('.filter-chip.active').forEach(chip => {
    chip.classList.remove('active');
  });
  document.querySelector('.filter-chip[data-value="all"][data-filter="priority"]').classList.add('active');
  document.querySelector('.filter-chip[data-value="all"][data-filter="date"]').classList.add('active');
  document.querySelector('.filter-chip[data-value="all"][data-filter="tag"]').classList.add('active');

  applyAllFilters();
}

// タグフィルターの更新
function updateTagFilters() {
  const tagFiltersContainer = document.getElementById('tag-filters');
  const existingChips = tagFiltersContainer.querySelectorAll('.filter-chip:not([data-value="all"])');
  existingChips.forEach(chip => chip.remove());

  const allTags = dm.getAllTags();
  allTags.forEach(tag => {
    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.dataset.filter = 'tag';
    chip.dataset.value = tag;
    chip.dataset.label = tag;
    chip.textContent = tag;
    chip.addEventListener('click', (e) => {
      if (ui.filters.tags.includes(tag)) {
        ui.filters.tags = ui.filters.tags.filter(t => t !== tag);
        chip.classList.remove('active');
      } else {
        ui.filters.tags.push(tag);
        chip.classList.add('active');
      }
      applyAllFilters();
    });
    tagFiltersContainer.appendChild(chip);
  });
}

// ============================================
// ボード操作関数
// ============================================

// 新しいボードの作成
function createNewBoard() {
  const name = prompt('ボードの名前を入力してください:', '新しいボード');
  if (name) {
    const newBoard = dm.addBoard(name);
    renderBoard();
    renderBoardSelector();
  }
}

// ボードの削除
function deleteCurrentBoard() {
  const currentBoardId = dm.state.activeBoard;
  const currentBoardName = dm.state.boards[currentBoardId].name;

  if (confirm(`ボード「${currentBoardName}」を削除しますか？`)) {
    const result = dm.deleteBoard(currentBoardId);
    if (result.success) {
      renderBoard();
      renderBoardSelector();
    } else {
      alert(result.message);
    }
  }
}

// ボードセレクターの更新
function renderBoardSelector() {
  const selector = document.getElementById('board-select');
  selector.innerHTML = '';

  Object.values(dm.state.boards).forEach(board => {
    const option = document.createElement('option');
    option.value = board.id;
    option.textContent = board.name;
    if (board.id === dm.state.activeBoard) {
      option.selected = true;
    }
    selector.appendChild(option);
  });
}

// ボード選択時の処理
function selectBoard(boardId) {
  dm.state.activeBoard = boardId;
  dm.save();
  renderBoard();
  resetFilters();
}

// 新規カードフォームの送信
document.getElementById('new-card-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const columnId = null; // デフォルトの最初のカラム

  const cardData = {
    title: document.getElementById('card-title').value.trim(),
    description: document.getElementById('card-description').value.trim(),
    dueDate: document.getElementById('card-due-date').value,
    priority: document.getElementById('card-priority').value,
    tags: document.getElementById('card-tags').value,
    assignee: document.getElementById('card-assignee').value.trim()
  };

  if (!cardData.title) {
    alert('タイトルは必須です');
    return;
  }

  // カードの追加
  dm.addCard(cardData);
  const newModal = document.getElementById('new-card-modal');
  newModal.classList.remove('show');
  document.getElementById('new-card-form').reset();
  renderBoard();
  updateTagFilters();
  resetFilters();
});

// 編集フォームの送信
document.getElementById('edit-card-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const cardId = document.getElementById('edit-card-id').value;

  const cardData = {
    title: document.getElementById('edit-card-title').value.trim(),
    description: document.getElementById('edit-card-description').value.trim(),
    dueDate: document.getElementById('edit-card-due-date').value,
    priority: document.getElementById('edit-card-priority').value,
    tags: document.getElementById('edit-card-tags').value,
    assignee: document.getElementById('edit-card-assignee').value.trim()
  };

  if (!cardData.title) {
    alert('タイトルは必須です');
    return;
  }

  // チェックリストの更新
  const checklistItems = [];
  document.querySelectorAll('#edit-checklist .checklist-item').forEach(item => {
    const text = item.querySelector('.checklist-item-text').value;
    const completed = item.querySelector('.checklist-checkbox').checked;
    if (text) {
      checklistItems.push({ text, completed });
    }
  });

  // カードの更新
  dm.updateCard(cardId, cardData);
  const card = dm.state.boards[dm.state.activeBoard].cardsData[cardId];
  card.checklist = checklistItems;
  dm.save();

  const editModal = document.getElementById('edit-card-modal');
  editModal.classList.remove('show');
  renderBoard();
  updateTagFilters();
});

// カード削除ボタン
document.getElementById('delete-card-btn').addEventListener('click', () => {
  const cardId = document.getElementById('edit-card-id').value;
  if (confirm('このカードを削除しますか？')) {
    dm.deleteCard(cardId);
    const editModal = document.getElementById('edit-card-modal');
    editModal.classList.remove('show');
    renderBoard();
    updateTagFilters();
  }
});

// カードアーカイブボタン
document.getElementById('archive-card-btn').addEventListener('click', () => {
  const cardId = document.getElementById('edit-card-id').value;
  dm.toggleArchive(cardId);
  const editModal = document.getElementById('edit-card-modal');
  editModal.classList.remove('show');
  renderBoard();
  updateTagFilters();
});

// チェックリスト項目の追加
document.getElementById('add-checklist-item').addEventListener('click', () => {
  const container = document.getElementById('edit-checklist');
  const index = container.children.length;
  container.innerHTML += `
    <div class="checklist-item" data-checklist-index="${index}">
      <input type="checkbox" class="checklist-checkbox">
      <input type="text" class="checklist-item-text" placeholder="新しい項目...">
      <button class="btn-small checklist-item-remove" title="削除">×</button>
    </div>
  `;
});

// チェックリスト項目の削除（イベント委譲）
document.getElementById('edit-checklist').addEventListener('click', (e) => {
  if (e.target.classList.contains('checklist-item-remove')) {
    e.target.closest('.checklist-item').remove();
  }
});

// チェックリスト項目のチェック切り替え（イベント委譲）
document.getElementById('edit-checklist').addEventListener('change', (e) => {
  if (e.target.classList.contains('checklist-checkbox')) {
    const item = e.target.closest('.checklist-item');
    item.classList.toggle('completed');
  }
});

// ボード操作ボタン
document.getElementById('new-board-btn').addEventListener('click', createNewBoard);
document.getElementById('delete-board-btn').addEventListener('click', deleteCurrentBoard);

// ボード選択の変更
document.getElementById('board-select').addEventListener('change', (e) => {
  selectBoard(e.target.value);
});

// フィルタークリアボタン
document.getElementById('clear-filters-btn').addEventListener('click', resetFilters);

// アンドゥボタン
document.getElementById('undo-btn').addEventListener('click', () => {
  if (dm.undo()) {
    renderBoard();
    resetFilters();
  }
});

// リドゥボタン
document.getElementById('redo-btn').addEventListener('click', () => {
  if (dm.redo()) {
    renderBoard();
    resetFilters();
  }
});

// 新規カラム追加ボタン
document.getElementById('add-column-btn').addEventListener('click', () => {
  const name = prompt('新しいカラムの名前を入力してください:', '新しいカラム');
  if (name) {
    dm.addColumn(name);
    renderBoard();
    updateTagFilters();
  }
});

// エクスポートボタン
document.getElementById('export-btn').addEventListener('click', () => {
  const board = dm.state.boards[dm.state.activeBoard];
  const data = Storage.exportBoard(dm.state.activeBoard, dm.state.boards);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${board.name}_export.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// インポートボタン
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-modal').classList.add('show');
});

// インポート確認
document.getElementById('import-confirm-btn').addEventListener('click', () => {
  let data = null;

  // ファイル入力から読み込み
  const fileInput = document.getElementById('import-file-input');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        data = JSON.parse(e.target.result);
        processImport(data);
      } catch (err) {
        alert('JSONの形式が正しくありません');
      }
    };
    reader.readAsText(file);
  } else if (document.getElementById('import-textarea').value.trim()) {
    // テキスト入力から読み込み
    try {
      data = JSON.parse(document.getElementById('import-textarea').value);
      processImport(data);
    } catch (err) {
      alert('JSONの形式が正しくありません');
    }
  }
});

// インポート処理
function processImport(importedData) {
  const result = Storage.importBoard(importedData, dm.state.boards);
  if (result.success) {
    dm.state.boards = result.boards;
    dm.state.activeBoard = result.boardId;
    dm.save();
    renderBoard();
    renderBoardSelector();
    const importModal = document.getElementById('import-modal');
    importModal.classList.remove('show');
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-textarea').value = '';
    alert('インポートが完了しました');
  } else {
    alert(`インポートに失敗しました: ${result.error}`);
  }
}

// ファイル入力の変更
document.getElementById('import-file-input').addEventListener('change', () => {
  if (document.getElementById('import-file-input').files.length > 0) {
    document.getElementById('import-textarea').value = '';
  }
});

// 新規カードモーダルを開く
function openNewCardModal(columnId = null) {
  // フォームデータをリセット
  document.getElementById('new-card-form').reset();
  document.getElementById('new-card-form').style.display = 'block';
  document.getElementById('edit-card-form').style.display = 'none';
  const modal = document.getElementById('new-card-modal');
  modal.classList.add('show');
  document.getElementById('card-title').focus();
}

// 編集モーダルを開く
function openEditCardModal(cardId) {
  const board = dm.state.boards[dm.state.activeBoard];
  const card = board.cardsData[cardId];

  if (!card) return;

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-card-title').value = card.title;
  document.getElementById('edit-card-description').value = card.description || '';
  document.getElementById('edit-card-due-date').value = card.dueDate || '';
  document.getElementById('edit-card-priority').value = card.priority;
  // tagsが配列でない場合は空文字として扱う
  document.getElementById('edit-card-tags').value = Array.isArray(card.tags) ? card.tags.join(', ') : '';
  document.getElementById('edit-card-assignee').value = card.assignee || '';

  // チェックリストの描画
  const checklistContainer = document.getElementById('edit-checklist');
  checklistContainer.innerHTML = card.checklist.map((task, index) => `
    <div class="checklist-item ${task.completed ? 'completed' : ''}" data-checklist-index="${index}">
      <input type="checkbox" class="checklist-checkbox" ${task.completed ? 'checked' : ''}>
      <input type="text" class="checklist-item-text" value="${ui.escapeHtml(task.text)}">
      <button class="btn-small checklist-item-remove" title="削除">×</button>
    </div>
  `).join('');

  // コメントの描画
  updateCommentsInModal(cardId);

  const editModal = document.getElementById('edit-card-modal');
  editModal.classList.add('show');
  document.getElementById('edit-card-title').focus();
}

// モーダル内のコメント更新
function updateCommentsInModal(cardId) {
  const board = dm.state.boards[dm.state.activeBoard];
  const card = board.cardsData[cardId];
  const commentsContainer = document.getElementById('edit-comments');

  commentsContainer.innerHTML = card.comments.map((comment, index) => `
    <div class="checklist-item comment-item" data-comment-index="${index}">
      <span class="comment-author">${ui.escapeHtml(comment.author || 'Unknown')}</span>
      <span class="comment-text">${ui.escapeHtml(comment.text)}</span>
      <span class="comment-date">${formatDate(comment.createdAt)}</span>
      <button class="btn-small checklist-item-remove" title="削除">×</button>
    </div>
  `).join('');

  // コメント削除のイベント追加
  commentsContainer.querySelectorAll('.checklist-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const commentIndex = e.target.closest('.checklist-item').dataset.commentIndex;
      card.comments.splice(commentIndex, 1);
      card.updatedAt = new Date().toISOString();
      dm.save();
      renderBoard();
      updateCommentsInModal(cardId);
    });
  });
}

// イベントリスナーの設定
function setupEventListeners() {
  // テーマ切替
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const newTheme = dm.toggleTheme();
    if (newTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  });

  // フィルター操作
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const filter = e.target.dataset.filter;
      const value = e.target.dataset.value;

      if (filter === 'tag' && value !== 'all') {
        // タグの場合は複数選択可能
        if (ui.filters.tags.includes(value)) {
          ui.filters.tags = ui.filters.tags.filter(t => t !== value);
        } else {
          ui.filters.tags.push(value);
        }
      } else {
        // それ以外は単一選択
        ui.filters[filter] = value;
      }

      applyAllFilters();
    });
  });

  // 検索
  document.getElementById('search-input').addEventListener('input', (e) => {
    ui.filters.text = e.target.value;
    applyAllFilters();
  });

  // キーボードショートカット
  document.addEventListener('keydown', (e) => {
    // モーダルが開いている場合は無視
    if (document.querySelector('.modal.show')) return;

    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openNewCardModal();
    } else if (e.key === '/') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input');
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(modal => {
        modal.classList.remove('show');
      });
    }
  });

  // ボタン操作
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.target.dataset.close;
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('show');
      }
    });
  });

  // モーダルオーバーレイのクリックで閉じる
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      const modal = overlay.closest('.modal');
      if (modal && modal.classList.contains('show')) {
        modal.classList.remove('show');
      }
    });
  });

  // カード編集ボタン
  document.getElementById('kanban-board').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.card-edit-btn');
    if (editBtn) {
      const cardId = editBtn.closest('.card').dataset.cardId;
      openEditCardModal(cardId);
    }

    // カードタイトル編集の blur イベント
    const titleEdit = e.target.closest('.card-title-editable');
    if (titleEdit && e.type === 'blur') {
      const card = titleEdit.closest('.card');
      const cardId = card.dataset.cardId;
      const newTitle = titleEdit.innerText.trim();
      if (newTitle && newTitle !== dm.state.boards[dm.state.activeBoard].cardsData[cardId].title) {
        dm.updateCard(cardId, { title: newTitle });
      }
    }

    // チェックリストのチェック切り替え
    if (e.target.classList.contains('checklist-checkbox')) {
      const checklistItem = e.target.closest('.checklist-item');
      const index = checklistItem.dataset.checklistIndex;
      const cardId = e.target.closest('.card').dataset.cardId;
      const card = dm.state.boards[dm.state.activeBoard].cardsData[cardId];
      card.checklist[index].completed = e.target.checked;
      card.updatedAt = new Date().toISOString();
      dm.save();
      renderBoard();
    }

    // チェックリスト項目の削除
    if (e.target.classList.contains('checklist-item-remove')) {
      const checklistItem = e.target.closest('.checklist-item');
      const index = checklistItem.dataset.checklistIndex;
      const cardId = e.target.closest('.card').dataset.cardId;
      const card = dm.state.boards[dm.state.activeBoard].cardsData[cardId];
      card.checklist.splice(index, 1);
      card.updatedAt = new Date().toISOString();
      dm.save();
      renderBoard();
    }

    // チェックリスト項目の追加
    if (e.target.classList.contains('checklist-add-btn')) {
      const cardId = e.target.closest('.card').dataset.cardId;
      const card = dm.state.boards[dm.state.activeBoard].cardsData[cardId];
      card.checklist.push({ text: '新しい項目', completed: false });
      card.updatedAt = new Date().toISOString();
      dm.save();
      renderBoard();
    }

    // コメント追加ボタン
    if (e.target.id === 'add-comment-btn') {
      const commentInput = document.getElementById('new-comment');
      const commentText = commentInput.value.trim();
      if (commentText) {
        const cardId = document.getElementById('edit-card-id').value;
        const card = dm.state.boards[dm.state.activeBoard].cardsData[cardId];
        const commentId = Storage.generateId('comment');
        card.comments.push({
          id: commentId,
          author: 'あなた',
          text: commentText,
          createdAt: new Date().toISOString()
        });
        card.updatedAt = new Date().toISOString();
        dm.save();
        renderBoard();
        commentInput.value = '';
        updateCommentsInModal(cardId);
      }
    }
  });
}

// ============================================
// DnD関連のグローバル関数
// ============================================

// カードをカラム間で移動
function moveCardToColumn(cardId, sourceColumnId, targetColumnId, insertIndex) {
  const board = dm.state.boards[dm.state.activeBoard];

  // 元のカラムから削除
  const sourceColumn = board.columnsData[sourceColumnId];
  const cardIndex = sourceColumn.cards.indexOf(cardId);
  if (cardIndex > -1) {
    sourceColumn.cards.splice(cardIndex, 1);
  }

  // 新しいカラムに挿入
  const targetColumn = board.columnsData[targetColumnId];
  const targetIndex = insertIndex !== undefined ? insertIndex : targetColumn.cards.length;

  if (targetIndex >= 0 && targetIndex <= targetColumn.cards.length) {
    targetColumn.cards.splice(targetIndex, 0, cardId);
    dm.pushUndoState();
    dm.save();
    return true;
  }

  return false;
}

// 同一カラム内の並び替え
function reorderCardsWithinColumn(cardId, columnId, newIndex) {
  const board = dm.state.boards[dm.state.activeBoard];
  const column = board.columnsData[columnId];

  // 現在の位置を削除
  const currentIndex = column.cards.indexOf(cardId);
  if (currentIndex > -1) {
    column.cards.splice(currentIndex, 1);
  }

  // 新しい位置に挿入
  const targetIndex = newIndex !== undefined ? newIndex : column.cards.length;
  column.cards.splice(targetIndex, 0, cardId);
  dm.pushUndoState();
  dm.save();
}

// カラムの並び替え
function reorderColumns(sourceColumnId, targetColumnId) {
  const board = dm.state.boards[dm.state.activeBoard];
  const sourceIndex = board.columns.indexOf(sourceColumnId);
  const targetIndex = board.columns.indexOf(targetColumnId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  // 元の位置から削除
  board.columns.splice(sourceIndex, 1);

  // 新しい位置に挿入（ターゲットの後に挿入）
  board.columns.splice(targetIndex, 0, sourceColumnId);

  dm.pushUndoState();
  dm.save();
}

// モジュールエクスポート
// ============================================

// 日付のフォーマット関数
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataManager, UIManager };
}
