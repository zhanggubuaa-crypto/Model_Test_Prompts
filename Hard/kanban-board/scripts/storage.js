/* =========================================
   localStorage永続化基盤
   ========================================= */

const Storage = {
  STORAGE_KEY: 'kanban-board-data-v1',

  // 現在の状態を保存
  save(state) {
    try {
      // undoStackのサイズを制限（最新50件のみ保存）
      const maxUndoStack = 50;
      let undoStack = state.undoStack || [];
      if (undoStack.length > maxUndoStack) {
        undoStack = undoStack.slice(-maxUndoStack);
      }
      const undoIndex = Math.min(state.undoIndex || -1, undoStack.length - 1);

      const data = {
        boards: state.boards,
        activeBoard: state.activeBoard,
        theme: state.theme,
        undoStack: undoStack,
        undoIndex: undoIndex
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('保存エラー:', error);
      // 容量オーバーの場合はエクスポートで保存を促す
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorageの容量制限に達しました。エクスポートしてデータを保存してください。');
      }
      return false;
    }
  },

  // 保存された状態を読み込み
  load() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data);

      // 古いデータ形式の互換性対応
      if (!parsed.boards) {
        // 古い形式（cards配列）から新しい形式へ移行
        return this.migrateOldData(parsed);
      }

      return parsed;
    } catch (error) {
      console.error('読み込みエラー:', error);
      return null;
    }
  },

  // 古いデータ形式の移行
  migrateOldData(oldData) {
    console.log('データ移行を実行...');

    const newBoards = {};
    const columns = [];
    const cardsData = {};

    // 既存のカードを1つのデフォルトカラムに移行
    const defaultColumnId = this.generateId('col');
    columns.push({
      id: defaultColumnId,
      name: 'ToDo',
      wipLimit: null,
      cards: oldData.cards.map(card => {
        const cardId = this.generateId('card');
        cardsData[cardId] = {
          ...card,
          id: cardId,
          checklist: card.checklist || [],
          comments: card.comments || [],
          archived: card.archived || false,
          createdAt: card.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return cardId;
      }),
      order: 0
    });

    newBoards['default'] = {
      id: 'default',
      name: 'My Board',
      columns: [defaultColumnId],
      columnsData: { [defaultColumnId]: columns[0] },
      cardsData: cardsData,
      order: 0
    };

    return {
      boards: newBoards,
      activeBoard: 'default',
      theme: oldData.theme || 'light',
      undoStack: [],
      undoIndex: -1
    };
  },

  // カードのエクスポート（JSON形式）
  exportBoard(boardId, boards) {
    const board = boards[boardId];
    if (!board) return null;

    return JSON.stringify({
      version: 1,
      boardId: boardId,
      name: board.name,
      columns: board.columns.map(colId => board.columnsData[colId]),
      cards: Object.values(board.cardsData),
      exportDate: new Date().toISOString()
    }, null, 2);
  },

  // インポート（JSONデータの検証とマージ）
  importBoard(data, existingBoards) {
    try {
      const imported = typeof data === 'string' ? JSON.parse(data) : data;

      // 検証
      if (!imported.name || !Array.isArray(imported.columns)) {
        throw new Error('不正なデータ形式です');
      }

      const newBoardId = this.generateId('board');
      const newBoard = {
        id: newBoardId,
        name: imported.name,
        columns: [],
        columnsData: {},
        cardsData: {},
        order: Object.keys(existingBoards).length
      };

      // カラムを移行（既存のIDを再利用しない）
      const columnIdMap = {};

      imported.columns.forEach((col, index) => {
        const newColId = this.generateId('col');
        columnIdMap[col.id || index] = newColId;

        // カードIDも新しく生成
        const newCards = col.cards.map(card => {
          const newCardId = this.generateId('card');
          newBoard.cardsData[newCardId] = {
            ...card,
            id: newCardId,
            createdAt: card.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          return newCardId;
        });

        newBoard.columnsData[newColId] = {
          id: newColId,
          name: col.name,
          wipLimit: col.wipLimit,
          cards: newCards,
          order: index
        };
        newBoard.columns.push(newColId);
      });

      existingBoards[newBoardId] = newBoard;

      return {
        success: true,
        boardId: newBoardId,
        boards: existingBoards
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ID生成（短いUUID風）
  generateId(prefix) {
    const random = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}${random}`;
  },

  // ブラウザのストレージ容量を確認
  checkStorageCapacity() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  // 現在の使用容量を推定
  getStorageUsage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return 0;
      return new Blob([data]).size;
    } catch (e) {
      return 0;
    }
  },

  // クリア
  clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('クリアエラー:', error);
      return false;
    }
  }
};

// モジュールエクスポート（CommonJS）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
