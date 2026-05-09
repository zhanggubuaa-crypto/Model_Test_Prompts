/* =========================================
   ドラッグ＆ドロップ機能
   HTML5 Drag and Drop APIを使用
   ========================================= */

class DragDropManager {
  constructor(dataManager, uiManager, renderCallback) {
    this.dm = dataManager;
    this.ui = uiManager;
    this.renderCallback = renderCallback;
    this.draggedCard = null;
    this.draggedColumn = null;
    this.dragSourceColumn = null;
    this.dropTarget = null;
    this.dropPosition = null;
    this.insertIndex = null;
  }

  // カードのドラッグ設定
  setupCardDrag(cardElement) {
    this.draggedCard = cardElement;
    this.dragSourceColumn = cardElement.dataset.columnId;
    cardElement.classList.add('dragging');

    // カスタムゴースト画像の作成
    const cardRect = cardElement.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = cardRect.width;
    canvas.height = cardRect.height;
    const ctx = canvas.getContext('2d');

    // ゴーストの背景（半透明のカード）
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 色の枠線を描画
    const priorityClass = cardElement.className.match(/priority-\w+/)?.[0] || 'priority-medium';
    const colors = {
      'priority-urgent': '#f25f4c',
      'priority-high': '#eeb534',
      'priority-medium': '#70c4be',
      'priority-low': '#54a2ff'
    };
    ctx.strokeStyle = colors[priorityClass] || '#70c4be';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // ゴースト画像を設定
    if (cardElement.setDragImage) {
      cardElement.setDragImage(canvas, canvas.width / 2, 0);
    }

    // ドラッグデータ
    const cardId = cardElement.dataset.cardId;
    const sourceColumnId = this.dragSourceColumn;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        cardId: cardId,
        sourceColumnId: sourceColumnId
      }));
    }

    // カードの位置を記憶
    this.insertIndex = this.getCardIndexInColumn(cardElement);
  }

  // カードのドロップ設定
  setupCardDrop(columnBody) {
    columnBody.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.highlightDropZone(columnBody, e);
    });

    columnBody.addEventListener('dragleave', (e) => {
      if (!columnBody.contains(e.relatedTarget)) {
        this.clearDropZoneHighlights();
      }
    });

    columnBody.addEventListener('drop', (e) => {
      e.preventDefault();
      this.clearDropZoneHighlights();

      if (!this.draggedCard) return;

      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const cardId = data.cardId;
      const sourceColumnId = data.sourceColumnId;
      const targetColumnId = columnBody.dataset.columnId;

      // 同じカラム内での移動
      if (sourceColumnId === targetColumnId) {
        this.reorderCardsWithinColumn(cardId, sourceColumnId, this.insertIndex);
      } else {
        // 異なるカラムへの移動
        this.moveCardToColumn(cardId, sourceColumnId, targetColumnId, this.insertIndex);
      }

      this.draggedCard = null;
      this.renderCallback();
    });
  }

  // カラムのドラッグ設定
  setupColumnDrag(columnElement) {
    columnElement.addEventListener('dragstart', (e) => {
      this.draggedColumn = columnElement;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', columnElement.dataset.columnId);
      columnElement.classList.add('dragging');
    });

    columnElement.addEventListener('dragend', (e) => {
      columnElement.classList.remove('dragging');
      this.draggedColumn = null;
      this.clearColumnHighlights();
    });
  }

  // カラムのドロップ先設定
  setupColumnDrop(targetColumn) {
    targetColumn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.highlightColumn(targetColumn);
    });

    targetColumn.addEventListener('dragleave', (e) => {
      this.clearColumnHighlights();
    });

    targetColumn.addEventListener('drop', (e) => {
      e.preventDefault();
      this.clearColumnHighlights();

      if (this.draggedColumn) {
        const sourceColumnId = this.draggedColumn.dataset.columnId;
        const targetColumnId = targetColumn.dataset.columnId;

        if (sourceColumnId !== targetColumnId) {
          this.reorderColumns(sourceColumnId, targetColumnId);
        }
      }
    });
  }

  // カードのインデックスを取得
  getCardIndexInColumn(cardElement) {
    const columnBody = cardElement.parentElement;
    const cards = Array.from(columnBody.querySelectorAll('.card:not(.dragging)'));
    return cards.indexOf(cardElement);
  }

  // カラムの並び替え
  reorderColumns(sourceColumnId, targetColumnId) {
    const board = this.dm.state.boards[this.dm.state.activeBoard];
    const sourceIndex = board.columns.indexOf(sourceColumnId);
    const targetIndex = board.columns.indexOf(targetColumnId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // 元の位置から削除
    board.columns.splice(sourceIndex, 1);

    // 新しい位置に挿入（ターゲットの後に挿入）
    board.columns.splice(targetIndex, 0, sourceColumnId);

    this.dm.pushUndoState();
    this.dm.save();
  }

  // カードをカラム間で移動
  moveCardToColumn(cardId, sourceColumnId, targetColumnId, insertIndex) {
    const board = this.dm.state.boards[this.dm.state.activeBoard];

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
      this.dm.pushUndoState();
      this.dm.save();
      return true;
    }

    return false;
  }

  // 同一カラム内の並び替え
  reorderCardsWithinColumn(cardId, columnId, newIndex) {
    const board = this.dm.state.boards[this.dm.state.activeBoard];
    const column = board.columnsData[columnId];

    // 現在の位置を削除
    const currentIndex = column.cards.indexOf(cardId);
    if (currentIndex > -1) {
      column.cards.splice(currentIndex, 1);
    }

    // 新しい位置に挿入
    const targetIndex = newIndex !== undefined ? newIndex : column.cards.length;
    column.cards.splice(targetIndex, 0, cardId);
    this.dm.pushUndoState();
    this.dm.save();
  }

  // ゴースト画像の設定
  setDragImage(cardElement) {
    // HTML5 Drag and Drop のデフォルトゴーストを使用
    // カスタムゴーストを設定する場合:
    // const canvas = document.createElement('canvas');
    // canvas.width = cardElement.offsetWidth;
    // canvas.height = cardElement.offsetHeight;
    // const ctx = canvas.getContext('2d');
    // ctx.fillStyle = '#fff';
    // ctx.fillRect(0, 0, canvas.width, canvas.height);
    // e.dataTransfer.setDragImage(canvas, 0, 0);
  }

  // ドラッグ中のハイライト（カードドロップ先）
  highlightDropZone(columnBody, e) {
    this.clearDropZoneHighlights();

    const cards = Array.from(columnBody.querySelectorAll('.card:not(.dragging)'));
    const mouseY = e.clientY;

    let insertIndex = cards.length;

    // マウスの位置に基づいて挿入位置を計算
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const center = rect.top + rect.height / 2;

      if (mouseY < center) {
        insertIndex = i;
        break;
      }
    }

    // ハイライト要素の追加
    const highlight = document.createElement('div');
    highlight.className = 'drag-highlight';
    highlight.dataset.insertIndex = insertIndex;

    if (insertIndex < cards.length) {
      columnBody.insertBefore(highlight, cards[insertIndex]);
    } else {
      columnBody.appendChild(highlight);
    }

    this.dropTarget = highlight;
  }

  // ドロップゾーンのハイライトをクリア
  clearDropZoneHighlights() {
    const highlights = document.querySelectorAll('.drag-highlight');
    highlights.forEach(el => el.remove());
    this.dropTarget = null;
  }

  // カラムのハイライト
  highlightColumn(columnElement) {
    this.clearColumnHighlights();
    columnElement.classList.add('drag-column-highlight');
  }

  // カラムのハイライトをクリア
  clearColumnHighlights() {
    const columns = document.querySelectorAll('.drag-column-highlight');
    columns.forEach(el => el.classList.remove('drag-column-highlight'));
  }

  // 全てのハイライトをクリア
  clearDragHighlights() {
    this.clearDropZoneHighlights();
    this.clearColumnHighlights();
  }

  // フィルター適用
  applyFilters() {
    this.ui.applyFilters();
  }
}

// モジュールエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DragDropManager };
}
