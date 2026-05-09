# カンバンボード実装計画

## 1. プロジェクト構成

```
kanban-board/
├── index.html          # メインHTML（シングルページ構成）
├── styles/
│   ├── main.css        # ベーススタイル
│   ├── dark-theme.css  # ダークテーマ
│   └── animations.css  # アニメーション定義
└── script/
    ├── app.js          # アプリケーション本体
    ├── storage.js      # localStorage管理
    ├── dragDrop.js     # DnDロジック
    ├── filter.js       # フィルター機能
    ├── modal.js        # モーダル管理
    ├── undo.js         # アンドゥ機能
    └── exportImport.js # エクスポート/インポート
```

## 2. データ構造設計

```javascript
// カードデータ
{
  id: string,           // UUID
  title: string,        // タイトル（必須）
  description: string,  // 説明（Markdown対応）
  dueDate: string|null, // ISO 8601形式
  priority: 'low'|'medium'|'high'|'urgent',
  tags: string[],       // タグ配列
  assignee: string|null,// 担当者名
  checklist: [          // サブタスク
    { id: string, text: string, completed: boolean }
  ],
  comments: [           // コメント履歴
    { id: string, author: string, text: string, createdAt: string }
  ],
  archived: boolean,    // アーカイブ済みフラグ
  createdAt: string,    // 作成日時
  updatedAt: string     // 更新日時
}

// カラムデータ
{
  id: string,
  name: string,
  wipLimit: number|null, // WIP制限（null=制限なし）
  cards: string[],       // カードIDの配列（順序保持）
  order: number
}

// ボードデータ
{
  id: string,
  name: string,
  columns: string[],     // カラムIDの配列
  columnsData: { [columnId]: Column },
  cardsData: { [cardId]: Card },
  order: number
}

// 全データ
{
  boards: { [boardId]: Board },
  activeBoard: string|null,
  theme: 'light'|'dark',
  undoStack: any[],      // アンドゥ履歴
  undoIndex: number      // 現在位置
}
```

## 3. 実装タスク一覧

### Phase 1: 基盤構築
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P1-1 | HTML構造作成（モーダル、カラムテンプレート） | index.html | 30分 |
| P1-2 | CSSベーススタイル（グリッド、カラムレイアウト） | styles/main.css | 45分 |
| P1-3 | 初期データ構造とデフォルトデータ生成 | script/app.js | 30分 |
| P1-4 | localStorage永続化基盤 | script/storage.js | 20分 |

### Phase 2: ボード基本機能
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P2-1 | ボード管理（追加・削除・切り替え） | script/app.js | 30分 |
| P2-2 | カラム操作（追加・削除・名前変更・並び替え） | script/app.js | 45分 |
| P2-3 | カラムごとのカード数バッジ表示 | index.html + CSS | 15分 |
| P2-4 | WIP制限警告表示 | CSS + JS | 20分 |

### Phase 3: カード管理
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P3-1 | カード作成（タイトル必須、詳細入力） | script/app.js | 30分 |
| P3-2 | モーダルUI実装 | modal.js + HTML | 40分 |
| P3-3 | カード編集機能 | script/app.js | 25分 |
| P3-4 | カード複製・削除 | script/app.js | 15分 |
| P3-5 | アーカイブ機能 | script/app.js | 15分 |
| P3-6 | Markdownパーサー（simple-markdown等軽量実装） | script/app.js | 30分 |

### Phase 4: チェックリスト・コメント
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P4-1 | サブタスク（チェックリスト）管理 | script/app.js | 25分 |
| P4-2 | コメント履歴の追加・表示 | script/app.js | 25分 |

### Phase 5: ドラッグ＆ドロップ（HTML5 API）
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P5-1 | Drag & Dropイベントハンドラ実装 | script/dragDrop.js | 60分 |
| P5-2 | カード間並び替え（同一・跨ぎ） | script/dragDrop.js | 45分 |
| P5-3 | カラム間並び替え | script/dragDrop.js | 30分 |
| P5-4 | カラム自体のドラッグ並び替え | script/dragDrop.js | 40分 |
| P5-5 | ビジュアルフィードバック（ゴースト・ハイライト） | animations.css | 30分 |

### Phase 6: 絞り込み・検索
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P6-1 | テキスト検索（全フィールド横断） | script/filter.js | 30分 |
| P6-2 | タグによる絞り込み（複数選択） | script/filter.js | 30分 |
| P6-3 | 優先度・担当者絞り込み | script/filter.js | 20分 |
| P6-4 | 期日クイックフィルタ（今日/今週/期限切れ） | script/filter.js | 25分 |
| P6-5 | フィルター適用中の視覚表現（非表示/淡色化） | CSS | 20分 |

### Phase 7: データ管理
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P7-1 | JSONエクスポート | script/exportImport.js | 20分 |
| P7-2 | JSONインポート | script/exportImport.js | 20分 |
| P7-3 | 複数ボード管理UI | index.html + JS | 30分 |
| P7-4 | アンドゥ機能（履歴スタック） | script/undo.js | 45分 |

