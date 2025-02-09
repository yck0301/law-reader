import { useEffect, useState } from "react";
import "./App.css";

interface LawArticle {
  ArticleNo: string;
  ArticleContent: string;
}

interface LawData {
  LawName: string;
  LawModifiedDate: string;
  LawArticles: LawArticle[];
}

const formatArticleNo = (articleNo: string) => {
  const match = articleNo.match(/(第)\s*(\d+)\s*(條)/);
  if (!match) return articleNo;

  return (
    <span>
      <span>{match[1]}</span>
      <span className="horizontal-number">{match[2]}</span>
      <span>{match[3]}</span>
    </span>
  );
};

const App = () => {
  const [law, setLaw] = useState<LawData | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRemovingHighlight, setIsRemovingHighlight] = useState<boolean>(false); // 判斷是否顯示「取消標記」

  useEffect(() => {
    fetch("/ChLaw.json")
      .then((res) => res.json())
      .then((json) => {
        if (json.Laws && json.Laws.length > 0) {
          setLaw(json.Laws[0]);
        }
      })
      .catch((err) => console.error("讀取 JSON 失敗", err));

    const disableTextSelectionMenu = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener("mouseup", disableTextSelectionMenu);

    return () => {
      document.removeEventListener("mouseup", disableTextSelectionMenu);
    };
  }, []);

  // 監聽滑鼠選取事件
  const handleMouseUp = () => {
    // 1. 取得目前的選取對象，如果不存在或沒有 Range 則重設 popup 並返回
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.rangeCount === 0) {
      setPopupPosition(null);
      return;
    }

    // 2. 取得第一個 Range 與選取的文字（去除前後空白）
    const range = selectionObj.getRangeAt(0);
    const selectedText = range.toString().trim();
    if (!selectedText) {
      setPopupPosition(null);
      return;
    }

    // 3. 定義一個輔助函數，根據傳入的節點取得該節點所在的高亮元素（若存在）
    const getHighlightElement = (node: Node): HTMLElement | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.parentNode as HTMLElement)?.closest('.highlight');
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        return (node as HTMLElement).closest('.highlight');
      }
      return null;
    };

    // 4. 分別檢查 Range 的起始容器與結束容器是否位於高亮元素內
    const startHighlight = getHighlightElement(range.startContainer);
    const endHighlight = getHighlightElement(range.endContainer);

    // 只要任一端有高亮，就視為選取區域在高亮內
    const isHighlighted = !!(startHighlight || endHighlight);

    // 5. 取得選取範圍的邊界矩形，並計算 popup 要顯示的位置
    const rect = range.getBoundingClientRect();
    setPopupPosition({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY - 30
    });

    // 6. 將是否需要「反高亮」的狀態回傳到外層狀態管理（例如用於顯示相應的按鈕）
    setIsRemovingHighlight(isHighlighted);
  };


  // **🔹 方法：新增標記**
  const applyHighlight = () => {
    // 1. 取得使用者的選取對象與檢查有效性
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.rangeCount === 0) return;

    // 2. 從選取對象中取得第一個 Range，並取得選取文字
    const range = selectionObj.getRangeAt(0);
    const selectedText = range.toString().trim();
    if (!selectedText) return;

    // 3. 取得選取範圍的共同祖先節點
    // 當選取範圍在單一文本節點內時，這個值可能就是那個文本節點
    const commonAncestor = range.commonAncestorContainer;

    // 4. 建立 TreeWalker，只遍歷文本節點
    const walker = document.createTreeWalker(
      commonAncestor,
      NodeFilter.SHOW_TEXT,
      null
    );

    // 5. 透過 TreeWalker 收集所有與選取範圍相交的文本節點
    // 注意：這裡先檢查 walker.currentNode (root) 是否需要處理
    const textNodes: Text[] = [];
    let currentNode: Node | null = walker.currentNode;
    if (currentNode.nodeType === Node.TEXT_NODE && range.intersectsNode(currentNode)) {
      textNodes.push(currentNode as Text);
    }
    // 接著遍歷所有後續的文本節點
    while (walker.nextNode()) {
      currentNode = walker.currentNode;
      if (range.intersectsNode(currentNode)) {
        textNodes.push(currentNode as Text);
      }
    }

    // 6. 對每個收集到的文本節點進行處理：
    // 根據該節點在選取範圍中的位置，可能需要拆分文本節點
    textNodes.forEach((textNode) => {
      // 預設整個文本節點都被選取
      let start = 0;
      let end = textNode.length;
      // 如果該文本節點是 Range 的起始容器，則調整起始偏移量
      if (textNode === range.startContainer) {
        start = range.startOffset;
      }
      // 如果該文本節點是 Range 的結束容器，則調整結束偏移量
      if (textNode === range.endContainer) {
        end = range.endOffset;
      }
      // 若沒有有效的選取範圍則跳過此節點
      if (end <= start) return;

      // 7. 依據是否整個文本節點都在選取範圍內來處理：
      if (start === 0 && end === textNode.length) {
        // (情況一) 整個文本節點皆被選取：
        // 建立一個新的 <span> 並設定 class 為 "highlight"
        const span = document.createElement("span");
        span.className = "highlight";
        span.textContent = textNode.data;
        // 用這個 span 替換原來的文本節點，保留父節點不變
        textNode.parentNode?.replaceChild(span, textNode);
      } else {
        // (情況二) 只有部分文字被選取，需要拆分文本節點：
        // 將文本拆分為三部分：未選取前段、選取中段、未選取後段
        let selectedTextNode = textNode;
        // 如果選取部分不是從文本開頭開始，先拆分前段
        if (start > 0) {
          selectedTextNode = textNode.splitText(start);
        }
        // 如果選取部分沒有延伸到文本末尾，則在選取結束位置拆分
        if (selectedTextNode.length > (end - start)) {
          selectedTextNode.splitText(end - start);
        }
        // 將選取到的部分包裹在 <span class="highlight"> 中
        const span = document.createElement("span");
        span.className = "highlight";
        span.textContent = selectedTextNode.data;
        selectedTextNode.parentNode?.replaceChild(span, selectedTextNode);
      }
    });

    // 8. 清除選取狀態與重設 popup 位置（假設 setPopupPosition 已定義）
    selectionObj.removeAllRanges();
    setPopupPosition(null);
  };


  // **🔹 方法：移除標記**
  const removeHighlight = () => {
    // 1. 取得使用者目前的選取狀態，若無有效 Range 則退出
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.rangeCount === 0) return;

    // 2. 取得第一個 Range 與選取的文字（原始字串可能包含超出高亮區塊的部分）
    const range = selectionObj.getRangeAt(0);
    const selectedString = range.toString();
    if (!selectedString) return;

    // 3. 根據 range 的共同祖先取得容器元素
    //    如果 commonAncestorContainer 不是 Element，則取其 parentElement
    const container: Element | null =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : (range.commonAncestorContainer.parentElement);
    if (!container) return;

    // 4. 從容器中找出所有具有 .highlight 樣式的元素
    //    （注意：這裡會取得所有後代的高亮元素）
    let highlightEls = Array.from(container.querySelectorAll('.highlight')) as HTMLElement[];

    // 4.1 若容器本身就是 .highlight（可能發生在單一節點選取中），也納入處理
    if (container.classList.contains('highlight')) {
      highlightEls.push(container as HTMLElement);
    }

    // 若找不到任何高亮元素則不處理
    if (highlightEls.length === 0) return;

    // 5. 針對每個高亮元素，檢查是否與選取範圍有交集，若有則進行反標記處理
    highlightEls.forEach((highlightEl) => {
      // 若選取範圍與該元素無交集，則略過
      if (!range.intersectsNode(highlightEl)) return;

      // 5.1 建立一個範圍表示該高亮元素全部內容
      const hlRange = document.createRange();
      hlRange.selectNodeContents(highlightEl);

      // 5.2 建立一個新 Range 用來表示選取範圍與高亮元素的交集
      const effectiveRange = document.createRange();
      // 交集起點：取 hlRange.start 與 selection range 的起點中「較後者」
      if (range.compareBoundaryPoints(Range.START_TO_START, hlRange) > 0) {
        effectiveRange.setStart(range.startContainer, range.startOffset);
      } else {
        effectiveRange.setStart(hlRange.startContainer, hlRange.startOffset);
      }
      // 交集終點：取 hlRange.end 與 selection range 的終點中「較前者」
      if (range.compareBoundaryPoints(Range.END_TO_END, hlRange) < 0) {
        effectiveRange.setEnd(range.endContainer, range.endOffset);
      } else {
        effectiveRange.setEnd(hlRange.endContainer, hlRange.endOffset);
      }
      const effectiveText = effectiveRange.toString();
      if (!effectiveText) return; // 若交集文字為空則跳過

      // 5.3 取得高亮元素內的完整文字內容
      const fullText = highlightEl.textContent || "";

      // 5.4 如果交集文字正好等於整個高亮內容，就表示使用者選取的部分涵蓋了整個高亮區塊
      if (fullText === effectiveText) {
        // 直接以普通文字取代整個高亮元素
        const textNode = document.createTextNode(fullText);
        highlightEl.replaceWith(textNode);
      } else {
        // 否則，只移除交集部分的高亮效果，保留其餘仍保持高亮
        // 找出 effectiveText 在 fullText 中的位置（假設 fullText 為單一純文字內容）
        const startIndex = fullText.indexOf(effectiveText);
        if (startIndex === -1) return; // 理論上不會發生
        const endIndex = startIndex + effectiveText.length;

        // 分割成三段：前段、交集部分、後段
        const beforeText = fullText.slice(0, startIndex);
        const afterText = fullText.slice(endIndex);

        // 以 DocumentFragment 組合新節點
        const fragment = document.createDocumentFragment();

        // 若前段有文字，重新包成高亮 span
        if (beforeText) {
          const beforeSpan = document.createElement("span");
          beforeSpan.className = "highlight";
          beforeSpan.textContent = beforeText;
          fragment.appendChild(beforeSpan);
        }

        // 將交集部分轉為普通文字節點（即取消高亮）
        fragment.appendChild(document.createTextNode(effectiveText));

        // 若後段有文字，同樣包成高亮 span
        if (afterText) {
          const afterSpan = document.createElement("span");
          afterSpan.className = "highlight";
          afterSpan.textContent = afterText;
          fragment.appendChild(afterSpan);
        }

        // 用組合後的新節點取代原本的高亮元素
        highlightEl.replaceWith(fragment);
      }
    });

    // 6. 清除選取範圍，並重設 popup 位置（假設 setPopupPosition 已定義）
    selectionObj.removeAllRanges();
    setPopupPosition(null);
  };



  return (
    <div className="container">
      {law ? (
        <div className="law-container">
          <div className="law-articles" onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp}>
            <span className="law-title">{law.LawName}</span>
            <p className="law-date">最後修訂日期：
              <span className="vertical-numbers">
                {law.LawModifiedDate}
              </span>
            </p>
            {law.LawArticles.slice().map((article, index) => (
              <div key={index}>
                <strong>{formatArticleNo(article.ArticleNo)}</strong>
                <p>{article.ArticleContent}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>載入中...</p>
      )}

      {/* 浮動標記按鈕 */}
      {popupPosition && (
        <div className="popup" style={{ top: popupPosition.y, left: popupPosition.x }}>
          {isRemovingHighlight ? (
            <button onClick={removeHighlight} onTouchEnd={removeHighlight}>取消標記</button>
          ) : (
            <button onClick={applyHighlight} onTouchEnd={applyHighlight}>標記</button>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