### Phase 8: UI/UX改善
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P8-1 | キーボードショートカット実装 | script/app.js | 30分 |
| P8-2 | ダーク/ライトテーマ切り替え | styles/dark-theme.css + JS | 25分 |
| P8-3 | アニメーション追加（card-add, card-remove, card-move） | animations.css | 30分 |
| P8-4 | タグのカラフルチップ表示 | CSS | 15分 |
| P8-5 | 優先度の色分け | CSS | 10分 |

### Phase 9: 最適化・テスト
| ID | タスク | ファイル | 予定時間 |
|----|--------|----------|----------|
| P9-1 | 大量カード（50+）対応のパフォーマンス調整 | script/dragDrop.js | 45分 |
| P9-2 | フィルター×DnDの整合性テスト | - | 30分 |
| P9-3 | レスポンシブデザイン調整 | CSS | 30分 |
| P9-4 | エクスポート/インポート完全復元テスト | - | 20分 |

## 4. 技術的詳細

### HTML5 Drag and Drop API 使用方法

```javascript
// カードのドラッグ開始
card.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('cardId', card.id);
  e.dataTransfer.setData('sourceColumnId', column.id);
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});

// カラムへのドロップ許可
column.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // 挿入位置のハイライト
});

// ドロップ時の移動処理
column.addEventListener('drop', (e) => {
  e.preventDefault();
  const cardId = e.dataTransfer.getData('cardId');
  const sourceColumnId = e.dataTransfer.getData('sourceColumnId');
  handleCardMove(cardId, sourceColumnId, targetColumnId, insertIndex);
});
```

### フィルタリングロジック

```javascript
function applyFilters(cards, filters) {
  return cards.filter(card => {
    // テキスト検索
    if (filters.text) {
      const searchLower = filters.text.toLowerCase();
      const matchesTitle = card.title.toLowerCase().includes(searchLower);
      const matchesDesc = card.description?.toLowerCase().includes(searchLower);
      const matchesTags = card.tags.some(t => t.toLowerCase().includes(searchLower));
      const matchesComments = card.comments?.some(c => 
        c.text.toLowerCase().includes(searchLower)
      );
      if (!matchesTitle && !matchesDesc && !matchesTags && !matchesComments) {
        return false;
      }
    }
    // 他のフィルター条件...
    return true;
  });
}
```

### アンドゥ機能実装

```javascript
function pushUndoState() {
  undoStack = undoStack.slice(0, undoIndex + 1);
  undoStack.push(cloneDeep(currentState));
  undoIndex = undoStack.length - 1;
  saveState();
}

function undo() {
  if (undoIndex > 0) {
    undoIndex--;
    currentState = cloneDeep(undoStack[undoIndex]);
    render();
  }
}

function redo() {
  if (undoIndex < undoStack.length - 1) {
    undoIndex++;
    currentState = cloneDeep(undoStack[undoIndex]);
    render();
  }
}
```

## 5. 実装順序（推奨）

1. **Phase 1 → 2 → 3**（基本構造とカード操作）
2. **Phase 4**（モーダルとチェックリスト）
3. **Phase 5**（DnDは複雑なため集中して実装）
4. **Phase 6**（フィルター機能）
5. **Phase 7**（データ管理）
6. **Phase 8**（UI/UX改善）
7. **Phase 9**（最適化とテスト）

## 6. 注意点

- **DnDとフィルターの組み合わせ**: フィルター適用中は非表示になるカードをDnDで移動しないように制御
- **WIP制限**: カード追加時・移動時に制限をチェックし、超える場合は警告
- **Markdownパーサー**: 安全性を確保するため軽量な実装またはDOMsanitizeを使用
- **localStorage制限**: 約5MB制限のため、巨大なデータは注意
- **UUID生成**: 重複を避けるため `crypto.randomUUID()` を使用

## 7. 予定工数

- 合計: 約 8-10 時間
- 前半（Phase 1-4）: 3-4 時間
- 中盤（Phase 5-6）: 3-4 時間（DnDが意外に手間取る）
- 後半（Phase 7-9）: 2-3 時間

## 8. テスト項目

- [ ] カラムの追加・削除・名前変更・並び替え
- [ ] カードのCRUD操作
- [ ] カードのアーカイブ/復元
- [ ] カードのドラッグ＆ドロップ（同一・跨ぎ）
- [ ] カラムのドラッグ並び替え
- [ ] WIP制限警告の表示
- [ ] タグ・優先度・担当者の絞り込み
- [ ] 期日クイックフィルタ
- [ ] JSONエクスポート/インポート
- [ ] アンドゥ/リドゥ
- [ ] ダーク/ライトテーマ
- [ ] キーボードショートカット
- [ ] レスポンシブ表示（PC/タブレット）
